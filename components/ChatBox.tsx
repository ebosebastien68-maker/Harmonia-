// ChatBox.tsx — v4
// Messagerie temps reel via Socket.IO Render
// Prive : socket /private-chat
// Groupe : socket /group-chat (deja existant)

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
  id: string;
  content: string;
  senderId: string;
  isFromMe: boolean;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  isRead?: boolean;
}

interface ChatBoxProps {
  conversationId:   string;
  conversationType: 'private' | 'group';
  userId:           string;
  accessToken:      string;
  otherUser?: { id: string; nom: string; prenom: string; avatar_url: string | null; isOnline?: boolean };
  groupName?:   string;
  memberCount?: number;
  onBack:       () => void;
  onNewMessage?: () => void;
}

export default function ChatBox({
  conversationId, conversationType, userId, accessToken,
  otherUser, groupName, memberCount, onBack, onNewMessage,
}: ChatBoxProps) {
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [otherTyping,   setOtherTyping]   = useState(false);
  const [otherOnline,   setOtherOnline]   = useState(otherUser?.isOnline ?? false);
  const scrollRef     = useRef<ScrollView>(null);
  const socketRef     = useRef<Socket | null>(null);
  const typingTimer   = useRef<any>(null);
  const isTypingRef   = useRef(false);

  useEffect(() => {
    if (conversationType === 'private') {
      initPrivateSocket();
    } else {
      initGroupSocket();
    }
    return () => {
      socketRef.current?.disconnect();
      clearTimeout(typingTimer.current);
    };
  }, [conversationId]);

  // ── Socket prive ───────────────────────────────────────────────────────────
  const initPrivateSocket = () => {
    const socket = io(`${WS_BASE}/private-chat`, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[ChatBox] Socket prive connecte');
      socket.emit('join_conversation', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
      });
    });

    socket.on('joined', (data: { conversation_id: string; messages: Message[] }) => {
      console.log('[ChatBox] Rejoint la conversation');
      if (data.messages) {
        setMessages(data.messages);
        scrollToEnd();
      }
      setLoading(false);
    });

    socket.on('message_sent', (data: { message: Message }) => {
      setMessages(prev => {
        if (prev.find(m => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      scrollToEnd();
      setSending(false);
    });

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        const exists = prev.find(m => m.id === msg.id);
        if (exists) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== userId) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        markAsRead();
        onNewMessage?.();
      }
      scrollToEnd();
    });

    socket.on('typing_status', (data: { user_id: string; is_typing: boolean }) => {
      if (data.user_id !== userId) setOtherTyping(data.is_typing);
    });

    // presence-update : géré via user_presence à la connexion/déconnexion

    socket.on('error', (err: { message: string }) => {
      console.warn('[ChatBox] Erreur socket:', err.message);
    });

    socket.on('disconnect', () => console.log('[ChatBox] Deconnecte'));

    socketRef.current = socket;
  };

  // ── Socket groupe (namespace existant) ────────────────────────────────────
  const initGroupSocket = () => {
    const socket = io(`${WS_BASE}/group-chat`, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[ChatBox] Socket groupe connecte');
      socket.emit('join_group', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
      });
    });

    socket.on('joined',         () => { loadMessages(); });
    socket.on('group_history',  (data: { messages: Message[] }) => {
      setMessages(data.messages ?? []);
      setLoading(false);
      scrollToEnd();
    });
    socket.on('new_message',    (msg: Message) => {
      setMessages(prev => {
        const exists = prev.find(m => m.id === msg.id);
        if (exists) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== userId && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onNewMessage?.();
      scrollToEnd();
    });
    socket.on('error',          (err: { message: string }) => console.warn('[ChatBox] Groupe erreur:', err.message));
    socket.on('disconnect',     () => console.log('[ChatBox] Groupe deconnecte'));

    socketRef.current = socket;
  };

  // ── Chargement messages (prive seulement — groupe recu via socket) ─────────
  const loadMessages = async () => {
    if (conversationType !== 'private') return;
    try {
      const res = await fetch(`${WS_BASE}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'getMessages', conversation_id: conversationId, user_id: userId, access_token: accessToken }),
      });
      const d = await res.json();
      if (d.success) { setMessages(d.messages ?? []); scrollToEnd(); }
    } catch {} finally { setLoading(false); }
  };

  const markAsRead = async () => {
    if (conversationType !== 'private') return;
    try {
      await fetch(`${WS_BASE}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'markAsRead', conversation_id: conversationId, user_id: userId, access_token: accessToken }),
      });
    } catch {}
  };

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Envoi message ──────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!input.trim() || sending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const content = input.trim();
    setInput('');
    setSending(true);

    // Arret indicateur de frappe
    if (conversationType === 'private' && isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit('typing', { is_typing: false });
    }

    if (conversationType === 'private') {
      socketRef.current?.emit('send_message', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
        content,
      });
    } else {
      socketRef.current?.emit('send_message', { content });
    }

    setSending(false);
    scrollToEnd();
  };

  // ── Frappe ─────────────────────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInput(text);
    if (conversationType !== 'private') return;

    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current?.emit('typing', { conversation_id: conversationId, user_id: userId, is_typing: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      socketRef.current?.emit('typing', { conversation_id: conversationId, user_id: userId, is_typing: false });
    }, 2000);
  };

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={S.container}>
      {/* Header */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        {conversationType === 'private' ? (
          <>
            <View style={S.avatar}>
              <Text style={S.avatarTxt}>{otherUser?.prenom.charAt(0)}{otherUser?.nom.charAt(0)}</Text>
              {otherOnline && <View style={S.onlineDot} />}
            </View>
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{otherUser?.prenom} {otherUser?.nom}</Text>
              <Text style={S.headerStatus}>
                {otherTyping ? "En train d'ecrire..." : otherOnline ? 'En ligne' : 'Hors ligne'}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[S.avatar, { backgroundColor: '#FF8C00' }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{groupName}</Text>
              <Text style={S.headerStatus}>{memberCount} membres</Text>
            </View>
          </>
        )}
      </LinearGradient>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={S.msgs} contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {loading
          ? <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
          : messages.length === 0
            ? <View style={{ alignItems: 'center', paddingVertical: 80 }}>
                <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 15 }}>Aucun message</Text>
                <Text style={{ fontSize: 14, color: '#999', marginTop: 5 }}>Commencez la conversation !</Text>
              </View>
            : messages.map(msg => (
              <View key={msg.id} style={[S.bubble, msg.isFromMe ? S.bubbleMe : S.bubbleThem]}>
                {!msg.isFromMe && conversationType === 'group' && (
                  <Text style={S.senderName}>{msg.senderName}</Text>
                )}
                <Text style={[S.msgText, msg.isFromMe ? S.msgTextMe : S.msgTextThem]}>{msg.content}</Text>
                <Text style={[S.msgTime, msg.isFromMe ? S.msgTimeMe : S.msgTimeThem]}>
                  {fmtTime(msg.createdAt)}{msg.isFromMe && msg.isRead && ' ✓✓'}
                </Text>
              </View>
            ))}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={S.inputWrap}>
          <TextInput
            style={S.input}
            placeholder="Ecrivez un message..."
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
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F5F5' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, paddingHorizontal: 15 },
  backBtn:      { marginRight: 12, padding: 5 },
  avatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarTxt:    { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  onlineDot:    { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff', bottom: 2, right: 2 },
  headerInfo:   { flex: 1, marginLeft: 10 },
  headerName:   { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerStatus: { fontSize: 12, color: '#E0D0FF', marginTop: 2 },
  msgs:         { flex: 1 },
  bubble:       { maxWidth: '75%', padding: 12, borderRadius: 18, marginBottom: 8 },
  bubbleMe:     { alignSelf: 'flex-end', backgroundColor: '#8A2BE2', borderBottomRightRadius: 4 },
  bubbleThem:   { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  senderName:   { fontSize: 11, fontWeight: '600', color: '#8A2BE2', marginBottom: 4 },
  msgText:      { fontSize: 15, lineHeight: 20 },
  msgTextMe:    { color: '#fff' },
  msgTextThem:  { color: '#333' },
  msgTime:      { fontSize: 10, marginTop: 4 },
  msgTimeMe:    { color: '#E0D0FF', textAlign: 'right' },
  msgTimeThem:  { color: '#999' },
  inputWrap:    { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 10, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  input:        { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 10 },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
});
