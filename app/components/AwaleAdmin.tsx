/**
 * AwaleAdmin.tsx — Design Royal Doré
 * ✅ Cross-platform : Web · Android · iOS
 * ✅ Un Run = Une Question avec sa réponse Vrai/Faux
 * ✅ Flux : Créer Run → Ajouter 1 question → Publier → Fermer
 * ✅ Onglet Gérer : navigation Sessions → Parties → Runs
 * ✅ Boutons Supprimer avec mise à jour UI immédiate
 * ✅ Zéro Alert.prompt
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Platform,
  ScrollView, Alert, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Animated, Switch, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY    = 'vrai_faux';

const haptic = {
  impact:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#0D0D0F',
  surface:     '#16161A',
  surfaceHigh: '#1E1E24',
  border:      '#2A2A32',
  gold:        '#C9A84C',
  goldLight:   '#E8C96A',
  goldDark:    '#9A7A2A',
  cream:       '#F5EDD8',
  muted:       '#6B6B7A',
  success:     '#2ECC71',
  danger:      '#E74C3C',
  info:        '#3498DB',
  white:       '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface AwaleAdminProps { adminEmail: string; adminPassword: string; onBack: () => void; }

interface SessionData { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface PartyData   { id: string; title: string; is_initial: boolean; min_score: number; min_rank: number | null; }
interface RunData     { id: string; title: string; is_visible: boolean; is_closed: boolean; is_started: boolean; question?: QuestionData; }
interface QuestionData{ id: string; question_text: string; correct_answer: boolean; score: number; }

interface ModalField  { key: string; label: string; placeholder: string; isBoolean?: boolean; isNumber?: boolean; multiline?: boolean; }
interface ModalState  { visible: boolean; title: string; subtitle?: string; fields: ModalField[]; onSubmit: (v: Record<string,any>) => void; }

type Tab      = 'create' | 'manage';
type ManageV  = 'sessions' | 'parties' | 'runs';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AwaleAdmin({ adminEmail, adminPassword, onBack }: AwaleAdminProps) {
  const [loading,   setLoading]  = useState(false);
  const [activeTab, setActiveTab]= useState<Tab>('create');

  // Flux Créer
  const [cSessionId, setCSessionId] = useState('');
  const [cPartyId,   setCPartyId]   = useState('');
  const [cRun,       setCRun]       = useState<RunData | null>(null);

  // Flux Gérer
  const [manageView,  setManageView]  = useState<ManageV>('sessions');
  const [sessions,    setSessions]    = useState<SessionData[]>([]);
  const [parties,     setParties]     = useState<PartyData[]>([]);
  const [runs,        setRuns]        = useState<RunData[]>([]);
  const [selSession,  setSelSession]  = useState<SessionData | null>(null);
  const [selParty,    setSelParty]    = useState<PartyData   | null>(null);

  // Modal générique
  const [modal,     setModal]    = useState<ModalState>({ visible: false, title: '', fields: [], onSubmit: () => {} });
  const [modalVals, setModalVals]= useState<Record<string,any>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }).start();
  }, []);

  // ─── API ────────────────────────────────────────────────────────────────────
  const api = useCallback(async (fn: string, params: Record<string,any>) => {
    haptic.impact();
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/admin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: fn, email: adminEmail, password: adminPassword, ...params }),
      });
      const data = await res.json();
      if (data.success || res.ok) { haptic.success(); return data; }
      haptic.error();
      Alert.alert('Erreur', data.error || 'Opération échouée');
      return null;
    } catch {
      haptic.error();
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
      return null;
    } finally { setLoading(false); }
  }, [adminEmail, adminPassword]);

  // ─── Modal ──────────────────────────────────────────────────────────────────
  const openModal = (
    title: string,
    fields: ModalField[],
    onSubmit: (v: Record<string,any>) => void,
    subtitle?: string,
  ) => {
    const d: Record<string,any> = {};
    fields.forEach(f => { d[f.key] = f.isBoolean ? false : f.isNumber ? '10' : ''; });
    setModalVals(d);
    setModal({ visible: true, title, subtitle, fields, onSubmit });
  };
  const closeModal  = () => setModal(m => ({ ...m, visible: false }));
  const submitModal = () => {
    const first = modal.fields.find(f => !f.isBoolean && !f.isNumber);
    if (first && !String(modalVals[first.key] ?? '').trim()) {
      return Alert.alert('Champ requis', `Le champ "${first.label.replace(' *','')}" est obligatoire.`);
    }
    modal.onSubmit(modalVals);
    closeModal();
  };

  // ─── ONGLET CRÉER ───────────────────────────────────────────────────────────

  const doCreateSession = () => openModal('Nouvelle Session', [
    { key: 'title',       label: 'Titre *',     placeholder: 'Ex: Soirée Quiz du vendredi' },
    { key: 'description', label: 'Description', placeholder: 'Optionnel' },
    { key: 'is_paid',     label: 'Payante ?',   placeholder: '', isBoolean: true },
    { key: 'price_cfa',   label: 'Prix (CFA)',  placeholder: '500', isNumber: true },
  ], async (v) => {
    const d = await api('createSession', {
      game_key: GAME_KEY,
      title: v.title.trim(),
      description: v.description?.trim() || null,
      is_paid: v.is_paid,
      price_cfa: Number(v.price_cfa) || 0,
    });
    if (d?.session_id) setCSessionId(d.session_id);
  }, 'Étape 1 — Créer l\'événement principal');

  const doCreateParty = () => {
    if (!cSessionId) return Alert.alert('Attention', 'Créez d\'abord une session.');
    openModal('Nouveau Groupe (Party)', [
      { key: 'title',     label: 'Nom du groupe *', placeholder: 'Ex: Groupe Principal' },
      { key: 'min_score', label: 'Score minimum',   placeholder: '0', isNumber: true },
      { key: 'min_rank',  label: 'Rang minimum',    placeholder: 'Laisser vide = aucun' },
    ], async (v) => {
      const d = await api('createParty', {
        session_id: cSessionId,
        title: v.title.trim(),
        min_score: Number(v.min_score) || 0,
        min_rank:  v.min_rank ? Number(v.min_rank) : null,
      });
      if (d?.party_id) setCPartyId(d.party_id);
    }, 'Étape 2 — Groupe de joueurs');
  };

  // Créer run + question en une seule opération
  const doCreateRunWithQuestion = () => {
    if (!cPartyId) return Alert.alert('Attention', 'Créez d\'abord un groupe.');
    openModal('Nouvelle Question', [
      { key: 'run_title', label: 'Titre de la manche *',    placeholder: 'Ex: Manche 1 — Science' },
      { key: 'question',  label: 'Texte de la question *',  placeholder: 'Ex: La Terre est ronde ?', multiline: true },
      { key: 'answer',    label: 'Bonne réponse',           placeholder: '', isBoolean: true },
      { key: 'score',     label: 'Points',                  placeholder: '10', isNumber: true },
    ], async (v) => {
      // 1. Créer le run
      const runData = await api('createRun', { party_id: cPartyId, title: v.run_title.trim() });
      if (!runData?.run_id) return;

      // 2. Ajouter la question avec la réponse
      const qData = await api('addQuestions', {
        run_id: runData.run_id,
        questions: [{ question: v.question.trim(), answer: v.answer, score: Number(v.score) || 10 }],
      });
      if (!qData) return;

      setCRun({
        id: runData.run_id,
        title: v.run_title.trim(),
        is_visible: false,
        is_closed:  false,
        is_started: false,
        question: {
          id: '', // sera mis à jour
          question_text: v.question.trim(),
          correct_answer: v.answer,
          score: Number(v.score) || 10,
        },
      });
    }, 'Étape 3 — Question + Réponse');
  };

  // ÉTAPE 1 — Démarrer (question prête, invisible)
  const doStart = async () => {
    if (!cRun) return;
    const d = await api('setStarted', { run_id: cRun.id, started: true });
    if (d) setCRun(r => r ? { ...r, is_started: true } : r);
  };

  // ÉTAPE 2 — Lancer (top départ, tous les joueurs voient la question)
  const doPublish = async () => {
    if (!cRun) return;
    const d = await api('setVisibility', { run_id: cRun.id, visible: true });
    if (d) setCRun(r => r ? { ...r, is_visible: true } : r);
  };

  // ÉTAPE 3 — Fermer & Révéler (trigger BDD → reveal_answers = true)
  const doClose = async () => {
    if (!cRun) return;
    const d = await api('closeRun', { run_id: cRun.id, closed: true });
    if (d) setCRun(r => r ? { ...r, is_closed: true } : r);
  };

  // Réouvrir
  const doReopen = async () => {
    if (!cRun) return;
    const d = await api('closeRun', { run_id: cRun.id, closed: false });
    if (d) setCRun(r => r ? { ...r, is_closed: false, is_visible: false } : r);
  };

  // Stats
  const doStats = async () => {
    if (!cRun) return;
    const d = await api('getStatistics', { run_id: cRun.id });
    if (d?.statistics) {
      const st = d.statistics;
      Alert.alert('📊 Stats en direct',
        `Réponses reçues : ${st.total_answers}\nJoueurs : ${st.total_players}\nQuestions : ${st.total_questions}`);
    }
  };

  // Nouvelle question (reset du run courant)
  const doNextQuestion = () => setCRun(null);

  // ─── ONGLET GÉRER ───────────────────────────────────────────────────────────

  const loadSessions = async () => {
    const d = await api('listSessions', { game_key: GAME_KEY });
    if (d) {
      setSessions(d.sessions || []);
      setManageView('sessions');
      setSelSession(null); setSelParty(null); setParties([]); setRuns([]);
    }
  };

  const openParties = async (session: SessionData) => {
    setSelSession(session);
    const d = await api('listParties', { session_id: session.id });
    if (d) { setParties(d.parties || []); setManageView('parties'); }
  };

  const openRuns = async (party: PartyData) => {
    setSelParty(party);
    const d = await api('listRuns', { party_id: party.id });
    if (d) { setRuns(d.runs || []); setManageView('runs'); }
  };

  const goManageBack = () => {
    if (manageView === 'runs')    { setManageView('parties'); setSelParty(null); setRuns([]); }
    else if (manageView === 'parties') { setManageView('sessions'); setSelSession(null); setParties([]); }
  };

  const updateRunLocal = (runId: string, patch: Partial<RunData>) =>
    setRuns(prev => prev.map(r => r.id === runId ? { ...r, ...patch } : r));

  const handleVisibility = async (run: RunData, visible: boolean) => {
    const d = await api('setVisibility', { run_id: run.id, visible });
    if (d) updateRunLocal(run.id, { is_visible: visible });
  };

  const handleClose = async (run: RunData, closed: boolean) => {
    const d = await api('closeRun', { run_id: run.id, closed });
    if (d) updateRunLocal(run.id, { is_closed: closed });
  };

  const handleDeleteSession = (session: SessionData) =>
    Alert.alert('Supprimer la session ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const d = await api('deleteSession', { session_id: session.id });
        if (d) { setSessions(p => p.filter(x => x.id !== session.id)); if (selSession?.id === session.id) setManageView('sessions'); }
      }},
    ]);

  const handleDeleteParty = (party: PartyData) => {
    if (party.is_initial) return Alert.alert('Impossible', 'La party initiale ne peut pas être supprimée.');
    Alert.alert('Supprimer le groupe ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const d = await api('deleteParty', { party_id: party.id });
        if (d) setParties(p => p.filter(x => x.id !== party.id));
      }},
    ]);
  };

  const handleDeleteRun = (run: RunData) =>
    Alert.alert('Supprimer ce run ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const d = await api('deleteRun', { run_id: run.id });
        if (d) setRuns(p => p.filter(x => x.id !== run.id));
      }},
    ]);

  const handleStats = async (run: RunData) => {
    const d = await api('getStatistics', { run_id: run.id });
    if (d?.statistics) {
      const st = d.statistics;
      Alert.alert('📊 Statistiques',
        `${run.title}\n\nRéponses : ${st.total_answers}\nJoueurs : ${st.total_players}\n` +
        `Visibilité : ${st.is_visible ? '👁 Visible' : '🙈 Caché'}\n` +
        `État : ${st.is_closed ? '🔒 Fermé' : '🔓 Ouvert'}`);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* HEADER */}
        <LinearGradient colors={['#1A1500', '#0D0D0F']} style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={20} color={C.gold} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <View style={s.crownRow}>
              <Ionicons name="shield-checkmark" size={13} color={C.gold} />
              <Text style={s.headerBadge}>ADMINISTRATION</Text>
            </View>
            <Text style={s.headerTitle}>Vrai ou Faux</Text>
          </View>
          <View style={s.onlineDot} />
        </LinearGradient>

        {/* TABS */}
        <View style={s.tabRow}>
          {(['create', 'manage'] as Tab[]).map(tab => (
            <TouchableOpacity key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => { setActiveTab(tab); if (tab === 'manage') loadSessions(); }}
            >
              <Ionicons
                name={tab === 'create' ? 'add-circle-outline' : 'settings-outline'}
                size={15} color={activeTab === tab ? C.gold : C.muted}
              />
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'create' ? 'Publier' : 'Gérer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* LOADING */}
        {loading && (
          <View style={s.loadingOverlay}>
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color={C.gold} />
              <Text style={s.loadingText}>Traitement…</Text>
            </View>
          </View>
        )}

        {/* ═══════════════ ONGLET PUBLIER ═══════════════ */}
        {activeTab === 'create' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Guide rapide */}
            <View style={s.guideCard}>
              <Text style={s.guideTitle}>Comment publier une question ?</Text>
              <GuideStep n={1} text="Créez une session (événement global)" done={!!cSessionId} />
              <GuideStep n={2} text="Créez un groupe de joueurs"           done={!!cPartyId} />
              <GuideStep n={3} text="Créez une question et sa réponse"     done={!!cRun} />
              <GuideStep n={4} text="Publiez → les joueurs voient la question" done={cRun?.is_visible ?? false} />
              <GuideStep n={5} text="Fermez → les scores s'affichent"     done={cRun?.is_closed ?? false} />
            </View>

            {/* Étape 1 — Session */}
            <StepCard step={1} done={!!cSessionId} title="Session" subtitle="L'événement global"
              idValue={cSessionId}
              onReset={() => { setCSessionId(''); setCPartyId(''); setCRun(null); }}
              onAction={doCreateSession} actionLabel="Créer la session" />

            {/* Étape 2 — Party */}
            <StepCard step={2} done={!!cPartyId} disabled={!cSessionId} title="Groupe (Party)" subtitle="Le groupe de joueurs"
              idValue={cPartyId}
              onReset={() => { setCPartyId(''); setCRun(null); }}
              onAction={doCreateParty} actionLabel="Créer le groupe" />

            {/* Étape 3 — Question */}
            <StepCard step={3} done={!!cRun} disabled={!cPartyId} title="Question du Run" subtitle="Une question avec sa réponse Vrai/Faux"
              idValue={cRun?.id || ''}
              onReset={doNextQuestion}
              onAction={doCreateRunWithQuestion} actionLabel="Ajouter une question" />

            {/* Aperçu de la question créée */}
            {cRun?.question && (
              <View style={s.questionPreview}>
                <Text style={s.questionPreviewLabel}>QUESTION CRÉÉE</Text>
                <Text style={s.questionPreviewText}>{cRun.question.question_text}</Text>
                <View style={s.questionPreviewMeta}>
                  <View style={[s.answerBadge, { backgroundColor: (cRun.question.correct_answer ? C.success : C.danger) + '22', borderColor: (cRun.question.correct_answer ? C.success : C.danger) + '66' }]}>
                    <Ionicons name={cRun.question.correct_answer ? 'checkmark-circle' : 'close-circle'} size={16} color={cRun.question.correct_answer ? C.success : C.danger} />
                    <Text style={[s.answerBadgeTxt, { color: cRun.question.correct_answer ? C.success : C.danger }]}>
                      {cRun.question.correct_answer ? 'VRAI' : 'FAUX'}
                    </Text>
                  </View>
                  <View style={s.scoreBadge}>
                    <Ionicons name="star" size={12} color={C.gold} />
                    <Text style={s.scoreBadgeTxt}>{cRun.question.score} pts</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Étape 4 & 5 — Contrôles de publication */}
            {cRun && (
              <View style={s.publishCard}>
                <Text style={s.publishLabel}>CONTRÔLES DE PUBLICATION</Text>

                {/* ÉTAPE 1 — DÉMARRER (question prête, invisible) */}
                {!cRun.is_started && !cRun.is_visible && !cRun.is_closed && (
                  <TouchableOpacity style={s.publishBtn} onPress={doStart}>
                    <LinearGradient colors={[C.info + 'DD', '#1A5A9A']} style={s.publishBtnGrad}>
                      <Ionicons name="play-circle-outline" size={22} color={C.white} />
                      <View>
                        <Text style={s.publishBtnTitle}>Étape 1 — Démarrer</Text>
                        <Text style={s.publishBtnSub}>La question est prête. Personne ne la voit encore.</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* ÉTAPE 2 — LANCER (top départ simultané) */}
                {cRun.is_started && !cRun.is_visible && !cRun.is_closed && (
                  <TouchableOpacity style={s.publishBtn} onPress={doPublish}>
                    <LinearGradient colors={[C.success + 'DD', '#1A8A4A']} style={s.publishBtnGrad}>
                      <Ionicons name="eye-outline" size={22} color={C.white} />
                      <View>
                        <Text style={s.publishBtnTitle}>Étape 2 — Lancer !</Text>
                        <Text style={s.publishBtnSub}>Tous les joueurs voient la question en même temps</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* EN DIRECT */}
                {cRun.is_visible && !cRun.is_closed && (
                  <>
                    <View style={s.liveCard}>
                      <View style={s.liveDot} />
                      <Text style={s.liveTxt}>Question en direct — les joueurs répondent</Text>
                    </View>

                    <View style={s.controlRow}>
                      <TouchableOpacity style={[s.controlHalf, { borderColor: C.info + '44' }]} onPress={doStats}>
                        <Ionicons name="bar-chart-outline" size={18} color={C.info} />
                        <Text style={[s.controlHalfTxt, { color: C.info }]}>Statistiques</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.controlHalf, { borderColor: C.danger + '44', backgroundColor: C.danger + '18' }]} onPress={doClose}>
                        <Ionicons name="lock-closed-outline" size={18} color={C.danger} />
                        <Text style={[s.controlHalfTxt, { color: C.danger }]}>Étape 3 — Fermer & Révéler</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* FERMÉ */}
                {cRun.is_closed && (
                  <>
                    <View style={s.closedCard}>
                      <Ionicons name="trophy-outline" size={28} color={C.gold} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.closedTitle}>Run clôturé</Text>
                        <Text style={s.closedSub}>Les scores et la bonne réponse sont visibles par les joueurs</Text>
                      </View>
                    </View>

                    <View style={s.controlRow}>
                      <TouchableOpacity style={[s.controlHalf, { borderColor: C.info + '44' }]} onPress={doStats}>
                        <Ionicons name="bar-chart-outline" size={18} color={C.info} />
                        <Text style={[s.controlHalfTxt, { color: C.info }]}>Statistiques</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.controlHalf, { borderColor: C.gold + '44' }]} onPress={doReopen}>
                        <Ionicons name="lock-open-outline" size={18} color={C.gold} />
                        <Text style={[s.controlHalfTxt, { color: C.gold }]}>Réouvrir</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[s.nextQuestionBtn]} onPress={doNextQuestion}>
                      <LinearGradient colors={[C.goldLight, C.gold]} style={s.nextQuestionGrad}>
                        <Ionicons name="add-circle-outline" size={20} color={C.bg} />
                        <Text style={s.nextQuestionTxt}>Nouvelle question</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        {/* ═══════════════ ONGLET GÉRER ═══════════════ */}
        {activeTab === 'manage' && (
          <View style={{ flex: 1 }}>

            {/* Breadcrumb */}
            <View style={s.breadcrumb}>
              {manageView !== 'sessions' && (
                <TouchableOpacity onPress={goManageBack} style={s.breadcrumbBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={16} color={C.gold} />
                  <Text style={s.breadcrumbBackTxt}>Retour</Text>
                </TouchableOpacity>
              )}
              <Text style={s.breadcrumbTitle} numberOfLines={1}>
                {manageView === 'sessions' && 'Toutes les sessions'}
                {manageView === 'parties'  && selSession?.title}
                {manageView === 'runs'     && selParty?.title}
              </Text>
              {manageView === 'sessions' && (
                <TouchableOpacity onPress={loadSessions} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="refresh-outline" size={17} color={C.muted} />
                </TouchableOpacity>
              )}
              {manageView === 'parties' && selSession && (
                <TouchableOpacity onPress={() => openParties(selSession)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="refresh-outline" size={17} color={C.muted} />
                </TouchableOpacity>
              )}
              {manageView === 'runs' && selParty && (
                <TouchableOpacity onPress={() => openRuns(selParty)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="refresh-outline" size={17} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

              {/* ── SESSIONS ── */}
              {manageView === 'sessions' && (
                <>
                  {sessions.length === 0
                    ? <EmptyState label="Aucune session" sub="Utilisez l'onglet Publier pour en créer une" />
                    : sessions.map(sess => (
                        <ManageSessionRow key={sess.id} session={sess}
                          onOpen={() => openParties(sess)}
                          onDelete={() => handleDeleteSession(sess)}
                        />
                      ))
                  }
                </>
              )}

              {/* ── PARTIES ── */}
              {manageView === 'parties' && (
                <>
                  {parties.length === 0
                    ? <EmptyState label="Aucun groupe" />
                    : parties.map(party => (
                        <ManagePartyRow key={party.id} party={party}
                          onOpen={() => openRuns(party)}
                          onDelete={() => handleDeleteParty(party)}
                        />
                      ))
                  }
                </>
              )}

              {/* ── RUNS ── */}
              {manageView === 'runs' && (
                <>
                  {runs.length === 0
                    ? <EmptyState label="Aucun run" sub="Utilisez l'onglet Publier pour créer des questions" />
                    : runs.map(run => (
                        <ManageRunRow key={run.id} run={run}
                          onVisibility={(v) => handleVisibility(run, v)}
                          onClose={(c)      => handleClose(run, c)}
                          onStats={() => handleStats(run)}
                          onDelete={() => handleDeleteRun(run)}
                        />
                      ))
                  }
                </>
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* ── MODAL CROSS-PLATFORM ────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={modal.visible} onRequestClose={closeModal} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalBox}>

            <LinearGradient colors={['#1E1A00', '#16161A']} style={s.modalHeader}>
              <Ionicons name="create-outline" size={17} color={C.gold} />
              <View>
                <Text style={s.modalTitle}>{modal.title}</Text>
                {modal.subtitle && <Text style={s.modalSubtitle}>{modal.subtitle}</Text>}
              </View>
            </LinearGradient>

            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modal.fields.map((f, i) => (
                <View key={f.key} style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  {f.isBoolean ? (
                    <View style={s.switchRow}>
                      <View style={[s.answerToggle, { backgroundColor: (modalVals[f.key] ? C.success : C.danger) + '22', borderColor: (modalVals[f.key] ? C.success : C.danger) + '66' }]}>
                        <Ionicons name={modalVals[f.key] ? 'checkmark-circle' : 'close-circle'} size={22} color={modalVals[f.key] ? C.success : C.danger} />
                        <Text style={[s.switchLabel, { color: modalVals[f.key] ? C.success : C.danger }]}>
                          {modalVals[f.key] ? 'VRAI' : 'FAUX'}
                        </Text>
                      </View>
                      <Switch
                        value={!!modalVals[f.key]}
                        onValueChange={v => setModalVals(p => ({ ...p, [f.key]: v }))}
                        thumbColor={modalVals[f.key] ? C.success : C.danger}
                        trackColor={{ false: C.danger + '55', true: C.success + '55' }}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={[s.fieldInput, f.multiline && s.fieldInputMulti]}
                      placeholder={f.placeholder}
                      placeholderTextColor={C.muted}
                      value={String(modalVals[f.key] ?? '')}
                      onChangeText={v => setModalVals(p => ({ ...p, [f.key]: v }))}
                      keyboardType={f.isNumber ? 'numeric' : 'default'}
                      autoFocus={i === 0}
                      returnKeyType={f.multiline ? 'default' : 'next'}
                      multiline={f.multiline}
                      numberOfLines={f.multiline ? 4 : 1}
                      textAlignVertical={f.multiline ? 'top' : 'center'}
                    />
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalCancel} onPress={closeModal}>
                <Text style={s.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirmWrap} onPress={submitModal}>
                <LinearGradient colors={[C.goldLight, C.gold]} style={s.modalConfirmGrad}>
                  <Text style={s.modalConfirmTxt}>Valider</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function GuideStep({ n, text, done }: { n: number; text: string; done: boolean }) {
  return (
    <View style={gs.row}>
      <View style={[gs.dot, done ? gs.dotDone : gs.dotPending]}>
        {done
          ? <Ionicons name="checkmark" size={10} color={C.bg} />
          : <Text style={gs.dotNum}>{n}</Text>
        }
      </View>
      <Text style={[gs.txt, done && gs.txtDone]}>{text}</Text>
    </View>
  );
}
const gs = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot:        { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  dotDone:    { backgroundColor: C.gold },
  dotPending: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  dotNum:     { color: C.muted, fontSize: 10, fontWeight: '700' },
  txt:        { flex: 1, fontSize: 13, color: C.muted },
  txtDone:    { color: C.cream },
});

function StepCard({ step, done, disabled, title, subtitle, idValue, onReset, onAction, actionLabel }: any) {
  return (
    <View style={[s.stepCard, disabled && s.stepDisabled]}>
      <View style={s.stepHeader}>
        <View style={[s.stepBadge, done ? s.stepBadgeDone : s.stepBadgePending]}>
          {done ? <Ionicons name="checkmark" size={13} color={C.bg} /> : <Text style={s.stepNum}>{step}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>{title}</Text>
          <Text style={s.stepSub}>{subtitle}</Text>
        </View>
      </View>
      {done ? (
        <View style={s.idRow}>
          <View style={s.idBox}>
            <Ionicons name="checkmark-circle-outline" size={12} color={C.success} />
            <Text style={s.idText} numberOfLines={1}>{idValue}</Text>
          </View>
          <TouchableOpacity style={s.resetBtn} onPress={onReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="refresh-outline" size={14} color={C.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[s.stepBtn, disabled && s.stepBtnOff]} onPress={onAction} disabled={!!disabled}>
          <Ionicons name="add-circle-outline" size={16} color={disabled ? C.muted : C.bg} />
          <Text style={[s.stepBtnTxt, !!disabled && { color: C.muted }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({ label, sub }: { label: string; sub?: string }) {
  return (
    <View style={s.emptyState}>
      <Ionicons name="cube-outline" size={34} color={C.muted} />
      <Text style={s.emptyLabel}>{label}</Text>
      {sub && <Text style={s.emptySub}>{sub}</Text>}
    </View>
  );
}

function ManageSessionRow({ session, onOpen, onDelete }: any) {
  return (
    <TouchableOpacity style={s.listRow} onPress={onOpen} activeOpacity={0.75}>
      <View style={s.listRowIcon}>
        <Ionicons name="albums-outline" size={18} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.listRowTitle}>{session.title}</Text>
        <Text style={s.listRowSub}>{session.is_paid ? `💰 ${session.price_cfa} CFA` : 'Gratuit'}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 8 }}>
        <Ionicons name="trash-outline" size={16} color={C.danger} />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

function ManagePartyRow({ party, onOpen, onDelete }: any) {
  return (
    <TouchableOpacity style={s.listRow} onPress={onOpen} activeOpacity={0.75}>
      <View style={s.listRowIcon}>
        <Ionicons name="people-outline" size={18} color={C.info} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.listRowTitle}>{party.title} {party.is_initial ? '⭐' : ''}</Text>
        <Text style={s.listRowSub}>{party.is_initial ? 'Party initiale' : `Score min: ${party.min_score}`}</Text>
      </View>
      {!party.is_initial && (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 8 }}>
          <Ionicons name="trash-outline" size={16} color={C.danger} />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

function ManageRunRow({ run, onVisibility, onClose, onStats, onDelete }: any) {
  return (
    <View style={s.runRow}>
      {/* Titre + badges */}
      <View style={s.runRowTop}>
        <Text style={s.listRowTitle} numberOfLines={2}>{run.title}</Text>
        <View style={s.runBadges}>
          <Pill label={run.is_visible ? 'Visible' : 'Caché'}  color={run.is_visible ? C.success : C.muted} />
          <Pill label={run.is_closed  ? 'Fermé'  : 'Ouvert'}  color={run.is_closed  ? C.danger  : C.info}  />
          {run.is_started && <Pill label="Démarré" color={C.gold} />}
        </View>
      </View>

      {/* Actions rapides */}
      <View style={s.runRowActions}>
        <RunActionBtn
          icon={run.is_visible ? 'eye-off-outline' : 'eye-outline'}
          label={run.is_visible ? 'Masquer' : 'Publier'}
          color={run.is_visible ? C.muted : C.success}
          onPress={() => onVisibility(!run.is_visible)}
        />
        <RunActionBtn
          icon={run.is_closed ? 'lock-open-outline' : 'lock-closed-outline'}
          label={run.is_closed ? 'Réouvrir' : 'Fermer'}
          color={run.is_closed ? C.gold : C.danger}
          onPress={() => onClose(!run.is_closed)}
        />
        <RunActionBtn icon="bar-chart-outline" label="Stats"   color={C.info}   onPress={onStats} />
        <RunActionBtn icon="trash-outline"     label="Supp."   color={C.danger} onPress={onDelete} />
      </View>
    </View>
  );
}

function RunActionBtn({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity
      style={[s.runActionBtn, { borderColor: color + '44' }]}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[s.runActionTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[s.pillTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginRight: 12 },
  headerCenter:  { flex: 1, alignItems: 'center' },
  crownRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  headerBadge:   { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 2 },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: C.cream },
  onlineDot:     { width: 9, height: 9, borderRadius: 5, backgroundColor: C.success, marginLeft: 12 },

  tabRow:        { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabText:       { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.gold },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  loadingBox:     { backgroundColor: C.surface, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44' },
  loadingText:    { color: C.cream, marginTop: 12, fontSize: 14, fontWeight: '600' },

  scroll: { padding: 16 },

  // Guide
  guideCard:  { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gold + '33' },
  guideTitle: { fontSize: 11, fontWeight: '800', color: C.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  // Steps
  stepCard:        { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  stepDisabled:    { opacity: 0.38 },
  stepHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  stepBadge:       { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepBadgeDone:   { backgroundColor: C.gold },
  stepBadgePending:{ backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  stepNum:         { color: C.muted, fontSize: 12, fontWeight: '700' },
  stepTitle:       { fontSize: 15, fontWeight: '700', color: C.cream, marginBottom: 2 },
  stepSub:         { fontSize: 12, color: C.muted },
  idRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idBox:           { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.success + '44' },
  idText:          { flex: 1, color: C.success, fontSize: 11, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  resetBtn:        { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  stepBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, paddingVertical: 12, borderRadius: 12 },
  stepBtnOff:      { backgroundColor: C.surfaceHigh },
  stepBtnTxt:      { fontSize: 14, fontWeight: '700', color: C.bg },

  // Question preview
  questionPreview:      { backgroundColor: C.surfaceHigh, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.gold + '44' },
  questionPreviewLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 8 },
  questionPreviewText:  { fontSize: 15, color: C.cream, fontWeight: '600', lineHeight: 22, marginBottom: 12 },
  questionPreviewMeta:  { flexDirection: 'row', gap: 10, alignItems: 'center' },
  answerBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  answerBadgeTxt:       { fontSize: 12, fontWeight: '800' },
  scoreBadge:           { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scoreBadgeTxt:        { fontSize: 13, color: C.gold, fontWeight: '600' },

  // Publish card
  publishCard:   { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.gold + '33' },
  publishLabel:  { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 14 },
  publishBtn:    { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  publishBtnGrad:{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  publishBtnTitle:{ fontSize: 16, fontWeight: '800', color: C.white, marginBottom: 2 },
  publishBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  liveCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.success + '18', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.success + '44', marginBottom: 12 },
  liveDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.success, shadowColor: C.success, shadowRadius: 4, shadowOpacity: 0.8, elevation: 4 },
  liveTxt:   { flex: 1, color: C.success, fontSize: 13, fontWeight: '600' },

  controlRow:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
  controlHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 12, borderWidth: 1, backgroundColor: C.surfaceHigh },
  controlHalfTxt: { fontSize: 13, fontWeight: '600' },
  controlFull:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, borderWidth: 1, backgroundColor: C.surfaceHigh },
  controlFullTxt: { fontSize: 12, fontWeight: '600' },

  closedCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.gold + '18', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.gold + '44', marginBottom: 12 },
  closedTitle: { fontSize: 14, fontWeight: '800', color: C.gold, marginBottom: 2 },
  closedSub:   { fontSize: 12, color: C.muted },

  nextQuestionBtn:  { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  nextQuestionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  nextQuestionTxt:  { fontSize: 15, fontWeight: '800', color: C.bg },

  // Breadcrumb
  breadcrumb:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  breadcrumbBack:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10 },
  breadcrumbBackTxt: { color: C.gold, fontSize: 13, fontWeight: '600' },
  breadcrumbTitle:   { flex: 1, color: C.cream, fontSize: 14, fontWeight: '700' },

  // List rows
  listRow:      { backgroundColor: C.surface, borderRadius: 12, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center' },
  listRowIcon:  { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: C.border },
  listRowTitle: { fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 2 },
  listRowSub:   { fontSize: 11, color: C.muted },

  runRow:        { backgroundColor: C.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  runRowTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 13, paddingBottom: 8 },
  runBadges:     { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '50%' },
  runRowActions: { flexDirection: 'row', gap: 6, paddingHorizontal: 13, paddingBottom: 12, flexWrap: 'wrap' },
  runActionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, backgroundColor: C.surfaceHigh },
  runActionTxt:  { fontSize: 11, fontWeight: '600' },

  // Misc
  emptyState:  { backgroundColor: C.surface, borderRadius: 14, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyLabel:  { color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 10 },
  emptySub:    { color: C.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },
  pill:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  pillTxt:     { fontSize: 9, fontWeight: '700' },

  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox:        { width: '100%', maxWidth: 480, backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.gold + '55' },
  modalHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:      { fontSize: 16, fontWeight: '700', color: C.cream },
  modalSubtitle:   { fontSize: 11, color: C.gold, marginTop: 2 },
  modalBody:       { padding: 16, maxHeight: 420 },
  fieldWrap:       { marginBottom: 14 },
  fieldLabel:      { fontSize: 9, fontWeight: '700', color: C.gold, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  fieldInput:      { backgroundColor: C.surfaceHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 15, color: C.cream, borderWidth: 1, borderColor: C.border },
  fieldInputMulti: { minHeight: 90, paddingTop: 12 },
  switchRow:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  answerToggle:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  switchLabel:     { fontSize: 15, fontWeight: '800' },
  modalFooter:     { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 4 },
  modalCancel:     { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.surfaceHigh, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalCancelTxt:  { color: C.muted, fontWeight: '600', fontSize: 14 },
  modalConfirmWrap:{ flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalConfirmGrad:{ paddingVertical: 13, alignItems: 'center' },
  modalConfirmTxt: { color: C.bg, fontWeight: '800', fontSize: 14 },
});
