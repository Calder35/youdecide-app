import { screen } from '@testing-library/react-native';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { DRAFT_NOTICE_TEST_ID } from '../components/DraftNotice';
import { NEVADA_COPY, NEVADA_COPY_IS_DRAFT, REVIEW_STATUS } from '../content/nevada';
import { giveRequiredConsents, onTop, pressOnTop, renderIntake } from '../test-utils/renderApp';

/**
 * The guard on unreviewed Nevada copy.
 *
 * Every claim about what Nevada requires was written by an engineer and has NOT
 * been reviewed by a licensed Nevada agent. These tests are what stop it
 * reaching a real seller unmarked:
 *
 *   1. all of it lives in one module, marked pending review,
 *   2. every screen that renders any of it also renders the DRAFT notice,
 *   3. no screen writes its own Nevada-requirement claim inline.
 *
 * When a licensed agent signs off, flip REVIEW_STATUS to 'reviewed'. The
 * notices disappear everywhere at once and the pairing tests become vacuous
 * rather than wrong.
 */

describe('unreviewed Nevada copy', () => {
  it('is all marked pending licensed review', () => {
    const entries = Object.entries(NEVADA_COPY);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, copy] of entries) {
      expect(`${key}:${copy.review}`).toBe(`${key}:pending-licensed-nv-review`);
    }
    expect(NEVADA_COPY_IS_DRAFT).toBe(true);
    expect(REVIEW_STATUS).toBe('pending-licensed-nv-review');
  });

  it('stays hedged — no statutes, rates, deadlines, or dollar figures', () => {
    for (const [key, copy] of Object.entries(NEVADA_COPY)) {
      // A specific number is exactly the kind of claim that needs a licensed
      // human behind it, so draft copy is not allowed to make one.
      expect(`${key}: ${copy.text}`).not.toMatch(/NRS\s*\d|\$\s?\d|\b\d+(\.\d+)?\s?%|\b\d+\s?days?\b/i);
    }
  });

  it('does not grow — each entry needs its own licensed review', () => {
    // Deliberately a hard number. Adding a Nevada claim should be a decision
    // someone makes on purpose, not a thing that drifts in.
    expect(Object.keys(NEVADA_COPY)).toHaveLength(6);
  });
});

describe('screens carrying Nevada copy', () => {
  it('marks the seller discovery screen', async () => {
    await renderIntake();
    await pressOnTop('cta-continue');
    await giveRequiredConsents();
    await pressOnTop('cta-continue');
    expect(screen.getByText(NEVADA_COPY.tenantOccupied.text)).toBeOnTheScreen();
    expect(onTop(DRAFT_NOTICE_TEST_ID)).toBeOnTheScreen();
  });

  it('marks the 1% screen, where the transfer-tax claim sits', async () => {
    await renderIntake();
    await pressOnTop('cta-see-fee');
    expect(screen.getByText(NEVADA_COPY.transferTax.text)).toBeOnTheScreen();
    expect(onTop(DRAFT_NOTICE_TEST_ID)).toBeOnTheScreen();
  });

  it('marks the property workspace, where the document claims sit', async () => {
    await renderIntake();
    await pressOnTop('cta-continue');
    await giveRequiredConsents();
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    expect(screen.getByText(NEVADA_COPY.sellerDisclosure.text)).toBeOnTheScreen();
    expect(onTop(DRAFT_NOTICE_TEST_ID)).toBeOnTheScreen();
  });

  it('marks the account deletion screen', async () => {
    await renderIntake();
    await pressOnTop('link-delete-account');
    expect(screen.getByText(NEVADA_COPY.recordRetention.text)).toBeOnTheScreen();
    expect(onTop(DRAFT_NOTICE_TEST_ID)).toBeOnTheScreen();
  });

  it('marks the privacy screen', async () => {
    await renderIntake();
    await pressOnTop('link-privacy');
    expect(screen.getByText(NEVADA_COPY.recordRetention.text)).toBeOnTheScreen();
    expect(onTop(DRAFT_NOTICE_TEST_ID)).toBeOnTheScreen();
  });
});

/**
 * The backstop: a screen cannot write its own "Nevada requires…" line. If it
 * needs one, it belongs in src/content/nevada.ts where review can find it.
 */
describe('no inline Nevada requirement claims', () => {
  const SOURCE_DIRS = ['src/screens', 'src/data', 'src/components'];
  const CLAIM = /Nevada\s+(requires|law|statute)|required\s+(?:by|in)\s+Nevada|under\s+Nevada\s+law|by\s+law\s+in\s+Nevada/i;

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it('keeps every Nevada requirement claim inside the reviewed-copy module', () => {
    const offenders: string[] = [];

    for (const dir of SOURCE_DIRS) {
      for (const file of sourceFiles(dir)) {
        const contents = readFileSync(file, 'utf8');
        contents.split('\n').forEach((line, index) => {
          // Comments pointing AT the draft module are the intended pattern.
          if (line.trim().startsWith('//')) return;
          if (CLAIM.test(line)) offenders.push(`${file}:${index + 1}`);
        });
      }
    }

    expect(offenders).toEqual([]);
  });
});
