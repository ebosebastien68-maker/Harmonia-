// MessagesScreen.tsx — v3
// Groupes : MES GROUPES + EXPLORER avec rejoindre/quitter

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import ChatBox from '../components/ChatBox';

const API_BASE    = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages';
const STREAM_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages-stream';
const WS_BASE     = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

type ViewMode    = 'tabs' | 'chat';
type TabMode     = 'online' | 'friends' | 'groups' | 'history';
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

// ─── Modale confirm custom (fonctionne web + mobile) ─────────────────────────
function ConfirmModal({ visible, title, message, onConfirm, onCancel, confirmLabel = 'Confirmer', danger = false }: {
  visible: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
  confirmLabel?: string; danger?: boolean;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={cm.box}>
          <Text style={cm.title}>{title}</Text>
          <Text style={cm.msg}>{message}</Text>
          <View style={cm.row}>
            <TouchableOpacity style={cm.btnCancel} onPress={onCancel}>
              <Text style={cm.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.btnConfirm, danger && cm.btnDanger]} onPress={onConfirm}>
              <Text style={cm.btnConfirmTxt}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const cm = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box:           { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 340 },
  title:         { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 10 },
  msg:           { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 20 },
  row:           { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btnCancel:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  btnCancelTxt:  { fontSize: 14, color: '#666', fontWeight: '600' },
  btnConfirm:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#8A2BE2' },
  btnDanger:     { backgroundColor: '#DC2626' },
  btnConfirmTxt: { fontSize: 14, color: '#fff', fontWeight: '700' },
});

// ─── API helper ───────────────────────────────────────────────────────────────
async function groupsApi(action: string, userId: string, token: string, extra?: any) {
  const res = await fetch(`${WS_BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, user_id: userId, access_token: token, ...extra }),
  });
  return res.json();
}

// =====================================================
export default function MessagesScreen({ onChatModeChange }: MessagesScreenProps = {}) {
  const [viewMode,   setViewMode]   = useState<ViewMode>('tabs');
  const [activeTab,  setActiveTab]  = useState<TabMode>('history');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const [confirm, setConfirm] = useState<{
    visible: boolean; title: string; message: string;
    onConfirm: () => void; confirmLabel?: string; danger?: boolean;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    initializeMessaging();
    return () => { updatePresence(false); eventSourceRef.current?.close(); };
  }, []);

  useEffect(() => { if (userId) updatePresence(true); }, [userId]);

  useEffect(() => {
    if (userId && viewMode === 'tabs') {
      setupRealtimeStream();
      return () => { eventSourceRef.current?.close(); };
    }
  }, [userId, viewMode]);

  useEffect(() => {
    if (activeTab === 'groups' && userId && accessToken) {
      if (groupSubTab === 'mine') loadMyGroups();
      else loadAllGroups();
    }
  }, [activeTab, groupSubTab, userId]);

  const initializeMessaging = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        const token  = parsed.access_token || parsed.session?.access_token || '';
        setUserId(parsed.user.id);
        setAccessToken(token);
        await loadAllData(parsed.user.id, token);
        await updatePresence(true);
      }
    } catch (e) { console.error('Init:', e); }
    finally { setLoading(false); }
  };

  const setupRealtimeStream = () => {
    eventSourceRef.current = new EventSource(`${STREAM_BASE}?user_id=${userId}`);
    eventSourceRef.current.addEventListener('connected', () =>
      console.log('✅ Connexion temps réel établie (liste)'));
    eventSourceRef.current.addEventListener('conversations-updated', () => loadConversations(userId));
    eventSourceRef.current.addEventListener('presence-updated', () => {
      loadOnlineFriends(userId); loadAllFriends(userId);
    });
    eventSourceRef.current.onerror = () => eventSourceRef.current?.close();
  };

  const loadAllData = async (uid: string, tok: string) => {
    await Promise.all([
      loadConversations(uid), loadOnlineFriends(uid),
      loadAllFriends(uid),   loadMyGroupsFor(uid, tok),
    ]);
  };

  const supaFetch = async (uid: string, body: any) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body: JSON.stringify({ ...body, user_id: uid }),
    });
    return res.json();
  };

  const loadConversations  = async (uid: string) => { try { const d = await supaFetch(uid, { action: 'get-conversations' });  if (d.success) setConversations(d.conversations); } catch {} };
  const loadOnlineFriends  = async (uid: string) => { try { const d = await supaFetch(uid, { action: 'get-friends-online' }); if (d.success) setOnlineFriends(d.friends); } catch {} };
  const loadAllFriends     = async (uid: string) => { try { const d = await supaFetch(uid, { action: 'get-all-friends' });    if (d.success) setAllFriends(d.friends); } catch {} };

  const loadMyGroupsFor = async (uid: string, tok: string) => {
    try { const d = await groupsApi('getUserGroups', uid, tok); if (d.success) setMyGroups(d.groups ?? []); } catch {}
  };

  const loadMyGroups = async () => {
    if (!userId || !accessToken) return;
    setGroupLoading(true);
    try { const d = await groupsApi('getUserGroups', userId, accessToken); if (d.success) setMyGroups(d.groups ?? []); }
    catch {} finally { setGroupLoading(false); }
  };

  const loadAllGroups = async () => {
    if (!userId || !accessToken) return;
    setGroupLoading(true);
    try { const d = await groupsApi('getAllGroups', userId, accessToken); if (d.success) setAllGroups(d.groups ?? []); }
    catch {} finally { setGroupLoading(false); }
  };

  // ── Actions groupes ───────────────────────────────────────────────────────
  const joinGroup = async (group: GroupItem) => {
    setGroupAction(group.id);
    try {
      await groupsApi('joinGroup', userId, accessToken, { group_id: group.id });
      await Promise.all([loadMyGroups(), loadAllGroups()]);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setGroupAction(null); }
  };

  const askLeaveGroup = (group: GroupItem) => {
    setConfirm({
      visible: true, danger: true, confirmLabel: 'Quitter',
      title: 'Quitter le groupe',
      message: `Quitter "${group.name}" ? Vous pourrez le rejoindre à nouveau plus tard.`,
      onConfirm: async () => {
        setConfirm(c => ({ ...c, visible: false }));
        setGroupAction(group.id);
        try {
          await groupsApi('leaveGroup', userId, accessToken, { group_id: group.id });
          await Promise.all([loadMyGroups(), loadAllGroups()]);
        } catch (e: any) { Alert.alert('Erreur', e.message); }
        finally { setGroupAction(null); }
      },
    });
  };

  const openGroupChat = (group: GroupItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setLoading(true);
      const d = await supaFetch(userId, { action: 'get-or-create-conversation', friend_id: friend.id });
      if (d.success) {
        setActiveConversation({ type: 'private', id: d.conversation_id, otherUser: friend, lastMessage: null, createdAt: new Date().toISOString() });
        setViewMode('chat'); onChatModeChange?.(true);
      }
    } catch { Alert.alert('Erreur', "Impossible d'ouvrir la conversation"); }
    finally { setLoading(false); }
  };

  const openConversation = (conv: Conversation) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveConversation(conv); setViewMode('chat'); onChatModeChange?.(true);
  };

  const updatePresence = async (online: boolean) => {
    if (!userId) return;
    try { await supaFetch(userId, { action: 'update-presence', is_online: online }); } catch {}
  };

  const onRefresh = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    await loadAllData(userId, accessToken);
    setRefreshing(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const backToList = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewMode('tabs'); setActiveConversation(null); onChatModeChange?.(false);
    loadAllData(userId, accessToken);
  };

  const formatTime = (d: string) => {
    const date = new Date(d), now = new Date(), diff = now.getTime() - date.getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
    if (m < 1) return 'À l\'instant'; if (m < 60) return `${m}min`;
    if (h < 24) return `${h}h`; if (day < 7) return `${day}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const renderAvatar = (user: User | undefined, size = 50) => {
    if (!user) return null;
    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>{user.prenom.charAt(0)}{user.nom.charAt(0)}</Text>
        {user.isOnline && <View style={[styles.onlineIndicator, { width: size / 4, height: size / 4, borderRadius: size / 8, bottom: size / 20, right: size / 20 }]} />}
      </View>
    );
  };

  // ── Vue chat ──────────────────────────────────────────────────────────────
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
      />
    );
  }

  // ── Vue liste ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <ConfirmModal
        visible={confirm.visible}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        danger={confirm.danger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(c => ({ ...c, visible: false }))}
      />

      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>💬 Messages</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing} activeOpacity={0.7}>
            {refreshing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="reload" size={24} color="#fff" />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        {[
          { key: 'history', icon: 'time-outline',          label: 'Historique' },
          { key: 'online',  icon: 'radio-button-on',       label: 'En ligne'   },
          { key: 'friends', icon: 'people-outline',        label: 'Amis'       },
          { key: 'groups',  icon: 'people-circle-outline', label: 'Groupes'    },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.activeTab]}
            onPress={() => setActiveTab(t.key as TabMode)}
            activeOpacity={0.7}
          >
            <Ionicons name={t.icon as any} size={20} color={activeTab === t.key ? '#8A2BE2' : '#999'} />
            <Text style={[styles.tabText, activeTab === t.key && styles.activeTabText]}>{t.label}</Text>
            {t.key === 'history' && conversations.reduce((s, c) => s + (c.unreadCount || 0), 0) > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{conversations.reduce((s, c) => s + (c.unreadCount || 0), 0)}</Text></View>
            )}
            {t.key === 'online' && onlineFriends.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#10B981' }]}><Text style={styles.tabBadgeText}>{onlineFriends.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* HISTORIQUE */}
        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            {conversations.length > 0 ? conversations.map(conv => (
              <TouchableOpacity key={conv.id} style={styles.listItem} onPress={() => openConversation(conv)} activeOpacity={0.7}>
                {conv.type === 'private' ? renderAvatar(conv.otherUser) : <View style={[styles.avatar, styles.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>}
                <View style={styles.listItemContent}>
                  <View style={styles.listItemHeader}>
                    <Text style={styles.listItemName}>{conv.type === 'private' ? `${conv.otherUser?.prenom} ${conv.otherUser?.nom}` : conv.name}</Text>
                    <Text style={styles.listItemTime}>{conv.lastMessage && formatTime(conv.lastMessage.createdAt)}</Text>
                  </View>
                  <View style={styles.listItemFooter}>
                    <Text style={styles.listItemMessage} numberOfLines={1}>
                      {conv.lastMessage?.isFromMe && 'Vous: '}{conv.lastMessage?.senderName && `${conv.lastMessage.senderName}: `}{conv.lastMessage?.content || 'Aucun message'}
                    </Text>
                    {(conv.unreadCount || 0) > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{conv.unreadCount}</Text></View>}
                  </View>
                </View>
              </TouchableOpacity>
            )) : <View style={styles.emptyState}><Ionicons name="chatbubbles-outline" size={60} color="#ccc" /><Text style={styles.emptyStateText}>Aucune conversation</Text></View>}
          </View>
        )}

        {/* EN LIGNE */}
        {activeTab === 'online' && (
          <View style={styles.tabContent}>
            {onlineFriends.length > 0 ? onlineFriends.map(f => (
              <TouchableOpacity key={f.id} style={styles.listItem} onPress={() => openPrivateChat(f)} activeOpacity={0.7}>
                {renderAvatar(f)}
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemName}>{f.prenom} {f.nom}</Text>
                  <View style={styles.onlineStatus}><View style={styles.onlineDot} /><Text style={styles.onlineText}>En ligne</Text></View>
                </View>
                <Ionicons name="chatbubble-outline" size={24} color="#8A2BE2" />
              </TouchableOpacity>
            )) : <View style={styles.emptyState}><Ionicons name="wifi-outline" size={60} color="#ccc" /><Text style={styles.emptyStateText}>Aucun ami en ligne</Text></View>}
          </View>
        )}

        {/* AMIS */}
        {activeTab === 'friends' && (
          <View style={styles.tabContent}>
            {allFriends.length > 0 ? allFriends.map(f => (
              <TouchableOpacity key={f.id} style={styles.listItem} onPress={() => openPrivateChat(f)} activeOpacity={0.7}>
                {renderAvatar(f)}
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemName}>{f.prenom} {f.nom}</Text>
                  <Text style={styles.listItemStatus}>{f.isOnline ? '🟢 En ligne' : '⚪ Hors ligne'}</Text>
                </View>
                <Ionicons name="chatbubble-outline" size={24} color="#8A2BE2" />
              </TouchableOpacity>
            )) : <View style={styles.emptyState}><Ionicons name="people-outline" size={60} color="#ccc" /><Text style={styles.emptyStateText}>Aucun ami</Text></View>}
          </View>
        )}

        {/* GROUPES */}
        {activeTab === 'groups' && (
          <View style={styles.tabContent}>
            {/* Sous-onglets */}
            <View style={styles.subTabs}>
              <TouchableOpacity
                style={[styles.subTab, groupSubTab === 'mine' && styles.subTabActive]}
                onPress={() => setGroupSubTab('mine')}
              >
                <Text style={[styles.subTabText, groupSubTab === 'mine' && styles.subTabTextActive]}>
                  Mes groupes {myGroups.length > 0 ? `(${myGroups.length})` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, groupSubTab === 'explore' && styles.subTabActive]}
                onPress={() => setGroupSubTab('explore')}
              >
                <Text style={[styles.subTabText, groupSubTab === 'explore' && styles.subTabTextActive]}>Explorer</Text>
              </TouchableOpacity>
            </View>

            {groupLoading
              ? <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
              : groupSubTab === 'mine'
                ? myGroups.length === 0
                  ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="people-circle-outline" size={60} color="#ccc" />
                      <Text style={styles.emptyStateText}>Vous n'êtes dans aucun groupe</Text>
                      <TouchableOpacity onPress={() => setGroupSubTab('explore')} style={styles.exploreCta}>
                        <Text style={styles.exploreCtaText}>Explorer les groupes →</Text>
                      </TouchableOpacity>
                    </View>
                  )
                  : myGroups.map(g => (
                    <View key={g.id} style={styles.groupCard}>
                      <TouchableOpacity style={styles.groupCardMain} onPress={() => openGroupChat(g)} activeOpacity={0.7}>
                        <View style={[styles.avatar, styles.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>
                        <View style={styles.listItemContent}>
                          <View style={styles.listItemHeader}>
                            <Text style={styles.listItemName}>{g.name}</Text>
                            {g.last_message && <Text style={styles.listItemTime}>{formatTime(g.last_message.created_at)}</Text>}
                          </View>
                          <Text style={styles.listItemMessage} numberOfLines={1}>
                            {g.last_message
                              ? `${g.last_message.is_from_me ? 'Vous' : g.last_message.sender_name}: ${g.last_message.content}`
                              : `${g.member_count} membre${g.member_count !== 1 ? 's' : ''}`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.leaveBtn}
                        onPress={() => askLeaveGroup(g)}
                        disabled={groupAction === g.id}
                      >
                        {groupAction === g.id
                          ? <ActivityIndicator size="small" color="#DC2626" />
                          : <Ionicons name="exit-outline" size={20} color="#DC2626" />}
                      </TouchableOpacity>
                    </View>
                  ))
                : allGroups.length === 0
                  ? <View style={styles.emptyState}><Ionicons name="search-outline" size={60} color="#ccc" /><Text style={styles.emptyStateText}>Aucun groupe disponible</Text></View>
                  : allGroups.map(g => (
                    <View key={g.id} style={styles.exploreCard}>
                      <View style={[styles.avatar, styles.groupAvatar]}><Ionicons name="people" size={24} color="#fff" /></View>
                      <View style={[styles.listItemContent, { marginLeft: 12 }]}>
                        <Text style={styles.listItemName}>{g.name}</Text>
                        <Text style={styles.listItemStatus} numberOfLines={1}>
                          {g.description || `${g.member_count} membre${g.member_count !== 1 ? 's' : ''}`}
                        </Text>
                      </View>
                      {g.is_member
                        ? (
                          <TouchableOpacity style={styles.openBtn} onPress={() => openGroupChat(g)}>
                            <Ionicons name="chatbubbles-outline" size={15} color="#8A2BE2" />
                            <Text style={styles.openBtnText}>Ouvrir</Text>
                          </TouchableOpacity>
                        )
                        : (
                          <TouchableOpacity style={styles.joinBtn} onPress={() => joinGroup(g)} disabled={groupAction === g.id}>
                            {groupAction === g.id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.joinBtnText}>Rejoindre</Text>}
                          </TouchableOpacity>
                        )}
                    </View>
                  ))}
          </View>
        )}

        {loading && <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#8A2BE2" /></View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F5F5F5' },
  header:        { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 15, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:   { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  refreshButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },

  tabsContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4, position: 'relative' },
  activeTab:     { borderBottomWidth: 3, borderBottomColor: '#8A2BE2' },
  tabText:       { fontSize: 11, color: '#999', fontWeight: '500' },
  activeTabText: { color: '#8A2BE2', fontWeight: 'bold' },
  tabBadge:      { position: 'absolute', top: 6, right: 4, backgroundColor: '#FF0080', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeText:  { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  content:    { flex: 1 },
  tabContent: { paddingVertical: 8 },

  subTabs:          { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10, backgroundColor: '#F0E8FF', borderRadius: 12, padding: 4 },
  subTab:           { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  subTabActive:     { backgroundColor: '#8A2BE2' },
  subTabText:       { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  subTabTextActive: { color: '#fff' },

  listItem:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  listItemContent: { flex: 1, marginLeft: 12 },
  listItemHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemName:    { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  listItemTime:    { fontSize: 12, color: '#999', marginLeft: 8 },
  listItemFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listItemMessage: { fontSize: 14, color: '#666', flex: 1 },
  listItemStatus:  { fontSize: 13, color: '#666', marginTop: 2 },

  groupCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  groupCardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 15 },
  leaveBtn:      { padding: 16, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#F0F0F0' },

  exploreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginHorizontal: 10, marginVertical: 5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  joinBtn:      { backgroundColor: '#8A2BE2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: 'center' },
  joinBtnText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  openBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#8A2BE2' },
  openBtnText:  { color: '#8A2BE2', fontSize: 13, fontWeight: '600' },

  exploreCta:     { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F0E8FF', borderRadius: 10 },
  exploreCtaText: { color: '#8A2BE2', fontWeight: '700', fontSize: 14 },

  onlineStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  onlineDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  onlineText:   { fontSize: 12, color: '#10B981', fontWeight: '600' },

  unreadBadge:     { backgroundColor: '#FF0080', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  avatar:          { width: 50, height: 50, borderRadius: 25, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  groupAvatar:     { backgroundColor: '#FF8C00' },
  avatarText:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  onlineIndicator: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },

  emptyState:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText:   { fontSize: 16, color: '#999', marginTop: 15 },
  loadingContainer: { padding: 40, alignItems: 'center' },
});
