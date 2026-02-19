/**
 * AwaleAdmin.tsx — Design Royal Doré
 * CORRECTIONS :
 *  ✅ Supprimer : modal custom (Alert.alert ne fonctionne pas sur web)
 *  ✅ Onglet Gérer : session → parties + bouton Ajouter party
 *  ✅ Onglet Gérer : party → runs + bouton Ajouter run/question
 *  ✅ Cycle 3 étapes : Démarrer → Lancer → Fermer & Révéler
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Platform,
  ScrollView, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Animated, Switch, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY    = 'vrai_faux';

const haptic = {
  impact:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
};

const C = {
  bg: '#0D0D0F', surface: '#16161A', surfaceHigh: '#1E1E24', border: '#2A2A32',
  gold: '#C9A84C', goldLight: '#E8C96A', cream: '#F5EDD8', muted: '#6B6B7A',
  success: '#2ECC71', danger: '#E74C3C', info: '#3498DB', white: '#FFFFFF',
};

interface AwaleAdminProps { adminEmail: string; adminPassword: string; onBack: () => void; }
interface SessionData { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface PartyData   { id: string; title: string; is_initial: boolean; min_score: number; min_rank: number | null; }
interface RunData     { id: string; title: string; is_visible: boolean; is_closed: boolean; is_started: boolean; }
interface QuestionData{ question_text: string; correct_answer: boolean; score: number; }
interface ModalField  { key: string; label: string; placeholder: string; isBoolean?: boolean; isNumber?: boolean; multiline?: boolean; }
interface ModalConfig { visible: boolean; title: string; subtitle?: string; fields: ModalField[]; onSubmit: (v: Record<string,any>) => void; }
interface ConfirmConfig { visible: boolean; title: string; message: string; onConfirm: () => void; isDestructive?: boolean; }

type Tab = 'create' | 'manage';
type ManageView = 'sessions' | 'parties' | 'runs';

export default function AwaleAdmin({ adminEmail, adminPassword, onBack }: AwaleAdminProps) {
  const [loading,    setLoading]   = useState(false);
  const [activeTab,  setActiveTab] = useState<Tab>('create');

  // État onglet Créer
  const [cSessionId, setCSessionId] = useState('');
  const [cPartyId,   setCPartyId]   = useState('');
  const [cRunId,     setCRunId]     = useState('');
  const [cRunState,  setCRunState]  = useState({ is_started: false, is_visible: false, is_closed: false });
  const [cQuestion,  setCQuestion]  = useState<QuestionData | null>(null);

  // État onglet Gérer
  const [manageView, setManageView] = useState<ManageView>('sessions');
  const [sessions,   setSessions]   = useState<SessionData[]>([]);
  const [parties,    setParties]    = useState<PartyData[]>([]);
  const [runs,       setRuns]       = useState<RunData[]>([]);
  const [selSession, setSelSession] = useState<SessionData | null>(null);
  const [selParty,   setSelParty]   = useState<PartyData   | null>(null);

  // Modals
  const [modal,   setModal]   = useState<ModalConfig>({ visible: false, title: '', fields: [], onSubmit: () => {} });
  const [mVals,   setMVals]   = useState<Record<string,any>>({});
  const [confirm, setConfirm] = useState<ConfirmConfig>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }).start();
  }, []);

  // ─── API ──────────────────────────────────────────────────────────────────
  const api = useCallback(async (fn: string, params: Record<string,any>) => {
    haptic.impact();
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: fn, email: adminEmail, password: adminPassword, ...params }),
      });
      const data = await res.json();
      if (data.success || res.ok) { haptic.success(); return data; }
      haptic.error();
      alert_show('Erreur', data.error || 'Opération échouée', () => {});
      return null;
    } catch {
      haptic.error();
      alert_show('Erreur réseau', 'Impossible de contacter le serveur', () => {});
      return null;
    } finally { setLoading(false); }
  }, [adminEmail, adminPassword]);

  // ─── Confirm / Alert ──────────────────────────────────────────────────────
  const alert_show = (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
    setConfirm({ visible: true, title, message, onConfirm, isDestructive });
  };

  // ─── Modal formulaire ─────────────────────────────────────────────────────
  const openModal = (title: string, fields: ModalField[], onSubmit: (v: Record<string,any>) => void, subtitle?: string) => {
    const d: Record<string,any> = {};
    fields.forEach(f => { d[f.key] = f.isBoolean ? false : f.isNumber ? '10' : ''; });
    setMVals(d);
    setModal({ visible: true, title, subtitle, fields, onSubmit });
  };
  const closeModal  = () => setModal(m => ({ ...m, visible: false }));
  const submitModal = () => {
    const first = modal.fields.find(f => !f.isBoolean && !f.isNumber);
    if (first && !String(mVals[first.key] ?? '').trim()) {
      alert_show('Champ requis', `"${first.label.replace(' *', '')}" est obligatoire.`, () => {});
      return;
    }
    modal.onSubmit(mVals);
    closeModal();
  };

  // ─── CRÉER : étapes ───────────────────────────────────────────────────────
  const doCreateSession = () => openModal('Nouvelle Session', [
    { key: 'title',       label: 'Titre *',     placeholder: 'Ex: Soirée Quiz du vendredi' },
    { key: 'description', label: 'Description', placeholder: 'Optionnel', multiline: true },
    { key: 'is_paid',     label: 'Payante ?',   placeholder: '', isBoolean: true },
    { key: 'price_cfa',   label: 'Prix (CFA)',  placeholder: '500', isNumber: true },
  ], async (v) => {
    const d = await api('createSession', { game_key: GAME_KEY, title: v.title.trim(), description: v.description?.trim() || null, is_paid: v.is_paid, price_cfa: Number(v.price_cfa) || 0 });
    if (d?.session_id) setCSessionId(d.session_id);
  }, 'Étape 1 — Événement principal');

  const doCreateParty = () => {
    if (!cSessionId) { alert_show('Attention', 'Créez d\'abord une session.', () => {}); return; }
    openModal('Nouveau Groupe', [
      { key: 'title',     label: 'Nom *',        placeholder: 'Ex: Groupe Principal' },
      { key: 'min_score', label: 'Score minimum', placeholder: '0', isNumber: true },
      { key: 'min_rank',  label: 'Rang minimum',  placeholder: 'Laisser vide = aucun' },
    ], async (v) => {
      const d = await api('createParty', { session_id: cSessionId, title: v.title.trim(), min_score: Number(v.min_score) || 0, min_rank: v.min_rank ? Number(v.min_rank) : null });
      if (d?.party_id) setCPartyId(d.party_id);
    }, 'Étape 2 — Groupe de joueurs');
  };

  const doCreateQuestion = () => {
    if (!cPartyId) { alert_show('Attention', 'Créez d\'abord un groupe.', () => {}); return; }
    openModal('Nouvelle Question', [
      { key: 'run_title', label: 'Titre de la manche *',   placeholder: 'Ex: Manche 1 — Science' },
      { key: 'question',  label: 'Texte de la question *', placeholder: 'Ex: La Terre est ronde ?', multiline: true },
      { key: 'answer',    label: 'Bonne réponse',          placeholder: '', isBoolean: true },
      { key: 'score',     label: 'Points',                 placeholder: '10', isNumber: true },
    ], async (v) => {
      const runData = await api('createRun', { party_id: cPartyId, title: v.run_title.trim() });
      if (!runData?.run_id) return;
      const qData = await api('addQuestions', { run_id: runData.run_id, questions: [{ question: v.question.trim(), answer: v.answer, score: Number(v.score) || 10 }] });
      if (!qData) return;
      setCRunId(runData.run_id);
      setCRunState({ is_started: false, is_visible: false, is_closed: false });
      setCQuestion({ question_text: v.question.trim(), correct_answer: v.answer, score: Number(v.score) || 10 });
    }, 'Étape 3 — Question + Réponse');
  };

  const runAction = async (action: 'start' | 'publish' | 'close' | 'reopen' | 'stats') => {
    if (!cRunId) return;
    if (action === 'stats') {
      const d = await api('getStatistics', { run_id: cRunId });
      if (d?.statistics) alert_show('📊 Statistiques', `Réponses : ${d.statistics.total_answers}\nJoueurs : ${d.statistics.total_players}`, () => {});
      return;
    }
    const calls: Record<string, [string, Record<string,any>]> = {
      start:   ['setStarted',   { run_id: cRunId, started: true  }],
      publish: ['setVisibility',{ run_id: cRunId, visible: true  }],
      close:   ['closeRun',     { run_id: cRunId, closed: true   }],
      reopen:  ['closeRun',     { run_id: cRunId, closed: false  }],
    };
    const [fn, params] = calls[action];
    const d = await api(fn, params);
    if (d) {
      if (action === 'start')   setCRunState(p => ({ ...p, is_started: true }));
      if (action === 'publish') setCRunState(p => ({ ...p, is_visible: true }));
      if (action === 'close')   setCRunState(p => ({ ...p, is_closed:  true }));
      if (action === 'reopen')  setCRunState({ is_started: true, is_visible: false, is_closed: false });
    }
  };

  // ─── GÉRER : navigation ───────────────────────────────────────────────────
  const loadSessions = async () => {
    const d = await api('listSessions', { game_key: GAME_KEY });
    if (d) { setSessions(d.sessions || []); setManageView('sessions'); setSelSession(null); setSelParty(null); setParties([]); setRuns([]); }
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

  const goBack = () => {
    if (manageView === 'runs')    { setManageView('parties'); setSelParty(null); setRuns([]); }
    if (manageView === 'parties') { setManageView('sessions'); setSelSession(null); setParties([]); }
  };

  const updateRunLocal = (id: string, patch: Partial<RunData>) =>
    setRuns(p => p.map(r => r.id === id ? { ...r, ...patch } : r));

  // Ajouter party depuis Gérer
  const manageAddParty = () => {
    if (!selSession) return;
    openModal('Nouvelle Party', [
      { key: 'title',     label: 'Nom *',        placeholder: 'Ex: VIP, Débutants…' },
      { key: 'min_score', label: 'Score minimum', placeholder: '0', isNumber: true },
      { key: 'min_rank',  label: 'Rang minimum',  placeholder: 'Vide = aucune restriction' },
    ], async (v) => {
      const d = await api('createParty', { session_id: selSession.id, title: v.title.trim(), min_score: Number(v.min_score) || 0, min_rank: v.min_rank ? Number(v.min_rank) : null });
      if (d?.party_id) {
        setParties(p => [...p, { id: d.party_id, title: v.title.trim(), is_initial: false, min_score: Number(v.min_score) || 0, min_rank: v.min_rank ? Number(v.min_rank) : null }]);
      }
    }, `Session : ${selSession.title}`);
  };

  // Ajouter run depuis Gérer
  const manageAddRun = () => {
    if (!selParty) return;
    openModal('Nouvelle Question', [
      { key: 'run_title', label: 'Titre de la manche *',   placeholder: 'Ex: Manche 3' },
      { key: 'question',  label: 'Texte de la question *', placeholder: 'Ex: Paris est en France ?', multiline: true },
      { key: 'answer',    label: 'Bonne réponse',          placeholder: '', isBoolean: true },
      { key: 'score',     label: 'Points',                 placeholder: '10', isNumber: true },
    ], async (v) => {
      const runData = await api('createRun', { party_id: selParty.id, title: v.run_title.trim() });
      if (!runData?.run_id) return;
      const qData = await api('addQuestions', { run_id: runData.run_id, questions: [{ question: v.question.trim(), answer: v.answer, score: Number(v.score) || 10 }] });
      if (!qData) return;
      setRuns(p => [...p, { id: runData.run_id, title: v.run_title.trim(), is_visible: false, is_closed: false, is_started: false }]);
    }, `Groupe : ${selParty.title}`);
  };

  // Supprimer (modal custom — fonctionne sur web)
  const askDelete = (title: string, message: string, onConfirm: () => void) => {
    alert_show(title, message, onConfirm, true);
  };

  const delSession = (s: SessionData) => askDelete('Supprimer ?', `"${s.title}" — tous les groupes et runs seront supprimés.`, async () => {
    const d = await api('deleteSession', { session_id: s.id });
    if (d) setSessions(p => p.filter(x => x.id !== s.id));
  });

  const delParty = (p: PartyData) => {
    if (p.is_initial) { alert_show('Impossible', 'La party initiale ne peut pas être supprimée.', () => {}); return; }
    askDelete('Supprimer ?', `"${p.title}" — tous les runs seront supprimés.`, async () => {
      const d = await api('deleteParty', { party_id: p.id });
      if (d) setParties(prev => prev.filter(x => x.id !== p.id));
    });
  };

  const delRun = (r: RunData) => askDelete('Supprimer ?', `"${r.title}" — action irréversible.`, async () => {
    const d = await api('deleteRun', { run_id: r.id });
    if (d) setRuns(p => p.filter(x => x.id !== r.id));
  });

  const manageRunAction = async (run: RunData, action: 'start' | 'publish' | 'close' | 'reopen' | 'stats') => {
    if (action === 'stats') {
      const d = await api('getStatistics', { run_id: run.id });
      if (d?.statistics) alert_show('📊 ' + run.title, `Réponses : ${d.statistics.total_answers} / ${d.statistics.total_players} joueurs`, () => {});
      return;
    }
    const calls: Record<string, [string, Record<string,any>]> = {
      start:   ['setStarted',    { run_id: run.id, started: true  }],
      publish: ['setVisibility', { run_id: run.id, visible: true  }],
      close:   ['closeRun',      { run_id: run.id, closed: true   }],
      reopen:  ['closeRun',      { run_id: run.id, closed: false  }],
    };
    const [fn, params] = calls[action];
    const d = await api(fn, params);
    if (d) {
      if (action === 'start')   updateRunLocal(run.id, { is_started: true });
      if (action === 'publish') updateRunLocal(run.id, { is_visible: true });
      if (action === 'close')   updateRunLocal(run.id, { is_closed:  true });
      if (action === 'reopen')  updateRunLocal(run.id, { is_closed: false, is_visible: false });
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const hasRun = !!cRunId;

  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* Header */}
        <LinearGradient colors={['#1A1500', '#0D0D0F']} style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.gold} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerBadge}>⚔ ADMINISTRATION</Text>
            <Text style={s.headerTitle}>Vrai ou Faux</Text>
          </View>
          <View style={s.onlineDot} />
        </LinearGradient>

        {/* Tabs */}
        <View style={s.tabRow}>
          {(['create', 'manage'] as Tab[]).map(tab => (
            <TouchableOpacity key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => { setActiveTab(tab); if (tab === 'manage') loadSessions(); }}
            >
              <Ionicons name={tab === 'create' ? 'add-circle-outline' : 'grid-outline'} size={15} color={activeTab === tab ? C.gold : C.muted} />
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab === 'create' ? 'Publier' : 'Gérer'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={s.loadingBar}>
            <ActivityIndicator size="small" color={C.gold} />
            <Text style={s.loadingBarTxt}>Traitement…</Text>
          </View>
        )}

        {/* ═══ ONGLET PUBLIER ═══ */}
        {activeTab === 'create' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Guide */}
            <View style={s.guideCard}>
              <Text style={s.guideTitle}>CYCLE DE PUBLICATION</Text>
              {[
                ['Créer une session',            !!cSessionId],
                ['Créer un groupe de joueurs',   !!cPartyId],
                ['Créer la question + réponse',  hasRun],
                ['Démarrer (préparer)',           cRunState.is_started],
                ['Lancer ! (joueurs voient)',     cRunState.is_visible],
                ['Fermer (scores révélés)',       cRunState.is_closed],
              ].map(([text, done], i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <View style={[s.dot, done ? s.dotDone : s.dotPending]}>
                    {done ? <Ionicons name="checkmark" size={9} color={C.bg} /> : <Text style={s.dotNum}>{i + 1}</Text>}
                  </View>
                  <Text style={{ fontSize: 12, color: done ? C.cream : C.muted }}>{text as string}</Text>
                </View>
              ))}
            </View>

            {/* Étape 1 */}
            <StepCard step={1} done={!!cSessionId} title="Session" sub="L'événement global"
              id={cSessionId} onReset={() => { setCSessionId(''); setCPartyId(''); setCRunId(''); setCQuestion(null); }}
              onAction={doCreateSession} label="Créer la session" />

            {/* Étape 2 */}
            <StepCard step={2} done={!!cPartyId} title="Groupe (Party)" sub="Le groupe de joueurs"
              id={cPartyId} disabled={!cSessionId}
              onReset={() => { setCPartyId(''); setCRunId(''); setCQuestion(null); }}
              onAction={doCreateParty} label="Créer le groupe" />

            {/* Étape 3 */}
            <StepCard step={3} done={hasRun} title="Question" sub="Une question Vrai/Faux avec réponse"
              id={cRunId} disabled={!cPartyId}
              onReset={() => { setCRunId(''); setCQuestion(null); setCRunState({ is_started: false, is_visible: false, is_closed: false }); }}
              onAction={doCreateQuestion} label="Ajouter une question" />

            {/* Aperçu question */}
            {cQuestion && (
              <View style={s.qPreview}>
                <Text style={s.qPreviewLabel}>QUESTION CRÉÉE</Text>
                <Text style={s.qPreviewText}>{cQuestion.question_text}</Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <View style={[s.answerBadge, { backgroundColor: (cQuestion.correct_answer ? C.success : C.danger) + '22', borderColor: (cQuestion.correct_answer ? C.success : C.danger) + '55' }]}>
                    <Ionicons name={cQuestion.correct_answer ? 'checkmark-circle' : 'close-circle'} size={14} color={cQuestion.correct_answer ? C.success : C.danger} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: cQuestion.correct_answer ? C.success : C.danger }}>
                      {cQuestion.correct_answer ? 'VRAI' : 'FAUX'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.gold, fontWeight: '600' }}>⭐ {cQuestion.score} pts</Text>
                </View>
              </View>
            )}

            {/* Contrôles run */}
            {hasRun && (
              <View style={s.ctrlCard}>
                <Text style={s.ctrlLabel}>CONTRÔLES</Text>

                {!cRunState.is_started && !cRunState.is_visible && !cRunState.is_closed && (
                  <PrimaryBtn icon="play-circle-outline" color={C.info}
                    title="Étape 4 — Démarrer" sub="Question prête, invisible aux joueurs"
                    onPress={() => runAction('start')} />
                )}

                {cRunState.is_started && !cRunState.is_visible && !cRunState.is_closed && (
                  <PrimaryBtn icon="eye-outline" color={C.success}
                    title="Étape 5 — Lancer !" sub="Tous les joueurs voient la question maintenant"
                    onPress={() => runAction('publish')} />
                )}

                {cRunState.is_visible && !cRunState.is_closed && (
                  <>
                    <View style={s.liveBanner}>
                      <View style={s.liveDot} />
                      <Text style={s.liveTxt}>EN DIRECT — Les joueurs répondent</Text>
                    </View>
                    <View style={s.row2}>
                      <SmallBtn icon="bar-chart-outline" label="Stats" color={C.info} onPress={() => runAction('stats')} />
                      <SmallBtn icon="lock-closed-outline" label="Fermer & Révéler" color={C.danger} onPress={() => runAction('close')} />
                    </View>
                  </>
                )}

                {cRunState.is_closed && (
                  <>
                    <View style={[s.liveBanner, { backgroundColor: C.gold + '18', borderColor: C.gold + '44' }]}>
                      <Ionicons name="trophy-outline" size={22} color={C.gold} />
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: C.gold }}>Run clôturé</Text>
                        <Text style={{ fontSize: 11, color: C.muted }}>Scores et bonne réponse visibles</Text>
                      </View>
                    </View>
                    <View style={s.row2}>
                      <SmallBtn icon="bar-chart-outline" label="Stats"    color={C.info}  onPress={() => runAction('stats')} />
                      <SmallBtn icon="lock-open-outline"  label="Réouvrir" color={C.gold}  onPress={() => runAction('reopen')} />
                    </View>
                    <TouchableOpacity style={s.nextBtn} onPress={() => { setCRunId(''); setCQuestion(null); setCRunState({ is_started: false, is_visible: false, is_closed: false }); }}>
                      <LinearGradient colors={[C.goldLight, C.gold]} style={s.nextBtnGrad}>
                        <Ionicons name="add-circle-outline" size={19} color={C.bg} />
                        <Text style={{ fontSize: 14, fontWeight: '800', color: C.bg }}>Nouvelle question</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        {/* ═══ ONGLET GÉRER ═══ */}
        {activeTab === 'manage' && (
          <View style={{ flex: 1 }}>
            {/* Breadcrumb */}
            <View style={s.breadcrumb}>
              {manageView !== 'sessions' && (
                <TouchableOpacity onPress={goBack} style={s.breadBack}>
                  <Ionicons name="chevron-back" size={15} color={C.gold} />
                  <Text style={s.breadBackTxt}>Retour</Text>
                </TouchableOpacity>
              )}
              <Text style={s.breadTitle} numberOfLines={1}>
                {manageView === 'sessions' ? 'Sessions' : manageView === 'parties' ? selSession?.title : selParty?.title}
              </Text>
              {/* Refresh ou Ajouter selon niveau */}
              {manageView === 'sessions' ? (
                <TouchableOpacity onPress={loadSessions} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="refresh-outline" size={18} color={C.muted} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={manageView === 'parties' ? manageAddParty : manageAddRun}
                  style={s.addBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="add" size={16} color={C.bg} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              {/* Sessions */}
              {manageView === 'sessions' && (sessions.length === 0
                ? <Empty label="Aucune session" sub="Utilisez l'onglet Publier pour créer votre première session" />
                : sessions.map(sess => (
                    <ManageRow key={sess.id} icon="albums-outline" iconColor={C.gold}
                      title={sess.title} sub={sess.is_paid ? `💰 ${sess.price_cfa} CFA` : 'Gratuit'}
                      onOpen={() => openParties(sess)} onDelete={() => delSession(sess)} />
                  ))
              )}

              {/* Parties */}
              {manageView === 'parties' && (
                <>
                  {parties.length === 0
                    ? <Empty label="Aucun groupe" sub="Appuyez sur + pour en ajouter" />
                    : parties.map(party => (
                        <ManageRow key={party.id} icon="people-outline" iconColor={C.info}
                          title={`${party.title}${party.is_initial ? ' ⭐' : ''}`}
                          sub={party.is_initial ? 'Groupe initial' : `Score min: ${party.min_score}${party.min_rank ? ` · Top ${party.min_rank}` : ''}`}
                          onOpen={() => openRuns(party)}
                          onDelete={party.is_initial ? undefined : () => delParty(party)} />
                      ))
                  }
                  <AddRowButton label="Ajouter un groupe" onPress={manageAddParty} />
                </>
              )}

              {/* Runs */}
              {manageView === 'runs' && (
                <>
                  {runs.length === 0
                    ? <Empty label="Aucun run" sub="Appuyez sur + pour créer une question" />
                    : runs.map(run => (
                        <RunCard key={run.id} run={run}
                          onAction={(a) => manageRunAction(run, a)}
                          onDelete={() => delRun(run)} />
                      ))
                  }
                  <AddRowButton label="Ajouter une question" onPress={manageAddRun} />
                </>
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* ═══ MODAL FORMULAIRE ═══ */}
      <Modal transparent animationType="fade" visible={modal.visible} onRequestClose={closeModal} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
          <View style={s.modalBox}>
            <LinearGradient colors={['#1E1A00', '#16161A']} style={s.mHeader}>
              <Ionicons name="create-outline" size={15} color={C.gold} />
              <View style={{ flex: 1 }}>
                <Text style={s.mTitle}>{modal.title}</Text>
                {modal.subtitle && <Text style={s.mSub}>{modal.subtitle}</Text>}
              </View>
            </LinearGradient>

            <ScrollView style={s.mBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modal.fields.map((f, i) => (
                <View key={f.key} style={{ marginBottom: 12 }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  {f.isBoolean ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[s.answerBadge, { backgroundColor: (mVals[f.key] ? C.success : C.danger) + '22', borderColor: (mVals[f.key] ? C.success : C.danger) + '55' }]}>
                        <Ionicons name={mVals[f.key] ? 'checkmark-circle' : 'close-circle'} size={19} color={mVals[f.key] ? C.success : C.danger} />
                        <Text style={{ fontSize: 13, fontWeight: '800', color: mVals[f.key] ? C.success : C.danger }}>
                          {mVals[f.key] ? 'VRAI' : 'FAUX'}
                        </Text>
                      </View>
                      <Switch value={!!mVals[f.key]} onValueChange={v => setMVals(p => ({ ...p, [f.key]: v }))}
                        thumbColor={mVals[f.key] ? C.success : C.danger}
                        trackColor={{ false: C.danger + '55', true: C.success + '55' }} />
                    </View>
                  ) : (
                    <TextInput
                      style={[s.fieldInput, f.multiline && { minHeight: 75, paddingTop: 10 }]}
                      placeholder={f.placeholder} placeholderTextColor={C.muted}
                      value={String(mVals[f.key] ?? '')} onChangeText={v => setMVals(p => ({ ...p, [f.key]: v }))}
                      keyboardType={f.isNumber ? 'numeric' : 'default'} autoFocus={i === 0}
                      multiline={f.multiline} numberOfLines={f.multiline ? 3 : 1}
                      textAlignVertical={f.multiline ? 'top' : 'center'} />
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={s.mFooter}>
              <TouchableOpacity style={s.mCancel} onPress={closeModal}><Text style={s.mCancelTxt}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={s.mConfirmWrap} onPress={submitModal}>
                <LinearGradient colors={[C.goldLight, C.gold]} style={s.mConfirmGrad}>
                  <Text style={s.mConfirmTxt}>Valider</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ MODAL CONFIRM / ALERT (remplace Alert.alert sur web) ═══ */}
      <Modal transparent animationType="fade" visible={confirm.visible} onRequestClose={() => setConfirm(c => ({ ...c, visible: false }))} statusBarTranslucent>
        <View style={[s.overlay, { justifyContent: 'center' }]}>
          <View style={[s.modalBox, { maxWidth: 340 }]}>
            <View style={[s.mHeader, { backgroundColor: C.surfaceHigh }]}>
              <Ionicons name={confirm.isDestructive ? 'warning-outline' : 'information-circle-outline'} size={16} color={confirm.isDestructive ? C.danger : C.gold} />
              <Text style={[s.mTitle, { flex: 1 }]}>{confirm.title}</Text>
            </View>
            <View style={{ padding: 18 }}>
              <Text style={{ color: C.cream, fontSize: 14, lineHeight: 20 }}>{confirm.message}</Text>
            </View>
            <View style={s.mFooter}>
              {confirm.isDestructive ? (
                <>
                  <TouchableOpacity style={s.mCancel} onPress={() => setConfirm(c => ({ ...c, visible: false }))}>
                    <Text style={s.mCancelTxt}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.mConfirmWrap} onPress={() => { setConfirm(c => ({ ...c, visible: false })); confirm.onConfirm(); }}>
                    <LinearGradient colors={['#E74C3C', '#8B1A1A']} style={s.mConfirmGrad}>
                      <Text style={[s.mConfirmTxt, { color: C.white }]}>Supprimer</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={s.mConfirmWrap} onPress={() => setConfirm(c => ({ ...c, visible: false }))}>
                  <LinearGradient colors={[C.goldLight, C.gold]} style={s.mConfirmGrad}>
                    <Text style={s.mConfirmTxt}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StepCard({ step, done, disabled, title, sub, id, onReset, onAction, label }: any) {
  return (
    <View style={[s.stepCard, disabled && { opacity: 0.35 }]}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 11 }}>
        <View style={[s.dot, done ? s.dotDone : s.dotPending]}>
          {done ? <Ionicons name="checkmark" size={11} color={C.bg} /> : <Text style={s.dotNum}>{step}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.cream }}>{title}</Text>
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{sub}</Text>
        </View>
      </View>
      {done ? (
        <View style={{ flexDirection: 'row', gap: 7 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, borderColor: C.success + '44' }}>
            <Ionicons name="checkmark-circle-outline" size={11} color={C.success} />
            <Text style={{ flex: 1, color: C.success, fontSize: 10, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) }} numberOfLines={1}>{id}</Text>
          </View>
          <TouchableOpacity onPress={onReset} style={{ width: 29, height: 29, borderRadius: 9, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="refresh-outline" size={12} color={C.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onAction} disabled={!!disabled}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: disabled ? C.surfaceHigh : C.gold, paddingVertical: 10, borderRadius: 10 }}>
          <Ionicons name="add-circle-outline" size={14} color={disabled ? C.muted : C.bg} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: disabled ? C.muted : C.bg }}>{label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PrimaryBtn({ icon, color, title, sub, onPress }: any) {
  return (
    <TouchableOpacity style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 8 }} onPress={onPress}>
      <LinearGradient colors={[color + 'EE', color + '99']} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 }}>
        <Ionicons name={icon} size={24} color={C.white} />
        <View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.white, marginBottom: 1 }}>{title}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{sub}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SmallBtn({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: color + '55', backgroundColor: color + '18' }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ManageRow({ icon, iconColor, title, sub, onOpen, onDelete }: any) {
  return (
    <TouchableOpacity style={s.listRow} onPress={onOpen} activeOpacity={0.75}>
      <View style={[s.listIcon, { borderColor: iconColor + '44' }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle}>{title}</Text>
        {sub && <Text style={s.listSub}>{sub}</Text>}
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={{ marginRight: 9 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={15} color={C.danger} />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={14} color={C.muted} />
    </TouchableOpacity>
  );
}

function RunCard({ run, onAction, onDelete }: any) {
  const next = !run.is_started ? 'start' : !run.is_visible && !run.is_closed ? 'publish' : run.is_visible && !run.is_closed ? 'close' : null;
  const nextLabel = next === 'start' ? 'Démarrer' : next === 'publish' ? 'Lancer !' : next === 'close' ? 'Fermer & Révéler' : null;
  const nextColor = next === 'start' ? C.info : next === 'publish' ? C.success : C.danger;

  return (
    <View style={s.runCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
        <Text style={[s.listTitle, { flex: 1, marginBottom: 0 }]} numberOfLines={2}>{run.title}</Text>
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '48%' }}>
          <MiniPill label={run.is_visible ? 'Visible' : 'Caché'}  color={run.is_visible ? C.success : C.muted} />
          <MiniPill label={run.is_closed  ? 'Fermé'  : 'Ouvert'}  color={run.is_closed  ? C.danger  : C.info} />
          {run.is_started && <MiniPill label="Démarré" color={C.gold} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {next && nextLabel && (
          <TouchableOpacity style={[s.runBtn, { borderColor: nextColor + '55', backgroundColor: nextColor + '18' }]} onPress={() => onAction(next)}>
            <Ionicons name={next === 'close' ? 'lock-closed-outline' : next === 'publish' ? 'eye-outline' : 'play-outline'} size={12} color={nextColor} />
            <Text style={[s.runBtnTxt, { color: nextColor }]}>{nextLabel}</Text>
          </TouchableOpacity>
        )}
        {run.is_closed && (
          <TouchableOpacity style={[s.runBtn, { borderColor: C.gold + '55' }]} onPress={() => onAction('reopen')}>
            <Ionicons name="lock-open-outline" size={12} color={C.gold} />
            <Text style={[s.runBtnTxt, { color: C.gold }]}>Réouvrir</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.runBtn, { borderColor: C.info + '44' }]} onPress={() => onAction('stats')}>
          <Ionicons name="bar-chart-outline" size={12} color={C.info} />
          <Text style={[s.runBtnTxt, { color: C.info }]}>Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.runBtn, { borderColor: C.danger + '44' }]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={12} color={C.danger} />
          <Text style={[s.runBtnTxt, { color: C.danger }]}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MiniPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.gold + '55', marginTop: 6 }}>
      <Ionicons name="add-circle-outline" size={17} color={C.gold} />
      <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ label, sub }: { label: string; sub?: string }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 13, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginTop: 6 }}>
      <Ionicons name="cube-outline" size={30} color={C.muted} />
      <Text style={{ color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 9 }}>{label}</Text>
      {sub && <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{sub}</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:       { width: 33, height: 33, borderRadius: 16, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginRight: 10 },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerBadge:   { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 2 },
  headerTitle:   { fontSize: 19, fontWeight: '800', color: C.cream },
  onlineDot:     { width: 9, height: 9, borderRadius: 5, backgroundColor: C.success, marginLeft: 8 },

  tabRow:        { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabText:       { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.gold },

  loadingBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: C.surfaceHigh, borderBottomWidth: 1, borderBottomColor: C.border },
  loadingBarTxt: { color: C.gold, fontSize: 12, fontWeight: '600' },

  scroll: { padding: 16 },

  guideCard:  { backgroundColor: C.surface, borderRadius: 13, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.gold + '33' },
  guideTitle: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 10 },
  dot:        { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  dotDone:    { backgroundColor: C.gold },
  dotPending: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  dotNum:     { color: C.muted, fontSize: 9, fontWeight: '700' },

  stepCard: { backgroundColor: C.surface, borderRadius: 13, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },

  qPreview:     { backgroundColor: C.surfaceHigh, borderRadius: 12, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: C.gold + '44' },
  qPreviewLabel:{ fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 6 },
  qPreviewText: { fontSize: 14, color: C.cream, fontWeight: '600', lineHeight: 20 },
  answerBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },

  ctrlCard:  { backgroundColor: C.surface, borderRadius: 13, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gold + '33' },
  ctrlLabel: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 11 },

  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.success + '18', borderRadius: 11, padding: 11, borderWidth: 1, borderColor: C.success + '44', marginBottom: 9 },
  liveDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  liveTxt:    { flex: 1, color: C.success, fontSize: 12, fontWeight: '600' },

  row2:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  nextBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },

  // Gérer
  breadcrumb:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  breadBack:   { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 9 },
  breadBackTxt:{ color: C.gold, fontSize: 13, fontWeight: '600' },
  breadTitle:  { flex: 1, color: C.cream, fontSize: 14, fontWeight: '700' },
  addBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },

  listRow:  { backgroundColor: C.surface, borderRadius: 11, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center' },
  listIcon: { width: 33, height: 33, borderRadius: 16, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1 },
  listTitle:{ fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 2 },
  listSub:  { fontSize: 11, color: C.muted },

  runCard:   { backgroundColor: C.surface, borderRadius: 11, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  runBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, borderWidth: 1, backgroundColor: C.surfaceHigh },
  runBtnTxt: { fontSize: 11, fontWeight: '700' },

  // Modal
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox:     { width: '100%', maxWidth: 480, backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.gold + '44' },
  mHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  mTitle:       { fontSize: 14, fontWeight: '700', color: C.cream },
  mSub:         { fontSize: 10, color: C.gold, marginTop: 2 },
  mBody:        { padding: 14, maxHeight: 380 },
  fieldLabel:   { fontSize: 9, fontWeight: '700', color: C.gold, marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase' },
  fieldInput:   { backgroundColor: C.surfaceHigh, borderRadius: 9, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 14, color: C.cream, borderWidth: 1, borderColor: C.border },
  mFooter:      { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 4 },
  mCancel:      { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: C.surfaceHigh, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  mCancelTxt:   { color: C.muted, fontWeight: '600', fontSize: 13 },
  mConfirmWrap: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  mConfirmGrad: { paddingVertical: 11, alignItems: 'center' },
  mConfirmTxt:  { color: C.bg, fontWeight: '800', fontSize: 13 },
});
