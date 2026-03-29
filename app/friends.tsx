import React, { useState, useEffect, useCallback } from 'react';
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
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import VueProfil from './VueProfil';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/friends';

const COLORS = {
  primary:      '#7B1FA2',
  primaryLight: '#9C27B0',
  primaryDark:  '#4A0072',
  accent:       '#E040FB',
  success:      '#00C853',
  error:        '#FF1744',
  warning:      '#FFD600',
  bg:           '#F3E5F5',
  card:         '#FFFFFF',
  border:       '#E1BEE7',
  textPrimary:  '#1A0033',
  textSecondary:'#6D4C7D',
  textMuted:    '#AB8FBB',
  badge:        '#FF1744',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type TabName = 'suggestions' | 'search' | 'requests';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (nom: string, prenom: string) =>
  `${(prenom ?? '').charAt(0)}${(nom ?? '').charAt(0)}`.toUpperCase();

const getRoleBadge = (role: string): { color: string; icon: string } => {
  switch (role) {
    case 'supreme':  return { color: '#FF1744', icon: '👑' };
    case 'adminpro': return { color: '#FFD600', icon: '⭐' };
    case 'admin':    return { color: COLORS.primary, icon: '🛡️' };
    case 'userpro':  return { color: COLORS.success, icon: '✦' };
    default:         return { color: COLORS.textMuted, icon: '' };
  }
};

const haptic = (type: 'light' | 'medium' | 'success') => {
  if (Platform.OS === 'web') return;
  if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ─── API call ─────────────────────────────────────────────────────────────────
async function apiFriends(body: Record<string, any>) {
  const session = await AsyncStorage.getItem('harmonia_session');
  if (!session) throw new Error('Session introuvable — reconnectez-vous');
  const { access_token } = JSON.parse(session);

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token }),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ user, size = 50 }: { user: User; size?: number }) {
  const { color } = getRoleBadge(user.role);
  return user.avatar_url ? (
    <Image
      source={{ uri: user.avatar_url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <LinearGradient
      colors={[color, COLORS.primaryDark]}
      style={{
        width: size, height: size, borderRadius: size / 2,
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.32, fontWeight: '700' }}>
        {getInitials(user.nom, user.prenom)}
      </Text>
    </LinearGradient>
  );
}

function RolePill({ role }: { role: string }) {
  const { color, icon } = getRoleBadge(role);
  if (!icon) return null;
  return (
    <View style={[pillStyles.pill, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[pillStyles.text, { color }]}>{icon} {role}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, marginTop: 3 },
  text: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const [activeTab, setActiveTab]         = useState<TabName>('suggestions');
  const [refreshing, setRefreshing]       = useState(false);
  const [loading, setLoading]             = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  // Suggestions
  const [suggestions, setSuggestions]       = useState<User[]>([]);
  const [suggestionsOffset, setSuggestionsOffset] = useState(0);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);

  // Search
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching]         = useState(false);

  // Requests
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests]         = useState<FriendRequest[]>([]);

  useEffect(() => { loadTab(); }, [activeTab]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (activeTab === 'suggestions') await loadSuggestions(0);
      else if (activeTab === 'requests') await loadRequests();
    } finally {
      setLoading(false);
    }
  };

  // ── Suggestions ─────────────────────────────────────────────────────────────
  const loadSuggestions = async (offset: number) => {
    try {
      const data = await apiFriends({ action: 'get-suggestions', offset, limit: 20 });
      if (data.success && data.users) {
        if (offset === 0) setSuggestions(data.users);
        else setSuggestions(prev => [...prev, ...data.users]);
        setSuggestionsOffset(offset);
        setHasMoreSuggestions(data.users.length === 20 && offset + 20 < 100);
      }
    } catch (e) { console.error('[loadSuggestions]', e); }
  };

  const loadMoreSuggestions = async () => {
    if (!hasMoreSuggestions || loadingMore) return;
    setLoadingMore(true);
    await loadSuggestions(suggestionsOffset + 20);
    setLoadingMore(false);
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const searchUsers = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await apiFriends({ action: 'search-users', query: searchQuery.trim() });
      if (data.success) setSearchResults(data.users ?? []);
    } catch (e) { console.error('[searchUsers]', e); }
    finally { setSearching(false); }
  };

  // ── Requests ────────────────────────────────────────────────────────────────
  const loadRequests = async () => {
    try {
      const data = await apiFriends({ action: 'get-requests' });
      if (data.success) {
        setReceivedRequests(data.received ?? []);
        setSentRequests(data.sent ?? []);
      }
    } catch (e) { console.error('[loadRequests]', e); }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const withPending = (id: string, fn: () => Promise<void>) => async () => {
    if (pendingActions.has(id)) return;
    setPendingActions(prev => new Set(prev).add(id));
    try { await fn(); }
    finally {
      setPendingActions(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const sendRequest = (targetId: string) => withPending(targetId, async () => {
    haptic('medium');
    const data = await apiFriends({ action: 'send-request', target_user_id: targetId });
    if (data.success) {
      setSuggestions(prev => prev.filter(u => u.id !== targetId));
      setSearchResults(prev => prev.filter(u => u.id !== targetId));
    }
  })();

  const acceptRequest = (requestId: string) => withPending(requestId, async () => {
    haptic('success');
    const data = await apiFriends({ action: 'accept-request', request_id: requestId });
    if (data.success) await loadRequests();
  })();

  const cancelRequest = (requestId: string) => withPending(requestId, async () => {
    haptic('light');
    const data = await apiFriends({ action: 'cancel-request', request_id: requestId });
    if (data.success) await loadRequests();
  })();

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTab();
    setRefreshing(false);
  };

  const totalRequests = receivedRequests.length + sentRequests.length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderUserCard = (user: User) => {
    const isPending = pendingActions.has(user.id);
    return (
      <TouchableOpacity
        key={user.id}
        style={styles.card}
        onPress={() => setSelectedUserId(user.id)}
        activeOpacity={0.92}
      >
        <View style={styles.cardLeft}>
          <View style={styles.avatarWrap}>
            <Avatar user={user} size={52} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {user.prenom} {user.nom}
            </Text>
            <RolePill role={user.role} />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, styles.btnPrimary, isPending && styles.btnDisabled]}
          onPress={() => sendRequest(user.id)}
          disabled={isPending}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="person-add" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderRequestCard = (req: FriendRequest, isSent: boolean) => {
    const isPending = pendingActions.has(req.id);
    const user = isSent ? req.receiver : req.requester;
    return (
      <View key={req.id} style={[styles.card, isSent && styles.cardSent]}>
        <TouchableOpacity
          style={styles.cardLeft}
          onPress={() => setSelectedUserId(user.id)}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrap}>
            <Avatar user={user} size={52} />
            {!isSent && (
              <View style={styles.statusDot} />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {user.prenom} {user.nom}
            </Text>
            <Text style={[styles.cardSub, isSent && { color: COLORS.warning }]}>
              {isSent
                ? '⏳ En attente de réponse'
                : `📅 ${new Date(req.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}`
              }
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          {isSent ? (
            <TouchableOpacity
              style={[styles.tagBtn, styles.tagBtnError, isPending && styles.btnDisabled]}
              onPress={() => cancelRequest(req.id)}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.tagBtnText}>Annuler</Text>
              }
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.iconBtn, styles.btnSuccess, isPending && styles.btnDisabled]}
                onPress={() => acceptRequest(req.id)}
                disabled={isPending}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.btnError, isPending && styles.btnDisabled]}
                onPress={() => cancelRequest(req.id)}
                disabled={isPending}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // ─── Tab: Suggestions ────────────────────────────────────────────────────────
  const renderSuggestions = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
          loadMoreSuggestions();
        }
      }}
      scrollEventThrottle={300}
    >
      {loading && suggestions.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : suggestions.length === 0 ? (
        <EmptyState icon="people-outline" text="Aucune suggestion pour l'instant" />
      ) : (
        <>
          <SectionHeader
            icon="sparkles"
            title="Personnes que vous pourriez connaître"
            count={suggestions.length}
          />
          {suggestions.map(renderUserCard)}
          {loadingMore && (
            <View style={styles.loadMoreRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadMoreText}>Chargement…</Text>
            </View>
          )}
          {!hasMoreSuggestions && suggestions.length >= 20 && (
            <Text style={styles.endText}>— Fin des suggestions —</Text>
          )}
        </>
      )}
    </ScrollView>
  );

  // ─── Tab: Search ─────────────────────────────────────────────────────────────
  const renderSearch = () => (
    <View style={styles.tabContent}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nom, prénom…"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchUsers}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
          {searching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="search" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent}>
        {searching ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : searchResults.length === 0 && searchQuery.length > 0 ? (
          <EmptyState icon="search-outline" text={`Aucun résultat pour « ${searchQuery} »`} />
        ) : searchResults.length > 0 ? (
          <>
            <SectionHeader icon="search" title="Résultats" count={searchResults.length} />
            {searchResults.map(renderUserCard)}
          </>
        ) : (
          <View style={styles.centered}>
            <Ionicons name="search-circle-outline" size={64} color={COLORS.border} />
            <Text style={styles.searchHint}>Tapez un nom pour rechercher</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  // ─── Tab: Requests ───────────────────────────────────────────────────────────
  const renderRequests = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          <SectionHeader icon="mail" title="Demandes reçues" count={receivedRequests.length} />
          {receivedRequests.length === 0
            ? <EmptyState icon="mail-outline" text="Aucune demande reçue" compact />
            : receivedRequests.map(r => renderRequestCard(r, false))
          }

          <SectionHeader icon="paper-plane" title="Demandes envoyées" count={sentRequests.length} />
          {sentRequests.length === 0
            ? <EmptyState icon="paper-plane-outline" text="Aucune demande envoyée" compact />
            : sentRequests.map(r => renderRequestCard(r, true))
          }
        </>
      )}
    </ScrollView>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Communauté</Text>
            <Text style={styles.headerSub}>Découvrez & connectez-vous</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="people" size={26} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(
          [
            { key: 'suggestions', icon: 'people',  label: 'Suggestions' },
            { key: 'search',      icon: 'search',   label: 'Recherche'   },
            { key: 'requests',    icon: 'mail',      label: 'Demandes'    },
          ] as const
        ).map(tab => {
          const isActive = activeTab === tab.key;
          const showBadge = tab.key === 'requests' && totalRequests > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => { haptic('light'); setActiveTab(tab.key); }}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconWrap, isActive && styles.tabIconActive]}>
                <Ionicons
                  name={isActive ? tab.icon : `${tab.icon}-outline` as any}
                  size={20}
                  color={isActive ? COLORS.primary : COLORS.textMuted}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {totalRequests > 9 ? '9+' : totalRequests}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'suggestions' && renderSuggestions()}
      {activeTab === 'search'      && renderSearch()}
      {activeTab === 'requests'    && renderRequests()}

      {/* Profile Modal */}
      <VueProfil
        visible={selectedUserId !== null}
        userId={selectedUserId || ''}
        onClose={() => setSelectedUserId(null)}
      />
    </View>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count }: { icon: any; title: string; count: number }) {
  return (
    <View style={shStyles.row}>
      <View style={shStyles.iconWrap}>
        <Ionicons name={icon} size={14} color={COLORS.primary} />
      </View>
      <Text style={shStyles.title}>{title}</Text>
      <View style={shStyles.countWrap}>
        <Text style={shStyles.count}>{count}</Text>
      </View>
    </View>
  );
}

const shStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  iconWrap: { width: 24, height: 24, borderRadius: 6, backgroundColor: COLORS.primary + '18', justifyContent: 'center', alignItems: 'center' },
  title:    { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.3 },
  countWrap:{ backgroundColor: COLORS.primary + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  count:    { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});

function EmptyState({ icon, text, compact = false }: { icon: any; text: string; compact?: boolean }) {
  return (
    <View style={[esStyles.wrap, compact && esStyles.compact]}>
      <View style={esStyles.iconBg}>
        <Ionicons name={icon} size={compact ? 32 : 48} color={COLORS.border} />
      </View>
      <Text style={esStyles.text}>{text}</Text>
    </View>
  );
}

const esStyles = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 48, gap: 12 },
  compact: { paddingVertical: 24 },
  iconBg:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.border + '33', justifyContent: 'center', alignItems: 'center' },
  text:    { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', maxWidth: 240, lineHeight: 20 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  tabIconWrap: {
    position: 'relative',
    width: 38,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  tabIconActive: {
    backgroundColor: COLORS.primary + '15',
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.badge,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  // Content
  tabContent: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
    paddingTop: 4,
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: 14,
    marginVertical: 4,
    borderRadius: 14,
    padding: 14,
    elevation: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardSent: {
    backgroundColor: '#FFFDE7',
    borderColor: '#FFD600' + '55',
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },
  cardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // Buttons
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnSuccess: {
    backgroundColor: COLORS.success,
  },
  btnError: {
    backgroundColor: COLORS.error,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  tagBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBtnError: {
    backgroundColor: COLORS.error,
  },
  tagBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    gap: 10,
    margin: 14,
    marginBottom: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },

  // Misc
  centered: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  loadMoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  endText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});
