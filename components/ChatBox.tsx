// ChatBox.tsx — v7
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView, Modal, Image,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics       from 'expo-haptics';
import * as ImagePicker   from 'expo-image-picker';
import { io, Socket }     from 'socket.io-client';

const WS_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplyTo {
  id:            string;
  sender_id:     string;
  content:       string | null;
  sender_nom:    string;
  sender_prenom: string;
}

interface Message {
  id:               string;
  content:          string | null;
  media_url:        string | null;
  senderId:         string;
  isFromMe:         boolean;
  senderName:       string;
  senderAvatar:     string | null;
  createdAt:        string;
  isRead?:          boolean;
  deletedAt?:       string | null;
  reply_to_id?:     string | null;
  is_visible?:      boolean;
  is_private_reply?: boolean;
  replyTo?:         ReplyTo | null;
}

interface ChatBoxProps {
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
  groupName?:      string;
  memberCount?:    number;
  onBack:          () => void;
  onNewMessage?:   () => void;
  onProfilePress?: (userId: string) => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ChatBox({
  conversationId, conversationType, userId, userName = 'Moi',
  userRole = 'user', accessToken,
  otherUser, groupName, memberCount,
  onBack, onNewMessage, onProfilePress,
}: ChatBoxProps) {

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [otherTyping,    setOtherTyping]    = useState(false);
  const [otherOnline,    setOtherOnline]    = useState(otherUser?.isOnline ?? false);
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [currentRole,    setCurrentRole]    = useState(userRole);

  // Réponse en cours
  const [replyingTo,     setReplyingTo]     = useState<Message | null>(null);

  // Action sheet (appui long)
  const [actionMsg,      setActionMsg]      = useState<Message | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const scrollRef    = useRef<ScrollView>(null);
  const socketRef    = useRef<Socket | null>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef  = useRef(false);
  // Double tap
  const lastTapRef   = useRef<{ id: string; time: number } | null>(null);

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

  // ── Socket privé ────────────────────────────────────────────────────────────

  const buildPrivateSocket = (): Socket => {
    const socket = io(`${WS_BASE}/private-chat`, { transports: ['websocket'], reconnectionDelay: 2000 });

    socket.on('connect', () => {
      socket.emit('join_conversation', { conversation_id: conversationId, user_id: userId, access_token: accessToken });
    });
    socket.on('joined', (data: { messages: Message[]; has_more: boolean }) => {
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
      if (msg.senderId !== userId && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    socket.on('error', (err: { message: string }) => { console.warn('[ChatBox] privé erreur:', err.message); setSending(false); });
    return socket;
  };

  // ── Socket groupe ────────────────────────────────────────────────────────────

  const buildGroupSocket = (): Socket => {
    const socket = io(`${WS_BASE}/group-chat`, { transports: ['websocket'], reconnectionDelay: 2000 });

    socket.on('connect', () => {
      socket.emit('join_group', { group_id: conversationId, user_id: userId, access_token: accessToken });
    });

    socket.on('joined', (data: { messages: Message[]; group: any; members: any[] }) => {
      const msgs = data?.messages ?? [];
      setMessages(msgs.map(normalizeMsg));
      setHasMore(msgs.length >= 10);
      // Récupérer le rôle du user courant depuis la liste des membres
      const me = (data.members ?? []).find((m: any) => m.user_id === userId);
      if (me?.role) setCurrentRole(me.role);
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
      if (msg.senderId !== userId && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

    socket.on('message_deleted', (data: { message_id: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id
          ? { ...m, content: null, media_url: null, deletedAt: new Date().toISOString() }
          : m
      ));
    });

    socket.on('visibility_changed', (data: { message_id: string; is_visible: boolean }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, is_visible: data.is_visible } : m
      ));
    });

    socket.on('error', (err: { message: string }) => { console.warn('[ChatBox] groupe erreur:', err.message); setSending(false); });
    return socket;
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const key = conversationType === 'private' ? 'conversation_id' : 'group_id';
    socketRef.current?.emit('load_more', {
      [key]:        conversationId,
      user_id:      userId,
      access_token: accessToken,
      before:       messages[0]?.createdAt,
    });
  };

  const sendMessage = (mediaUrl?: string, mediaType?: string) => {
    const content = input.trim();
    if (!content && !mediaUrl) return;
    if (sending) return;

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInput('');
    setSending(true);

    const reply = replyingTo;
    setReplyingTo(null);

    // Stopper le typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emitTyping(false);
    }

    if (conversationType === 'private') {
      socketRef.current?.emit('send_message', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
        content,
      });
    } else {
      socketRef.current?.emit('send_message', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
        content:      content || null,
        type:         mediaType ?? 'text',
        media_url:    mediaUrl  ?? null,
        reply_to_id:  reply?.id ?? null,
        is_visible:   true,
      });
    }
    scrollToEnd();
  };

  const emitTyping = (is_typing: boolean) => {
    if (conversationType === 'private') {
      socketRef.current?.emit('typing', { conversation_id: conversationId, user_id: userId, is_typing });
    } else {
      socketRef.current?.emit('typing', { group_id: conversationId, user_id: userId, user_name: userName, is_typing });
    }
  };

  const handleTyping = (text: string) => {
    setInput(text);
    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      emitTyping(false);
    }, 2000);
  };

  const deleteMessage = (msg: Message) => {
    socketRef.current?.emit('delete_message', {
      message_id:   msg.id,
      user_id:      userId,
      access_token: accessToken,
    });
  };

  const toggleVisibility = (msg: Message) => {
    if (conversationType !== 'group') return;
    socketRef.current?.emit('toggle_visibility', {
      message_id:   msg.id,
      user_id:      userId,
      access_token: accessToken,
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Interactions sur les bulles ──────────────────────────────────────────────

  const handleLongPress = (msg: Message) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionMsg(msg);
    setShowActionSheet(true);
  };

  const handleTap = (msg: Message) => {
    // Double tap → toggle visibilité (auteur d'une réponse uniquement)
    if (conversationType !== 'group') return;
    const now  = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === msg.id && now - last.time < 350) {
      lastTapRef.current = null;
      if (msg.senderId === userId && msg.reply_to_id) {
        toggleVisibility(msg);
      }
    } else {
      lastTapRef.current = { id: msg.id, time: now };
    }
  };

  // ── Upload media (userpro) ───────────────────────────────────────────────────

  const pickAndUploadMedia = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        alert('Permission requise pour accéder à la galerie');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        base64:     true,
        quality:    0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset     = result.assets[0];
      const base64    = asset.base64;
      const uri       = asset.uri;
      const mimeType  = asset.mimeType ?? (uri.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      const fileName  = uri.split('/').pop() ?? `media_${Date.now()}`;

      if (!base64) { alert('Impossible de lire le fichier'); return; }

      setUploading(true);

      const res  = await fetch(`${WS_BASE}/media`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id:     userId,
          access_token: accessToken,
          file_base64: base64,
          file_name:   fileName,
          file_type:   mimeType,
          context:     'media-premium',
        }),
      });

      const data = await res.json();
      setUploading(false);

      if (!data.success) {
        alert(data.error ?? 'Erreur upload');
        return;
      }

      const mediaType = mimeType.startsWith('video') ? 'video' : 'image';
      sendMessage(data.url, mediaType);

    } catch (err) {
      setUploading(false);
      console.error('[ChatBox] upload erreur:', err);
      alert('Erreur lors de l\'upload');
    }
  };

  // ── Normalisation message ────────────────────────────────────────────────────

  const normalizeMsg = (msg: any): Message => ({
    id:               msg.id,
    content:          msg.content      ?? msg.text       ?? null,
    media_url:        msg.media_url    ?? msg.mediaUrl   ?? null,
    senderId:         msg.senderId     ?? msg.sender_id  ?? '',
    isFromMe:         msg.isFromMe     ?? msg.is_from_me ?? false,
    senderName:       msg.senderName   ?? msg.sender_name ?? (msg.sender ? `${msg.sender.prenom} ${msg.sender.nom}` : ''),
    senderAvatar:     msg.senderAvatar ?? msg.sender?.avatar_url ?? null,
    createdAt:        msg.createdAt    ?? msg.created_at ?? null,
    isRead:           msg.isRead       ?? msg.is_read    ?? false,
    deletedAt:        msg.deletedAt    ?? msg.deleted_at ?? null,
    reply_to_id:      msg.reply_to_id  ?? null,
    is_visible:       msg.is_visible   ?? true,
    is_private_reply: msg.is_private_reply ?? false,
    replyTo:          msg.reply_to     ?? msg.replyTo    ?? null,
  });

  const fmtTime = (value: string | null | undefined): string => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isAuthor = (msg: Message) => msg.senderId === userId;

  // ── Rendu bulle ──────────────────────────────────────────────────────────────

  const renderBubble = (msg: Message) => {
    const fromMe   = msg.isFromMe;
    const deleted  = !!msg.deletedAt;
    const isGroup  = conversationType === 'group';

    return (
      <TouchableOpacity
        key={msg.id}
        activeOpacity={0.85}
        onPress={() => handleTap(msg)}
        onLongPress={() => handleLongPress(msg)}
        style={[S.bubble, fromMe ? S.bubbleMe : S.bubbleThem]}
      >
        {/* Nom de l'expéditeur (groupe uniquement) */}
        {!fromMe && isGroup && !deleted && (
          <Text style={S.senderName}>{msg.senderName}</Text>
        )}

        {/* Citation de la réponse */}
        {msg.replyTo && !deleted && (
          <View style={[S.replyBlock, fromMe ? S.replyBlockMe : S.replyBlockThem]}>
            <Text style={S.replyAuthor} numberOfLines={1}>
              {msg.replyTo.sender_prenom} {msg.replyTo.sender_nom}
            </Text>
            <Text style={S.replyContent} numberOfLines={2}>
              {msg.replyTo.content ?? 'Message supprimé'}
            </Text>
          </View>
        )}

        {/* Contenu principal */}
        {deleted ? (
          <Text style={[S.msgText, S.msgDeleted]}>Message supprimé</Text>
        ) : msg.is_private_reply ? (
          <View style={S.privateReplyWrap}>
            <Ionicons name="lock-closed" size={12} color={fromMe ? '#E0D0FF' : '#999'} />
            <Text style={[S.msgText, fromMe ? S.msgTextMe : S.msgTextThem, { fontStyle: 'italic', marginLeft: 4 }]}>
              Réponse privée
            </Text>
          </View>
        ) : msg.media_url ? (
          <Image
            source={{ uri: msg.media_url }}
            style={S.mediaImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={[S.msgText, fromMe ? S.msgTextMe : S.msgTextThem]}>
            {msg.content}
          </Text>
        )}

        {/* Footer : heure + badge visibilité */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
          {/* Badge visibilité pour les réponses de l'auteur */}
          {isGroup && isAuthor(msg) && msg.reply_to_id && !deleted && (
            <Ionicons
              name={msg.is_visible ? 'eye-outline' : 'eye-off-outline'}
              size={11}
              color={fromMe ? '#E0D0FF' : '#aaa'}
            />
          )}
          <Text style={[S.msgTime, fromMe ? S.msgTimeMe : S.msgTimeThem]}>
            {fmtTime(msg.createdAt)}{fromMe && msg.isRead ? ' ✓✓' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

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
            {onProfilePress && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />}
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

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={S.msgs}
        contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
      >
        {hasMore && !loading && (
          <TouchableOpacity
            onPress={loadMore}
            disabled={loadingMore}
            style={S.loadMoreBtn}
          >
            {loadingMore
              ? <Text style={S.loadMoreTxt}>Chargement des données</Text>
              : <><Ionicons name="chevron-up" size={16} color="#8A2BE2" /><Text style={S.loadMoreTxt}>Voir les messages précédents</Text></>
            }
          </TouchableOpacity>
        )}

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
        ) : messages.map(msg => renderBubble(msg))}
      </ScrollView>

      {/* ── Barre de réponse ────────────────────────────────────────────── */}
      {replyingTo && (
        <View style={S.replyBar}>
          <View style={S.replyBarContent}>
            <Ionicons name="return-down-forward" size={14} color="#8A2BE2" style={{ marginRight: 6 }} />
            <View style={{ flex: 1 }}>
              <Text style={S.replyBarAuthor} numberOfLines={1}>
                {replyingTo.senderName}
              </Text>
              <Text style={S.replyBarText} numberOfLines={1}>
                {replyingTo.content ?? 'Message supprimé'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 6 }}>
            <Ionicons name="close" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Saisie ──────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={S.inputWrap}>
          {/* Bouton media — userpro uniquement en groupe */}
          {conversationType === 'group' && currentRole === 'userpro' && (
            <TouchableOpacity
              style={S.mediaBtn}
              onPress={pickAndUploadMedia}
              disabled={uploading || sending}
              activeOpacity={0.7}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#8A2BE2" />
                : <Ionicons name="image-outline" size={24} color="#8A2BE2" />
              }
            </TouchableOpacity>
          )}

          <TextInput
            style={S.input}
            placeholder="Écrivez un message..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
            editable={!sending && !uploading}
          />

          <TouchableOpacity
            style={[S.sendBtn, (!input.trim() || sending) && S.sendBtnDisabled]}
            onPress={() => sendMessage()}
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

      {/* ── Action sheet ────────────────────────────────────────────────── */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <TouchableOpacity
          style={S.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <View style={S.actionSheet}>
            {actionMsg && (
              <>
                {/* Répondre — toujours disponible en groupe */}
                {conversationType === 'group' && !actionMsg.deletedAt && !actionMsg.is_private_reply && (
                  <TouchableOpacity
                    style={S.actionItem}
                    onPress={() => {
                      setReplyingTo(actionMsg);
                      setShowActionSheet(false);
                    }}
                  >
                    <Ionicons name="return-down-forward-outline" size={20} color="#8A2BE2" />
                    <Text style={[S.actionTxt, { color: '#8A2BE2' }]}>Répondre</Text>
                  </TouchableOpacity>
                )}

                {/* Modifier visibilité — auteur d'une réponse uniquement */}
                {conversationType === 'group' && isAuthor(actionMsg) && actionMsg.reply_to_id && !actionMsg.deletedAt && (
                  <TouchableOpacity
                    style={S.actionItem}
                    onPress={() => {
                      toggleVisibility(actionMsg);
                      setShowActionSheet(false);
                    }}
                  >
                    <Ionicons
                      name={actionMsg.is_visible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#555"
                    />
                    <Text style={S.actionTxt}>
                      {actionMsg.is_visible ? 'Rendre privé' : 'Rendre visible'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Supprimer — auteur uniquement */}
                {isAuthor(actionMsg) && !actionMsg.deletedAt && (
                  <TouchableOpacity
                    style={S.actionItem}
                    onPress={() => {
                      deleteMessage(actionMsg);
                      setShowActionSheet(false);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                    <Text style={[S.actionTxt, { color: '#DC2626' }]}>Supprimer</Text>
                  </TouchableOpacity>
                )}

                <View style={S.actionDivider} />
                <TouchableOpacity style={S.actionItem} onPress={() => setShowActionSheet(false)}>
                  <Text style={[S.actionTxt, { textAlign: 'center', color: '#999' }]}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  loadMoreBtn:     { alignSelf: 'center', marginBottom: 12, marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F0E8FF', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadMoreTxt:     { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  bubble:          { maxWidth: '78%', padding: 12, borderRadius: 18, marginBottom: 8 },
  bubbleMe:        { alignSelf: 'flex-end', backgroundColor: '#8A2BE2', borderBottomRightRadius: 4 },
  bubbleThem:      { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  senderName:      { fontSize: 11, fontWeight: '600', color: '#8A2BE2', marginBottom: 4 },
  // Citation (reply)
  replyBlock:      { borderRadius: 8, padding: 8, marginBottom: 6 },
  replyBlockMe:    { backgroundColor: 'rgba(255,255,255,0.15)' },
  replyBlockThem:  { backgroundColor: '#F0E8FF' },
  replyAuthor:     { fontSize: 11, fontWeight: '700', color: '#8A2BE2', marginBottom: 2 },
  replyContent:    { fontSize: 12, color: '#555' },
  // Contenu message
  msgText:         { fontSize: 15, lineHeight: 20 },
  msgTextMe:       { color: '#fff' },
  msgTextThem:     { color: '#333' },
  msgDeleted:      { color: '#aaa', fontStyle: 'italic' },
  msgTime:         { fontSize: 10 },
  msgTimeMe:       { color: '#E0D0FF', textAlign: 'right' },
  msgTimeThem:     { color: '#999' },
  privateReplyWrap:{ flexDirection: 'row', alignItems: 'center' },
  mediaImage:      { width: 200, height: 150, borderRadius: 8 },
  // Barre réponse
  replyBar:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0E8FF', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  replyBarContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBarAuthor:  { fontSize: 12, fontWeight: '700', color: '#8A2BE2' },
  replyBarText:    { fontSize: 12, color: '#666', marginTop: 1 },
  // Saisie
  inputWrap:       { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 10, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  mediaBtn:        { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  input:           { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 8 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  // Action sheet
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 30 : 16, paddingTop: 8 },
  actionItem:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  actionTxt:       { fontSize: 16, color: '#333', fontWeight: '500' },
  actionDivider:   { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16, marginVertical: 4 },
});
