# Contributing

Thanks for working on the **You Decide** mobile app. This guide covers what you need to get the
project running locally and how changes make their way into `main`.

> **Note on the stack:** the mobile framework is **not final yet** — see
> [STACK_DECISION.md](STACK_DECISION.md), which is still a stub owned by the App Developer agent.
> The setup steps below assume a React Native project, which is the working assumption until that
> decision is recorded. If the stack lands somewhere else, this document gets updated with it.

## 1. Prerequisites

- **Node.js (LTS)** and **npm** (or **yarn**) — use the current LTS release.
- **React Native CLI or Expo** — whichever the project settles on; see
  [STACK_DECISION.md](STACK_DECISION.md) for the chosen stack.
- **Xcode** — required to build and run the iOS app (macOS only).
- **Android Studio** — required to build and run the Android app, including an SDK and an emulator
  or a connected device.
- **Git**.

## 2. Local Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/Calder35/youdecide-app.git
   ```

2. Move into the project directory:

   ```bash
   cd youdecide-app
   ```

3. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

4. Install iOS native dependencies (macOS only):

   ```bash
   cd ios && pod install && cd ..
   ```

5. Run the app on iOS:

   ```bash
   npx react-native run-ios
   ```

6. Run the app on Android:

   ```bash
   npx react-native run-android
   ```

Steps 3–6 apply once the app has been scaffolded in this repo. Until then the repo holds
documentation only, so there is nothing to install or run.

## 3. Environment Variables

If a `.env.example` file is present, copy it and fill in the values before running the app:

```bash
cp .env.example .env
```

`.env.example` does not exist yet. Environment variable setup — including how the app authenticates
against the You Decide AI backend API — will be documented here as the project progresses. Never
commit a real `.env` file or any secrets.

## 4. Branch & PR Workflow

- Create a feature branch off `main`:

  ```bash
  git checkout -b feature/your-feature-name
  ```

- Keep commits small and descriptive — one logical change per commit.
- Open a Pull Request against `main` when your work is ready for review.
- **All PRs require review and approval from MC (Ken Calder) before merging.**
- **Never merge your own PR.**

## 5. Code Style

- Follow the project's ESLint / Prettier configuration, if one is present.
- Run linting before pushing:

  ```bash
  npm run lint
  ```

## 6. Testing

- Run the test suite before opening a PR:

  ```bash
  npm test
  ```

- Add tests for new features and bug fixes.

## 7. Questions

Reach out in **`#gustaf-ops`** on Slack, or
[open a GitHub issue](https://github.com/Calder35/youdecide-app/issues).
