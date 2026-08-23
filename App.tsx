import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { ChatSessionProvider } from './src/state/ChatSession';
import { SellerSessionProvider } from './src/state/SellerSession';

export default function App() {
  return (
    <SafeAreaProvider>
      <SellerSessionProvider>
        <ChatSessionProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </ChatSessionProvider>
      </SellerSessionProvider>
    </SafeAreaProvider>
  );
}
