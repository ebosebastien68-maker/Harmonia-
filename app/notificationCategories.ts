// =====================================================
// notificationCategories.ts
// Configuration de l'affichage des notifications
// mobile par type — iOS et Android via Expo
//
// Type actuel : nouveau_message
// D'autres types seront ajoutés au fur et à mesure.
//
// Placer dans : app/notificationCategories.ts
// =====================================================

// Appelé depuis push.ts → initPushNative() via require() dynamique
// Jamais importé directement sur web

import * as Notifications from 'expo-notifications'

// ── Types de notifications ────────────────────────────────────────────────────
export const NOTIF_TYPES = {
  NOUVEAU_MESSAGE:  'nouveau_message',
  NOUVEAU_TROPHEE:  'nouveau_trophee',
  NOTIFICATION:     'notification',
  SESSION_OUVERTE:  'session_ouverte',
} as const

// ── Enregistrement des catégories ─────────────────────────────────────────────
export async function registerNotificationCategories(): Promise<void> {

  // ── Nouveau message privé ─────────────────────────────────────────────────
  await Notifications.setNotificationCategoryAsync(
    NOTIF_TYPES.NOUVEAU_MESSAGE,
    [
      {
        identifier: 'open',
        buttonTitle: '💬 Lire le message',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Ignorer',
        options: {
          opensAppToForeground: false,
          isDestructive: false,
        },
      },
    ],
    {
      // Android : petite icône monochrome dans la barre de statut
      // Doit être dans /public et accessible via URL
      // iOS     : utilise automatiquement l'icône de l'app (app.json)
      androidIcon: '/message-badge.png',
    }
  )

  // ── Nouveau trophée ────────────────────────────────────────────────────────
  await Notifications.setNotificationCategoryAsync(
    NOTIF_TYPES.NOUVEAU_TROPHEE,
    [
      {
        identifier: 'open',
        buttonTitle: '🏆 Voir mon trophée',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Fermer',
        options: { opensAppToForeground: false },
      },
    ]
  )

  // ── Notification générale ───────────────────────────────────────────────────
  await Notifications.setNotificationCategoryAsync(
    NOTIF_TYPES.NOTIFICATION,
    [
      {
        identifier: 'open',
        buttonTitle: '👁 Lire',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Fermer',
        options: { opensAppToForeground: false },
      },
    ]
  )

  // ── Nouvelle session ─────────────────────────────────────────────────────────
  await Notifications.setNotificationCategoryAsync(
    NOTIF_TYPES.SESSION_OUVERTE,
    [
      {
        identifier: 'open',
        buttonTitle: '🎮 Voir la session',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Plus tard',
        options: { opensAppToForeground: false },
      },
    ]
  )

  console.log('[NotifCategories] ✅ Toutes les catégories enregistrées')
}

// ── Gestionnaire de tap sur la notification ───────────────────────────────────
// À appeler dans _layout.tsx au démarrage de l'app
// Gère la navigation quand l'utilisateur tape sur la notification
// ou sur un bouton d'action
export function setupNotificationResponseHandler(
  navigate: (screen: string, params?: Record<string, string>) => void
): () => void {

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data     = response.notification.request.content.data as Record<string, any>
      const actionId = response.actionIdentifier
      const type     = data?.type as string

      console.log(`[NotifCategories] Tap — type=${type} action=${actionId}`)

      // Ignorer si l'utilisateur a tapé "Ignorer"
      if (actionId === 'dismiss') return

      switch (type) {
        case NOTIF_TYPES.NOUVEAU_MESSAGE:
          if (data?.conversation_id) {
            navigate('messages', { conversation_id: data.conversation_id })
          } else {
            navigate('messages')
          }
          break

        case NOTIF_TYPES.NOUVEAU_TROPHEE:
          navigate('notifications')
          break

        case NOTIF_TYPES.NOTIFICATION:
          navigate('notifications')
          break

        case NOTIF_TYPES.SESSION_OUVERTE:
          navigate('home')
          break

        default:
          navigate('home')
      }
    }
  )

  // Retourne la fonction de nettoyage pour useEffect
  return () => subscription.remove()
}

// ── Gestionnaire de notification reçue en premier plan ────────────────────────
// Quand l'app est OUVERTE et qu'une notification arrive
// Expo l'affiche quand même grâce au setNotificationHandler dans push.ts
export function setupForegroundNotificationHandler(): () => void {
  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data as Record<string, any>
      const type = data?.type as string
      console.log(`[NotifCategories] Reçue en premier plan — type=${type}`)
    }
  )

  return () => subscription.remove()
}
