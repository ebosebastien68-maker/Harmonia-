// ChatBox.tsx — v5
// Messagerie temps réel via Socket.IO Render
// Privé  : socket /private-chat
// Groupe : socket /group-chat
//
// Corrections appliquées (consigne) :
//  1. Socket Zombie     → variable locale const socket dans useEffect
//                         + ref assigné en parallèle
//                         → cleanup utilise la variable locale (jamais null)
//  2. Accumulation      → socket.removeAllListeners() avant socket.disconnect()
//  3. Animation Web     → scrollToEnd désactive animated sur Platform.OS === 'web'
//  4. Dépendances effet → [conversationId, accessToken]
//  5. Invalid Date      → fmtTime protégé contre valeur null/invalide

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

// ── Types ──────────────────────────────────────────────────────────────────────

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
  accessToken:      string;
  otherUser?: {
    id: string; nom: string; prenom: string;
    avatar_url: string | null; isOnline?: boolean;
  };
  groupName?:    string;
  memberCount?:  number;
  onBack:        () => void;
  onNewMessage?: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ChatBox({
  conversationId, conversationType, userId, accessToken,
  otherUser, groupName, memberCount, onBack, onNewMessage,
}: ChatBoxProps) {

  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(otherUser?.isOnline ?? false);

  const scrollRef   = useRef<ScrollView>(null);
  const socketRef   = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ── useEffect principal ────────────────────────────────────────────────────
  //
  // CORRECTION 1 — Socket Zombie :
  //   On crée le socket dans une variable locale `socket`.
  //   Cette variable est "enfermée" (closure) dans l'effet courant.
  //   Le cleanup du return utilise cette variable locale, qui ne sera
  //   JAMAIS null au moment du nettoyage, même si socketRef.current
  //   a été remplacé entre-temps par un autre rendu.
  //
  // CORRECTION 4 — Dépendances :
  //   [conversationId, accessToken] → l'effet se relance si le token change
  //   (ex: après un refresh dans MessagesScreen).

  useEffect(() => {
    // Variable locale — garantit un cleanup propre
    const socket =
      conversationType === 'private'
        ? buildPrivateSocket()
        : buildGroupSocket();

    // On assigne aussi au ref pour que sendMessage/handleTyping puissent l'utiliser
    socketRef.current = socket;

    return () => {
      // CORRECTION 2 — Accumulation de listeners :
      //   removeAllListeners() d'abord → le socket devient totalement silencieux
      //   avant d'être fermé. Plus aucun event ne peut déclencher un setState
      //   sur un composant en cours de démontage.
      socket.removeAllListeners();
      socket.disconnect();

      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, accessToken]);

  // ── Construction socket privé ──────────────────────────────────────────────

  const buildPrivateSocket = (): Socket => {
    const socket = io(`${WS_BASE}/private-chat`, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[ChatBox] Socket privé connecté');
      socket.emit('join_conversation', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
      });
    });

    socket.on('joined', (data: { conversation_id: string; messages: Message[] }) => {
      console.log('[ChatBox] Rejoint la conversation privée');
      setMessages((data.messages ?? []).map(normalizeMsg));
      setLoading(false);
      scrollToEnd();
    });

    socket.on('message_sent', (data: { message: Message }) => {
      const msg = normalizeMsg(data.message);
      setMessages(prev =>
        prev.find(m => m.id === msg.id) ? prev : [...prev, msg]
      );
      setSending(false);
      scrollToEnd();
    });

    socket.on('new_message', (raw: any) => {
      const msg = normalizeMsg(raw);
      setMessages(prev =>
        prev.find(m => m.id === msg.id) ? prev : [...prev, msg]
      );
      if (msg.senderId !== userId) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onNewMessage?.();
      }
      scrollToEnd();
    });

    socket.on('typing_status', (data: { user_id: string; is_typing: boolean }) => {
      if (data.user_id !== userId) setOtherTyping(data.is_typing);
    });

    socket.on('error', (err: { message: string }) => {
      console.warn('[ChatBox] Erreur socket privé :', err.message);
      setSending(false);
    });

    socket.on('disconnect', () => console.log('[ChatBox] Socket privé déconnecté'));

    return socket;
  };

  // ── Construction socket groupe ─────────────────────────────────────────────

  const buildGroupSocket = (): Socket => {
    const socket = io(`${WS_BASE}/group-chat`, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[ChatBox] Socket groupe connecté');
      socket.emit('join_group', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
      });
    });

    socket.on('joined', (data: { messages: Message[]; group: any }) => {
      if (data?.messages) {
        setMessages(data.messages.map(normalizeMsg));
        setLoading(false);
        scrollToEnd();
      }
    });

    socket.on('new_message', (raw: any) => {
      const msg = normalizeMsg(raw);
      setMessages(prev =>
        prev.find(m => m.id === msg.id) ? prev : [...prev, msg]
      );
      if (msg.senderId !== userId && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onNewMessage?.();
      scrollToEnd();
    });

    socket.on('error',      (err: { message: string }) => console.warn('[ChatBox] Groupe erreur :', err.message));
    socket.on('disconnect', () => console.log('[ChatBox] Socket groupe déconnecté'));

    return socket;
  };

  // ── Scroll ─────────────────────────────────────────────────────────────────
  //
  // Web    → animated: false  (useNativeDriver non supporté sur navigateur)
  // Mobile → animated: true   (scroll fluide sur iOS / Android)

  const scrollToEnd = () => {
    const shouldAnimate = Platform.OS === 'web' ? false : true;
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: shouldAnimate }), 100);
  };

  // ── Envoi de message ───────────────────────────────────────────────────────

  const sendMessage = () => {
    if (!input.trim() || sending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const content = input.trim();
    setInput('');
    setSending(true);

    // Arrêt indicateur de frappe
    if (conversationType === 'private' && isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit('typing', {
        conversation_id: conversationId,
        user_id:         userId,
        is_typing:       false,
      });
    }

    if (conversationType === 'private') {
      socketRef.current?.emit('send_message', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
        content,
      });
      // setSending(false) est géré par l'event 'message_sent'
    } else {
      socketRef.current?.emit('send_message', { content });
      setSending(false); // pas d'accusé côté groupe
    }

    scrollToEnd();
  };

  // ── Indicateur de frappe ───────────────────────────────────────────────────

  const handleTyping = (text: string) => {
    setInput(text);
    if (conversationType !== 'private') return;

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
  };

  // ── Formatage heure ────────────────────────────────────────────────────────
  //
  // Normalise les deux formats possibles venant du socket :
  //   - camelCase : msg.createdAt  (format interne React)
  //   - snake_case: msg.created_at (format brut Supabase/backend)
  // Guard complet : null, undefined, chaîne vide, timestamp invalide → ''

  const fmtTime = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Normalise un message brut du socket pour garantir le champ createdAt
  const normalizeMsg = (msg: any): Message => ({
    ...msg,
    createdAt: msg.createdAt ?? msg.created_at ?? null,
  });

  // ── Rendu ──────────────────────────────────────────────────────────────────

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
              <Text style={S.avatarTxt}>
                {otherUser?.prenom.charAt(0)}{otherUser?.nom.charAt(0)}
              </Text>
              {otherOnline && <View style={S.onlineDot} />}
            </View>
            <View style={S.headerInfo}>
              <Text style={S.headerName}>{otherUser?.prenom} {otherUser?.nom}</Text>
              <Text style={S.headerStatus}>
                {otherTyping ? "En train d'écrire..." : otherOnline ? 'En ligne' : 'Hors ligne'}
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
      <ScrollView
        ref={scrollRef}
        style={S.msgs}
        contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({
            animated: Platform.OS === 'web' ? false : true,
          })
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
        ) : messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 15 }}>
              Aucun message
            </Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 5 }}>
              Commencez la conversation !
            </Text>
          </View>
        ) : (
          messages.map(msg => (
            <View key={msg.id} style={[S.bubble, msg.isFromMe ? S.bubbleMe : S.bubbleThem]}>
              {!msg.isFromMe && conversationType === 'group' && (
                <Text style={S.senderName}>{msg.senderName}</Text>
              )}
              <Text style={[S.msgText, msg.isFromMe ? S.msgTextMe : S.msgTextThem]}>
                {msg.content}
              </Text>
              <Text style={[S.msgTime, msg.isFromMe ? S.msgTimeMe : S.msgTimeThem]}>
                {fmtTime(msg.createdAt)}{msg.isFromMe && msg.isRead ? ' ✓✓' : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Zone de saisie */}
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
              : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  header:          {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 15, paddingHorizontal: 15,
  },
  backBtn:         { marginRight: 12, padding: 5 },
  avatar:          {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  avatarTxt:       { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  onlineDot:       {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff',
    bottom: 2, right: 2,
  },
  headerInfo:      { flex: 1, marginLeft: 10 },
  headerName:      { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerStatus:    { fontSize: 12, color: '#E0D0FF', marginTop: 2 },
  msgs:            { flex: 1 },
  bubble:          { maxWidth: '75%', padding: 12, borderRadius: 18, marginBottom: 8 },
  bubbleMe:        { alignSelf: 'flex-end', backgroundColor: '#8A2BE2', borderBottomRightRadius: 4 },
  bubbleThem:      {
    alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  senderName:      { fontSize: 11, fontWeight: '600', color: '#8A2BE2', marginBottom: 4 },
  msgText:         { fontSize: 15, lineHeight: 20 },
  msgTextMe:       { color: '#fff' },
  msgTextThem:     { color: '#333' },
  msgTime:         { fontSize: 10, marginTop: 4 },
  msgTimeMe:       { color: '#E0D0FF', textAlign: 'right' },
  msgTimeThem:     { color: '#999' },
  inputWrap:       {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  input:           {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, marginRight: 10,
  },
  sendBtn:         {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
});
