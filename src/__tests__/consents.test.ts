import {
  CONSENTS,
  EMPTY_CONSENTS,
  missingRequiredConsents,
  requiredConsentsGiven,
} from '../data/consents';

describe('consent', () => {
  it('is recorded as separate agreements, never one blanket box', () => {
    expect(CONSENTS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(CONSENTS.map((consent) => consent.id)).size).toBe(CONSENTS.length);
  });

  it('explains each agreement in plain language rather than linking away', () => {
    for (const consent of CONSENTS) {
      expect(`${consent.id}:${consent.body.length > 40}`).toBe(`${consent.id}:true`);
    }
  });

  it('keeps at least one consent optional, so declining is a real choice', () => {
    expect(CONSENTS.some((consent) => !consent.required)).toBe(true);
  });

  it('blocks the flow only until the required agreements are given', () => {
    expect(requiredConsentsGiven(EMPTY_CONSENTS)).toBe(false);
    expect(requiredConsentsGiven({ terms: true, dataUse: false, contact: true })).toBe(false);
    expect(requiredConsentsGiven({ terms: true, dataUse: true, contact: false })).toBe(true);
  });

  it('names what is still missing, so the block is never a mystery', () => {
    const missing = missingRequiredConsents({ terms: true, dataUse: false, contact: false });
    expect(missing.map((consent) => consent.id)).toEqual(['dataUse']);
  });
});
