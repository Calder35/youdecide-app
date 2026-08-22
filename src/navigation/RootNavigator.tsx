import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AccountConsentScreen,
  AiPlanScreen,
  DeleteAccountScreen,
  GetHumanScreen,
  OnePercentScreen,
  PrivacyScreen,
  PropertyWorkspaceScreen,
  SellerDiscoveryScreen,
  StatusScreen,
  WelcomeScreen,
} from '../screens';
import { theme } from '../theme';
import { ROUTES } from './routes';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * One stack for the whole app. The seller flow is linear, so a stack keeps the
 * back behavior obvious; `GetHuman` is pushed on top from anywhere rather than
 * living in the flow.
 */
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.Welcome}
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTintColor: theme.color.textPrimary,
        headerTitleStyle: { fontWeight: theme.fontWeight.semibold },
        contentStyle: { backgroundColor: theme.color.background },
      }}
    >
      <Stack.Screen
        name={ROUTES.Welcome}
        component={WelcomeScreen}
        options={{ title: 'You Decide' }}
      />
      <Stack.Screen
        name={ROUTES.AccountConsent}
        component={AccountConsentScreen}
        options={{ title: 'Account & consent' }}
      />
      <Stack.Screen
        name={ROUTES.SellerDiscovery}
        component={SellerDiscoveryScreen}
        options={{ title: 'Your sale' }}
      />
      <Stack.Screen
        name={ROUTES.OnePercent}
        component={OnePercentScreen}
        options={{ title: 'The 1% fee' }}
      />
      <Stack.Screen
        name={ROUTES.PropertyWorkspace}
        component={PropertyWorkspaceScreen}
        options={{ title: 'Property' }}
      />
      <Stack.Screen
        name={ROUTES.AiPlan}
        component={AiPlanScreen}
        options={{ title: 'Your plan' }}
      />
      <Stack.Screen
        name={ROUTES.GetHuman}
        component={GetHumanScreen}
        options={{ title: 'Get a human', presentation: 'modal' }}
      />
      <Stack.Screen
        name={ROUTES.Status}
        component={StatusScreen}
        options={{ title: 'Status' }}
      />
      <Stack.Screen
        name={ROUTES.Privacy}
        component={PrivacyScreen}
        options={{ title: 'Privacy' }}
      />
      <Stack.Screen
        name={ROUTES.DeleteAccount}
        component={DeleteAccountScreen}
        options={{ title: 'Delete account' }}
      />
    </Stack.Navigator>
  );
}
