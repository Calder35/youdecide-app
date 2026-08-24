# You Decide — Seller Mobile App

The consumer-facing mobile app for **You Decide AI**, a supervised AI real-estate platform.
Nevada sellers use it to list their home for a **1% listing-side fee**, with a **licensed human
reachable at every consequential step**.

> **Supervised v1.** The app educates, prepares, and organizes. A licensed human approves every
> high-consequence action. The AI never acts alone.

> **Non-production.** Review-ready only — no real credentials, no production systems, nothing
> published. Backend work targets the **test** endpoints of `Calder35/youdecide-ai-backend`.

## The opening: a conversation

The app opens on a **discovery conversation with You Decide AI**. It asks about the person,
listens, and reflects back what it heard. No fee, no "list your home", no intake form in front of
anyone — those exist, but they are what the conversation leads to, not what it starts with.

```
You Decide AI (discovery)  →  … only when there is a reason …  →  the intake flow below
```

The conversation lives in [`src/screens/ChatScreen.tsx`](src/screens/ChatScreen.tsx), backed by
`POST /v1/chat`. Until that endpoint exists, a local stub in
[`src/api/chatStub.ts`](src/api/chatStub.ts) runs the same discovery arc so the screen is fully
demoable with no backend. Pointing at the real thing is one env var.

### The intake flow, once a person gets there

```
welcome → account & consent → seller discovery → the 1% explanation
        → property workspace → AI plan/prep → handoff → status
```

The order lives in one file — [`src/navigation/routes.ts`](src/navigation/routes.ts) — and the
screens read it rather than hard-coding what comes next.

## Non-negotiables

These hold from the first commit, and tests enforce the ones that can be:

1. **A person arrives only when the AI decides one is needed.** There is no standing "talk to a
   human" button — that framed the AI as a waiting room in front of a person. The backend's
   `escalate` field drives it, the offer is AI-initiated, and it still shows **what information
   transfers** before anything is sent. Distress is handled with care and never as a sales moment.
   *(This reverses the persistent-bar rule from chunks 1–4 — see PR #8.)*
2. **The 1% offer is clear** — included vs. excluded, stated plainly, no disclaimer wall.
3. **Privacy and account-deletion entry points exist** — reachable from the entry screen and from
   status.
4. **Source and confidence on every number** — the app always shows where a figure came from and
   how sure it is. `Sourced<T>` in `src/data/types.ts` makes a bare number awkward to display, and
   `Figure` will not render a value without one.
5. **No real credentials, no production side effects.**

## Stack

React Native + Expo (SDK 57) + TypeScript, React Navigation 7. Rationale and consequences in
[STACK_DECISION.md](STACK_DECISION.md). How the app fits the one-brain / two-front-ends design is
in [ARCHITECTURE.md](ARCHITECTURE.md).

## Getting started

```bash
npm install
npm start          # Expo dev server — press i (iOS), a (Android), w (web)
```

Checks — the same three gates CI runs:

```bash
npm run typecheck
npm run lint
npm test
```

## Layout

```
App.tsx                  navigation container + providers
src/
  navigation/            route names, the flow order, the stack, param types
  screens/               one file per screen in the flow
  api/                   the backend test-API client — config guard, errors, intake calls
  components/            the design system — see src/components/README.md
  content/               DRAFT Nevada copy, pending licensed review
  data/                  fee math, consents, validation, the handoff payload, mock records
  state/                 SellerSession — everything the seller types, in one store
  theme/                 design tokens — color, typography, spacing
  test-utils/            renderApp helpers used by the integration tests
  __tests__/             flow, fee, consent, handoff, and journey tests
```

Three files carry most of the product’s weight:

- **`src/data/fee.ts`** — the 1% math and the included/excluded lists, together, so the promise and
  the price cannot drift apart.
- **`src/data/handoff.ts`** — the human-handoff payload *and* the disclosure the seller reads,
  built from the same object. A field cannot be sent without appearing in the list.
- **`src/content/nevada.ts`** — ⚠️ every claim about what Nevada requires, in one place, marked
  **DRAFT — pending licensed NV review**. None of it has been read by a licensed Nevada agent.
  Every screen rendering it also renders `DraftNotice`, and tests enforce that pairing.

## Talking to the backend

**Offline by default.** With no `EXPO_PUBLIC_API_BASE_URL` set, the app runs entirely on sample
data and sends nothing. That is the default build, and it is not an error state — every screen says
which mode it is in.

To wire it to a local backend, copy `.env.example` to `.env` and run
[`Calder35/youdecide-ai-backend`](https://github.com/Calder35/youdecide-ai-backend):

```bash
uvicorn app.main:app --reload --port 8000
```

> ⚠️ The seller-intake routes this app calls are on the backend's **`feat/01-data-model`** branch,
> not on its `main`. Backend PRs #10–#12 were merged into that branch rather than into `main`.

**The app has no production mode.** `src/api/config.ts` refuses any host that is not obviously a
test one — loopback, a private LAN address, a `.local` name, or a `test.`/`dev.`/`staging.`
hostname. A misconfigured build fails loudly at startup instead of quietly writing somewhere real.

What is wired: create seller → record each consent → open the property workspace → request a
licensed human → read the backend's audit trail back. Two rules the code follows:

- **A failed call never blocks the seller.** The local record is written first and always; the
  network call is best-effort on top of it. A backend outage cannot stop someone asking for a human.
- **We never navigate away from an error.** A failure keeps the seller on the screen where the
  explanation is, with a retry and a "Continue anyway".

## Accessibility

Held by tests, not by memory: WCAG AA contrast on every text/background pair the app renders
(`contrast.test.ts`), a name on every interactive control, a 44pt minimum target, and OS text
scaling never switched off (`accessibility.test.tsx`).

## Build plan

Each chunk is one reviewable PR, stacked.

| Chunk | What lands | Status |
| ----- | ---------- | ------ |
| 1 | Scaffold — Expo + TS skeleton, navigation shell, design tokens, CI | merged |
| 2 | Interactive prototype — every screen wired with mock data, fully navigable | merged |
| 3 | Design system + trust UI — consent/disclosure, source & confidence display, a11y | merged |
| 4 | Backend test API — account/consent → workspace → request human | **this PR** |

**Milestone acceptance:** five users can complete the scripted seller intake and request a human,
and the 1% explanation reads clearly.

## Related repos

- **Backend / You Decide AI API:** `Calder35/youdecide-ai-backend`
- **Fleet / DE training:** `Calder35/gustaf`
