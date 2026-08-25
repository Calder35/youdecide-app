# Streaming chat: the contract, and what it actually bought

**Live and wired.** The app streams every spoken turn. This records the
confirmed contract, the measured result, and the two server settings that were
got right (and would silently undo it if they changed).

## The contract

```
POST /v1/chat/stream
{ "conversation_id": "…optional…", "message": "…", "mode": "voice" }
```

Response is `text/event-stream`, one JSON object per `data:` line, one `type`
each, no `event:` lines:

```
data: {"type": "start", "conversation_id": "…"}
data: {"type": "sentence", "seq": 0, "text": "Okay, that's workable…"}
data: {"type": "sentence", "seq": 1, "text": "Has anything formal come…"}
data: {"type": "done", "conversation_id": "…", "reply": "…full text…",
       "escalate": false, "escalate_kind": "none"}
```

- `start` always first, so the conversation id exists before any words do.
- `sentence` is **already safe to speak** — the app synthesises and plays it on
  arrival and never reassembles.
- `done` carries the **full reply**, so the transcript is what the model said
  rather than a reassembly of what happened to arrive.
- `error` replaces `done` on failure, because the headers have already gone out
  and there is no 503 left to send.

The parser also reads newline-delimited JSON, and tolerates `[DONE]`, SSE
comments, and `event:`/`id:`/`retry:` lines. None of that is needed today; it is
there so a change in wire format is not a client release.

### What it is tolerant about

Field names are read loosely, the same way `escalate` already is in
`/v1/chat`, so a spelling difference does not silently break a turn:

| Meaning | Accepted as |
|---|---|
| sentence type | `sentence`, `delta`, `text`, or **no `type` at all** |
| sentence text | `text`, `sentence`, `delta`, `content` |
| end of reply | `type` of `done`, `end`, or `complete` |
| conversation id | `conversation_id`, `conversationId` |
| escalation | `escalate_kind`, `escalationKind`, or a plain `escalate` boolean |
| failure | `type: "error"` with `message`, `detail`, or `error` |

### What it does on the edges

- **A sentence split across packets** is reassembled. The parser holds a partial
  line until the rest arrives.
- **A malformed line** is logged and skipped. One bad line costs one sentence,
  not the rest of the reply.
- **No `done` event** — the sentences already spoken are kept, the turn is
  recorded with `escalate: none`, and `endedWithoutDone` is set. It is treated
  as a backend bug, not as a reason to lose what was said.
- **An `error` event** after sentences have gone out **keeps them**. They were
  spoken; binning them would be a worse lie than an incomplete answer. The turn
  is recorded, a note explains it stopped early, and the conversation carries on
  listening. Only a stream that produced *nothing* fails the turn outright.
- **No new data for 20s** ends the stream with a timeout. This is an *idle*
  timeout, not a total one — a long reply that is still arriving is fine.

## Two things the server must get right

Both of these silently destroy the benefit rather than causing an error, so
they are worth checking with a real client rather than assuming.

### 1. Do not compress this route

Gzip/brotli middleware buffers the response to compress it. The stream arrives
as one lump at the end and the app cannot tell the difference — it just looks
slow again. Exclude `/v1/chat/stream` from compression.

### 2. Do not let a proxy buffer it

If anything sits in front of the app server, it needs to be told not to hold the
response:

```
Cache-Control: no-cache
X-Accel-Buffering: no      # nginx
```

and the app server must flush after each event rather than at the end of the
handler.

**How to verify it is genuinely streaming:** `curl -N` and watch the lines
appear one at a time. If they all land together, the app will behave exactly as
it does today — no error, no benefit.

```
curl -N --max-time 30 -X POST https://…/v1/chat/stream \
  -H 'content-type: application/json' \
  -d '{"message":"I am two months behind on my mortgage.","mode":"voice"}'
```

## Why sentences, not tokens

The app turns each event into speech. A token or a half-sentence cannot be
synthesised into something worth hearing, and stitching fragments back into
sentences on the client would just move the problem. **Emit whole sentences.**

The first one matters most: it is the one the person waits for. A short opening
sentence gets sound out fastest — synthesis costs roughly 1.25s flat plus 5ms
per character, so an 80-character opener is ~1.4s and a 240-character one is
~2.5s.

## What it actually bought

Measured against the live backend, 10 spoken turns, same audio and the same
speech-to-text step on both sides — the comparison is what happens *after* the
mic stops.

| | median | range |
|---|---:|---|
| before — wait for the whole reply | **5529ms** | 5179–13358 |
| after — speak the first sentence | **4816ms** | 4198–22299 |
| **saved** | **~712ms (13%)** | |

**That is less than the 1.5s we hoped for, and the reason is worth knowing:
spoken replies are already short.** A `mode: "voice"` reply is two sentences,
about 150–220 characters, and the backend writes the whole thing in 2.4–3.4s.
The first sentence lands at 1.9–2.4s — so streaming only recovers the ~0.5–1.0s
between them, plus a little more from synthesising a shorter opening piece
(1.2–1.5s against 1.4–1.6s).

The earlier work to make spoken replies short had already taken most of the
delay that streaming exists to remove. **Streaming pays off in proportion to
reply length**, and these replies are deliberately brief.

Both sides show real outliers — one 13.4s and one 22.3s turn — which are model
latency on the backend, not the transport. The median is the honest number; any
individual turn can be much worse.

## Turning it off

On by default. To fall back to one `/v1/chat` call and chunked speech:

```
EXPO_PUBLIC_VOICE_STREAMING=false
```

Worth keeping, because it is the difference between "voice is slow" and "voice
is broken" if the stream ever misbehaves.

If the path or the event names change, the edit is `CHAT_STREAM_PATH` and the
readers in `src/api/chatStream.ts` — the transport underneath and the speech
queue above it know nothing about the contract.

## Typed chat is unchanged

Streaming is used for **spoken turns only**. It buys time-to-first-*sound*, and
there is no equivalent win for text: a reply that paints in sentence by sentence
on screen is a separate design decision with its own consequences for how the
transcript reads. Typed messages keep using `/v1/chat`.
