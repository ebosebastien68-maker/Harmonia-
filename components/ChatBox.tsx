// ChatBox.tsx — Routeur plateforme
// Détecte l'environnement et délègue au composant adapté :
//   • Web    → ChatBoxWeb    (comportement v8, WebSocket direct, upload fetch/blob)
//   • Mobile → ChatBoxMobile (comportement v9, keyboardShouldPersistTaps, safe haptics, failsafe 5s)

import { Platform } from 'react-native';
import ChatBoxWeb    from './ChatBoxWeb';
import ChatBoxMobile from './ChatBoxMobile';

// ─── Interface partagée ───────────────────────────────────────────────────────
// Identique dans ChatBoxWeb et ChatBoxMobile — toute modification ici
// doit être répercutée dans les deux composants.

export interface ChatBoxProps {
  conversationId:   string;
  conversationType: 'private' | 'group';
  userId:           string;
  userName?:        string;
  userRole?:        string;   // 'userpro' → bouton media activé en groupe
  accessToken:      string;
  otherUser?: {
    id: string; nom: string; prenom: string;
    avatar_url: string | null; isOnline?: boolean;
  };
  groupName?:      string;
  memberCount?:    number;
  onBack:          () => void;
  onNewMessage?:   () => void;
  onProfilePress?: (userId: string) => void;
}

// ─── Routeur ─────────────────────────────────────────────────────────────────

export default function ChatBox(props: ChatBoxProps) {
  if (Platform.OS === 'web') {
    return <ChatBoxWeb {...props} />;
  }
  return <ChatBoxMobile {...props} />;
}
