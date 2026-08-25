import { splitForSpeech } from '../voice/speechChunks';

/**
 * Chunked speech, measured against the deployed TTS service.
 *
 * EXCLUDED FROM CI (`jest.config` ignores `src/live/`) — it calls a real
 * service and a real model. Run it when you want to know the numbers:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://web-production-e36a6.up.railway.app \
 *     npx jest src/live --testPathIgnorePatterns "/node_modules/"
 *
 * What it is here to answer: does splitting a long reply actually get sound to
 * a person sooner, and does every chunk survive the round trip?
 */

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
const describeLive = BASE_URL.length > 0 ? describe : describe.skip;

/** A real-shaped discovery reply — the kind that was failing to speak. */
const LONG_REPLY = `I'm really glad you told me that — being behind on the mortgage is a heavy thing to carry, and it's the kind of thing people sit on for months before saying out loud.

Before we talk about the house at all, I want to understand where you actually are. How far behind are you, and has the lender been in touch, or is this still something you're holding on your own?

There's usually more room than people think. The options are very different depending on whether you're one month behind or six, and nothing you tell me commits you to anything at all.`;

async function speak(text: string) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/v1/voice/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = (await response.json()) as { audio_base64?: string };
  const base64 = body.audio_base64 ?? '';
  return { ms: Date.now() - started, bytes: Math.round((base64.length * 3) / 4), ok: base64.length > 0 };
}

describeLive('speaking a long reply', () => {
  jest.setTimeout(300_000);

  it('gets sound to the person far sooner in chunks than whole', async () => {
    const whole = await speak(LONG_REPLY);
    const chunks = splitForSpeech(LONG_REPLY);
    const first = await speak(chunks[0]);

    console.log(`reply ${LONG_REPLY.length} chars -> ${chunks.length} chunks`);
    console.log(`  whole:       ${whole.ms}ms, ${whole.bytes} bytes`);
    console.log(`  first chunk: ${first.ms}ms, ${first.bytes} bytes`);
    console.log(`  time to first sound: ${whole.ms}ms -> ${first.ms}ms`);

    expect(whole.ok).toBe(true);
    expect(first.ok).toBe(true);
    // The whole point of chunking.
    expect(first.ms).toBeLessThan(whole.ms);
  });

  it('synthesises every chunk successfully', async () => {
    const chunks = splitForSpeech(LONG_REPLY);
    const results = [];
    for (const chunk of chunks) {
      results.push({ chars: chunk.length, ...(await speak(chunk)) });
    }

    for (const [index, result] of results.entries()) {
      console.log(`  chunk ${index + 1}: ${result.chars} chars -> ${result.ms}ms, ${result.bytes} bytes`);
      expect(`chunk ${index + 1} ok: ${result.ok}`).toBe(`chunk ${index + 1} ok: true`);
    }
  });
});
