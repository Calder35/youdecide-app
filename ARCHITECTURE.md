# Architecture — The Client Front-End

## The design in one line

This app is the **mobile client front-end**. It renders the experience and talks to the
**You Decide AI backend API** for all AI and decisioning. It does not contain the brain.

```
        ┌─────────────────────────────────────┐
        │  Fleet repo: Calder35/gustaf         │
        │  >>> DE ("You Decide AI") TRAINED    │
        └───────────────┬─────────────────────┘
                        │ trained brain
                        ▼
        ┌─────────────────────────────────────┐
        │  Backend: Calder35/youdecide-ai-     │
        │  backend — DE served as a shared API │
        └───────┬─────────────────────┬────────┘
                │                     │
     shared API │                     │ shared API
                ▼                     ▼
   ┌──────────────────────┐  ┌──────────────────────────┐
   │  Slack fleet         │  │  THIS REPO: youdecide-app │
   │  (Calder35/gustaf)   │  │  mobile client (iOS +     │
   │                      │  │  Android)                 │
   └──────────────────────┘  └──────────────────────────┘
```

## What this app does

Users **list, buy, and research investment properties** through You Decide AI. The app owns the
mobile client experience: screens, navigation, auth, and the calls into the backend.

## Where the intelligence lives

**Not here.** Every AI/decisioning request goes to the You Decide AI backend
(`Calder35/youdecide-ai-backend`), which exposes the trained Decision Engine as an API. This app is
a thin client over that one brain — the same brain the Slack fleet uses — so the guidance a user
gets in the app matches the rest of You Decide.

## Stack

**TBD — owned by the App Developer.** The first real decision is **React Native vs. native
iOS/Android**; it (and its rationale) is recorded in [STACK_DECISION.md](STACK_DECISION.md). This
repo intentionally scaffolds no app framework yet so that decision stays open.

## Launch targets

Two app stores at launch (**1/1/2027**):

- **Apple App Store** (iOS)
- **Google Play** (Android)

Store-specific requirements (signing, review, store listings, privacy disclosures) are the App
Developer's to plan as part of the stack decision.
