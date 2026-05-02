import { Stack }              from 'expo-router';
import { useEffect }          from 'react';
import { Animated, Platform } from 'react-native';
import * as Notifications     from 'expo-notifications';
import AsyncStorage           from '@react-native-async-storage/async-storage';

// ══════════════════════════════════════════════════════════════════════════════
// PATCH FETCH GLOBAL — iOS · Android · Web
// ══════════════════════════════════════════════════════════════════════════════
(() => {
  const originalFetch = global.fetch;

  global.fetch = async (input: any, init: any = {}) => {
    let authHeader: Record<string, string> = {};
    
    const urlStr = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    const isGoogleAuth = urlStr.includes('accounts.google.com');

    if (!isGoogleAuth) {
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
    }

    init.headers = {
      ...authHeader,        // 1. token de session (si disponible et non bloqué)
      ...init.headers,      // 2. headers explicites de l'appelant
    };

    return originalFetch(input, init);
  };
})();
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PATCH ANIMATED — Web uniquement
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
