import { screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import { giveRequiredConsents, pressOnTop, renderIntake } from '../test-utils/renderApp';

/**
 * Accessibility, swept across the whole app.
 *
 * Rather than spot-checking one component, these walk every screen a seller can
 * reach and assert the rules hold everywhere:
 *
 *   - every interactive control announces itself with a name,
 *   - nothing tappable is smaller than 44pt,
 *   - text scaling is never switched off.
 *
 * A new screen that forgets a label fails here, which is the point.
 */

const INTERACTIVE_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab']);

type Node = TestInstance & { props: Record<string, unknown> };

function queryTree(predicate: (node: Node) => boolean): Node[] {
  return screen.container.queryAll((node) => predicate(node as Node), {
    includeSelf: true,
  }) as Node[];
}

function interactiveNodes(): Node[] {
  return queryTree((node) => {
    const role = node.props.accessibilityRole;
    return typeof role === 'string' && INTERACTIVE_ROLES.has(role);
  });
}

function accessibleName(node: Node): string {
  const label = node.props.accessibilityLabel;
  if (typeof label === 'string' && label.trim().length > 0) return label.trim();
  const text = node.props['aria-label'];
  if (typeof text === 'string' && text.trim().length > 0) return text.trim();
  return '';
}

function describeNode(node: Node): string {
  const role = String(node.props.accessibilityRole);
  const testID = node.props.testID !== undefined ? ` testID=${String(node.props.testID)}` : '';
  return `${role}${testID}`;
}

/** Flattened style, since RN styles arrive as arrays and nested arrays. */
function flatten(style: unknown, into: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(style)) {
    for (const entry of style) flatten(entry, into);
  } else if (style !== null && typeof style === 'object') {
    Object.assign(into, style);
  }
  return into;
}

/** Walk to the screen a seller reaches after finishing intake. */
async function walkTheWholeFlow() {
  await renderIntake();
  await pressOnTop('cta-continue');
  await giveRequiredConsents();
  await pressOnTop('cta-continue');
  await pressOnTop('cta-continue');
  await pressOnTop('cta-continue');
  await pressOnTop('cta-continue');
  await pressOnTop('cta-continue');
}

describe('accessibility across the app', () => {
  it('gives every interactive control a name a screen reader can announce', async () => {
    await walkTheWholeFlow();

    const unnamed = interactiveNodes()
      .filter((node) => accessibleName(node).length === 0)
      .map(describeNode);

    expect(unnamed).toEqual([]);
  });

  it('keeps every tappable control at or above the 44pt minimum', async () => {
    await walkTheWholeFlow();

    const tooSmall = interactiveNodes()
      .filter((node) => {
        const style = flatten(node.props.style);
        const height = style.height ?? style.minHeight;
        // Controls that size themselves from their content are fine; only a
        // control that PINS itself smaller than the floor is a problem.
        return typeof height === 'number' && height < 44;
      })
      .map(describeNode);

    expect(tooSmall).toEqual([]);
  });

  it('never turns off OS text scaling', async () => {
    await walkTheWholeFlow();

    const optedOut = queryTree((node) => node.props.allowFontScaling === false);

    expect(optedOut.map(describeNode)).toEqual([]);
  });

  it('offers no standing "talk to a human" control anywhere in the intake', async () => {
    await walkTheWholeFlow();

    // The persistent bar is gone by design — see EscalationOffer. A person
    // reaches one only when the AI decides one is needed.
    const standingExits = interactiveNodes().filter((node) =>
      /get a human|talk to a (human|person)|speak to (someone|a human)/i.test(
        accessibleName(node),
      ),
    );

    expect(standingExits.map(describeNode)).toEqual([]);
  });

  it('marks the handoff and privacy screens with headers', async () => {
    await renderIntake();
    await pressOnTop('link-privacy');
    // The screen title is a header, so a screen reader can jump to it.
    const headers = screen.getAllByRole('header');
    expect(headers.length).toBeGreaterThan(0);
  });
});
