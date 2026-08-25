import { FIRST_CHUNK_CHARS, MAX_CHUNK_CHARS, splitForSpeech } from './speechChunks';
import { VoiceError, voiceError, type SpeakableAudio } from './types';

/**
 * Speaking a reply that is still being written.
 *
 * THE CHANGE THIS MAKES POSSIBLE. Until now a spoken turn waited for the whole
 * reply, then split it, then synthesised the first piece — so the model finished
 * writing sentence four before anyone heard sentence one. With the backend
 * streaming sentence by sentence, sentence one can be synthesised WHILE sentence
 * two is still being generated, and the ~3s the model spends writing stops being
 * silence the person sits through.
 *
 * The queue is the shape that allows it: text goes in whenever it arrives, audio
 * comes out in order, and neither side waits for the other to finish. Push the
 * whole reply in one go and it behaves exactly as the old code did — which is
 * how typed chat and the non-streaming path stay unchanged.
 *
 * ORDER IS NOT NEGOTIABLE. Sentences are synthesised in parallel and played
 * strictly in sequence. Playing whichever came back first would reorder somebody's
 * answer, which is worse than being slow.
 */

/** How many pieces are synthesised ahead of the one being spoken. */
const SYNTHESIS_LOOKAHEAD = 2;

export type SpeechQueue = {
  /** Adds text to be spoken. Safe to call at any time before `end()`. */
  push: (text: string) => void;
  /** No more text is coming. */
  end: () => void;
  /** Stops as soon as the current piece finishes. Nothing further is spoken. */
  cancel: () => void;
  /**
   * Resolves when everything pushed has been spoken, or when speaking gave up.
   *
   * It RESOLVES rather than rejects on a speech failure, deliberately. By the
   * time anything is being spoken the person's words are already safely in the
   * conversation and the reply is already on screen; failing to read it out is a
   * small loss, reported through `onError`, not a reason to fail the turn.
   */
  done: Promise<void>;
};

export type SpeechQueueOptions = {
  synthesize: (text: string) => Promise<SpeakableAudio>;
  play: (uri: string) => Promise<void>;
  onError: (error: VoiceError) => void;
  /** Called once, as the first piece starts playing. */
  onFirstSound?: (elapsedMs: number, pieces: number) => void;
  log?: (message: string) => void;
  now?: () => number;
  lookahead?: number;
};

export function createSpeechQueue(options: SpeechQueueOptions): SpeechQueue {
  const {
    synthesize,
    play,
    onError,
    onFirstSound,
    log,
    now = () => Date.now(),
    lookahead = SYNTHESIS_LOOKAHEAD,
  } = options;

  const pieces: string[] = [];
  const inFlight: (Promise<SpeakableAudio> | null)[] = [];

  let ended = false;
  let cancelled = false;
  let spoken = 0;
  let next = 0;
  const startedAt = now();

  /** Wakes the playback loop when new text arrives or the stream ends. */
  let wake: (() => void) | null = null;
  const waitForMore = () =>
    new Promise<void>((resolve) => {
      wake = resolve;
    });
  const nudge = () => {
    const resume = wake;
    wake = null;
    resume?.();
  };

  /** Starts a piece synthesising, if it exists and has not been started. */
  const request = (index: number) => {
    if (index >= pieces.length || inFlight[index] != null) return;
    const attempt = withOneRetry(
      () => synthesize(pieces[index]),
      (error) => log?.(`voice: synthesize failed, retrying once — ${describe(error)}`),
    );
    // A piece we may never reach — because an earlier one failed, or the
    // conversation ended — must not surface as an unhandled rejection.
    // Awaiting it below still throws.
    attempt.catch(() => undefined);
    inFlight[index] = attempt;
  };

  const requestAhead = (from: number) => {
    for (let ahead = 0; ahead <= lookahead; ahead += 1) request(from + ahead);
  };

  const report = (thrown: unknown, index: number) => {
    // Anything already spoken is worth distinguishing from nothing spoken: one
    // is a reply that stopped early, the other is a reply that never started.
    const kind = spoken > 0 ? 'speakCutShort' : 'speakFailed';
    const failure = thrown instanceof VoiceError ? thrown : voiceError(kind, thrown);
    log?.(
      `voice: speak failed on piece ${index + 1} after ${spoken} spoken — ${describe(
        failure.cause ?? failure,
      )}`,
    );
    onError(failure);
  };

  const done = (async () => {
    for (;;) {
      if (cancelled) return;

      if (next >= pieces.length) {
        if (ended) {
          if (spoken > 0) log?.('voice: turn complete');
          return;
        }
        // Nothing to say yet and more is coming. This is the wait that used to
        // be the whole reply's generation time.
        await waitForMore();
        continue;
      }

      requestAhead(next);
      const current = inFlight[next];
      if (current == null) return;

      let audio: SpeakableAudio;
      try {
        audio = await current;
      } catch (thrown) {
        report(thrown, next);
        return;
      }

      if (cancelled) return;

      // Top the queue back up before playing, so requests and audio overlap
      // rather than alternate.
      requestAhead(next + 1);

      try {
        if (next === 0) onFirstSound?.(now() - startedAt, pieces.length);
        await play(audio.uri);
        spoken += 1;
      } catch (thrown) {
        report(thrown, next);
        return;
      }

      next += 1;
    }
  })();

  return {
    push(text: string) {
      if (ended || cancelled) return;
      const cleaned = text.trim();
      if (cleaned.length === 0) return;

      // The tight opening budget applies only to the very first thing said, so
      // the first sound arrives quickly. After that the seams matter more than
      // the milliseconds, and longer pieces sound better.
      const firstBudget = pieces.length === 0 ? FIRST_CHUNK_CHARS : MAX_CHUNK_CHARS;
      const added = splitForSpeech(cleaned, MAX_CHUNK_CHARS, firstBudget);
      log?.(`voice: speaking ${cleaned.length} chars in ${added.length} piece(s)`);
      pieces.push(...added);
      while (inFlight.length < pieces.length) inFlight.push(null);

      // Begin synthesising immediately if this is within reach of the playhead.
      requestAhead(next);
      nudge();
    },

    end() {
      ended = true;
      nudge();
    },

    cancel() {
      cancelled = true;
      ended = true;
      nudge();
    },

    done,
  };
}

/** Runs `attempt`, and on failure runs it once more. */
async function withOneRetry<T>(
  attempt: () => Promise<T>,
  onRetry: (error: unknown) => void,
): Promise<T> {
  try {
    return await attempt();
  } catch (thrown) {
    onRetry(thrown);
    return attempt();
  }
}

/** A readable one-liner for a log, whatever was thrown. */
function describe(thrown: unknown): string {
  if (thrown instanceof VoiceError) return `${thrown.kind}: ${thrown.message}`;
  if (thrown instanceof Error) return thrown.message;
  return String(thrown);
}
