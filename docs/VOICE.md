# Voice: recommendation, architecture, and what Ken needs to set up

Status: **plumbing built, provider not yet chosen.** This document is the
recommendation. Nothing in the app depends on it — the `VoiceProvider` seam
means picking a different vendor is one new file.

## The short version

| | Recommendation |
| --- | --- |
| **TTS** (the warm voice) | **ElevenLabs** |
| **STT** (hearing the person) | **ElevenLabs Scribe** |
| **Where the keys live** | **Backend, not the app** |
| **What Ken provides** | One ElevenLabs account + API key, set on Railway |

## Why ElevenLabs for the voice

Comfort is the whole point, and on naturalness ElevenLabs is still the one to
beat — it handles emotion and pacing better than the alternatives, which is
exactly the axis that matters when someone is describing a death in the family
rather than asking for a quote.

The trade is cost. ElevenLabs' premium voices run around **$0.09/min** against
roughly **$0.015/min** for OpenAI's `gpt-4o-mini-tts` and **$0.004/min** for
Google/Polly standard voices. For a discovery conversation — say ten AI replies
of ~20s — that is roughly **$0.30 a conversation** versus ~$0.05. At prototype
volume the difference is rounding; at scale it is worth revisiting.

**If cost becomes the constraint before quality does,** OpenAI `gpt-4o-mini-tts`
is the fallback and the seam makes it a one-file change. I would not start
there: starting cheap and hoping warmth survives is the wrong order for this
product.

Worth knowing about, not recommended yet:

- **Cartesia** — lowest latency (~40–90ms model latency, ~188ms P50 in
  independent testing). Matters for realtime voice agents. **Ours is turn-based,
  so it does not.** Do not pay a quality tax for latency we cannot perceive.
- **Hume** — built specifically for empathic delivery. Genuinely interesting for
  this product, but its flagship is a full conversational agent (EVI) that would
  compete with the `/v1/chat` brain we already have. Revisit only if ElevenLabs'
  warmth proves insufficient.

## Why ElevenLabs for hearing, too

Scribe tops independent English accuracy benchmarks (~3–4% WER, against
Deepgram Nova-3 at ~5.3% and OpenAI GPT-4o Transcribe at ~8.9%), and it is
cheap — about **$0.22/hour** batch.

More practically: **one account, one key, one vendor, one bill.** Deepgram is
marginally cheaper and lower-latency, but splitting across two vendors to save
fractions of a cent per minute is not worth the second set of credentials.

## Architecture: proxy through the backend. Not negotiable.

```
 iPhone (Expo Go)                    Railway backend              ElevenLabs
 ─────────────────                   ───────────────              ──────────
 hold mic → expo-audio  ──audio──▶   POST /v1/voice/transcribe ──▶  Scribe
                                                               ◀──  text
 show transcript        ◀──text───

 transcript             ──text───▶   POST /v1/chat  ────────────▶  Claude
                                                               ◀──  reply
 show reply             ◀──text───

                        ──text───▶   POST /v1/voice/speak ───────▶  TTS
 play with expo-audio   ◀──audio──                             ◀──  mp3
```

**Why not call ElevenLabs directly from the app:** `EXPO_PUBLIC_*` values are
inlined into the JavaScript bundle as plain strings. This is not theoretical —
the deployed API base URL is sitting in our current bundle as:

```
Object.defineProperties(process.env, {"EXPO_PUBLIC_API_BASE_URL": {
  enumerable: true, value: "https://web-production-e36a6.up.railway.app" }, …
```

An `EXPO_PUBLIC_ELEVENLABS_KEY` would sit there identically, readable by anyone
who pulls the bundle. It is a billable credential. It goes on the server, next
to `ANTHROPIC_API_KEY`.

The proxy also buys three things worth having anyway: one place to swap vendors
for every client at once, one place to rate-limit spend, and voice usage landing
in the same audit trail as everything else.

## What Ken needs to do

1. **Create an ElevenLabs account** and generate an API key.
2. **Pick a voice** in their voice library and note its voice ID. Worth spending
   real time here — this is the voice people in difficult moments will hear.
   Choose for warmth and unhurriedness over polish.
3. **Set two variables on Railway**, the same way `ANTHROPIC_API_KEY` was set:

   ```
   ELEVENLABS_API_KEY=...
   ELEVENLABS_VOICE_ID=...
   ```

4. **Nothing goes in the app.** No `EXPO_PUBLIC_` voice keys, ever.

## The backend endpoints this app already calls

Not built yet. `BackendVoiceProvider` targets these, so voice starts working the
moment they exist — no app change, no new build, no re-scan.

### `POST /v1/voice/transcribe`

```json
// request
{ "audio_base64": "<base64 of an m4a/aac recording>", "mime_type": "audio/m4a" }
// response
{ "text": "I inherited my mother's house and I don't know where to start." }
```

### `POST /v1/voice/speak`

```json
// request
{ "text": "That sounds like a lot to carry.", "voice_id": "optional-override" }
// response
{ "audio_base64": "<base64 mp3>", "mime_type": "audio/mpeg" }
```

Base64 rather than multipart/binary so both go through the same JSON client as
everything else, and because `expo-file-system` reads and writes base64
directly. The ~33% size overhead is worth not maintaining a second transport.

## One design problem worth deciding on before this ships

**Total turn latency.** Measured against the live backend, `/v1/chat` alone
takes **3–13 seconds**, and one continuation took 47s. Add STT (~1–2s) and TTS
(~1–3s) and a spoken turn could run **15–20 seconds of silence** before the
person hears anything.

In text that is a visible "thinking" indicator. **In voice, silence reads as
broken** — people repeat themselves, or give up.

Options, roughly in order of effort:

1. **Say something during the wait.** The stage line already narrates
   ("Catching what you said…", "Thinking about it…"). Cheapest, helps a lot.
2. **Fix the backend latency.** The 47s outlier and the hangs are already
   flagged in PR #9 — worth solving on its own merits.
3. **Stream the TTS.** Start speaking the first sentence while the rest
   synthesises. Meaningful work, and the seam supports it later.

I would not ship voice to five test users on option 1 alone if `/v1/chat`
latency stays where it is.

## Sources

- [Best Text-to-Speech APIs in 2026: ElevenLabs, Cartesia, Deepgram, Hume Compared](https://futureagi.com/blog/best-text-to-speech-providers-2026/)
- [Best TTS APIs in 2026: ElevenLabs, Google, AWS & 9 More Compared](https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers)
- [Best Speech-to-Text APIs in 2026 — Deepgram, AssemblyAI, Whisper, ElevenLabs Compared](https://futureagi.com/blog/speech-to-text-apis-in-2026-benchmarks-pricing-developer-s-decision-guide/)
- [Best Speech-to-Text APIs in 2026: A Comprehensive Comparison Guide](https://deepgram.com/learn/best-speech-to-text-apis-2026)
- [expo-audio (SDK 54)](https://docs.expo.dev/versions/v54.0.0/sdk/audio/)

Pricing and benchmark figures are from these comparisons, gathered August 2026.
Confirm current pricing with the vendor before committing — this moves fast.
