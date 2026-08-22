import { screen, waitFor } from '@testing-library/react-native';

import { API_STATUS_TEST_ID } from '../components/ApiStatusNote';
import { GET_HUMAN_TEST_ID } from '../components/GetHumanBar';
import { createFakeBackend } from '../test-utils/fakeBackend';
import {
  giveRequiredConsents,
  onTop,
  pressOnTop,
  renderApp,
  typeInto,
} from '../test-utils/renderApp';

/**
 * The same scripted intake as `sellerJourney.test.tsx`, but with the app
 * pointed at a backend.
 *
 * This is the chunk 4 acceptance run: a person walks the flow, and the seller,
 * their consents, their workspace, and their request for a human all land on
 * the API in the right order, with the right actor.
 */

async function walkIntake() {
  await pressOnTop('cta-continue'); // Welcome → AccountConsent
  await typeInto('field-fullName', 'Jordan Rivera');
  await typeInto('field-email', 'jordan@example.com');
  await typeInto('field-phone', '(702) 555-0143');
  await giveRequiredConsents();
  await pressOnTop('cta-continue'); // creates the seller + consents

  await typeInto('field-addressLine', '1200 Sunset Ridge Dr');
  await typeInto('field-city', 'Henderson');
  await typeInto('field-zip', '89052');
  await pressOnTop('cta-continue'); // → OnePercent
  await pressOnTop('cta-continue'); // → PropertyWorkspace, opens the workspace
}

describe('the seller intake, wired to the test API', () => {
  it('creates the seller, records consents, opens a workspace, and requests a human', async () => {
    const backend = createFakeBackend();
    await renderApp(backend.client);

    await walkIntake();
    await waitFor(() => expect(onTop('api-status-ids')).toBeOnTheScreen());

    await pressOnTop('cta-continue'); // → AiPlan
    await pressOnTop('cta-request-human');
    await typeInto('field-note', 'Please call before noon.');
    await pressOnTop('cta-request-human');

    await waitFor(() => expect(onTop('status-request')).toBeOnTheScreen());

    // The whole path, in order, on the API.
    expect(backend.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'POST /v1/users',
      'POST /v1/users/user-1/consents',
      'POST /v1/users/user-1/consents',
      'POST /v1/journeys',
      'POST /v1/journeys/journey-4/human-help',
      'GET /v1/journeys/journey-4/audit',
    ]);
  });

  it("sends the seller's own answers, not the sample data", async () => {
    const backend = createFakeBackend();
    await renderApp(backend.client);
    await walkIntake();
    await waitFor(() => expect(onTop('api-status-ids')).toBeOnTheScreen());

    const created = backend.requests.find((request) => request.path === '/v1/users');
    expect(created?.body).toMatchObject({
      email: 'jordan@example.com',
      display_name: 'Jordan Rivera',
      role: 'seller',
    });

    const workspace = backend.requests.find((request) => request.path === '/v1/journeys');
    expect(workspace?.body).toMatchObject({
      property: { line1: '1200 Sunset Ridge Dr', city: 'Henderson', postal_code: '89052' },
    });
  });

  it('asks for a LICENSED human, and carries the seller\'s note as the reason', async () => {
    const backend = createFakeBackend();
    await renderApp(backend.client);
    await walkIntake();
    await waitFor(() => expect(onTop('api-status-ids')).toBeOnTheScreen());

    await pressOnTop('cta-continue');
    await pressOnTop('cta-request-human');
    await typeInto('field-note', 'Please call before noon.');
    await pressOnTop('cta-request-human');
    await waitFor(() => expect(onTop('status-request')).toBeOnTheScreen());

    const help = backend.requests.find((request) => request.path.endsWith('/human-help'));
    expect(help?.body).toMatchObject({ licensed_required: true });
    expect(String((help?.body as { reason: string }).reason)).toMatch(/Please call before noon/);
    expect(String((help?.body as { reason: string }).reason)).toMatch(/AiPlan/);
  });

  it("shows the backend's own audit trail, in the seller's language", async () => {
    const backend = createFakeBackend();
    await renderApp(backend.client);
    await walkIntake();
    await waitFor(() => expect(onTop('api-status-ids')).toBeOnTheScreen());

    await pressOnTop('cta-continue');
    await pressOnTop('cta-request-human');
    await pressOnTop('cta-request-human');

    await waitFor(() => expect(onTop('audit-trail')).toBeOnTheScreen());
    expect(screen.getByText('Your workspace was opened')).toBeOnTheScreen();
    expect(screen.getByText('You asked for a licensed human')).toBeOnTheScreen();
    expect(onTop('request-sync-state')).toHaveTextContent(/Delivered to the test API/);
  });
});

describe('when the backend is unreachable', () => {
  it('still lets the seller finish and ask for a human, and says what happened', async () => {
    const backend = createFakeBackend({ networkDown: true });
    await renderApp(backend.client);

    await pressOnTop('cta-continue');
    await typeInto('field-email', 'jordan@example.com');
    await giveRequiredConsents();
    await pressOnTop('cta-continue');

    // The failure is shown where the seller can see it — we do not navigate
    // away from an error — and "Continue anyway" is right there.
    await waitFor(() => expect(onTop('account-error')).toBeOnTheScreen());
    await pressOnTop('cta-continue-anyway');
    expect(screen.getByText('Tell us about your sale')).toBeOnTheScreen();

    await pressOnTop(GET_HUMAN_TEST_ID);
    await pressOnTop('cta-request-human');
    await waitFor(() => expect(onTop('status-request')).toBeOnTheScreen());
    expect(onTop('request-sync-state')).toHaveTextContent(/not delivered/i);
  });
});

describe('an offline build', () => {
  it('sends nothing and says so', async () => {
    await renderApp(); // no client → offline
    expect(onTop(API_STATUS_TEST_ID)).toHaveTextContent(/Offline — nothing is sent/);
  });

  it('still completes the whole flow on sample data', async () => {
    await renderApp();
    await pressOnTop('cta-continue');
    await giveRequiredConsents();
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    await pressOnTop('cta-continue');
    expect(screen.getByText('Where things stand')).toBeOnTheScreen();
    // No audit card, because there is no backend to have recorded anything.
    expect(screen.queryByTestId('audit-trail')).toBeNull();
  });
});
