import { screen } from '@testing-library/react-native';

import {
  giveRequiredConsents,
  onTop,
  pressOnTop,
  renderIntake,
  typeInto,
} from '../test-utils/renderApp';

/**
 * The milestone, as a test: a scripted seller completes intake and requests a
 * human. This is the run a user-test session follows, so if it breaks, the
 * demo is broken.
 */
describe('scripted seller journey', () => {
  it('completes intake and hands off to a human with the answers intact', async () => {
    await renderIntake();

    // Welcome
    expect(screen.getByText('Sell your Nevada home for a 1% listing fee')).toBeOnTheScreen();
    await pressOnTop('cta-continue');

    // Account & consent — the only gate in the flow.
    await typeInto('field-fullName', 'Jordan Rivera');
    await typeInto('field-email', 'jordan@example.com');
    await typeInto('field-phone', '(702) 555-0143');
    // The Continue button is disabled and says why, rather than failing silently.
    expect(onTop('cta-continue-reason')).toBeOnTheScreen();
    await giveRequiredConsents();
    await pressOnTop('cta-continue');

    // Seller discovery
    await typeInto('field-addressLine', '1200 Sunset Ridge Dr');
    await typeInto('field-city', 'Henderson');
    await typeInto('field-zip', '89052');
    await pressOnTop('timeline-in-the-next-3-months');
    await pressOnTop('occupancy-i-live-there');
    await typeInto('field-reason', 'Relocating for work in the spring');
    await pressOnTop('cta-continue');

    // The 1% explanation
    expect(screen.getByText('What the 1% covers')).toBeOnTheScreen();
    await pressOnTop('cta-continue');

    // Property workspace — carries the address the seller typed.
    expect(screen.getByText('1200 Sunset Ridge Dr, Henderson, 89052')).toBeOnTheScreen();
    await pressOnTop('cta-continue');

    // AI plan
    expect(screen.getByText('Your listing plan')).toBeOnTheScreen();
    await pressOnTop('toggle-walkthrough');

    // Hand off to a human.
    await pressOnTop('cta-request-human');
    expect(screen.getByText('What transfers with this request')).toBeOnTheScreen();

    // The disclosure shows what this seller actually entered.
    expect(screen.getByText('Jordan Rivera')).toBeOnTheScreen();
    expect(screen.getByText('jordan@example.com')).toBeOnTheScreen();
    expect(screen.getByText('In the next 3 months')).toBeOnTheScreen();
    expect(screen.getByText('Relocating for work in the spring')).toBeOnTheScreen();
    expect(screen.getByText('2 of 3 agreements given')).toBeOnTheScreen();
    expect(screen.getByText('5 steps, 1 marked done')).toBeOnTheScreen();
    expect(screen.getByText('AiPlan')).toBeOnTheScreen();

    await typeInto('field-note', 'Please call before noon.');
    expect(screen.getByText('Please call before noon.')).toBeOnTheScreen();

    await pressOnTop('cta-request-human');

    // Status reflects the open request.
    expect(screen.getByText('Where things stand')).toBeOnTheScreen();
    expect(onTop('status-request')).toBeOnTheScreen();
  });

  it('says plainly what is missing when the handoff has little to send', async () => {
    // Reached from the plan rather than from a standing button: the persistent
    // "get a human" bar is gone, and a person comes in on the AI's initiative.
    await renderIntake();
    await pressOnTop('cta-continue');
    await giveRequiredConsents();
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-request-human');

    expect(screen.getByText('Talk to a licensed Nevada agent')).toBeOnTheScreen();
    // Nothing entered — the disclosure says so instead of showing blanks.
    expect(screen.getAllByText(/haven't entered one/).length).toBeGreaterThan(0);
  });

  it('shows no open request until the seller actually sends one', async () => {
    await renderIntake();
    await pressOnTop('cta-continue');
    await giveRequiredConsents();
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    expect(onTop('status-no-request')).toBeOnTheScreen();
  });
});

describe('the 1% explanation', () => {
  it('recalculates when the seller changes the price', async () => {
    await renderIntake();
    await pressOnTop('cta-see-fee');
    expect(onTop('modeled-price')).toHaveTextContent('$450,000');
    expect(onTop('listing-fee')).toHaveTextContent('$4,500');

    await pressOnTop('price-up');
    expect(onTop('modeled-price')).toHaveTextContent('$475,000');
    expect(onTop('listing-fee')).toHaveTextContent('$4,750');
  });

  it("lets a seller offer nothing to a buyer's agent", async () => {
    await renderIntake();
    await pressOnTop('cta-see-fee');
    await pressOnTop('buyer-rate-0');
    expect(onTop('buyer-agent-fee')).toHaveTextContent('$0');
    expect(onTop('total-commission')).toHaveTextContent('$4,500');
  });
});
