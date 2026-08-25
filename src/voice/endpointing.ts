/**
 * Deciding when someone has finished speaking.
 *
 * This is what turns tap-to-start / tap-to-stop into a conversation. It watches
 * the input level the recorder already reports and calls the end of a turn once
 * the person has been quiet for long enough.
 *
 * Pure on purpose — a fold over a stream of samples — so every case can be
 * tested against a synthetic level trace instead of by talking at a phone and
 * hoping.
 *
 * WHY THE THRESHOLD IS ADAPTIVE RATHER THAN A NUMBER. Metering is dBFS, but the
 * two platforms do not measure the same thing:
 *
 *   iOS      `AVAudioRecorder.averagePower` — the AVERAGE over the interval
 *   Android  `MediaRecorder.maxAmplitude`   — the PEAK since the last read
 *
 * A peak runs well above an average for identical speech, so one fixed cutoff
 * is either deaf on iOS or trigger-happy on Android — and neither survives the
 * difference between a quiet bedroom and a car with the window down. Instead
 * this tracks the room's own noise floor and listens for speech ABOVE it.
 *
 * The floor falls instantly and rises slowly, and that asymmetry is deliberate.
 * Recording sometimes starts with the person already talking; a floor that
 * jumped straight to their voice would set the bar above them and never hear a
 * word. Starting low and creeping up means the worst case is a moment of extra
 * sensitivity, not a mic that ignores you.
 */

export type EndpointConfig = {
  /**
   * How far above the room's noise floor counts as speech.
   *
   * 12 dB is roughly "clearly louder than the room". Speech at arm's length
   * from a phone sits 20-30 dB above a quiet room, so this has real margin
   * without picking up a fridge.
   */
  speechMarginDb: number;
  /** The adaptive threshold is clamped into this band, whatever the room does. */
  minThresholdDb: number;
  maxThresholdDb: number;
  /** Where the floor starts before the room has told us anything. */
  initialFloorDb: number;
  /** The floor is kept inside this band so one strange sample cannot wreck it. */
  floorFloorDb: number;
  floorCeilingDb: number;
  /** How fast the floor may rise, in dB per second. Falling is instant. */
  floorRiseDbPerSecond: number;
  /**
   * How long to wait after the last speech before deciding the person is done.
   *
   * Too short and it cuts people off in the pause between clauses — which for
   * this product means cutting someone off mid-sentence about something
   * difficult. Too long and every turn drags. 1.2s is the middle, and it is the
   * single number most worth tuning against real use.
   */
  silenceHangoverMs: number;
  /** A cough or a chair scrape should not become a turn. */
  minUtteranceMs: number;
  /** Safety net so a hot mic in a noisy room cannot record forever. */
  maxUtteranceMs: number;
  /** If nobody says anything at all, end the turn without sending. */
  noSpeechTimeoutMs: number;
  /** How long to wait for a real metering value before giving up on it. */
  meteringGraceMs: number;
};

export const DEFAULT_ENDPOINT_CONFIG: EndpointConfig = {
  speechMarginDb: 12,
  minThresholdDb: -45,
  maxThresholdDb: -25,
  initialFloorDb: -50,
  floorFloorDb: -70,
  floorCeilingDb: -20,
  floorRiseDbPerSecond: 3,
  silenceHangoverMs: 1_200,
  minUtteranceMs: 500,
  maxUtteranceMs: 90_000,
  noSpeechTimeoutMs: 12_000,
  meteringGraceMs: 1_500,
};

export type EndpointDecision =
  /** Still going. Keep recording. */
  | 'listening'
  /** They have finished. Stop and send. */
  | 'endpoint'
  /** Nothing was said. Stop, send nothing, and keep listening. */
  | 'noSpeech'
  /**
   * The recorder is not reporting levels, so silence cannot be detected at all.
   * Hands-free is impossible; the caller falls back to tap-to-send and says so.
   */
  | 'noMetering';

export type EndpointState = {
  /** True once any sample has cleared the speech threshold. */
  heardSpeech: boolean;
  /** Elapsed ms at the most recent speech sample. */
  lastSpeechAtMs: number;
  /** Elapsed ms at the previous sample, so the floor can rise per unit time. */
  lastElapsedMs: number;
  /** The room's noise floor, in dBFS, as currently estimated. */
  noiseFloorDb: number;
  samples: number;
  /** Samples that carried a usable level. Zero means metering is dead. */
  meteredSamples: number;
  loudestDb: number;
  quietestDb: number;
};

export function newEndpointState(
  config: EndpointConfig = DEFAULT_ENDPOINT_CONFIG,
): EndpointState {
  return {
    heardSpeech: false,
    lastSpeechAtMs: 0,
    lastElapsedMs: 0,
    noiseFloorDb: config.initialFloorDb,
    samples: 0,
    meteredSamples: 0,
    loudestDb: Number.NEGATIVE_INFINITY,
    quietestDb: Number.POSITIVE_INFINITY,
  };
}

/** What currently counts as speech, given what the room has sounded like. */
export function speechThreshold(state: EndpointState, config: EndpointConfig): number {
  return clamp(
    state.noiseFloorDb + config.speechMarginDb,
    config.minThresholdDb,
    config.maxThresholdDb,
  );
}

/**
 * Folds one level sample into the state and says what to do.
 *
 * `level` is dBFS, or null when the recorder gave us nothing for this tick.
 */
export function observeLevel(
  state: EndpointState,
  level: number | null,
  elapsedMs: number,
  config: EndpointConfig = DEFAULT_ENDPOINT_CONFIG,
): { state: EndpointState; decision: EndpointDecision } {
  const usable = level !== null && Number.isFinite(level);

  const next: EndpointState = {
    ...state,
    lastElapsedMs: elapsedMs,
    samples: state.samples + 1,
    meteredSamples: state.meteredSamples + (usable ? 1 : 0),
    loudestDb: usable ? Math.max(state.loudestDb, level) : state.loudestDb,
    quietestDb: usable ? Math.min(state.quietestDb, level) : state.quietestDb,
  };

  // No levels at all after the grace period: silence detection is impossible.
  // Say so rather than silently recording until the safety timeout, which would
  // look like the app ignoring the person.
  if (next.meteredSamples === 0 && elapsedMs >= config.meteringGraceMs) {
    return { state: next, decision: 'noMetering' };
  }

  if (usable) {
    // Fall instantly, rise slowly. See the note at the top of the file for why
    // that asymmetry is the safe one.
    const sinceLastMs = Math.max(0, elapsedMs - state.lastElapsedMs);
    const mayRiseTo = state.noiseFloorDb + (config.floorRiseDbPerSecond * sinceLastMs) / 1000;
    next.noiseFloorDb = clamp(
      Math.min(mayRiseTo, level),
      config.floorFloorDb,
      config.floorCeilingDb,
    );

    if (level > speechThreshold(next, config)) {
      next.heardSpeech = true;
      next.lastSpeechAtMs = elapsedMs;
    }
  }

  if (elapsedMs >= config.maxUtteranceMs) {
    // Long, but if they were clearly saying something it is worth sending.
    return { state: next, decision: next.heardSpeech ? 'endpoint' : 'noSpeech' };
  }

  if (!next.heardSpeech) {
    return {
      state: next,
      decision: elapsedMs >= config.noSpeechTimeoutMs ? 'noSpeech' : 'listening',
    };
  }

  // They have spoken. Are they done?
  const quietForMs = elapsedMs - next.lastSpeechAtMs;
  const longEnough = elapsedMs >= config.minUtteranceMs;

  if (longEnough && quietForMs >= config.silenceHangoverMs) {
    return { state: next, decision: 'endpoint' };
  }

  return { state: next, decision: 'listening' };
}

/** A one-line summary of what the microphone actually heard, for the log. */
export function describeLevels(state: EndpointState, config: EndpointConfig): string {
  if (state.meteredSamples === 0) {
    return `no metering (${state.samples} samples)`;
  }
  return (
    `levels ${state.quietestDb.toFixed(0)}..${state.loudestDb.toFixed(0)}dB, ` +
    `floor ${state.noiseFloorDb.toFixed(0)}dB, ` +
    `threshold ${speechThreshold(state, config).toFixed(0)}dB, ` +
    `${state.meteredSamples}/${state.samples} samples metered`
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
