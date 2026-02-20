/**
 * vrai-faux.tsx — Version finale refactorisée
 *
 * FLUX COMPLET :
 *  Tab "Mes Sessions"   → sessions déjà rejointes + scores
 *  Tab "Explorer"       → sessions disponibles + bouton Participer
 *  → Parties            → liste parties + bouton "Répondre" (vérifie rang/score)
 *  → Questions          → questions non-répondues une à une (disparaissent après réponse)
 *  → Historique         → toutes les questions répondues, scores, total
 *
 * FIXES :
 *  ✅ isMounted useRef déclaré
 *  ✅ Iconicons → Ionicons (typo corrigé)
 *  ✅ useNativeDriver: false sur web
 *  ✅ Pas de useCallback importé mais non utilisé
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

const haptic = {
  medium:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
};

const C = {
  bg: '#0A0A0C', surface: '#14141A', surfaceHigh: '#1C1C24',
  border: '#262630', gold: '#C9A84C',
  cream: '#F0E8D5', muted: '#5A5A6A',
  success: '#27AE60', danger: '#E74C3C', info: '#2980B9',
  vrai: '#16A34A', faux: '#DC2626', white: '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab   = 'mine' | 'explore';
type Screen    = 'home' | 'parties' | 'questions' | 'history';

interface SessionItem  { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; my_score?: number; }
interface PartyItem    { id: string; title: string; is_initial: boolean; min_score: number; min_rank: number | null; }
interface QuestionItem { id: string; question_text: string; score: number; correct_answer: boolean | null; answered: boolean; my_answer: boolean | null; score_awarded: number | null; }
interface HistoryRun   { run_id: string; run_title: string; questions: QuestionItem[]; }
interface VraiFauxProps { userId?: string; userNom?: string; onBack?: () => void; }

export default function VraiFaux({ userId: userIdProp, userNom, onBack }: VraiFauxProps) {
  const [tab,        setTab]        = useState<MainTab>('mine');
  const [screen,     setScreen]     = useState<Screen>('home');
  const [selSession, setSelSession] = useState<SessionItem | null>(null);
  const [selParty,   setSelParty]   = useState<PartyItem   | null>(null);
  const [userId,     setUserId]     = useState<string>(userIdProp || '');

  // Données
  const [mySessions,   setMySessions]   = useState<SessionItem[]>([]);
  const [exploreSess,  setExploreSess]  = useState<SessionItem[]>([]);
  const [parties,      setParties]      = useState<PartyItem[]>([]);
  const [questions,    setQuestions]    = useState<QuestionItem[]>([]);  // non-répondues
  const [currentQIdx,  setCurrentQIdx]  = useState(0);
  const [history,      setHistory]      = useState<HistoryRun[]>([]);
  const [totalScore,   setTotalScore]   = useState<number | null>(null);
  const [partyScores,  setPartyScores]  = useState<Record<string, number>>({});  // party_id → score

  // UI
  const [initLoading,   setInitLoading]   = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [error,         setError]         = useState('');
  const [joinedId,      setJoinedId]      = useState<string | null>(null); // flash après participation

  // Refs
  const isMounted   = useRef(true);
  const userIdRef   = useRef<string>(userIdProp || '');
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(30)).current;
  const questionFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: false }),
    ]).start();

    const init = async () => {
      let uid = userIdProp || '';
      if (!uid) {
        try {
          const raw = await AsyncStorage.getItem('harmonia_session');
          if (raw) { const p = JSON.parse(raw); uid = p?.user?.id || ''; }
        } catch {}
      }
      if (uid) { setUserId(uid); userIdRef.current = uid; }
      await loadHome(uid);
      setInitLoading(false);
    };
    init();

    return () => {
      isMounted.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ─── API ───────────────────────────────────────────────────────────────────
  const getUid = async (): Promise<string> => {
    let uid = userIdRef.current;
    if (!uid) {
      try {
        const raw = await AsyncStorage.getItem('harmonia_session');
        if (raw) { const p = JSON.parse(raw); uid = p?.user?.id || ''; if (uid) { setUserId(uid); userIdRef.current = uid; } }
      } catch {}
    }
    if (!uid) throw new Error('Non connecté');
    return uid;
  };

  const api = async (body: Record<string, any>) => {
    const uid = await getUid();
    const res = await fetch(`${BACKEND_URL}/game`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, ...body }),
    });
    return res.json();
  };

  // ─── Chargement home (mes sessions + explorer) ─────────────────────────────
  const loadHome = async (uid?: string) => {
    try {
      const u = uid || userIdRef.current;
      if (!u) return;
      const [myData, exploreData] = await Promise.all([
        fetch(`${BACKEND_URL}/game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u, function: 'listMySessions', game_key: GAME_KEY }) }).then(r => r.json()),
        fetch(`${BACKEND_URL}/game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u, function: 'listAvailableSessions', game_key: GAME_KEY }) }).then(r => r.json()),
      ]);
      if (!isMounted.current) return;
      if (myData.success) setMySessions(myData.sessions || []);
      if (exploreData.success) setExploreSess(exploreData.sessions || []);
    } catch { if (isMounted.current) setError('Erreur réseau'); }
  };

  const syncHome = async () => {
    setSyncing(true); setError('');
    await loadHome();
    if (isMounted.current) setSyncing(false);
  };

  // ─── Explorer : rejoindre une session ──────────────────────────────────────
  const joinSession = async (session: SessionItem) => {
    setLoadingAction(true); setError('');
    haptic.medium();
    try {
      // Trouver la party initiale et rejoindre
      const partiesData = await api({ function: 'listPartiesForSession', session_id: session.id });
      if (!partiesData.success) { setError(partiesData.error || 'Impossible de charger les groupes'); return; }

      const initialParty = (partiesData.parties as PartyItem[]).find(p => p.is_initial);
      if (!initialParty) { setError('Aucun groupe d\'entrée disponible'); return; }

      const joinData = await api({ function: 'joinSession', session_id: session.id, party_id: initialParty.id });
      if (!joinData.success) { setError(joinData.error || 'Impossible de rejoindre'); return; }

      haptic.success();
      setJoinedId(session.id);
      setTimeout(() => { if (isMounted.current) setJoinedId(null); }, 3000);

      // Mettre à jour les listes
      setExploreSess(prev => prev.filter(s => s.id !== session.id));
      setMySessions(prev => [...prev, { ...session, my_score: 0 }]);
      setTab('mine');
    } catch { setError('Erreur réseau'); haptic.error(); }
    finally  { if (isMounted.current) setLoadingAction(false); }
  };

  // ─── Ouvrir les parties d'une session ──────────────────────────────────────
  const openSession = async (session: SessionItem) => {
    setSelSession(session); setLoadingAction(true); setError('');
    try {
      const data = await api({ function: 'listPartiesForSession', session_id: session.id });
      if (!data.success) { setError(data.error || 'Impossible de charger'); return; }
      setParties(data.parties || []);
      setScreen('parties');
    } catch { setError('Erreur réseau'); }
    finally  { if (isMounted.current) setLoadingAction(false); }
  };

  // ─── Entrer dans une party : vérif rang/score + charger questions ───────────
  const enterParty = async (party: PartyItem) => {
    if (!selSession) return;

    // Vérification rang/score (côté client, le serveur re-vérifie aussi)
    const mySessionScore = mySessions.find(s => s.id === selSession.id)?.my_score ?? 0;
    if (!party.is_initial) {
      if (party.min_score > 0 && mySessionScore < party.min_score) {
        setError(`Score insuffisant — vous avez ${mySessionScore} pts, il en faut ${party.min_score}`);
        return;
      }
    }

    setSelParty(party); setLoadingAction(true); setError('');
    haptic.medium();
    try {
      // Rejoindre si pas déjà inscrit (idempotent)
      await api({ function: 'joinSession', session_id: selSession.id, party_id: party.id });

      // Charger toutes les questions non-répondues
      const [unansweredData, histData] = await Promise.all([
        api({ function: 'getUnansweredQuestions', party_id: party.id }),
        api({ function: 'getPartyHistory', party_id: party.id }),
      ]);

      if (!isMounted.current) return;

      if (unansweredData.success) {
        setQuestions(unansweredData.questions || []);
        setCurrentQIdx(0);
      }
      if (histData.success) {
        setHistory(histData.history || []);
        setTotalScore(histData.total_score);
      }

      setScreen('questions');
      haptic.success();
    } catch { setError('Erreur réseau'); }
    finally  { if (isMounted.current) setLoadingAction(false); }
  };

  // ─── Répondre à une question ───────────────────────────────────────────────
  const submitAnswer = async (answer: boolean) => {
    const question = questions[currentQIdx];
    if (!question || answerLoading) return;
    setAnswerLoading(true); haptic.medium();
    try {
      const data = await api({ function: 'submitAnswer', run_question_id: question.id, answer });
      if (!isMounted.current) return;
      if (data.success) {
        haptic.success();
        // Fade out la question actuelle
        Animated.timing(questionFadeAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
          if (!isMounted.current) return;
          // Supprimer la question de la liste
          setQuestions(prev => {
            const next = prev.filter((_, i) => i !== currentQIdx);
            // Si c'était la dernière → retour parties
            if (next.length === 0) {
              // Rafraîchir l'historique et retourner aux parties
              api({ function: 'getPartyHistory', party_id: selParty!.id }).then(d => {
                if (!isMounted.current) return;
                if (d.success) { setHistory(d.history || []); setTotalScore(d.total_score); }
              });
              setScreen('parties');
            }
            return next;
          });
          questionFadeAnim.setValue(1);
        });
      } else {
        setError(data.error || 'Erreur lors de l\'envoi');
        haptic.error();
      }
    } catch { setError('Erreur réseau'); haptic.error(); }
    finally  { if (isMounted.current) setAnswerLoading(false); }
  };

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    setError('');
    if (screen === 'questions') { setScreen('parties'); }
    else if (screen === 'history') { setScreen('parties'); }
    else if (screen === 'parties') { setScreen('home'); setSelSession(null); setParties([]); }
    else { onBack?.(); }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.initLoader}>
          <Ionicons name="game-controller-outline" size={44} color={C.gold} />
          <Text style={s.initTitle}>Vrai ou Faux</Text>
          <ActivityIndicator size="small" color={C.muted} style={{ marginTop: 22 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* ── HEADER ── */}
        <LinearGradient colors={['#10100A', C.bg]} style={s.header}>
          {(screen !== 'home' || onBack) && (
            <TouchableOpacity onPress={goBack} style={s.iconBtn}>
              <Ionicons name="arrow-back" size={19} color={C.gold} />
            </TouchableOpacity>
          )}
          <View style={s.headerCenter}>
            <Text style={s.headerSub}>
              {screen === 'home'      ? (tab === 'mine' ? 'MES SESSIONS' : 'EXPLORER')
               : screen === 'parties'  ? selSession?.title?.toUpperCase()
               : screen === 'questions'? selParty?.title?.toUpperCase()
               : 'HISTORIQUE'}
            </Text>
            <Text style={s.headerTitle}>Vrai ou Faux</Text>
          </View>
          <TouchableOpacity onPress={syncHome} style={s.iconBtn} disabled={syncing}>
            {syncing
              ? <ActivityIndicator size="small" color={C.gold} />
              : <Ionicons name="refresh-outline" size={17} color={C.muted} />}
          </TouchableOpacity>
        </LinearGradient>

        {/* Erreur inline */}
        {error !== '' && (
          <View style={s.errorBar}>
            <Ionicons name="warning-outline" size={13} color={C.danger} />
            <Text style={s.errorBarTxt} numberOfLines={2}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={15} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════ ÉCRAN HOME ══════════════════ */}
        {screen === 'home' && (
          <View style={{ flex: 1 }}>
            {/* Tabs */}
            <View style={s.tabBar}>
              <TouchableOpacity style={[s.tab, tab === 'mine' && s.tabActive]} onPress={() => setTab('mine')}>
                <Ionicons name="bookmark-outline" size={15} color={tab === 'mine' ? C.gold : C.muted} />
                <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>Mes Sessions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tab, tab === 'explore' && s.tabActive]} onPress={() => setTab('explore')}>
                <Ionicons name="compass-outline" size={15} color={tab === 'explore' ? C.gold : C.muted} />
                <Text style={[s.tabTxt, tab === 'explore' && s.tabTxtActive]}>Explorer</Text>
                {exploreSess.length > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeTxt}>{exploreSess.length}</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Tab Mes Sessions */}
            {tab === 'mine' && (
              <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {mySessions.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="albums-outline" size={48} color={C.muted} />
                    <Text style={s.emptyTitle}>Aucune session rejointe</Text>
                    <Text style={s.emptySub}>Explorez les sessions disponibles et participez !</Text>
                    <TouchableOpacity style={s.exploreBtn} onPress={() => setTab('explore')}>
                      <Ionicons name="compass-outline" size={16} color={C.gold} />
                      <Text style={s.exploreBtnTxt}>Explorer les Sessions</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {mySessions.map(sess => (
                      <TouchableOpacity key={sess.id} style={s.card} onPress={() => openSession(sess)} activeOpacity={0.8}>
                        <View style={s.cardIcon}>
                          <Ionicons name="albums-outline" size={17} color={C.gold} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitle}>{sess.title}</Text>
                          {sess.description && <Text style={s.cardSub} numberOfLines={1}>{sess.description}</Text>}
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <View style={s.scorePill}>
                              <Ionicons name="trophy-outline" size={11} color={C.gold} />
                              <Text style={s.scorePillTxt}>{sess.my_score ?? 0} pts</Text>
                            </View>
                          </View>
                        </View>
                        {loadingAction ? <ActivityIndicator size="small" color={C.gold} /> : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.exploreLink} onPress={() => setTab('explore')}>
                      <Ionicons name="compass-outline" size={14} color={C.muted} />
                      <Text style={s.exploreLinkTxt}>Rejoindre d'autres sessions</Text>
                    </TouchableOpacity>
                  </>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}

            {/* Tab Explorer */}
            {tab === 'explore' && (
              <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {exploreSess.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="checkmark-circle-outline" size={48} color={C.success} />
                    <Text style={s.emptyTitle}>Tout rejoint !</Text>
                    <Text style={s.emptySub}>Vous participez à toutes les sessions disponibles.</Text>
                  </View>
                ) : (
                  exploreSess.map(sess => (
                    <View key={sess.id} style={[s.card, joinedId === sess.id && s.cardJoined]}>
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
                      <TouchableOpacity
                        style={s.joinBtn}
                        onPress={() => joinSession(sess)}
                        disabled={loadingAction}
                      >
                        {loadingAction
                          ? <ActivityIndicator size="small" color={C.white} />
                          : <Text style={s.joinBtnTxt}>Participer</Text>}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        )}

        {/* ══════════════════ ÉCRAN PARTIES ══════════════════ */}
        {screen === 'parties' && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Text style={s.sLabel}>GROUPES</Text>
              {parties.map(party => {
                const myScore = mySessions.find(s => s.id === selSession?.id)?.my_score ?? 0;
                const locked  = !party.is_initial && party.min_score > 0 && myScore < party.min_score;
                return (
                  <View key={party.id} style={[s.card, locked && s.cardLocked]}>
                    <View style={[s.cardIcon, { borderColor: locked ? C.muted + '44' : C.info + '44' }]}>
                      <Ionicons name={locked ? 'lock-closed-outline' : 'people-outline'} size={17} color={locked ? C.muted : C.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, locked && { color: C.muted }]}>{party.title}{party.is_initial ? ' ⭐' : ''}</Text>
                      <Text style={s.cardSub}>
                        {party.is_initial ? 'Groupe ouvert à tous'
                          : locked
                            ? `🔒 Score requis : ${party.min_score} pts (vous : ${myScore})`
                            : [party.min_score > 0 ? `Score min : ${party.min_score}` : '', party.min_rank ? `Top ${party.min_rank}` : ''].filter(Boolean).join(' · ') || 'Groupe spécial'}
                      </Text>
                    </View>
                    {!locked && (
                      <TouchableOpacity
                        style={s.repondreBtn}
                        onPress={() => enterParty(party)}
                        disabled={loadingAction}
                      >
                        {loadingAction && selParty?.id === party.id
                          ? <ActivityIndicator size="small" color={C.white} />
                          : <Text style={s.reponderBtnTxt}>Répondre</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* Bouton Historique */}
              {history.length > 0 && (
                <TouchableOpacity style={s.histBtn} onPress={() => setScreen('history')}>
                  <Ionicons name="time-outline" size={15} color={C.gold} />
                  <Text style={s.histBtnTxt}>Voir l'historique de mes réponses</Text>
                  <Ionicons name="chevron-forward" size={13} color={C.muted} />
                </TouchableOpacity>
              )}

              {totalScore !== null && (
                <View style={s.scoreBand}>
                  <Ionicons name="trophy-outline" size={13} color={C.gold} />
                  <Text style={s.scoreBandTxt}>Score total : <Text style={s.scoreBandVal}>{totalScore} pts</Text></Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}

        {/* ══════════════════ ÉCRAN QUESTIONS ══════════════════ */}
        {screen === 'questions' && (
          <View style={{ flex: 1 }}>
            {questions.length === 0 ? (
              // Toutes répondues
              <View style={s.initLoader}>
                <Ionicons name="checkmark-circle-outline" size={56} color={C.success} />
                <Text style={[s.initTitle, { color: C.success, fontSize: 18 }]}>Toutes les questions répondues !</Text>
                <TouchableOpacity style={s.exploreBtn} onPress={() => setScreen('parties')}>
                  <Text style={s.exploreBtnTxt}>Retour aux groupes</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={{ flex: 1, opacity: questionFadeAnim }}>
                {/* Compteur */}
                <View style={s.qCounter}>
                  <Text style={s.qCounterTxt}>Question {currentQIdx + 1} / {questions.length}</Text>
                  <View style={s.qProgressBar}>
                    <View style={[s.qProgressFill, { width: `${((currentQIdx) / questions.length) * 100}%` as any }]} />
                  </View>
                </View>

                <ScrollView contentContainerStyle={[s.scroll, { alignItems: 'stretch', paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
                  <View style={s.questionCard}>
                    <View style={s.questionScoreBadge}>
                      <Text style={s.questionScoreTxt}>{questions[currentQIdx]?.score} pts</Text>
                    </View>
                    <Text style={s.questionTxt}>{questions[currentQIdx]?.question_text}</Text>
                  </View>

                  <View style={s.answerRow}>
                    <AnsBtn label="VRAI" icon="checkmark-circle-outline" color={C.vrai}
                      loading={answerLoading} disabled={answerLoading} onPress={() => submitAnswer(true)} />
                    <AnsBtn label="FAUX" icon="close-circle-outline" color={C.faux}
                      loading={answerLoading} disabled={answerLoading} onPress={() => submitAnswer(false)} />
                  </View>

                  {/* Navigation entre questions */}
                  {questions.length > 1 && (
                    <View style={s.qNav}>
                      <TouchableOpacity
                        style={[s.qNavBtn, currentQIdx === 0 && s.qNavBtnDisabled]}
                        onPress={() => setCurrentQIdx(p => Math.max(0, p - 1))}
                        disabled={currentQIdx === 0}
                      >
                        <Ionicons name="chevron-back" size={16} color={currentQIdx === 0 ? C.muted : C.cream} />
                        <Text style={[s.qNavTxt, currentQIdx === 0 && { color: C.muted }]}>Précédente</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.qNavBtn, currentQIdx === questions.length - 1 && s.qNavBtnDisabled]}
                        onPress={() => setCurrentQIdx(p => Math.min(questions.length - 1, p + 1))}
                        disabled={currentQIdx === questions.length - 1}
                      >
                        <Text style={[s.qNavTxt, currentQIdx === questions.length - 1 && { color: C.muted }]}>Suivante</Text>
                        <Ionicons name="chevron-forward" size={16} color={currentQIdx === questions.length - 1 ? C.muted : C.cream} />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        )}

        {/* ══════════════════ ÉCRAN HISTORIQUE ══════════════════ */}
        {screen === 'history' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {totalScore !== null && (
              <View style={[s.scoreBand, { marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: C.gold + '33' }]}>
                <Ionicons name="trophy-outline" size={16} color={C.gold} />
                <Text style={s.scoreBandTxt}>Score total dans cette party : <Text style={s.scoreBandVal}>{totalScore} pts</Text></Text>
              </View>
            )}

            {history.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="time-outline" size={40} color={C.muted} />
                <Text style={s.emptyTitle}>Aucune réponse pour l'instant</Text>
                <Text style={s.emptySub}>Répondez à des questions pour voir votre historique ici</Text>
              </View>
            ) : (
              history.map(run => (
                <View key={run.run_id} style={s.histRunCard}>
                  <Text style={s.histRunTitle}>{run.run_title}</Text>
                  {run.questions.map(q => <HistoryQRow key={q.id} q={q} />)}
                </View>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function AnsBtn({ label, icon, color, disabled, loading, onPress }: any) {
  return (
    <TouchableOpacity
      style={[s.answerBtn, { backgroundColor: color + 'EE' }, disabled && s.answerDisabled]}
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
  const dotIcon: any = !q.answered ? 'remove-circle-outline' : correct ? 'checkmark-circle' : 'close-circle';

  return (
    <View style={s.histQRow}>
      <View style={[s.histQIndicator, { backgroundColor: dotColor + '22', borderColor: dotColor + '55' }]}>
        <Ionicons name={dotIcon} size={16} color={dotColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.histQText} numberOfLines={3}>{q.question_text}</Text>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {q.correct_answer !== null && (
            <View style={[s.histQChip, { backgroundColor: (q.correct_answer ? C.vrai : C.faux) + '18', borderColor: (q.correct_answer ? C.vrai : C.faux) + '44' }]}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: q.correct_answer ? C.vrai : C.faux }}>✓ {q.correct_answer ? 'VRAI' : 'FAUX'}</Text>
            </View>
          )}
          {incorrect && (
            <View style={[s.histQChip, { backgroundColor: C.danger + '18', borderColor: C.danger + '44' }]}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: C.danger }}>✗ {q.my_answer ? 'VRAI' : 'FAUX'}</Text>
            </View>
          )}
          {q.answered
            ? <Text style={{ fontSize: 10, fontWeight: '700', color: correct ? C.gold : C.muted }}>{correct ? `+${q.score_awarded ?? q.score}` : '+0'} pts</Text>
            : <Text style={{ fontSize: 9, color: C.muted }}>Non joué</Text>}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  initLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 30 },
  initTitle:  { fontSize: 22, fontWeight: '800', color: C.cream, textAlign: 'center' },

  header: { paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  iconBtn: { width: 33, height: 33, borderRadius: 16, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 1 },
  headerTitle:  { fontSize: 19, fontWeight: '800', color: C.cream },

  tabBar:        { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabTxt:        { fontSize: 13, color: C.muted, fontWeight: '600' },
  tabTxtActive:  { color: C.gold },
  tabBadge:      { backgroundColor: C.gold, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeTxt:   { fontSize: 10, color: '#000', fontWeight: '800' },

  errorBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.danger + '18', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.danger + '33' },
  errorBarTxt: { flex: 1, color: C.danger, fontSize: 12 },

  scroll:  { padding: 16 },
  sLabel:  { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 2, marginBottom: 11 },

  card:       { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardJoined: { borderColor: C.success + '66', backgroundColor: C.success + '08' },
  cardLocked: { opacity: 0.6 },
  cardIcon:   { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44', flexShrink: 0 },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 2 },
  cardSub:    { fontSize: 12, color: C.muted },

  scorePill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: C.gold + '22', borderWidth: 1, borderColor: C.gold + '44' },
  scorePillTxt: { fontSize: 11, fontWeight: '700', color: C.gold },

  joinBtn:    { backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, minWidth: 80, alignItems: 'center' },
  joinBtnTxt: { color: '#000', fontWeight: '800', fontSize: 12 },

  repondreBtn:    { backgroundColor: C.info, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 78, alignItems: 'center' },
  reponderBtnTxt: { color: C.white, fontWeight: '800', fontSize: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.cream, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.gold + '22', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 8, borderWidth: 1, borderColor: C.gold + '55' },
  exploreBtnTxt: { color: C.gold, fontWeight: '700', fontSize: 13 },
  exploreLink:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  exploreLinkTxt: { color: C.muted, fontSize: 12, fontWeight: '600' },

  scoreBand:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.gold + '18', paddingHorizontal: 14, paddingVertical: 10 },
  scoreBandTxt: { color: C.muted, fontSize: 13 },
  scoreBandVal: { color: C.gold, fontWeight: '800' },

  histBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 13, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: C.gold + '33' },
  histBtnTxt: { flex: 1, color: C.cream, fontSize: 13, fontWeight: '600' },

  qCounter:     { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  qCounterTxt:  { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 6 },
  qProgressBar: { height: 3, backgroundColor: C.border, borderRadius: 2 },
  qProgressFill:{ height: 3, backgroundColor: C.gold, borderRadius: 2 },

  questionCard:       { backgroundColor: C.surface, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, marginBottom: 20, alignItems: 'center', gap: 14 },
  questionScoreBadge: { backgroundColor: C.gold + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.gold + '55' },
  questionScoreTxt:   { fontSize: 12, fontWeight: '700', color: C.gold },
  questionTxt:        { fontSize: 20, fontWeight: '700', color: C.cream, lineHeight: 30, textAlign: 'center' },

  answerRow:      { flexDirection: 'row', gap: 12, marginBottom: 16 },
  answerBtn:      { flex: 1, borderRadius: 16, paddingVertical: 32, alignItems: 'center', gap: 8 },
  answerDisabled: { opacity: 0.45 },
  answerBtnTxt:   { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 1 },

  qNav:          { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  qNavBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  qNavBtnDisabled: { opacity: 0.35 },
  qNavTxt:       { fontSize: 13, color: C.cream, fontWeight: '600' },

  histRunCard:  { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border },
  histRunTitle: { fontSize: 11, fontWeight: '700', color: C.gold, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  histQRow:     { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border + '55', alignItems: 'flex-start' },
  histQIndicator: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, flexShrink: 0, marginTop: 1 },
  histQText:    { fontSize: 13, color: C.cream, lineHeight: 18, fontWeight: '500', marginBottom: 2 },
  histQChip:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
});
