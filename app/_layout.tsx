import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    // On vérifie qu'on est PAS sur un serveur (donc sur un vrai navigateur ou app)
    if (Platform.OS !== 'web' || typeof window !== 'undefined') {
      // On importe dynamiquement pour éviter le crash au build
      const Notifications = require('expo-notifications');
      
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
