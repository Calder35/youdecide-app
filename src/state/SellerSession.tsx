import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiClient } from '../api/client';
import { ApiError, toApiError } from '../api/errors';
import {
  createSeller,
  createWorkspace,
  readAuditTrail,
  recordGivenConsents,
  requestHumanHelp,
} from '../api/sellerIntake';
import type { AuditEntryResponse } from '../api/types';
import { EMPTY_CONSENTS, requiredConsentsGiven } from '../data/consents';
import { DEFAULT_BUYER_AGENT_RATE } from '../data/fee';
import { MOCK_PROPERTY_ADDRESS } from '../data/mock';
import type { ConsentId, ConsentState, DiscoveryAnswers, SellerAccount } from '../data/types';

/**
 * One store for the whole seller session.
 *
 * Everything a seller types lives here, which is what lets the handoff screen
 * show the ACTUAL payload rather than a hand-written list that drifts.
 *
 * Chunk 4 adds the `remote` slice: the ids the backend gave us, what is in
 * flight, and the last failure. Two rules it follows:
 *
 *   1. **Offline is the default and is not an error state.** With no API
 *      configured the app behaves exactly as it did in chunk 2 — mock data, no
 *      network, nothing sent.
 *   2. **A failed call never blocks the seller.** The local record is written
 *      first and always; the network call is best-effort on top of it. A
 *      backend outage must not be able to stop someone asking for a human.
 */

export type HumanRequest = {
  id: string;
  from: string;
  note: string;
  requestedAt: Date;
  /** The backend's intervention id, if the request reached it. */
  remoteId?: string;
  /** Whether this request was actually sent anywhere. */
  synced: boolean;
};

export type RemotePending = 'account' | 'workspace' | 'human' | 'audit' | null;

export type RemoteState = {
  sellerId: string | null;
  journeyId: string | null;
  /** Backend scopes we successfully recorded. */
  recordedScopes: string[];
  auditTrail: AuditEntryResponse[];
  pending: RemotePending;
  /** The last failure, kept so a screen can show it and offer a retry. */
  error: { kind: string; message: string; retryable: boolean } | null;
};

export type SellerSessionState = {
  account: SellerAccount;
  consents: ConsentState;
  discovery: DiscoveryAnswers;
  modeledSalePrice: number;
  buyerAgentRate: number;
  humanRequests: HumanRequest[];
  completedPlanSteps: string[];
  remote: RemoteState;
};

const EMPTY_ACCOUNT: SellerAccount = { fullName: '', email: '', phone: '' };

const EMPTY_DISCOVERY: DiscoveryAnswers = {
  addressLine: '',
  city: '',
  zip: '',
  timeline: null,
  occupancy: null,
  reason: '',
};

export const EMPTY_REMOTE: RemoteState = {
  sellerId: null,
  journeyId: null,
  recordedScopes: [],
  auditTrail: [],
  pending: null,
  error: null,
};

export const INITIAL_STATE: SellerSessionState = {
  account: EMPTY_ACCOUNT,
  consents: EMPTY_CONSENTS,
  discovery: EMPTY_DISCOVERY,
  modeledSalePrice: 450000,
  buyerAgentRate: DEFAULT_BUYER_AGENT_RATE,
  humanRequests: [],
  completedPlanSteps: [],
  remote: EMPTY_REMOTE,
};

type Action =
  | { type: 'setAccountField'; field: keyof SellerAccount; value: string }
  | { type: 'toggleConsent'; id: ConsentId }
  | { type: 'setDiscoveryField'; field: keyof DiscoveryAnswers; value: string | null }
  | { type: 'setModeledSalePrice'; value: number }
  | { type: 'setBuyerAgentRate'; value: number }
  | { type: 'togglePlanStep'; id: string }
  | { type: 'requestHuman'; from: string; note: string; id: string; requestedAt: Date }
  | { type: 'remotePending'; pending: RemotePending }
  | { type: 'remoteFailed'; error: ApiError }
  | { type: 'sellerCreated'; sellerId: string; scopes: string[] }
  | { type: 'workspaceCreated'; journeyId: string }
  | { type: 'humanRequestSynced'; localId: string; remoteId: string }
  | { type: 'auditLoaded'; entries: AuditEntryResponse[] };

export function sellerSessionReducer(
  state: SellerSessionState,
  action: Action,
): SellerSessionState {
  switch (action.type) {
    case 'setAccountField':
      return { ...state, account: { ...state.account, [action.field]: action.value } };
    case 'toggleConsent':
      return {
        ...state,
        consents: { ...state.consents, [action.id]: !state.consents[action.id] },
      };
    case 'setDiscoveryField':
      return { ...state, discovery: { ...state.discovery, [action.field]: action.value } };
    case 'setModeledSalePrice':
      return { ...state, modeledSalePrice: action.value };
    case 'setBuyerAgentRate':
      return { ...state, buyerAgentRate: action.value };
    case 'togglePlanStep': {
      const done = state.completedPlanSteps.includes(action.id);
      return {
        ...state,
        completedPlanSteps: done
          ? state.completedPlanSteps.filter((id) => id !== action.id)
          : [...state.completedPlanSteps, action.id],
      };
    }
    case 'requestHuman':
      return {
        ...state,
        humanRequests: [
          ...state.humanRequests,
          {
            id: action.id,
            from: action.from,
            note: action.note,
            requestedAt: action.requestedAt,
            synced: false,
          },
        ],
      };
    case 'remotePending':
      return { ...state, remote: { ...state.remote, pending: action.pending, error: null } };
    case 'remoteFailed':
      return {
        ...state,
        remote: {
          ...state.remote,
          pending: null,
          error: {
            kind: action.error.kind,
            message: action.error.sellerMessage,
            retryable: action.error.retryable,
          },
        },
      };
    case 'sellerCreated':
      return {
        ...state,
        remote: {
          ...state.remote,
          pending: null,
          error: null,
          sellerId: action.sellerId,
          recordedScopes: action.scopes,
        },
      };
    case 'workspaceCreated':
      return {
        ...state,
        remote: { ...state.remote, pending: null, error: null, journeyId: action.journeyId },
      };
    case 'humanRequestSynced':
      return {
        ...state,
        remote: { ...state.remote, pending: null, error: null },
        humanRequests: state.humanRequests.map((request) =>
          request.id === action.localId
            ? { ...request, remoteId: action.remoteId, synced: true }
            : request,
        ),
      };
    case 'auditLoaded':
      return {
        ...state,
        remote: { ...state.remote, pending: null, auditTrail: action.entries },
      };
    default:
      return state;
  }
}

type SellerSessionValue = {
  state: SellerSessionState;
  setAccountField: (field: keyof SellerAccount, value: string) => void;
  toggleConsent: (id: ConsentId) => void;
  setDiscoveryField: (field: keyof DiscoveryAnswers, value: string | null) => void;
  setModeledSalePrice: (value: number) => void;
  setBuyerAgentRate: (value: number) => void;
  togglePlanStep: (id: string) => void;
  /** Records the request locally, then sends it if we are connected. */
  requestHuman: (from: string, note: string) => Promise<void>;
  /** Create the seller and record their consents. Resolves false only when a
   *  send FAILED — offline resolves true, because there was nothing to send. */
  submitAccount: () => Promise<boolean>;
  /** Open the property workspace. Safe to call more than once. */
  openWorkspace: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  canProceedPastConsent: boolean;
  propertyAddress: string;
  /** True when this build is pointed at a test API. */
  isConnected: boolean;
  apiBaseUrl: string;
};

const SellerSessionContext = createContext<SellerSessionValue | null>(null);

export function SellerSessionProvider({
  children,
  initialState = INITIAL_STATE,
  client,
}: {
  children: ReactNode;
  initialState?: SellerSessionState;
  /** Injectable so tests drive a fake `fetch` rather than the network. */
  client?: ApiClient;
}) {
  const [state, dispatch] = useReducer(sellerSessionReducer, initialState);

  // One client for the life of the provider. Lazy state rather than a ref so
  // it is legitimately readable during render; `new ApiClient()` reads the
  // resolved config, which validates the host.
  const [api] = useState(() => client ?? new ApiClient());

  // The store is the source of truth for ids, but async callbacks capture a
  // stale `state`. They read this instead, which is updated after each commit.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Returns whether the caller should move on. Offline is `true` — there was
   * nothing to save, and the app works without a backend. A FAILURE is `false`,
   * so the screen can keep the seller where the error is visible instead of
   * navigating away from it.
   */
  const submitAccount = useCallback(async (): Promise<boolean> => {
    if (!api.isConnected) return true;
    const current = stateRef.current;
    if (current.remote.sellerId !== null) return true; // already created

    dispatch({ type: 'remotePending', pending: 'account' });
    try {
      const seller = await createSeller(api, current.account);
      const recorded = await recordGivenConsents(api, seller.id, current.consents);
      dispatch({
        type: 'sellerCreated',
        sellerId: seller.id,
        scopes: recorded.map((consent) => consent.scope),
      });
      return true;
    } catch (thrown) {
      dispatch({ type: 'remoteFailed', error: toApiError(thrown) });
      return false;
    }
  }, [api]);

  const openWorkspace = useCallback(async () => {
    if (!api.isConnected) return;
    const current = stateRef.current;
    if (current.remote.sellerId === null) return;
    if (current.remote.journeyId !== null) return; // idempotent for the caller

    dispatch({ type: 'remotePending', pending: 'workspace' });
    try {
      const journey = await createWorkspace(api, current.remote.sellerId, current.discovery, {
        line1: MOCK_PROPERTY_ADDRESS.split(',')[0],
        city: 'Las Vegas',
        postalCode: '89129',
      });
      dispatch({ type: 'workspaceCreated', journeyId: journey.id });
    } catch (thrown) {
      dispatch({ type: 'remoteFailed', error: toApiError(thrown) });
    }
  }, [api]);

  const refreshAudit = useCallback(async () => {
    const current = stateRef.current;
    if (!api.isConnected) return;
    if (current.remote.sellerId === null || current.remote.journeyId === null) return;

    dispatch({ type: 'remotePending', pending: 'audit' });
    try {
      const entries = await readAuditTrail(
        api,
        current.remote.sellerId,
        current.remote.journeyId,
      );
      dispatch({ type: 'auditLoaded', entries });
    } catch (thrown) {
      dispatch({ type: 'remoteFailed', error: toApiError(thrown) });
    }
  }, [api]);

  const requestHuman = useCallback(
    async (from: string, note: string) => {
      // LOCAL FIRST, ALWAYS. The seller has asked for a person; that fact is
      // recorded before any network call, and no failure below can undo it.
      const localId = `req-${stateRef.current.humanRequests.length + 1}`;
      dispatch({ type: 'requestHuman', from, note, id: localId, requestedAt: new Date() });

      const current = stateRef.current;
      if (!api.isConnected || current.remote.sellerId === null || current.remote.journeyId === null) {
        return;
      }

      dispatch({ type: 'remotePending', pending: 'human' });
      try {
        const intervention = await requestHumanHelp(
          api,
          current.remote.sellerId,
          current.remote.journeyId,
          {
            reason: buildReason(from, note),
            // Supervised v1: a seller asking for help is asking for a licensed
            // person, not merely "someone to look". The backend keeps the two
            // distinct, so we say which one we mean.
            licensedRequired: true,
          },
        );
        dispatch({ type: 'humanRequestSynced', localId, remoteId: intervention.id });
        // The audit trail is not read here: the status screen the seller lands
        // on reads it on arrival, and fetching twice would be noise in the
        // request log for no benefit.
      } catch (thrown) {
        dispatch({ type: 'remoteFailed', error: toApiError(thrown) });
      }
    },
    [api],
  );

  const value = useMemo<SellerSessionValue>(() => {
    const typedAddress = [state.discovery.addressLine, state.discovery.city, state.discovery.zip]
      .filter((part) => part.trim().length > 0)
      .join(', ');

    return {
      state,
      setAccountField: (field, fieldValue) =>
        dispatch({ type: 'setAccountField', field, value: fieldValue }),
      toggleConsent: (id) => dispatch({ type: 'toggleConsent', id }),
      setDiscoveryField: (field, fieldValue) =>
        dispatch({ type: 'setDiscoveryField', field, value: fieldValue }),
      setModeledSalePrice: (price) => dispatch({ type: 'setModeledSalePrice', value: price }),
      setBuyerAgentRate: (rate) => dispatch({ type: 'setBuyerAgentRate', value: rate }),
      togglePlanStep: (id) => dispatch({ type: 'togglePlanStep', id }),
      requestHuman,
      submitAccount,
      openWorkspace,
      refreshAudit,
      canProceedPastConsent: requiredConsentsGiven(state.consents),
      propertyAddress: typedAddress.length > 0 ? typedAddress : MOCK_PROPERTY_ADDRESS,
      isConnected: api.isConnected,
      apiBaseUrl: api.baseUrl,
    };
  }, [state, api, requestHuman, submitAccount, openWorkspace, refreshAudit]);

  return (
    <SellerSessionContext.Provider value={value}>{children}</SellerSessionContext.Provider>
  );
}

/** What the agent sees as the reason. Where they asked from, plus their words. */
function buildReason(from: string, note: string): string {
  const trimmed = note.trim();
  return trimmed.length > 0
    ? `Seller asked for a licensed agent from ${from}. Their note: ${trimmed}`
    : `Seller asked for a licensed agent from ${from}. No note added.`;
}

export function useSellerSession(): SellerSessionValue {
  const value = useContext(SellerSessionContext);
  if (value === null) {
    throw new Error('useSellerSession must be used inside a SellerSessionProvider');
  }
  return value;
}
