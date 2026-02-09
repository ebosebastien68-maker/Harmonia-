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
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages';

type ViewMode = 'list' | 'private-chat' | 'group-chat';

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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Utilisateur connecté
  const [userId, setUserId] = useState<string>('');

  // Données
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<User[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);

  // Conversation active
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<any>(null);

  // =====================
  // INITIALISATION
  // =====================
  useEffect(() => {
    initializeMessaging();
  }, []);

  // Auto-refresh toutes les 10 secondes quand on est dans une conversation
  useEffect(() => {
    if (viewMode !== 'list' && activeConversation) {
      const interval = setInterval(() => {
        loadMessages();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [viewMode, activeConversation]);

  // Mettre à jour la présence toutes les 30 secondes
  useEffect(() => {
    if (userId) {
      updatePresence(true);
      const interval = setInterval(() => {
        updatePresence(true);
      }, 30000);
      return () => {
        clearInterval(interval);
        updatePresence(false);
      };
    }
  }, [userId]);

  const initializeMessaging = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
        await loadAllData(parsed.user.id);
      }
    } catch (error) {
      console.error('Erreur initialisation:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (uid: string) => {
    try {
      await Promise.all([
        loadConversations(uid),
        loadOnlineFriends(uid),
        loadGroups(uid)
      ]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  // =====================
  // CHARGEMENT CONVERSATIONS
  // =====================
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

  // =====================
  // CHARGEMENT AMIS EN LIGNE
  // =====================
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

  // =====================
  // CHARGEMENT GROUPES
  // =====================
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
  // OUVRIR CONVERSATION PRIVÉE
  // =====================
  const openPrivateChat = async (friend: User) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      setLoading(true);

      // Créer ou récupérer la conversation
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

  // =====================
  // OUVRIR CONVERSATION EXISTANTE
  // =====================
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

  // =====================
  // CHARGER MESSAGES PRIVÉS
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
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  // =====================
  // CHARGER MESSAGES GROUPE
  // =====================
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
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
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
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setSendingMessage(false);
    }
  };

  // =====================
  // MARQUER COMME LU
  // =====================
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

  // =====================
  // GESTION STATUT DE FRAPPE
  // =====================
  const handleTyping = (text: string) => {
    setMessageInput(text);

    if (!activeConversation || activeConversation.type !== 'private') return;

    // Envoyer statut "en train d'écrire"
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Réinitialiser le timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Après 2 secondes d'inactivité, retirer le statut
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

  // =====================
  // METTRE À JOUR PRÉSENCE
  // =====================
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

  // =====================
  // REFRESH
  // =====================
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData(userId);
    setRefreshing(false);
  };

  // =====================
  // RETOUR À LA LISTE
  // =====================
  const backToList = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setViewMode('list');
    setActiveConversation(null);
    setMessages([]);
    loadAllData(userId);
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
  // RENDU LISTE CONVERSATIONS
  // =====================
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <Text style={styles.headerTitle}>💬 Messages</Text>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />
          }
        >
          {/* AMIS EN LIGNE */}
          {onlineFriends.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🟢 Amis en ligne ({onlineFriends.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.onlineList}>
                {onlineFriends.map(friend => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.onlineFriend}
                    onPress={() => openPrivateChat(friend)}
                    activeOpacity={0.7}
                  >
                    {renderAvatar(friend, 60)}
                    <Text style={styles.onlineFriendName}>
                      {friend.prenom}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* CONVERSATIONS RÉCENTES */}
          {conversations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💬 Conversations</Text>
              {conversations.map(conv => (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.conversationItem}
                  onPress={() => openConversation(conv)}
                  activeOpacity={0.7}
                >
                  {renderAvatar(conv.otherUser)}
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationName}>
                        {conv.otherUser?.prenom} {conv.otherUser?.nom}
                      </Text>
                      <Text style={styles.conversationTime}>
                        {conv.lastMessage && formatTime(conv.lastMessage.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.conversationFooter}>
                      <Text style={styles.conversationMessage} numberOfLines={1}>
                        {conv.lastMessage?.isFromMe && 'Vous: '}
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
              ))}
            </View>
          )}

          {/* GROUPES */}
          {groups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👥 Groupes</Text>
              {groups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.conversationItem}
                  onPress={() => openConversation(group)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, styles.groupAvatar]}>
                    <Ionicons name="people" size={24} color="#fff" />
                  </View>
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationName}>{group.name}</Text>
                      <Text style={styles.conversationTime}>
                        {group.lastMessage && formatTime(group.lastMessage.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.conversationFooter}>
                      <Text style={styles.conversationMessage} numberOfLines={1}>
                        {group.lastMessage 
                          ? `${group.lastMessage.senderName}: ${group.lastMessage.content}`
                          : `${group.memberCount} membres`
                        }
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ÉTAT VIDE */}
          {conversations.length === 0 && groups.length === 0 && onlineFriends.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={80} color="#ccc" />
              <Text style={styles.emptyStateTitle}>Aucune conversation</Text>
              <Text style={styles.emptyStateText}>
                Ajoutez des amis pour commencer à discuter !
              </Text>
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
      {/* EN-TÊTE CONVERSATION */}
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
                {activeConversation.otherUser?.isOnline ? '🟢 En ligne' : '⚪ Hors ligne'}
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
      </LinearGradient>

      {/* MESSAGES */}
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
            <Text style={styles.emptyChatSubtext}>
              Commencez la conversation !
            </Text>
          </View>
        ) : (
          messages.map((message, index) => (
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

      {/* INPUT MESSAGE */}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  // AMIS EN LIGNE
  onlineList: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  onlineFriend: {
    alignItems: 'center',
    marginRight: 15,
    width: 70,
  },
  onlineFriendName: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  // CONVERSATIONS
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
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
  // ÉTAT VIDE
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  // CHAT HEADER
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
  // MESSAGES
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
  // INPUT
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
