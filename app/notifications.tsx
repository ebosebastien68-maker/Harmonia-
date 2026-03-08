/**
 * notifications.tsx — v3
 * • Sender admin masqué
 * • Design premium repensé
 * • Pagination "Voir plus"
 * • Trophées avec bannière dorée
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Haptics: any = null;
if (Platform.OS !== 'web') Haptics = require('expo-haptics');

const BACKEND = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Notif {
  id: string;
  type: 'global' | 'targeted';
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}
interface Trophy {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  awarded_at: string;
  awarder: { nom: string; prenom: string } | null;
}
type Tab = 'notifs' | 'trophees';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#F4F1FA',
  surface:  '#FFFFFF',
  purple:   '#6D28D9',
  purpleL:  '#8B5CF6',
  purple2:  '#4C1D95',
  pink:     '#EC4899',
  gold:     '#D97706',
  goldBg:   '#FFFBEB',
  goldBdr:  '#FDE68A',
  muted:    '#9CA3AF',
  text:     '#111827',
  soft:     '#4B5563',
  border:   '#E9E4F5',
  unreadBg: '#F5F0FF',
  unreadBdr:'#7C3AED',
  green:    '#059669',
  red:      '#DC2626',
};

// ── Utilitaires ────────────────────────────────────────────────────────────────
function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function haptic() {
  if (Platform.OS !== 'web' && Haptics)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

// ── Icône et couleurs selon type ───────────────────────────────────────────────
function notifTheme(type: 'global' | 'targeted') {
  return type === 'global'
    ? { icon: 'megaphone',       iconColor: C.purple, bg: '#EDE9FF', label: 'Annonce' }
    : { icon: 'person-circle',   iconColor: C.pink,   bg: '#FCE7F3', label: 'Personnel' };
}

// ══════════════════════════════════════════════════════════════════════════════
export default function NotificationsPage() {
  const router = useRouter();
  const [tab,         setTab]         = useState<Tab>('notifs');
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [trophies,    setTrophies]    = useState<Trophy[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [nextOffset,  setNextOffset]  = useState(0);
  const [error,       setError]       = useState('');

  // ── Auth ────────────────────────────────────────────────────────────────────
  const getAuth = async (): Promise<{ user_id: string; access_token: string } | null> => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (!raw) return null;
      let s = JSON.parse(raw);
      if (!s?.access_token || !s?.user?.id) return null;

      const expiresAt = s.expires_at ?? 0;
      if (Math.floor(Date.now() / 1000) > expiresAt - 60 && s.refresh_token) {
        try {
          const r = await fetch(`${BACKEND}/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: s.refresh_token }),
          });
          if (r.ok) {
            const fresh = await r.json();
            s = { ...s, ...fresh };
            await AsyncStorage.setItem('harmonia_session', JSON.stringify(s));
          }
        } catch {}
      }
      return { user_id: s.user.id, access_token: s.access_token };
    } catch { return null; }
  };

  // ── API ─────────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const auth = await getAuth();
    if (!auth) throw new Error('Non connecté');
    const res  = await fetch(`${BACKEND}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    return data;
  }, []);

  // ── Chargement initial ──────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [dn, dt] = await Promise.all([
        api({ action: 'listNotifications' }),
        api({ action: 'listTrophies' }),
      ]);
      setNotifs(dn.notifications ?? []);
      setHasMore(dn.has_more ?? false);
      setNextOffset(dn.next_offset ?? 20);
      setTrophies(dt.trophies ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api]);

  // ── Voir plus ───────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const d = await api({ action: 'listMore', offset: nextOffset });
      setNotifs(prev => [...prev, ...(d.notifications ?? [])]);
      setHasMore(d.has_more ?? false);
      setNextOffset(d.next_offset ?? nextOffset + 20);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingMore(false); }
  }, [api, loadingMore, hasMore, nextOffset]);

  useEffect(() => { loadAll(); }, []);

  const onRefresh = () => { haptic(); setRefreshing(true); loadAll(); };

  // ── Marquer lu ──────────────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    haptic();
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try { await api({ action: 'markAsRead', notification_id: id }); } catch {}
  };
  const markAllRead = async () => {
    haptic();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    try { await api({ action: 'markAllAsRead' }); } catch {}
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDU
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.root}>

      {/* ── Header gradient ── */}
      <LinearGradient colors={['#6D28D9', '#4C1D95']} style={S.header}>

        {/* Titre + retour */}
        <View style={S.headerRow}>
          <TouchableOpacity style={S.backBtn} onPress={() => { haptic(); router.back(); }}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Espace perso</Text>
            <Text style={S.headerSub}>
              {tab === 'notifs'
                ? unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout lu'
                : `${trophies.length} trophée${trophies.length > 1 ? 's' : ''}`}
            </Text>
          </View>

          {/* Badge global non-lu */}
          {unreadCount > 0 && (
            <View style={S.headerBadge}>
              <Text style={S.headerBadgeTxt}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {/* Onglets */}
        <View style={S.tabRow}>
          {([
            { key: 'notifs',   icon: 'notifications', label: 'Notifications', count: unreadCount,      badgeColor: C.pink },
            { key: 'trophees', icon: 'trophy',         label: 'Trophées',      count: trophies.length, badgeColor: C.gold },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[S.tabBtn, tab === t.key && S.tabBtnActive]}
              onPress={() => { haptic(); setTab(t.key); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon as any}
                size={15}
                color={tab === t.key ? '#FFF' : 'rgba(255,255,255,0.55)'}
              />
              <Text style={[S.tabLabel, tab === t.key && S.tabLabelActive]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[S.tabPill, { backgroundColor: t.badgeColor }]}>
                  <Text style={S.tabPillTxt}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── Erreur ── */}
      {!!error && (
        <View style={S.errBar}>
          <Ionicons name="alert-circle" size={15} color={C.red} />
          <Text style={S.errTxt} numberOfLines={1}>{error}</Text>
          <TouchableOpacity onPress={loadAll} style={S.errBtn}>
            <Text style={S.errBtnTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Loading initial ── */}
      {loading ? (
        <View style={S.loadCenter}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={S.loadTxt}>Chargement…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          showsVerticalScrollIndicator={false}
        >

          {/* ══════════════ NOTIFS ══════════════ */}
          {tab === 'notifs' && (
            <>
              {/* Action "Tout marquer lu" */}
              {unreadCount > 0 && (
                <TouchableOpacity style={S.markAllRow} onPress={markAllRead} activeOpacity={0.7}>
                  <View style={S.markAllIcon}>
                    <Ionicons name="checkmark-done" size={14} color={C.purple} />
                  </View>
                  <Text style={S.markAllTxt}>Tout marquer comme lu</Text>
                </TouchableOpacity>
              )}

              {notifs.length === 0 ? (
                <EmptyState
                  icon="notifications-off-outline"
                  title="Aucune notification"
                  sub="Vous serez notifié des annonces ici."
                />
              ) : (
                notifs.map((n, idx) => (
                  <NotifCard key={n.id} n={n} idx={idx} onPress={() => markRead(n.id)} />
                ))
              )}

              {/* Voir plus */}
              {hasMore && (
                <TouchableOpacity style={S.moreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.8}>
                  {loadingMore
                    ? <ActivityIndicator size="small" color={C.purple} />
                    : <>
                        <Ionicons name="time-outline" size={16} color={C.purple} />
                        <Text style={S.moreTxt}>Voir les anciennes</Text>
                      </>}
                </TouchableOpacity>
              )}

              {/* Fin de liste */}
              {notifs.length > 0 && !hasMore && (
                <View style={S.separator}>
                  <View style={S.sepLine} />
                  <Ionicons name="checkmark-circle" size={14} color={C.muted} />
                  <Text style={S.sepTxt}>Vous êtes à jour</Text>
                  <View style={S.sepLine} />
                </View>
              )}
            </>
          )}

          {/* ══════════════ TROPHÉES ══════════════ */}
          {tab === 'trophees' && (
            <>
              {trophies.length === 0 ? (
                <EmptyState
                  icon={null}
                  emoji="🏆"
                  title="Aucun trophée"
                  sub="Participez aux sessions pour en remporter !"
                />
              ) : (
                <>
                  {/* Bannière compteur */}
                  <LinearGradient colors={['#D97706', '#F59E0B']} style={S.trophyBanner}>
                    <Text style={S.trophyBannerEmoji}>🏆</Text>
                    <View>
                      <Text style={S.trophyBannerCount}>{trophies.length}</Text>
                      <Text style={S.trophyBannerLabel}>
                        trophée{trophies.length > 1 ? 's' : ''} remporté{trophies.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <Ionicons name="star" size={48} color="rgba(255,255,255,0.15)" />
                  </LinearGradient>

                  {trophies.map((t, i) => (
                    <TrophyCard key={t.id} t={t} rank={trophies.length - i} />
                  ))}
                </>
              )}
            </>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ── Carte notification ─────────────────────────────────────────────────────────
function NotifCard({ n, idx, onPress }: { n: Notif; idx: number; onPress: () => void }) {
  const theme = notifTheme(n.type);
  return (
    <TouchableOpacity
      style={[S.card, !n.is_read && S.cardUnread]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Barre latérale non-lu */}
      {!n.is_read && <View style={S.cardAccent} />}

      {/* Icône */}
      <View style={[S.cardIcon, { backgroundColor: theme.bg }]}>
        <Ionicons name={theme.icon as any} size={22} color={theme.iconColor} />
      </View>

      {/* Corps */}
      <View style={S.cardBody}>
        {/* Type pill + temps */}
        <View style={S.cardMeta}>
          <View style={[S.typePill, { backgroundColor: theme.bg }]}>
            <Text style={[S.typePillTxt, { color: theme.iconColor }]}>{theme.label}</Text>
          </View>
          <Text style={S.cardTime}>{fmtRelative(n.created_at)}</Text>
        </View>

        <Text style={[S.cardTitle, !n.is_read && S.cardTitleUnread]} numberOfLines={1}>
          {n.title}
        </Text>
        <Text style={S.cardContent} numberOfLines={3}>{n.content}</Text>
      </View>

      {/* Dot non-lu */}
      {!n.is_read && <View style={S.dot} />}
    </TouchableOpacity>
  );
}

// ── Carte trophée ──────────────────────────────────────────────────────────────
function TrophyCard({ t, rank }: { t: Trophy; rank: number }) {
  return (
    <View style={S.trophyCard}>
      {/* Rang */}
      <View style={S.trophyRankBadge}>
        <Text style={S.trophyRankTxt}>#{rank}</Text>
      </View>

      {/* Médaillon */}
      <LinearGradient colors={['#F59E0B', '#B45309']} style={S.trophyMedal}>
        <Text style={{ fontSize: 24 }}>🏆</Text>
      </LinearGradient>

      {/* Info */}
      <View style={S.trophyBody}>
        <Text style={S.trophyTitle}>{t.title}</Text>
        {t.description ? <Text style={S.trophyDesc}>{t.description}</Text> : null}
        {t.reason ? (
          <View style={S.trophyReasonRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={11} color={C.gold} />
            <Text style={S.trophyReason}>{t.reason}</Text>
          </View>
        ) : null}
        <Text style={S.trophyDate}>{fmtDate(t.awarded_at)}</Text>
      </View>
    </View>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ icon, emoji, title, sub }: { icon?: string | null; emoji?: string; title: string; sub: string }) {
  return (
    <View style={S.empty}>
      {emoji
        ? <Text style={{ fontSize: 72 }}>{emoji}</Text>
        : <Ionicons name={icon as any} size={72} color="#D1D5DB" />}
      <Text style={S.emptyTitle}>{title}</Text>
      <Text style={S.emptySub}>{sub}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const SHADOW_SM = Platform.select({
  ios:     { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});
const SHADOW_GOLD = Platform.select({
  ios:     { shadowColor: '#D97706', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 10 },
  android: { elevation: 4 },
  default: {},
});

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header:        { paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 0, paddingHorizontal: 18 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1, fontWeight: '600' },
  headerBadge:   { backgroundColor: C.pink, borderRadius: 14, minWidth: 26, height: 26, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  headerBadgeTxt:{ color: '#FFF', fontSize: 12, fontWeight: '900' },

  // ── Onglets ──
  tabRow:       { flexDirection: 'row', gap: 8, paddingBottom: 18 },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabLabel:     { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  tabLabelActive:{ color: '#FFF' },
  tabPill:      { borderRadius: 8, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabPillTxt:   { color: '#FFF', fontSize: 10, fontWeight: '800' },

  // ── Erreur ──
  errBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: C.red },
  errTxt:    { flex: 1, fontSize: 13, color: C.red },
  errBtn:    { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.red, borderRadius: 8 },
  errBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // ── Loading ──
  loadCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadTxt:    { fontSize: 14, color: C.muted, fontWeight: '600' },

  // ── Mark all ──
  markAllRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: '#EDE9FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  markAllIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#DDD6FE', justifyContent: 'center', alignItems: 'center' },
  markAllTxt:  { fontSize: 13, color: C.purple, fontWeight: '700' },

  // ── Notification card ──
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.surface,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 18, padding: 14, gap: 12,
    borderWidth: 1, borderColor: '#EDE9F5',
    overflow: 'hidden',
    ...SHADOW_SM,
  },
  cardUnread: {
    backgroundColor: C.unreadBg,
    borderColor: '#DDD6FE',
  },
  cardAccent:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.purple, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
  cardIcon:    { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody:    { flex: 1 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  typePill:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typePillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardTime:    { fontSize: 11, color: C.muted, fontWeight: '600' },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: C.soft, marginBottom: 4, lineHeight: 19 },
  cardTitleUnread: { color: C.text, fontWeight: '800' },
  cardContent: { fontSize: 13, color: C.muted, lineHeight: 19 },
  dot:         { width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple, marginTop: 6, flexShrink: 0 },

  // ── Voir plus / séparateur ──
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 2, marginBottom: 6, paddingVertical: 14, backgroundColor: '#EDE9FF', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6FE' },
  moreTxt: { fontSize: 14, color: C.purple, fontWeight: '700' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 20 },
  sepLine:   { flex: 1, height: 1, backgroundColor: C.border },
  sepTxt:    { fontSize: 12, color: C.muted, fontWeight: '600' },

  // ── Trophée bannière ──
  trophyBanner:      { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 22, overflow: 'hidden', ...SHADOW_GOLD },
  trophyBannerEmoji: { fontSize: 46 },
  trophyBannerCount: { fontSize: 40, fontWeight: '900', color: '#FFF', lineHeight: 44 },
  trophyBannerLabel: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },

  // ── Trophée carte ──
  trophyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.goldBg,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: C.goldBdr,
    ...SHADOW_GOLD,
  },
  trophyRankBadge: { position: 'absolute', top: 10, right: 14 },
  trophyRankTxt:   { fontSize: 11, color: C.gold, fontWeight: '800' },
  trophyMedal:     { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  trophyBody:      { flex: 1 },
  trophyTitle:     { fontSize: 15, fontWeight: '800', color: '#92400E', marginBottom: 3 },
  trophyDesc:      { fontSize: 13, color: '#78350F', lineHeight: 18, marginBottom: 4 },
  trophyReasonRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  trophyReason:    { fontSize: 12, color: C.gold, fontStyle: 'italic', flex: 1 },
  trophyDate:      { fontSize: 11, color: '#B45309', fontWeight: '600' },

  // ── Empty ──
  empty:      { alignItems: 'center', paddingTop: 80, paddingBottom: 40, gap: 12 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: C.soft },
  emptySub:   { fontSize: 14, color: C.muted, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
});
