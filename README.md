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
   how sure it is. Token vocabulary is reserved in the theme; the components land in chunk 3.
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
  components/            ScreenScaffold, GetHumanBar, Button, FooterLinks
  theme/                 design tokens — color, typography, spacing
  __tests__/             flow-order, token, and navigation tests
```

## Build plan

Each chunk is one reviewable PR, stacked.

| Chunk | What lands | Status |
| ----- | ---------- | ------ |
| 1 | Scaffold — Expo + TS skeleton, navigation shell, design tokens, CI | **this PR** |
| 2 | Interactive prototype — every screen wired with mock data, fully navigable | next |
| 3 | Design system + trust UI — consent/disclosure, source & confidence display, a11y | planned |
| 4 | Backend test API — account/consent → workspace → request human | planned |

**Milestone acceptance:** five users can complete the scripted seller intake and request a human,
and the 1% explanation reads clearly.

## Related repos

- **Backend / You Decide AI API:** `Calder35/youdecide-ai-backend`
- **Fleet / DE training:** `Calder35/gustaf`
