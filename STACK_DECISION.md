# Stack Decision

## Decision

**React Native + Expo (managed workflow) + TypeScript.**

- Expo SDK 57, React Native 0.86, React 19, TypeScript 6 (strict).
- Navigation: React Navigation 7, native stack.
- Tests: Jest via `jest-expo`, with `@testing-library/react-native` v14.
- Lint: ESLint 9 flat config via `eslint-config-expo`.

## Rationale

- **One codebase, two stores.** The launch target is the App Store *and* Google Play. The seller
  app is form-, text-, and document-heavy — no custom rendering, no heavy graphics, nothing that
  needs platform-native UI to feel right. Two native codebases would double the work for no user-
  visible gain.
- **Expo over bare React Native.** Managed Expo gives OTA updates, EAS builds, and the config
  plugin system without hand-maintaining Xcode and Gradle projects. For a supervised v1 whose
  purpose is to get in front of test users quickly, build tooling is not where the effort belongs.
- **TypeScript, strict.** This app handles consent records, fee math, and a human handoff payload.
  The compiler catching a wrong shape is cheaper than a person catching it in review.
- **React Navigation over Expo Router.** The seller flow is linear and explicit. A declared stack
  keeps the flow order readable in one file (`src/navigation/routes.ts`) and unit-testable without
  a filesystem convention in the way.

## Consequences

- **Language:** TypeScript everywhere. No Swift/Kotlin unless a native module forces it.
- **Build/release:** EAS Build for store binaries; Expo Go and dev clients for review builds. No
  signing credentials live in this repo.
- **CI:** GitHub Actions runs `typecheck → lint → test` on every PR (`.github/workflows/ci.yml`).
- **Backend:** this app stays a client of `Calder35/youdecide-ai-backend`. All AI and decisioning
  is server-side; the app never embeds a model or a key. Chunk 4 wires the **test** endpoints only.
- **Testing approach:** unit tests for tokens and flow logic; component/integration tests that
  drive the real navigator, so non-negotiables (persistent "get a human", privacy and deletion
  entry points) are enforced by a test rather than by reviewer memory.

## Status

**Decided** — chunk 1 (scaffold).
