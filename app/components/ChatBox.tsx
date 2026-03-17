// ChatBox.tsx — v5 (correction socket zombie + gestion token)
// Messagerie temps reel via Socket.IO Render

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
import { getValidToken }  from '../utils/tokenManager'; // adapte le chemin

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
  userId:           string;                // toujours nécessaire pour identifier l'utilisateur
  otherUser?: { id: string; nom: string; prenom: string; avatar_url: string | null; isOnline?: boolean };
  groupName?:   string;
  memberCount?: number;
  onBack:       () => void;
  onNewMessage?: () => void;
}

export default function ChatBox({
  conversationId, conversationType, userId,
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

  // ── Détermine si l'animation de scroll est autorisée (pas sur le Web) ──
  const canAnimateScroll = Platform.OS !== 'web';

  // ── Fonction pour scroll en fin avec animation conditionnelle ──
  const scrollToEnd = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: canAnimateScroll });
    }, 100);
  };

  // ── Initialisation du socket ───────────────────────────────────────────────
  useEffect(() => {
    // Variable locale pour capturer le socket dans la closure de nettoyage
    let socket: Socket | null = null;

    const initSocket = async () => {
      // Selon le type, on choisit le namespace
      const namespace = conversationType === 'private' ? '/private-chat' : '/group-chat';
      socket = io(`${WS_BASE}${namespace}`, {
        transports: ['websocket'],
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on('connect', async () => {
        console.log(`[ChatBox] Socket ${namespace} connecté`);
        // Récupérer un token valide pour rejoindre la conversation
        const token = await getValidToken();
        if (conversationType === 'private') {
          socket?.emit('join_conversation', {
            conversation_id: conversationId,
            user_id: userId,
            access_token: token,
          });
        } else {
          socket?.emit('join_group', {
            group_id: conversationId,
            user_id: userId,
            access_token: token,
          });
        }
      });

      // Gestionnaires communs
      socket.on('joined', (data: { messages?: Message[] }) => {
        console.log('[ChatBox] Rejoint conversation');
        if (data.messages) {
          setMessages(data.messages);
          setLoading(false);
          scrollToEnd();
        }
      });

      socket.on('new_message', (msg: Message) => {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderId !== userId) {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onNewMessage?.();
        }
        scrollToEnd();
      });

      socket.on('message_sent', (data: { message: Message }) => {
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        scrollToEnd();
        setSending(false);
      });

      // Spécifique privé
      if (conversationType === 'private') {
        socket.on('typing_status', (data: { user_id: string; is_typing: boolean }) => {
          if (data.user_id !== userId) setOtherTyping(data.is_typing);
        });
      }

      socket.on('error', (err: { message: string }) => {
        console.warn('[ChatBox] Erreur socket:', err.message);
      });

      socket.on('disconnect', () => console.log('[ChatBox] Socket déconnecté'));
    };

    initSocket();

    // Nettoyage : utilise la variable locale `socket` pour éviter les références périmées
    return () => {
      if (socket) {
        socket.removeAllListeners(); // vide tous les écouteurs
        socket.disconnect();
      }
      socketRef.current = null;
      clearTimeout(typingTimer.current);
    };
  }, [conversationId, conversationType, userId]); // userId ne change pas souvent, mais si l'utilisateur change, on recrée

  // ── Envoi de message ───────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const content = input.trim();
    setInput('');
    setSending(true);

    // Arrêt de l'indicateur de frappe si en privé
    if (conversationType === 'private' && isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit('typing', { is_typing: false });
    }

    try {
      const token = await getValidToken();
      if (conversationType === 'private') {
        socketRef.current?.emit('send_message', {
          conversation_id: conversationId,
          user_id: userId,
          access_token: token,
          content,
        });
      } else {
        socketRef.current?.emit('send_message', {
          group_id: conversationId,
          user_id: userId,
          access_token: token,
          content,
        });
      }
    } catch (error) {
      console.error('[ChatBox] Erreur envoi message:', error);
      setSending(false);
      // Optionnel : afficher une notification à l'utilisateur
    }

    // Ne pas remettre sending à false ici, car on attend l'ack `message_sent`
  };

  // ── Gestion de la frappe ───────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInput(text);
    if (conversationType !== 'private') return;

    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current?.emit('typing', {
        conversation_id: conversationId,
        user_id: userId,
        is_typing: true,
      });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socketRef.current?.emit('typing', {
          conversation_id: conversationId,
          user_id: userId,
          is_typing: false,
        });
      }
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
        onContentSizeChange={scrollToEnd} // appelle scrollToEnd après chaque changement de contenu
      >
        {loading ? (
          <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
        ) : messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 15 }}>Aucun message</Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 5 }}>Commencez la conversation !</Text>
          </View>
        ) : (
          messages.map(msg => (
            <View key={msg.id} style={[S.bubble, msg.isFromMe ? S.bubbleMe : S.bubbleThem]}>
              {!msg.isFromMe && conversationType === 'group' && (
                <Text style={S.senderName}>{msg.senderName}</Text>
              )}
              <Text style={[S.msgText, msg.isFromMe ? S.msgTextMe : S.msgTextThem]}>{msg.content}</Text>
              <Text style={[S.msgTime, msg.isFromMe ? S.msgTimeMe : S.msgTimeThem]}>
                {fmtTime(msg.createdAt)}{msg.isFromMe && msg.isRead && ' ✓✓'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Input */}
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
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
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
