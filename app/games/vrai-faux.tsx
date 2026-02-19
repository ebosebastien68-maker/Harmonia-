/**
 * vrai-faux.tsx — Interface Joueur
 * ✅ Cross-platform : Web · Android · iOS
 * ✅ Polling automatique toutes les 3s — zéro bouton "Actualiser"
 * ✅ Un run = une question qui s'affiche automatiquement
 * ✅ Réponse enregistrée → attente automatique → révélation à la fermeture
 * ✅ Zéro saisie de run ID
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Platform,
  ActivityIndicator, ScrollView, Alert, Animated, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND_URL   = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const POLL_INTERVAL = 3000; // 3 secondes

const haptic = {
  medium:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  heavy:   () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#080B14',
  surface:  '#0F1420',
  card:     '#141926',
  border:   '#1E2640',
  accent:   '#4F8EF7',
  accentAlt:'#7B6CF6',
  success:  '#00D68F',
  danger:   '#FF4D6D',
  gold:     '#FFD166',
  muted:    '#4A5578',
  cream:    '#E8EDF5',
  white:    '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface VraiFauxProps { title: string; icon: string; color: string; onClose?: () => void; }

interface Session   { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface ActiveRun { id: string; title: string; is_visible: boolean; is_closed: boolean; is_started: boolean; }
interface Question  { id: string; question_text: string; score: number; answered: boolean; correct_answer?: boolean; }
interface Leader    { rank: number; user_id: string; nom: string; prenom: string; run_score: number; is_current_user: boolean; }

// États de l'écran principal (après avoir rejoint)
// 'waiting'  = dans la session, en attente d'une question publiée
// 'question' = une question est en direct, l'utilisateur peut répondre
// 'answered' = a répondu, attend la clôture du run
// 'result'   = run fermé, affiche bonne réponse + scores
type GameState = 'waiting' | 'question' | 'answered' | 'result';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function VraiFaux({ title, icon, color, onClose }: VraiFauxProps) {
  const [userId,       setUserId]      = useState('');
  const [loading,      setLoading]     = useState(false);
  const [screen,       setScreen]      = useState<'sessions' | 'lobby'>('sessions');

  // Sessions
  const [sessions,     setSessions]    = useState<Session[]>([]);
  const [activeSession,setActSession]  = useState<Session | null>(null);

  // État jeu (après avoir rejoint une session)
  const [gameState,    setGameState]   = useState<GameState>('waiting');
  const [activeRun,    setActiveRun]   = useState<ActiveRun | null>(null);
  const [question,     setQuestion]    = useState<Question | null>(null);
  const [myAnswer,     setMyAnswer]    = useState<boolean | null>(null);
  const [leaderboard,  setLeaderboard] = useState<Leader[]>([]);
  const [pointsWon,    setPointsWon]   = useState(0);
  const [totalScore,   setTotalScore]  = useState(0);

  // Polling
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<string>('');

  // Animations
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const scaleVrai  = useRef(new Animated.Value(1)).current;
  const scaleFaux  = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadUser(); loadSessions(); }, []);

  // Pulse animation pour l'état "waiting"
  useEffect(() => {
    if (gameState === 'waiting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [gameState]);

  // Transition d'entrée
  useEffect(() => {
    fadeAnim.setValue(0); slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18 }),
    ]).start();
  }, [screen, gameState]);

  // Cleanup polling
  useEffect(() => () => { stopPolling(); }, []);

  // ─── Polling ────────────────────────────────────────────────────────────────
  const startPolling = (sessionId: string) => {
    sessionRef.current = sessionId;
    stopPolling();
    pollRef.current = setInterval(() => pollGameState(sessionId), POLL_INTERVAL);
    pollGameState(sessionId); // Premier appel immédiat
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Sonde l'état du jeu — appelée par le polling
  const pollGameState = useCallback(async (sessionId: string) => {
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'listVisibleRuns', session_id: sessionId, user_id: userId }),
      });
      const data = await res.json();
      if (!data.success) return;

      const runs: ActiveRun[] = data.runs || [];

      // Aucun run visible → attente (sauf si on est déjà en answered/result)
      if (runs.length === 0) {
        setGameState(prev => {
          if (prev === 'answered' || prev === 'result') return prev;
          return 'waiting';
        });
        return;
      }

      // Prendre le run le plus récent
      const latestRun = runs[runs.length - 1];

      // Si c'est un nouveau run différent de celui en cours → reset
      if (activeRun && latestRun.id !== activeRun.id) {
        setGameState('question');
        setMyAnswer(null);
        setQuestion(null);
        setLeaderboard([]);
        setActiveRun(latestRun);
        fetchQuestion(latestRun);
        return;
      }

      setActiveRun(latestRun);

      setGameState(prev => {
        // Run fermé → charger les résultats (correct_answer devient visible via la vue)
        if (latestRun.is_closed) {
          if (prev !== 'result') {
            fetchResults(latestRun.id);
            return 'result';
          }
          return 'result';
        }

        // Déjà en train de répondre ou a répondu → ne pas régresser
        if (prev === 'question' || prev === 'answered') return prev;

        // Nouveau run visible → charger la question
        fetchQuestion(latestRun);
        return 'question';
      });

    } catch { /* silencieux */ }
  }, [userId, activeRun]);

  const fetchQuestion = async (run: ActiveRun) => {
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'getQuestions', run_id: run.id, user_id: userId }),
      });
      const data = await res.json();
      if (data.success && data.questions?.length > 0) {
        // correct_answer sera NULL ici (run pas encore fermé) — la vue masque la réponse
        const unanswered = data.questions.filter((q: Question) => !q.answered);
        if (unanswered.length > 0) {
          setQuestion(unanswered[0]);
          setMyAnswer(null);
          haptic.medium();
        } else {
          // Déjà répondu à cette question
          setGameState('answered');
        }
      }
    } catch {}
  };

  const fetchResults = async (runId: string) => {
    try {
      const [lbRes, qRes] = await Promise.all([
        fetch(`${BACKEND_URL}/game`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ function: 'getLeaderboard', run_id: runId, user_id: userId }),
        }),
        fetch(`${BACKEND_URL}/game`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          // getQuestions sur run fermé → la vue révèle correct_answer (reveal_answers=true via trigger)
          body: JSON.stringify({ function: 'getQuestions', run_id: runId, user_id: userId }),
        }),
      ]);

      const lbData  = await lbRes.json();
      const qData   = await qRes.json();

      if (lbData.success) {
        setLeaderboard(lbData.leaderboard || []);
        const me = (lbData.leaderboard as Leader[]).find(e => e.is_current_user);
        setTotalScore(me?.run_score ?? 0);
      }

      if (qData.success && qData.questions?.length > 0) {
        const q = qData.questions[0];
        setQuestion(q); // correct_answer est maintenant révélé par la vue BDD
        // Calculer les points gagnés en comparant ma réponse à la bonne réponse
        if (q.correct_answer !== null && myAnswer !== null) {
          setPointsWon(myAnswer === q.correct_answer ? (q.score ?? 0) : 0);
        } else if (q.score_awarded !== null) {
          // Si le backend retourne directement le score attribué
          setPointsWon(q.score_awarded ?? 0);
        }
      }

      haptic.success();
    } catch {}
  };

  // ─── User ───────────────────────────────────────────────────────────────────
  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem('harmonia_session');
      if (stored) setUserId(JSON.parse(stored)?.user?.id || '');
    } catch {}
  };

  // ─── Sessions ───────────────────────────────────────────────────────────────
  const loadSessions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'listSessions', game_key: 'vrai_faux' }),
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions || []);
    } catch {}
    finally  { setLoading(false); }
  };

  // ─── Rejoindre session ───────────────────────────────────────────────────────
  const joinSession = async (session: Session) => {
    if (!userId) return Alert.alert('Non connecté', 'Veuillez vous connecter pour jouer');
    haptic.medium();
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'joinSession', session_id: session.id, user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setActSession(session);
        setGameState('waiting');
        setActiveRun(null);
        setQuestion(null);
        setMyAnswer(null);
        setLeaderboard([]);
        setScreen('lobby');
        startPolling(session.id);
      } else {
        Alert.alert('Erreur', data.error || 'Impossible de rejoindre la session');
      }
    } catch { Alert.alert('Erreur réseau', 'Impossible de contacter le serveur'); }
    finally  { setLoading(false); }
  };

  // ─── Répondre ────────────────────────────────────────────────────────────────
  const submitAnswer = async (answer: boolean) => {
    if (!question || !activeRun || loading) return;
    haptic.heavy();
    setMyAnswer(answer);

    // Animation bouton pressé
    const ref = answer ? scaleVrai : scaleFaux;
    Animated.sequence([
      Animated.timing(ref, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(ref, { toValue: 1, useNativeDriver: true, damping: 10 }),
    ]).start();

    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'submitAnswer',
          run_question_id: question.id,
          answer,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGameState('answered');
      } else {
        setMyAnswer(null);
        Alert.alert('Erreur', data.error || 'Impossible d\'enregistrer la réponse');
      }
    } catch {
      setMyAnswer(null);
      Alert.alert('Erreur réseau');
    } finally { setLoading(false); }
  };

  // ─── Quitter et revenir aux sessions ─────────────────────────────────────────
  const leaveSession = () => {
    stopPolling();
    setScreen('sessions');
    setActSession(null);
    setGameState('waiting');
    setQuestion(null);
    setMyAnswer(null);
    setLeaderboard([]);
  };

  // ─── ÉCRAN SESSIONS ──────────────────────────────────────────────────────────
  if (screen === 'sessions') {
    return (
      <SafeAreaView style={st.root}>
        <GameHeader title={title} color={color} onBack={onClose} />

        {loading ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={color} />
            <Text style={st.loadingTxt}>Chargement…</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={st.center}>
            <View style={st.emptyIconWrap}>
              <Ionicons name="game-controller-outline" size={52} color={C.muted} />
            </View>
            <Text style={st.emptyTitle}>Aucune session disponible</Text>
            <Text style={st.emptyDesc}>Les sessions créées par l'administrateur apparaîtront ici.</Text>
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: color }]} onPress={loadSessions}>
              <Ionicons name="refresh-outline" size={16} color={C.bg} />
              <Text style={[st.actionBtnTxt, { color: C.bg }]}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
            <Text style={st.sectionLabel}>SESSIONS DISPONIBLES</Text>
            {sessions.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} color={color} onPress={() => joinSession(s)} />
            ))}
            <View style={{ height: 40 }} />
          </Animated.ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ─── LOBBY (état jeu après joinSession) ──────────────────────────────────────
  return (
    <SafeAreaView style={st.root}>
      {/* Header avec nom de session */}
      <GameHeader title={activeSession?.title || title} color={color} onBack={leaveSession} />

      {/* ── EN ATTENTE ── */}
      {gameState === 'waiting' && (
        <Animated.View style={[st.center, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.View style={[st.waitingOrb, { borderColor: color + '55', transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="hourglass-outline" size={54} color={color} />
          </Animated.View>
          <Text style={st.waitingTitle}>En attente d'une question</Text>
          <Text style={st.waitingSub}>
            L'administrateur va publier une question.{'\n'}
            Elle apparaîtra automatiquement ici.
          </Text>
          <View style={st.pollIndicator}>
            <ActivityIndicator size="small" color={C.muted} />
            <Text style={st.pollTxt}>Surveillance en cours…</Text>
          </View>
        </Animated.View>
      )}

      {/* ── QUESTION EN DIRECT ── */}
      {(gameState === 'question') && question && (
        <Animated.View style={[st.gameWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Badge LIVE */}
          <View style={st.liveBadge}>
            <View style={st.liveDot} />
            <Text style={st.liveTxt}>EN DIRECT</Text>
          </View>

          {/* Badge score */}
          <View style={st.scoreChip}>
            <Ionicons name="star" size={13} color={C.gold} />
            <Text style={st.scoreChipTxt}>{question.score} pts en jeu</Text>
          </View>

          {/* Question */}
          <View style={st.questionCard}>
            <Text style={st.questionTxt}>{question.question_text}</Text>
          </View>

          {/* VRAI / FAUX */}
          <View style={st.answerRow}>
            <Animated.View style={[st.answerWrap, { transform: [{ scale: scaleVrai }] }]}>
              <TouchableOpacity
                style={[st.answerBtn, { backgroundColor: C.success }]}
                onPress={() => submitAnswer(true)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={52} color={C.white} />
                <Text style={st.answerBtnTxt}>VRAI</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[st.answerWrap, { transform: [{ scale: scaleFaux }] }]}>
              <TouchableOpacity
                style={[st.answerBtn, { backgroundColor: C.danger }]}
                onPress={() => submitAnswer(false)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle" size={52} color={C.white} />
                <Text style={st.answerBtnTxt}>FAUX</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {loading && <ActivityIndicator size="small" color={color} style={{ marginTop: 16 }} />}
        </Animated.View>
      )}

      {/* ── RÉPONDU — EN ATTENTE DES RÉSULTATS ── */}
      {gameState === 'answered' && (
        <Animated.View style={[st.center, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Réponse donnée */}
          <View style={[
            st.answeredBadge,
            { borderColor: (myAnswer ? C.success : C.danger) + '66', backgroundColor: (myAnswer ? C.success : C.danger) + '18' }
          ]}>
            <Ionicons name={myAnswer ? 'checkmark-circle' : 'close-circle'} size={60} color={myAnswer ? C.success : C.danger} />
            <Text style={[st.answeredLabel, { color: myAnswer ? C.success : C.danger }]}>
              Vous avez répondu {myAnswer ? 'VRAI' : 'FAUX'}
            </Text>
          </View>

          <Text style={st.waitingTitle}>Réponse enregistrée !</Text>
          <Text style={st.waitingSub}>
            En attente que l'administrateur ferme la question.{'\n'}
            Les scores s'afficheront automatiquement.
          </Text>

          <View style={st.pollIndicator}>
            <ActivityIndicator size="small" color={C.muted} />
            <Text style={st.pollTxt}>Surveillance en cours…</Text>
          </View>
        </Animated.View>
      )}

      {/* ── RÉSULTATS ── */}
      {gameState === 'result' && question && (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Bonne réponse */}
          <View style={st.correctAnswerCard}>
            <Text style={st.correctAnswerLabel}>BONNE RÉPONSE</Text>
            <View style={[
              st.correctAnswerBadge,
              { backgroundColor: (question.correct_answer ? C.success : C.danger) + '22', borderColor: (question.correct_answer ? C.success : C.danger) + '66' }
            ]}>
              <Ionicons
                name={question.correct_answer ? 'checkmark-circle' : 'close-circle'}
                size={42}
                color={question.correct_answer ? C.success : C.danger}
              />
              <Text style={[st.correctAnswerTxt, { color: question.correct_answer ? C.success : C.danger }]}>
                {question.correct_answer ? 'VRAI' : 'FAUX'}
              </Text>
            </View>
            <Text style={st.questionRecap}>{question.question_text}</Text>

            {/* Ma performance */}
            {myAnswer !== null && (
              <View style={[
                st.myPerf,
                { backgroundColor: (myAnswer === question.correct_answer ? C.success : C.danger) + '18',
                  borderColor:     (myAnswer === question.correct_answer ? C.success : C.danger) + '44' }
              ]}>
                <Ionicons
                  name={myAnswer === question.correct_answer ? 'trophy-outline' : 'close-circle-outline'}
                  size={20}
                  color={myAnswer === question.correct_answer ? C.success : C.danger}
                />
                <Text style={[st.myPerfTxt, { color: myAnswer === question.correct_answer ? C.success : C.danger }]}>
                  {myAnswer === question.correct_answer
                    ? `Bonne réponse ! +${question.score} pts`
                    : 'Mauvaise réponse — 0 pt'}
                </Text>
              </View>
            )}
          </View>

          {/* Mon classement */}
          {leaderboard.length > 0 && (() => {
            const me = leaderboard.find(e => e.is_current_user);
            return me ? (
              <LinearGradient colors={[color + 'CC', C.accentAlt + '88']} style={st.myCard}>
                <Text style={st.myCardLabel}>VOTRE RANG</Text>
                <Text style={st.myCardRank}>#{me.rank}</Text>
                <Text style={st.myCardScore}>{me.run_score} pts</Text>
              </LinearGradient>
            ) : null;
          })()}

          {/* Leaderboard */}
          <Text style={st.sectionLabel}>CLASSEMENT</Text>
          {leaderboard.map(e => <LeaderRow key={e.user_id} entry={e} />)}

          {/* Attendre la prochaine question */}
          <View style={st.nextQuestionWait}>
            <ActivityIndicator size="small" color={C.muted} />
            <Text style={st.nextQuestionWaitTxt}>En attente de la prochaine question…</Text>
          </View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function GameHeader({ title, color, onBack }: { title: string; color: string; onBack?: () => void }) {
  return (
    <View style={st.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[st.headerBtn, { borderColor: color + '44' }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={20} color={color} />
        </TouchableOpacity>
      ) : <View style={st.headerBtn} />}
      <Text style={st.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={st.headerBtn} />
    </View>
  );
}

function SessionCard({ session, index, color, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={st.sessionCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={[st.sessionIdx, { backgroundColor: color + '22' }]}>
          <Text style={[st.sessionIdxTxt, { color }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.sessionTitle}>{session.title}</Text>
          {session.description ? <Text style={st.sessionDesc}>{session.description}</Text> : null}
          <View style={session.is_paid ? st.priceBadge : st.freeBadge}>
            <Text style={session.is_paid ? st.priceTxt : st.freeTxt}>
              {session.is_paid ? `💰 ${session.price_cfa} CFA` : 'Gratuit'}
            </Text>
          </View>
        </View>
        <View style={[st.joinBtn, { backgroundColor: color }]}>
          <Text style={st.joinBtnTxt}>Rejoindre</Text>
          <Ionicons name="arrow-forward" size={14} color={C.bg} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function LeaderRow({ entry }: { entry: Leader }) {
  const medals = ['🥇', '🥈', '🥉'];
  const isTop3  = entry.rank <= 3;
  return (
    <View style={[st.leaderRow, entry.is_current_user && st.leaderRowMe]}>
      <Text style={st.leaderMedal}>{isTop3 ? medals[entry.rank - 1] : `#${entry.rank}`}</Text>
      <Text style={[st.leaderName, entry.is_current_user && { color: C.gold }]}>
        {entry.prenom} {entry.nom}{entry.is_current_user ? ' (vous)' : ''}
      </Text>
      <Text style={[st.leaderScore, isTop3 && { color: C.gold }]}>{entry.run_score} pts</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const C_ALT = '#7B6CF6';

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll:  { padding: 16 },

  header:    { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerTitle:{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.cream, marginHorizontal: 8 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  loadingTxt:   { color: C.muted, fontSize: 13, marginTop: 12 },

  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: C.cream, textAlign: 'center', marginBottom: 8 },
  emptyDesc:     { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  actionBtnTxt:  { fontSize: 15, fontWeight: '700' },

  // Session cards
  sessionCard:   { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  sessionIdx:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sessionIdxTxt: { fontSize: 15, fontWeight: '800' },
  sessionTitle:  { fontSize: 15, fontWeight: '700', color: C.cream, marginBottom: 3 },
  sessionDesc:   { fontSize: 12, color: C.muted, marginBottom: 6 },
  priceBadge:    { alignSelf: 'flex-start', backgroundColor: '#FFD16622', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: '#FFD16655' },
  priceTxt:      { fontSize: 11, color: C.gold, fontWeight: '600' },
  freeBadge:     { alignSelf: 'flex-start', backgroundColor: '#00D68F22', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: '#00D68F55' },
  freeTxt:       { fontSize: 11, color: C.success, fontWeight: '600' },
  joinBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  joinBtnTxt:    { fontSize: 12, fontWeight: '700', color: C.bg },

  // Waiting
  waitingOrb:   { width: 110, height: 110, borderRadius: 55, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2 },
  waitingTitle: { fontSize: 22, fontWeight: '800', color: C.cream, marginBottom: 10, textAlign: 'center' },
  waitingSub:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  pollIndicator:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollTxt:      { color: C.muted, fontSize: 12 },

  // Game
  gameWrap:    { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, justifyContent: 'space-between' },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', backgroundColor: C.danger + '22', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.danger + '55', marginBottom: 8 },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger },
  liveTxt:     { color: C.danger, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  scoreChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', backgroundColor: '#FFD16618', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FFD16640' },
  scoreChipTxt:{ color: C.gold, fontSize: 13, fontWeight: '700' },
  questionCard:{ flex: 1, backgroundColor: C.card, borderRadius: 24, padding: 28, justifyContent: 'center', alignItems: 'center', marginVertical: 18, borderWidth: 1, borderColor: C.border },
  questionTxt: { fontSize: 24, fontWeight: '700', color: C.cream, textAlign: 'center', lineHeight: 34 },
  answerRow:   { flexDirection: 'row', gap: 14 },
  answerWrap:  { flex: 1 },
  answerBtn:   { paddingVertical: 26, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 8 },
  answerBtnTxt:{ fontSize: 18, fontWeight: '900', color: C.white, letterSpacing: 1.5 },

  // Answered
  answeredBadge: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 22 },
  answeredLabel: { fontSize: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' },

  // Results
  correctAnswerCard:  { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  correctAnswerLabel: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  correctAnswerBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  correctAnswerTxt:   { fontSize: 28, fontWeight: '900' },
  questionRecap:      { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  myPerf:             { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  myPerfTxt:          { flex: 1, fontSize: 14, fontWeight: '700' },

  myCard:      { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  myCardLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  myCardRank:  { fontSize: 52, fontWeight: '900', color: C.white, lineHeight: 60 },
  myCardScore: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  leaderRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 12, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  leaderRowMe: { borderColor: C.gold + '66', backgroundColor: '#FFD16610' },
  leaderMedal: { width: 40, fontSize: 18, textAlign: 'center' },
  leaderName:  { flex: 1, fontSize: 14, fontWeight: '600', color: C.cream },
  leaderScore: { fontSize: 15, fontWeight: '800', color: C.accent },

  nextQuestionWait:    { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  nextQuestionWaitTxt: { color: C.muted, fontSize: 13 },

  // Unused ref for accentAlt
  _unused: { color: C_ALT },
});
