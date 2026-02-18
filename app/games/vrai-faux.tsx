/**
 * vrai-faux.tsx
 * Interface Joueur — Vrai ou Faux
 * Design immersif sombre avec accents vibrants
 * Conforme au backend v2 :
 *   listSessions, joinSession, getQuestions, submitAnswer, getLeaderboard
 * Le leaderboard affiche le score spécifique au run (run_score)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config ──────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const { width: W } = Dimensions.get('window');

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:        '#080B14',
  surface:   '#0F1420',
  card:      '#141926',
  border:    '#1E2640',
  accent:    '#4F8EF7',
  accentAlt: '#7B6CF6',
  success:   '#00D68F',
  danger:    '#FF4D6D',
  gold:      '#FFD166',
  muted:     '#4A5578',
  cream:     '#E8EDF5',
  white:     '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface VraiFauxProps {
  title:    string;
  icon:     string;
  color:    string;
  onClose?: () => void;
}

interface Session  { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface Question { id: string; question_text: string; score: number; answered: boolean; }
interface Leader   { rank: number; user_id: string; nom: string; prenom: string; run_score: number; avatar_url?: string; is_current_user: boolean; }

type Screen = 'sessions' | 'lobby' | 'game' | 'result';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function VraiFaux({ title, icon, color, onClose }: VraiFauxProps) {
  const [userId,       setUserId]    = useState('');
  const [loading,      setLoading]   = useState(false);
  const [screen,       setScreen]    = useState<Screen>('sessions');
  const [sessions,     setSessions]  = useState<Session[]>([]);
  const [activeSession,setActSession]= useState<Session | null>(null);
  const [runId,        setRunId]     = useState('');
  const [questions,    setQuestions] = useState<Question[]>([]);
  const [currentIdx,   setCurrentIdx]= useState(0);
  const [leaderboard,  setLeaderboard]= useState<Leader[]>([]);
  const [lastCorrect,  setLastCorrect]= useState<boolean | null>(null);

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleVrai = useRef(new Animated.Value(1)).current;
  const scaleFaux = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadUser(); loadSessions(); }, []);

  useEffect(() => {
    fadeAnim.setValue(0); slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [screen, currentIdx]);

  // ─── Chargement user ────────────────────────────────────────────────────────
  const loadUser = async () => {
    try {
      const s = await AsyncStorage.getItem('harmonia_session');
      if (s) setUserId(JSON.parse(s)?.user?.id || '');
    } catch {}
  };

  // ─── API helper ─────────────────────────────────────────────────────────────
  const api = async (functionName: string, params: Record<string, any>) => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: functionName, user_id: userId, ...params }),
      });
      const data = await res.json();
      return data;
    } catch {
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ─── Charger sessions ───────────────────────────────────────────────────────
  const loadSessions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'listSessions', game_key: 'vrai_faux' }),
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions || []);
    } catch { Alert.alert('Erreur', 'Impossible de charger les sessions'); }
    finally { setLoading(false); }
  };

  // ─── Rejoindre session ──────────────────────────────────────────────────────
  const joinSession = async (session: Session) => {
    if (!userId) return Alert.alert('Non connecté', 'Veuillez vous connecter pour jouer');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const data = await api('joinSession', { session_id: session.id });
    if (data?.success) {
      setActSession(session);
      setScreen('lobby');
    } else {
      Alert.alert('Erreur', data?.error || 'Impossible de rejoindre la session');
    }
  };

  // ─── Charger questions d'un run ─────────────────────────────────────────────
  const loadQuestions = async (rid: string) => {
    if (!activeSession) return;
    const data = await api('getQuestions', { run_id: rid });
    if (data?.success) {
      const unanswered = (data.questions as Question[]).filter(q => !q.answered);
      if (unanswered.length === 0) {
        Alert.alert('Déjà terminé', 'Vous avez déjà répondu à toutes les questions de cette manche.');
        return;
      }
      setQuestions(unanswered);
      setRunId(rid);
      setCurrentIdx(0);
      setLastCorrect(null);
      setScreen('game');
    } else {
      Alert.alert('Erreur', data?.error || 'Impossible de charger les questions');
    }
  };

  // ─── Soumettre réponse ──────────────────────────────────────────────────────
  const submitAnswer = async (answer: boolean) => {
    if (loading) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Animation bouton pressé
    const scaleRef = answer ? scaleVrai : scaleFaux;
    Animated.sequence([
      Animated.timing(scaleRef, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleRef, { toValue: 1,   duration: 80, useNativeDriver: true }),
    ]).start();

    const data = await api('submitAnswer', {
      run_question_id: questions[currentIdx].id,
      answer,
    });

    if (data?.success) {
      // Feedback visuel
      Animated.sequence([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(feedbackOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      if (currentIdx < questions.length - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        loadLeaderboard();
      }
    } else {
      Alert.alert('Erreur', data?.error || 'Impossible d\'enregistrer la réponse');
    }
  };

  // ─── Charger classement ─────────────────────────────────────────────────────
  const loadLeaderboard = async () => {
    const data = await api('getLeaderboard', { run_id: runId });
    if (data?.success) {
      setLeaderboard(data.leaderboard || []);
      setScreen('result');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Erreur classement', data?.error);
    }
  };

  // ─── ÉCRAN SESSIONS ─────────────────────────────────────────────────────────
  if (screen === 'sessions') {
    return (
      <View style={styles.root}>
        <GameHeader title={title} color={color} onBack={onClose} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingTxt}>Chargement des sessions…</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="game-controller-outline" size={64} color={C.muted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune session disponible</Text>
            <Text style={styles.emptyDesc}>Les sessions apparaîtront ici une fois créées par l'administrateur.</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadSessions}>
              <Ionicons name="refresh-outline" size={18} color={C.bg} />
              <Text style={styles.refreshTxt}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Sessions disponibles</Text>
            {sessions.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} onPress={() => joinSession(s)} />
            ))}
            <View style={{ height: 40 }} />
          </Animated.ScrollView>
        )}
      </View>
    );
  }

  // ─── ÉCRAN LOBBY ────────────────────────────────────────────────────────────
  if (screen === 'lobby' && activeSession) {
    return (
      <View style={styles.root}>
        <GameHeader title={activeSession.title} color={color} onBack={() => setScreen('sessions')} />
        <Animated.View style={[styles.lobbyWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.lobbyIcon}>
            <Ionicons name="play-circle" size={80} color={color} />
          </View>
          <Text style={styles.lobbyTitle}>Session rejointe !</Text>
          <Text style={styles.lobbySub}>
            Attendez que l'administrateur active un run, puis saisissez son identifiant ci-dessous.
          </Text>

          <TouchableOpacity
            style={[styles.lobbyBtn, { backgroundColor: color }]}
            onPress={() => {
              Alert.prompt
                ? Alert.prompt('Identifiant du Run', 'Collez l\'ID du run fourni par l\'admin', [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Jouer',   onPress: (rid) => rid && loadQuestions(rid) },
                  ])
                : Alert.alert('Run ID', 'Fonctionnalité : coller l\'ID du run depuis le panneau admin');
            }}
          >
            <Ionicons name="flash-outline" size={20} color={C.bg} />
            <Text style={[styles.lobbyBtnTxt, { color: C.bg }]}>Rejoindre un Run</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.lobbySecondary} onPress={() => setScreen('sessions')}>
            <Text style={styles.lobbySecondaryTxt}>← Changer de session</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ─── ÉCRAN JEU ──────────────────────────────────────────────────────────────
  if (screen === 'game' && questions.length > 0) {
    const q        = questions[currentIdx];
    const progress = (currentIdx + 1) / questions.length;

    return (
      <View style={styles.root}>
        {/* Progress bar */}
        <LinearGradient colors={[color, C.accentAlt]} style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </LinearGradient>

        <GameHeader
          title={`${currentIdx + 1} / ${questions.length}`}
          color={color}
          onBack={() => {
            Alert.alert('Quitter ?', 'Vous perdrez votre progression sur ce run.', [
              { text: 'Rester',  style: 'cancel' },
              { text: 'Quitter', style: 'destructive', onPress: () => setScreen('lobby') },
            ]);
          }}
        />

        <Animated.View style={[styles.gameWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Score */}
          <View style={styles.scoreChip}>
            <Ionicons name="star" size={14} color={C.gold} />
            <Text style={styles.scoreChipTxt}>{q.score} pts</Text>
          </View>

          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionTxt}>{q.question_text}</Text>
          </View>

          {/* Boutons VRAI / FAUX */}
          <View style={styles.answerRow}>
            <Animated.View style={[styles.answerWrap, { transform: [{ scale: scaleVrai }] }]}>
              <TouchableOpacity
                style={[styles.answerBtn, styles.btnVrai]}
                onPress={() => submitAnswer(true)}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={44} color={C.white} />
                <Text style={styles.answerBtnTxt}>VRAI</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.answerWrap, { transform: [{ scale: scaleFaux }] }]}>
              <TouchableOpacity
                style={[styles.answerBtn, styles.btnFaux]}
                onPress={() => submitAnswer(false)}
                disabled={loading}
              >
                <Ionicons name="close-circle" size={44} color={C.white} />
                <Text style={styles.answerBtnTxt}>FAUX</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {loading && (
            <View style={styles.gameLoading}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          )}
        </Animated.View>
      </View>
    );
  }

  // ─── ÉCRAN RÉSULTAT ─────────────────────────────────────────────────────────
  if (screen === 'result') {
    const me = leaderboard.find(e => e.is_current_user);

    return (
      <View style={styles.root}>
        <GameHeader title="Classement Final" color={color} onBack={() => setScreen('sessions')} />

        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Mon score */}
          {me && (
            <LinearGradient colors={[color + 'CC', C.accentAlt + 'AA']} style={styles.myScoreCard}>
              <Text style={styles.myRankLabel}>Votre classement</Text>
              <Text style={styles.myRankNum}>#{me.rank}</Text>
              <Text style={styles.myScore}>{me.run_score} pts</Text>
            </LinearGradient>
          )}

          <Text style={styles.sectionTitle}>Tableau des scores</Text>

          {leaderboard.map((e) => (
            <LeaderRow key={e.user_id} entry={e} />
          ))}

          <TouchableOpacity style={styles.playAgainBtn} onPress={() => setScreen('sessions')}>
            <Ionicons name="refresh-outline" size={18} color={C.bg} />
            <Text style={[styles.playAgainTxt, { color: C.bg }]}>Rejouer</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      </View>
    );
  }

  return null;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function GameHeader({ title, color, onBack }: { title: string; color: string; onBack?: () => void }) {
  return (
    <LinearGradient colors={[C.surface, C.bg]} style={styles.header}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={22} color={color} />
        </TouchableOpacity>
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );
}

function SessionCard({ session, index, onPress }: { session: Session; index: number; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={styles.sessionLeft}>
          <View style={styles.sessionNum}>
            <Text style={styles.sessionNumTxt}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            {session.description ? <Text style={styles.sessionDesc}>{session.description}</Text> : null}
            {session.is_paid
              ? <View style={styles.priceBadge}><Text style={styles.priceTxt}>💰 {session.price_cfa} CFA</Text></View>
              : <View style={styles.freeBadge}> <Text style={styles.freeTxt}>Gratuit</Text></View>
            }
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={C.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function LeaderRow({ entry }: { entry: Leader }) {
  const isTop3  = entry.rank <= 3;
  const medals  = ['🥇', '🥈', '🥉'];

  return (
    <View style={[styles.leaderRow, entry.is_current_user && styles.leaderRowMe, isTop3 && styles.leaderRowTop]}>
      <Text style={styles.leaderMedal}>{isTop3 ? medals[entry.rank - 1] : `#${entry.rank}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.leaderName, entry.is_current_user && { color: C.gold }]}>
          {entry.prenom} {entry.nom}
          {entry.is_current_user && ' (vous)'}
        </Text>
      </View>
      <Text style={[styles.leaderScore, isTop3 && { color: C.gold }]}>{entry.run_score} pts</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerBack:  { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: C.cream, marginHorizontal: 8 },

  // Progress bar (jeu)
  progressBar:  { height: 4, backgroundColor: C.border },
  progressFill: { height: '100%', backgroundColor: 'transparent' },

  // Utils
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll:     { padding: 16 },
  loadingTxt: { color: C.muted, fontSize: 14, marginTop: 12 },

  // Empty state
  emptyIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: C.cream, textAlign: 'center', marginBottom: 8 },
  emptyDesc:     { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  refreshBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  refreshTxt:    { color: C.bg, fontSize: 15, fontWeight: '700' },

  // Section title
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14, marginTop: 4 },

  // Session cards
  sessionCard:  { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  sessionLeft:  { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginRight: 8 },
  sessionNum:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  sessionNumTxt:{ fontSize: 14, fontWeight: '700', color: C.accent },
  sessionTitle: { fontSize: 16, fontWeight: '700', color: C.cream, marginBottom: 4 },
  sessionDesc:  { fontSize: 13, color: C.muted, marginBottom: 6 },
  priceBadge:   { alignSelf: 'flex-start', backgroundColor: '#FFD16622', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#FFD16655' },
  priceTxt:     { fontSize: 12, color: C.gold, fontWeight: '600' },
  freeBadge:    { alignSelf: 'flex-start', backgroundColor: '#00D68F22', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#00D68F55' },
  freeTxt:      { fontSize: 12, color: C.success, fontWeight: '600' },

  // Lobby
  lobbyWrap:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lobbyIcon:       { marginBottom: 20 },
  lobbyTitle:      { fontSize: 26, fontWeight: '800', color: C.cream, marginBottom: 10 },
  lobbySub:        { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  lobbyBtn:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  lobbyBtnTxt:     { fontSize: 17, fontWeight: '800' },
  lobbySecondary:  { marginTop: 20 },
  lobbySecondaryTxt:{ color: C.muted, fontSize: 14 },

  // Game screen
  gameWrap:     { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, justifyContent: 'space-between' },
  scoreChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#FFD16622', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FFD16644' },
  scoreChipTxt: { color: C.gold, fontSize: 13, fontWeight: '700' },
  questionCard: { flex: 1, backgroundColor: C.card, borderRadius: 24, padding: 28, justifyContent: 'center', alignItems: 'center', marginVertical: 20, borderWidth: 1, borderColor: C.border },
  questionTxt:  { fontSize: 22, fontWeight: '700', color: C.cream, textAlign: 'center', lineHeight: 32 },
  answerRow:    { flexDirection: 'row', gap: 14 },
  answerWrap:   { flex: 1 },
  answerBtn:    { paddingVertical: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnVrai:      { backgroundColor: C.success },
  btnFaux:      { backgroundColor: C.danger },
  answerBtnTxt: { fontSize: 18, fontWeight: '900', color: C.white, letterSpacing: 1 },
  gameLoading:  { position: 'absolute', bottom: 32, alignSelf: 'center' },

  // Result screen
  myScoreCard:  { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
  myRankLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 1 },
  myRankNum:    { fontSize: 56, fontWeight: '900', color: C.white, lineHeight: 64 },
  myScore:      { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  leaderRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  leaderRowMe:  { borderColor: C.gold + '66', backgroundColor: '#FFD16611' },
  leaderRowTop: { borderColor: C.accent + '44' },
  leaderMedal:  { width: 48, fontSize: 20, textAlign: 'center' },
  leaderName:   { fontSize: 15, fontWeight: '600', color: C.cream },
  leaderScore:  { fontSize: 16, fontWeight: '800', color: C.accent },

  playAgainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, paddingVertical: 16, borderRadius: 16, marginTop: 16 },
  playAgainTxt: { fontSize: 16, fontWeight: '800' },
});
