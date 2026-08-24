import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RouteName } from './routes';

/**
 * No screen takes params yet — chunk 2 adds real ones (property id, plan id).
 * Keeping the map explicit now means adding a param is a type error at every
 * call site instead of a silent `undefined`.
 */
export type RootStackParamList = {
  Chat: undefined;
  Welcome: undefined;
  AccountConsent: undefined;
  SellerDiscovery: undefined;
  OnePercent: undefined;
  PropertyWorkspace: undefined;
  AiPlan: undefined;
  /** `from` records which screen the seller asked for help on, so the handoff
   *  can say what context transfers. Undefined when opened cold. */
  GetHuman: { from?: RouteName } | undefined;
  Status: undefined;
  Privacy: undefined;
  DeleteAccount: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
