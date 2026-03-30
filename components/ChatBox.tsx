// ChatBox.tsx — v9 (fix: new_message fallback confirmation)
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  Web    → sendMessage V8 : emit direct, state `sending`, pas de pending │
// │  Mobile → sendMessage V11 : optimistic UI, retries, ⏳ / ✔️             │
// │  Fix    → new_message utilisé comme fallback si message_sent échoue     │
// │  Upload → uploadBinaryFile conditionné (blob web / FileSystem mobile)   │
// └─────────────────────────────────────────────────────────────────────────┘

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView, Modal, Image, Dimensions,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics       from 'expo-haptics';
import * as ImagePicker   from 'expo-image-picker';
import { io, Socket }     from 'socket.io-client';

// expo-file-system chargé uniquement sur mobile (module inexistant sur web)
const FileSystem: any = Platform.OS !== 'web'
  ? require('expo-file-system')
  : undefined;

const WS_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

const RETRY_INTERVAL_MS = 5_000;
const RETRY_MAX_MS      = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplyTo {
  id:            string;
  sender_id:     string;
  content:       string | null;
  sender_nom:    string;
  sender_prenom: string;
}

interface Message {
  id:                string;
  content:           string | null;
  media_url:         string | null;
  senderId:          string;
  isFromMe:          boolean;
  senderName:        string;
  senderAvatar:      string | null;
  createdAt:         string;
  isRead?:           boolean;
  deletedAt?:        string | null;
  reply_to_id?:      string | null;
  is_visible?:       boolean;
  is_private_reply?: boolean;
  replyTo?:          ReplyTo | null;
  mediaType?:        string | null;
  status?: 'sending' | 'sent' | 'failed';
}

interface ChatBoxProps {
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
  groupName?:      string;
  memberCount?:    number;
  onBack:          () => void;
  onNewMessage?:   () => void;
  onProfilePress?: (userId: string) => void;
}

// ─── Helpers media ────────────────────────────────────────────────────────────

function detectMediaType(mimeType: string, fileName: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/'))  return 'image';
  if (mime.startsWith('video/'))  return 'video';
  if (mime.startsWith('audio/'))  return 'audio';
  if (
    mime === 'application/pdf' ||
    mime.includes('word') || mime.includes('excel') ||
    mime.includes('powerpoint') || mime.includes('spreadsheet') ||
    mime.includes('presentation') || mime === 'text/plain' ||
    mime === 'text/csv'
  ) return 'document';

  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','webp','gif','bmp','tiff','svg','heic','heif'].includes(ext)) return 'image';
  if (['mp4','mov','webm','avi','mkv','m4v','3gp'].includes(ext))                        return 'video';
  if (['mp3','aac','wav','ogg','m4a','flac','opus','weba'].includes(ext))                return 'audio';
  if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext))          return 'document';
  return 'file';
}

function resolveMimeType(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
    ogg: 'audio/ogg', m4a: 'audio/x-m4a', flac: 'audio/flac',
    pdf: 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ─── Upload binaire conditionné web / mobile ──────────────────────────────────

async function uploadBinaryFile(
  signedUrl: string,
  localUri:  string,
  mimeType:  string,
): Promise<{ ok: boolean; status: number; errorText?: string }> {

  if (Platform.OS === 'web') {
    try {
      const fileBlob  = await fetch(localUri).then(r => r.blob());
      const uploadRes = await fetch(signedUrl, {
        method:  'PUT',
        headers: { 'Content-Type': mimeType },
        body:    fileBlob,
      });
      return {
        ok:        uploadRes.ok,
        status:    uploadRes.status,
        errorText: uploadRes.ok ? undefined : await uploadRes.text(),
      };
    } catch (err: any) {
      return { ok: false, status: 0, errorText: err?.message };
    }
  } else {
    try {
      const result = await FileSystem.uploadAsync(signedUrl, localUri, {
        httpMethod:  'PUT',
        headers:     { 'Content-Type': mimeType },
        uploadType:  FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      const ok = result.status >= 200 && result.status < 300;
      return { ok, status: result.status, errorText: ok ? undefined : result.body };
    } catch (err: any) {
      return { ok: false, status: 0, errorText: err?.message };
    }
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ChatBox({
  conversationId, conversationType, userId, userName = 'Moi',
  userRole = 'user', accessToken,
  otherUser, groupName, memberCount,
  onBack, onNewMessage, onProfilePress,
}: ChatBoxProps) {

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(true);
  const [sending,         setSending]         = useState(false); // web uniquement
  const [uploading,       setUploading]       = useState(false);
  const [otherTyping,     setOtherTyping]     = useState(false);
  const [otherOnline,     setOtherOnline]     = useState(otherUser?.isOnline ?? false);
  const [hasMore,         setHasMore]         = useState(false);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [currentRole,     setCurrentRole]     = useState(userRole);

  const [replyingTo,      setReplyingTo]      = useState<Message | null>(null);
  const [replyVisible,    setReplyVisible]    = useState(true);

  const [actionMsg,       setActionMsg]       = useState<Message | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const scrollRef   = useRef<ScrollView>(null);
  const socketRef   = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const pendingQueue    = useRef<string[]>([]);
  const retryTimers     = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const pendingPayloads = useRef<Map<string, object>>(new Map());

  const [fullscreenUrl,  setFullscreenUrl]  = useState<string | null>(null);
  const imgTapRef  = useRef<{ url: string; time: number } | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  // Web → websocket seul. Mobile → websocket + polling (fallback réseau 4G)
  const socketTransports = Platform.OS === 'web'
    ? ['websocket']
    : ['websocket', 'polling'];

  useEffect(() => {
    if (!accessToken) return;
    const socket = conversationType === 'private' ? buildPrivateSocket() : buildGroupSocket();
    socketRef.current = socket;
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (typingTimer.current) clearTimeout(typingTimer.current);
      retryTimers.current.forEach(t => clearInterval(t));
      retryTimers.current.clear();
      pendingQueue.current = [];
      pendingPayloads.current.clear();
    };
  }, [conversationId, accessToken]);

  // ── Confirmation optimiste (mobile) ───────────────────────────────────────
  //
  // Appelé depuis message_sent ET new_message (fallback).
  // Si double confirmation (message_sent + new_message tous les deux arrivent) :
  //   - 1er appel : pendingQueue.shift() → tempId trouvé, remplacement effectué
  //   - 2e appel : pendingQueue.shift() → undefined, vérification doublon par ID réel

  const confirmOptimistic = (raw: Message) => {
    const confirmed = { ...normalizeMsg(raw), status: 'sent' as const };
    const tempId    = pendingQueue.current.shift();

    if (tempId) {
      stopRetry(tempId);
      pendingPayloads.current.delete(tempId);
      setMessages(prev => prev.map(m => m.id === tempId ? confirmed : m));
    } else {
      // pendingQueue déjà vide → double confirmation, vérification doublon
      setMessages(prev => prev.find(m => m.id === confirmed.id) ? prev : [...prev, confirmed]);
    }
  };

  const stopRetry = (tempId: string) => {
    const timer = retryTimers.current.get(tempId);
    if (timer) { clearInterval(timer); retryTimers.current.delete(tempId); }
  };

  // ── Socket privé ────────────────────────────────────────────────────────────

  const buildPrivateSocket = (): Socket => {
    const socket = io(`${WS_BASE}/private-chat`, {
      transports:        socketTransports,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      socket.emit('join_conversation', {
        conversation_id: conversationId,
        user_id:         userId,
        access_token:    accessToken,
      });
    });

    socket.on('joined', (data: { messages: Message[]; has_more: boolean }) => {
      setMessages((data.messages ?? []).map(normalizeMsg));
      setHasMore(data.has_more ?? false);
      setLoading(false);
      scrollToEnd();
    });

    socket.on('message_sent', (data: { message: Message }) => {
      if (Platform.OS === 'web') {
        const msg = normalizeMsg(data.message);
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        setSending(false);
      } else {
        confirmOptimistic(data.message);
      }
      scrollToEnd();
    });

    socket.on('new_message', (raw: any) => {
      const msg = normalizeMsg(raw?.message ?? raw);

      // ── FIX clé ──────────────────────────────────────────────────────────
      // Sur mobile, si c'est notre propre message ET qu'on a des pending :
      // au lieu de jeter l'event, on l'utilise comme fallback de confirmation.
      // Cas d'usage : message_sent ne revient pas (ex. erreur serveur avant
      // l'émission, comme le crash du handler de push notification).
      if (Platform.OS !== 'web' && msg.senderId === userId && pendingQueue.current.length > 0) {
        console.log(
          `[ChatBox] ℹ️ Confirmation via new_message (fallback message_sent absent).\n` +
          `  ID serveur : ${msg.id} | pending restants : ${pendingQueue.current.length}`
        );
        confirmOptimistic(msg);
        scrollToEnd();
        return;
      }

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

    socket.on('error', (err: { message: string }) => {
      console.warn('[ChatBox] Erreur socket privé :', err.message);
      if (Platform.OS === 'web') setSending(false);
    });

    return socket;
  };

  // ── Socket groupe ────────────────────────────────────────────────────────────

  const buildGroupSocket = (): Socket => {
    const socket = io(`${WS_BASE}/group-chat`, {
      transports:        socketTransports,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      socket.emit('join_group', {
        group_id:     conversationId,
        user_id:      userId,
        access_token: accessToken,
      });
    });

    socket.on('joined', (data: { messages: Message[]; group: any; members: any[] }) => {
      const msgs = data?.messages ?? [];
      setMessages(msgs.map(normalizeMsg));
      setHasMore(msgs.length >= 10);
      const me = (data.members ?? []).find((m: any) => m.user_id === userId);
      if (me?.role) setCurrentRole(me.role);
      setLoading(false);
      scrollToEnd();
    });

    socket.on('message_sent', (data: { message: Message }) => {
      if (Platform.OS === 'web') {
        const msg = normalizeMsg(data.message);
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        setSending(false);
      } else {
        confirmOptimistic(data.message);
      }
      scrollToEnd();
    });

    socket.on('new_message', (raw: any) => {
      const msg = normalizeMsg(raw?.message ?? raw);

      // Même fallback que pour le socket privé
      if (Platform.OS !== 'web' && msg.senderId === userId && pendingQueue.current.length > 0) {
        console.log(
          `[ChatBox] ℹ️ Groupe — confirmation via new_message (fallback).\n` +
          `  ID serveur : ${msg.id} | pending restants : ${pendingQueue.current.length}`
        );
        confirmOptimistic(msg);
        scrollToEnd();
        return;
      }

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

    socket.on('error', (err: { message: string }) => {
      console.warn('[ChatBox] Erreur socket groupe :', err.message);
      if (Platform.OS === 'web') setSending(false);
    });

    return socket;
  };

  // ── Actions ───────────────────────────────────────────────────────────────────

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const key = conversationType === 'private' ? 'conversation_id' : 'group_id';
    socketRef.current?.emit('load_more', {
      [key]: conversationId, user_id: userId, access_token: accessToken,
      before: messages[0]?.createdAt,
    });
  };

  // ── Envoi conditionné par plateforme ──────────────────────────────────────────
  //
  // Web    (V8) : emit direct, `sending` state, spinner sur Send
  // Mobile (V11) : optimistic ⏳ immédiat + retries auto 5 s / 30 s max

  const sendMessage = (mediaUrl?: string, mediaType?: string) => {
    const content = input.trim();
    if (!content && !mediaUrl) return;

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInput('');

    const reply = replyingTo;
    setReplyingTo(null);

    if (isTypingRef.current) { isTypingRef.current = false; emitTyping(false); }

    const emitPayload = conversationType === 'private'
      ? { conversation_id: conversationId, user_id: userId, access_token: accessToken, content }
      : {
          group_id: conversationId, user_id: userId, access_token: accessToken,
          content:      content || null,
          type:         mediaType ?? 'text',
          media_url:    mediaUrl  ?? null,
          reply_to_id:  reply?.id ?? null,
          is_visible:   reply ? replyVisible : true,
        };

    // ── WEB (V8) ──────────────────────────────────────────────────────────
    if (Platform.OS === 'web') {
      setSending(true);
      socketRef.current?.emit('send_message', emitPayload);
      scrollToEnd();
      return;
    }

    // ── MOBILE (V11) ──────────────────────────────────────────────────────
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const optimisticMsg: Message = {
      id:               tempId,
      content:          content || null,
      media_url:        mediaUrl  ?? null,
      senderId:         userId,
      isFromMe:         true,
      senderName:       userName,
      senderAvatar:     null,
      createdAt:        new Date().toISOString(),
      isRead:           false,
      deletedAt:        null,
      reply_to_id:      reply?.id ?? null,
      is_visible:       reply ? replyVisible : true,
      is_private_reply: false,
      replyTo: reply ? {
        id:            reply.id,
        sender_id:     reply.senderId,
        content:       reply.content,
        sender_nom:    reply.senderName.split(' ').slice(1).join(' ') || reply.senderName,
        sender_prenom: reply.senderName.split(' ')[0] ?? '',
      } : null,
      mediaType: mediaType ?? null,
      status:    'sending',
    };

    setMessages(prev => [...prev, optimisticMsg]);
    pendingQueue.current.push(tempId);
    pendingPayloads.current.set(tempId, emitPayload);
    scrollToEnd();

    if (!socketRef.current?.connected) {
      console.warn(`[ChatBox] ⚠️ Envoi alors que le socket est déconnecté (${tempId})`);
    }
    socketRef.current?.emit('send_message', emitPayload);

    const startedAt = Date.now();
    const interval  = setInterval(() => {
      if (!pendingQueue.current.includes(tempId)) {
        clearInterval(interval); retryTimers.current.delete(tempId); return;
      }
      const elapsed     = Date.now() - startedAt;
      const socketState = socketRef.current?.connected ? 'connecté' : 'déconnecté';
      if (elapsed >= RETRY_MAX_MS) {
        clearInterval(interval); retryTimers.current.delete(tempId);
        pendingQueue.current = pendingQueue.current.filter(id => id !== tempId);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m));
        console.error(
          `[ChatBox] ❌ Échec définitif — aucune confirmation après ${RETRY_MAX_MS / 1000} s.\n` +
          `  Message : ${tempId} | Socket : ${socketState}\n` +
          `  Contenu : ${content ? `"${content.slice(0, 60)}${content.length > 60 ? '…' : ''}"` : '(média)'}`
        );
        return;
      }
      const n = Math.floor(elapsed / RETRY_INTERVAL_MS) + 1;
      console.warn(`[ChatBox] ⚠️ Retry n°${n} — ${tempId} | Socket : ${socketState} | ${Math.round(elapsed / 1000)} s écoulées`);
      socketRef.current?.emit('send_message', emitPayload);
    }, RETRY_INTERVAL_MS);

    retryTimers.current.set(tempId, interval);
  };

  // ── Retry manuel (mobile, status 'failed') ────────────────────────────────────

  const retryMessage = (msg: Message) => {
    const payload = pendingPayloads.current.get(msg.id);
    if (!payload) {
      console.warn(`[ChatBox] Retry impossible — payload introuvable pour ${msg.id}`);
      return;
    }
    const newTempId   = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const socketState = socketRef.current?.connected ? 'connecté' : 'déconnecté';

    setMessages(prev => prev.map(m =>
      m.id === msg.id ? { ...m, id: newTempId, status: 'sending' as const } : m
    ));
    pendingPayloads.current.delete(msg.id);
    pendingPayloads.current.set(newTempId, payload);
    pendingQueue.current.push(newTempId);

    console.log(`[ChatBox] 🔄 Retry manuel — ${msg.id} → ${newTempId} | Socket : ${socketState}`);
    if (!socketRef.current?.connected) {
      console.error('[ChatBox] ❌ Retry — socket déconnecté. Vérifier la connexion réseau.');
    }
    socketRef.current?.emit('send_message', payload);

    const startedAt = Date.now();
    const interval  = setInterval(() => {
      if (!pendingQueue.current.includes(newTempId)) {
        clearInterval(interval); retryTimers.current.delete(newTempId); return;
      }
      const elapsed     = Date.now() - startedAt;
      const socketState = socketRef.current?.connected ? 'connecté' : 'déconnecté';
      if (elapsed >= RETRY_MAX_MS) {
        clearInterval(interval); retryTimers.current.delete(newTempId);
        pendingQueue.current = pendingQueue.current.filter(id => id !== newTempId);
        setMessages(prev => prev.map(m => m.id === newTempId ? { ...m, status: 'failed' as const } : m));
        console.error(`[ChatBox] ❌ Retry manuel — échec définitif après ${RETRY_MAX_MS / 1000} s. | Socket : ${socketState}`);
        return;
      }
      const n = Math.floor(elapsed / RETRY_INTERVAL_MS) + 1;
      console.warn(`[ChatBox] ⚠️ Retry manuel n°${n} — ${newTempId} | Socket : ${socketState}`);
      socketRef.current?.emit('send_message', payload);
    }, RETRY_INTERVAL_MS);
    retryTimers.current.set(newTempId, interval);
  };

  // ── Typing ────────────────────────────────────────────────────────────────────

  const emitTyping = (is_typing: boolean) => {
    if (conversationType === 'private') {
      socketRef.current?.emit('typing', { conversation_id: conversationId, user_id: userId, is_typing });
    } else {
      socketRef.current?.emit('typing', { group_id: conversationId, user_id: userId, user_name: userName, is_typing });
    }
  };

  const handleTyping = (text: string) => {
    setInput(text);
    if (text.length > 0 && !isTypingRef.current) { isTypingRef.current = true; emitTyping(true); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { isTypingRef.current = false; emitTyping(false); }, 2000);
  };

  const deleteMessage = (msg: Message) => {
    socketRef.current?.emit('delete_message', { message_id: msg.id, user_id: userId, access_token: accessToken });
  };

  const toggleVisibility = (msg: Message) => {
    if (conversationType !== 'group') return;
    socketRef.current?.emit('toggle_visibility', { message_id: msg.id, user_id: userId, access_token: accessToken });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLongPress = (msg: Message) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionMsg(msg); setShowActionSheet(true);
  };

  const handleTap = (msg: Message) => {
    if (conversationType !== 'group') return;
    const now = Date.now(); const last = lastTapRef.current;
    if (last && last.id === msg.id && now - last.time < 350) {
      lastTapRef.current = null;
      if (msg.senderId === userId && msg.reply_to_id) toggleVisibility(msg);
    } else { lastTapRef.current = { id: msg.id, time: now }; }
  };

  // ── Upload media ───────────────────────────────────────────────────────────────

  const pickAndUploadMedia = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { alert('Permission requise pour accéder à la galerie.'); return; }

      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0]; const uri = asset.uri;
      const mimeType = resolveMimeType(uri, asset.mimeType);
      const fileName = uri.split('/').pop() ?? `media_${Date.now()}`;

      setUploading(true);

      const urlRes  = await fetch(`${WS_BASE}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'getUploadUrl', user_id: userId, access_token: accessToken, file_name: fileName, file_type: mimeType, context: 'media-premium' }),
      });
      const urlData = await urlRes.json();
      if (!urlData.success) {
        setUploading(false);
        const r = urlData.error ?? 'Raison inconnue';
        console.error(`[ChatBox] ❌ Échec génération URL d'upload — ${r}`);
        alert(`Impossible de préparer l'envoi du fichier.\nRaison : ${r}`); return;
      }

      const { signed_url, path, bucket } = urlData;
      const { ok, status, errorText } = await uploadBinaryFile(signed_url, uri, mimeType);
      if (!ok) {
        setUploading(false);
        console.error(`[ChatBox] ❌ Échec upload — HTTP ${status} — ${errorText ?? 'Réponse vide'}`);
        alert(`L'envoi du fichier a échoué (code ${status}).\nVérifiez votre connexion et réessayez.`); return;
      }

      const confirmRes  = await fetch(`${WS_BASE}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'confirmUpload', user_id: userId, access_token: accessToken, path, bucket }),
      });
      const confirmData = await confirmRes.json();
      setUploading(false);
      if (!confirmData.success) {
        const r = confirmData.error ?? 'Raison inconnue';
        console.error(`[ChatBox] ❌ Échec confirmation upload — ${r}`);
        alert(`Le fichier a été envoyé mais n'a pas pu être confirmé.\nRaison : ${r}`); return;
      }

      sendMessage(confirmData.url, detectMediaType(mimeType, fileName));
    } catch (err: any) {
      setUploading(false);
      const d = err?.message ?? 'Erreur inconnue';
      console.error(`[ChatBox] ❌ Exception upload — ${d}`, err);
      alert(`Une erreur inattendue est survenue.\nDétail : ${d}`);
    }
  };

  // ── Normalisation ──────────────────────────────────────────────────────────────

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
    mediaType:        msg.mediaType    ?? msg.type       ?? null,
  });

  const fmtTime = (v: string | null | undefined): string => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isAuthor = (msg: Message) => msg.senderId === userId;

  const renderStatusIcon = (msg: Message) => {
    if (!msg.isFromMe || Platform.OS === 'web') return null;
    if (msg.status === 'sending') return <Text style={S.msgTimeMe}> ⏳</Text>;
    if (msg.status === 'failed')  return <Text style={[S.msgTimeMe, { color: '#FF6B6B' }]}> ❌</Text>;
    return <Text style={S.msgTimeMe}>{msg.isRead ? ' ✓✓' : ' ✓'}</Text>;
  };

  // ── Rendu media ────────────────────────────────────────────────────────────────

  const renderMediaContent = (msg: Message, fromMe: boolean) => {
    if (!msg.media_url) return null;
    const url  = msg.media_url;
    const type = (msg.mediaType && msg.mediaType !== 'text') ? msg.mediaType : detectMediaType(resolveMimeType(url), url);

    if (type === 'image') return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => {
        const now = Date.now(); const last = imgTapRef.current;
        if (last && last.url === url && now - last.time < 350) {
          imgTapRef.current = null;
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setFullscreenUrl(url);
        } else { imgTapRef.current = { url, time: now }; }
      }}>
        <Image source={{ uri: url }} style={S.mediaImage} resizeMode="cover" />
      </TouchableOpacity>
    );
    if (type === 'video') return (
      <View style={S.mediaFileWrap}>
        <Ionicons name="videocam-outline" size={22} color={fromMe ? '#fff' : '#8A2BE2'} />
        <Text style={[S.mediaFileName, fromMe ? S.msgTextMe : S.msgTextThem]} numberOfLines={1}>{url.split('/').pop()?.split('?')[0] ?? 'Vidéo'}</Text>
      </View>
    );
    if (type === 'audio') return (
      <View style={S.mediaFileWrap}>
        <Ionicons name="musical-notes-outline" size={22} color={fromMe ? '#fff' : '#8A2BE2'} />
        <Text style={[S.mediaFileName, fromMe ? S.msgTextMe : S.msgTextThem]} numberOfLines={1}>{url.split('/').pop()?.split('?')[0] ?? 'Audio'}</Text>
      </View>
    );
    if (type === 'document') return (
      <View style={S.mediaFileWrap}>
        <Ionicons name="document-text-outline" size={22} color={fromMe ? '#fff' : '#8A2BE2'} />
        <Text style={[S.mediaFileName, fromMe ? S.msgTextMe : S.msgTextThem]} numberOfLines={1}>{url.split('/').pop()?.split('?')[0] ?? 'Document'}</Text>
      </View>
    );
    return (
      <View style={S.mediaFileWrap}>
        <Ionicons name="attach-outline" size={22} color={fromMe ? '#fff' : '#8A2BE2'} />
        <Text style={[S.mediaFileName, fromMe ? S.msgTextMe : S.msgTextThem]} numberOfLines={1}>{url.split('/').pop()?.split('?')[0] ?? 'Fichier'}</Text>
      </View>
    );
  };

  // ── Rendu bulle ────────────────────────────────────────────────────────────────

  const renderBubble = (msg: Message) => {
    const fromMe  = msg.isFromMe;
    const deleted = !!msg.deletedAt;
    const isGroup = conversationType === 'group';

    return (
      <TouchableOpacity
        key={msg.id}
        activeOpacity={0.85}
        onPress={() => handleTap(msg)}
        onLongPress={() => handleLongPress(msg)}
        style={[
          S.bubble, fromMe ? S.bubbleMe : S.bubbleThem,
          msg.status === 'sending' && { opacity: 0.75 },
          msg.status === 'failed'  && { opacity: 0.65, borderWidth: 1, borderColor: '#FF6B6B' },
        ]}
      >
        {!fromMe && isGroup && !deleted && <Text style={S.senderName}>{msg.senderName}</Text>}

        {msg.replyTo && !deleted && (
          <View style={[S.replyBlock, fromMe ? S.replyBlockMe : S.replyBlockThem]}>
            <Text style={S.replyAuthor} numberOfLines={1}>{msg.replyTo.sender_prenom} {msg.replyTo.sender_nom}</Text>
            <Text style={S.replyContent} numberOfLines={2}>{msg.replyTo.content ?? 'Message supprimé'}</Text>
          </View>
        )}

        {deleted ? (
          <Text style={[S.msgText, S.msgDeleted]}>Message supprimé</Text>
        ) : msg.is_private_reply ? (
          <View style={S.privateReplyWrap}>
            <Ionicons name="lock-closed" size={12} color={fromMe ? '#E0D0FF' : '#999'} />
            <Text style={[S.msgText, fromMe ? S.msgTextMe : S.msgTextThem, { fontStyle: 'italic', marginLeft: 4 }]}>Réponse privée</Text>
          </View>
        ) : msg.media_url ? (
          renderMediaContent(msg, fromMe)
        ) : (
          <Text style={[S.msgText, fromMe ? S.msgTextMe : S.msgTextThem]}>{msg.content}</Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
          {isGroup && isAuthor(msg) && msg.reply_to_id && !deleted && (
            <Ionicons name={msg.is_visible ? 'eye-outline' : 'eye-off-outline'} size={11} color={fromMe ? '#E0D0FF' : '#aaa'} />
          )}
          <Text style={[S.msgTime, fromMe ? S.msgTimeMe : S.msgTimeThem]}>{fmtTime(msg.createdAt)}</Text>
          {Platform.OS === 'web'
            ? fromMe && !sending && <Text style={S.msgTimeMe}>{msg.isRead ? ' ✓✓' : ''}</Text>
            : renderStatusIcon(msg)
          }
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.container}>

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
              <Text style={S.headerStatus}>{otherTyping ? "En train d'écrire..." : otherOnline ? 'En ligne' : 'Hors ligne'}</Text>
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
              <Text style={S.headerStatus}>{otherTyping ? "Quelqu'un écrit..." : `${memberCount} membres`}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView ref={scrollRef} style={S.msgs} contentContainerStyle={{ padding: 15, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        {hasMore && !loading && (
          <TouchableOpacity onPress={loadMore} disabled={loadingMore} style={S.loadMoreBtn}>
            {loadingMore
              ? <Text style={S.loadMoreTxt}>Chargement en cours…</Text>
              : <><Ionicons name="chevron-up" size={16} color="#8A2BE2" /><Text style={S.loadMoreTxt}>Voir les messages précédents</Text></>
            }
          </TouchableOpacity>
        )}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <ActivityIndicator size="large" color="#8A2BE2" />
            <Text style={{ fontSize: 14, color: '#999', marginTop: 12 }}>Chargement des messages…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#888', marginTop: 15 }}>Aucun message pour l'instant</Text>
            <Text style={{ fontSize: 14, color: '#aaa', marginTop: 6, textAlign: 'center' }}>Démarrez la discussion !</Text>
          </View>
        ) : messages.map(msg => renderBubble(msg))}
      </ScrollView>

      {replyingTo && (
        <View style={S.replyBar}>
          <View style={S.replyBarContent}>
            <Ionicons name={replyVisible ? 'earth-outline' : 'lock-closed-outline'} size={14} color={replyVisible ? '#8A2BE2' : '#6B21A8'} style={{ marginRight: 6 }} />
            <View style={{ flex: 1 }}>
              <Text style={[S.replyBarAuthor, { color: replyVisible ? '#8A2BE2' : '#6B21A8' }]} numberOfLines={1}>
                {replyVisible ? 'Réponse publique à ' : 'Réponse privée à '}{replyingTo.senderName}
              </Text>
              <Text style={S.replyBarText} numberOfLines={1}>{replyingTo.content ?? 'Message supprimé'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => { setReplyingTo(null); setReplyVisible(true); }} style={{ padding: 6 }}>
            <Ionicons name="close" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: undefined })}>
        <View style={S.inputWrap}>
          {conversationType === 'group' && currentRole === 'userpro' && (
            <TouchableOpacity style={S.mediaBtn} onPress={pickAndUploadMedia} disabled={uploading || (Platform.OS === 'web' ? sending : false)} activeOpacity={0.7}>
              {uploading ? <ActivityIndicator size="small" color="#8A2BE2" /> : <Ionicons name="attach-outline" size={24} color="#8A2BE2" />}
            </TouchableOpacity>
          )}
          <TextInput
            style={S.input} placeholder="Écrivez un message…" placeholderTextColor="#999"
            value={input} onChangeText={handleTyping} multiline maxLength={1000}
            editable={Platform.OS === 'web' ? (!sending && !uploading) : !uploading}
            returnKeyType="default" blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[S.sendBtn, (!input.trim() || uploading || (Platform.OS === 'web' && sending)) && S.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || uploading || (Platform.OS === 'web' ? sending : false)}
            activeOpacity={0.7}
          >
            {Platform.OS === 'web' && sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Action sheet */}
      <Modal visible={showActionSheet} transparent animationType="fade" onRequestClose={() => setShowActionSheet(false)}>
        <TouchableOpacity style={S.modalOverlay} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
          <View style={S.actionSheet}>
            {actionMsg && (
              <>
                {Platform.OS !== 'web' && actionMsg.status === 'failed' ? (
                  <>
                    <TouchableOpacity style={S.actionItem} onPress={() => { retryMessage(actionMsg); setShowActionSheet(false); }}>
                      <Ionicons name="refresh-outline" size={20} color="#8A2BE2" />
                      <View style={{ flex: 1 }}>
                        <Text style={[S.actionTxt, { color: '#8A2BE2' }]}>Réessayer l'envoi</Text>
                        <Text style={S.actionSubTxt}>Le message n'a pas pu être envoyé</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.actionItem} onPress={() => {
                      setMessages(prev => prev.filter(m => m.id !== actionMsg.id));
                      pendingPayloads.current.delete(actionMsg.id);
                      setShowActionSheet(false);
                    }}>
                      <Ionicons name="trash-outline" size={20} color="#DC2626" />
                      <Text style={[S.actionTxt, { color: '#DC2626' }]}>Supprimer le brouillon</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {conversationType === 'group' && !actionMsg.deletedAt && !actionMsg.is_private_reply && (
                      <>
                        <TouchableOpacity style={S.actionItem} onPress={() => { setReplyingTo(actionMsg); setReplyVisible(true); setShowActionSheet(false); }}>
                          <Ionicons name="earth-outline" size={20} color="#8A2BE2" />
                          <View style={{ flex: 1 }}>
                            <Text style={[S.actionTxt, { color: '#8A2BE2' }]}>Répondre en public</Text>
                            <Text style={S.actionSubTxt}>Tout le groupe voit la réponse</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={S.actionItem} onPress={() => { setReplyingTo(actionMsg); setReplyVisible(false); setShowActionSheet(false); }}>
                          <Ionicons name="lock-closed-outline" size={20} color="#6B21A8" />
                          <View style={{ flex: 1 }}>
                            <Text style={[S.actionTxt, { color: '#6B21A8' }]}>Répondre en privé</Text>
                            <Text style={S.actionSubTxt}>Visible uniquement par vous et le destinataire</Text>
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                    {conversationType === 'group' && isAuthor(actionMsg) && actionMsg.reply_to_id && !actionMsg.deletedAt && (
                      <TouchableOpacity style={S.actionItem} onPress={() => { toggleVisibility(actionMsg); setShowActionSheet(false); }}>
                        <Ionicons name={actionMsg.is_visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#555" />
                        <Text style={S.actionTxt}>{actionMsg.is_visible ? 'Rendre privé' : 'Rendre visible'}</Text>
                      </TouchableOpacity>
                    )}
                    {isAuthor(actionMsg) && !actionMsg.deletedAt && !actionMsg.status && (
                      <TouchableOpacity style={S.actionItem} onPress={() => { deleteMessage(actionMsg); setShowActionSheet(false); }}>
                        <Ionicons name="trash-outline" size={20} color="#DC2626" />
                        <Text style={[S.actionTxt, { color: '#DC2626' }]}>Supprimer</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                <View style={S.actionDivider} />
                <TouchableOpacity style={S.actionItem} onPress={() => setShowActionSheet(false)}>
                  <Text style={[S.actionTxt, { textAlign: 'center', color: '#999', flex: 1 }]}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Visionneuse plein écran */}
      <Modal visible={!!fullscreenUrl} transparent animationType="fade" onRequestClose={() => setFullscreenUrl(null)}>
        <TouchableOpacity style={S.fsOverlay} activeOpacity={1} onPress={() => {
          const now = Date.now(); const last = imgTapRef.current;
          if (last && last.url === fullscreenUrl && now - last.time < 350) {
            imgTapRef.current = null; setFullscreenUrl(null);
          } else { imgTapRef.current = { url: fullscreenUrl!, time: now }; }
        }}>
          <Image source={{ uri: fullscreenUrl ?? '' }} style={S.fsImage} resizeMode="contain" />
          <TouchableOpacity style={S.fsCloseBtn} onPress={() => setFullscreenUrl(null)}>
            <Ionicons name="close-circle" size={36} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F5F5F5' },
  header:           { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, paddingHorizontal: 15 },
  backBtn:          { marginRight: 12, padding: 5 },
  avatar:           { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarTxt:        { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  onlineDot:        { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff', bottom: 2, right: 2 },
  headerInfo:       { flex: 1, marginLeft: 10 },
  headerName:       { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerStatus:     { fontSize: 12, color: '#E0D0FF', marginTop: 2 },
  msgs:             { flex: 1 },
  loadMoreBtn:      { alignSelf: 'center', marginBottom: 12, marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F0E8FF', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadMoreTxt:      { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  bubble:           { maxWidth: '78%', padding: 12, borderRadius: 18, marginBottom: 8 },
  bubbleMe:         { alignSelf: 'flex-end', backgroundColor: '#8A2BE2', borderBottomRightRadius: 4 },
  bubbleThem:       { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  senderName:       { fontSize: 11, fontWeight: '600', color: '#8A2BE2', marginBottom: 4 },
  replyBlock:       { borderRadius: 8, padding: 8, marginBottom: 6 },
  replyBlockMe:     { backgroundColor: 'rgba(255,255,255,0.15)' },
  replyBlockThem:   { backgroundColor: '#F0E8FF' },
  replyAuthor:      { fontSize: 11, fontWeight: '700', color: '#8A2BE2', marginBottom: 2 },
  replyContent:     { fontSize: 12, color: '#555' },
  msgText:          { fontSize: 15, lineHeight: 20 },
  msgTextMe:        { color: '#fff' },
  msgTextThem:      { color: '#333' },
  msgDeleted:       { color: '#aaa', fontStyle: 'italic' },
  msgTime:          { fontSize: 10 },
  msgTimeMe:        { color: '#E0D0FF', textAlign: 'right' },
  msgTimeThem:      { color: '#999' },
  privateReplyWrap: { flexDirection: 'row', alignItems: 'center' },
  mediaImage:       { width: 200, height: 150, borderRadius: 8 },
  mediaFileWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  mediaFileName:    { fontSize: 13, flex: 1 },
  replyBar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0E8FF', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  replyBarContent:  { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBarAuthor:   { fontSize: 12, fontWeight: '700', color: '#8A2BE2' },
  replyBarText:     { fontSize: 12, color: '#666', marginTop: 1 },
  inputWrap:        { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 10, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  mediaBtn:         { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  input:            { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 8 },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:  { backgroundColor: '#ccc' },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 30 : 16, paddingTop: 8 },
  actionItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  actionTxt:        { fontSize: 16, color: '#333', fontWeight: '500' },
  actionSubTxt:     { fontSize: 12, color: '#999', marginTop: 1 },
  actionDivider:    { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16, marginVertical: 4 },
  fsOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fsImage:          { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.82 },
  fsCloseBtn:       { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 36, right: 20 },
});
