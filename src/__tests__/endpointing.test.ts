import {
  DEFAULT_ENDPOINT_CONFIG,
  describeLevels,
  newEndpointState,
  observeLevel,
  speechThreshold,
  type EndpointConfig,
  type EndpointDecision,
} from '../voice/endpointing';

/**
 * Knowing when someone has stopped talking.
 *
 * This is the piece that makes voice hands-free, and it is the piece most
 * likely to feel wrong: too eager and it cuts people off mid-thought, too slow
 * and the conversation drags. Testing it against synthetic level traces means
 * those judgements are checkable instead of a matter of talking at a phone.
 */

const CONFIG: EndpointConfig = {
  ...DEFAULT_ENDPOINT_CONFIG,
  silenceHangoverMs: 1300,
  minUtteranceMs: 600,
  noSpeechTimeoutMs: 10_000,
  meteringGraceMs: 1_500,
};

const SPEECH = -20;
const ROOM = -55;

/** Feeds a trace of [level, ms] samples and returns the decisions. */
function play(samples: [number | null, number][], config = CONFIG) {
  let state = newEndpointState(config);
  const decisions: EndpointDecision[] = [];
  for (const [level, elapsed] of samples) {
    const result = observeLevel(state, level, elapsed, config);
    state = result.state;
    decisions.push(result.decision);
    if (result.decision !== 'listening') break;
  }
  return { state, decisions, final: decisions[decisions.length - 1] };
}

/** Samples every 100ms at one level, starting from `fromMs`. */
function hold(level: number | null, fromMs: number, forMs: number): [number | null, number][] {
  const out: [number | null, number][] = [];
  for (let t = fromMs; t < fromMs + forMs; t += 100) out.push([level, t]);
  return out;
}

describe('ending a turn when the person stops', () => {
  it('ends after the hangover once they have spoken', () => {
    const { final } = play([...hold(SPEECH, 0, 2000), ...hold(ROOM, 2000, 2000)]);
    expect(final).toBe('endpoint');
  });

  it('does not end during a pause shorter than the hangover', () => {
    // A one-second gap between clauses — exactly where a person thinking about
    // something difficult would stop.
    const { final } = play([
      ...hold(SPEECH, 0, 1500),
      ...hold(ROOM, 1500, 1000),
      ...hold(SPEECH, 2500, 1000),
    ]);
    expect(final).toBe('listening');
  });

  it('waits for the full hangover, not a moment less', () => {
    const justUnder = play([...hold(SPEECH, 0, 1000), ...hold(ROOM, 1000, 1200)]);
    expect(justUnder.final).toBe('listening');

    const justOver = play([...hold(SPEECH, 0, 1000), ...hold(ROOM, 1000, 1500)]);
    expect(justOver.final).toBe('endpoint');
  });

  it('ignores a cough — too short to be a turn', () => {
    // A brief noise then silence: under the minimum utterance, so the hangover
    // cannot fire yet.
    const { final } = play([
      [SPEECH, 0],
      [SPEECH, 100],
      ...hold(ROOM, 200, 300),
    ]);
    expect(final).toBe('listening');
  });

  it('treats room noise as silence', () => {
    const { state, final } = play(hold(ROOM, 0, 3000));
    expect(state.heardSpeech).toBe(false);
    expect(final).toBe('listening'); // still waiting, not yet timed out
  });
});

describe('the threshold follows the room', () => {
  /**
   * The case a fixed cutoff gets wrong. A quiet room and a quiet voice: -40dB
   * is speech here, but a fixed -35dB cutoff would have heard nothing at all
   * and left the person talking to a mic that never answered.
   */
  it('hears quiet speech once the room has proved it is quiet', () => {
    const { state } = play([...hold(-70, 0, 1000), ...hold(-40, 1000, 1000)]);
    expect(state.heardSpeech).toBe(true);
    expect(speechThreshold(state, CONFIG)).toBeLessThan(-40);
  });

  /**
   * And the other way round. Steady noise at -30dB counts as speech at first —
   * the floor starts low on purpose, so someone already mid-sentence is heard —
   * but the floor climbs, the noise stops clearing the bar, and the turn ends
   * instead of recording the room forever.
   */
  it('stops mistaking a noisy room for speech, and ends the turn', () => {
    const { final, state } = play(hold(-30, 0, 8000));
    expect(final).toBe('endpoint');
    expect(state.noiseFloorDb).toBeGreaterThan(DEFAULT_ENDPOINT_CONFIG.initialFloorDb);
  });
});

describe('when nobody says anything', () => {
  it('gives up quietly rather than recording forever', () => {
    const { final } = play(hold(ROOM, 0, 11_000));
    expect(final).toBe('noSpeech');
  });

  it('does not call it speech just because time passed', () => {
    const { state } = play(hold(ROOM, 0, 11_000));
    expect(state.heardSpeech).toBe(false);
  });
});

describe('safety limits', () => {
  it('stops a very long turn and still sends it', () => {
    const config = { ...CONFIG, maxUtteranceMs: 3000 };
    const { final } = play(hold(SPEECH, 0, 4000), config);
    expect(final).toBe('endpoint');
  });

  it('stops an endlessly noisy room without sending it', () => {
    // Loud enough to never trigger the hangover would be speech; this is the
    // other case — under threshold the whole time, so nothing to send.
    const config = { ...CONFIG, maxUtteranceMs: 3000 };
    const { final } = play(hold(ROOM, 0, 4000), config);
    expect(final).toBe('noSpeech');
  });
});

describe('when the recorder reports no levels at all', () => {
  /**
   * The honest failure. Without levels there is no way to know when someone
   * finished, so hands-free is impossible and the app has to say so rather
   * than leave a person talking at a mic that will never respond.
   */
  it('reports it rather than listening forever', () => {
    const { final } = play(hold(null, 0, 2000));
    expect(final).toBe('noMetering');
  });

  it('waits out the grace period first — a late first sample is fine', () => {
    const { final } = play([...hold(null, 0, 500), ...hold(SPEECH, 500, 500)]);
    expect(final).toBe('listening');
  });

  it('does not cry no-metering once any real level has arrived', () => {
    const { final } = play([
      [SPEECH, 0],
      ...hold(null, 100, 2000),
    ]);
    expect(final).not.toBe('noMetering');
  });
});

describe('what it reports about the microphone', () => {
  it('summarises the levels it saw, for the log', () => {
    const { state } = play([...hold(SPEECH, 0, 500), ...hold(ROOM, 500, 500)]);
    const summary = describeLevels(state, CONFIG);
    expect(summary).toMatch(/-55\.\.-20dB/);
    expect(summary).toMatch(/samples/);
  });

  it('says plainly when metering never worked', () => {
    const { state } = play(hold(null, 0, 2000));
    expect(describeLevels(state, CONFIG)).toMatch(/no metering/);
  });
});
