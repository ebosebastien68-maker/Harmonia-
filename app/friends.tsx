import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/friends';
const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=8A2BE2&color=fff&name=';

type Tab = 'discover' | 'requests' | 'groups';
type RequestTab = 'received' | 'sent';

interface User {
  id: string;
  nom: string;
  prenom: string;
  avatar_url?: string;
  created_at: string;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'envoye' | 'recu' | 'accepte';
  created_at: string;
  requester?: User;
  receiver?: User;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  member_count: number;
  is_member: boolean;
}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  text: string;
  visible: boolean;
}

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [requestTab, setRequestTab] = useState<RequestTab>('received');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({
    type: 'info',
    text: '',
    visible: false,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);

  const [groups, setGroups] = useState<Group[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadInitialData();
    }
  }, [activeTab, currentUserId]);

  useEffect(() => {
    if (statusMessage.visible) {
      const timer = setTimeout(() => {
        setStatusMessage(prev => ({ ...prev, visible: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage.visible]);

  const initUser = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setCurrentUserId(parsed.user.id);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text, visible: true });
  };

  // ⚡ APPEL API ULTRA-SIMPLIFIÉ (pas de JWT, juste user_id dans body)
  const apiCall = async (action: string, data: any = {}) => {
    if (!currentUserId) {
      showMessage('error', 'Non authentifié');
      return null;
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action,
          user_id: currentUserId,
          ...data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur réseau');
      }

      return result;
    } catch (error: any) {
      console.error(`API Error (${action}):`, error);
      showMessage('error', error.message || 'Erreur de connexion');
      return null;
    }
  };

  const loadInitialData = async () => {
    if (activeTab === 'discover') {
      await loadUsers(1);
    } else if (activeTab === 'requests') {
      await loadRequests();
    } else if (activeTab === 'groups') {
      await loadGroups();
    }
  };

  const loadUsers = async (page: number, append: boolean = false) => {
    if (loading) return;

    setLoading(true);
    const result = await apiCall('list_users', { page, limit: 20 });
    setLoading(false);

    if (result && result.users) {
      if (append) {
        setUsers(prev => [...prev, ...result.users]);
      } else {
        setUsers(result.users);
      }
      setUsersPage(page);
      setHasMoreUsers(result.users.length === 20);
    }
  };

  const loadMoreUsers = () => {
    if (hasMoreUsers && !loading) {
      loadUsers(usersPage + 1, true);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const result = await apiCall('search_users', { query: query.trim() });
    setIsSearching(false);

    if (result && result.users) {
      setSearchResults(result.users);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (processingIds.has(receiverId)) return;

    setProcessingIds(prev => new Set(prev).add(receiverId));
    const result = await apiCall('send_request', { receiver_id: receiverId });
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(receiverId);
      return newSet;
    });

    if (result && result.success) {
      showMessage('success', 'Invitation envoyée !');
      await loadUsers(1);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    const result = await apiCall('list_requests');
    setLoading(false);

    if (result) {
      setReceivedRequests(result.received || []);
      setSentRequests(result.sent || []);
    }
  };

  const acceptRequest = async (requestId: string) => {
    if (processingIds.has(requestId)) return;

    setProcessingIds(prev => new Set(prev).add(requestId));
    const result = await apiCall('accept_request', { request_id: requestId });
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });

    if (result && result.success) {
      showMessage('success', 'Invitation acceptée !');
      await loadRequests();
    }
  };

  const declineRequest = async (requestId: string) => {
    if (processingIds.has(requestId)) return;

    setProcessingIds(prev => new Set(prev).add(requestId));
    const result = await apiCall('decline_request', { request_id: requestId });
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });

    if (result && result.success) {
      showMessage('info', 'Invitation refusée');
      await loadRequests();
    }
  };

  const cancelRequest = async (requestId: string) => {
    if (processingIds.has(requestId)) return;

    setProcessingIds(prev => new Set(prev).add(requestId));
    const result = await apiCall('cancel_request', { request_id: requestId });
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });

    if (result && result.success) {
      showMessage('info', 'Invitation annulée');
      await loadRequests();
    }
  };

  const loadGroups = async () => {
    setLoading(true);
    const result = await apiCall('list_groups');
    setLoading(false);

    if (result && result.groups) {
      setGroups(result.groups);
    }
  };

  const joinGroup = async (groupId: string) => {
    if (processingIds.has(groupId)) return;

    setProcessingIds(prev => new Set(prev).add(groupId));
    const result = await apiCall('join_group', { group_id: groupId });
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      return newSet;
    });

    if (result && result.success) {
      showMessage('success', 'Groupe rejoint !');
      await loadGroups();
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, [activeTab]);

  const renderAvatar = (user: User) => {
    const avatarUrl = user.avatar_url || `${DEFAULT_AVATAR}${user.prenom}+${user.nom}`;
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
  };

  const renderUserCard = (user: User, showAction: boolean = true) => {
    const isProcessing = processingIds.has(user.id);

    return (
      <View key={user.id} style={styles.userCard}>
        {renderAvatar(user)}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.prenom} {user.nom}</Text>
        </View>
        {showAction && (
          <TouchableOpacity
            onPress={() => sendFriendRequest(user.id)}
            disabled={isProcessing}
            style={[styles.actionButton, isProcessing && styles.actionButtonDisabled]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="person-add" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRequestCard = (request: FriendRequest, type: 'received' | 'sent') => {
    const user = type === 'received' ? request.requester : request.receiver;
    if (!user) return null;

    const isProcessing = processingIds.has(request.id);

    return (
      <View key={request.id} style={styles.requestCard}>
        {renderAvatar(user)}
        <View style={styles.requestInfo}>
          <Text style={styles.userName}>{user.prenom} {user.nom}</Text>
          <Text style={styles.requestDate}>
            {new Date(request.created_at).toLocaleDateString('fr-FR')}
          </Text>
        </View>
        <View style={styles.requestActions}>
          {type === 'received' ? (
            <>
              <TouchableOpacity
                onPress={() => acceptRequest(request.id)}
                disabled={isProcessing}
                style={[styles.acceptButton, isProcessing && styles.actionButtonDisabled]}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => declineRequest(request.id)}
                disabled={isProcessing}
                style={[styles.declineButton, isProcessing && styles.actionButtonDisabled]}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => cancelRequest(request.id)}
              disabled={isProcessing}
              style={[styles.cancelButton, isProcessing && styles.actionButtonDisabled]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="close" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderGroupCard = (group: Group) => {
    const isProcessing = processingIds.has(group.id);

    return (
      <View key={group.id} style={styles.groupCard}>
        <View style={styles.groupIcon}>
          <Ionicons name="people" size={32} color="#8A2BE2" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description && (
            <Text style={styles.groupDescription} numberOfLines={2}>
              {group.description}
            </Text>
          )}
          <Text style={styles.groupMembers}>
            {group.member_count} membre{group.member_count > 1 ? 's' : ''}
          </Text>
        </View>
        {!group.is_member && (
          <TouchableOpacity
            onPress={() => joinGroup(group.id)}
            disabled={isProcessing}
            style={[styles.joinButton, isProcessing && styles.actionButtonDisabled]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.joinButtonText}>Rejoindre</Text>
            )}
          </TouchableOpacity>
        )}
        {group.is_member && (
          <View style={styles.memberBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {statusMessage.visible && (
        <View style={[styles.statusMessage, styles[`statusMessage${statusMessage.type.charAt(0).toUpperCase() + statusMessage.type.slice(1)}` as keyof typeof styles]]}>
          <Ionicons
            name={
              statusMessage.type === 'success' ? 'checkmark-circle' :
              statusMessage.type === 'error' ? 'close-circle' :
              'information-circle'
            }
            size={20}
            color="#fff"
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>{statusMessage.text}</Text>
        </View>
      )}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Ionicons
            name="people-outline"
            size={24}
            color={activeTab === 'discover' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Découvrir
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons
            name="mail-outline"
            size={24}
            color={activeTab === 'requests' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Invitations
          </Text>
          {(receivedRequests.length > 0 || sentRequests.length > 0) && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {receivedRequests.length + sentRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={24}
            color={activeTab === 'groups' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
            Groupes
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'discover' && (
          <View style={styles.section}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un utilisateur..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearch}
              />
              {isSearching && <ActivityIndicator size="small" color="#8A2BE2" />}
            </View>

            {searchQuery.length >= 2 && (
              <View style={styles.searchResults}>
                <Text style={styles.sectionTitle}>
                  {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''}
                </Text>
                {searchResults.map(user => renderUserCard(user))}
              </View>
            )}

            {searchQuery.length < 2 && (
              <>
                <Text style={styles.sectionTitle}>Suggestions d'amis</Text>
                {users.map(user => renderUserCard(user))}

                {loading && <ActivityIndicator size="large" color="#8A2BE2" style={styles.loader} />}

                {hasMoreUsers && !loading && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMoreUsers}
                  >
                    <Text style={styles.loadMoreText}>Voir plus</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {activeTab === 'requests' && (
          <View style={styles.section}>
            <View style={styles.subTabs}>
              <TouchableOpacity
                style={[styles.subTab, requestTab === 'received' && styles.subTabActive]}
                onPress={() => setRequestTab('received')}
              >
                <Text style={[styles.subTabText, requestTab === 'received' && styles.subTabTextActive]}>
                  Reçues ({receivedRequests.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, requestTab === 'sent' && styles.subTabActive]}
                onPress={() => setRequestTab('sent')}
              >
                <Text style={[styles.subTabText, requestTab === 'sent' && styles.subTabTextActive]}>
                  Envoyées ({sentRequests.length})
                </Text>
              </TouchableOpacity>
            </View>

            {requestTab === 'received' && (
              <>
                {receivedRequests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="mail-open-outline" size={64} color="#DDD" />
                    <Text style={styles.emptyText}>Aucune invitation reçue</Text>
                  </View>
                ) : (
                  receivedRequests.map(req => renderRequestCard(req, 'received'))
                )}
              </>
            )}

            {requestTab === 'sent' && (
              <>
                {sentRequests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="paper-plane-outline" size={64} color="#DDD" />
                    <Text style={styles.emptyText}>Aucune invitation envoyée</Text>
                  </View>
                ) : (
                  sentRequests.map(req => renderRequestCard(req, 'sent'))
                )}
              </>
            )}

            {loading && <ActivityIndicator size="large" color="#8A2BE2" style={styles.loader} />}
          </View>
        )}

        {activeTab === 'groups' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Groupes Messenger</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#8A2BE2" style={styles.loader} />
            ) : groups.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color="#DDD" />
                <Text style={styles.emptyText}>Aucun groupe disponible</Text>
              </View>
            ) : (
              groups.map(group => renderGroupCard(group))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  statusMessage: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    zIndex: 1000,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
      android: { elevation: 5 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    }),
  },
  statusMessageSuccess: { backgroundColor: '#10B981' },
  statusMessageError: { backgroundColor: '#EF4444' },
  statusMessageInfo: { backgroundColor: '#3B82F6' },
  statusIcon: { marginRight: 8 },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', ...Platform.select({ ios: { paddingTop: 10 } }) },
  tab: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#8A2BE2' },
  tabText: { fontSize: 12, color: '#999', marginTop: 4 },
  tabTextActive: { color: '#8A2BE2', fontWeight: '600' },
  badge: { position: 'absolute', top: 5, right: 15, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  content: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  searchResults: { marginBottom: 20 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    padding: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    }),
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E0E0E0' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '600', color: '#333' },
  actionButton: { backgroundColor: '#8A2BE2', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  actionButtonDisabled: { opacity: 0.5 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    padding: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    }),
  },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestDate: { fontSize: 12, color: '#999', marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptButton: { backgroundColor: '#10B981', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  declineButton: { backgroundColor: '#EF4444', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: '#999', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  subTabs: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#fff', borderRadius: 12, padding: 4 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  subTabActive: { backgroundColor: '#8A2BE2' },
  subTabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  subTabTextActive: { color: '#fff', fontWeight: '600' },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    }),
  },
  groupIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F0E6FF', justifyContent: 'center', alignItems: 'center' },
  groupInfo: { flex: 1, marginLeft: 12 },
  groupName: { fontSize: 16, fontWeight: '600', color: '#333' },
  groupDescription: { fontSize: 14, color: '#666', marginTop: 4 },
  groupMembers: { fontSize: 12, color: '#999', marginTop: 4 },
  joinButton: { backgroundColor: '#8A2BE2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  joinButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberBadge: { padding: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 16 },
  loader: { marginVertical: 20 },
  loadMoreButton: { backgroundColor: '#8A2BE2', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  loadMoreText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
