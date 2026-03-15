import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Head uniquement sur web (Expo Router)
let Head: any = null;
if (Platform.OS === 'web') {
  Head = require('expo-router/head').Head;
}

// Catégories de notifications uniquement sur mobile
import {
  registerNotificationCategories,
  setupNotificationResponseHandler,
  setupForegroundNotificationHandler,
} from './notificationCategories';

export default function RootLayout() {
  useEffect(() => {
    // Configuration de base des notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  false,
      }),
    });

    if (Platform.OS !== 'web') {
      // Enregistrer les catégories (boutons d'action par type)
      registerNotificationCategories().catch(err =>
        console.warn('[Layout] registerNotificationCategories:', err)
      );

      // Gérer les taps sur les notifications
      const cleanupResponse   = setupNotificationResponseHandler(
        (screen, params) => {
          // Navigation gérée dans chaque écran via useRouter
          // On stocke dans un event global si nécessaire
          console.log(`[Layout] Navigation → ${screen}`, params);
        }
      );

      // Gérer les notifications reçues en premier plan
      const cleanupForeground = setupForegroundNotificationHandler();

      return () => {
        cleanupResponse();
        cleanupForeground();
      };
    }
  }, []);

  return (
    <>
      {/* Manifest PWA — web uniquement */}
      {Platform.OS === 'web' && Head && (
        <Head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#F5F5F5" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Harmonia" />
          <meta name="description" content="Révélez Votre Talent" />
        </Head>
      )}

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </>
  );
}
