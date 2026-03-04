import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

export default function RootLayout() {
  useEffect(() => {
    // Configuration de base des notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false, // 🔥 CACHE TOUS LES HEADERS DÉFINITIVEMENT
      }}
    />
  );
}
