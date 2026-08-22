import { ROUTES, SELLER_FLOW, nextStep, stepNumber, type RouteName } from '../navigation/routes';

describe('seller flow order', () => {
  it('runs welcome → consent → discovery → 1% → workspace → plan → status', () => {
    expect(SELLER_FLOW).toEqual([
      ROUTES.Welcome,
      ROUTES.AccountConsent,
      ROUTES.SellerDiscovery,
      ROUTES.OnePercent,
      ROUTES.PropertyWorkspace,
      ROUTES.AiPlan,
      ROUTES.Status,
    ]);
  });

  it('walks from the first step to the last with no gaps', () => {
    const walked: RouteName[] = [ROUTES.Welcome];
    let cursor = nextStep(ROUTES.Welcome);
    while (cursor !== undefined) {
      walked.push(cursor);
      cursor = nextStep(cursor);
    }
    expect(walked).toEqual(SELLER_FLOW);
  });

  it('ends the flow at status', () => {
    expect(nextStep(ROUTES.Status)).toBeUndefined();
  });

  it('keeps the human handoff out of the linear flow — it is reachable anytime', () => {
    expect(SELLER_FLOW).not.toContain(ROUTES.GetHuman);
    expect(nextStep(ROUTES.GetHuman)).toBeUndefined();
    expect(stepNumber(ROUTES.GetHuman)).toBeUndefined();
  });

  it('numbers steps from 1', () => {
    expect(stepNumber(ROUTES.Welcome)).toBe(1);
    expect(stepNumber(ROUTES.Status)).toBe(SELLER_FLOW.length);
  });

  it('exposes privacy and account deletion as routes', () => {
    expect(ROUTES.Privacy).toBe('Privacy');
    expect(ROUTES.DeleteAccount).toBe('DeleteAccount');
  });
});
