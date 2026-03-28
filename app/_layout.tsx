import { Stack }               from 'expo-router';
import { useEffect }            from 'react';
import { Animated, Platform }   from 'react-native';
import * as Notifications       from 'expo-notifications';

// ── Patch fetch global — mobile uniquement ────────────────────────────────────
// Ajoute automatiquement x-api-key sur toutes les requêtes fetch
// quand l'app tourne sur iOS ou Android (pas sur web).
// Aucune modification nécessaire dans les autres fichiers.
if (Platform.OS !== 'web') {
  const originalFetch = global.fetch;
  global.fetch = (input: any, init: any = {}) => {
    init.headers = {
      ...init.headers,
      'x-api-key': process.env.EXPO_PUBLIC_API_KEY || '',
    };
    return originalFetch(input, init);
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Patch Animated sur web ────────────────────────────────────────────────────
// Certaines libs tierces (LinearGradient, RefreshControl…) passent
// useNativeDriver:true sur web → warning + blocage JS.
// Ce bloc intercepte tous les appels Animated et force useNativeDriver:false
// uniquement sur web. Sur mobile : aucun effet.
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
// ─────────────────────────────────────────────────────────────────────────────

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

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
