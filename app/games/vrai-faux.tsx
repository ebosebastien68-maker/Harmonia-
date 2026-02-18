/**
 * vrai-faux.tsx — Interface Joueur
 * ✅ Cross-platform : Web · Android · iOS
 * ✅ Zéro Alert.prompt — Modal custom universel
 * ✅ Leaderboard sur run_score (spécifique au run)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Platform,
  ActivityIndicator, ScrollView, Alert, Animated,
  Modal, KeyboardAvoidingView, TextInput, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

const haptic = {
  medium:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  heavy:   () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
};

const C = {
  bg: '#080B14', surface: '#0F1420', card: '#141926', border: '#1E2640',
  accent: '#4F8EF7', accentAlt: '#7B6CF6',
  success: '#00D68F', danger: '#FF4D6D', gold: '#FFD166',
  muted: '#4A5578', cream: '#E8EDF5', white: '#FFFFFF',
};

interface VraiFauxProps { title: string; icon: string; color: string; onClose?: () => void; }
interface Session  { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface Question { id: string; question_text: string; score: number; answered: boolean; }
interface Leader   { rank: number; user_id: string; nom: string; prenom: string; run_score: number; is_current_user: boolean; }

type Screen = 'sessions' | 'lobby' | 'game' | 'result';

export default function VraiFaux({ title, icon, color, onClose }: VraiFauxProps) {
  const [userId,        setUserId]      = useState('');
  const [loading,       setLoading]     = useState(false);
  const [screen,        setScreen]      = useState<Screen>('sessions');
  const [sessions,      setSessions]    = useState<Session[]>([]);
  const [activeSession, setActSession]  = useState<Session | null>(null);
  const [runId,         setRunId]       = useState('');
  const [questions,     setQuestions]   = useState<Question[]>([]);
  const [currentIdx,    setCurrentIdx]  = useState(0);
  const [leaderboard,   setLeaderboard] = useState<Leader[]>([]);

  // Modal "Rejoindre un Run" (remplace Alert.prompt — cross-platform)
  const [runModal,     setRunModal]    = useState(false);
  const [runInputVal,  setRunInputVal] = useState('');

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleVrai = useRef(new Animated.Value(1)).current;
  const scaleFaux = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadUser(); loadSessions(); }, []);

  useEffect(() => {
    fadeAnim.setValue(0); slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [screen, currentIdx]);

  // ── User ─────────────────────────────────────────────────────────────────────
  const loadUser = async () => {
    try {
      const s = await AsyncStorage.getItem('harmonia_session');
      if (s) setUserId(JSON.parse(s)?.user?.id || '');
    } catch {}
  };

  // ── API ──────────────────────────────────────────────────────────────────────
  const api = async (fn: string, params: Record<string,any>) => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: fn, user_id: userId, ...params }),
      });
      return await res.json();
    } catch {
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
      return null;
    } finally { setLoading(false); }
  };

  // ── Sessions ─────────────────────────────────────────────────────────────────
  const loadSessions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'listSessions', game_key: 'vrai_faux' }),
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions || []);
    } catch { Alert.alert('Erreur', 'Impossible de charger les sessions'); }
    finally  { setLoading(false); }
  };

  // ── Rejoindre session ────────────────────────────────────────────────────────
  const joinSession = async (session: Session) => {
    if (!userId) return Alert.alert('Non connecté', 'Veuillez vous connecter pour jouer');
    haptic.medium();
    const data = await api('joinSession', { session_id: session.id });
    if (data?.success) { setActSession(session); setScreen('lobby'); }
    else Alert.alert('Erreur', data?.error || 'Impossible de rejoindre');
  };

  // ── Charger questions ────────────────────────────────────────────────────────
  const loadQuestions = async (rid: string) => {
    const trimmed = rid.trim();
    if (!trimmed) return Alert.alert('Erreur', 'L\'identifiant du run est vide');
    const data = await api('getQuestions', { run_id: trimmed });
    if (data?.success) {
      const unanswered = (data.questions as Question[]).filter(q => !q.answered);
      if (unanswered.length === 0) return Alert.alert('Terminé', 'Vous avez déjà répondu à toutes les questions de cette manche.');
      setQuestions(unanswered);
      setRunId(trimmed);
      setCurrentIdx(0);
      setScreen('game');
    } else {
      Alert.alert('Erreur', data?.error || 'Impossible de charger les questions');
    }
  };

  // ── Répondre ──────────────────────────────────────────────────────────────────
  const submitAnswer = async (answer: boolean) => {
    if (loading) return;
    haptic.heavy();

    const ref = answer ? scaleVrai : scaleFaux;
    Animated.sequence([
      Animated.timing(ref, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.timing(ref, { toValue: 1,    duration: 70, useNativeDriver: true }),
    ]).start();

    const data = await api('submitAnswer', { run_question_id: questions[currentIdx].id, answer });
    if (data?.success) {
      if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1);
      else loadLeaderboard();
    } else {
      Alert.alert('Erreur', data?.error || 'Impossible d\'enregistrer la réponse');
    }
  };

  // ── Classement ───────────────────────────────────────────────────────────────
  const loadLeaderboard = async () => {
    const data = await api('getLeaderboard', { run_id: runId });
    if (data?.success) {
      setLeaderboard(data.leaderboard || []);
      setScreen('result');
      haptic.success();
    } else {
      Alert.alert('Erreur classement', data?.error);
    }
  };

  // ── ÉCRANS ────────────────────────────────────────────────────────────────────

  // ── SESSIONS ─────────────────────────────────────────────────────────────────
  if (screen === 'sessions') {
    return (
      <SafeAreaView style={styles.root}>
        <GameHeader title={title} color={color} onBack={onClose} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={color} />
            <Text style={styles.loadingTxt}>Chargement…</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="game-controller-outline" size={56} color={C.muted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune session</Text>
            <Text style={styles.emptyDesc}>Les sessions créées par l'administrateur apparaîtront ici.</Text>
            <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: color }]} onPress={loadSessions}>
              <Ionicons name="refresh-outline" size={17} color={C.bg} />
              <Text style={[styles.refreshTxt, { color: C.bg }]}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Sessions disponibles</Text>
            {sessions.map((s, i) => <SessionCard key={s.id} session={s} index={i} color={color} onPress={() => joinSession(s)} />)}
            <View style={{ height: 40 }} />
          </Animated.ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────────
  if (screen === 'lobby' && activeSession) {
    return (
      <SafeAreaView style={styles.root}>
        <GameHeader title={activeSession.title} color={color} onBack={() => setScreen('sessions')} />

        <Animated.View style={[styles.lobbyWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.lobbyIcon, { borderColor: color + '44' }]}>
            <Ionicons name="checkmark-circle" size={64} color={color} />
          </View>
          <Text style={styles.lobbyTitle}>Session rejointe !</Text>
          <Text style={styles.lobbySub}>
            Demandez l'identifiant du run à l'administrateur, puis saisissez-le ci-dessous pour commencer.
          </Text>

          <TouchableOpacity style={[styles.lobbyBtn, { backgroundColor: color }]} onPress={() => { setRunInputVal(''); setRunModal(true); }}>
            <Ionicons name="flash-outline" size={19} color={C.bg} />
            <Text style={[styles.lobbyBtnTxt, { color: C.bg }]}>Rejoindre un Run</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.lobbySecondary} onPress={() => setScreen('sessions')}>
            <Text style={styles.lobbySecondaryTxt}>← Changer de session</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Modal saisie Run ID — cross-platform (zéro Alert.prompt) */}
        <Modal transparent animationType="fade" visible={runModal} onRequestClose={() => setRunModal(false)} statusBarTranslucent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.runModalOverlay}>
            <View style={styles.runModalBox}>
              <View style={styles.runModalHeader}>
                <Ionicons name="flash-outline" size={18} color={color} />
                <Text style={styles.runModalTitle}>Identifiant du Run</Text>
              </View>

              <Text style={styles.runModalSub}>Collez l'ID fourni par l'administrateur</Text>

              <TextInput
                style={styles.runModalInput}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                placeholderTextColor={C.muted}
                value={runInputVal}
                onChangeText={setRunInputVal}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => { setRunModal(false); loadQuestions(runInputVal); }}
              />

              <View style={styles.runModalFooter}>
                <TouchableOpacity style={styles.runModalCancel} onPress={() => setRunModal(false)}>
                  <Text style={styles.runModalCancelTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.runModalConfirm, { backgroundColor: color, opacity: runInputVal.trim() ? 1 : 0.5 }]}
                  onPress={() => { setRunModal(false); loadQuestions(runInputVal); }}
                  disabled={!runInputVal.trim()}
                >
                  <Text style={[styles.runModalConfirmTxt, { color: C.bg }]}>Jouer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── JEU ──────────────────────────────────────────────────────────────────────
  if (screen === 'game' && questions.length > 0) {
    const q        = questions[currentIdx];
    const progress = (currentIdx + 1) / questions.length;

    return (
      <SafeAreaView style={styles.root}>
        {/* Barre de progression */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: color }]} />
        </View>

        <GameHeader
          title={`${currentIdx + 1} / ${questions.length}`}
          color={color}
          onBack={() => Alert.alert('Quitter ?', 'Votre progression sur ce run sera perdue.', [
            { text: 'Rester',  style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: () => setScreen('lobby') },
          ])}
        />

        <Animated.View style={[styles.gameWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Badge score */}
          <View style={styles.scoreChip}>
            <Ionicons name="star" size={13} color={C.gold} />
            <Text style={styles.scoreChipTxt}>{q.score} pts</Text>
          </View>

          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionTxt}>{q.question_text}</Text>
          </View>

          {/* VRAI / FAUX */}
          <View style={styles.answerRow}>
            <Animated.View style={[styles.answerWrap, { transform: [{ scale: scaleVrai }] }]}>
              <TouchableOpacity style={[styles.answerBtn, { backgroundColor: C.success }]} onPress={() => submitAnswer(true)} disabled={loading}>
                <Ionicons name="checkmark-circle" size={42} color={C.white} />
                <Text style={styles.answerBtnTxt}>VRAI</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.answerWrap, { transform: [{ scale: scaleFaux }] }]}>
              <TouchableOpacity style={[styles.answerBtn, { backgroundColor: C.danger }]} onPress={() => submitAnswer(false)} disabled={loading}>
                <Ionicons name="close-circle" size={42} color={C.white} />
                <Text style={styles.answerBtnTxt}>FAUX</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {loading && <ActivityIndicator size="small" color={color} style={{ marginTop: 16 }} />}
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── RÉSULTAT ─────────────────────────────────────────────────────────────────
  if (screen === 'result') {
    const me = leaderboard.find(e => e.is_current_user);

    return (
      <SafeAreaView style={styles.root}>
        <GameHeader title="Classement" color={color} onBack={() => setScreen('sessions')} />

        <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Mon score */}
          {me && (
            <LinearGradient colors={[color + 'DD', C.accentAlt + 'AA']} style={styles.myCard}>
              <Text style={styles.myLabel}>Votre rang</Text>
              <Text style={styles.myRank}>#{me.rank}</Text>
              <Text style={styles.myScore}>{me.run_score} pts</Text>
            </LinearGradient>
          )}

          <Text style={styles.sectionTitle}>Tableau des scores</Text>

          {leaderboard.map(e => <LeaderRow key={e.user_id} entry={e} />)}

          <TouchableOpacity style={[styles.playAgainBtn, { backgroundColor: color }]} onPress={() => setScreen('sessions')}>
            <Ionicons name="refresh-outline" size={17} color={C.bg} />
            <Text style={[styles.playAgainTxt, { color: C.bg }]}>Rejouer</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function GameHeader({ title, color, onBack }: { title: string; color: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[styles.headerBackBtn, { borderColor: color + '44' }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={20} color={color} />
        </TouchableOpacity>
      ) : <View style={styles.headerBackBtn} />}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerBackBtn} />
    </View>
  );
}

function SessionCard({ session, index, color, onPress }: { session: Session; index: number; color: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={[styles.sessionIdx, { backgroundColor: color + '22' }]}>
          <Text style={[styles.sessionIdxTxt, { color }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          {session.description ? <Text style={styles.sessionDesc}>{session.description}</Text> : null}
          {session.is_paid
            ? <View style={styles.priceBadge}><Text style={styles.priceTxt}>💰 {session.price_cfa} CFA</Text></View>
            : <View style={styles.freeBadge}><Text style={styles.freeTxt}>Gratuit</Text></View>
          }
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function LeaderRow({ entry }: { entry: Leader }) {
  const medals = ['🥇', '🥈', '🥉'];
  const isTop3 = entry.rank <= 3;
  return (
    <View style={[styles.leaderRow, entry.is_current_user && styles.leaderRowMe]}>
      <Text style={styles.leaderMedal}>{isTop3 ? medals[entry.rank - 1] : `#${entry.rank}`}</Text>
      <Text style={[styles.leaderName, entry.is_current_user && { color: C.gold }]}>
        {entry.prenom} {entry.nom}{entry.is_current_user ? ' (vous)' : ''}
      </Text>
      <Text style={[styles.leaderScore, isTop3 && { color: C.gold }]}>{entry.run_score} pts</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const C_ALT = '#7B6CF6'; // accentAlt (pas dans C pour éviter la duplication)

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerTitle:   { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.cream, marginHorizontal: 8 },

  progressTrack: { height: 3, backgroundColor: C.border },
  progressFill:  { height: 3 },

  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll:       { padding: 16 },
  loadingTxt:   { color: C.muted, fontSize: 13, marginTop: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 14, marginTop: 4 },

  emptyIconWrap: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: C.cream, textAlign: 'center', marginBottom: 8 },
  emptyDesc:     { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  refreshBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  refreshTxt:    { fontSize: 15, fontWeight: '700' },

  sessionCard:    { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  sessionIdx:     { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  sessionIdxTxt:  { fontSize: 14, fontWeight: '800' },
  sessionTitle:   { fontSize: 15, fontWeight: '700', color: C.cream, marginBottom: 3 },
  sessionDesc:    { fontSize: 12, color: C.muted, marginBottom: 5 },
  priceBadge:     { alignSelf: 'flex-start', backgroundColor: '#FFD16622', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: '#FFD16655' },
  priceTxt:       { fontSize: 11, color: C.gold, fontWeight: '600' },
  freeBadge:      { alignSelf: 'flex-start', backgroundColor: '#00D68F22', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: '#00D68F55' },
  freeTxt:        { fontSize: 11, color: C.success, fontWeight: '600' },

  lobbyWrap:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lobbyIcon:        { width: 110, height: 110, borderRadius: 55, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1 },
  lobbyTitle:       { fontSize: 24, fontWeight: '800', color: C.cream, marginBottom: 10 },
  lobbySub:         { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  lobbyBtn:         { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 32, paddingVertical: 15, borderRadius: 16 },
  lobbyBtnTxt:      { fontSize: 16, fontWeight: '800' },
  lobbySecondary:   { marginTop: 18 },
  lobbySecondaryTxt:{ color: C.muted, fontSize: 13 },

  runModalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  runModalBox:        { width: '100%', maxWidth: 440, backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  runModalHeader:     { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 18, borderBottomWidth: 1, borderBottomColor: C.border },
  runModalTitle:      { fontSize: 16, fontWeight: '700', color: C.cream },
  runModalSub:        { fontSize: 13, color: C.muted, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  runModalInput:      { backgroundColor: C.card, borderRadius: 12, marginHorizontal: 18, marginVertical: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 14, color: C.cream, borderWidth: 1, borderColor: C.border, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  runModalFooter:     { flexDirection: 'row', gap: 10, padding: 18, paddingTop: 4 },
  runModalCancel:     { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  runModalCancelTxt:  { color: C.muted, fontWeight: '600', fontSize: 14 },
  runModalConfirm:    { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  runModalConfirmTxt: { fontWeight: '800', fontSize: 14 },

  gameWrap:    { flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28, justifyContent: 'space-between' },
  scoreChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', backgroundColor: '#FFD16618', paddingHorizontal: 13, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#FFD16640' },
  scoreChipTxt:{ color: C.gold, fontSize: 12, fontWeight: '700' },
  questionCard:{ flex: 1, backgroundColor: C.card, borderRadius: 22, padding: 24, justifyContent: 'center', alignItems: 'center', marginVertical: 18, borderWidth: 1, borderColor: C.border },
  questionTxt: { fontSize: 21, fontWeight: '700', color: C.cream, textAlign: 'center', lineHeight: 30 },
  answerRow:   { flexDirection: 'row', gap: 14 },
  answerWrap:  { flex: 1 },
  answerBtn:   { paddingVertical: 22, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 7 },
  answerBtnTxt:{ fontSize: 17, fontWeight: '900', color: C.white, letterSpacing: 1 },

  myCard:  { borderRadius: 20, padding: 26, alignItems: 'center', marginBottom: 20 },
  myLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  myRank:  { fontSize: 52, fontWeight: '900', color: C.white, lineHeight: 60 },
  myScore: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  leaderRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 13, borderRadius: 13, marginBottom: 7, borderWidth: 1, borderColor: C.border },
  leaderRowMe: { borderColor: C.gold + '66', backgroundColor: '#FFD16610' },
  leaderMedal: { width: 44, fontSize: 18, textAlign: 'center' },
  leaderName:  { flex: 1, fontSize: 14, fontWeight: '600', color: C.cream },
  leaderScore: { fontSize: 15, fontWeight: '800', color: C.accent },

  playAgainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 16, marginTop: 16 },
  playAgainTxt: { fontSize: 16, fontWeight: '800' },

  // référence accentAlt pour LinearGradient dans résultat
  accentAlt: { color: C_ALT },
});
