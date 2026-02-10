import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import ChatBox from '../components/ChatBox';

// ⚡ Edge Functions URLs
const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages';
const STREAM_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages-stream';

type ViewMode = 'tabs' | 'chat';
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

// ✅ AJOUT: Interface pour le callback
interface MessagesScreenProps {
  onChatModeChange?: (isInChatMode: boolean) => void;
}

// ✅ MODIFIÉ: Accepte la prop onChatModeChange
export default function MessagesScreen({ onChatModeChange }: MessagesScreenProps = {}) {
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [activeTab, setActiveTab] = useState<TabMode>('history');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Utilisateur connecté
  const [userId, setUserId] = useState<string>('');

  // Données
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<User[]>([]);
  const [allFriends, setAllFriends] = useState<User[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);

  // Conversation active
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Référence pour EventSource
  const eventSourceRef = useRef<EventSource | null>(null);

  // =====================
  // INITIALISATION
  // =====================
  useEffect(() => {
    initializeMessaging();

    return () => {
      updatePresence(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Mettre à jour la présence uniquement au montage et démontage
  useEffect(() => {
    if (userId) {
      updatePresence(true);
    }
  }, [userId]);

  // Setup EventSource pour le temps réel
  useEffect(() => {
    if (userId && viewMode === 'tabs') {
      setupRealtimeStream();
      
      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      };
    }
  }, [userId, viewMode]);

  const initializeMessaging = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
        await loadAllData(parsed.user.id);
        await updatePresence(true);
      }
    } catch (error) {
      console.error('Erreur initialisation:', error);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // TEMPS RÉEL AVEC EVENTSOURCE
  // =====================
  const setupRealtimeStream = () => {
    const streamUrl = `${STREAM_BASE}?user_id=${userId}`;
    
    eventSourceRef.current = new EventSource(streamUrl);

    eventSourceRef.current.addEventListener('connected', () => {
      console.log('✅ Connexion temps réel établie (liste)');
    });

    eventSourceRef.current.addEventListener('conversations-updated', () => {
      console.log('🔄 Mise à jour conversations');
      loadConversations(userId);
    });

    eventSourceRef.current.addEventListener('presence-updated', () => {
      console.log('🔄 Mise à jour présence');
      loadOnlineFriends(userId);
      loadAllFriends(userId);
    });

    eventSourceRef.current.addEventListener('heartbeat', () => {
      // Connexion maintenue
    });

    eventSourceRef.current.onerror = () => {
      console.log('❌ Erreur connexion temps réel');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  };

  // =====================
  // CHARGEMENT DONNÉES VIA EDGE FUNCTIONS
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
        setViewMode('chat');
        
        // ✅ AJOUT: Notifie HomePage que le chat est ouvert
        onChatModeChange?.(true);
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

    setActiveConversation(conv);
    setViewMode('chat');
    
    // ✅ AJOUT: Notifie HomePage que le chat est ouvert
    onChatModeChange?.(true);
  };

  const openGroupChat = async (group: Conversation) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setActiveConversation(group);
    setViewMode('chat');
    
    // ✅ AJOUT: Notifie HomePage que le chat est ouvert
    onChatModeChange?.(true);
  };

  const updatePresence = async (online: boolean) => {
    if (!userId) return;

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
    
    // ✅ AJOUT: Notifie HomePage que le chat est fermé
    onChatModeChange?.(false);
    
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

  // =====================
  // RENDU AVATAR
  // =====================
  const renderAvatar = (user: User | undefined, size: number = 50) => {
    if (!user) return null;

    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>
          {user.prenom.charAt(0)}{user.nom.charAt(0)}
        </Text>
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
  // RENDU CHATBOX
  // =====================
  if (viewMode === 'chat' && activeConversation) {
    return (
      <ChatBox
        conversationId={activeConversation.id}
        conversationType={activeConversation.type}
        userId={userId}
        otherUser={activeConversation.otherUser}
        groupName={activeConversation.name}
        memberCount={activeConversation.memberCount}
        onBack={backToList}
      />
    );
  }

  // =====================
  // RENDU LISTE AVEC ONGLETS
  // =====================
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
      <ScrollView style={styles.content}>
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
});
