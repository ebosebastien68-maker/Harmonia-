// ChatBox.tsx — v6
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics       from 'expo-haptics';
import { io, Socket }     from 'socket.io-client';

const WS_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

interface Message {
  id:           string;
  content:      string;
  senderId:     string;
  isFromMe:     boolean;
  senderName:   string;
  senderAvatar: string | null;
  createdAt:    string;
  isRead?:      boolean;
}

interface ChatBoxProps {
  conversationId:   string;
  conversationType: 'private' | 'group';
  userId:           string;
  userName?:        string;   // nom affiché dans les events typing groupe
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

export default function ChatBox({
  conversationId, conversationType, userId, userName = 'Moi',
  accessToken, otherUser, groupName, memberCount,
  onBack, onNewMessage, onProfilePress,
}: ChatBoxProps) {

  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(otherUser?.isOnline ?? false);
  const [hasMore,     setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const scrollRef   = useRef<ScrollView>(null);
  const socketRef   = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    const socket = conversationType === 'private' ? buildPrivateSocket() : buildGroupSocket();
    socketRef.current = socket;
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [conversationId, accessToken]);

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET PRIVÉ
  // ─────────────────────────────────────────────────────────────────────────

  const buildPrivateSocket = (): Socket => {
    const socket = io(`${WS_BASE}/private-chat`, { transports: ['websocket'], reconnectionDelay: 2000 });

    socket.on('connect', () => {
      console.log('[ChatBox] Socket privé connecté');
      socket.emit('join_conversation', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
      });
    });

    socket.on('joined', (data: { conversation_id: string; messages: Message[]; has_more: boolean }) => {
      setMessages((data.messages ?? []).map(normalizeMsg));
      setHasMore(data.has_more ?? false);
      setLoading(false);
      scrollToEnd();
    });

    socket.on('message_sent', (data: { message: Message }) => {
      const msg = normalizeMsg(data.message);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      setSending(false);
      scrollToEnd();
    });

    socket.on('new_message', (raw: any) => {
      const msg = normalizeMsg(raw?.message ?? raw);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (msg.senderId !== userId && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onNewMessage?.();
      scrollToEnd();
    });

    socket.on('more_messages', (data: { messages: Message[]; has_more: boolean }) => {
      setMessages(prev => [...(data.messages ?? []).map(normalizeMsg), ...prev]);
      setHasMore(data.has_more ?? false);
      setLoadingMore(false);
    });

    socket.on('typing_status', (data: { user_id: string; is_typing: boolean }) => {
      if (data.user_id !== userId) setOtherTyping(data.is_typing);
    });

    socket.on('error',      (err: { message: string }) => { console.warn('[ChatBox] Erreur socket privé :', err.message); setSending(false); });
    socket.on('disconnect', () => console.log('[ChatBox] Socket privé déconnecté'));

    return socket;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET GROUPE
  // ─────────────────────────────────────────────────────────────────────────

  const buildGroupSocket = (): Socket => {
    const socket = io(`${WS_BASE}/group-chat`, { transports: ['websocket'], reconnectionDelay: 2000 });

    socket.on('connect', () => {
      console.log('[ChatBox] Socket groupe connecté');
      socket.emit('join_group', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
      });
    });

    socket.on('joined', (data: { messages: Message[]; group: any }) => {
      const msgs = data?.messages ?? [];
      setMessages(msgs.map(normalizeMsg));
      // has_more : si on a reçu exactement 10 messages (limite initiale), il peut en exister plus
      setHasMore(msgs.length >= 10);
      setLoading(false);
      scrollToEnd();
    });

    // Confirmation d'envoi à l'émetteur (is_from_me: true)
    socket.on('message_sent', (data: { message: Message }) => {
      const msg = normalizeMsg(data.message);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      setSending(false);
      scrollToEnd();
    });

    // Nouveau message diffusé aux autres membres (is_from_me: false)
    socket.on('new_message', (raw: any) => {
      const msg = normalizeMsg(raw?.message ?? raw);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (msg.senderId !== userId && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onNewMessage?.();
      scrollToEnd();
    });

    // Pagination
    socket.on('more_messages', (data: { messages: Message[]; has_more: boolean }) => {
      setMessages(prev => [...(data.messages ?? []).map(normalizeMsg), ...prev]);
      setHasMore(data.has_more ?? false);
      setLoadingMore(false);
    });

    // Typing des autres membres
    socket.on('typing_status', (data: { user_id: string; user_name: string; is_typing: boolean }) => {
      if (data.user_id !== userId) setOtherTyping(data.is_typing);
    });

    socket.on('message_deleted', (data: { message_id: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, content: '' } : m
      ));
    });

    socket.on('error',      (err: { message: string }) => { console.warn('[ChatBox] Groupe erreur :', err.message); setSending(false); });
    socket.on('disconnect', () => console.log('[ChatBox] Socket groupe déconnecté'));

    return socket;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const scrollToEnd = () => {
    if (Platform.OS === 'web') {
      setTimeout(() => {
        const node = (scrollRef.current as any)?._nativeTag ?? (scrollRef.current as any)?.getScrollableNode?.();
        if (node) node.scrollTop = node.scrollHeight;
        else scrollRef.current?.scrollToEnd({ animated: false });
      }, 50);
    } else {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    if (conversationType === 'private') {
      socketRef.current?.emit('load_more', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
        before:          messages[0]?.createdAt,
      });
    } else {
      // Backend groupe attend group_id, pas conversation_id
      socketRef.current?.emit('load_more', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
        before:       messages[0]?.createdAt,
      });
    }
  };

  const sendMessage = () => {
    if (!input.trim() || sending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const content = input.trim();
    setInput('');
    setSending(true);

    if (conversationType === 'private') {
      // Stopper le typing avant d'envoyer
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socketRef.current?.emit('typing', {
          conversation_id: conversationId,
          user_id:         userId,
          is_typing:       false,
        });
      }
      socketRef.current?.emit('send_message', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
        content,
      });
    } else {
      // Backend groupe attend group_id + user_id + access_token
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socketRef.current?.emit('typing', {
          group_id:  conversationId,
          user_id:   userId,
          user_name: userName,
          is_typing: false,
        });
      }
      socketRef.current?.emit('send_message', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
        content,
      });
      // Ne pas setSending(false) ici — on attend la confirmation message_sent
    }
    scrollToEnd();
  };

  const handleTyping = (text: string) => {
    setInput(text);

    if (conversationType === 'private') {
      if (text.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        socketRef.current?.emit('typing', {
          conversation_id: conversationId,
          user_id:         userId,
          is_typing:       true,
        });
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        isTypingRef.current = false;
        socketRef.current?.emit('typing', {
          conversation_id: conversationId,
          user_id:         userId,
          is_typing:       false,
        });
      }, 2000);
    } else {
      // Groupe : payload différent, inclut user_name
      if (text.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        socketRef.current?.emit('typing', {
          group_id:  conversationId,
          user_id:   userId,
          user_name: userName,
          is_typing: true,
        });
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        isTypingRef.current = false;
        socketRef.current?.emit('typing', {
          group_id:  conversationId,
          user_id:   userId,
          user_name: userName,
          is_typing: false,
        });
      }, 2000);
    }
  };

  const fmtTime = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const normalizeMsg = (msg: any): Message => ({
    ...msg,
    id:           msg.id,
    content:      msg.content      ?? msg.text          ?? '',
    senderId:     msg.senderId     ?? msg.sender_id     ?? '',
    isFromMe:     msg.isFromMe     ?? msg.is_from_me    ?? false,
    senderName:   msg.senderName   ?? msg.sender_name   ?? '',
    senderAvatar: msg.senderAvatar ?? msg.sender_avatar ?? null,
    createdAt:    msg.createdAt    ?? msg.created_at    ?? null,
    isRead:       msg.isRead       ?? msg.is_read       ?? false,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.container}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {conversationType === 'private' ? (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => otherUser && onProfilePress?.(otherUser.id)}
            activeOpacity={onProfilePress ? 0.75 : 1}
          >
            <View style={S.avatar}>
              <Text style={S.avatarTxt}>{otherUser?.prenom.charAt(0)}{otherUser?.nom.charAt(0)}</Text>
              {otherOnline && <View style={S.onlineDot} />}
            </View>
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{otherUser?.prenom} {otherUser?.nom}</Text>
              <Text style={S.headerStatus}>
                {otherTyping ? "En train d'écrire..." : otherOnline ? 'En ligne' : 'Hors ligne'}
              </Text>
            </View>
            {onProfilePress && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />}
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[S.avatar, { backgroundColor: '#FF8C00' }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{groupName}</Text>
              <Text style={S.headerStatus}>
                {otherTyping ? "Quelqu'un écrit..." : `${memberCount} membres`}
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── Zone messages ───────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={S.msgs}
        contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
        {...(Platform.OS !== 'web' && { onContentSizeChange: () => scrollRef.current?.scrollToEnd({ animated: true }) })}
      >
        {/* Charger plus */}
        {hasMore && !loading && (
          <TouchableOpacity
            onPress={loadMore}
            disabled={loadingMore}
            style={{ alignSelf: 'center', marginBottom: 12, marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F0E8FF', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            {loadingMore
              ? <Text style={{ fontSize: 13, color: '#8A2BE2', fontWeight: '600' }}>Chargement des données</Text>
              : <>
                  <Ionicons name="chevron-up" size={16} color="#8A2BE2" />
                  <Text style={{ fontSize: 13, color: '#8A2BE2', fontWeight: '600' }}>Voir les messages précédents</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* États principaux */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Text style={{ fontSize: 14, color: '#999' }}>Chargement des données</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#888', marginTop: 15 }}>
              Vous n'avez aucun message
            </Text>
            <Text style={{ fontSize: 14, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
              Démarrez la discussion avec vos amis
            </Text>
          </View>
        ) : (
          messages.map(msg => (
            <View key={msg.id} style={[S.bubble, msg.isFromMe ? S.bubbleMe : S.bubbleThem]}>
              {!msg.isFromMe && conversationType === 'group' && (
                <Text style={S.senderName}>{msg.senderName}</Text>
              )}
              <Text style={[S.msgText, msg.isFromMe ? S.msgTextMe : S.msgTextThem]}>
                {msg.content || <Text style={{ fontStyle: 'italic', opacity: 0.5 }}>Message supprimé</Text>}
              </Text>
              <Text style={[S.msgTime, msg.isFromMe ? S.msgTimeMe : S.msgTimeThem]}>
                {fmtTime(msg.createdAt)}{msg.isFromMe && msg.isRead ? ' ✓✓' : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Saisie ──────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={S.inputWrap}>
          <TextInput
            style={S.input}
            placeholder="Écrivez un message..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[S.sendBtn, (!input.trim() || sending) && S.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            activeOpacity={0.7}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  header:          { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, paddingHorizontal: 15 },
  backBtn:         { marginRight: 12, padding: 5 },
  avatar:          { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarTxt:       { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  onlineDot:       { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff', bottom: 2, right: 2 },
  headerInfo:      { flex: 1, marginLeft: 10 },
  headerName:      { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerStatus:    { fontSize: 12, color: '#E0D0FF', marginTop: 2 },
  msgs:            { flex: 1 },
  bubble:          { maxWidth: '75%', padding: 12, borderRadius: 18, marginBottom: 8 },
  bubbleMe:        { alignSelf: 'flex-end', backgroundColor: '#8A2BE2', borderBottomRightRadius: 4 },
  bubbleThem:      { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  senderName:      { fontSize: 11, fontWeight: '600', color: '#8A2BE2', marginBottom: 4 },
  msgText:         { fontSize: 15, lineHeight: 20 },
  msgTextMe:       { color: '#fff' },
  msgTextThem:     { color: '#333' },
  msgTime:         { fontSize: 10, marginTop: 4 },
  msgTimeMe:       { color: '#E0D0FF', textAlign: 'right' },
  msgTimeThem:     { color: '#999' },
  inputWrap:       { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 10, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  input:           { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 10 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
});
