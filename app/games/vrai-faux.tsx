/**
 * vrai-faux.tsx
 *
 * ✅ Sync silencieuse — aucun spinner, transition fluide + bouton sync manuel
 * ✅ Clic party → questions non-répondues + historique chargés
 * ✅ Historique complet — toutes questions, réponses, scores, score total party
 * ✅ AsyncStorage via 'harmonia_session'
 * ✅ FIXED: isMounted useRef ajouté
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Animated, Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL   = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY      = 'vrai_faux';
const POLL_MS       = 3000;
const RESULT_TTL_MS = 12000;

const haptic = {
  medium:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
};

const C = {
  bg: '#0A0A0C', surface: '#14141A', surfaceHigh: '#1C1C24',
  border: '#262630', gold: '#C9A84C', goldLight: '#E8C96A',
  cream: '#F0E8D5', muted: '#5A5A6A',
  success: '#27AE60', danger: '#E74C3C', info: '#2980B9',
  vrai: '#16A34A', faux: '#DC2626', white: '#FFFFFF',
};

type Screen    = 'sessions' | 'parties' | 'lobby';
type GameState = 'waiting' | 'question' | 'answered' | 'result';

interface SessionItem { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface PartyItem   { id: string; title: string; is_initial: boolean; min_score: number; min_rank: number | null; }
interface RunItem     { id: string; title: string; is_visible: boolean; is_closed: boolean; }
interface QuestionItem {
  id: string; question_text: string; score: number;
  correct_answer: boolean | null; answered: boolean;
  my_answer: boolean | null; score_awarded: number | null;
}
interface HistoryRun { run_id: string; run_title: string; questions: QuestionItem[]; }
interface LeaderEntry {
  rank: number; user_id: string; nom: string; prenom: string;
  run_score: number; is_current_user: boolean; avatar_url: string | null;
}
interface VraiFauxProps { userId?: string; userNom?: string; onBack?: () => void; }

export default function VraiFaux({ userId: userIdProp, userNom, onBack }: VraiFauxProps) {
  const [screen,     setScreen]     = useState<Screen>('sessions');
  const [gameState,  setGameState]  = useState<GameState>('waiting');
  const [selSession, setSelSession] = useState<SessionItem | null>(null);
  const [selParty,   setSelParty]   = useState<PartyItem   | null>(null);
  const [userId,     setUserId]     = useState<string>(userIdProp || '');

  const [sessions,    setSessions]    = useState<SessionItem[]>([]);
  const [parties,     setParties]     = useState<PartyItem[]>([]);
  const [activeRun,   setActiveRun]   = useState<RunItem | null>(null);
  const [question,    setQuestion]    = useState<QuestionItem | null>(null);
  const [myAnswer,    setMyAnswer]    = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [myRunScore,  setMyRunScore]  = useState(0);
  const [pointsWon,   setPointsWon]   = useState(0);
  const [history,     setHistory]     = useState<HistoryRun[]>([]);
  const [totalScore,  setTotalScore]  = useState<number | null>(null);
  const [isMember,    setIsMember]    = useState(false);

  const [initLoading,   setInitLoading]   = useState(true);
  const [joiningParty,  setJoiningParty]  = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [newDataFlash,  setNewDataFlash]  = useState(false);
  const [error,         setError]         = useState('');

  const isMounted       = useRef(true); // ✅ FIX: Déclaration du ref manquant
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunId       = useRef<string | null>(null);
  const questionFetched = useRef<string | null>(null);
  const seenRunIds      = useRef<Set<string>>(new Set());
  const resultTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef       = useRef<string>(userId);
  const selPartyRef     = useRef<PartyItem | null>(null);
  const resultScheduled = useRef(false); // ✅ Aussi ajouter ce ref s'il manquait

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const flashAnim    = useRef(new Animated.Value(0)).current;
  const questionAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { selPartyRef.current = selParty; }, [selParty]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    const init = async () => {
      // 1. Charger userId
      let uid = userIdProp || '';
      if (!uid) {
        try {
          const raw = await AsyncStorage.getItem('harmonia_session');
          if (raw) { const p = JSON.parse(raw); uid = p?.user?.id || ''; }
        } catch {}
      }
      if (uid) { setUserId(uid); userIdRef.current = uid; }

      // 2. Restaurer l'état lobby si on était en jeu (évite la disparition sur remontage)
      try {
        const savedLobby = await AsyncStorage.getItem('vf_lobby_state');
        if (savedLobby) {
          const lb = JSON.parse(savedLobby);
          if (lb.sessionId && lb.partyId && lb.sessionTitle && lb.partyTitle) {
            const sess: SessionItem = { id: lb.sessionId, title: lb.sessionTitle, description: lb.sessionDesc, is_paid: false, price_cfa: 0 };
            const party: PartyItem  = { id: lb.partyId, title: lb.partyTitle, is_initial: lb.partyInitial ?? true, min_score: 0, min_rank: null };
            setSelSession(sess);
            setSelParty(party); selPartyRef.current = party;
            setScreen('lobby');
            setGameState('waiting');
            // Recharger l'historique silencieusement
            if (uid) {
              const histRes = await fetch(`${BACKEND_URL}/game`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, function: 'getPartyHistory', party_id: lb.partyId }),
              });
              const histData = await histRes.json();
              if (histData.success) { setHistory(histData.history || []); setTotalScore(histData.total_score); setIsMember(histData.is_member); }
            }
            startPolling(lb.sessionId);
            setInitLoading(false);
            return; // pas besoin de charger les sessions
          }
        }
      } catch {}

      // 3. Sinon charger les sessions normalement
      await loadSessionsInternal(uid);
      setInitLoading(false);
    };
    init();
    isMounted.current = true; // (re)montage
    return () => {
      isMounted.current = false; // démontage → stopper tout
      if (pollRef.current)    clearInterval(pollRef.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      if (flashTimer.current)  clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'waiting') {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: false }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [gameState]);

  // ─── API ──────────────────────────────────────────────────────────────────
  const getUid = async (): Promise<string> => {
    let uid = userIdRef.current;
    if (!uid) {
      try {
        const raw = await AsyncStorage.getItem('harmonia_session');
        if (raw) { const p = JSON.parse(raw); uid = p?.user?.id || ''; if (uid) { setUserId(uid); userIdRef.current = uid; } }
      } catch {}
    }
    if (!uid) throw new Error('non connecté');
    return uid;
  };

  const gamePost = async (body: Record<string, any>) => {
    const uid = await getUid();
    const res = await fetch(`${BACKEND_URL}/game`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, ...body }),
    });
    return res.json();
  };

  const animateIn = () => {
    questionAnim.setValue(0);
    Animated.timing(questionAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  };

  const triggerFlash = () => {
    setNewDataFlash(true);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 2000, useNativeDriver: false }).start();
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setNewDataFlash(false), 2200);
  };

  // ─── Sessions ─────────────────────────────────────────────────────────────
  const loadSessionsInternal = async (uid?: string) => {
    try {
      const u = uid || userIdRef.current;
      if (!u) return;
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, function: 'listSessions', game_key: GAME_KEY }),
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions || []);
      else setError(data.error || 'Impossible de charger les sessions');
    } catch { setError('Erreur réseau — vérifiez votre connexion'); }
  };

  const syncSessions = async () => {
    setSyncing(true); setError('');
    await loadSessionsInternal();
    setSyncing(false);
  };

  const selectSession = async (session: SessionItem) => {
    setSelSession(session); setError('');
    try {
      const data = await gamePost({ function: 'listPartiesForSession', session_id: session.id });
      if (data.success) { setParties(data.parties || []); setScreen('parties'); }
      else setError(data.error || 'Impossible de charger les groupes');
    } catch { setError('Erreur réseau'); }
  };

  // ─── Parties : rejoindre + charger historique ──────────────────────────────
  const openParty = async (party: PartyItem) => {
    if (!selSession) return;
    setSelParty(party); selPartyRef.current = party;
    setJoiningParty(true); setError('');
    haptic.medium();
    try {
      const joinData = await gamePost({ function: 'joinSession', session_id: selSession.id, party_id: party.id });
      if (!joinData.success) { setError(joinData.error || 'Impossible de rejoindre'); setSelParty(null); return; }
      haptic.success();

      // Charger historique
      const histData = await gamePost({ function: 'getPartyHistory', party_id: party.id });
      if (histData.success) {
        setHistory(histData.history || []);
        setTotalScore(histData.total_score);
        setIsMember(histData.is_member);
      }

      setScreen('lobby'); setGameState('waiting');
      // Persister l'état lobby pour restauration si le composant est remonté
      try {
        await AsyncStorage.setItem('vf_lobby_state', JSON.stringify({
          sessionId:    selSession.id,
          sessionTitle: selSession.title,
          sessionDesc:  selSession.description || '',
          partyId:      party.id,
          partyTitle:   party.title,
          partyInitial: party.is_initial,
        }));
      } catch {}
      startPolling(selSession.id);
    } catch { setError('Erreur réseau'); setSelParty(null); }
    finally  { setJoiningParty(false); }
  };

  // ─── Polling silencieux ────────────────────────────────────────────────────
  const startPolling = (sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pollSilent(sessionId), POLL_MS);
    pollSilent(sessionId);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const syncHistorySilent = async (partyId: string) => {
    try {
      const data = await gamePost({ function: 'getPartyHistory', party_id: partyId });
      if (data.success) {
        const changed = data.total_score !== totalScore || (data.history || []).length !== history.length;
        setHistory(data.history || []);
        setTotalScore(data.total_score);
        setIsMember(data.is_member);
        if (changed) triggerFlash();
      }
    } catch {}
  };

  const pollSilent = async (sessionId: string) => {
    if (!isMounted.current) return; // composant démonté → ignorer
    try {
      const data = await gamePost({ function: 'listVisibleRuns', session_id: sessionId });
      if (!data.success || !isMounted.current) return;
      const runs: RunItem[] = data.runs || [];

      if (runs.length === 0) {
        setGameState(prev => (prev === 'answered' || prev === 'result') ? prev : 'waiting');
        return;
      }

      const latest = runs[runs.length - 1];

      if (lastRunId.current && latest.id !== lastRunId.current) {
        lastRunId.current = latest.id;
        questionFetched.current = null; // reset pour charger la nouvelle question
        seenRunIds.current.add(latest.id); // marquer comme vu en direct
        setActiveRun(latest); setMyAnswer(null); setQuestion(null); setLeaderboard([]);
        setGameState('question'); fetchQuestionSilent(latest.id); return;
      }
      if (!lastRunId.current) lastRunId.current = latest.id;
      // Marquer ce run comme "vu en direct" si pas encore fermé
      if (!latest.is_closed) seenRunIds.current.add(latest.id);
      // Mettre à jour activeRun seulement si l'état a changé (évite re-render inutile)
      setActiveRun(prev => {
        if (!prev || prev.is_closed !== latest.is_closed || prev.is_visible !== latest.is_visible) {
          return latest;
        }
        return prev;
      });

      if (latest.is_closed) {
        // N'afficher les résultats que si l'utilisateur a VU ce run en direct
        if (!seenRunIds.current.has(latest.id)) {
          // Run fermé non vu → ignorer, rester en waiting
          lastRunId.current = null;
          return;
        }
        // Appels async HORS du setter React (interdit dedans)
        if (!resultScheduled.current) {
          resultScheduled.current = true;
          setGameState('result');
          fetchResultsSilent(latest.id);
          scheduleReturnToWaiting();
        }
      } else {
        // Run ouvert : afficher la question si pas encore fait
        setGameState(prev => {
          if (prev === 'answered' || prev === 'result') return prev;
          if (prev !== 'question') {
            fetchQuestionSilent(latest.id);
            return 'question';
          }
          return prev;
        });
      }
    } catch {}
  };

  const scheduleReturnToWaiting = () => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(async () => {
      if (!isMounted.current) return;
      if (selPartyRef.current) await syncHistorySilent(selPartyRef.current.id);
      if (!isMounted.current) return;
      lastRunId.current = null;
      questionFetched.current = null;
      resultScheduled.current = false; // reset pour le prochain run
      setActiveRun(null); setQuestion(null); setMyAnswer(null); setLeaderboard([]);
      setGameState('waiting');
    }, RESULT_TTL_MS);
  };

  const fetchQuestionSilent = async (runId: string) => {
    if (!isMounted.current) return;
    // Éviter de re-charger si on a déjà la question de ce run
    if (questionFetched.current === runId) return;
    questionFetched.current = runId;
    try {
      const data = await gamePost({ function: 'getQuestions', run_id: runId });
      if (!isMounted.current) return;
      if (data.success && data.questions?.length > 0) {
        const unanswered = (data.questions as QuestionItem[]).filter(q => !q.answered);
        if (unanswered.length > 0) { setQuestion(unanswered[0]); animateIn(); haptic.medium(); }
        else { setGameState('answered'); }
      }
    } catch {
      questionFetched.current = null; // reset pour permettre un retry
    }
  };

  const fetchResultsSilent = async (runId: string) => {
    if (!isMounted.current) return;
    try {
      const [lbData, qData] = await Promise.all([
        gamePost({ function: 'getLeaderboard', run_id: runId }),
        gamePost({ function: 'getQuestions',   run_id: runId }),
      ]);
      if (!isMounted.current) return;
      if (lbData.success) {
        const lb: LeaderEntry[] = lbData.leaderboard || [];
        setLeaderboard(lb);
        setMyRunScore(lb.find(e => e.is_current_user)?.run_score ?? 0);
      }
      if (qData.success && qData.questions?.length > 0) {
        const q: QuestionItem = qData.questions[0];
        setQuestion(q);
        if (q.score_awarded !== null) setPointsWon(q.score_awarded);
        else if (q.correct_answer !== null && myAnswer !== null) setPointsWon(myAnswer === q.correct_answer ? (q.score ?? 0) : 0);
        animateIn();
      }
      haptic.success();
    } catch {}
  };

  const submitAnswer = async (answer: boolean) => {
    if (!question || !activeRun || answerLoading) return;
    setMyAnswer(answer); setAnswerLoading(true); haptic.medium();
    try {
      const data = await gamePost({ function: 'submitAnswer', run_question_id: question.id, answer });
      if (data.success) { setGameState('answered'); haptic.success(); }
      else { setMyAnswer(null); setError(data.error || 'Erreur lors de l\'envoi'); }
    } catch { setMyAnswer(null); setError('Erreur réseau'); }
    finally  { setAnswerLoading(false); }
  };

  const manualSync = async () => {
    if (!selParty || syncing) return;
    setSyncing(true); await syncHistorySilent(selParty.id); setSyncing(false);
  };

  const goBack = () => {
    if (screen === 'lobby') {
      stopPolling(); if (resultTimer.current) clearTimeout(resultTimer.current);
      lastRunId.current = null; selPartyRef.current = null;
      resultScheduled.current = false; questionFetched.current = null;
      seenRunIds.current.clear();
      // Effacer l'état lobby persisté
      try { AsyncStorage.removeItem('vf_lobby_state'); } catch {}
      setScreen('parties'); setGameState('waiting');
      setActiveRun(null); setQuestion(null); setMyAnswer(null);
      setLeaderboard([]); setHistory([]); setTotalScore(null); setIsMember(false);
    } else if (screen === 'parties') {
      setScreen('sessions'); setSelSession(null); setParties([]);
    } else { onBack?.(); }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.initLoader}>
          <Ionicons name="game-controller-outline" size={42} color={C.gold} />
          <Text style={s.initLoaderTxt}>Vrai ou Faux</Text>
          <ActivityIndicator size="small" color={C.muted} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* HEADER */}
        <LinearGradient colors={['#10100A', C.bg]} style={s.header}>
          {(screen !== 'sessions' || onBack) && (
            <TouchableOpacity onPress={goBack} style={s.iconBtn}>
              <Ionicons name="arrow-back" size={19} color={C.gold} />
            </TouchableOpacity>
          )}
          <View style={s.headerCenter}>
            <Text style={s.headerSub}>
              {screen === 'sessions' ? 'CHOISIR UNE SESSION'
               : screen === 'parties' ? selSession?.title?.toUpperCase()
               : selParty?.title?.toUpperCase()}
            </Text>
            <Text style={s.headerTitle}>Vrai ou Faux</Text>
          </View>
          <TouchableOpacity
            onPress={screen === 'lobby' ? manualSync : syncSessions}
            style={s.iconBtn} disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator size="small" color={C.gold} />
              : <Ionicons name={screen === 'lobby' ? 'sync-outline' : 'refresh-outline'} size={17} color={C.muted} />}
          </TouchableOpacity>
        </LinearGradient>

        {/* Flash discret nouvelles données */}
        {newDataFlash && (
          <Animated.View style={[s.flashBanner, { opacity: flashAnim }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }} />
            <Text style={s.flashTxt}>Mise à jour</Text>
          </Animated.View>
        )}

        {/* Erreur inline */}
        {error !== '' && (
          <View style={s.errorBar}>
            <Ionicons name="warning-outline" size={13} color={C.danger} />
            <Text style={s.errorBarTxt} numberOfLines={1}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={15} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* ══ SESSIONS ══ */}
        {screen === 'sessions' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>SESSIONS DISPONIBLES</Text>
            {sessions.length === 0
              ? <EmptyCard label="Aucune session" sub="Actualisez ou revenez plus tard" onRefresh={syncSessions} />
              : sessions.map(sess => (
                  <TouchableOpacity key={sess.id} style={s.card} onPress={() => selectSession(sess)} activeOpacity={0.8}>
                    <View style={s.cardIcon}>
                      <Ionicons name="albums-outline" size={17} color={C.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{sess.title}</Text>
                      {sess.description && <Text style={s.cardSub} numberOfLines={2}>{sess.description}</Text>}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                        <Pill label={sess.is_paid ? `💰 ${sess.price_cfa} CFA` : 'Gratuit'} color={sess.is_paid ? C.gold : C.success} />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={C.muted} />
                  </TouchableOpacity>
                ))
            }
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ══ PARTIES ══ */}
        {screen === 'parties' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>CHOISIR UN GROUPE</Text>
            {parties.length === 0
              ? <EmptyCard label="Aucun groupe" sub="Cette session n'a pas encore de groupes" />
              : parties.map(party => (
                  <TouchableOpacity key={party.id} style={s.card} onPress={() => openParty(party)} disabled={joiningParty} activeOpacity={0.8}>
                    <View style={[s.cardIcon, { borderColor: C.info + '44' }]}>
                      <Ionicons name="people-outline" size={17} color={C.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{party.title}{party.is_initial ? ' ⭐' : ''}</Text>
                      <Text style={s.cardSub}>
                        {party.is_initial ? 'Groupe ouvert à tous'
                          : [party.min_score > 0 ? `Score min : ${party.min_score}` : '', party.min_rank ? `Top ${party.min_rank}` : ''].filter(Boolean).join(' · ') || 'Groupe spécial'}
                      </Text>
                    </View>
                    {joiningParty && selParty?.id === party.id
                      ? <ActivityIndicator size="small" color={C.gold} />
                      : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
                  </TouchableOpacity>
                ))
            }
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ══ LOBBY ══ */}
        {screen === 'lobby' && (
          <View style={{ flex: 1 }}>

            {/* Bandeau score total */}
            {isMember && totalScore !== null && (
              <View style={s.scoreBand}>
                <Ionicons name="trophy-outline" size={13} color={C.gold} />
                <Text style={s.scoreBandTxt}>Score total : <Text style={s.scoreBandVal}>{totalScore} pts</Text></Text>
              </View>
            )}

            {/* WAITING */}
            {gameState === 'waiting' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                <View style={s.waitSection}>
                  <Animated.View style={[s.orb, { transform: [{ scale: pulseAnim }] }]}>
                    <Ionicons name="hourglass-outline" size={36} color={C.gold} />
                  </Animated.View>
                  <Text style={s.waitTitle}>En attente…</Text>
                  <Text style={s.waitSub}>L'administrateur va lancer la prochaine question</Text>
                  <View style={s.pollRow}>
                    <View style={s.pollDot} />
                    <Text style={s.pollTxt}>Surveillance active</Text>
                  </View>
                </View>

                {/* Historique */}
                {history.length > 0 && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 30 }}>
                    <Text style={s.sLabel}>QUESTIONS PRÉCÉDENTES</Text>
                    {history.map(run => (
                      <View key={run.run_id} style={s.histRunCard}>
                        <Text style={s.histRunTitle}>{run.run_title}</Text>
                        {run.questions.map(q => <HistoryQRow key={q.id} q={q} />)}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* QUESTION */}
            {gameState === 'question' && question && (
              <ScrollView
                contentContainerStyle={[s.scroll, { alignItems: 'stretch' }]}
                showsVerticalScrollIndicator={false}
              >
                <View style={s.liveBadge}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>EN DIRECT</Text>
                  <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>{question.score} pts</Text>
                </View>

                <View style={s.questionCard}>
                  <Text style={s.questionTxt}>{question.question_text}</Text>
                </View>

                <View style={s.answerRow}>
                  <AnsBtn label="VRAI" icon="checkmark-circle-outline" color={C.vrai}
                    selected={myAnswer === true} disabled={answerLoading || myAnswer !== null}
                    loading={answerLoading && myAnswer === true} onPress={() => submitAnswer(true)} />
                  <AnsBtn label="FAUX" icon="close-circle-outline" color={C.faux}
                    selected={myAnswer === false} disabled={answerLoading || myAnswer !== null}
                    loading={answerLoading && myAnswer === false} onPress={() => submitAnswer(false)} />
                </View>
              </ScrollView>
            )}

            {/* ANSWERED */}
            {gameState === 'answered' && (
              <View style={s.centerState}>
                <View style={[s.answerGiven, {
                  backgroundColor: (myAnswer ? C.vrai : C.faux) + '22',
                  borderColor:     (myAnswer ? C.vrai : C.faux) + '55',
                }]}>
                  <Ionicons name={myAnswer ? 'checkmark-circle' : 'close-circle'} size={38} color={myAnswer ? C.vrai : C.faux} />
                  <Text style={[s.answerGivenTxt, { color: myAnswer ? C.vrai : C.faux }]}>{myAnswer ? 'VRAI' : 'FAUX'}</Text>
                </View>
                <Text style={s.waitTitle}>Réponse enregistrée !</Text>
                <Text style={s.waitSub}>En attente que l'administrateur clôture</Text>
                <View style={s.pollRow}><View style={s.pollDot} /><Text style={s.pollTxt}>Surveillance active</Text></View>
              </View>
            )}

            {/* RÉSULTATS */}
            {gameState === 'result' && question && (
              <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {/* Bonne réponse */}
                <View style={s.revealCard}>
                  <Text style={s.revealLabel}>BONNE RÉPONSE</Text>
                  <View style={[s.revealBadge, {
                    backgroundColor: (question.correct_answer ? C.vrai : C.faux) + '22',
                    borderColor:     (question.correct_answer ? C.vrai : C.faux) + '55',
                  }]}>
                    <Ionicons name={question.correct_answer ? 'checkmark-circle' : 'close-circle'} size={24} color={question.correct_answer ? C.vrai : C.faux} />
                    <Text style={[s.revealBadgeTxt, { color: question.correct_answer ? C.vrai : C.faux }]}>
                      {question.correct_answer ? 'VRAI' : 'FAUX'}
                    </Text>
                  </View>
                </View>

                {/* Performance */}
                <View style={s.perfCard}>
                  {myAnswer !== null && question.correct_answer !== null ? (
                    myAnswer === question.correct_answer ? (
                      <><Ionicons name="trophy-outline" size={26} color={C.gold} />
                        <Text style={s.perfGood}>Bonne réponse !</Text>
                        <Text style={s.perfPts}>+{pointsWon || question.score} pts</Text></>
                    ) : (
                      <><Ionicons name="sad-outline" size={26} color={C.muted} />
                        <Text style={s.perfBad}>Mauvaise réponse</Text>
                        <Text style={[s.perfPts, { color: C.muted, fontSize: 18 }]}>+0 pt</Text></>
                    )
                  ) : (
                    <><Iconicons name="time-outline" size={26} color={C.muted} />
                      <Text style={s.perfBad}>Pas de réponse</Text></>
                  )}
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Score ce run : {myRunScore} pts</Text>
                </View>

                {/* Classement */}
                {leaderboard.length > 0 && (
                  <View style={s.lbCard}>
                    <Text style={s.sLabel}>CLASSEMENT</Text>
                    {leaderboard.map(e => (
                      <View key={e.user_id} style={[s.lbRow, e.is_current_user && s.lbRowMe]}>
                        <Text style={[s.lbRank, { color: e.rank === 1 ? C.gold : e.rank === 2 ? '#C0C0C0' : e.rank === 3 ? '#CD7F32' : C.muted }]}>
                          {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                        </Text>
                        <Text style={[s.lbName, e.is_current_user && { color: C.gold }]} numberOfLines={1}>{e.nom} {e.prenom}</Text>
                        <Text style={[s.lbScore, e.is_current_user && { color: C.gold }]}>{e.run_score} pts</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 }}>
                  <View style={s.pollDot} />
                  <Text style={s.pollTxt}>En attente de la prochaine question…</Text>
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function AnsBtn({ label, icon, color, selected, disabled, loading, onPress }: any) {
  return (
    <TouchableOpacity
      style={[s.answerBtn, { backgroundColor: color + 'EE' }, selected && s.answerSelected, (disabled && !selected) && s.answerDisabled]}
      onPress={onPress} disabled={disabled} activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color={C.white} size="large" /> : <Ionicons name={icon} size={32} color={C.white} />}
      <Text style={s.answerBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function HistoryQRow({ q }: { q: QuestionItem }) {
  const correct   = q.answered && q.my_answer === q.correct_answer;
  const incorrect = q.answered && q.my_answer !== q.correct_answer;
  const dotColor  = !q.answered ? C.muted : correct ? C.success : C.danger;
  const dotIcon   = !q.answered ? 'remove-circle-outline' : correct ? 'checkmark-circle' : 'close-circle';

  return (
    <View style={s.histQRow}>
      <View style={[s.histQIndicator, { backgroundColor: dotColor + '22', borderColor: dotColor + '55' }]}>
        <Ionicons name={dotIcon} size={16} color={dotColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.histQText} numberOfLines={3}>{q.question_text}</Text>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Bonne réponse */}
          <View style={[s.histQChip, { backgroundColor: (q.correct_answer ? C.vrai : C.faux) + '18', borderColor: (q.correct_answer ? C.vrai : C.faux) + '44' }]}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: q.correct_answer ? C.vrai : C.faux }}>✓ {q.correct_answer ? 'VRAI' : 'FAUX'}</Text>
          </View>
          {/* Ma mauvaise réponse */}
          {incorrect && (
            <View style={[s.histQChip, { backgroundColor: C.danger + '18', borderColor: C.danger + '44' }]}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: C.danger }}>✗ {q.my_answer ? 'VRAI' : 'FAUX'}</Text>
            </View>
          )}
          {/* Score */}
          {q.answered
            ? <Text style={{ fontSize: 10, fontWeight: '700', color: correct ? C.gold : C.muted }}>{correct ? `+${q.score_awarded ?? q.score}` : '+0'} pts</Text>
            : <Text style={{ fontSize: 9, color: C.muted }}>Non joué</Text>
          }
        </View>
      </View>
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

function EmptyCard({ label, sub, onRefresh }: { label: string; sub?: string; onRefresh?: () => void }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 13, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
      <Ionicons name="cube-outline" size={30} color={C.muted} />
      <Text style={{ color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 9 }}>{label}</Text>
      {sub && <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{sub}</Text>}
      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={{ marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="refresh-outline" size={14} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Actualiser</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  initLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  initLoaderTxt: { fontSize: 22, fontWeight: '800', color: C.cream },

  header: { paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  iconBtn: { width: 33, height: 33, borderRadius: 16, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub: { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 1 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: C.cream },

  flashBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.success + '18', paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.success + '33' },
  flashTxt: { color: C.success, fontSize: 11, fontWeight: '600' },

  errorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.danger + '18', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.danger + '33' },
  errorBarTxt: { flex: 1, color: C.danger, fontSize: 12 },

  scroll: { padding: 16 },
  sLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 2, marginBottom: 11 },

  card: { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44', flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 2 },
  cardSub: { fontSize: 12, color: C.muted },

  scoreBand: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.gold + '18', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.gold + '33' },
  scoreBandTxt: { color: C.muted, fontSize: 12 },
  scoreBandVal: { color: C.gold, fontWeight: '800' },

  waitSection: { alignItems: 'center', paddingTop: 38, paddingBottom: 24, paddingHorizontal: 30 },
  orb: { width: 106, height: 106, borderRadius: 53, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.gold + '44', marginBottom: 20 },
  waitTitle: { fontSize: 21, fontWeight: '800', color: C.cream, textAlign: 'center', marginBottom: 8 },
  waitSub:   { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  pollRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pollDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  pollTxt:   { color: C.muted, fontSize: 12 },

  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  answerGiven: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  answerGivenTxt: { fontSize: 22, fontWeight: '900' },

  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.danger + '18', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6, alignSelf: 'center', borderWidth: 1, borderColor: C.danger + '44', marginBottom: 16 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.danger },
  liveTxt: { color: C.danger, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  questionCard: { backgroundColor: C.surface, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, marginBottom: 22 },
  questionTxt: { fontSize: 20, fontWeight: '700', color: C.cream, lineHeight: 29, textAlign: 'center' },

  answerRow: { flexDirection: 'row', gap: 12 },
  answerBtn: { flex: 1, borderRadius: 16, paddingVertical: 32, alignItems: 'center', gap: 8 },
  answerSelected: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  answerDisabled: { opacity: 0.35 },
  answerBtnTxt: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 1 },

  revealCard: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.gold + '33', alignItems: 'center' },
  revealLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 12 },
  revealBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22, borderWidth: 1 },
  revealBadgeTxt: { fontSize: 24, fontWeight: '900' },

  perfCard: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 5 },
  perfGood: { fontSize: 17, fontWeight: '800', color: C.success },
  perfBad:  { fontSize: 15, fontWeight: '700', color: C.muted },
  perfPts:  { fontSize: 22, fontWeight: '900', color: C.gold },

  lbCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  lbRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border + '66' },
  lbRowMe:{ backgroundColor: C.gold + '11', borderRadius: 9, paddingHorizontal: 5, marginHorizontal: -5 },
  lbRank: { width: 34, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  lbName: { flex: 1, fontSize: 13, color: C.cream, fontWeight: '600' },
  lbScore:{ fontSize: 13, color: C.muted, fontWeight: '700' },

  histRunCard: { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border },
  histRunTitle:{ fontSize: 11, fontWeight: '700', color: C.gold, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  histQRow:    { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border + '55', alignItems: 'flex-start' },
  histQIndicator: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, flexShrink: 0, marginTop: 1 },
  histQText:   { fontSize: 13, color: C.cream, lineHeight: 18, fontWeight: '500', marginBottom: 2 },
  histQChip:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
});
