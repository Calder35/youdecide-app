# You Decide — Seller Mobile App

The consumer-facing mobile app for **You Decide AI**, a supervised AI real-estate platform.
Nevada sellers use it to list their home for a **1% listing-side fee**, with a **licensed human
reachable at every consequential step**.

> **Supervised v1.** The app educates, prepares, and organizes. A licensed human approves every
> high-consequence action. The AI never acts alone.

> **Non-production.** Review-ready only — no real credentials, no production systems, nothing
> published. Backend work targets the **test** endpoints of `Calder35/youdecide-ai-backend`.

## The seller flow

```
welcome → account & consent → seller discovery → the 1% explanation
        → property workspace → AI plan/prep → "get a human" handoff → status
```

The order lives in one file — [`src/navigation/routes.ts`](src/navigation/routes.ts) — and the
screens read it rather than hard-coding what comes next.

## Non-negotiables

These hold from the first commit, and tests enforce the ones that can be:

1. **"Get a human" is persistent** — rendered on every screen by `ScreenScaffold`, not by
   individual screens, and it shows **what information transfers** before anything is sent.
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
| 3 | Design system + trust UI — consent/disclosure, source & confidence display, a11y | **this PR** |
| 4 | Backend test API — account/consent → workspace → request human | planned |

**Milestone acceptance:** five users can complete the scripted seller intake and request a human,
and the 1% explanation reads clearly.

## Related repos

- **Backend / You Decide AI API:** `Calder35/youdecide-ai-backend`
- **Fleet / DE training:** `Calder35/gustaf`
