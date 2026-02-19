/**
 * vrai-faux.tsx — Interface Joueur Vrai ou Faux
 *
 * FLUX CORRIGÉ :
 *  1. Écran Sessions  — liste des sessions disponibles (listSessions)
 *  2. Écran Parties   — liste des parties de la session (listParties via backend game)
 *  3. Écran Lobby     — joueur rejoint la party (joinSession) → polling démarre
 *  4. État waiting    — attend qu'un run devienne visible
 *  5. État question   — affiche la question + boutons VRAI/FAUX
 *  6. État answered   — attend fermeture du run
 *  7. État result     — bonne réponse + score + leaderboard → retour waiting auto
 *
 * CORRECTIONS :
 *  ✅ setLoading(false) garanti même en cas d'erreur réseau
 *  ✅ Polling ne démarre qu'après joinSession réussi
 *  ✅ Transition result → waiting automatique après 10s
 *  ✅ Pas d'Alert.alert — messages inline
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL   = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY      = 'vrai_faux';
const POLL_MS       = 3000;
const RESULT_TTL_MS = 12000; // délai avant retour en "waiting" après résultats

const haptic = {
  medium:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
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
interface Question    { id: string; question_text: string; score: number; correct_answer: boolean | null; answered: boolean; my_answer: boolean | null; score_awarded: number | null; }
interface LeaderEntry { rank: number; user_id: string; nom: string; prenom: string; run_score: number; is_current_user: boolean; avatar_url: string | null; }

interface VraiFauxProps {
  userId?:   string; // optionnel — lu depuis AsyncStorage si absent
  userNom?:  string;
  onBack?:   () => void;
}

export default function VraiFaux({ userId: userIdProp, userNom, onBack }: VraiFauxProps) {
  const [screen,    setScreen]    = useState<Screen>('sessions');
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [userId,    setUserId]    = useState<string>(userIdProp || '');

  // Charger user_id depuis AsyncStorage si non fourni en prop
  useEffect(() => {
    if (!userIdProp) {
      AsyncStorage.getItem('user_id').then(id => {
        if (id) setUserId(id);
      });
    }
  }, [userIdProp]);

  // Données navigation
  const [sessions,    setSessions]    = useState<SessionItem[]>([]);
  const [parties,     setParties]     = useState<PartyItem[]>([]);
  const [selSession,  setSelSession]  = useState<SessionItem | null>(null);
  const [selParty,    setSelParty]    = useState<PartyItem | null>(null);

  // Jeu
  const [activeRun,   setActiveRun]   = useState<RunItem | null>(null);
  const [question,    setQuestion]    = useState<Question | null>(null);
  const [myAnswer,    setMyAnswer]    = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [myScore,     setMyScore]     = useState(0);
  const [pointsWon,   setPointsWon]   = useState(0);
  const [error,       setError]       = useState('');

  // Loaders séparés pour ne pas bloquer l'UI
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingParties,  setLoadingParties]  = useState(false);
  const [loadingJoin,     setLoadingJoin]     = useState(false);
  const [loadingAnswer,   setLoadingAnswer]   = useState(false);

  // Refs
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunId  = useRef<string | null>(null);
  const resultTimer= useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    // Charger d'abord user_id si pas fourni, puis les sessions
    const init = async () => {
      if (!userIdProp) {
        const storedId = await AsyncStorage.getItem('user_id');
        if (storedId) setUserId(storedId);
      }
      loadSessions();
    };
    init();
  }, []);

  useEffect(() => {
    if (gameState === 'waiting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [gameState]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (pollRef.current)    clearInterval(pollRef.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  // ─── API helpers ──────────────────────────────────────────────────────────
  const gamePost = async (body: Record<string, any>) => {
    // Tenter de récupérer user_id depuis AsyncStorage si pas encore chargé
    let uid = userId;
    if (!uid) {
      uid = (await AsyncStorage.getItem('user_id')) || '';
      if (uid) setUserId(uid);
    }
    if (!uid) throw new Error('user_id non disponible — veuillez vous connecter');
    const res  = await fetch(`${BACKEND_URL}/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, ...body }),
    });
    return res.json();
  };

  // ─── ÉCRAN SESSIONS ───────────────────────────────────────────────────────
  const loadSessions = async () => {
    setLoadingSessions(true);
    setError('');
    try {
      const data = await gamePost({ function: 'listSessions', game_key: GAME_KEY });
      if (data.success) setSessions(data.sessions || []);
      else setError(data.error || 'Impossible de charger les sessions');
    } catch {
      setError('Erreur réseau — vérifiez votre connexion');
    } finally {
      setLoadingSessions(false);
    }
  };

  const selectSession = async (session: SessionItem) => {
    setSelSession(session);
    setLoadingParties(true);
    setError('');
    try {
      // On récupère les parties via listParties (endpoint admin aussi accessible depuis game si tu l'ajoutes)
      // Pour l'instant on appelle /admin ou /game selon ce qui est disponible
      // → On utilise /game avec une nouvelle fonction listParties si ajoutée, sinon on passe directement
      // En attendant : on liste en appelant directement le backend admin sans password
      // CORRECTEMENT : le joueur appelle /game → listPartiesForSession
      const data = await gamePost({ function: 'listPartiesForSession', session_id: session.id });
      if (data.success) {
        setParties(data.parties || []);
        setScreen('parties');
      } else {
        setError(data.error || 'Impossible de charger les groupes');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoadingParties(false);
    }
  };

  // ─── ÉCRAN PARTIES ────────────────────────────────────────────────────────
  const joinParty = async (party: PartyItem) => {
    if (!selSession) return;
    setSelParty(party);
    setLoadingJoin(true);
    setError('');
    try {
      const data = await gamePost({
        function:   'joinSession',
        session_id: selSession.id,
        party_id:   party.id,
      });
      if (data.success) {
        haptic.success();
        setScreen('lobby');
        setGameState('waiting');
        startPolling(selSession.id);
      } else {
        setError(data.error || 'Impossible de rejoindre ce groupe');
        setSelParty(null);
      }
    } catch {
      setError('Erreur réseau');
      setSelParty(null);
    } finally {
      setLoadingJoin(false);
    }
  };

  // ─── POLLING ──────────────────────────────────────────────────────────────
  const startPolling = (sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => poll(sessionId), POLL_MS);
    // Appel immédiat
    poll(sessionId);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const poll = useCallback(async (sessionId: string) => {
    try {
      const data = await gamePost({ function: 'listVisibleRuns', session_id: sessionId });
      if (!data.success) return;

      const runs: RunItem[] = data.runs || [];

      if (runs.length === 0) {
        // Aucun run visible
        setGameState(prev => {
          if (prev === 'answered' || prev === 'result') return prev;
          return 'waiting';
        });
        return;
      }

      const latestRun = runs[runs.length - 1];

      // Nouveau run détecté → reset
      if (lastRunId.current && latestRun.id !== lastRunId.current) {
        lastRunId.current = latestRun.id;
        setActiveRun(latestRun);
        setMyAnswer(null);
        setQuestion(null);
        setLeaderboard([]);
        setGameState('question');
        fetchQuestion(latestRun.id);
        return;
      }

      if (!lastRunId.current) {
        lastRunId.current = latestRun.id;
      }

      setActiveRun(latestRun);

      if (latestRun.is_closed) {
        setGameState(prev => {
          if (prev === 'result') return 'result';
          fetchResults(latestRun.id);
          scheduleReturnToWaiting();
          return 'result';
        });
      } else {
        setGameState(prev => {
          if (prev === 'answered' || prev === 'result') return prev;
          if (prev !== 'question') {
            fetchQuestion(latestRun.id);
            return 'question';
          }
          return prev;
        });
      }
    } catch {
      // silencieux — le polling continue
    }
  }, [userId]);

  const scheduleReturnToWaiting = () => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => {
      lastRunId.current = null;
      setActiveRun(null);
      setQuestion(null);
      setMyAnswer(null);
      setLeaderboard([]);
      setGameState('waiting');
    }, RESULT_TTL_MS);
  };

  // ─── ACTIONS JEU ──────────────────────────────────────────────────────────
  const fetchQuestion = async (runId: string) => {
    try {
      const data = await gamePost({ function: 'getQuestions', run_id: runId });
      if (data.success && data.questions?.length > 0) {
        const unanswered = (data.questions as Question[]).filter(q => !q.answered);
        if (unanswered.length > 0) {
          setQuestion(unanswered[0]);
          haptic.medium();
        } else {
          // Déjà répondu
          setGameState('answered');
        }
      }
    } catch {}
  };

  const fetchResults = async (runId: string) => {
    try {
      const [lbData, qData] = await Promise.all([
        gamePost({ function: 'getLeaderboard', run_id: runId }),
        gamePost({ function: 'getQuestions',   run_id: runId }),
      ]);

      if (lbData.success) {
        const lb: LeaderEntry[] = lbData.leaderboard || [];
        setLeaderboard(lb);
        const me = lb.find(e => e.is_current_user);
        setMyScore(me?.run_score ?? 0);
      }

      if (qData.success && qData.questions?.length > 0) {
        const q: Question = qData.questions[0];
        setQuestion(q);
        // Le score attribué est dans score_awarded (retourné par getQuestions post-reveal)
        if (q.score_awarded !== null && q.score_awarded !== undefined) {
          setPointsWon(q.score_awarded);
        } else if (q.correct_answer !== null && myAnswer !== null) {
          setPointsWon(myAnswer === q.correct_answer ? (q.score ?? 0) : 0);
        }
      }

      haptic.success();
    } catch {}
  };

  const submitAnswer = async (answer: boolean) => {
    if (!question || !activeRun || loadingAnswer) return;
    setMyAnswer(answer);
    setLoadingAnswer(true);
    haptic.medium();
    try {
      const data = await gamePost({ function: 'submitAnswer', run_question_id: question.id, answer });
      if (data.success) {
        setGameState('answered');
        haptic.success();
      } else {
        setMyAnswer(null);
        setError(data.error || 'Erreur lors de l\'envoi');
      }
    } catch {
      setMyAnswer(null);
      setError('Erreur réseau');
    } finally {
      setLoadingAnswer(false);
    }
  };

  // ─── NAVIGATION RETOUR ────────────────────────────────────────────────────
  const goBackNav = () => {
    if (screen === 'lobby') {
      stopPolling();
      if (resultTimer.current) clearTimeout(resultTimer.current);
      lastRunId.current = null;
      setScreen('parties');
      setGameState('waiting');
      setActiveRun(null);
      setQuestion(null);
      setMyAnswer(null);
      setLeaderboard([]);
    } else if (screen === 'parties') {
      setScreen('sessions');
      setSelSession(null);
      setParties([]);
    } else {
      onBack?.();
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* Header */}
        <LinearGradient colors={['#10100A', C.bg]} style={s.header}>
          {(screen !== 'sessions' || onBack) && (
            <TouchableOpacity onPress={goBackNav} style={s.backBtn}>
              <Ionicons name="arrow-back" size={19} color={C.gold} />
            </TouchableOpacity>
          )}
          <View style={s.headerCenter}>
            <Text style={s.headerSub}>
              {screen === 'sessions' ? 'CHOISIR UNE SESSION' : screen === 'parties' ? selSession?.title?.toUpperCase() : 'EN JEU'}
            </Text>
            <Text style={s.headerTitle}>Vrai ou Faux</Text>
          </View>
          <View style={{ width: 33 }} />
        </LinearGradient>

        {/* ═══ ÉCRAN SESSIONS ═══ */}
        {screen === 'sessions' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>SESSIONS DISPONIBLES</Text>

            {error !== '' && <ErrorBanner msg={error} onRetry={loadSessions} />}

            {loadingSessions ? (
              <LoadingCard label="Chargement des sessions…" />
            ) : sessions.length === 0 ? (
              <EmptyCard label="Aucune session disponible" sub="Revenez plus tard ou contactez l'administrateur" onRefresh={loadSessions} />
            ) : (
              sessions.map(sess => (
                <TouchableOpacity key={sess.id} style={s.card} onPress={() => selectSession(sess)} activeOpacity={0.8}>
                  <View style={s.cardLeft}>
                    <View style={s.cardIcon}>
                      <Ionicons name="albums-outline" size={18} color={C.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{sess.title}</Text>
                      {sess.description && <Text style={s.cardSub} numberOfLines={2}>{sess.description}</Text>}
                      <View style={s.cardMeta}>
                        {sess.is_paid ? (
                          <View style={s.paidBadge}>
                            <Text style={s.paidBadgeTxt}>💰 {sess.price_cfa} CFA</Text>
                          </View>
                        ) : (
                          <View style={[s.paidBadge, { backgroundColor: C.success + '22', borderColor: C.success + '55' }]}>
                            <Text style={[s.paidBadgeTxt, { color: C.success }]}>Gratuit</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {loadingParties && selSession?.id === sess.id ? (
                    <ActivityIndicator size="small" color={C.gold} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={C.muted} />
                  )}
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={s.refreshBtn} onPress={loadSessions}>
              <Ionicons name="refresh-outline" size={15} color={C.muted} />
              <Text style={s.refreshBtnTxt}>Actualiser</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ═══ ÉCRAN PARTIES ═══ */}
        {screen === 'parties' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>CHOISIR UN GROUPE</Text>

            {error !== '' && <ErrorBanner msg={error} />}

            {loadingParties ? (
              <LoadingCard label="Chargement des groupes…" />
            ) : parties.length === 0 ? (
              <EmptyCard label="Aucun groupe disponible" sub="Cette session n'a pas encore de groupes" />
            ) : (
              parties.map(party => (
                <TouchableOpacity key={party.id} style={s.card} onPress={() => joinParty(party)} activeOpacity={0.8}
                  disabled={loadingJoin}>
                  <View style={s.cardLeft}>
                    <View style={[s.cardIcon, { borderColor: C.info + '55' }]}>
                      <Ionicons name="people-outline" size={18} color={C.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{party.title}{party.is_initial ? ' ⭐' : ''}</Text>
                      {party.is_initial ? (
                        <Text style={s.cardSub}>Groupe ouvert à tous</Text>
                      ) : (
                        <Text style={s.cardSub}>
                          {party.min_score > 0 ? `Score min : ${party.min_score}` : ''}
                          {party.min_rank ? ` · Rang top ${party.min_rank}` : ''}
                          {!party.min_score && !party.min_rank ? 'Groupe spécial' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  {loadingJoin && selParty?.id === party.id ? (
                    <ActivityIndicator size="small" color={C.gold} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={C.muted} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* ═══ ÉCRAN LOBBY / JEU ═══ */}
        {screen === 'lobby' && (
          <View style={{ flex: 1 }}>

            {/* Bandeau groupe */}
            <View style={s.lobbyBanner}>
              <Ionicons name="people-outline" size={14} color={C.gold} />
              <Text style={s.lobbyBannerTxt}>{selParty?.title}</Text>
              {userNom && <Text style={s.lobbyUser}>• {userNom}</Text>}
            </View>

            {/* WAITING */}
            {gameState === 'waiting' && (
              <View style={s.center}>
                <Animated.View style={[s.orb, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="hourglass-outline" size={38} color={C.gold} />
                </Animated.View>
                <Text style={s.waitTitle}>En attente…</Text>
                <Text style={s.waitSub}>L'administrateur va lancer la prochaine question</Text>
                <View style={s.pollIndicator}>
                  <ActivityIndicator size="small" color={C.muted} />
                  <Text style={s.pollTxt}>Surveillance en cours</Text>
                </View>
              </View>
            )}

            {/* QUESTION */}
            {gameState === 'question' && question && (
              <ScrollView contentContainerStyle={[s.scroll, { alignItems: 'stretch' }]} showsVerticalScrollIndicator={false}>
                {activeRun && (
                  <View style={s.liveBadge}>
                    <View style={s.liveDot} />
                    <Text style={s.liveTxt}>EN DIRECT</Text>
                    <Text style={s.livePts}>{question.score} pts</Text>
                  </View>
                )}

                <View style={s.questionCard}>
                  <Text style={s.questionText}>{question.question_text}</Text>
                </View>

                {error !== '' && <ErrorBanner msg={error} />}

                <View style={s.answerRow}>
                  <TouchableOpacity
                    style={[s.answerBtn, s.vraiBtn, (myAnswer === true) && s.answerSelected, loadingAnswer && s.answerDisabled]}
                    onPress={() => submitAnswer(true)}
                    disabled={loadingAnswer || myAnswer !== null}
                    activeOpacity={0.8}>
                    {loadingAnswer && myAnswer === true
                      ? <ActivityIndicator color={C.white} />
                      : <Ionicons name="checkmark-circle-outline" size={34} color={C.white} />}
                    <Text style={s.answerBtnTxt}>VRAI</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.answerBtn, s.fauxBtn, (myAnswer === false) && s.answerSelected, loadingAnswer && s.answerDisabled]}
                    onPress={() => submitAnswer(false)}
                    disabled={loadingAnswer || myAnswer !== null}
                    activeOpacity={0.8}>
                    {loadingAnswer && myAnswer === false
                      ? <ActivityIndicator color={C.white} />
                      : <Ionicons name="close-circle-outline" size={34} color={C.white} />}
                    <Text style={s.answerBtnTxt}>FAUX</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ANSWERED */}
            {gameState === 'answered' && (
              <View style={s.center}>
                <View style={[s.answerGiven, { backgroundColor: (myAnswer === true ? C.vrai : C.faux) + '22', borderColor: (myAnswer === true ? C.vrai : C.faux) + '66' }]}>
                  <Ionicons name={myAnswer === true ? 'checkmark-circle' : 'close-circle'} size={40} color={myAnswer === true ? C.vrai : C.faux} />
                  <Text style={[s.answerGivenTxt, { color: myAnswer === true ? C.vrai : C.faux }]}>
                    {myAnswer === true ? 'VRAI' : 'FAUX'}
                  </Text>
                </View>
                <Text style={s.waitTitle}>Réponse enregistrée !</Text>
                <Text style={s.waitSub}>En attente que l'administrateur clôture la question</Text>
                <View style={s.pollIndicator}>
                  <ActivityIndicator size="small" color={C.muted} />
                  <Text style={s.pollTxt}>Surveillance en cours</Text>
                </View>
              </View>
            )}

            {/* RESULT */}
            {gameState === 'result' && question && (
              <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

                {/* Bonne réponse */}
                <View style={s.revealCard}>
                  <Text style={s.revealLabel}>BONNE RÉPONSE</Text>
                  <View style={[s.revealBadge, {
                    backgroundColor: (question.correct_answer ? C.vrai : C.faux) + '22',
                    borderColor: (question.correct_answer ? C.vrai : C.faux) + '55'
                  }]}>
                    <Ionicons name={question.correct_answer ? 'checkmark-circle' : 'close-circle'} size={26} color={question.correct_answer ? C.vrai : C.faux} />
                    <Text style={[s.revealBadgeTxt, { color: question.correct_answer ? C.vrai : C.faux }]}>
                      {question.correct_answer ? 'VRAI' : 'FAUX'}
                    </Text>
                  </View>
                </View>

                {/* Ma performance */}
                <View style={s.perfCard}>
                  {myAnswer !== null && question.correct_answer !== null ? (
                    myAnswer === question.correct_answer ? (
                      <>
                        <Ionicons name="trophy-outline" size={28} color={C.gold} />
                        <Text style={s.perfGood}>Bonne réponse !</Text>
                        <Text style={s.perfPts}>+{pointsWon || question.score} pts</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="sad-outline" size={28} color={C.muted} />
                        <Text style={s.perfBad}>Mauvaise réponse</Text>
                        <Text style={s.perfPtsBad}>+0 pt</Text>
                      </>
                    )
                  ) : (
                    <>
                      <Ionicons name="time-outline" size={28} color={C.muted} />
                      <Text style={s.perfBad}>Pas de réponse</Text>
                    </>
                  )}
                  <Text style={s.perfTotal}>Score ce run : {myScore} pts</Text>
                </View>

                {/* Leaderboard */}
                {leaderboard.length > 0 && (
                  <View style={s.lbCard}>
                    <Text style={s.lbLabel}>CLASSEMENT</Text>
                    {leaderboard.map(e => (
                      <View key={e.user_id} style={[s.lbRow, e.is_current_user && s.lbRowMe]}>
                        <Text style={[s.lbRank, { color: e.rank === 1 ? C.gold : e.rank === 2 ? '#C0C0C0' : e.rank === 3 ? '#CD7F32' : C.muted }]}>
                          {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                        </Text>
                        <Text style={[s.lbName, e.is_current_user && { color: C.gold }]} numberOfLines={1}>
                          {e.nom} {e.prenom}
                        </Text>
                        <Text style={[s.lbScore, e.is_current_user && { color: C.gold }]}>{e.run_score} pts</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={s.waitingNext}>
                  <ActivityIndicator size="small" color={C.muted} />
                  <Text style={s.waitingNextTxt}>En attente de la prochaine question…</Text>
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

function LoadingCard({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={{ color: C.muted, fontSize: 13, marginTop: 12 }}>{label}</Text>
    </View>
  );
}

function EmptyCard({ label, sub, onRefresh }: { label: string; sub?: string; onRefresh?: () => void }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginTop: 6 }}>
      <Ionicons name="cube-outline" size={32} color={C.muted} />
      <Text style={{ color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 10 }}>{label}</Text>
      {sub && <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{sub}</Text>}
      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="refresh-outline" size={14} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Réessayer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.danger + '18', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: C.danger + '44', marginBottom: 10 }}>
      <Ionicons name="warning-outline" size={15} color={C.danger} />
      <Text style={{ flex: 1, color: C.danger, fontSize: 12 }}>{msg}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={{ color: C.danger, fontWeight: '700', fontSize: 12 }}>Réessayer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header:       { paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:      { width: 33, height: 33, borderRadius: 16, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 1 },
  headerTitle:  { fontSize: 19, fontWeight: '800', color: C.cream },

  scroll:       { padding: 16 },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 2, marginBottom: 12 },

  card:    { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center' },
  cardLeft:{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  cardIcon:{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44', flexShrink: 0 },
  cardTitle:{ fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 3 },
  cardSub:  { fontSize: 12, color: C.muted, lineHeight: 17 },
  cardMeta: { flexDirection: 'row', gap: 7, marginTop: 6 },
  paidBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: C.gold + '22', borderWidth: 1, borderColor: C.gold + '55' },
  paidBadgeTxt: { fontSize: 11, fontWeight: '700', color: C.gold },

  refreshBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 11 },
  refreshBtnTxt: { color: C.muted, fontSize: 12, fontWeight: '600' },

  // Lobby
  lobbyBanner:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  lobbyBannerTxt: { color: C.gold, fontSize: 13, fontWeight: '700' },
  lobbyUser:      { color: C.muted, fontSize: 12 },

  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  orb:            { width: 110, height: 110, borderRadius: 55, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.gold + '44', marginBottom: 24 },
  waitTitle:      { fontSize: 22, fontWeight: '800', color: C.cream, textAlign: 'center', marginBottom: 9 },
  waitSub:        { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  pollIndicator:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollTxt:        { color: C.muted, fontSize: 12 },

  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.danger + '18', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6, alignSelf: 'center', borderWidth: 1, borderColor: C.danger + '44', marginBottom: 18 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: C.danger },
  liveTxt:   { color: C.danger, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  livePts:   { color: C.gold, fontSize: 11, fontWeight: '700' },

  questionCard: { backgroundColor: C.surface, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, marginBottom: 22 },
  questionText: { fontSize: 20, fontWeight: '700', color: C.cream, lineHeight: 29, textAlign: 'center' },

  answerRow:      { flexDirection: 'row', gap: 12 },
  answerBtn:      { flex: 1, borderRadius: 16, paddingVertical: 32, alignItems: 'center', gap: 9 },
  vraiBtn:        { backgroundColor: C.vrai + 'EE' },
  fauxBtn:        { backgroundColor: C.faux + 'EE' },
  answerSelected: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  answerDisabled: { opacity: 0.5 },
  answerBtnTxt:   { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 1 },

  answerGiven:    { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 22, paddingVertical: 15, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  answerGivenTxt: { fontSize: 22, fontWeight: '900' },

  revealCard:     { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 11, borderWidth: 1, borderColor: C.gold + '33', alignItems: 'center' },
  revealLabel:    { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 13 },
  revealBadge:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 22, borderWidth: 1 },
  revealBadgeTxt: { fontSize: 26, fontWeight: '900' },

  perfCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 11, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 6 },
  perfGood:    { fontSize: 18, fontWeight: '800', color: C.success },
  perfBad:     { fontSize: 16, fontWeight: '700', color: C.muted },
  perfPts:     { fontSize: 22, fontWeight: '900', color: C.gold },
  perfPtsBad:  { fontSize: 16, fontWeight: '700', color: C.muted },
  perfTotal:   { fontSize: 12, color: C.muted, marginTop: 6 },

  lbCard:  { backgroundColor: C.surface, borderRadius: 14, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: C.border },
  lbLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 11 },
  lbRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border + '88' },
  lbRowMe: { backgroundColor: C.gold + '11', borderRadius: 9, paddingHorizontal: 6, marginHorizontal: -6 },
  lbRank:  { width: 36, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  lbName:  { flex: 1, fontSize: 13, color: C.cream, fontWeight: '600' },
  lbScore: { fontSize: 13, color: C.muted, fontWeight: '700' },

  waitingNext:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 18 },
  waitingNextTxt: { color: C.muted, fontSize: 12 },
});
