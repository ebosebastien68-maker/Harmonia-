// ChatBox.tsx — Routeur plateforme
// Détecte automatiquement l'environnement et délègue :
//   • Platform.OS === 'web'   → ChatBoxWeb    (comportement v8 stable)
//   • Platform.OS !== 'web'   → ChatBoxMobile (UI optimiste, ⏳ ✓ ✓✓, retries 30s)
//
// MessagesScreen.tsx importe uniquement ce fichier — aucun changement requis côté parent.

import { Platform } from 'react-native';
import ChatBoxWeb    from './ChatBoxWeb';
import ChatBoxMobile from './ChatBoxMobile';

export interface ChatBoxProps {
  conversationId:   string;
  conversationType: 'private' | 'group';
  userId:           string;
  userName?:        string;
  userRole?:        string;
  accessToken:      string;
  otherUser?: {
    id: string; nom: string; prenom: string;
    avatar_url: string | null; isOnline?: boolean;
  };
  groupName?:   string;
  memberCount?: number;
  onBack:          () => void;
  onNewMessage?:   () => void;
  onProfilePress?: (userId: string) => void;
}

export default function ChatBox(props: ChatBoxProps) {
  return Platform.OS === 'web'
    ? <ChatBoxWeb    {...props} />
    : <ChatBoxMobile {...props} />;
}
