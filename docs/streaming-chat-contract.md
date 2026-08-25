# Streaming chat: what the app expects, and what the server has to do

The app is ready to consume a streamed reply. This is what it is built against,
what it will tolerate, and the two server-side settings that decide whether any
of it actually works.

Nothing here is switched on yet — see [Turning it on](#turning-it-on).

## The contract we built against

```
POST /v1/chat/stream
{ "conversation_id": "…optional…", "message": "…", "mode": "voice" }
```

Response, as either server-sent events or newline-delimited JSON:

```
{"type":"sentence","text":"That happens a lot, and there are real options."}
{"type":"sentence","text":"Has anything formal come from your lender yet?"}
{"type":"done","conversation_id":"c-1","escalate":false,"escalate_kind":"none"}
```

**Both wire formats are read.** `data: ` prefixes are stripped if present, SSE
comments and `event:`/`id:`/`retry:` lines are skipped, and `[DONE]` is ignored.
Pick whichever is easier — the app does not need to be told which.

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
- **An `error` event** fails the turn. Anything already spoken has been spoken;
  nothing further is.
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

## Turning it on

Off by default. With the flag unset the app makes one ordinary `/v1/chat` call
exactly as it does today, so this can sit on `main` safely while the endpoint is
built.

```
EXPO_PUBLIC_VOICE_STREAMING=true
```

If the path or the event names differ from the above, the change is
`CHAT_STREAM_PATH` and the readers in `src/api/chatStream.ts` — the transport
underneath and the speech queue above it know nothing about the contract.

## Typed chat is unchanged

Streaming is used for **spoken turns only**. It buys time-to-first-*sound*, and
there is no equivalent win for text: a reply that paints in sentence by sentence
on screen is a separate design decision with its own consequences for how the
transcript reads. Typed messages keep using `/v1/chat`.
