import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { EMPTY_CONSENTS, requiredConsentsGiven } from '../data/consents';
import { DEFAULT_BUYER_AGENT_RATE } from '../data/fee';
import { MOCK_PROPERTY_ADDRESS } from '../data/mock';
import type {
  ConsentId,
  ConsentState,
  DiscoveryAnswers,
  SellerAccount,
} from '../data/types';

/**
 * One in-memory store for the whole seller session.
 *
 * Everything a seller types lives here and nowhere else, which is what lets the
 * handoff screen show the ACTUAL payload rather than a hand-written list that
 * drifts from reality. Nothing is persisted and nothing leaves the device in
 * this build — chunk 4 replaces the store's write path with API calls.
 */

export type HumanRequest = {
  id: string;
  /** Which screen the seller asked from. */
  from: string;
  /** What they typed, if anything. */
  note: string;
  /** Local timestamp, display-only. */
  requestedAt: Date;
};

export type SellerSessionState = {
  account: SellerAccount;
  consents: ConsentState;
  discovery: DiscoveryAnswers;
  /** Sale price the seller is modeling in the 1% explainer. */
  modeledSalePrice: number;
  buyerAgentRate: number;
  humanRequests: HumanRequest[];
  /** Plan step ids the seller has ticked off. */
  completedPlanSteps: string[];
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

export const INITIAL_STATE: SellerSessionState = {
  account: EMPTY_ACCOUNT,
  consents: EMPTY_CONSENTS,
  discovery: EMPTY_DISCOVERY,
  modeledSalePrice: 450000,
  buyerAgentRate: DEFAULT_BUYER_AGENT_RATE,
  humanRequests: [],
  completedPlanSteps: [],
};

type Action =
  | { type: 'setAccountField'; field: keyof SellerAccount; value: string }
  | { type: 'toggleConsent'; id: ConsentId }
  | { type: 'setDiscoveryField'; field: keyof DiscoveryAnswers; value: string | null }
  | { type: 'setModeledSalePrice'; value: number }
  | { type: 'setBuyerAgentRate'; value: number }
  | { type: 'togglePlanStep'; id: string }
  | { type: 'requestHuman'; from: string; note: string; id: string; requestedAt: Date };

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
          },
        ],
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
  requestHuman: (from: string, note: string) => void;
  /** Required consents given — the only thing that gates the flow. */
  canProceedPastConsent: boolean;
  /** The address we work with: what the seller typed, else the mock record. */
  propertyAddress: string;
};

const SellerSessionContext = createContext<SellerSessionValue | null>(null);

export function SellerSessionProvider({
  children,
  initialState = INITIAL_STATE,
}: {
  children: ReactNode;
  initialState?: SellerSessionState;
}) {
  const [state, dispatch] = useReducer(sellerSessionReducer, initialState);

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
      requestHuman: (from, note) =>
        dispatch({
          type: 'requestHuman',
          from,
          note,
          id: `req-${state.humanRequests.length + 1}`,
          requestedAt: new Date(),
        }),
      canProceedPastConsent: requiredConsentsGiven(state.consents),
      propertyAddress: typedAddress.length > 0 ? typedAddress : MOCK_PROPERTY_ADDRESS,
    };
  }, [state]);

  return (
    <SellerSessionContext.Provider value={value}>{children}</SellerSessionContext.Provider>
  );
}

export function useSellerSession(): SellerSessionValue {
  const value = useContext(SellerSessionContext);
  if (value === null) {
    throw new Error('useSellerSession must be used inside a SellerSessionProvider');
  }
  return value;
}
