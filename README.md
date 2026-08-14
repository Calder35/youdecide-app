# You Decide — Mobile App

This repository is the **You Decide client mobile app** (iOS + Android). Users **list, buy, and
research investment properties** through **You Decide AI**.

## What this repo is (and isn't)

- **Is:** the customer-facing **front-end** — a mobile app for iOS and Android.
- **Isn't:** the brain. All AI and decisioning is served by the **You Decide AI backend API**
  ([`Calder35/youdecide-ai-backend`](https://github.com/Calder35/youdecide-ai-backend)). This app
  is a client of that API — **one brain, two front-ends** (the Slack fleet and this app). This app
  is a front-end, **not** the brain.

## One brain, two front-ends

The Decision Engine ("You Decide AI") is trained in the fleet and served as a shared API from the
backend repo. Both the Slack fleet and this mobile app call that same API, so guidance stays
consistent across experiences. This app owns the mobile client experience only; it calls the
backend for everything AI/decisioning.

## Ownership

This is a **lean foundation**, not the final stack. The **App Developer agent owns the real stack
decision** — React Native vs. native iOS/Android — and will build the app in this repo. See
[STACK_DECISION.md](STACK_DECISION.md), which is an empty stub waiting for that decision. Nothing
here presumes a framework.

## Target launch

**1/1/2027**, on the **Apple App Store** and **Google Play**.

## Related repos

- **Backend / You Decide AI API:** `Calder35/youdecide-ai-backend`
- **Fleet / DE training:** `Calder35/gustaf`

This repo is separate from both the fleet repo and the backend repo.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the app fits into the one-brain / two-front-ends design.
