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
        headerStyle: { backgroundColor: '#F5F5F5' }, // Ton blanc cassé
        headerTintColor: '#000',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    />
  );
}
