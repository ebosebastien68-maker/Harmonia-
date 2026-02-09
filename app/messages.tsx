import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createClient } from '@supabase/supabase-js';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages';

// Configuration Supabase pour Realtime
const SUPABASE_URL = 'https://sjdjwtlcryyqqewapxip.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZGp3dGxjcnl5cXFld2FweGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNjAzMjcsImV4cCI6MjA1MTkzNjMyN30.p3Z7eJYKvOoB3iRfBjVYCkPy-Z_3FKJBGnBvRmLFLfw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type ViewMode = 'tabs' | 'private-chat' | 'group-chat';
type TabMode = 'online' | 'friends' | 'groups' | 'history';

interface User {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Conversation {
  type: 'private' | 'group';
  id: string;
  otherUser?: User;
  name?: string;
  description?: string;
  memberCount?: number;
  lastMessage: {
    content: string;
    createdAt: string;
    isFromMe?: boolean;
    senderName?: string;
  } | null;
  unreadCount?: number;
  createdAt: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  isFromMe: boolean;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  isRead?: boolean;
  type?: string;
  mediaUrl?: string;
}

export default function MessagesScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [activeTab, setActiveTab] = useState<TabMode>('history');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Utilisateur connecté
  const [userId, setUserId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');

  // Données
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<User[]>([]);
  const [allFriends, setAllFriends] = useState<User[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);

  // Conversation active
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<any>(null);
  
  // Références pour les subscriptions Realtime
  const messagesChannelRef = useRef<any>(null);
  const groupMessagesChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const conversationsChannelRef = useRef<any>(null);

  // =====================
  // INITIALISATION
  // =====================
  useEffect(() => {
    initializeMessaging();
    
    return () => {
      cleanupSubscriptions();
      updatePresence(false);
    };
  }, []);

  useEffect(() => {
    if (userId) {
      updatePresence(true);
      const interval = setInterval(() => {
        updatePresence(true);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  useEffect(() => {
    if (viewMode === 'tabs') {
      setupListSubscriptions();
    } else if (activeConversation) {
      if (activeConversation.type === 'private') {
        setupPrivateChatSubscriptions();
      } else {
        setupGroupChatSubscriptions();
      }
    }
    
    return () => {
      cleanupChatSubscriptions();
    };
  }, [viewMode, activeConversation?.id]);

  const initializeMessaging = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
        setAccessToken(parsed.access_token);
        await loadAllData(parsed.user.id);
      }
    } catch (error) {
      console.error('Erreur initialisation:', error);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // REALTIME SUBSCRIPTIONS
  // =====================
  const setupListSubscriptions = () => {
    if (!userId) return;
    cleanupChatSubscriptions();

    conversationsChannelRef.current = supabase
      .channel('conversations-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_conversations',
        filter: `user1_id=eq.${userId}`
      }, () => loadConversations(userId))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_conversations',
        filter: `user2_id=eq.${userId}`
      }, () => loadConversations(userId))
      .subscribe();

    presenceChannelRef.current = supabase
      .channel('presence-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_presence'
      }, () => {
        loadOnlineFriends(userId);
        loadAllFriends(userId);
      })
      .subscribe();
  };

  const setupPrivateChatSubscriptions = () => {
    if (!activeConversation || !userId) return;

    messagesChannelRef.current = supabase
      .channel(`private-messages:${activeConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages',
        filter: `conversation_id=eq.${activeConversation.id}`
      }, async (payload) => {
        const newMessage = payload.new as any;
        const { data: senderData } = await supabase
          .from('profiles')
          .select('nom, prenom, avatar_url')
          .eq('id', newMessage.sender_id)
          .single();

        if (senderData) {
          const formattedMessage: Message = {
            id: newMessage.id,
            content: newMessage.content,
            senderId: newMessage.sender_id,
            isFromMe: newMessage.sender_id === userId,
            senderName: `${senderData.prenom} ${senderData.nom}`,
            senderAvatar: senderData.avatar_url,
            createdAt: newMessage.created_at,
            isRead: !!newMessage.read_at
          };

          setMessages(prev => [...prev, formattedMessage]);
          
          if (newMessage.sender_id !== userId) {
            markConversationAsRead(activeConversation.id);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }

          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'private_messages',
        filter: `conversation_id=eq.${activeConversation.id}`
      }, (payload) => {
        const updatedMessage = payload.new as any;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === updatedMessage.id
              ? { ...msg, isRead: !!updatedMessage.read_at }
              : msg
          )
        );
      })
      .subscribe();

    typingChannelRef.current = supabase
      .channel(`typing:${activeConversation.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_status',
        filter: `conversation_id=eq.${activeConversation.id}`
      }, (payload) => {
        const typingData = payload.new as any;
        if (typingData.user_id !== userId) {
          setOtherUserTyping(typingData.is_typing);
        }
      })
      .subscribe();

    if (activeConversation.otherUser) {
      presenceChannelRef.current = supabase
        .channel(`presence:${activeConversation.otherUser.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${activeConversation.otherUser.id}`
        }, (payload) => {
          const presenceData = payload.new as any;
          setActiveConversation(prev => {
            if (prev && prev.otherUser) {
              return {
                ...prev,
                otherUser: {
                  ...prev.otherUser,
                  isOnline: presenceData.is_online,
                  lastSeen: presenceData.last_seen_at
                }
              };
            }
            return prev;
          });
        })
        .subscribe();
    }
  };

  const setupGroupChatSubscriptions = () => {
    if (!activeConversation || !userId) return;

    groupMessagesChannelRef.current = supabase
      .channel(`group-messages:${activeConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${activeConversation.id}`
      }, async (payload) => {
        const newMessage = payload.new as any;
        const { data: senderData } = await supabase
          .from('profiles')
          .select('nom, prenom, avatar_url')
          .eq('id', newMessage.sender_id)
          .single();

        if (senderData) {
          const formattedMessage: Message = {
            id: newMessage.id,
            content: newMessage.content,
            type: newMessage.type,
            mediaUrl: newMessage.media_url,
            senderId: newMessage.sender_id,
            isFromMe: newMessage.sender_id === userId,
            senderName: `${senderData.prenom} ${senderData.nom}`,
            senderAvatar: senderData.avatar_url,
            createdAt: newMessage.created_at
          };

          setMessages(prev => [...prev, formattedMessage]);
          
          if (newMessage.sender_id !== userId && Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .subscribe();
  };

  const cleanupChatSubscriptions = () => {
    if (messagesChannelRef.current) {
      messagesChannelRef.current.unsubscribe();
      messagesChannelRef.current = null;
    }
    if (groupMessagesChannelRef.current) {
      groupMessagesChannelRef.current.unsubscribe();
      groupMessagesChannelRef.current = null;
    }
    if (typingChannelRef.current) {
      typingChannelRef.current.unsubscribe();
      typingChannelRef.current = null;
    }
    if (presenceChannelRef.current) {
      presenceChannelRef.current.unsubscribe();
      presenceChannelRef.current = null;
    }
  };

  const cleanupSubscriptions = () => {
    cleanupChatSubscriptions();
    if (conversationsChannelRef.current) {
      conversationsChannelRef.current.unsubscribe();
      conversationsChannelRef.current = null;
    }
  };

  // =====================
  // CHARGEMENT DONNÉES
  // =====================
  const loadAllData = async (uid: string) => {
    try {
      await Promise.all([
        loadConversations(uid),
        loadOnlineFriends(uid),
        loadAllFriends(uid),
        loadGroups(uid)
      ]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  const loadConversations = async (uid: string) => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-conversations',
          user_id: uid
        })
      });

      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    }
  };

  const loadOnlineFriends = async (uid: string) => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-friends-online',
          user_id: uid
        })
      });

      const data = await response.json();
      if (data.success) {
        setOnlineFriends(data.friends);
      }
    } catch (error) {
      console.error('Erreur chargement amis en ligne:', error);
    }
  };

  const loadAllFriends = async (uid: string) => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-all-friends',
          user_id: uid
        })
      });

      const data = await response.json();
      if (data.success) {
        setAllFriends(data.friends);
      }
    } catch (error) {
      console.error('Erreur chargement tous les amis:', error);
    }
  };

  const loadGroups = async (uid: string) => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-user-groups',
          user_id: uid
        })
      });

      const data = await response.json();
      if (data.success) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    }
  };

  // =====================
  // OUVRIR CONVERSATIONS
  // =====================
  const openPrivateChat = async (friend: User) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      setLoading(true);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-or-create-conversation',
          user_id: userId,
          friend_id: friend.id
        })
      });

      const data = await response.json();
      if (data.success) {
        const conv: Conversation = {
          type: 'private',
          id: data.conversation_id,
          otherUser: friend,
          lastMessage: null,
          createdAt: new Date().toISOString()
        };
        
        setActiveConversation(conv);
        setViewMode('private-chat');
        await loadMessages(data.conversation_id);
        await markConversationAsRead(data.conversation_id);
      }
    } catch (error) {
      console.error('Erreur ouverture chat:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (conv: Conversation) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      setLoading(true);
      setActiveConversation(conv);
      
      if (conv.type === 'private') {
        setViewMode('private-chat');
        await loadMessages(conv.id);
        await markConversationAsRead(conv.id);
      } else {
        setViewMode('group-chat');
        await loadGroupMessages(conv.id);
      }
    } catch (error) {
      console.error('Erreur ouverture conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const openGroupChat = async (group: Conversation) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      setLoading(true);
      setActiveConversation(group);
      setViewMode('group-chat');
      await loadGroupMessages(group.id);
    } catch (error) {
      console.error('Erreur ouverture groupe:', error);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // CHARGER MESSAGES
  // =====================
  const loadMessages = async (conversationId?: string) => {
    const convId = conversationId || activeConversation?.id;
    if (!convId) return;

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-conversation-messages',
          conversation_id: convId,
          user_id: userId
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  const loadGroupMessages = async (groupId?: string) => {
    const grpId = groupId || activeConversation?.id;
    if (!grpId) return;

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-group-messages',
          group_id: grpId,
          user_id: userId
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('Erreur chargement messages groupe:', error);
    }
  };

  // =====================
  // ENVOYER MESSAGE
  // =====================
  const sendMessage = async () => {
    if (!messageInput.trim() || !activeConversation) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const content = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);

    if (activeConversation.type === 'private') {
      updateTypingStatus(false);
    }

    try {
      const isGroup = activeConversation.type === 'group';
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: isGroup ? 'send-group-message' : 'send-private-message',
          user_id: userId,
          [isGroup ? 'group_id' : 'conversation_id']: activeConversation.id,
          content
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error('Erreur envoi message');
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      setMessageInput(content);
    } finally {
      setSendingMessage(false);
    }
  };

  const markConversationAsRead = async (conversationId: string) => {
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'mark-as-read',
          conversation_id: conversationId,
          user_id: userId
        })
      });
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  const handleTyping = (text: string) => {
    setMessageInput(text);
    if (!activeConversation || activeConversation.type !== 'private') return;

    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const updateTypingStatus = async (typing: boolean) => {
    if (!activeConversation || activeConversation.type !== 'private') return;

    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'update-typing-status',
          conversation_id: activeConversation.id,
          user_id: userId,
          is_typing: typing
        })
      });
    } catch (error) {
      console.error('Erreur statut frappe:', error);
    }
  };

  const updatePresence = async (online: boolean) => {
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'update-presence',
          user_id: userId,
          is_online: online
        })
      });
    } catch (error) {
      console.error('Erreur mise à jour présence:', error);
    }
  };

  const onRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setRefreshing(true);
    await loadAllData(userId);
    setRefreshing(false);
    
    // Feedback de succès
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const backToList = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setViewMode('tabs');
    setActiveConversation(null);
    setMessages([]);
    setOtherUserTyping(false);
    loadAllData(userId);
  };

  const handleTabChange = (tab: TabMode) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tab);
  };

  // =====================
  // FORMATER DATE
  // =====================
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // =====================
  // RENDU AVATAR
  // =====================
  const renderAvatar = (user: User | undefined, size: number = 50) => {
    if (!user) return null;

    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {user.avatar_url ? (
          <Text style={styles.avatarText}>IMG</Text>
        ) : (
          <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>
            {user.prenom.charAt(0)}{user.nom.charAt(0)}
          </Text>
        )}
        {user.isOnline && (
          <View style={[styles.onlineIndicator, { 
            width: size / 4, 
            height: size / 4, 
            borderRadius: size / 8,
            bottom: size / 20,
            right: size / 20
          }]} />
        )}
      </View>
    );
  };

  // =====================
  // RENDU LISTE AVEC ONGLETS
  // =====================
  if (viewMode === 'tabs') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>💬 Messages</Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="reload" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ONGLETS */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.activeTab]}
            onPress={() => handleTabChange('history')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="time-outline" 
              size={20} 
              color={activeTab === 'history' ? '#8A2BE2' : '#999'} 
            />
            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
              Historique
            </Text>
            {conversations.filter(c => (c.unreadCount || 0) > 0).length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'online' && styles.activeTab]}
            onPress={() => handleTabChange('online')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="radio-button-on" 
              size={20} 
              color={activeTab === 'online' ? '#10B981' : '#999'} 
            />
            <Text style={[styles.tabText, activeTab === 'online' && styles.activeTabText]}>
              En ligne
            </Text>
            {onlineFriends.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.tabBadgeText}>{onlineFriends.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
            onPress={() => handleTabChange('friends')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="people-outline" 
              size={20} 
              color={activeTab === 'friends' ? '#8A2BE2' : '#999'} 
            />
            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
              Amis
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
            onPress={() => handleTabChange('groups')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="people-circle-outline" 
              size={20} 
              color={activeTab === 'groups' ? '#8A2BE2' : '#999'} 
            />
            <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
              Groupes
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONTENU DES ONGLETS */}
        <ScrollView
          style={styles.content}
        >
          {/* ONGLET HISTORIQUE */}
          {activeTab === 'history' && (
            <View style={styles.tabContent}>
              {conversations.length > 0 ? (
                conversations.map(conv => (
                  <TouchableOpacity
                    key={conv.id}
                    style={styles.listItem}
                    onPress={() => openConversation(conv)}
                    activeOpacity={0.7}
                  >
                    {conv.type === 'private' ? (
                      renderAvatar(conv.otherUser)
                    ) : (
                      <View style={[styles.avatar, styles.groupAvatar]}>
                        <Ionicons name="people" size={24} color="#fff" />
                      </View>
                    )}
                    <View style={styles.listItemContent}>
                      <View style={styles.listItemHeader}>
                        <Text style={styles.listItemName}>
                          {conv.type === 'private' 
                            ? `${conv.otherUser?.prenom} ${conv.otherUser?.nom}`
                            : conv.name
                          }
                        </Text>
                        <Text style={styles.listItemTime}>
                          {conv.lastMessage && formatTime(conv.lastMessage.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.listItemFooter}>
                        <Text style={styles.listItemMessage} numberOfLines={1}>
                          {conv.lastMessage?.isFromMe && 'Vous: '}
                          {conv.lastMessage?.senderName && `${conv.lastMessage.senderName}: `}
                          {conv.lastMessage?.content || 'Aucun message'}
                        </Text>
                        {(conv.unreadCount || 0) > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{conv.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>Aucune conversation</Text>
                </View>
              )}
            </View>
          )}

          {/* ONGLET AMIS EN LIGNE */}
          {activeTab === 'online' && (
            <View style={styles.tabContent}>
              {onlineFriends.length > 0 ? (
                onlineFriends.map(friend => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.listItem}
                    onPress={() => openPrivateChat(friend)}
                    activeOpacity={0.7}
                  >
                    {renderAvatar(friend)}
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemName}>
                        {friend.prenom} {friend.nom}
                      </Text>
                      <View style={styles.onlineStatus}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>En ligne</Text>
                      </View>
                    </View>
                    <Ionicons name="chatbubble-outline" size={24} color="#8A2BE2" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="wifi-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>Aucun ami en ligne</Text>
                </View>
              )}
            </View>
          )}

          {/* ONGLET TOUS LES AMIS */}
          {activeTab === 'friends' && (
            <View style={styles.tabContent}>
              {allFriends.length > 0 ? (
                allFriends.map(friend => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.listItem}
                    onPress={() => openPrivateChat(friend)}
                    activeOpacity={0.7}
                  >
                    {renderAvatar(friend)}
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemName}>
                        {friend.prenom} {friend.nom}
                      </Text>
                      <Text style={styles.listItemStatus}>
                        {friend.isOnline ? '🟢 En ligne' : '⚪ Hors ligne'}
                      </Text>
                    </View>
                    <Ionicons name="chatbubble-outline" size={24} color="#8A2BE2" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>Aucun ami</Text>
                </View>
              )}
            </View>
          )}

          {/* ONGLET GROUPES */}
          {activeTab === 'groups' && (
            <View style={styles.tabContent}>
              {groups.length > 0 ? (
                groups.map(group => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.listItem}
                    onPress={() => openGroupChat(group)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatar, styles.groupAvatar]}>
                      <Ionicons name="people" size={24} color="#fff" />
                    </View>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemName}>{group.name}</Text>
                      <Text style={styles.listItemStatus}>
                        {group.memberCount} membres
                      </Text>
                    </View>
                    <Ionicons name="chatbubbles-outline" size={24} color="#FF8C00" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="people-circle-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>Aucun groupe</Text>
                </View>
              )}
            </View>
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // =====================
  // RENDU CONVERSATION (PRIVÉE OU GROUPE)
  // =====================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.chatHeader}>
        <TouchableOpacity onPress={backToList} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        {activeConversation?.type === 'private' ? (
          <>
            {renderAvatar(activeConversation.otherUser, 40)}
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>
                {activeConversation.otherUser?.prenom} {activeConversation.otherUser?.nom}
              </Text>
              <Text style={styles.chatHeaderStatus}>
                {otherUserTyping 
                  ? '✍️ En train d\'écrire...' 
                  : activeConversation.otherUser?.isOnline 
                    ? '🟢 En ligne' 
                    : '⚪ Hors ligne'
                }
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.avatar, styles.groupAvatar, { width: 40, height: 40 }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{activeConversation?.name}</Text>
              <Text style={styles.chatHeaderStatus}>
                {activeConversation?.memberCount} membres
              </Text>
            </View>
          </>
        )}
        
        <View style={styles.realtimeIndicator}>
          <View style={styles.realtimeDot} />
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8A2BE2" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={styles.emptyChatText}>Aucun message</Text>
            <Text style={styles.emptyChatSubtext}>Commencez la conversation !</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isFromMe ? styles.myMessage : styles.theirMessage
              ]}
            >
              {!message.isFromMe && activeConversation?.type === 'group' && (
                <Text style={styles.messageSender}>{message.senderName}</Text>
              )}
              <Text style={[
                styles.messageText,
                message.isFromMe ? styles.myMessageText : styles.theirMessageText
              ]}>
                {message.content}
              </Text>
              <Text style={[
                styles.messageTime,
                message.isFromMe ? styles.myMessageTime : styles.theirMessageTime
              ]}>
                {formatMessageTime(message.createdAt)}
                {message.isFromMe && message.isRead && ' ✓✓'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Écrivez un message..."
          placeholderTextColor="#999"
          value={messageInput}
          onChangeText={handleTyping}
          multiline
          maxLength={1000}
          editable={!sendingMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageInput.trim() || sendingMessage) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!messageInput.trim() || sendingMessage}
          activeOpacity={0.7}
        >
          {sendingMessage ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  // ONGLETS
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#8A2BE2',
  },
  tabText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#8A2BE2',
    fontWeight: 'bold',
  },
  tabBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: '#FF0080',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // CONTENU
  content: {
    flex: 1,
  },
  tabContent: {
    paddingVertical: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  listItemTime: {
    fontSize: 12,
    color: '#999',
  },
  listItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  listItemStatus: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#FF0080',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // AVATAR
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  groupAvatar: {
    backgroundColor: '#FF8C00',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
    bottom: 2,
    right: 2,
  },
  // ÉTATS VIDES
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  // CHAT
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    marginRight: 12,
    padding: 5,
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatHeaderStatus: {
    fontSize: 12,
    color: '#E0D0FF',
    marginTop: 2,
  },
  realtimeIndicator: {
    marginLeft: 'auto',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 100,
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#8A2BE2',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A2BE2',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  myMessageTime: {
    color: '#E0D0FF',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
