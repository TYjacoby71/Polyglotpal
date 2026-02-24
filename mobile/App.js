import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/store/AuthContext';
import {
  setupNotifications,
  setupBackgroundHandler,
  scheduleNextNotification,
} from './src/services/notificationService';

// Register background handler at module level (required by notifee)
setupBackgroundHandler();

export default function App() {
  useEffect(() => {
    // Request notification permissions + schedule first notification
    setupNotifications().then(granted => {
      if (granted) scheduleNextNotification().catch(() => {});
    });
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
