// MessagesScreen.tsx — v4
// Messagerie privée + groupes — Socket.IO Render

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Modal, RefreshControl,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import * as Haptics       from 'expo-haptics';
import { io, Socket }     from 'socket.io-client';
import ChatBox            from '../components/ChatBox';

const WS_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

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

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
      <Ionicons name={icon as any} size={60} color="#ccc" />
      <Text style={{ fontSize: 16, color: '#999', marginTop: 15 }}>{text}</Text>
    </View>
  );
}

async function api(action: string, userId: string, token: string, extra?: any) {
  const res = await fetch(`${WS_BASE}/messages`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, user_id: userId, access_token: token, ...extra }),
  });
  return res.json();
}
async function groupsApi(action: string, userId: string, token: string, extra?: any) {
  const res = await fetch(`${WS_BASE}/groups`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, user_id: userId, access_token: token, ...extra }),
  });
  return res.json();
}

export default function MessagesScreen({ onChatModeChange }: MessagesScreenProps = {}) {
  const [viewMode,  setViewMode]  = useState<ViewMode>('tabs');
  const [activeTab, setActiveTab] = useState<TabMode>('history');
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [userId,      setUserId]      = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<User[]>([]);
  const [allFriends,    setAllFriends]    = useState<User[]>([]);
  const [groupSubTab,  setGroupSubTab]  = useState<GroupSubTab>('mine');
  const [myGroups,     setMyGroups]     = useState<GroupItem[]>([]);
  const [allGroups,    setAllGroups]    = useState<GroupItem[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupAction,  setGroupAction]  = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const listSocketRef = useRef<Socket | null>(null);
  const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  useEffect(() => {
    initSession();
    return () => { listSocketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) return;
    loadAllData();
    updatePresence(true);
    setupListSocket();
    return () => { listSocketRef.current?.disconnect(); updatePresence(false); };
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'groups' && userId) {
      groupSubTab === 'mine' ? loadMyGroups() : loadAllGroups();
    }
  }, [activeTab, groupSubTab, userId]);

  const initSession = async () => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) { const s = JSON.parse(raw); setUserId(s.user.id); setAccessToken(s.access_token); }
    } catch {} finally { setLoading(false); }
  };

  const setupListSocket = useCallback(() => {
    listSocketRef.current?.disconnect();
    const socket = io(`${WS_BASE}/private-chat`, { transports: ['websocket'], reconnectionDelay: 2000 });
    socket.on('connect',    () => console.log('[MessagesScreen] Socket connecté'));
    socket.on('disconnect', () => console.log('[MessagesScreen] Socket déconnecté'));
    socket.on('presence-update', () => { loadOnlineFriends(); loadAllFriends(); });
    listSocketRef.current = socket;
  }, [userId]);

  const loadAllData = useCallback(async () => {
    await Promise.all([loadConversations(), loadOnlineFriends(), loadAllFriends(), loadMyGroups()]);
  }, [userId, accessToken]);

  const loadConversations = useCallback(async () => {
    if (!userId || !accessToken) return;
    try { const d = await api('getConversations', userId, accessToken); if (d.success) setConversations(d.conversations ?? []); } catch {}
  }, [userId, accessToken]);

  const loadOnlineFriends = useCallback(async () => {
    if (!userId || !accessToken) return;
    try { const d = await api('getFriendsOnline', userId, accessToken); if (d.success) setOnlineFriends(d.friends ?? []); } catch {}
  }, [userId, accessToken]);

  const loadAllFriends = useCallback(async () => {
    if (!userId || !accessToken) return;
    try { const d = await api('getFriends', userId, accessToken); if (d.success) setAllFriends(d.friends ?? []); } catch {}
  }, [userId, accessToken]);

  const loadMyGroups = useCallback(async () => {
    if (!userId || !accessToken) return;
    setGroupLoading(true);
    try { const d = await groupsApi('getUserGroups', userId, accessToken); if (d.success) setMyGroups(d.groups ?? []); }
    catch {} finally { setGroupLoading(false); }
  }, [userId, accessToken]);

  const loadAllGroups = useCallback(async () => {
    if (!userId || !accessToken) return;
    setGroupLoading(true);
    try { const d = await groupsApi('getAllGroups', userId, accessToken); if (d.success) setAllGroups(d.groups ?? []); }
    catch {} finally { setGroupLoading(false); }
  }, [userId, accessToken]);

  const updatePresence = async (online: boolean) => {
    if (!userId || !accessToken) return;
    try { await api('updatePresence', userId, accessToken, { is_online: online }); } catch {}
  };

  const onRefresh = async () => { haptic(); setRefreshing(true); await loadAllData(); setRefreshing(false); };

  const joinGroup = async (group: GroupItem) => {
    setGroupAction(group.id);
    try { await groupsApi('joinGroup', userId, accessToken, { group_id: group.id }); await Promise.all([loadMyGroups(), loadAllGroups()]); }
    catch {} finally { setGroupAction(null); }
  };

  const askLeaveGroup = (group: GroupItem) => {
    // Confirmation handled inline
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setGroupAction(group.id);
    groupsApi('leaveGroup', userId, accessToken, { group_id: group.id })
      .then(() => Promise.all([loadMyGroups(), loadAllGroups()]))
      .catch(() => {})
      .finally(() => setGroupAction(null));
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
      const d = await api('getOrCreateConversation', userId, accessToken, { friend_id: friend.id });
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
    const date = new Date(d), now = new Date();
    const m = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (m < 1) return "A l'instant"; if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    const day = Math.floor(h / 24); if (day < 7) return `${day}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const renderAvatar = (user: User | undefined, size = 50) => {
    if (!user) return null;
    return (
      <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[S.avatarText, { fontSize: size / 2.5 }]}>{user.prenom.charAt(0)}{user.nom.charAt(0)}</Text>
        {user.isOnline && <View style={[S.onlineIndicator, { width: size / 4, height: size / 4, borderRadius: size / 8, bottom: size / 20, right: size / 20 }]} />}
      </View>
    );
  };

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  if (viewMode === 'chat' && activeConversation) {
    return (
      <ChatBox
        conversationId={activeConversation.id}
        conversationType={activeConversation.type}
        userId={userId}
        accessToken={accessToken}
        otherUser={activeConversation.otherUser}
        groupName={activeConversation.name}
        memberCount={activeConversation.memberCount}
        onBack={backToList}
        onNewMessage={loadConversations}
      />
    );
  }

  return (
    <View style={S.container}>
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>
        <View style={S.headerContent}>
          <Text style={S.headerTitle}>Messages</Text>
          {totalUnread > 0 && <View style={S.headerBadge}><Text style={S.headerBadgeTxt}>{totalUnread}</Text></View>}
        </View>
      </LinearGradient>

      <View style={S.tabs}>
        {([
          { key: 'history', icon: 'time-outline',          label: 'Historique' },
          { key: 'online',  icon: 'radio-button-on',       label: 'En ligne'   },
          { key: 'friends', icon: 'people-outline',        label: 'Amis'       },
          { key: 'groups',  icon: 'people-circle-outline', label: 'Groupes'    },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={[S.tab, activeTab === t.key && S.tabActive]}
            onPress={() => { haptic(); setActiveTab(t.key); }} activeOpacity={0.7}>
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
            {loading ? <ActivityIndicator color="#8A2BE2" style={{ marginTop: 40 }} />
              : conversations.length === 0 ? <EmptyState icon="chatbubbles-outline" text="Aucune conversation" />
              : conversations.map(conv => (
                <TouchableOpacity key={conv.id} style={S.item} onPress={() => openConversation(conv)} activeOpacity={0.7}>
                  {conv.type === 'private' ? renderAvatar(conv.otherUser) : <View style={[S.avatar, S.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>}
                  <View style={S.itemBody}>
                    <View style={S.itemRow}>
                      <Text style={S.itemName} numberOfLines={1}>{conv.type === 'private' ? `${conv.otherUser?.prenom} ${conv.otherUser?.nom}` : conv.name}</Text>
                      <Text style={S.itemTime}>{conv.lastMessage && formatTime(conv.lastMessage.createdAt)}</Text>
                    </View>
                    <View style={S.itemRow}>
                      <Text style={S.itemLast} numberOfLines={1}>
                        {conv.lastMessage?.isFromMe && 'Vous : '}{conv.lastMessage?.senderName && `${conv.lastMessage.senderName} : `}{conv.lastMessage?.content || 'Aucun message'}
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
            {onlineFriends.length === 0 ? <EmptyState icon="wifi-outline" text="Aucun ami en ligne" />
              : onlineFriends.map(f => (
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
            {allFriends.length === 0 ? <EmptyState icon="people-outline" text="Aucun ami" />
              : allFriends.map(f => (
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
                <TouchableOpacity key={sub} style={[S.subTab, groupSubTab === sub && S.subTabActive]}
                  onPress={() => { haptic(); setGroupSubTab(sub); }}>
                  <Text style={[S.subTabTxt, groupSubTab === sub && S.subTabTxtActive]}>
                    {sub === 'mine' ? `Mes groupes${myGroups.length > 0 ? ` (${myGroups.length})` : ''}` : 'Explorer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {groupLoading ? <ActivityIndicator color="#8A2BE2" style={{ marginTop: 40 }} />
              : groupSubTab === 'mine'
                ? myGroups.length === 0
                  ? <View><EmptyState icon="people-circle-outline" text="Vous n'etes dans aucun groupe" />
                      <TouchableOpacity onPress={() => setGroupSubTab('explore')} style={S.ctaBtn}>
                        <Text style={S.ctaBtnTxt}>Explorer les groupes</Text>
                      </TouchableOpacity></View>
                  : myGroups.map(g => (
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
                      <TouchableOpacity style={S.leaveBtn} onPress={() => askLeaveGroup(g)} disabled={groupAction === g.id}>
                        {groupAction === g.id ? <ActivityIndicator size="small" color="#DC2626" /> : <Ionicons name="exit-outline" size={20} color="#DC2626" />}
                      </TouchableOpacity>
                    </View>
                  ))
                : allGroups.length === 0 ? <EmptyState icon="search-outline" text="Aucun groupe disponible" />
                : allGroups.map(g => (
                  <View key={g.id} style={S.exploreCard}>
                    <View style={[S.avatar, S.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>
                    <View style={[S.itemBody, { marginLeft: 12 }]}>
                      <Text style={S.itemName}>{g.name}</Text>
                      <Text style={{ fontSize: 13, color: '#666' }} numberOfLines={1}>{g.description || `${g.member_count} membre${g.member_count !== 1 ? 's' : ''}`}</Text>
                    </View>
                    {g.is_member
                      ? <TouchableOpacity style={S.openBtn} onPress={() => openGroupChat(g)}><Ionicons name="chatbubbles-outline" size={15} color="#8A2BE2" /><Text style={S.openBtnTxt}>Ouvrir</Text></TouchableOpacity>
                      : <TouchableOpacity style={S.joinBtn} onPress={() => joinGroup(g)} disabled={groupAction === g.id}>
                          {groupAction === g.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={S.joinBtnTxt}>Rejoindre</Text>}
                        </TouchableOpacity>}
                  </View>
                ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 15, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerBadge: { backgroundColor: '#FF0080', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  headerBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4, position: 'relative' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#8A2BE2' },
  tabText: { fontSize: 11, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#8A2BE2', fontWeight: 'bold' },
  tabBadge: { position: 'absolute', top: 6, right: 4, backgroundColor: '#FF0080', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  section: { paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  itemBody: { flex: 1, marginLeft: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  itemTime: { fontSize: 12, color: '#999', marginLeft: 8, flexShrink: 0 },
  itemLast: { fontSize: 14, color: '#666', flex: 1 },
  groupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  leaveBtn: { padding: 16, borderLeftWidth: 1, borderLeftColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  exploreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  joinBtn: { backgroundColor: '#8A2BE2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: 'center' },
  joinBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#8A2BE2' },
  openBtnTxt: { color: '#8A2BE2', fontSize: 13, fontWeight: '600' },
  ctaBtn: { alignSelf: 'center', marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F0E8FF', borderRadius: 10 },
  ctaBtnTxt: { color: '#8A2BE2', fontWeight: '700', fontSize: 14 },
  subTabs: { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10, backgroundColor: '#F0E8FF', borderRadius: 12, padding: 4 },
  subTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  subTabActive: { backgroundColor: '#8A2BE2' },
  subTabTxt: { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  subTabTxtActive: { color: '#fff' },
  unreadBadge: { backgroundColor: '#FF0080', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  unreadBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  groupAvatar: { backgroundColor: '#FF8C00' },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  onlineIndicator: { position: 'absolute', backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
});
