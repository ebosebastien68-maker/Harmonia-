import { Stack }             from 'expo-router';
import { useEffect }          from 'react';
import { Animated, Platform } from 'react-native';
import * as Notifications     from 'expo-notifications';
import AsyncStorage           from '@react-native-async-storage/async-storage';

// ══════════════════════════════════════════════════════════════════════════════
// PATCH FETCH GLOBAL — iOS · Android · Web
//
// Injecte automatiquement sur chaque requête fetch :
//   • x-api-key     : clé API du backend (variable d'env EXPO_PUBLIC_API_KEY)
//   • Authorization : Bearer <access_token> lu dans AsyncStorage (harmonia_session)
//
// Règles :
//   • Le token est lu à chaque appel → toujours à jour après login / logout
//   • Si pas de session → Authorization omis, aucun crash
//   • Les headers explicites passés dans fetch() ont toujours la priorité
//   • Sur web : AsyncStorage est émulé via localStorage par Expo → même API
// ══════════════════════════════════════════════════════════════════════════════
(() => {
  const originalFetch = global.fetch;

  global.fetch = async (input: any, init: any = {}) => {
    let authHeader: Record<string, string> = {};

    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.access_token) {
          authHeader = { Authorization: `Bearer ${session.access_token}` };
        }
      }
    } catch {
      // Session illisible ou AsyncStorage indisponible → on continue sans token
    }

    init.headers = {
      ...authHeader,        // 1. token de session (si disponible)
      ...init.headers,      // 2. headers explicites de l'appelant (priorité sur authHeader)
      'x-api-key': process.env.EXPO_PUBLIC_API_KEY || '',  // 3. toujours présent
    };

    return originalFetch(input, init);
  };
})();
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PATCH ANIMATED — Web uniquement
//
// Certaines libs tierces (LinearGradient, RefreshControl…) passent
// useNativeDriver: true sur web → warning + blocage JS.
// Ce bloc force useNativeDriver: false uniquement sur web.
// Sur iOS / Android : aucun effet.
// ══════════════════════════════════════════════════════════════════════════════
if (Platform.OS === 'web') {
  const patch = (config: any) =>
    config && typeof config === 'object'
      ? { ...config, useNativeDriver: false }
      : config;

  const _timing = Animated.timing;
  (Animated as any).timing = (v: any, c: any) => _timing(v, patch(c));

  const _spring = Animated.spring;
  (Animated as any).spring = (v: any, c: any) => _spring(v, patch(c));

  const _decay = Animated.decay;
  (Animated as any).decay  = (v: any, c: any) => _decay(v, patch(c));
}
// ══════════════════════════════════════════════════════════════════════════════

export default function RootLayout() {
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  false,
      }),
    });
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
