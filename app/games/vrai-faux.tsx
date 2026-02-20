/**
 * vrai-faux.tsx — 4 onglets permanents
 *
 * ONGLET 1 "Sessions"   → mes sessions rejointes → groupes → Répondre aux questions
 * ONGLET 2 "Explorer"   → sessions disponibles → bouton Participer
 * ONGLET 3 "Réponses"   → sessions → groupes → mes réponses (VRAI/FAUX seulement, ZÉRO score)
 * ONGLET 4 "Résultats"  → sessions → groupes → bonne réponse + score (SI révélé par admin)
 *
 * CORRECTIONS v3 :
 *   - useNativeDriver: false sur web, true sur iOS/Android (évite le crash IntersectionObserver)
 *   - Toutes les animations stoppées proprement dans le cleanup du useEffect (évite disconnect null)
 *   - Animated.Value gardés en useRef (pas .current détaché) pour rester stable entre rendus
 *   - animRef stocke l'instance Animated.CompositeAnimation pour pouvoir l'arrêter
 *   - questionAnimRef idem pour l'animation de fondu entre questions
 *   - loadingCard : un état par carte (id string | null) → pas de spinner global
 *   - selSession1 / selSession3 / selSession4 séparés → pas de collision entre onglets
 *   - currentQIdx remis à 0 à chaque nouveau chargement de questions
 *   - Retour depuis questions → met à jour mySessions avec score rechargé
 *   - Onglet 4 : pending=true → message d'attente avec icône sablier
 *   - Onglet 3 : message explicite "scores révélés dans Résultats"
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Animated, Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY    = 'vrai_faux';

// useNativeDriver doit être false sur web (pas de thread natif),
// true sur iOS/Android pour de meilleures performances.
const NATIVE_DRIVER = Platform.OS !== 'web';

const haptic = {
  light:   () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
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
type Tab   = 'mine' | 'explore' | 'answers' | 'results';
type Sub13 = 'sessions' | 'parties' | 'questions';
type Sub4  = 'sessions' | 'parties' | 'results';

interface SessionItem {
  id: string; title: string; description?: string;
  is_paid: boolean; price_cfa: number; my_score?: number;
}
interface PartyItem {
  id: string; title: string; is_initial: boolean;
  min_score: number; min_rank: number | null;
}
interface QuestionItem {
  id: string; run_id: string; question_text: string; score: number;
}
interface MyAnswerRun {
  run_id: string; run_title: string;
  questions: { id: string; question_text: string; score: number; my_answer: boolean; }[];
}
interface MyResultRun {
  run_id: string; run_title: string;
  questions: {
    id: string; question_text: string; score: number;
    correct_answer: boolean | null; my_answer: boolean | null;
    score_awarded: number; answered: boolean;
  }[];
}

interface VraiFauxProps { userId?: string; onBack?: () => void; }

export default function VraiFaux({ userId: userIdProp, onBack }: VraiFauxProps) {

  // ─── Navigation ────────────────────────────────────────────────────────────
  const [tab,  setTab]  = useState<Tab>('mine');
  const [sub1, setSub1] = useState<Sub13>('sessions');
  const [sub3, setSub3] = useState<Sub13>('sessions');
  const [sub4, setSub4] = useState<Sub4>('sessions');

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string>(userIdProp || '');
  const userIdRef           = useRef<string>(userIdProp || '');
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─── Données ───────────────────────────────────────────────────────────────
  const [mySessions,   setMySessions]   = useState<SessionItem[]>([]);
  const [selSess1,     setSelSess1]     = useState<SessionItem | null>(null);
  const [parties1,     setParties1]     = useState<PartyItem[]>([]);
  const [selParty1,    setSelParty1]    = useState<PartyItem | null>(null);
  const [questions,    setQuestions]    = useState<QuestionItem[]>([]);
  const [currentQIdx,  setCurrentQIdx]  = useState(0);

  const [exploreSess,  setExploreSess]  = useState<SessionItem[]>([]);

  const [selSess3,     setSelSess3]     = useState<SessionItem | null>(null);
  const [parties3,     setParties3]     = useState<PartyItem[]>([]);
  const [selParty3,    setSelParty3]    = useState<PartyItem | null>(null);
  const [myAnswerRuns, setMyAnswerRuns] = useState<MyAnswerRun[]>([]);

  const [selSess4,     setSelSess4]     = useState<SessionItem | null>(null);
  const [parties4,     setParties4]     = useState<PartyItem[]>([]);
  const [selParty4,    setSelParty4]    = useState<PartyItem | null>(null);
  const [myResultRuns, setMyResultRuns] = useState<MyResultRun[]>([]);
  const [totalScore,   setTotalScore]   = useState<number>(0);
  const [resultPending,setResultPending]= useState(false);
  const [resultMsg,    setResultMsg]    = useState('');

  // ─── UI ────────────────────────────────────────────────────────────────────
  const [initLoading,  setInitLoading]  = useState(true);
  const [loadingCard,  setLoadingCard]  = useState<string | null>(null);
  const [answerLoading,setAnswerLoading]= useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState('');

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const isMounted = useRef(true);

  // On garde les Animated.Value dans des useRef stables
  // (jamais détachés avec .current au moment de la création)
  const fadeAnim         = useRef(new Animated.Value(0)).current;
  const questionFadeAnim = useRef(new Animated.Value(1)).current;

  // Stocke l'instance de l'animation en cours pour pouvoir l'arrêter proprement
  const fadeAnimRef         = useRef<Animated.CompositeAnimation | null>(null);
  const questionFadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    // Lance l'animation de fondu initial et stocke la référence
    fadeAnimRef.current = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: NATIVE_DRIVER,
    });
    fadeAnimRef.current.start();

    const init = async () => {
      let uid = userIdProp || '';
      if (!uid) {
        try {
          const raw = await AsyncStorage.getItem('harmonia_session');
          if (raw) { const p = JSON.parse(raw); uid = p?.user?.id || ''; }
        } catch {}
      }
      if (uid) { setUserId(uid); userIdRef.current = uid; }
      await Promise.all([loadMySessions(uid), loadExploreSessions(uid)]);
      if (isMounted.current) setInitLoading(false);
    };
    init();

    // ── Cleanup : on stoppe TOUTES les animations pour éviter le
    //    "Cannot read properties of null (reading 'disconnect')" sur web
    return () => {
      isMounted.current = false;
      fadeAnimRef.current?.stop();
      questionFadeAnimRef.current?.stop();
      // Stoppe toute animation en cours sur ces valeurs
      fadeAnim.stopAnimation();
      questionFadeAnim.stopAnimation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── API ───────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const uid = userIdRef.current;
    if (!uid) throw new Error('Non connecté');
    const res = await fetch(`${BACKEND_URL}/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, ...body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  // ─── Chargements ───────────────────────────────────────────────────────────
  const loadMySessions = useCallback(async (uid?: string) => {
    try {
      const u = uid || userIdRef.current;
      if (!u) return;
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, function: 'listMySessions', game_key: GAME_KEY }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setMySessions(data.sessions || []);
    } catch {}
  }, []);

  const loadExploreSessions = useCallback(async (uid?: string) => {
    try {
      const u = uid || userIdRef.current;
      if (!u) return;
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u, function: 'listAvailableSessions', game_key: GAME_KEY }),
      });
      const data = await res.json();
      if (isMounted.current && data.success) setExploreSess(data.sessions || []);
    } catch {}
  }, []);

  const syncAll = useCallback(async () => {
    setError(''); setRefreshing(true);
    await Promise.all([loadMySessions(), loadExploreSessions()]);
    if (isMounted.current) setRefreshing(false);
  }, [loadMySessions, loadExploreSessions]);

  // ─── ONGLET 2 : Explorer → Participer ────────────────────────────────────
  const joinSession = async (session: SessionItem) => {
    setLoadingCard(session.id); haptic.medium();
    try {
      const partiesData = await api({ function: 'listPartiesForSession', session_id: session.id });
      const initialParty = (partiesData.parties as PartyItem[]).find(p => p.is_initial);
      if (!initialParty) { setError("Aucun groupe d'entrée disponible"); return; }
      const joinData = await api({ function: 'joinSession', session_id: session.id, party_id: initialParty.id });
      if (!joinData.success) { setError(joinData.error || 'Erreur participation'); return; }
      haptic.success();
      setExploreSess(prev => prev.filter(s => s.id !== session.id));
      setMySessions(prev => [...prev, { ...session, my_score: 0 }]);
      setTab('mine'); setSub1('sessions');
    } catch (e: any) { setError(e.message || 'Erreur réseau'); haptic.error(); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  // ─── ONGLET 1 : Sessions → Parties → Questions ───────────────────────────
  const openSession1 = async (sess: SessionItem) => {
    setLoadingCard(sess.id); setError('');
    try {
      const data = await api({ function: 'listPartiesForSession', session_id: sess.id });
      if (!isMounted.current) return;
      setSelSess1(sess); setParties1(data.parties || []);
      setSub1('parties');
    } catch (e: any) { if (isMounted.current) setError(e.message || 'Erreur réseau'); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  const enterParty1 = async (party: PartyItem) => {
    if (!selSess1) return;
    const myScore = mySessions.find(s => s.id === selSess1.id)?.my_score ?? 0;
    if (!party.is_initial && party.min_score > 0 && myScore < party.min_score) {
      setError(`Score insuffisant — vous avez ${myScore} pts, requis ${party.min_score} pts`);
      return;
    }
    setLoadingCard(party.id); setError(''); haptic.medium();
    try {
      await api({ function: 'joinSession', session_id: selSess1.id, party_id: party.id });
      const data = await api({ function: 'getUnansweredQuestions', party_id: party.id });
      if (!isMounted.current) return;
      setSelParty1(party);
      setQuestions(data.questions || []);
      setCurrentQIdx(0);
      setSub1('questions');
      haptic.success();
    } catch (e: any) { if (isMounted.current) setError(e.message || 'Erreur réseau'); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  // ─── Soumettre une réponse ─────────────────────────────────────────────────
  const submitAnswer = async (answer: boolean) => {
    const question = questions[currentQIdx];
    if (!question || answerLoading) return;
    setAnswerLoading(true); haptic.medium();
    try {
      const data = await api({ function: 'submitAnswer', run_question_id: question.id, answer });
      if (!isMounted.current) return;
      if (data.success) {
        haptic.success();
        // Stoppe l'animation précédente avant d'en lancer une nouvelle
        questionFadeAnimRef.current?.stop();

        const fadeOut = Animated.timing(questionFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: NATIVE_DRIVER,
        });
        questionFadeAnimRef.current = fadeOut;

        fadeOut.start(({ finished }) => {
          // Si l'animation a été interrompue (démontage), on sort immédiatement
          if (!finished || !isMounted.current) return;

          setQuestions(prev => {
            const next = prev.filter((_, i) => i !== currentQIdx);
            if (next.length === 0) {
              setSub1('parties');
              loadMySessions();
            } else {
              setCurrentQIdx(i => Math.min(i, next.length - 1));
            }
            return next;
          });

          // Remet l'opacité à 1 pour la prochaine question
          questionFadeAnim.setValue(1);
        });
      } else {
        if (isMounted.current) setError(data.error || 'Erreur envoi');
        haptic.error();
      }
    } catch (e: any) {
      if (isMounted.current) setError(e.message || 'Erreur réseau');
      haptic.error();
    } finally {
      if (isMounted.current) setAnswerLoading(false);
    }
  };

  // ─── ONGLET 3 : Mes réponses ───────────────────────────────────────────────
  const openSession3 = async (sess: SessionItem) => {
    setLoadingCard(sess.id); setError('');
    try {
      const data = await api({ function: 'listPartiesForSession', session_id: sess.id });
      if (!isMounted.current) return;
      setSelSess3(sess); setParties3(data.parties || []);
      setSub3('parties');
    } catch (e: any) { if (isMounted.current) setError(e.message || 'Erreur réseau'); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  const openParty3 = async (party: PartyItem) => {
    setLoadingCard(party.id); setError('');
    try {
      const data = await api({ function: 'getMyAnswers', party_id: party.id });
      if (!isMounted.current) return;
      setSelParty3(party); setMyAnswerRuns(data.runs || []);
      setSub3('questions');
    } catch (e: any) { if (isMounted.current) setError(e.message || 'Erreur réseau'); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  // ─── ONGLET 4 : Résultats ──────────────────────────────────────────────────
  const openSession4 = async (sess: SessionItem) => {
    setLoadingCard(sess.id); setError('');
    try {
      const data = await api({ function: 'listPartiesForSession', session_id: sess.id });
      if (!isMounted.current) return;
      setSelSess4(sess); setParties4(data.parties || []);
      setSub4('parties');
    } catch (e: any) { if (isMounted.current) setError(e.message || 'Erreur réseau'); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  const openParty4 = async (party: PartyItem) => {
    setLoadingCard(party.id); setError('');
    try {
      const data = await api({ function: 'getMyResults', party_id: party.id });
      if (!isMounted.current) return;
      setSelParty4(party);
      setMyResultRuns(data.runs || []);
      setTotalScore(data.total_score ?? 0);
      setResultPending(data.pending ?? false);
      setResultMsg(data.message || '');
      setSub4('results');
    } catch (e: any) { if (isMounted.current) setError(e.message || 'Erreur réseau'); }
    finally { if (isMounted.current) setLoadingCard(null); }
  };

  // ─── Navigation retour ─────────────────────────────────────────────────────
  const goBack = () => {
    setError('');
    if (tab === 'mine') {
      if (sub1 === 'questions')      { setSub1('parties'); }
      else if (sub1 === 'parties')   { setSub1('sessions'); setSelSess1(null); setParties1([]); }
      else                           { onBack?.(); }
    } else if (tab === 'explore') {
      onBack?.();
    } else if (tab === 'answers') {
      if (sub3 === 'questions')      { setSub3('parties'); setMyAnswerRuns([]); }
      else if (sub3 === 'parties')   { setSub3('sessions'); setSelSess3(null); setParties3([]); }
      else                           { onBack?.(); }
    } else if (tab === 'results') {
      if (sub4 === 'results')        { setSub4('parties'); setMyResultRuns([]); }
      else if (sub4 === 'parties')   { setSub4('sessions'); setSelSess4(null); setParties4([]); }
      else                           { onBack?.(); }
    }
  };

  const isOnSubScreen = () => {
    if (tab === 'mine'    && sub1 !== 'sessions') return true;
    if (tab === 'answers' && sub3 !== 'sessions') return true;
    if (tab === 'results' && sub4 !== 'sessions') return true;
    return false;
  };

  const headerSub = () => {
    if (tab === 'mine') {
      if (sub1 === 'parties')   return selSess1?.title?.toUpperCase() ?? 'GROUPES';
      if (sub1 === 'questions') return selParty1?.title?.toUpperCase() ?? 'QUESTIONS';
      return 'MES SESSIONS';
    }
    if (tab === 'explore') return 'EXPLORER';
    if (tab === 'answers') {
      if (sub3 === 'parties')   return selSess3?.title?.toUpperCase() ?? 'GROUPES';
      if (sub3 === 'questions') return selParty3?.title?.toUpperCase() ?? 'MES RÉPONSES';
      return 'MES RÉPONSES';
    }
    if (sub4 === 'parties') return selSess4?.title?.toUpperCase() ?? 'GROUPES';
    if (sub4 === 'results') return selParty4?.title?.toUpperCase() ?? 'MES RÉSULTATS';
    return 'MES RÉSULTATS';
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centerBox}>
          <Ionicons name="game-controller-outline" size={44} color={C.gold} />
          <Text style={s.initTitle}>Vrai ou Faux</Text>
          <ActivityIndicator size="small" color={C.muted} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* ── HEADER ── */}
        <LinearGradient colors={['#10100A', C.bg]} style={s.header}>
          {(isOnSubScreen() || onBack) ? (
            <TouchableOpacity onPress={goBack} style={s.iconBtn}>
              <Ionicons name="arrow-back" size={19} color={C.gold} />
            </TouchableOpacity>
          ) : <View style={s.iconBtn} />}

          <View style={s.headerCenter}>
            <Text style={s.headerSub}>{headerSub()}</Text>
            <Text style={s.headerTitle}>Vrai ou Faux</Text>
          </View>

          <TouchableOpacity onPress={syncAll} style={s.iconBtn} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={C.muted} />
              : <Ionicons name="refresh-outline" size={17} color={C.muted} />}
          </TouchableOpacity>
        </LinearGradient>

        {/* ── BARRE D'ERREUR ── */}
        {error !== '' && (
          <View style={s.errorBar}>
            <Ionicons name="warning-outline" size={13} color={C.danger} />
            <Text style={s.errorTxt} numberOfLines={2}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={15} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── BARRE D'ONGLETS ── */}
        <View style={s.tabBar}>
          <TabBtn icon="bookmark-outline" label="Sessions" active={tab === 'mine'}
            onPress={() => { setTab('mine'); setSub1('sessions'); }} />
          <TabBtn icon="compass-outline" label="Explorer" active={tab === 'explore'}
            onPress={() => setTab('explore')} badge={exploreSess.length} />
          <TabBtn icon="chatbox-outline" label="Réponses" active={tab === 'answers'}
            onPress={() => { setTab('answers'); setSub3('sessions'); }} />
          <TabBtn icon="trophy-outline" label="Résultats" active={tab === 'results'}
            onPress={() => { setTab('results'); setSub4('sessions'); }} />
        </View>

        {/* ══════════════════════════════════════════════
            ONGLET 1 — MES SESSIONS
        ══════════════════════════════════════════════ */}

        {tab === 'mine' && sub1 === 'sessions' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {mySessions.length === 0 ? (
              <EmptyState icon="albums-outline" title="Aucune session rejointe"
                sub="Explorez les sessions disponibles et participez !"
                actionLabel="Explorer" onAction={() => setTab('explore')} />
            ) : mySessions.map(sess => (
              <TouchableOpacity key={sess.id} style={s.card}
                onPress={() => openSession1(sess)} activeOpacity={0.8}>
                <View style={s.cardIcon}>
                  <Ionicons name="albums-outline" size={17} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{sess.title}</Text>
                  {sess.description && (
                    <Text style={s.cardSub} numberOfLines={1}>{sess.description}</Text>
                  )}
                  <View style={s.pillRow}>
                    <ScorePill score={sess.my_score ?? 0} />
                  </View>
                </View>
                {loadingCard === sess.id
                  ? <ActivityIndicator size="small" color={C.gold} />
                  : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'mine' && sub1 === 'parties' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>GROUPES</Text>
            {parties1.map(party => {
              const myScore = mySessions.find(s => s.id === selSess1?.id)?.my_score ?? 0;
              const locked  = !party.is_initial && party.min_score > 0 && myScore < party.min_score;
              return (
                <View key={party.id} style={[s.card, locked && s.cardLocked]}>
                  <View style={[s.cardIcon, { borderColor: locked ? C.muted + '44' : C.info + '44' }]}>
                    <Ionicons
                      name={locked ? 'lock-closed-outline' : 'people-outline'}
                      size={17} color={locked ? C.muted : C.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, locked && { color: C.muted }]}>
                      {party.title}{party.is_initial ? ' ⭐' : ''}
                    </Text>
                    <Text style={s.cardSub}>
                      {locked
                        ? `🔒 Requis : ${party.min_score} pts · Vous : ${myScore} pts`
                        : party.is_initial ? 'Groupe ouvert à tous' : `Score min : ${party.min_score} pts`}
                    </Text>
                  </View>
                  {!locked && (
                    <TouchableOpacity
                      style={s.repondreBtn}
                      onPress={() => enterParty1(party)}
                      disabled={loadingCard !== null}>
                      {loadingCard === party.id
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <Text style={s.repBtnTxt}>Répondre</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'mine' && sub1 === 'questions' && (
          <View style={{ flex: 1 }}>
            {questions.length === 0 ? (
              <View style={s.centerBox}>
                <Ionicons name="checkmark-circle-outline" size={56} color={C.success} />
                <Text style={[s.initTitle, { color: C.success, fontSize: 17, marginTop: 12 }]}>
                  Toutes les questions répondues !
                </Text>
                <TouchableOpacity style={[s.actionBtn, { marginTop: 20 }]}
                  onPress={() => setSub1('parties')}>
                  <Text style={s.actionBtnTxt}>Retour aux groupes</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={{ flex: 1, opacity: questionFadeAnim }}>
                {/* Barre de progression */}
                <View style={s.qCounter}>
                  <Text style={s.qCounterTxt}>
                    Question {currentQIdx + 1} / {questions.length}
                  </Text>
                  <View style={s.qProgressBar}>
                    <View style={[s.qProgressFill,
                      { width: `${((currentQIdx + 1) / questions.length) * 100}%` as any }]} />
                  </View>
                </View>

                <ScrollView
                  contentContainerStyle={[s.scroll, { paddingTop: 8 }]}
                  showsVerticalScrollIndicator={false}>

                  <View style={s.questionCard}>
                    <View style={s.scoreBadge}>
                      <Text style={s.scoreBadgeTxt}>{questions[currentQIdx]?.score} pts</Text>
                    </View>
                    <Text style={s.questionTxt}>{questions[currentQIdx]?.question_text}</Text>
                  </View>

                  <View style={s.answerRow}>
                    <AnsBtn label="VRAI" icon="checkmark-circle-outline" color={C.vrai}
                      loading={answerLoading} disabled={answerLoading}
                      onPress={() => submitAnswer(true)} />
                    <AnsBtn label="FAUX" icon="close-circle-outline" color={C.faux}
                      loading={answerLoading} disabled={answerLoading}
                      onPress={() => submitAnswer(false)} />
                  </View>

                  {questions.length > 1 && (
                    <View style={s.qNav}>
                      <TouchableOpacity
                        style={[s.qNavBtn, currentQIdx === 0 && s.qNavBtnDis]}
                        onPress={() => setCurrentQIdx(p => Math.max(0, p - 1))}
                        disabled={currentQIdx === 0}>
                        <Ionicons name="chevron-back" size={16}
                          color={currentQIdx === 0 ? C.muted : C.cream} />
                        <Text style={[s.qNavTxt, currentQIdx === 0 && { color: C.muted }]}>
                          Précédente
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.qNavBtn, currentQIdx === questions.length - 1 && s.qNavBtnDis]}
                        onPress={() => setCurrentQIdx(p => Math.min(questions.length - 1, p + 1))}
                        disabled={currentQIdx === questions.length - 1}>
                        <Text style={[s.qNavTxt,
                          currentQIdx === questions.length - 1 && { color: C.muted }]}>
                          Suivante
                        </Text>
                        <Ionicons name="chevron-forward" size={16}
                          color={currentQIdx === questions.length - 1 ? C.muted : C.cream} />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════
            ONGLET 2 — EXPLORER
        ══════════════════════════════════════════════ */}

        {tab === 'explore' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {exploreSess.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" title="Tout rejoint !"
                sub="Vous participez à toutes les sessions disponibles."
                iconColor={C.success} />
            ) : exploreSess.map(sess => (
              <View key={sess.id} style={s.card}>
                <View style={s.cardIcon}>
                  <Ionicons name="albums-outline" size={17} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{sess.title}</Text>
                  {sess.description && (
                    <Text style={s.cardSub} numberOfLines={2}>{sess.description}</Text>
                  )}
                  <View style={{ marginTop: 5 }}>
                    <Pill
                      label={sess.is_paid ? `💰 ${sess.price_cfa} CFA` : 'Gratuit'}
                      color={sess.is_paid ? C.gold : C.success} />
                  </View>
                </View>
                <TouchableOpacity
                  style={s.joinBtn}
                  onPress={() => joinSession(sess)}
                  disabled={loadingCard !== null}>
                  {loadingCard === sess.id
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={s.joinBtnTxt}>Participer</Text>}
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ══════════════════════════════════════════════
            ONGLET 3 — MES RÉPONSES
        ══════════════════════════════════════════════ */}

        {tab === 'answers' && sub3 === 'sessions' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>SESSIONS PARTICIPÉES</Text>
            {mySessions.length === 0 ? (
              <EmptyState icon="chatbox-outline" title="Aucune réponse"
                sub="Participez à une session pour voir vos réponses." />
            ) : mySessions.map(sess => (
              <TouchableOpacity key={sess.id} style={s.card}
                onPress={() => openSession3(sess)} activeOpacity={0.8}>
                <View style={s.cardIcon}>
                  <Ionicons name="albums-outline" size={17} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{sess.title}</Text>
                </View>
                {loadingCard === sess.id
                  ? <ActivityIndicator size="small" color={C.gold} />
                  : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'answers' && sub3 === 'parties' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>GROUPES — {selSess3?.title}</Text>
            {parties3.map(party => (
              <TouchableOpacity key={party.id} style={s.card}
                onPress={() => openParty3(party)} activeOpacity={0.8}>
                <View style={[s.cardIcon, { borderColor: C.info + '44' }]}>
                  <Ionicons name="people-outline" size={17} color={C.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{party.title}{party.is_initial ? ' ⭐' : ''}</Text>
                </View>
                {loadingCard === party.id
                  ? <ActivityIndicator size="small" color={C.gold} />
                  : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'answers' && sub3 === 'questions' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>MES RÉPONSES</Text>
            <View style={s.infoBar}>
              <Ionicons name="information-circle-outline" size={14} color={C.info} />
              <Text style={s.infoBarTxt}>
                Les scores et les bonnes réponses seront révélés par l'administrateur
                dans l'onglet <Text style={{ fontWeight: '800' }}>Résultats</Text>
              </Text>
            </View>
            {myAnswerRuns.length === 0 ? (
              <EmptyState icon="chatbox-outline" title="Aucune réponse"
                sub="Vous n'avez pas encore répondu à des questions dans ce groupe." />
            ) : myAnswerRuns.map(run => (
              <View key={run.run_id} style={s.runCard}>
                <Text style={s.runTitle}>{run.run_title}</Text>
                {run.questions.map(q => (
                  <View key={q.id} style={s.qRow}>
                    <View style={[s.dot, {
                      backgroundColor: (q.my_answer ? C.vrai : C.faux) + '22',
                      borderColor: (q.my_answer ? C.vrai : C.faux) + '55',
                    }]}>
                      <Ionicons
                        name={q.my_answer ? 'checkmark' : 'close'}
                        size={12} color={q.my_answer ? C.vrai : C.faux} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.qTxt} numberOfLines={3}>{q.question_text}</Text>
                      <Text style={{
                        fontSize: 11,
                        color: q.my_answer ? C.vrai : C.faux,
                        fontWeight: '700',
                        marginTop: 3,
                      }}>
                        J'ai répondu : {q.my_answer ? 'VRAI' : 'FAUX'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ══════════════════════════════════════════════
            ONGLET 4 — MES RÉSULTATS
        ══════════════════════════════════════════════ */}

        {tab === 'results' && sub4 === 'sessions' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>SESSIONS PARTICIPÉES</Text>
            {mySessions.length === 0 ? (
              <EmptyState icon="trophy-outline" title="Aucun résultat"
                sub="Participez à une session pour voir vos résultats." />
            ) : mySessions.map(sess => (
              <TouchableOpacity key={sess.id} style={s.card}
                onPress={() => openSession4(sess)} activeOpacity={0.8}>
                <View style={s.cardIcon}>
                  <Ionicons name="albums-outline" size={17} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{sess.title}</Text>
                  <View style={s.pillRow}>
                    <ScorePill score={sess.my_score ?? 0} />
                  </View>
                </View>
                {loadingCard === sess.id
                  ? <ActivityIndicator size="small" color={C.gold} />
                  : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'results' && sub4 === 'parties' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sLabel}>GROUPES — {selSess4?.title}</Text>
            {parties4.map(party => (
              <TouchableOpacity key={party.id} style={s.card}
                onPress={() => openParty4(party)} activeOpacity={0.8}>
                <View style={[s.cardIcon, { borderColor: C.gold + '44' }]}>
                  <Ionicons name="people-outline" size={17} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{party.title}{party.is_initial ? ' ⭐' : ''}</Text>
                </View>
                {loadingCard === party.id
                  ? <ActivityIndicator size="small" color={C.gold} />
                  : <Ionicons name="chevron-forward" size={15} color={C.muted} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'results' && sub4 === 'results' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {resultPending ? (
              <View style={s.pendingBox}>
                <Ionicons name="hourglass-outline" size={44} color={C.muted} />
                <Text style={s.pendingTitle}>Résultats pas encore révélés</Text>
                <Text style={s.pendingSub}>
                  {resultMsg || "L'administrateur révèlera les résultats après la fermeture du run."}
                </Text>
              </View>
            ) : (
              <>
                {totalScore > 0 && (
                  <View style={s.totalBand}>
                    <Ionicons name="trophy-outline" size={16} color={C.gold} />
                    <Text style={s.totalBandTxt}>
                      Score total :{' '}
                      <Text style={{ color: C.gold, fontWeight: '800' }}>{totalScore} pts</Text>
                    </Text>
                  </View>
                )}
                {myResultRuns.map(run => (
                  <View key={run.run_id} style={s.runCard}>
                    <Text style={s.runTitle}>{run.run_title}</Text>
                    {run.questions.map(q => {
                      const correct   = q.answered && q.my_answer === q.correct_answer;
                      const incorrect = q.answered && q.my_answer !== q.correct_answer;
                      const dotColor  = !q.answered ? C.muted : correct ? C.success : C.danger;
                      const dotIcon: any = !q.answered
                        ? 'remove-outline'
                        : correct ? 'checkmark-circle' : 'close-circle';
                      return (
                        <View key={q.id} style={s.qRow}>
                          <View style={[s.dot, {
                            backgroundColor: dotColor + '22',
                            borderColor: dotColor + '55',
                          }]}>
                            <Ionicons name={dotIcon} size={12} color={dotColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.qTxt} numberOfLines={3}>{q.question_text}</Text>
                            <View style={{
                              flexDirection: 'row', gap: 6, marginTop: 4,
                              flexWrap: 'wrap', alignItems: 'center',
                            }}>
                              {q.correct_answer !== null && (
                                <View style={[s.chip, {
                                  backgroundColor: (q.correct_answer ? C.vrai : C.faux) + '18',
                                  borderColor: (q.correct_answer ? C.vrai : C.faux) + '44',
                                }]}>
                                  <Text style={{
                                    fontSize: 9, fontWeight: '800',
                                    color: q.correct_answer ? C.vrai : C.faux,
                                  }}>
                                    ✓ {q.correct_answer ? 'VRAI' : 'FAUX'}
                                  </Text>
                                </View>
                              )}
                              {incorrect && (
                                <View style={[s.chip, {
                                  backgroundColor: C.danger + '18', borderColor: C.danger + '44',
                                }]}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: C.danger }}>
                                    ✗ {q.my_answer ? 'VRAI' : 'FAUX'}
                                  </Text>
                                </View>
                              )}
                              {!q.answered && (
                                <Text style={{ fontSize: 9, color: C.muted }}>Non joué</Text>
                              )}
                              {q.answered && (
                                <Text style={{
                                  fontSize: 10, fontWeight: '700',
                                  color: correct ? C.gold : C.muted,
                                }}>
                                  {correct ? `+${q.score_awarded}` : '+0'} pts
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function TabBtn({ icon, label, active, onPress, badge }: any) {
  return (
    <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={active ? C.gold : C.muted} />
      <Text style={[s.tabTxt, active && s.tabTxtActive]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={s.tabBadge}>
          <Text style={s.tabBadgeTxt}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function AnsBtn({ label, icon, color, disabled, loading, onPress }: any) {
  return (
    <TouchableOpacity
      style={[s.answerBtn, { backgroundColor: color + 'EE' }, disabled && s.answerDis]}
      onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      {loading
        ? <ActivityIndicator color={C.white} size="large" />
        : <Ionicons name={icon} size={32} color={C.white} />}
      <Text style={s.answerBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <View style={s.scorePill}>
      <Ionicons name="trophy-outline" size={11} color={C.gold} />
      <Text style={s.scorePillTxt}>{score} pts</Text>
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
      backgroundColor: color + '22', borderWidth: 1, borderColor: color + '55',
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, sub, actionLabel, onAction, iconColor }: any) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 50, gap: 10 }}>
      <Ionicons name={icon} size={48} color={iconColor || C.muted} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: C.cream, textAlign: 'center' }}>
        {title}
      </Text>
      {sub && (
        <Text style={{
          fontSize: 13, color: C.muted, textAlign: 'center',
          lineHeight: 19, paddingHorizontal: 20,
        }}>
          {sub}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity style={s.actionBtn} onPress={onAction}>
          <Text style={s.actionBtnTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 30 },
  initTitle: { fontSize: 22, fontWeight: '800', color: C.cream, textAlign: 'center' },

  header: {
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn: {
    width: 33, height: 33, borderRadius: 16, backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 1 },
  headerTitle:  { fontSize: 19, fontWeight: '800', color: C.cream },

  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.danger + '18', paddingHorizontal: 14, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: C.danger + '33',
  },
  errorTxt: { flex: 1, color: C.danger, fontSize: 12 },

  tabBar:       { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 3 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabTxt:       { fontSize: 10, color: C.muted, fontWeight: '600' },
  tabTxtActive: { color: C.gold },
  tabBadge:     { backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, position: 'absolute', top: 4, right: 8 },
  tabBadgeTxt:  { fontSize: 9, color: '#000', fontWeight: '800' },

  infoBar:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.info + '15', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: C.info + '33' },
  infoBarTxt: { flex: 1, color: C.info, fontSize: 12, lineHeight: 17 },

  scroll: { padding: 16 },
  sLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 2, marginBottom: 11 },

  card:       { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardLocked: { opacity: 0.5 },
  cardIcon:   { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44', flexShrink: 0 },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 2 },
  cardSub:    { fontSize: 12, color: C.muted },

  pillRow:      { flexDirection: 'row', marginTop: 4 },
  scorePill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: C.gold + '22', borderWidth: 1, borderColor: C.gold + '44' },
  scorePillTxt: { fontSize: 11, fontWeight: '700', color: C.gold },

  joinBtn:    { backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, minWidth: 80, alignItems: 'center' },
  joinBtnTxt: { color: '#000', fontWeight: '800', fontSize: 12 },

  repondreBtn: { backgroundColor: C.info, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 80, alignItems: 'center' },
  repBtnTxt:   { color: C.white, fontWeight: '800', fontSize: 12 },

  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.gold + '22', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 8, borderWidth: 1, borderColor: C.gold + '55' },
  actionBtnTxt: { color: C.gold, fontWeight: '700', fontSize: 13 },

  qCounter:      { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  qCounterTxt:   { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 6 },
  qProgressBar:  { height: 3, backgroundColor: C.border, borderRadius: 2 },
  qProgressFill: { height: 3, backgroundColor: C.gold, borderRadius: 2 },

  questionCard:  { backgroundColor: C.surface, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, marginBottom: 20, alignItems: 'center', gap: 14 },
  scoreBadge:    { backgroundColor: C.gold + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.gold + '55' },
  scoreBadgeTxt: { fontSize: 12, fontWeight: '700', color: C.gold },
  questionTxt:   { fontSize: 20, fontWeight: '700', color: C.cream, lineHeight: 30, textAlign: 'center' },

  answerRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  answerBtn:    { flex: 1, borderRadius: 16, paddingVertical: 32, alignItems: 'center', gap: 8 },
  answerDis:    { opacity: 0.45 },
  answerBtnTxt: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 1 },

  qNav:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  qNavBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  qNavBtnDis: { opacity: 0.35 },
  qNavTxt:    { fontSize: 13, color: C.cream, fontWeight: '600' },

  runCard:  { backgroundColor: C.surface, borderRadius: 13, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border },
  runTitle: { fontSize: 11, fontWeight: '700', color: C.gold, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },

  qRow: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border + '55', alignItems: 'flex-start' },
  dot:  { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1, flexShrink: 0, marginTop: 1 },
  qTxt: { fontSize: 13, color: C.cream, lineHeight: 18, fontWeight: '500' },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },

  totalBand:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.gold + '18', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.gold + '33', marginBottom: 16 },
  totalBandTxt: { color: C.muted, fontSize: 13 },

  pendingBox:   { alignItems: 'center', paddingVertical: 40, gap: 12, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 24, marginTop: 8 },
  pendingTitle: { fontSize: 16, fontWeight: '700', color: C.cream, textAlign: 'center' },
  pendingSub:   { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },
});
