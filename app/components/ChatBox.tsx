// ChatBox.tsx
//
// ┌──────────────────────────────────────────────────────┐
// │  PRIVÉ  → EventSource (messages-stream)  — inchangé  │
// │  GROUPE → Socket.IO /group-chat          — nouveau   │
// └──────────────────────────────────────────────────────┘
//
// Props ajoutée : accessToken (requis pour les groupes)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { io as SocketIO, Socket } from 'socket.io-client';

const API_BASE    = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages';
const STREAM_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages-stream';
const WS_BASE     = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const NATIVE      = Platform.OS !== 'web';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id:           string;
  content:      string | null;
  sender_id?:   string;  // groupe
  senderId?:    string;  // privé (compat existante)
  is_from_me?:  boolean; // groupe
  isFromMe?:    boolean; // privé (compat existante)
  senderName:   string;
  senderAvatar: string | null;
  created_at?:  string;
  createdAt?:   string;
  isRead?:      boolean;
  type?:        string;
  mediaUrl?:    string;
  deleted_at?:  string | null;
}

interface GroupMember {
  user_id:    string;
  nom:        string;
  prenom:     string;
  avatar_url: string | null;
}

interface ChatBoxProps {
  conversationId:   string;
  conversationType: 'private' | 'group';
  userId:           string;
  accessToken?:     string;   // ← requis pour les groupes
  otherUser?: {
    id: string; nom: string; prenom: string;
    avatar_url: string | null; isOnline?: boolean;
  };
  groupName?:   string;
  memberCount?: number;
  onBack:       () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const isFromMe = (m: Message): boolean =>
  m.is_from_me ?? m.isFromMe ?? false;

const msgDate = (m: Message): string =>
  (m.created_at ?? m.createdAt ?? '');

const msgContent = (m: Message): string =>
  m.deleted_at ? '🗑️ Message supprimé' : (m.content ?? '');

// ─────────────────────────────────────────────────────────────────────────────
// CHATBOX PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatBox({
  conversationId, conversationType, userId, accessToken,
  otherUser, groupName, memberCount, onBack,
}: ChatBoxProps) {
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [messageInput,   setMessageInput]   = useState('');
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [otherTyping,    setOtherTyping]    = useState(false);
  const [typingNames,    setTypingNames]    = useState<string[]>([]);
  const [wsConnected,    setWsConnected]    = useState(false);
  const [members,        setMembers]        = useState<GroupMember[]>([]);
  const [realMemberCount,setRealMemberCount]= useState(memberCount ?? 0);

  // Pagination groupe
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);

  const scrollViewRef   = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef      = useRef(false);

  // Privé : EventSource
  const eventSourceRef = useRef<EventSource | null>(null);
  // Groupe : Socket.IO
  const socketRef      = useRef<Socket | null>(null);

  // ─── MONTAGE ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (conversationType === 'group') {
      connectGroupSocket();
    } else {
      loadPrivateMessages();
      markAsRead();
      setupPrivateStream();
    }

    return () => {
      // Nettoyage
      if (conversationType === 'group') {
        stopTyping();
        socketRef.current?.disconnect();
        socketRef.current = null;
      } else {
        eventSourceRef.current?.close();
        if (conversationType === 'private') stopPrivateTyping();
      }
      typingTimeoutRef.current && clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId]);

  // ─── SCROLL ────────────────────────────────────────────────────────────────
  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUPE — Socket.IO /group-chat
  // ══════════════════════════════════════════════════════════════════════════
  const connectGroupSocket = () => {
    if (!accessToken) {
      Alert.alert('Erreur', 'Session expirée — reconnectez-vous');
      return;
    }

    const socket = SocketIO(`${WS_BASE}/group-chat`, {
      transports:          ['websocket', 'polling'],
      reconnection:        true,
      reconnectionAttempts: 5,
      reconnectionDelay:   2000,
    });

    socketRef.current = socket;

    // ── Connexion établie → rejoindre le groupe ──────────────────────────
    socket.on('connect', () => {
      console.log('[GroupChat] 🔌 Socket connecté:', socket.id);
      setWsConnected(true);
      socket.emit('join_group', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
      });
    });

    // ── joined → messages initiaux + membres ────────────────────────────
    socket.on('joined', (data: {
      group_id: string;
      group:    { id: string; name: string; description: string; member_count: number };
      messages: Message[];
      members:  GroupMember[];
    }) => {
      setMessages(data.messages);
      setMembers(data.members);
      setRealMemberCount(data.group.member_count);
      setLoading(false);
      setHasMore(data.messages.length === 50);
      scrollToEnd(false);
    });

    // ── Nouveau message entrant ──────────────────────────────────────────
    socket.on('new_message', ({ message }: { message: Message }) => {
      if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessages(prev => [...prev, message]);
      scrollToEnd();
    });

    // ── Confirmation d'envoi (mon propre message) ────────────────────────
    socket.on('message_sent', ({ message }: { message: Message }) => {
      setMessages(prev => [...prev, message]);
      setSending(false);
      scrollToEnd();
    });

    // ── Message supprimé ────────────────────────────────────────────────
    socket.on('message_deleted', ({ message_id }: { message_id: string }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === message_id
            ? { ...m, deleted_at: new Date().toISOString(), content: null }
            : m
        )
      );
    });

    // ── Typing ──────────────────────────────────────────────────────────
    socket.on('typing_status', ({ user_id, user_name, is_typing }: {
      user_id: string; user_name: string; is_typing: boolean;
    }) => {
      if (user_id === userId) return;
      setTypingNames(prev => {
        if (is_typing) return prev.includes(user_name) ? prev : [...prev, user_name];
        return prev.filter(n => n !== user_name);
      });
    });

    // ── Pagination (messages plus anciens) ──────────────────────────────
    socket.on('more_messages', ({ messages, has_more }: { messages: Message[]; has_more: boolean }) => {
      setMessages(prev => [...messages, ...prev]);
      setHasMore(has_more);
      setLoadingMore(false);
    });

    // ── Membres ─────────────────────────────────────────────────────────
    socket.on('member_online',  ({ members }: { members: GroupMember[] }) => {
      setMembers(members);
      setRealMemberCount(members.length);
    });

    // ── Erreurs ─────────────────────────────────────────────────────────
    socket.on('error', ({ message }: { message: string }) => {
      console.error('[GroupChat] Erreur:', message);
      if (message.includes('Token')) {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter');
        onBack();
      }
    });

    socket.on('send_error', ({ message }: { message: string }) => {
      Alert.alert('Erreur', message);
      setSending(false);
    });

    socket.on('disconnect', () => {
      console.log('[GroupChat] 🔌 Déconnecté');
      setWsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[GroupChat] Erreur connexion:', err.message);
      setLoading(false);
    });
  };

  // ── Envoyer un message (groupe) ─────────────────────────────────────────
  const sendGroupMessage = () => {
    const content = messageInput.trim();
    if (!content || !socketRef.current || sending) return;

    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessageInput('');
    setSending(true);
    stopTyping();

    socketRef.current.emit('send_message', {
      group_id:     conversationId,
      user_id:      userId,
      access_token: accessToken,
      content,
      type: 'text',
    });

    // Timeout sécurité : si pas de réponse en 5s
    setTimeout(() => setSending(false), 5000);
  };

  // ── Supprimer un message (groupe) ───────────────────────────────────────
  const deleteGroupMessage = (messageId: string) => {
    if (!socketRef.current || !accessToken) return;
    socketRef.current.emit('delete_message', {
      message_id:   messageId,
      user_id:      userId,
      access_token: accessToken,
    });
  };

  // ── Charger plus (groupe) ──────────────────────────────────────────────
  const loadMoreGroupMessages = () => {
    if (!hasMore || loadingMore || !socketRef.current || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    socketRef.current.emit('load_more', {
      group_id:     conversationId,
      user_id:      userId,
      access_token: accessToken,
      before:       msgDate(oldest),
      limit:        30,
    });
  };

  // ── Typing (groupe) ──────────────────────────────────────────────────
  const startTyping = () => {
    if (!socketRef.current || isTypingRef.current) return;
    isTypingRef.current = true;
    const me = members.find(m => m.user_id === userId);
    socketRef.current.emit('typing', {
      group_id:  conversationId,
      user_id:   userId,
      user_name: me ? `${me.prenom} ${me.nom}` : 'Utilisateur',
      is_typing: true,
    });
  };

  const stopTyping = () => {
    if (!socketRef.current || !isTypingRef.current) return;
    isTypingRef.current = false;
    const me = members.find(m => m.user_id === userId);
    socketRef.current.emit('typing', {
      group_id:  conversationId,
      user_id:   userId,
      user_name: me ? `${me.prenom} ${me.nom}` : 'Utilisateur',
      is_typing: false,
    });
  };

  const handleGroupTyping = (text: string) => {
    setMessageInput(text);
    if (text.length > 0) startTyping();
    typingTimeoutRef.current && clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2500);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVÉ — EventSource (code original inchangé)
  // ══════════════════════════════════════════════════════════════════════════
  const setupPrivateStream = () => {
    const url = `${STREAM_BASE}?user_id=${userId}&conversation_id=${conversationId}`;
    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.addEventListener('connected', () => {
      console.log('✅ Connexion temps réel établie (privé)');
    });

    eventSourceRef.current.addEventListener('new-message', async (event: any) => {
      const data = JSON.parse(event.data);
      await loadPrivateMessages();
      if (data.message.sender_id !== userId) {
        markAsRead();
        if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      scrollToEnd();
    });

    eventSourceRef.current.addEventListener('message-updated', () => {
      loadPrivateMessages();
    });

    eventSourceRef.current.addEventListener('typing-status', (event: any) => {
      const data = JSON.parse(event.data);
      setOtherTyping(data.isTyping);
    });

    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      setTimeout(setupPrivateStream, 5000);
    };
  };

  const loadPrivateMessages = async () => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
        body: JSON.stringify({ action: 'get-conversation-messages', conversation_id: conversationId, user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        scrollToEnd(false);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const sendPrivateMessage = async () => {
    const content = messageInput.trim();
    if (!content || sending) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessageInput('');
    setSending(true);
    stopPrivateTyping();
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
        body: JSON.stringify({ action: 'send-private-message', user_id: userId, conversation_id: conversationId, content }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      scrollToEnd();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
        body: JSON.stringify({ action: 'mark-as-read', conversation_id: conversationId, user_id: userId }),
      });
    } catch {}
  };

  const handlePrivateTyping = (text: string) => {
    setMessageInput(text);
    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      updatePrivateTyping(true);
    }
    typingTimeoutRef.current && clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopPrivateTyping, 2000);
  };

  const stopPrivateTyping = () => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    updatePrivateTyping(false);
  };

  const updatePrivateTyping = async (typing: boolean) => {
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
        body: JSON.stringify({ action: 'update-typing-status', conversation_id: conversationId, user_id: userId, is_typing: typing }),
      });
    } catch {}
  };

  // ─── Dispatch send ─────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (conversationType === 'group') sendGroupMessage();
    else sendPrivateMessage();
  };

  const handleTyping = (text: string) => {
    if (conversationType === 'group') handleGroupTyping(text);
    else handlePrivateTyping(text);
  };

  // ─── Avatar helpers ────────────────────────────────────────────────────────
  const renderPrivateAvatar = (size = 40) => {
    if (!otherUser) return null;
    return (
      <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[S.avatarTxt, { fontSize: size / 2.5 }]}>
          {otherUser.prenom.charAt(0)}{otherUser.nom.charAt(0)}
        </Text>
        {otherUser.isOnline && (
          <View style={[S.onlineIndicator, { width: size / 4, height: size / 4, borderRadius: size / 8, bottom: size / 20, right: size / 20 }]} />
        )}
      </View>
    );
  };

  // ─── Typing indicator ────────────────────────────────────────────────────
  const typingText = conversationType === 'group'
    ? typingNames.length === 0 ? null
      : typingNames.length === 1 ? `${typingNames[0]} écrit…`
      : `${typingNames.slice(0, 2).join(', ')} écrivent…`
    : otherTyping ? '✍️ En train d\'écrire…' : null;

  // ─── Indicateur connexion groupe ─────────────────────────────────────────
  const connectionLabel = conversationType === 'group'
    ? wsConnected ? null : '⚠️ Reconnexion…'
    : null;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      style={S.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {conversationType === 'private' ? (
          <>
            {renderPrivateAvatar(40)}
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{otherUser?.prenom} {otherUser?.nom}</Text>
              <Text style={S.headerStatus}>
                {typingText ?? (otherUser?.isOnline ? '🟢 En ligne' : '⚪ Hors ligne')}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[S.avatar, S.groupAvatar, { width: 40, height: 40 }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{groupName}</Text>
              <Text style={S.headerStatus}>
                {typingText ?? `${realMemberCount} membre${realMemberCount !== 1 ? 's' : ''}`}
              </Text>
            </View>
            {/* Indicateur WS */}
            {connectionLabel && (
              <View style={S.wsIndicator}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={S.wsIndicatorTxt}>{connectionLabel}</Text>
              </View>
            )}
          </>
        )}
      </LinearGradient>

      {/* ─── MESSAGES ────────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollViewRef}
        style={S.messagesContainer}
        contentContainerStyle={S.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        onScrollBeginDrag={() => {
          // Déclencher load_more si on scroll vers le haut pour les groupes
        }}
      >
        {/* Bouton charger plus — groupes seulement */}
        {conversationType === 'group' && hasMore && (
          <TouchableOpacity style={S.loadMoreBtn} onPress={loadMoreGroupMessages} disabled={loadingMore}>
            {loadingMore
              ? <ActivityIndicator size="small" color="#8A2BE2" />
              : <Text style={S.loadMoreTxt}>⬆️ Charger les messages précédents</Text>}
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={S.loadingContainer}>
            <ActivityIndicator size="large" color="#8A2BE2" />
          </View>
        ) : messages.length === 0 ? (
          <View style={S.emptyChat}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={S.emptyChatTxt}>Aucun message</Text>
            <Text style={S.emptyChatSub}>Commencez la conversation !</Text>
          </View>
        ) : (
          messages.map(message => {
            const fromMe    = isFromMe(message);
            const deleted   = !!message.deleted_at;
            const content   = msgContent(message);
            const dateStr   = msgDate(message);
            const canDelete = !deleted && fromMe && conversationType === 'group';

            return (
              <View key={message.id} style={[S.bubbleWrapper, fromMe ? S.wrapperRight : S.wrapperLeft]}>
                {/* Nom expéditeur (groupe, messages des autres) */}
                {!fromMe && conversationType === 'group' && (
                  <Text style={S.senderName}>{message.senderName}</Text>
                )}

                <View style={[S.bubble, fromMe ? S.myBubble : S.theirBubble, deleted && S.deletedBubble]}>
                  <Text style={[S.bubbleTxt, fromMe ? S.myTxt : S.theirTxt, deleted && S.deletedTxt]}>
                    {content}
                  </Text>
                  <View style={S.bubbleFooter}>
                    <Text style={[S.bubbleTime, fromMe ? S.myTime : S.theirTime]}>
                      {dateStr ? fmtTime(dateStr) : ''}
                      {fromMe && (message.isRead) && ' ✓✓'}
                    </Text>
                    {/* Bouton supprimer */}
                    {canDelete && (
                      <TouchableOpacity
                        style={S.deleteMsgBtn}
                        onPress={() => Alert.alert(
                          'Supprimer',
                          'Supprimer ce message ?',
                          [
                            { text: 'Annuler', style: 'cancel' },
                            { text: 'Supprimer', style: 'destructive', onPress: () => deleteGroupMessage(message.id) },
                          ]
                        )}
                      >
                        <Ionicons name="trash-outline" size={13} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ─── ZONE SAISIE ─────────────────────────────────────────────────── */}
      <View style={S.inputContainer}>
        <TextInput
          style={S.input}
          placeholder="Écrivez un message…"
          placeholderTextColor="#999"
          value={messageInput}
          onChangeText={handleTyping}
          multiline
          maxLength={1000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[S.sendBtn, (!messageInput.trim() || sending) && S.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!messageInput.trim() || sending}
          activeOpacity={0.7}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F5F5F5' },
  header:           { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 15, paddingHorizontal: 15 },
  backBtn:          { marginRight: 12, padding: 5 },
  headerInfo:       { flex: 1, marginLeft: 10 },
  headerName:       { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerStatus:     { fontSize: 12, color: '#E0D0FF', marginTop: 2 },

  wsIndicator:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wsIndicatorTxt: { fontSize: 11, color: '#FFD700', fontWeight: '600' },

  avatar:          { backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  groupAvatar:     { backgroundColor: '#FF8C00', borderRadius: 20 },
  avatarTxt:       { color: '#fff', fontWeight: 'bold' },
  onlineIndicator: { position: 'absolute', backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },

  messagesContainer: { flex: 1 },
  messagesContent:   { padding: 15, paddingBottom: 20 },

  loadMoreBtn: { alignItems: 'center', paddingVertical: 12 },
  loadMoreTxt: { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },

  loadingContainer: { padding: 40, alignItems: 'center' },
  emptyChat:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyChatTxt:     { fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 15 },
  emptyChatSub:     { fontSize: 14, color: '#999', marginTop: 5 },

  // Bubbles
  bubbleWrapper: { marginBottom: 8, maxWidth: '78%' },
  wrapperRight:  { alignSelf: 'flex-end' },
  wrapperLeft:   { alignSelf: 'flex-start' },
  senderName:    { fontSize: 11, fontWeight: '700', color: '#8A2BE2', marginBottom: 3, marginLeft: 4 },

  bubble:        { padding: 12, borderRadius: 18 },
  myBubble:      { backgroundColor: '#8A2BE2', borderBottomRightRadius: 4 },
  theirBubble:   { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  deletedBubble: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },

  bubbleTxt:   { fontSize: 15, lineHeight: 20 },
  myTxt:       { color: '#fff' },
  theirTxt:    { color: '#333' },
  deletedTxt:  { color: '#999', fontStyle: 'italic' },

  bubbleFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  bubbleTime:    { fontSize: 10 },
  myTime:        { color: '#E0D0FF' },
  theirTime:     { color: '#999' },
  deleteMsgBtn:  { padding: 2 },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 10, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  input:          { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 10 },
  sendBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:{ backgroundColor: '#ccc' },
});
