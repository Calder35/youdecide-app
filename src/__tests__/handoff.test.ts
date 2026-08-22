import { CONSENTS } from '../data/consents';
import { buildHandoffPayload, summarizeHandoff } from '../data/handoff';
import { MOCK_PLAN } from '../data/mock';
import { INITIAL_STATE, sellerSessionReducer } from '../state/SellerSession';

const options = {
  askedFrom: 'AiPlan',
  note: 'Please call before noon.',
  propertyAddress: '4821 Desert Willow Ct, Las Vegas, NV 89129',
  plan: MOCK_PLAN,
};

function stateWithSeller() {
  let state = INITIAL_STATE;
  state = sellerSessionReducer(state, {
    type: 'setAccountField',
    field: 'fullName',
    value: 'Jordan Rivera',
  });
  state = sellerSessionReducer(state, {
    type: 'setAccountField',
    field: 'email',
    value: 'jordan@example.com',
  });
  state = sellerSessionReducer(state, { type: 'toggleConsent', id: 'terms' });
  state = sellerSessionReducer(state, {
    type: 'setDiscoveryField',
    field: 'timeline',
    value: 'In the next 3 months',
  });
  state = sellerSessionReducer(state, { type: 'togglePlanStep', id: MOCK_PLAN[0].id });
  return state;
}

describe('the human handoff payload', () => {
  it('carries what the seller actually entered', () => {
    const payload = buildHandoffPayload(stateWithSeller(), options);
    expect(payload.contact.fullName).toBe('Jordan Rivera');
    expect(payload.contact.email).toBe('jordan@example.com');
    expect(payload.discovery.timeline).toBe('In the next 3 months');
    expect(payload.askedFrom).toBe('AiPlan');
    expect(payload.note).toBe('Please call before noon.');
  });

  it('carries the consent record item by item, not as a summary', () => {
    const payload = buildHandoffPayload(stateWithSeller(), options);
    expect(payload.consents).toHaveLength(CONSENTS.length);
    expect(payload.consents.find((consent) => consent.id === 'terms')?.given).toBe(true);
    expect(payload.consents.find((consent) => consent.id === 'dataUse')?.given).toBe(false);
  });

  it('carries the plan with what the seller has done so far', () => {
    const payload = buildHandoffPayload(stateWithSeller(), options);
    expect(payload.plan).toHaveLength(MOCK_PLAN.length);
    expect(payload.plan[0].done).toBe(true);
    expect(payload.plan.filter((step) => step.needsHumanApproval).length).toBeGreaterThan(0);
  });

  /**
   * The non-negotiable, as a test: the disclosure a seller reads is generated
   * from the payload, so a new field cannot be sent without appearing in the
   * list. If someone adds to `HandoffPayload` and not to `summarizeHandoff`,
   * this fails.
   */
  it('discloses every part of what is sent', () => {
    const payload = buildHandoffPayload(stateWithSeller(), options);
    const labels = summarizeHandoff(payload).map((line) => line.label.toLowerCase());

    const topLevelKeys = Object.keys(payload);
    const disclosureFor: Record<string, string> = {
      contact: 'your name',
      askedFrom: 'where you asked from',
      note: 'your note',
      property: 'the property',
      discovery: 'your timeline',
      consents: 'your consent record',
      plan: 'your listing plan',
    };

    for (const key of topLevelKeys) {
      const expected = disclosureFor[key];
      expect(`${key} → ${expected ?? 'UNDISCLOSED'}`).toBe(`${key} → ${expected}`);
      expect(labels).toContain(expected);
    }
  });

  it('says plainly when a field is empty rather than sending a silent blank', () => {
    const lines = summarizeHandoff(
      buildHandoffPayload(INITIAL_STATE, { ...options, note: '' }),
    );
    const phone = lines.find((line) => line.label === 'Your phone');
    const note = lines.find((line) => line.label === 'Your note');
    expect(phone?.value).toMatch(/haven't entered one/);
    expect(note?.value).toMatch(/no note added/);
  });

  it('always names the property, falling back to the workspace address', () => {
    const lines = summarizeHandoff(buildHandoffPayload(INITIAL_STATE, options));
    expect(lines.find((line) => line.label === 'The property')?.value).toBe(
      options.propertyAddress,
    );
  });
});

describe('the seller session store', () => {
  it('records each human request with where it came from', () => {
    const requestedAt = new Date('2026-08-22T10:00:00Z');
    const state = sellerSessionReducer(INITIAL_STATE, {
      type: 'requestHuman',
      from: 'PropertyWorkspace',
      note: 'Question about the HOA figure',
      id: 'req-1',
      requestedAt,
    });
    expect(state.humanRequests).toHaveLength(1);
    expect(state.humanRequests[0].from).toBe('PropertyWorkspace');
    expect(state.humanRequests[0].requestedAt).toBe(requestedAt);
  });

  it('toggles a plan step on and back off', () => {
    const on = sellerSessionReducer(INITIAL_STATE, { type: 'togglePlanStep', id: 'price' });
    expect(on.completedPlanSteps).toEqual(['price']);
    const off = sellerSessionReducer(on, { type: 'togglePlanStep', id: 'price' });
    expect(off.completedPlanSteps).toEqual([]);
  });
});
