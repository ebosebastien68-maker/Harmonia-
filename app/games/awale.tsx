/**
 * awale.tsx — 3 onglets — Compatible Web & Mobile
 *
 * ONGLET 1 "Mes Sessions"  → sessions rejointes → run en cours → TabAwale (si launched/created) ou "Match Terminé" (si finished)
 * ONGLET 2 "Explorer"      → sessions disponibles → Participer (RPC join_session_awale)
 * ONGLET 3 "Classement"    → toutes sessions → runs launched/finished → gagnants
 *
 * ARCHITECTURE :
 *   • Même structure que vrai-faux.tsx
 *   • BACKEND_URL/awale (endpoint Render)
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
import TabAwale from 'app/TabAwale';

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
};

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

interface ClassementRun {
  id: string;
  run_number: number;
  title: string;
  status: 'launched' | 'finished';
  launched_at?: string;
  finished_at?: string;
  winners: { id: string; username?: string; avatar_url?: string }[];
}

interface ClassementSession {
  id: string;
  title: string;
  runs: ClassementRun[];
}

interface AwaleProps {
  userId?:  string;
  onBack?:  () => void;
  onClose?: () => void;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Awale({ userId: userIdProp, onBack, onClose }: AwaleProps) {

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
  const [activeMatch,   setActiveMatch]  = useState<{ matchId: string } | null>(null);

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
        const raw = await Storage.getItem('harmonia_session');
        if (raw) {
          const p = JSON.parse(raw);
          uid   = uid   || p?.user?.id    || '';
          token = token || p?.access_token || '';
        }
      } catch (e) { console.warn('[Awale] Storage read error:', e); }
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
    const uid   = userIdRef.current;
    const token = accessTokenRef.current;
    if (!uid)   throw new Error('Non connecté');
    if (!token) throw new Error('Session expirée — reconnectez-vous');
    const res = await fetch(`${BACKEND_URL}/awale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, access_token: token, ...body }),
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
      const res = await fetch(`${BACKEND_URL}/awale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, access_token: t, function: 'listMySessions' }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setMySessions(data.sessions || []);
    } catch (e) { console.warn('[Awale] loadMySessions:', e); }
  }, []);

  const loadExploreSessions = useCallback(async (uid?: string, token?: string) => {
    try {
      const u = uid   || userIdRef.current;
      const t = token || accessTokenRef.current;
      if (!u || !t) return;
      const res = await fetch(`${BACKEND_URL}/awale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, access_token: t, function: 'listAvailableSessions' }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setExploreSess(data.sessions || []);
    } catch (e) { console.warn('[Awale] loadExploreSessions:', e); }
  }, []);

  const loadClassement = useCallback(async (uid?: string, token?: string) => {
    try {
      const u = uid   || userIdRef.current;
      const t = token || accessTokenRef.current;
      if (!u || !t) return;
      const res = await fetch(`${BACKEND_URL}/awale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, access_token: t, function: 'getClassement' }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setClassement(data.sessions || []);
    } catch (e) { console.warn('[Awale] loadClassement:', e); }
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
        <Text style={styles.loadingText}>Chargement Awalé…</Text>
      </View>
    );
  }

  // ── Vue TabAwale plein écran ──────────────────────────────────────────────
  if (showGame) {
    return (
      <TabAwale
        matchId={showGame.matchId}
        userId={userId}
        accessToken={accessTokenRef.current}
        onBack={() => setShowGame(null)}
      />
    );
  }

  // ── Vue jeu en cours — TabAwale plein écran ──
  if (activeMatch) {
    return (
      <TabAwale
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
            <Text style={styles.headerTitle}>🎯 Awalé</Text>
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
              <Text style={styles.sectionTitle}>Classement</Text>
              {classement.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="trophy-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Aucun run terminé pour l'instant.</Text>
                </View>
              ) : (
                classement.map(sess => (
                  <View key={sess.id} style={styles.classSessionBlock}>
                    <Text style={styles.classSessionTitle}>{sess.title}</Text>
                    {sess.runs.length === 0 ? (
                      <Text style={styles.classEmpty}>Aucun run visible</Text>
                    ) : (
                      sess.runs.map(run => (
                        <View key={run.id} style={styles.classRunBlock}>
                          <View style={styles.classRunHeader}>
                            <StatusBadge status={run.status} />
                            <Text style={styles.classRunTitle}>Run {run.run_number} — {run.title}</Text>
                          </View>
                          {run.winners.length === 0 ? (
                            <Text style={styles.classEmpty}>Gagnants non encore désignés</Text>
                          ) : (
                            <View style={styles.winnersList}>
                              {run.winners.map((w, i) => (
                                <View key={w.id} style={styles.winnerRow}>
                                  <Text style={styles.winnerRank}>#{i + 1}</Text>
                                  <View style={styles.winnerAvatar}>
                                    <Text style={styles.winnerAvatarText}>
                                      {(w.username || '?')[0].toUpperCase()}
                                    </Text>
                                  </View>
                                  <Text style={styles.winnerName}>
                                    {w.username || 'Joueur'}
                                  </Text>
                                  <Ionicons name="checkmark-circle" size={16} color={C.finished} />
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                ))
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

  // ── Run launched ou created → affiche infos + placeholder TabAwale
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
  const opponentId  = isPlayer1 ? match.player2_id : match.player1_id;
  const isWinner    = match.winner_id === userId;
  const isLoser     = match.loser_id  === userId;

  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchLabel}>Votre match</Text>
      <View style={styles.matchVS}>
        <View style={[styles.matchPlayer, styles.matchPlayerSelf]}>
          <Ionicons name="person" size={20} color={C.cream} />
          <Text style={styles.matchPlayerName}>Vous</Text>
        </View>
        <Text style={styles.matchVSText}>VS</Text>
        <View style={styles.matchPlayer}>
          <Ionicons name="person-outline" size={20} color={C.muted} />
          <Text style={styles.matchPlayerName} numberOfLines={1}>Adversaire</Text>
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

  // Classement
  classSessionBlock: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  classSessionTitle: { color: C.cream, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  classRunBlock:     { backgroundColor: C.surfaceHigh, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  classRunHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  classRunTitle:     { color: C.cream, fontSize: 14, fontWeight: '600', flex: 1 },
  classEmpty:        { color: C.muted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  winnersList:       { gap: 8 },
  winnerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  winnerRank:        { color: C.gold, fontSize: 14, fontWeight: '800', width: 24 },
  winnerAvatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  winnerAvatarText:  { color: C.white, fontSize: 14, fontWeight: '700' },
  winnerName:        { color: C.cream, fontSize: 14, fontWeight: '600', flex: 1 },
});
