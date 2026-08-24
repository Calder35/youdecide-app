import { screen, waitFor } from '@testing-library/react-native';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ApiClient } from '../api/client';
import { SAFETY_NOTICE_TEST_ID } from '../components/SafetyNotice';
import { renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * The housing product shows no crisis content. Ever.
 *
 * This is an absolute product rule, not a default. A live test had the backend
 * return `distress` for someone three months behind on their mortgage, and the
 * app answered a financial question with a suicide hotline. Rather than gate
 * that path and hope, the crisis UI is unmounted entirely: `SafetyNotice`
 * stays in the repo but nothing imports it.
 *
 * These tests hold that from two directions — behaviour (no input or backend
 * response can produce it) and structure (nothing mounts the component). The
 * structural one is what survives a refactor.
 */

/** Anything that would signal crisis, emotional-support, or self-harm content. */
const CRISIS_PATTERNS = [
  /988/,
  /suicide/i,
  /crisis/i,
  /lifeline/i,
  /hotline/i,
  /immediate danger/i,
  /emergency services/i,
  /harm yourself/i,
  /let's get a person with you/i,
  /talk with someone now/i,
];

function backendReturning(payload: Record<string, unknown>) {
  return new ApiClient({
    config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
    fetchImpl: (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ conversation_id: 'c-1', reply: 'Understood.', ...payload }),
      }) as Response) as unknown as typeof fetch,
  });
}

/**
 * Asserts the APP is not showing crisis content.
 *
 * `spokenByThePerson` is excluded from the scan. If someone types the word
 * "suicide", their own message appears in their own bubble — that is the app
 * showing them what they said, not the app raising a crisis card. Censoring a
 * person's words back at them would be a different and worse behaviour, so the
 * rule is about what the app AUTHORS.
 */
function expectNoCrisisContentOnScreen(label: string, spokenByThePerson?: string) {
  expect(`${label}: ${screen.queryAllByTestId(SAFETY_NOTICE_TEST_ID).length}`).toBe(`${label}: 0`);

  for (const pattern of CRISIS_PATTERNS) {
    const appAuthored = screen
      .queryAllByText(pattern)
      .filter((node) => textOf(node) !== spokenByThePerson);

    expect(`${label} ${pattern}: ${appAuthored.length}`).toBe(`${label} ${pattern}: 0`);
  }
}

/** The rendered string of a text node, however deeply nested. */
function textOf(node: { props: { children?: unknown } }): string {
  const flatten = (child: unknown): string => {
    if (typeof child === 'string') return child;
    if (Array.isArray(child)) return child.map(flatten).join('');
    if (child !== null && typeof child === 'object' && 'props' in child) {
      return flatten((child as { props: { children?: unknown } }).props.children);
    }
    return '';
  };
  return flatten(node.props.children);
}

describe('no backend response can produce crisis content', () => {
  const RESPONSES: { label: string; payload: Record<string, unknown> }[] = [
    { label: 'none', payload: { escalate: false, escalate_kind: 'none' } },
    { label: 'support', payload: { escalate: true, escalate_kind: 'support' } },
    { label: 'licensed', payload: { escalate: true, escalate_kind: 'licensed' } },
    // The one that broke it live. It must now render nothing at all.
    { label: 'distress', payload: { escalate: true, escalate_kind: 'distress' } },
    { label: 'bare true', payload: { escalate: true } },
    { label: 'unknown kind', payload: { escalate: true, escalate_kind: 'something_new' } },
    { label: 'object', payload: { escalate: { kind: 'distress', reason: 'x' } } },
    { label: 'missing', payload: {} },
  ];

  it.each(RESPONSES)('$label renders no crisis UI', async ({ label, payload }) => {
    await renderApp({ client: backendReturning(payload) });
    await sayToAi('I am three months behind on my mortgage.');
    await waitFor(() => expect(screen.getByText('Understood.')).toBeOnTheScreen());

    expectNoCrisisContentOnScreen(label);
  });
});

describe('no user input can produce crisis content', () => {
  /** Including the language that used to trigger it in the offline stub. */
  const INPUTS = [
    'I am three months behind on my mortgage.',
    'We are facing foreclosure and I do not know what to do.',
    'I lost my job and cannot afford the payments.',
    'My husband died and I have to sell the house.',
    'We are getting divorced.',
    'Honestly I do not want to live anymore.',
    'I have been thinking about suicide.',
  ];

  it.each(INPUTS)('offline: %s', async (input) => {
    await renderApp(); // offline stub
    await sayToAi(input);
    await waitFor(() => expect(screen.getAllByTestId('turn-ai').length).toBeGreaterThan(1));

    expectNoCrisisContentOnScreen(input.slice(0, 24), input);
  });
});

/**
 * The structural guarantee. Behaviour tests prove today's paths are clean;
 * this one proves there is no path at all, and keeps proving it after someone
 * refactors the screen.
 */
describe('nothing in the app mounts the safety notice', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it('is imported by no screen, component, or state module', () => {
    const importers = sourceFiles('src')
      .filter((file) => file !== 'src/components/SafetyNotice.tsx')
      .filter((file) => /from\s+'[^']*SafetyNotice'/.test(readFileSync(file, 'utf8')));

    expect(importers).toEqual([]);
  });

  it('keeps crisis wording confined to the one dormant file', () => {
    const offenders = sourceFiles('src')
      .filter((file) => file !== 'src/components/SafetyNotice.tsx')
      .filter((file) => {
        const contents = readFileSync(file, 'utf8');
        // Skip the comments that explain WHY this rule exists.
        const code = contents
          .split('\n')
          .filter((line) => !/^\s*(\*|\/\/)/.test(line))
          .join('\n');
        return /988|Suicide & Crisis|Crisis Lifeline/i.test(code);
      });

    expect(offenders).toEqual([]);
  });
});
