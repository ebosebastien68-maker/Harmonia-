/**
 * dames.tsx — 3 onglets — Compatible Web & Mobile
 *
 * ONGLET 1 "Mes Sessions"  → sessions rejointes → run en cours → TabDames (si launched/created) ou "Match Terminé" (si finished)
 * ONGLET 2 "Explorer"      → sessions disponibles → Participer (RPC join_session_dames)
 * ONGLET 3 "Classement"    → toutes sessions → runs launched/finished → gagnants
 *
 * ARCHITECTURE :
 *   • Même structure que vrai-faux.tsx
 *   • BACKEND_URL/dames (endpoint Render)
 *   • AsyncStorage lazy → SSR safe
 *   • access_token lu depuis racine de harmonia_session
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Animated, Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import TabDames from './TabDames';

// ─── AsyncStorage lazy (SSR safe) ────────────────────────────────────────────
const Storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      const AS  = (mod as any).default ?? mod;
      return AS.getItem(key);
    } catch { return null; }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      const AS  = (mod as any).default ?? mod;
      await AS.setItem(key, value);
    } catch { /* silencieux */ }
  },
};

// ─── Rafraîchissement automatique du token ───────────────────────────────────
// Lit harmonia_session depuis AsyncStorage.
// Si le access_token expire dans moins de 60s → appelle /refresh-token sur Render.
// Sauvegarde la nouvelle session dans AsyncStorage.
async function getValidToken(): Promise<{ uid: string; token: string } | null> {
  try {
    const raw = await Storage.getItem('harmonia_session');
    if (!raw) return null;
    const session = JSON.parse(raw);

    const uid          = session?.user?.id      || '';
    const accessToken  = session?.access_token  || '';
    const refreshToken = session?.refresh_token || '';
    const expiresAt    = session?.expires_at    || 0;

    if (!uid || !accessToken) return null;

    // Token encore valide (marge 60s)
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt - now > 60) return { uid, token: accessToken };

    // Token expiré → appel backend Render
    if (!refreshToken) return null;

    const res = await fetch(`${BACKEND_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      console.warn('[Dames] Rafraîchissement token échoué');
      return null;
    }

    const data = await res.json();

    // Sauvegarder la nouvelle session dans AsyncStorage
    const newSession = {
      ...session,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
    await Storage.setItem('harmonia_session', JSON.stringify(newSession));
    console.log('[Dames] Token rafraîchi avec succès');
    return { uid, token: data.access_token };

  } catch (e) {
    console.warn('[Dames] getValidToken error:', e);
    return null;
  }
}

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const NATIVE      = Platform.OS !== 'web';

const haptic = {
  light:   () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);   },
  medium:  () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);  },
  success: () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   },
};

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080C0A',
  surface:     '#0F1A12',
  surfaceHigh: '#162019',
  border:      '#1E3022',
  gold:        '#C9A84C',
  green:       '#2D7A45',
  greenLight:  '#3DAA60',
  cream:       '#E8F0E0',
  muted:       '#4A6B52',
  launched:    '#2980B9',
  finished:    '#27AE60',
  created:     '#8E44AD',
  danger:      '#E74C3C',
  white:       '#FFFFFF',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'mine' | 'explore' | 'classement';

interface RunInfo {
  id: string;
  run_number: number;
  title: string;
  status: 'created' | 'launched' | 'finished';
  prep_time_seconds: number;
  turn_time_seconds: number;
  launched_at?: string;
  finished_at?: string;
}

interface MatchInfo {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name?: string;
  player2_name?: string;
  winner_id: string | null;
  loser_id: string | null;
  finished: boolean;
}

interface SessionItem {
  id: string;
  title: string;
  description?: string;
  is_paid: boolean;
  price_cfa: number;
  party_id: string | null;
  current_run: RunInfo | null;
}

interface ExploreSession {
  id: string;
  title: string;
  description?: string;
  is_paid: boolean;
  price_cfa: number;
}

interface ClassementMatch {
  id: string;
  player1_name: string;
  player2_name: string;
  winner_name: string | null;
  finished: boolean;
}

interface ClassementRun {
  id: string;
  run_number: number;
  title: string;
  status: 'launched' | 'finished';
  finished_at?: string;
  matches: ClassementMatch[];
}

interface ClassementSession {
  id: string;
  title: string;
  runs: ClassementRun[];
}

interface DamesProps {
  userId?:  string;
  onBack?:  () => void;
  onClose?: () => void;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Dames({ userId: userIdProp, onBack, onClose }: DamesProps) {

  const handleBack = onBack ?? onClose;

  // ─── Navigation ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('mine');

  // ─── Auth ───────────────────────────────────────────────────────────────
  const [userId, setUserId]   = useState<string>(userIdProp || '');
  const userIdRef             = useRef<string>(userIdProp || '');
  const accessTokenRef        = useRef<string>('');
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => {
    if (userIdProp) { setUserId(userIdProp); userIdRef.current = userIdProp; }
  }, [userIdProp]);

  // ─── Données ────────────────────────────────────────────────────────────
  const [mySessions,    setMySessions]   = useState<SessionItem[]>([]);
  const [exploreSess,   setExploreSess]  = useState<ExploreSession[]>([]);
  const [classement,    setClassement]   = useState<ClassementSession[]>([]);
  const [selSession,    setSelSession]   = useState<SessionItem | null>(null);
  const [runData,       setRunData]      = useState<{ run: RunInfo; my_match: MatchInfo | null } | null>(null);
  const [showGame,      setShowGame]     = useState<{ matchId: string } | null>(null);
  const [activeMatch,     setActiveMatch]    = useState<{ matchId: string } | null>(null);
  const [selClassSession, setSelClassSession] = useState<ClassementSession | null>(null);

  // ─── UI ─────────────────────────────────────────────────────────────────
  const [initLoading,  setInitLoading]  = useState(true);
  const [loadingCard,  setLoadingCard]  = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState('');

  const isMounted  = useRef(true);
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  // ─── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: NATIVE }).start();

    const init = async () => {
      let uid   = userIdProp || '';
      let token = '';
      try {
        const valid = await getValidToken();
        if (valid) {
          uid   = uid || valid.uid;
          token = valid.token;
        }
      } catch (e) { console.warn('[Dames] Storage read error:', e); }
      if (uid)   { setUserId(uid); userIdRef.current = uid; }
      if (token) { accessTokenRef.current = token; }
      await Promise.all([
        loadMySessions(uid, token),
        loadExploreSessions(uid, token),
        loadClassement(uid, token),
      ]);
      if (isMounted.current) setInitLoading(false);
    };
    init();
    return () => { isMounted.current = false; };
  }, []);

  // ─── API centrale ───────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    // Toujours vérifier/rafraîchir le token avant l'appel
    const valid = await getValidToken();
    if (!valid) throw new Error('Session expirée — reconnectez-vous');
    // Mettre à jour les refs avec le token frais
    userIdRef.current    = valid.uid;
    accessTokenRef.current = valid.token;
    const res = await fetch(`${BACKEND_URL}/dames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: valid.uid, access_token: valid.token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.details
        ? `${data?.error || 'Erreur'} — ${data.details}`
        : (data?.error || `Erreur ${res.status}`);
      throw new Error(msg);
    }
    return data;
  }, []);

  // ─── Chargements ────────────────────────────────────────────────────────
  const loadMySessions = useCallback(async (uid?: string, token?: string) => {
    try {
      const u = uid   || userIdRef.current;
      const t = token || accessTokenRef.current;
      if (!u || !t) return;
      const res = await fetch(`${BACKEND_URL}/dames`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, access_token: t, function: 'listMySessions' }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setMySessions(data.sessions || []);
    } catch (e) { console.warn('[Dames] loadMySessions:', e); }
  }, []);

  const loadExploreSessions = useCallback(async (uid?: string, token?: string) => {
    try {
      const u = uid   || userIdRef.current;
      const t = token || accessTokenRef.current;
      if (!u || !t) return;
      const res = await fetch(`${BACKEND_URL}/dames`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, access_token: t, function: 'listAvailableSessions' }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setExploreSess(data.sessions || []);
    } catch (e) { console.warn('[Dames] loadExploreSessions:', e); }
  }, []);

  const loadClassement = useCallback(async (uid?: string, token?: string) => {
    try {
      const u = uid   || userIdRef.current;
      const t = token || accessTokenRef.current;
      if (!u || !t) return;
      const res = await fetch(`${BACKEND_URL}/dames`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, access_token: t, function: 'getClassement' }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setClassement(data.sessions || []);
    } catch (e) { console.warn('[Dames] loadClassement:', e); }
  }, []);

  const syncAll = useCallback(async () => {
    setError(''); setRefreshing(true);
    await Promise.all([loadMySessions(), loadExploreSessions(), loadClassement()]);
    if (isMounted.current) setRefreshing(false);
  }, [loadMySessions, loadExploreSessions, loadClassement]);

  // ─── Rejoindre une session ───────────────────────────────────────────────
  const joinSession = async (session: ExploreSession) => {
    setLoadingCard(session.id); setError(''); haptic.medium();
    try {
      await api({ function: 'joinSession', session_id: session.id });
      haptic.success();
      setExploreSess(prev => prev.filter(s => s.id !== session.id));
      await loadMySessions();
    } catch (e: any) {
      haptic.error();
      if (!e.message?.includes('Déjà inscrit')) setError(e.message || 'Erreur joinSession');
      else await loadMySessions();
    } finally {
      if (isMounted.current) setLoadingCard(null);
    }
  };

  // ─── Ouvrir une session → charger son run ───────────────────────────────
  const openSession = async (session: SessionItem) => {
    setLoadingCard(session.id); setError(''); haptic.light();
    try {
      setSelSession(session);
      if (!session.party_id) {
        setRunData(null);
        return;
      }
      const data = await api({ function: 'getRunForSession', session_id: session.id });
      if (isMounted.current) {
        setRunData(data.run ? { run: data.run, my_match: data.my_match } : null);
      }
    } catch (e: any) {
      haptic.error();
      setError(e.message || 'Erreur chargement run');
    } finally {
      if (isMounted.current) setLoadingCard(null);
    }
  };

  // ─── Retour depuis une session ───────────────────────────────────────────
  const backFromSession = () => {
    setSelSession(null);
    setRunData(null);
    setError('');
    haptic.light();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.greenLight} />
        <Text style={styles.loadingText}>Chargement Dames…</Text>
      </View>
    );
  }

  // ── Vue TabDames plein écran ──────────────────────────────────────────────
  if (showGame) {
    return (
      <TabDames
        matchId={showGame.matchId}
        userId={userId}
        accessToken={accessTokenRef.current}
        onBack={() => setShowGame(null)}
      />
    );
  }

  // ── Vue jeu en cours — TabDames plein écran ──
  if (activeMatch) {
    return (
      <TabDames
        matchId={activeMatch.matchId}
        userId={userId}
        accessToken={accessTokenRef.current}
        onBack={() => {
          setActiveMatch(null);
          haptic.light();
          // Rafraîchir les sessions après la partie
          loadMySessions();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>

        {/* ── Header ── */}
        <LinearGradient colors={['#0F1A12', '#080C0A']} style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.cream} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>♟️ Dames</Text>
            {selSession && (
              <Text style={styles.headerSub} numberOfLines={1}>{selSession.title}</Text>
            )}
          </View>
          <TouchableOpacity onPress={syncAll} style={styles.syncBtn} activeOpacity={0.7}>
            {refreshing
              ? <ActivityIndicator size="small" color={C.greenLight} />
              : <Ionicons name="refresh" size={20} color={C.greenLight} />}
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Erreur globale ── */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color={C.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')}>
              <Ionicons name="close" size={16} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tabs ── */}
        {!selSession && (
          <View style={styles.tabBar}>
            {(['mine', 'explore', 'classement'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabItem, tab === t && styles.tabItemActive]}
                onPress={() => { setTab(t); haptic.light(); }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={t === 'mine' ? 'game-controller' : t === 'explore' ? 'search' : 'trophy'}
                  size={18}
                  color={tab === t ? C.greenLight : C.muted}
                />
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                  {t === 'mine' ? 'Mes Sessions' : t === 'explore' ? 'Explorer' : 'Classement'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Contenu ── */}
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>

          {/* ────── VUE SESSION OUVERTE ────── */}
          {selSession && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.breadcrumb} onPress={backFromSession} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={16} color={C.greenLight} />
                <Text style={styles.breadcrumbText}>Retour aux sessions</Text>
              </TouchableOpacity>

              {loadingCard === selSession.id ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={C.greenLight} />
                </View>
              ) : runData ? (
                <RunCard
                  run={runData.run}
                  myMatch={runData.my_match}
                  userId={userId}
                  session={selSession}
                  onPlayMatch={(matchId) => setShowGame({ matchId })}
                />
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="hourglass-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Aucun run disponible pour cette session.</Text>
                </View>
              )}
            </View>
          )}

          {/* ────── ONGLET 1 — MES SESSIONS ────── */}
          {!selSession && tab === 'mine' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mes Sessions</Text>
              {mySessions.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="game-controller-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Vous n'avez rejoint aucune session.</Text>
                  <Text style={styles.emptyHint}>Explorez les sessions disponibles !</Text>
                </View>
              ) : (
                mySessions.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.card, loadingCard === s.id && styles.cardLoading]}
                    onPress={() => openSession(s)}
                    activeOpacity={0.8}
                  >
                    {loadingCard === s.id && (
                      <ActivityIndicator size="small" color={C.greenLight} style={styles.cardSpinner} />
                    )}
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.current_run && (
                        <StatusBadge status={s.current_run.status} />
                      )}
                    </View>
                    {s.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text>
                    ) : null}
                    {s.current_run && (
                      <View style={styles.runMeta}>
                        <Ionicons name="layers-outline" size={13} color={C.muted} />
                        <Text style={styles.runMetaText}>Run {s.current_run.run_number} — {s.current_run.title}</Text>
                        <Ionicons name="time-outline" size={13} color={C.muted} style={{ marginLeft: 8 }} />
                        <Text style={styles.runMetaText}>{s.current_run.turn_time_seconds}s/tour</Text>
                      </View>
                    )}
                    <View style={styles.cardFooter}>
                      <Text style={styles.enterText}>Entrer →</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ────── ONGLET 2 — EXPLORER ────── */}
          {!selSession && tab === 'explore' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sessions Disponibles</Text>
              {exploreSess.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="search-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Aucune session disponible.</Text>
                  <Text style={styles.emptyHint}>Vous avez peut-être déjà rejoint toutes les sessions.</Text>
                </View>
              ) : (
                exploreSess.map(s => (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.is_paid && (
                        <View style={styles.paidBadge}>
                          <Text style={styles.paidText}>{s.price_cfa} CFA</Text>
                        </View>
                      )}
                    </View>
                    {s.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.joinBtn, loadingCard === s.id && styles.joinBtnLoading]}
                      onPress={() => joinSession(s)}
                      disabled={!!loadingCard}
                      activeOpacity={0.8}
                    >
                      {loadingCard === s.id
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <>
                            <Ionicons name="enter-outline" size={16} color={C.white} />
                            <Text style={styles.joinBtnText}>
                              {s.is_paid ? `Participer (${s.price_cfa} CFA)` : 'Participer gratuitement'}
                            </Text>
                          </>
                      }
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ────── ONGLET 3 — CLASSEMENT ────── */}
          {!selSession && tab === 'classement' && (
            <View style={styles.section}>

              {/* ── Vue détail session ── */}
              {selClassSession ? (
                <>
                  {/* Header retour */}
                  <TouchableOpacity style={styles.backRow} onPress={() => setSelClassSession(null)} activeOpacity={0.7}>
                    <View style={styles.backBtn}>
                      <Ionicons name="arrow-back" size={16} color={C.greenLight} />
                    </View>
                    <Text style={styles.backText}>Retour</Text>
                  </TouchableOpacity>

                  {/* Titre session */}
                  <View style={styles.classDetailHeader}>
                    <Ionicons name="trophy" size={20} color={C.gold} />
                    <Text style={styles.classDetailTitle}>{selClassSession.title}</Text>
                  </View>

                  {selClassSession.runs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="layers-outline" size={36} color={C.muted} />
                      <Text style={styles.emptyText}>Aucun run disponible.</Text>
                    </View>
                  ) : (
                    selClassSession.runs.map(run => (
                      <View key={run.id} style={styles.classRunBlock}>

                        {/* En-tête run */}
                        <View style={styles.classRunHeader}>
                          <View style={styles.classRunNumBadge}>
                            <Text style={styles.classRunNumText}>R{run.run_number}</Text>
                          </View>
                          <Text style={styles.classRunTitle} numberOfLines={1}>{run.title}</Text>
                          <StatusBadge status={run.status} />
                        </View>

                        {run.matches.length === 0 ? (
                          <Text style={styles.classEmpty}>Aucun match dans ce run</Text>
                        ) : (
                          <View style={styles.classMatchList}>
                            {run.matches.map((m, i) => {
                              const p1Wins = m.finished && m.winner_name === m.player1_name;
                              const p2Wins = m.finished && m.winner_name === m.player2_name;
                              return (
                                <View key={m.id} style={styles.classMatchCard}>
                                  {/* Numéro match */}
                                  <View style={styles.classMatchHeader}>
                                    <Text style={styles.classMatchNum}>Match {i + 1}</Text>
                                    {m.finished
                                      ? <View style={styles.classMatchDoneBadge}>
                                          <Text style={styles.classMatchDoneText}>✅ Terminé</Text>
                                        </View>
                                      : <View style={styles.classMatchLiveBadge}>
                                          <Text style={styles.classMatchLiveText}>🔵 En cours</Text>
                                        </View>
                                    }
                                  </View>

                                  {/* VS */}
                                  <View style={styles.classMatchVS}>
                                    <View style={[styles.classMatchPlayer, p1Wins && styles.classMatchWinner]}>
                                      {p1Wins && <Ionicons name="trophy" size={13} color={C.gold} />}
                                      <Text style={[styles.classMatchPlayerName, p1Wins && styles.classMatchWinnerName]}
                                        numberOfLines={2} textBreakStrategy="simple">
                                        {m.player1_name}
                                      </Text>
                                    </View>

                                    <View style={styles.classMatchVSBadge}>
                                      <Text style={styles.classMatchVSText}>VS</Text>
                                    </View>

                                    <View style={[styles.classMatchPlayer, p2Wins && styles.classMatchWinner]}>
                                      {p2Wins && <Ionicons name="trophy" size={13} color={C.gold} />}
                                      <Text style={[styles.classMatchPlayerName, p2Wins && styles.classMatchWinnerName]}
                                        numberOfLines={2} textBreakStrategy="simple">
                                        {m.player2_name}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Résultat */}
                                  {m.finished && m.winner_name && (
                                    <View style={styles.classMatchResultRow}>
                                      <Ionicons name="ribbon" size={14} color={C.gold} />
                                      <Text style={styles.classMatchResultText}>
                                        Gagnant · {m.winner_name}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </>
              ) : (
                /* ── Liste des sessions ── */
                <>
                  <View style={styles.classTrophyHeader}>
                    <Ionicons name="trophy" size={28} color={C.gold} />
                    <Text style={styles.sectionTitle}>Classement</Text>
                  </View>

                  {classement.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="trophy-outline" size={40} color={C.muted} />
                      <Text style={styles.emptyText}>Vous n'êtes inscrit à aucune session.</Text>
                    </View>
                  ) : (
                    classement.map(sess => {
                      const totalMatches = sess.runs.reduce((acc, r) => acc + r.matches.length, 0);
                      const finishedMatches = sess.runs.reduce((acc, r) => acc + r.matches.filter(m => m.finished).length, 0);
                      const activeRun = sess.runs.find(r => r.status === 'launched');
                      return (
                        <TouchableOpacity
                          key={sess.id}
                          style={styles.classSessionCard}
                          onPress={() => setSelClassSession(sess)}
                          activeOpacity={0.8}
                        >
                          {/* Bande dorée gauche */}
                          <View style={styles.classSessionAccent} />

                          <View style={styles.classSessionCardBody}>
                            <View style={styles.classSessionCardTop}>
                              <Text style={styles.classSessionCardTitle} numberOfLines={1}>{sess.title}</Text>
                              {activeRun && <StatusBadge status="launched" />}
                            </View>
                            <View style={styles.classSessionCardStats}>
                              <View style={styles.classSessionStat}>
                                <Ionicons name="layers-outline" size={13} color={C.muted} />
                                <Text style={styles.classSessionStatText}>{sess.runs.length} run{sess.runs.length > 1 ? 's' : ''}</Text>
                              </View>
                              <View style={styles.classSessionStat}>
                                <Ionicons name="game-controller-outline" size={13} color={C.muted} />
                                <Text style={styles.classSessionStatText}>{finishedMatches}/{totalMatches} matchs</Text>
                              </View>
                            </View>
                          </View>

                          <Ionicons name="chevron-forward" size={20} color={C.greenLight} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Composant RunCard ────────────────────────────────────────────────────────
function RunCard({
  run, myMatch, userId, session, onPlayMatch
}: {
  run: RunInfo;
  myMatch: MatchInfo | null;
  userId: string;
  session: SessionItem;
  onPlayMatch: (matchId: string) => void;
}) {

  // ── Run terminé → signal "Match Terminé"
  if (run.status === 'finished') {
    return (
      <View style={styles.runCard}>
        <View style={styles.runCardHeader}>
          <StatusBadge status="finished" />
          <Text style={styles.runCardTitle}>{run.title}</Text>
        </View>
        <View style={styles.finishedBox}>
          <Text style={styles.finishedEmoji}>🏆</Text>
          <Text style={styles.finishedTitle}>Match Terminé</Text>
          <Text style={styles.finishedSub}>
            Ce run est officiellement clôturé.{'\n'}
            Consultez le classement pour voir les gagnants.
          </Text>
        </View>
        <RunInfoGrid run={run} />
      </View>
    );
  }

  // ── Run launched ou created → affiche infos + placeholder TabDames
  return (
    <View style={styles.runCard}>
      <View style={styles.runCardHeader}>
        <StatusBadge status={run.status} />
        <Text style={styles.runCardTitle}>{run.title}</Text>
      </View>

      <RunInfoGrid run={run} />

      {run.status === 'created' && (
        <View style={styles.waitingBox}>
          <Ionicons name="hourglass-outline" size={32} color={C.muted} />
          <Text style={styles.waitingText}>En attente de lancement par l'administrateur</Text>
        </View>
      )}

      {run.status === 'launched' && (
        <View style={styles.launchedBox}>
          <View style={styles.launchedHeader}>
            <Ionicons name="game-controller" size={22} color={C.launched} />
            <Text style={styles.launchedTitle}>Run en cours</Text>
          </View>

          {myMatch ? (
            <MatchCard match={myMatch} userId={userId} />
          ) : (
            <View style={styles.noMatchBox}>
              <Ionicons name="person-remove-outline" size={28} color={C.muted} />
              <Text style={styles.noMatchText}>Vous n'êtes pas dans ce run</Text>
            </View>
          )}

          {/* Bouton Jouer — remplace le placeholder */}
          {myMatch && !myMatch.finished && (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={() => onPlayMatch(myMatch.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="game-controller" size={20} color={C.white} />
              <Text style={styles.playBtnText}>Jouer maintenant</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Grille d'infos du run ────────────────────────────────────────────────────
function RunInfoGrid({ run }: { run: RunInfo }) {
  return (
    <View style={styles.infoGrid}>
      <InfoCell icon="layers-outline"  label="Run"        value={`#${run.run_number}`} />
      <InfoCell icon="time-outline"    label="Prép."      value={`${run.prep_time_seconds}s`} />
      <InfoCell icon="stopwatch-outline" label="Tour"     value={`${run.turn_time_seconds}s`} />
      {run.launched_at && (
        <InfoCell icon="play-circle-outline" label="Lancé"
          value={new Date(run.launched_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} />
      )}
    </View>
  );
}

function InfoCell({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Ionicons name={icon} size={18} color={C.greenLight} />
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={styles.infoCellValue}>{value}</Text>
    </View>
  );
}

// ─── Carte de match ───────────────────────────────────────────────────────────
function MatchCard({ match, userId }: { match: MatchInfo; userId: string }) {
  const isPlayer1   = match.player1_id === userId;
  const isWinner    = match.winner_id === userId;
  const isLoser     = match.loser_id  === userId;

  const myName  = isPlayer1
    ? (match.player1_name || 'Vous')
    : (match.player2_name || 'Vous');
  const oppName = isPlayer1
    ? (match.player2_name || 'Adversaire')
    : (match.player1_name || 'Adversaire');

  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchLabel}>Votre match</Text>
      <View style={styles.matchVS}>
        <View style={[styles.matchPlayer, styles.matchPlayerSelf]}>
          <Ionicons name="person" size={20} color={C.cream} />
          <Text style={styles.matchPlayerName}>{myName}</Text>
        </View>
        <Text style={styles.matchVSText}>VS</Text>
        <View style={styles.matchPlayer}>
          <Ionicons name="person-outline" size={20} color={C.muted} />
          <Text style={styles.matchPlayerName} numberOfLines={1}>{oppName}</Text>
        </View>
      </View>
      {match.finished && (
        <View style={[
          styles.matchResult,
          isWinner ? styles.matchResultWin : isLoser ? styles.matchResultLose : {}
        ]}>
          <Text style={styles.matchResultText}>
            {isWinner ? '🏆 Victoire !' : isLoser ? '❌ Défaite' : 'Résultat en attente'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Badge de statut ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config = {
    created:  { color: C.created,  label: '⏳ En attente',  bg: '#2D1B4A' },
    launched: { color: C.launched, label: '🔵 En cours',    bg: '#1A2D4A' },
    finished: { color: C.finished, label: '🟢 Terminé',     bg: '#1A4A2D' },
  }[status] ?? { color: C.muted, label: status, bg: C.surface };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  flex:       { flex: 1 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText:{ color: C.muted, marginTop: 12, fontSize: 14 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { color: C.cream, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  headerSub:   { color: C.muted, fontSize: 12, marginTop: 2 },
  backBtn:     { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: C.border },
  syncBtn:     { padding: 8 },

  // Erreur
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 12, backgroundColor: '#2A0A0A', borderRadius: 10, borderWidth: 1, borderColor: C.danger },
  errorText:   { flex: 1, color: C.danger, fontSize: 13 },

  // Tabs
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: C.greenLight },
  tabLabel:      { fontSize: 11, color: C.muted, fontWeight: '500' },
  tabLabelActive:{ color: C.greenLight },

  // Scroll & section
  scroll:        { paddingBottom: 40 },
  section:       { padding: 16 },
  sectionTitle:  { color: C.cream, fontSize: 18, fontWeight: '700', marginBottom: 16 },

  // Breadcrumb
  breadcrumb:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  breadcrumbText: { color: C.greenLight, fontSize: 14 },

  // Card
  card:        { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardLoading: { opacity: 0.6 },
  cardSpinner: { position: 'absolute', top: 16, right: 16 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle:   { color: C.cream, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  cardDesc:    { color: C.muted, fontSize: 13, marginBottom: 8 },
  cardFooter:  { alignItems: 'flex-end', marginTop: 8 },
  enterText:   { color: C.greenLight, fontSize: 13, fontWeight: '600' },
  runMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  runMetaText: { color: C.muted, fontSize: 12 },

  // Join button
  joinBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, marginTop: 10 },
  joinBtnLoading: { opacity: 0.6 },
  joinBtnText:    { color: C.white, fontSize: 14, fontWeight: '700' },

  // Paid badge
  paidBadge: { backgroundColor: '#2A1F0A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.gold },
  paidText:  { color: C.gold, fontSize: 11, fontWeight: '700' },

  // Empty
  emptyBox:  { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center' },
  emptyHint: { color: C.muted, fontSize: 13, textAlign: 'center', opacity: 0.7 },

  // Run card
  runCard:       { backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  runCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  runCardTitle:  { color: C.cream, fontSize: 16, fontWeight: '700', flex: 1 },

  // Info grid
  infoGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  infoCell:       { flex: 1, minWidth: 80, alignItems: 'center', backgroundColor: C.surfaceHigh, borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: C.border },
  infoCellLabel:  { color: C.muted, fontSize: 11 },
  infoCellValue:  { color: C.cream, fontSize: 15, fontWeight: '700' },

  // Finished
  finishedBox:   { alignItems: 'center', padding: 24, gap: 8 },
  finishedEmoji: { fontSize: 40 },
  finishedTitle: { color: C.finished, fontSize: 20, fontWeight: '800' },
  finishedSub:   { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Waiting
  waitingBox:  { alignItems: 'center', padding: 24, gap: 10, backgroundColor: C.surfaceHigh, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  waitingText: { color: C.muted, fontSize: 14, textAlign: 'center' },

  // Launched
  launchedBox:    { gap: 14 },
  launchedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  launchedTitle:  { color: C.launched, fontSize: 16, fontWeight: '700' },

  // Match card
  matchCard:        { backgroundColor: C.surfaceHigh, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  matchLabel:       { color: C.muted, fontSize: 12, marginBottom: 10 },
  matchVS:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  matchPlayer:      { alignItems: 'center', gap: 6, flex: 1 },
  matchPlayerSelf:  { opacity: 1 },
  matchPlayerName:  { color: C.cream, fontSize: 13, fontWeight: '600' },
  matchVSText:      { color: C.gold, fontSize: 18, fontWeight: '900', marginHorizontal: 8 },
  matchResult:      { marginTop: 12, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: C.surfaceHigh },
  matchResultWin:   { backgroundColor: '#1A4A2D' },
  matchResultLose:  { backgroundColor: '#3A1010' },
  matchResultText:  { color: C.cream, fontSize: 15, fontWeight: '700' },

  // No match
  noMatchBox:  { alignItems: 'center', padding: 20, gap: 8 },
  noMatchText: { color: C.muted, fontSize: 14 },

  // Bouton jouer
  playBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 gap: 10, backgroundColor: C.green, borderRadius: 12,
                 paddingVertical: 14, marginTop: 8 },
  playBtnText: { color: C.white, fontSize: 15, fontWeight: '800' },

  // Badge
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ── Classement ───────────────────────────────────────────────────────────
  classTrophyHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },

  // Carte session (liste)
  classSessionCard:       { flexDirection: 'row', alignItems: 'center',
                            backgroundColor: C.surface, borderRadius: 16, marginBottom: 12,
                            borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  classSessionAccent:     { width: 4, alignSelf: 'stretch', backgroundColor: C.gold },
  classSessionCardBody:   { flex: 1, padding: 14, gap: 6 },
  classSessionCardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  classSessionCardTitle:  { color: C.cream, fontSize: 15, fontWeight: '800', flex: 1 },
  classSessionCardStats:  { flexDirection: 'row', gap: 14 },
  classSessionStat:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classSessionStatText:   { color: C.muted, fontSize: 12 },

  // Détail session
  backRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  backBtn:            { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surfaceHigh,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: C.border },
  backText:           { color: C.greenLight, fontSize: 14, fontWeight: '700' },
  classDetailHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  classDetailTitle:   { color: C.cream, fontSize: 18, fontWeight: '800', flex: 1 },

  // Bloc run
  classRunBlock:      { backgroundColor: C.surfaceHigh, borderRadius: 14, padding: 14,
                        marginBottom: 14, borderWidth: 1, borderColor: C.border },
  classRunHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  classRunNumBadge:   { width: 28, height: 28, borderRadius: 8, backgroundColor: C.green,
                        alignItems: 'center', justifyContent: 'center' },
  classRunNumText:    { color: C.white, fontSize: 11, fontWeight: '800' },
  classRunTitle:      { color: C.cream, fontSize: 14, fontWeight: '700', flex: 1 },
  classEmpty:         { color: C.muted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  // Liste matchs
  classMatchList:     { gap: 10 },
  classMatchCard:     { backgroundColor: C.bg, borderRadius: 12, padding: 12,
                        borderWidth: 1, borderColor: C.border },
  classMatchHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  classMatchNum:      { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  classMatchDoneBadge:{ backgroundColor: '#1A3A22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  classMatchDoneText: { color: C.finished, fontSize: 11, fontWeight: '700' },
  classMatchLiveBadge:{ backgroundColor: '#1A2A3A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  classMatchLiveText: { color: C.launched, fontSize: 11, fontWeight: '700' },

  // VS
  classMatchVS:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  classMatchPlayer:     { flex: 1, backgroundColor: C.surfaceHigh, borderRadius: 10, padding: 10,
                          alignItems: 'center', gap: 4, minHeight: 52, justifyContent: 'center' },
  classMatchWinner:     { backgroundColor: '#1E3A18', borderWidth: 1.5, borderColor: C.gold },
  classMatchPlayerName: { color: C.cream, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  classMatchWinnerName: { color: C.gold, fontWeight: '800' },
  classMatchVSBadge:    { width: 28, height: 28, borderRadius: 8, backgroundColor: C.surface,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1, borderColor: C.border },
  classMatchVSText:     { color: C.muted, fontSize: 11, fontWeight: '800' },

  // Résultat
  classMatchResultRow:  { flexDirection: 'row', alignItems: 'center', gap: 6,
                          backgroundColor: '#1E3A18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  classMatchResultText: { color: C.gold, fontSize: 12, fontWeight: '700' },

  // Anciens (garder pour compatibilité)
  classSessionBlock:  { marginBottom: 20 },
  classSessionTitle:  { color: C.cream, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  winnersList:        { gap: 8 },
  winnerRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  winnerRank:         { color: C.gold, fontSize: 14, fontWeight: '800', width: 24 },
  winnerAvatar:       { width: 32, height: 32, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  winnerAvatarText:   { color: C.white, fontSize: 14, fontWeight: '700' },
  winnerName:         { color: C.cream, fontSize: 14, fontWeight: '600', flex: 1 },
});
