// ChatBoxTypes.ts — Source de vérité partagée
// Importé par : ChatBox.tsx, ChatBoxWeb.tsx, ChatBoxMobile.tsx
// N'importe aucun de ces fichiers → aucune dépendance circulaire possible.

export interface ChatBoxProps {
  conversationId:   string;
  conversationType: 'private' | 'group';
  userId:           string;
  userName?:        string;
  userRole?:        string;   // 'userpro' → bouton media activé
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
