import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import VueProfil from './VueProfil';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/friends';

type TabName = 'suggestions' | 'search' | 'requests' | 'groups';

interface User {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  requester: User;
  receiver: User;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count: number;
  is_member: boolean;
}

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<TabName>('suggestions');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [suggestionsOffset, setSuggestionsOffset] = useState(0);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);

  // Search
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // Requests
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);

  // Groups
  const [groups, setGroups] = useState<Group[]>([]);

  // Pending actions
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInitialData();
  }, [activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'suggestions':
          await loadSuggestions(0);
          break;
        case 'requests':
          await loadRequests();
          break;
        case 'groups':
          await loadGroups();
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async (offset: number) => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-suggestions',
          user_id: parsed.user.id,
          offset: offset,
          limit: 20,
        }),
      });

      const data = await response.json();

      if (data.success && data.users) {
        if (offset === 0) {
          setSuggestions(data.users);
        } else {
          setSuggestions(prev => [...prev, ...data.users]);
        }
        setSuggestionsOffset(offset);
        setHasMoreSuggestions(data.users.length === 20);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const loadMoreSuggestions = async () => {
    if (!hasMoreSuggestions || loadingMore) return;

    setLoadingMore(true);
    await loadSuggestions(suggestionsOffset + 20);
    setLoadingMore(false);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'search-users',
          user_id: parsed.user.id,
          query: searchQuery.trim(),
        }),
      });

      const data = await response.json();

      if (data.success && data.users) {
        setSearchResults(data.users);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const loadRequests = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-requests',
          user_id: parsed.user.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReceivedRequests(data.received || []);
        setSentRequests(data.sent || []);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-groups',
          user_id: parsed.user.id,
        }),
      });

      const data = await response.json();

      if (data.success && data.groups) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (pendingActions.has(targetUserId)) return;

    setPendingActions(prev => new Set(prev).add(targetUserId));

    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'send-request',
          user_id: parsed.user.id,
          target_user_id: targetUserId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        loadInitialData();
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setPendingActions(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (pendingActions.has(requestId)) return;

    setPendingActions(prev => new Set(prev).add(requestId));

    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'accept-request',
          user_id: parsed.user.id,
          request_id: requestId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        loadRequests();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setPendingActions(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const cancelRequest = async (requestId: string) => {
    if (pendingActions.has(requestId)) return;

    setPendingActions(prev => new Set(prev).add(requestId));

    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'cancel-request',
          user_id: parsed.user.id,
          request_id: requestId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        loadRequests();
      }
    } catch (error) {
      console.error('Error canceling request:', error);
    } finally {
      setPendingActions(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const joinGroup = async (groupId: string) => {
    if (pendingActions.has(groupId)) return;

    setPendingActions(prev => new Set(prev).add(groupId));

    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'join-group',
          user_id: parsed.user.id,
          group_id: groupId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        loadGroups();
      }
    } catch (error) {
      console.error('Error joining group:', error);
    } finally {
      setPendingActions(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handleTabPress = (tab: TabName) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tab);
  };

  const getInitials = (nom: string, prenom: string) => {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'supreme': return '#FF0080';
      case 'adminpro': return '#FFD700';
      case 'admin': return '#8A2BE2';
      case 'userpro': return '#10B981';
      default: return '#999';
    }
  };

  const renderAvatar = (user: User) => {
    if (user.avatar_url) {
      return <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />;
    }
    return (
      <View style={[styles.userAvatarPlaceholder, { backgroundColor: getRoleColor(user.role) }]}>
        <Text style={styles.userAvatarText}>{getInitials(user.nom, user.prenom)}</Text>
      </View>
    );
  };

  const renderUserCard = (user: User, showSendButton: boolean = true) => {
    const isPending = pendingActions.has(user.id);

    return (
      <View key={user.id} style={styles.userCard}>
        <TouchableOpacity
          onPress={() => setSelectedUserId(user.id)}
          style={styles.userInfo}
        >
          {renderAvatar(user)}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.prenom} {user.nom}</Text>
          </View>
        </TouchableOpacity>
        {showSendButton && (
          <TouchableOpacity
            style={[styles.sendButton, isPending && styles.sendButtonDisabled]}
            onPress={() => sendFriendRequest(user.id)}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="person-add" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRequestCard = (req: FriendRequest, isSent: boolean = false) => {
    const isPending = pendingActions.has(req.id);
    const user = isSent ? req.receiver : req.requester;

    return (
      <View key={req.id} style={isSent ? styles.sentCard : styles.requestCard}>
        <TouchableOpacity
          onPress={() => setSelectedUserId(user.id)}
          style={styles.userInfo}
        >
          {renderAvatar(user)}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {user.prenom} {user.nom}
            </Text>
            <Text style={styles.requestTime}>
              {isSent ? 'En attente...' : new Date(req.created_at).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
        {isSent ? (
          <TouchableOpacity
            style={[styles.cancelButton, isPending && styles.buttonDisabled]}
            onPress={() => cancelRequest(req.id)}
            disabled={isPending}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.acceptButton, isPending && styles.buttonDisabled]}
              onPress={() => acceptFriendRequest(req.id)}
              disabled={isPending}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, isPending && styles.buttonDisabled]}
              onPress={() => cancelRequest(req.id)}
              disabled={isPending}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSuggestions = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const paddingToBottom = 20;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
          loadMoreSuggestions();
        }
      }}
      scrollEventThrottle={400}
    >
      <Text style={styles.sectionTitle}>Suggestions d'amis</Text>
      {loading && suggestions.length === 0 ? (
        <ActivityIndicator size="large" color="#8A2BE2" style={styles.loader} />
      ) : suggestions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={60} color="#CCC" />
          <Text style={styles.emptyText}>Aucune suggestion</Text>
        </View>
      ) : (
        <>
          {suggestions.map(user => renderUserCard(user))}
          {loadingMore && (
            <ActivityIndicator size="small" color="#8A2BE2" style={styles.loaderMore} />
          )}
          {!hasMoreSuggestions && suggestions.length >= 20 && (
            <Text style={styles.endText}>Fin des suggestions</Text>
          )}
        </>
      )}
    </ScrollView>
  );

  const renderSearch = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un utilisateur..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchUsers}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
        <Text style={styles.searchButtonText}>Rechercher</Text>
      </TouchableOpacity>
      <ScrollView style={styles.searchResults}>
        {searchResults.length === 0 && searchQuery.length > 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>Aucun résultat</Text>
          </View>
        ) : (
          searchResults.map(user => renderUserCard(user))
        )}
      </ScrollView>
    </View>
  );

  const renderRequests = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Demandes reçues */}
      <Text style={styles.sectionTitle}>Demandes reçues ({receivedRequests.length})</Text>
      {receivedRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={60} color="#CCC" />
          <Text style={styles.emptyText}>Aucune demande reçue</Text>
        </View>
      ) : (
        receivedRequests.map(req => renderRequestCard(req, false))
      )}

      {/* Demandes envoyées */}
      <Text style={styles.sectionTitle}>Demandes envoyées ({sentRequests.length})</Text>
      {sentRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="paper-plane-outline" size={60} color="#CCC" />
          <Text style={styles.emptyText}>Aucune demande envoyée</Text>
        </View>
      ) : (
        sentRequests.map(req => renderRequestCard(req, true))
      )}
    </ScrollView>
  );

  const renderGroups = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Groupes Messenger ({groups.length})</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#8A2BE2" style={styles.loader} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={60} color="#CCC" />
          <Text style={styles.emptyText}>Aucun groupe</Text>
        </View>
      ) : (
        groups.map(group => {
          const isPending = pendingActions.has(group.id);
          return (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupIcon}>
                <Ionicons name="people" size={30} color="#8A2BE2" />
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
                  style={[styles.joinButton, isPending && styles.buttonDisabled]}
                  onPress={() => joinGroup(group.id)}
                  disabled={isPending}
                >
                  {isPending ? (
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
        })
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <Text style={styles.headerTitle}>Amis & Groupes</Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => handleTabPress('suggestions')}
        >
          <Ionicons
            name="people"
            size={20}
            color={activeTab === 'suggestions' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
            Suggestions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => handleTabPress('search')}
        >
          <Ionicons
            name="search"
            size={20}
            color={activeTab === 'search' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Recherche
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => handleTabPress('requests')}
        >
          <Ionicons
            name="mail"
            size={20}
            color={activeTab === 'requests' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Demandes
          </Text>
          {(receivedRequests.length + sentRequests.length) > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {receivedRequests.length + sentRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => handleTabPress('groups')}
        >
          <Ionicons
            name="chatbubbles"
            size={20}
            color={activeTab === 'groups' ? '#8A2BE2' : '#999'}
          />
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groupes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'suggestions' && renderSuggestions()}
      {activeTab === 'search' && renderSearch()}
      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'groups' && renderGroups()}

      {/* Modal VueProfil */}
      <VueProfil
        visible={selectedUserId !== null}
        userId={selectedUserId || ''}
        onClose={() => setSelectedUserId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabs: {
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
    gap: 5,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#8A2BE2',
  },
  tabText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#8A2BE2',
  },
  tabBadge: {
    position: 'absolute',
    top: 5,
    right: 10,
    backgroundColor: '#FF0080',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#8A2BE2',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#8A2BE2',
    marginHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchResults: {
    flex: 1,
    marginTop: 10,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0E6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  groupDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  groupMembers: {
    fontSize: 11,
    color: '#999',
    marginTop: 3,
  },
  joinButton: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberBadge: {
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
  loader: {
    marginTop: 50,
  },
  loaderMore: {
    marginVertical: 20,
  },
  endText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    paddingVertical: 20,
  },
});
