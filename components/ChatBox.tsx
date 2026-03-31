// ChatBox.tsx — Routeur plateforme
// Détecte automatiquement l'environnement et délègue :
//   • Platform.OS === 'web'   → ChatBoxWeb    (comportement v8 stable)
//   • Platform.OS !== 'web'   → ChatBoxMobile (UI optimiste, ⏳ ✓ ✓✓, retries 30s)
//
// MessagesScreen.tsx importe uniquement ce fichier — aucun changement requis côté parent.

import { Platform }      from 'react-native';
import ChatBoxWeb        from './ChatBoxWeb';
import ChatBoxMobile     from './ChatBoxMobile';
import type { ChatBoxProps } from './ChatBoxTypes';

export type { ChatBoxProps };

export default function ChatBox(props: ChatBoxProps) {
  return Platform.OS === 'web'
    ? <ChatBoxWeb    {...props} />
    : <ChatBoxMobile {...props} />;
}
