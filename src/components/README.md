# The design system

Small on purpose. Every component here exists because a rule needed a place to
live — not because a screen wanted a wrapper.

## Rules the components enforce

| Rule | Enforced by |
| --- | --- |
| No screen writes a font size or a hex color | `AppText`, the theme tokens, and a test that fails on a literal `#hex` in `src/screens` |
| No figure appears without its source and confidence | `Figure` takes a `Sourced<T>` — there is no bare-number variant |
| A disclosure may hide explanation, never the thing being agreed to | `ConsentItem` renders the agreement inline; `Disclosure` holds only the "why" |
| A disabled control says why it is disabled | `Button`'s `disabledReason` |
| Errors say what to do, and are announced | `InlineError` / `ErrorBanner`, both `role="alert"` |
| Nothing tappable is under 44pt, nothing turns off text scaling | `theme.hitTarget`, `AppText`, and the sweep in `accessibility.test.tsx` |
| Unreviewed Nevada copy is visibly marked | `DraftNotice`, paired with `src/content/nevada.ts` |
| A person enters only when the AI decides one is needed | `EscalationOffer` — there is no standing "talk to a human" control |

## The components

**`AppText`** — the only text component. Pick a `role` (`display`, `title`,
`heading`, `subheading`, `body`, `bodyStrong`, `caption`, `micro`) and a `tone`
(`primary`, `secondary`, `inverse`, `action`, `human`, `danger`, `success`,
`caution`). Never a raw size or color.

**`Button`** — `primary` | `secondary` | `human` | `danger`. `human` is its own
variant so the handoff never looks like an ordinary action. Supports `busy` and
`disabledReason`.

**`Field`** — labelled input. Validation runs on **blur**, not per keystroke —
telling someone their email is wrong while they are still typing it is noise.
The label, help text, and error are all part of what a screen reader announces.

**`ConsentItem`** — one consent, presented so agreeing is an informed act. The
agreement is on screen in full; "why we're asking" and "what happens if you
decline" are one tap away.

**`Figure` + `SourceNote`** — the trust display. A value, its source, its
confidence in words *and* color (never color alone), and an expandable
explanation of what that confidence level actually means.

**`Disclosure`** — expandable detail that reports its expanded state.

**`DraftNotice`** — the marker on unreviewed Nevada copy. Renders only while
`REVIEW_STATUS` in `src/content/nevada.ts` is `pending-licensed-nv-review`;
when a licensed agent signs off, flipping that one constant removes every
notice at once.

**`EscalationOffer`** — the only route from the conversation to a person.
Renders solely on the backend's `escalate` signal, phrased as accepting
something the AI offered rather than as an escape from it. `distress` is the one
case that is unmistakable rather than subtle.

**`ChatBubble` / `ChatComposer` / `TypingIndicator`** — the conversation. Each
bubble is a single accessibility element so a screen reader announces who spoke.

**`ScreenScaffold`** — the intake screens' frame: step counter, safe-area,
scroll. It no longer renders a persistent "Get a human" bar; that was removed
deliberately (see `EscalationOffer`).

**`Card`**, **`ChoiceGroup`**, **`FooterLinks`** — layout and navigation
primitives.

## Adding one

Ask what rule it holds. If the answer is "none, it just groups some views," use
a `View` in the screen instead.
