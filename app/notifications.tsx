/**
 * notifications.tsx — v2
 * Données réelles depuis le backend
 * • Onglet Notifications : globales + ciblées pour l'user
 * • Onglet Trophées      : liste des trophées de l'user
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

// Importer Haptics uniquement sur mobile
let Haptics: any = null;
if (Platform.OS !== 'web') {
  Haptics = require('expo-haptics');
}

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Notif {
  id: string;
  type: 'global' | 'targeted';
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender: { nom: string; prenom: string } | null;
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

// ── Couleurs ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#F5F0FA',
  surface: '#FFFFFF',
  purple:  '#7C3AED',
  purpleL: '#A855F7',
  purple2: '#4C1D95',
  pink:    '#EC4899',
  gold:    '#D97706',
  goldL:   '#FEF3C7',
  muted:   '#6B7280',
  text:    '#111827',
  soft:    '#374151',
  border:  '#E5E7EB',
  unread:  '#EDE9FF',
  green:   '#059669',
};

// ── Utilitaires ────────────────────────────────────────────────────────────────
function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'À l\'instant';
  if (m < 60)  return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function haptic() {
  if (Platform.OS !== 'web' && Haptics)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const [tab,        setTab]        = useState<Tab>('notifs');
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [trophies,    setTrophies]    = useState<Trophy[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [nextOffset,  setNextOffset]  = useState(0);
  const [error,       setError]       = useState('');

  // ── Auth depuis AsyncStorage (harmonia_session) + refresh auto ──────────────
  const getAuth = async (): Promise<{ user_id: string; access_token: string } | null> => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (!raw) return null;
      let session = JSON.parse(raw);
      if (!session?.access_token || !session?.user?.id) return null;

      // Refresh si expiré (expires_at en secondes Unix)
      const expiresAt = session.expires_at ?? 0;
      const nowSec    = Math.floor(Date.now() / 1000);
      if (expiresAt - nowSec < 60 && session.refresh_token) {
        try {
          const r = await fetch(`${BACKEND_URL}/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });
          if (r.ok) {
            const fresh = await r.json();
            session = { ...session, ...fresh };
            await AsyncStorage.setItem('harmonia_session', JSON.stringify(session));
          }
        } catch {}
      }

      return { user_id: session.user.id, access_token: session.access_token };
    } catch { return null; }
  };

  // ── API ──────────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const auth = await getAuth();
    if (!auth) throw new Error('Non connecté');
    const res = await fetch(`${BACKEND_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    return data;
  }, []);

  // ── Chargement ───────────────────────────────────────────────────────────────
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  // ── Voir Plus — charge les notifs lues suivantes ──────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const d = await api({ action: 'listMore', offset: nextOffset });
      setNotifs(prev => [...prev, ...(d.notifications ?? [])]);
      setHasMore(d.has_more ?? false);
      setNextOffset(d.next_offset ?? nextOffset + 20);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [api, loadingMore, hasMore, nextOffset]);

  useEffect(() => { loadAll(); }, []);

  const onRefresh = () => { haptic(); setRefreshing(true); loadAll(); };

  // ── Marquer comme lu ─────────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    haptic();
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try { await api({ action: 'markAsRead', notification_id: id }); }
    catch {}
  };

  const markAllRead = async () => {
    haptic();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    try { await api({ action: 'markAllAsRead' }); }
    catch {}
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  // ── RENDU ────────────────────────────────────────────────────────────────────
  return (
    <View style={S.container}>

      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#4C1D95']} style={S.header}>
        <View style={S.headerRow}>
          <TouchableOpacity style={S.backBtn} onPress={() => { haptic(); router.back(); }}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Espace perso</Text>
          <View style={S.headerRight}>
            {unreadCount > 0 && tab === 'notifs' && (
              <View style={S.badge}>
                <Text style={S.badgeTxt}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Onglets dans le header */}
        <View style={S.tabRow}>
          <TouchableOpacity
            style={[S.tabBtn, tab === 'notifs' && S.tabBtnActive]}
            onPress={() => { haptic(); setTab('notifs'); }}
          >
            <Ionicons name="notifications" size={16} color={tab === 'notifs' ? '#FFF' : 'rgba(255,255,255,0.6)'} />
            <Text style={[S.tabTxt, tab === 'notifs' && S.tabTxtActive]}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={S.tabBadge}><Text style={S.tabBadgeTxt}>{unreadCount}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.tabBtn, tab === 'trophees' && S.tabBtnActive]}
            onPress={() => { haptic(); setTab('trophees'); }}
          >
            <Ionicons name="trophy" size={16} color={tab === 'trophees' ? '#FFF' : 'rgba(255,255,255,0.6)'} />
            <Text style={[S.tabTxt, tab === 'trophees' && S.tabTxtActive]}>Trophées</Text>
            {trophies.length > 0 && (
              <View style={[S.tabBadge, { backgroundColor: '#D97706' }]}>
                <Text style={S.tabBadgeTxt}>{trophies.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Erreur */}
      {error ? (
        <View style={S.errBanner}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={S.errTxt}>{error}</Text>
          <TouchableOpacity onPress={loadAll}><Text style={S.errRetry}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={S.loadWrap}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={S.loadTxt}>Chargement…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
        >

          {/* ══ NOTIFICATIONS ══ */}
          {tab === 'notifs' && (
            <View>
              {/* Barre d'action */}
              {notifs.length > 0 && unreadCount > 0 && (
                <TouchableOpacity style={S.markAllRow} onPress={markAllRead}>
                  <Ionicons name="checkmark-done" size={16} color={C.purple} />
                  <Text style={S.markAllTxt}>Tout marquer comme lu</Text>
                </TouchableOpacity>
              )}

              {notifs.length === 0 ? (
                <View style={S.empty}>
                  <Ionicons name="notifications-off-outline" size={72} color="#D1D5DB" />
                  <Text style={S.emptyTitle}>Aucune notification</Text>
                  <Text style={S.emptySub}>Vous êtes à jour !</Text>
                </View>
              ) : (
                notifs.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={[S.notifCard, !n.is_read && S.notifCardUnread]}
                    onPress={() => markRead(n.id)}
                    activeOpacity={0.75}
                  >
                    {/* Icône */}
                    <View style={[S.notifIcon, { backgroundColor: n.type === 'global' ? '#EDE9FF' : '#FEF3C7' }]}>
                      <Ionicons
                        name={n.type === 'global' ? 'globe' : 'person'}
                        size={20}
                        color={n.type === 'global' ? C.purple : C.gold}
                      />
                    </View>

                    {/* Contenu */}
                    <View style={S.notifBody}>
                      <View style={S.notifTopRow}>
                        <Text style={S.notifTitle} numberOfLines={1}>{n.title}</Text>
                        <Text style={S.notifTime}>{fmtRelative(n.created_at)}</Text>
                      </View>
                      <Text style={S.notifMsg} numberOfLines={2}>{n.content}</Text>
                      {n.sender && (
                        <Text style={S.notifSender}>
                          <Ionicons name="person-circle-outline" size={12} color={C.muted} />
                          {' '}{n.sender.prenom} {n.sender.nom}
                        </Text>
                      )}
                    </View>

                    {/* Point non lu */}
                    {!n.is_read && <View style={S.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}

              {/* Bouton Voir Plus */}
              {hasMore && (
                <TouchableOpacity
                  style={S.loadMoreBtn}
                  onPress={loadMore}
                  disabled={loadingMore}
                  activeOpacity={0.75}
                >
                  {loadingMore
                    ? <ActivityIndicator size="small" color={C.purple} />
                    : <>
                        <Ionicons name="chevron-down-circle-outline" size={18} color={C.purple} />
                        <Text style={S.loadMoreTxt}>Voir les anciennes notifications</Text>
                      </>}
                </TouchableOpacity>
              )}

              {/* Fin de liste */}
              {!hasMore && notifs.length > 0 && (
                <View style={S.endRow}>
                  <View style={S.endLine} />
                  <Text style={S.endTxt}>Vous êtes à jour</Text>
                  <View style={S.endLine} />
                </View>
              )}
            </View>
          )}

          {/* ══ TROPHÉES ══ */}
          {tab === 'trophees' && (
            <View>
              {/* Compteur */}
              {trophies.length > 0 && (
                <View style={S.trophySummary}>
                  <LinearGradient colors={['#D97706', '#F59E0B']} style={S.trophySummaryGrad}>
                    <Text style={S.trophySummaryEmoji}>🏆</Text>
                    <View>
                      <Text style={S.trophySummaryCount}>{trophies.length}</Text>
                      <Text style={S.trophySummaryLabel}>trophée{trophies.length > 1 ? 's' : ''} remporté{trophies.length > 1 ? 's' : ''}</Text>
                    </View>
                  </LinearGradient>
                </View>
              )}

              {trophies.length === 0 ? (
                <View style={S.empty}>
                  <Text style={{ fontSize: 64 }}>🏆</Text>
                  <Text style={S.emptyTitle}>Aucun trophée</Text>
                  <Text style={S.emptySub}>Participez aux sessions pour en remporter !</Text>
                </View>
              ) : (
                trophies.map((t, i) => (
                  <View key={t.id} style={S.trophyCard}>
                    {/* Numéro */}
                    <View style={S.trophyNum}>
                      <Text style={S.trophyNumTxt}>#{trophies.length - i}</Text>
                    </View>

                    {/* Médaille */}
                    <View style={S.trophyMedal}>
                      <LinearGradient colors={['#F59E0B', '#D97706']} style={S.trophyMedalGrad}>
                        <Text style={S.trophyMedalEmoji}>🏆</Text>
                      </LinearGradient>
                    </View>

                    {/* Info */}
                    <View style={S.trophyInfo}>
                      <Text style={S.trophyTitle}>{t.title}</Text>
                      {t.description ? <Text style={S.trophyDesc}>{t.description}</Text> : null}
                      {t.reason     ? <Text style={S.trophyReason}>"{t.reason}"</Text>  : null}
                      <View style={S.trophyFooter}>
                        {t.awarder && (
                          <Text style={S.trophyBy}>
                            <Ionicons name="person-circle-outline" size={12} color={C.gold} />
                            {' '}{t.awarder.prenom} {t.awarder.nom}
                          </Text>
                        )}
                        <Text style={S.trophyDate}>{fmtDate(t.awarded_at)}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header:      { paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 0, paddingHorizontal: 16 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn:     { padding: 6, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  headerRight: { width: 36, alignItems: 'flex-end' },
  badge:       { backgroundColor: '#EC4899', borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeTxt:    { color: '#FFF', fontSize: 11, fontWeight: '800' },

  // Onglets
  tabRow:        { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabBtnActive:  { backgroundColor: 'rgba(255,255,255,0.28)' },
  tabTxt:        { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  tabTxtActive:  { color: '#FFF' },
  tabBadge:      { backgroundColor: '#EC4899', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeTxt:   { color: '#FFF', fontSize: 10, fontWeight: '800' },

  // Erreur
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#DC2626' },
  errTxt:    { flex: 1, fontSize: 13, color: '#DC2626' },
  errRetry:  { fontSize: 13, color: C.purple, fontWeight: '700' },

  // Chargement
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadTxt:  { fontSize: 14, color: C.muted },

  // Mark all
  markAllRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  markAllTxt: { fontSize: 13, color: C.purple, fontWeight: '700' },

  // Notification card
  notifCard: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
    marginTop: 4,
  },
  notifCardUnread: {
    backgroundColor: '#F5F0FF',
    borderLeftWidth: 3,
    borderLeftColor: C.purple,
  },
  notifIcon:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  notifBody:   { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  notifTitle:  { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  notifTime:   { fontSize: 11, color: C.muted, flexShrink: 0 },
  notifMsg:    { fontSize: 13, color: C.soft, lineHeight: 18, marginBottom: 4 },
  notifSender: { fontSize: 11, color: C.muted },
  unreadDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.purple, marginTop: 4, flexShrink: 0 },

  // Trophy summary banner
  trophySummary:     { marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderRadius: 18, overflow: 'hidden' },
  trophySummaryGrad: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  trophySummaryEmoji:{ fontSize: 44 },
  trophySummaryCount:{ fontSize: 36, fontWeight: '900', color: '#FFF' },
  trophySummaryLabel:{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  // Trophy card
  trophyCard: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    ...Platform.select({
      ios:     { shadowColor: '#D97706', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
    marginTop: 4,
  },
  trophyNum:      { position: 'absolute', top: 10, right: 14 },
  trophyNumTxt:   { fontSize: 11, color: C.gold, fontWeight: '800' },
  trophyMedal:    { flexShrink: 0 },
  trophyMedalGrad:{ width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  trophyMedalEmoji:{ fontSize: 26 },
  trophyInfo:     { flex: 1 },
  trophyTitle:    { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 3 },
  trophyDesc:     { fontSize: 13, color: C.soft, marginBottom: 3, lineHeight: 18 },
  trophyReason:   { fontSize: 12, color: C.gold, fontStyle: 'italic', marginBottom: 6 },
  trophyFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  trophyBy:       { fontSize: 11, color: C.gold, fontWeight: '600' },
  trophyDate:     { fontSize: 11, color: C.muted },

  // Voir Plus
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingVertical: 14, backgroundColor: '#F3EEFF', borderRadius: 14, borderWidth: 1, borderColor: '#E0D5F0' },
  loadMoreTxt: { fontSize: 14, color: C.purple, fontWeight: '700' },
  endRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 16, gap: 10 },
  endLine:     { flex: 1, height: 1, backgroundColor: C.border },
  endTxt:      { fontSize: 12, color: C.muted, fontWeight: '600' },

  // Empty state
  empty:      { alignItems: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySub:   { fontSize: 14, color: C.muted },
});
