// MessagesScreen.tsx — v7
// Changements vs v6 :
//   - État userRole — lu depuis le profil (session ou fetch /profile)
//   - Passé à ChatBox via prop userRole
//   - userName déjà présent en v6, conservé

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Platform, RefreshControl, TextInput,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import * as Haptics       from 'expo-haptics';
import { io, Socket }     from 'socket.io-client';
import ChatBox            from '../components/ChatBox';
import UserProfileView    from '../components/UserProfileView';

const WS_BASE      = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const SESSION_KEY  = 'harmonia_session';
const TOKEN_MARGIN = 60;

type ViewMode    = 'tabs' | 'chat';
type TabMode     = 'history' | 'online' | 'friends' | 'groups';
type GroupSubTab = 'mine' | 'explore';

interface User {
  id: string; nom: string; prenom: string;
  avatar_url: string | null; isOnline?: boolean;
}
interface GroupItem {
  id: string; name: string; description: string | null;
  created_at: string; member_count: number; is_member?: boolean;
  last_message: { content: string; created_at: string; sender_name: string; is_from_me: boolean } | null;
}
interface Conversation {
  type: 'private' | 'group'; id: string;
  otherUser?: User; name?: string; description?: string; memberCount?: number;
  lastMessage: { content: string; createdAt: string; isFromMe?: boolean; senderName?: string } | null;
  unreadCount?: number; createdAt: string;
}
interface MessagesScreenProps { onChatModeChange?: (b: boolean) => void }

// ── Helpers token ──────────────────────────────────────────────────────────────

async function getValidToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session      = JSON.parse(raw);
    const accessToken  = session?.access_token  ?? null;
    const refreshToken = session?.refresh_token  ?? null;
    const expiresAt    = session?.expires_at     ?? 0;
    if (!accessToken || !refreshToken) return null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSeconds > TOKEN_MARGIN) return accessToken;
    const res = await fetch(`${WS_BASE}/refresh-token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const { access_token, refresh_token: new_refresh, expires_at } = await res.json();
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({
      ...session, access_token, refresh_token: new_refresh ?? refreshToken, expires_at,
    }));
    return access_token;
  } catch { return null; }
}

async function handleNewTokenFromResponse(data: any): Promise<void> {
  if (!data?.new_token) return;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...JSON.parse(raw), access_token: data.new_token }));
  } catch {}
}

async function api(action: string, userId: string, extra?: any): Promise<any> {
  const token = await getValidToken();
  if (!token) return { success: false, error: 'session_expired' };
  const res   = await fetch(`${WS_BASE}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, user_id: userId, access_token: token, ...extra }),
  });
  const data = await res.json();
  await handleNewTokenFromResponse(data);
  return data;
}

async function groupsApi(action: string, userId: string, extra?: any): Promise<any> {
  const token = await getValidToken();
  if (!token) return { success: false, error: 'session_expired' };
  const res   = await fetch(`${WS_BASE}/groups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, user_id: userId, access_token: token, ...extra }),
  });
  const data = await res.json();
  await handleNewTokenFromResponse(data);
  return data;
}

// ── Composants utilitaires ─────────────────────────────────────────────────────

function LoadingText() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ fontSize: 14, color: '#999' }}>Chargement des données</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle?: string; children?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
      <Ionicons name={icon as any} size={60} color="#ccc" />
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#888', marginTop: 15, textAlign: 'center' }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 14, color: '#aaa', marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>}
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesScreen({ onChatModeChange }: MessagesScreenProps = {}) {
  const [viewMode,   setViewMode]   = useState<ViewMode>('tabs');
  const [activeTab,  setActiveTab]  = useState<TabMode>('history');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId,     setUserId]     = useState('');
  const [userName,   setUserName]   = useState('');
  const [userRole,   setUserRole]   = useState('user');   // ← NOUVEAU
  const accessTokenRef = useRef('');

  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [onlineFriends,  setOnlineFriends]  = useState<User[]>([]);
  const [allFriends,     setAllFriends]     = useState<User[]>([]);
  const [groupSubTab,    setGroupSubTab]    = useState<GroupSubTab>('mine');
  const [myGroups,       setMyGroups]       = useState<GroupItem[]>([]);
  const [allGroups,      setAllGroups]      = useState<GroupItem[]>([]);
  const [groupLoading,   setGroupLoading]   = useState(false);
  const [groupAction,    setGroupAction]    = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const listSocketRef = useRef<Socket | null>(null);

  const [searchVisible,  setSearchVisible]  = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');

  const [selectedUserId,       setSelectedUserId]       = useState<string | null>(null);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);

  const openUserProfile = (targetUserId: string) => {
    if (!targetUserId || targetUserId === userId) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUserId(targetUserId);
    setShowUserProfileModal(true);
  };

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Filtrage recherche ────────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase().trim();

  const filteredConversations = q
    ? conversations.filter(c => {
        const name = c.type === 'private'
          ? `${c.otherUser?.prenom ?? ''} ${c.otherUser?.nom ?? ''}`.toLowerCase()
          : (c.name ?? '').toLowerCase();
        return name.includes(q) || (c.lastMessage?.content ?? '').toLowerCase().includes(q);
      })
    : conversations;

  const filteredOnlineFriends = q ? onlineFriends.filter(f => `${f.prenom} ${f.nom}`.toLowerCase().includes(q)) : onlineFriends;
  const filteredAllFriends    = q ? allFriends.filter(f => `${f.prenom} ${f.nom}`.toLowerCase().includes(q))    : allFriends;
  const filteredMyGroups      = q ? myGroups.filter(g => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q)) : myGroups;
  const filteredAllGroups     = q ? allGroups.filter(g => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q)) : allGroups;

  // ── Cycle de vie ──────────────────────────────────────────────────────────────

  useEffect(() => { initSession(); }, []);

  useEffect(() => {
    if (!userId || !accessTokenRef.current) return;
    setupListSocket();
    updatePresence(userId, true);
    return () => {
      if (listSocketRef.current) { listSocketRef.current.removeAllListeners(); listSocketRef.current.disconnect(); listSocketRef.current = null; }
      updatePresence(userId, false);
    };
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'groups' && userId) {
      groupSubTab === 'mine' ? loadMyGroups() : loadAllGroups();
    }
  }, [activeTab, groupSubTab, userId]);

  useEffect(() => { setSearchQuery(''); }, [activeTab]);

  const initSession = async () => {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const s   = JSON.parse(raw);
        const uid = s?.user?.id ?? '';
        const tok = await getValidToken();
        if (uid && tok) {
          accessTokenRef.current = tok;
          const prenom = s?.user?.user_metadata?.prenom ?? s?.user?.prenom ?? '';
          const nom    = s?.user?.user_metadata?.nom    ?? s?.user?.nom    ?? '';
          setUserName(`${prenom} ${nom}`.trim() || 'Moi');
          setUserId(uid);
          await loadAllDataWith(uid, tok);
        }
      }
    } catch (e) {
      console.error('[MessagesScreen] initSession:', e);
    } finally {
      setLoading(false);
    }
  };

  const setupListSocket = useCallback(() => {
    if (listSocketRef.current) { listSocketRef.current.removeAllListeners(); listSocketRef.current.disconnect(); }
    const socket = io(`${WS_BASE}/private-chat`, { transports: ['websocket'], reconnectionDelay: 2000 });
    socket.on('connect',         () => console.log('[MessagesScreen] Socket connecté'));
    socket.on('disconnect',      () => console.log('[MessagesScreen] Socket déconnecté'));
    socket.on('presence-update', () => { loadOnlineFriends(); loadAllFriends(); });
    listSocketRef.current = socket;
  }, [userId]);

  const loadAllDataWith = async (uid: string, tok: string) => {
    await Promise.all([
      api('getConversations', uid).then(d => { if (d.success) setConversations(d.conversations ?? []); }).catch(() => {}),
      api('getFriendsOnline', uid).then(d => { if (d.success) setOnlineFriends(d.friends ?? []); }).catch(() => {}),
      api('getAllFriends',    uid).then(d => { if (d.success) setAllFriends(d.friends ?? []); }).catch(() => {}),
      groupsApi('getUserGroups', uid).then(d => { if (d.success) setMyGroups(d.groups ?? []); }).catch(() => {}),
      // Récupérer le rôle depuis /profile
      fetch(`${WS_BASE}/profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getProfile', user_id: uid, access_token: tok }),
      })
        .then(r => r.json())
        .then(d => { if (d.success && d.profile?.role) setUserRole(d.profile.role); })
        .catch(() => {}),
    ]);
  };

  const loadAllData = useCallback(async () => {
    if (!userId) return;
    await Promise.all([loadConversations(), loadOnlineFriends(), loadAllFriends(), loadMyGroups()]);
  }, [userId]);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    try { const d = await api('getConversations', userId); if (d.success) setConversations(d.conversations ?? []); } catch {}
  }, [userId]);

  const loadOnlineFriends = useCallback(async () => {
    if (!userId) return;
    try { const d = await api('getFriendsOnline', userId); if (d.success) setOnlineFriends(d.friends ?? []); } catch {}
  }, [userId]);

  const loadAllFriends = useCallback(async () => {
    if (!userId) return;
    try { const d = await api('getAllFriends', userId); if (d.success) setAllFriends(d.friends ?? []); } catch {}
  }, [userId]);

  const loadMyGroups = useCallback(async () => {
    if (!userId) return;
    setGroupLoading(true);
    try { const d = await groupsApi('getUserGroups', userId); if (d.success) setMyGroups(d.groups ?? []); } catch {}
    finally { setGroupLoading(false); }
  }, [userId]);

  const loadAllGroups = useCallback(async () => {
    if (!userId) return;
    setGroupLoading(true);
    try { const d = await groupsApi('getAllGroups', userId); if (d.success) setAllGroups(d.groups ?? []); } catch {}
    finally { setGroupLoading(false); }
  }, [userId]);

  const updatePresence = async (uid: string, online: boolean) => {
    try { await api('updatePresence', uid, { is_online: online }); } catch {}
  };

  const onRefresh = async () => {
    haptic(); setRefreshing(true);
    await loadAllData();
    if (activeTab === 'groups') groupSubTab === 'mine' ? await loadMyGroups() : await loadAllGroups();
    setRefreshing(false);
  };

  const joinGroup = async (group: GroupItem) => {
    setGroupAction(group.id);
    try { await groupsApi('joinGroup', userId, { group_id: group.id }); await Promise.all([loadMyGroups(), loadAllGroups()]); }
    catch {} finally { setGroupAction(null); }
  };

  const leaveGroup = (group: GroupItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGroupAction(group.id);
    groupsApi('leaveGroup', userId, { group_id: group.id })
      .then(() => Promise.all([loadMyGroups(), loadAllGroups()]))
      .catch(() => {}).finally(() => setGroupAction(null));
  };

  const openGroupChat = (group: GroupItem) => {
    haptic();
    setActiveConversation({
      type: 'group', id: group.id, name: group.name,
      description: group.description ?? undefined,
      memberCount: group.member_count, createdAt: group.created_at,
      lastMessage: group.last_message ? {
        content: group.last_message.content, createdAt: group.last_message.created_at,
        isFromMe: group.last_message.is_from_me,
        senderName: group.last_message.is_from_me ? undefined : group.last_message.sender_name,
      } : null,
    });
    setViewMode('chat'); onChatModeChange?.(true);
  };

  const openPrivateChat = async (friend: User) => {
    haptic();
    try {
      const d = await api('getOrCreateConversation', userId, { friend_id: friend.id });
      if (d.success) {
        setActiveConversation({ type: 'private', id: d.conversation_id, otherUser: friend, lastMessage: null, createdAt: new Date().toISOString() });
        setViewMode('chat'); onChatModeChange?.(true);
      }
    } catch {}
  };

  const openConversation = (conv: Conversation) => {
    haptic(); setActiveConversation(conv); setViewMode('chat'); onChatModeChange?.(true);
  };

  const backToList = () => {
    haptic(); setViewMode('tabs'); setActiveConversation(null); onChatModeChange?.(false); loadConversations();
  };

  const formatTime = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const m   = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (m < 1) return "À l'instant";
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const day = Math.floor(h / 24);
    if (day < 7) return `${day}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const renderAvatar = (user: User | undefined, size = 50) => {
    if (!user) return null;
    return (
      <TouchableOpacity
        onPress={() => openUserProfile(user.id)}
        activeOpacity={0.75}
        style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[S.avatarText, { fontSize: size / 2.5 }]}>
          {user.prenom.charAt(0)}{user.nom.charAt(0)}
        </Text>
        {user.isOnline && (
          <View style={[S.onlineIndicator, { width: size / 4, height: size / 4, borderRadius: size / 8, bottom: size / 20, right: size / 20 }]} />
        )}
      </TouchableOpacity>
    );
  };

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  // ── Vue chat ──────────────────────────────────────────────────────────────────

  if (viewMode === 'chat' && activeConversation && accessTokenRef.current) {
    return (
      <ChatBox
        conversationId={activeConversation.id}
        conversationType={activeConversation.type}
        userId={userId}
        userName={userName}
        userRole={userRole}          // ← NOUVEAU
        accessToken={accessTokenRef.current}
        otherUser={activeConversation.otherUser}
        groupName={activeConversation.name}
        memberCount={activeConversation.memberCount}
        onBack={backToList}
        onNewMessage={loadConversations}
        onProfilePress={openUserProfile}
      />
    );
  }

  // ── Vue liste ─────────────────────────────────────────────────────────────────

  return (
    <View style={S.container}>

      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>
        <View style={S.headerContent}>
          <Text style={S.headerTitle}>Messages</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {totalUnread > 0 && <View style={S.headerBadge}><Text style={S.headerBadgeTxt}>{totalUnread}</Text></View>}
            <TouchableOpacity
              onPress={() => { haptic(); setSearchVisible(v => !v); if (searchVisible) setSearchQuery(''); }}
              style={S.searchIconBtn}
              activeOpacity={0.75}
            >
              <Ionicons name={searchVisible ? 'close' : 'search'} size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {searchVisible && (
          <View style={S.searchBar}>
            <Ionicons name="search" size={16} color="#aaa" style={{ marginRight: 8 }} />
            <TextInput
              style={S.searchInput}
              placeholder={`Rechercher dans ${activeTab === 'history' ? 'les conversations' : activeTab === 'online' ? 'les amis en ligne' : activeTab === 'friends' ? 'mes amis' : 'les groupes'}...`}
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
        )}
      </LinearGradient>

      <View style={S.tabs}>
        {([
          { key: 'history', icon: 'time-outline',          label: 'Historique' },
          { key: 'online',  icon: 'radio-button-on',       label: 'En ligne'   },
          { key: 'friends', icon: 'people-outline',        label: 'Amis'       },
          { key: 'groups',  icon: 'people-circle-outline', label: 'Groupes'    },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={[S.tab, activeTab === t.key && S.tabActive]} onPress={() => { haptic(); setActiveTab(t.key); }} activeOpacity={0.7}>
            <Ionicons name={t.icon as any} size={20} color={activeTab === t.key ? '#8A2BE2' : '#999'} />
            <Text style={[S.tabText, activeTab === t.key && S.tabTextActive]}>{t.label}</Text>
            {t.key === 'history' && totalUnread > 0 && <View style={S.tabBadge}><Text style={S.tabBadgeTxt}>{totalUnread}</Text></View>}
            {t.key === 'online' && onlineFriends.length > 0 && <View style={[S.tabBadge, { backgroundColor: '#10B981' }]}><Text style={S.tabBadgeTxt}>{onlineFriends.length}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />}>

        {activeTab === 'history' && (
          <View style={S.section}>
            {loading ? <LoadingText />
            : filteredConversations.length === 0
              ? q
                ? <EmptyState icon="search-outline" title="Aucun résultat" subtitle={`Aucune conversation pour « ${searchQuery} »`} />
                : <EmptyState icon="chatbubbles-outline" title="Vous n'avez aucun message" subtitle="Démarrez la discussion avec vos amis" />
            : filteredConversations.map(conv => (
              <TouchableOpacity key={conv.id} style={S.item} onPress={() => openConversation(conv)} activeOpacity={0.7}>
                {conv.type === 'private'
                  ? renderAvatar(conv.otherUser)
                  : <View style={[S.avatar, S.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>
                }
                <View style={S.itemBody}>
                  <View style={S.itemRow}>
                    <Text style={S.itemName} numberOfLines={1}>
                      {conv.type === 'private' ? `${conv.otherUser?.prenom} ${conv.otherUser?.nom}` : conv.name}
                    </Text>
                    <Text style={S.itemTime}>{conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}</Text>
                  </View>
                  <View style={S.itemRow}>
                    <Text style={S.itemLast} numberOfLines={1}>
                      {conv.lastMessage?.isFromMe && 'Vous : '}
                      {conv.lastMessage?.senderName && `${conv.lastMessage.senderName} : `}
                      {conv.lastMessage?.content || 'Aucun message'}
                    </Text>
                    {(conv.unreadCount || 0) > 0 && <View style={S.unreadBadge}><Text style={S.unreadBadgeTxt}>{conv.unreadCount}</Text></View>}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'online' && (
          <View style={S.section}>
            {loading ? <LoadingText />
            : filteredOnlineFriends.length === 0
              ? q
                ? <EmptyState icon="search-outline" title="Aucun résultat" subtitle={`Aucun ami en ligne pour « ${searchQuery} »`} />
                : <EmptyState icon="wifi-outline" title="Aucun ami en ligne" />
            : filteredOnlineFriends.map(f => (
              <TouchableOpacity key={f.id} style={S.item} onPress={() => openPrivateChat(f)} activeOpacity={0.7}>
                {renderAvatar({ ...f, isOnline: true })}
                <View style={S.itemBody}>
                  <Text style={S.itemName}>{f.prenom} {f.nom}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={S.onlineDot} /><Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>En ligne</Text>
                  </View>
                </View>
                <Ionicons name="chatbubble-outline" size={22} color="#8A2BE2" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'friends' && (
          <View style={S.section}>
            {loading ? <LoadingText />
            : filteredAllFriends.length === 0
              ? q
                ? <EmptyState icon="search-outline" title="Aucun résultat" subtitle={`Aucun ami pour « ${searchQuery} »`} />
                : <EmptyState icon="people-outline" title="Aucun ami" />
            : filteredAllFriends.map(f => (
              <TouchableOpacity key={f.id} style={S.item} onPress={() => openPrivateChat(f)} activeOpacity={0.7}>
                {renderAvatar(f)}
                <View style={S.itemBody}>
                  <Text style={S.itemName}>{f.prenom} {f.nom}</Text>
                  <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{f.isOnline ? 'En ligne' : 'Hors ligne'}</Text>
                </View>
                <Ionicons name="chatbubble-outline" size={22} color="#8A2BE2" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'groups' && (
          <View style={S.section}>
            <View style={S.subTabs}>
              {(['mine', 'explore'] as const).map(sub => (
                <TouchableOpacity key={sub} style={[S.subTab, groupSubTab === sub && S.subTabActive]} onPress={() => { haptic(); setGroupSubTab(sub); }}>
                  <Text style={[S.subTabTxt, groupSubTab === sub && S.subTabTxtActive]}>
                    {sub === 'mine' ? `Mes groupes${myGroups.length > 0 ? ` (${myGroups.length})` : ''}` : 'Explorer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {groupLoading ? <LoadingText />
            : groupSubTab === 'mine'
              ? filteredMyGroups.length === 0
                ? <View>{q
                    ? <EmptyState icon="search-outline" title="Aucun résultat" subtitle={`Aucun groupe pour « ${searchQuery} »`} />
                    : <EmptyState icon="people-circle-outline" title="Vous n'êtes dans aucun groupe">
                        <TouchableOpacity onPress={() => setGroupSubTab('explore')} style={S.ctaBtn}>
                          <Text style={S.ctaBtnTxt}>Explorer les groupes</Text>
                        </TouchableOpacity>
                      </EmptyState>
                  }</View>
                : filteredMyGroups.map(g => (
                  <View key={g.id} style={S.groupCard}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 }} onPress={() => openGroupChat(g)} activeOpacity={0.7}>
                      <View style={[S.avatar, S.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>
                      <View style={S.itemBody}>
                        <View style={S.itemRow}>
                          <Text style={S.itemName} numberOfLines={1}>{g.name}</Text>
                          {g.last_message && <Text style={S.itemTime}>{formatTime(g.last_message.created_at)}</Text>}
                        </View>
                        <Text style={S.itemLast} numberOfLines={1}>
                          {g.last_message ? `${g.last_message.is_from_me ? 'Vous' : g.last_message.sender_name} : ${g.last_message.content}` : `${g.member_count} membre${g.member_count !== 1 ? 's' : ''}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.leaveBtn} onPress={() => leaveGroup(g)} disabled={groupAction === g.id}>
                      <Ionicons name="exit-outline" size={20} color={groupAction === g.id ? '#ccc' : '#DC2626'} />
                    </TouchableOpacity>
                  </View>
                ))
              : filteredAllGroups.length === 0
                ? q
                  ? <EmptyState icon="search-outline" title="Aucun résultat" subtitle={`Aucun groupe pour « ${searchQuery} »`} />
                  : <EmptyState icon="search-outline" title="Aucun groupe disponible" />
                : filteredAllGroups.map(g => (
                  <View key={g.id} style={S.exploreCard}>
                    <View style={[S.avatar, S.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>
                    <View style={[S.itemBody, { marginLeft: 12 }]}>
                      <Text style={S.itemName}>{g.name}</Text>
                      <Text style={{ fontSize: 13, color: '#666' }} numberOfLines={1}>{g.description || `${g.member_count} membre${g.member_count !== 1 ? 's' : ''}`}</Text>
                    </View>
                    {g.is_member
                      ? <TouchableOpacity style={S.openBtn} onPress={() => openGroupChat(g)}><Ionicons name="chatbubbles-outline" size={15} color="#8A2BE2" /><Text style={S.openBtnTxt}>Ouvrir</Text></TouchableOpacity>
                      : <TouchableOpacity style={S.joinBtn} onPress={() => joinGroup(g)} disabled={groupAction === g.id}><Text style={S.joinBtnTxt}>{groupAction === g.id ? '...' : 'Rejoindre'}</Text></TouchableOpacity>
                    }
                  </View>
                ))
            }
          </View>
        )}
      </ScrollView>

      {showUserProfileModal && selectedUserId && (
        <UserProfileView
          userId={selectedUserId}
          viewerId={userId}
          accessToken={accessTokenRef.current}
          asModal
          onClose={() => { setShowUserProfileModal(false); setSelectedUserId(null); }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  header:          { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 12, paddingHorizontal: 20 },
  headerContent:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:     { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerBadge:     { backgroundColor: '#FF0080', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  headerBadgeTxt:  { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  searchIconBtn:   { padding: 4 },
  searchBar:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  searchInput:     { flex: 1, fontSize: 14, color: '#fff' },
  tabs:            { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4, position: 'relative' },
  tabActive:       { borderBottomWidth: 3, borderBottomColor: '#8A2BE2' },
  tabText:         { fontSize: 11, color: '#999', fontWeight: '500' },
  tabTextActive:   { color: '#8A2BE2', fontWeight: 'bold' },
  tabBadge:        { position: 'absolute', top: 6, right: 4, backgroundColor: '#FF0080', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeTxt:     { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  section:         { paddingVertical: 8 },
  item:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  itemBody:        { flex: 1, marginLeft: 12 },
  itemRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName:        { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  itemTime:        { fontSize: 12, color: '#999', marginLeft: 8, flexShrink: 0 },
  itemLast:        { fontSize: 14, color: '#666', flex: 1 },
  groupCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  leaveBtn:        { padding: 16, borderLeftWidth: 1, borderLeftColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  exploreCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  joinBtn:         { backgroundColor: '#8A2BE2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: 'center' },
  joinBtnTxt:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  openBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#8A2BE2' },
  openBtnTxt:      { color: '#8A2BE2', fontSize: 13, fontWeight: '600' },
  ctaBtn:          { alignSelf: 'center', marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F0E8FF', borderRadius: 10 },
  ctaBtnTxt:       { color: '#8A2BE2', fontWeight: '700', fontSize: 14 },
  subTabs:         { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10, backgroundColor: '#F0E8FF', borderRadius: 12, padding: 4 },
  subTab:          { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  subTabActive:    { backgroundColor: '#8A2BE2' },
  subTabTxt:       { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  subTabTxtActive: { color: '#fff' },
  unreadBadge:     { backgroundColor: '#FF0080', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  unreadBadgeTxt:  { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  avatar:          { width: 50, height: 50, borderRadius: 25, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  groupAvatar:     { backgroundColor: '#FF8C00' },
  avatarText:      { color: '#fff', fontWeight: 'bold' },
  onlineIndicator: { position: 'absolute', backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },
  onlineDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
});
