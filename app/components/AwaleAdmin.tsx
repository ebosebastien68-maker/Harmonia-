/**
 * AwaleAdmin.tsx — Design Royal Doré
 * ✅ Cross-platform : Web · Android · iOS
 * ✅ Conforme backend v2
 * ✅ Zéro Alert.prompt — Modal custom universel
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

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY    = 'vrai_faux';

const haptic = {
  impact:  () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
};

const C = {
  bg: '#0D0D0F', surface: '#16161A', surfaceHigh: '#1E1E24', border: '#2A2A32',
  gold: '#C9A84C', goldLight: '#E8C96A', goldDark: '#9A7A2A',
  cream: '#F5EDD8', muted: '#6B6B7A',
  success: '#2ECC71', danger: '#E74C3C', info: '#3498DB', white: '#FFFFFF',
};

interface AwaleAdminProps { adminEmail: string; adminPassword: string; onBack: () => void; }
interface SessionData { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface PartyData   { id: string; title: string; is_initial: boolean; min_score: number; min_rank: number | null; }
interface RunData     { id: string; title: string; is_visible: boolean; is_closed: boolean; is_started: boolean; }
interface ModalField  { key: string; label: string; placeholder: string; isBoolean?: boolean; isNumber?: boolean; }
interface ModalState  { visible: boolean; title: string; fields: ModalField[]; onSubmit: (v: Record<string,any>) => void; }
type TabKey = 'create' | 'manage';

export default function AwaleAdmin({ adminEmail, adminPassword, onBack }: AwaleAdminProps) {
  const [loading,      setLoading]    = useState(false);
  const [activeTab,    setActiveTab]  = useState<TabKey>('create');
  const [sessionId,    setSessionId]  = useState('');
  const [partyId,      setPartyId]    = useState('');
  const [runId,        setRunId]      = useState('');
  const [sessions,     setSessions]   = useState<SessionData[]>([]);
  const [parties,      setParties]    = useState<PartyData[]>([]);
  const [runs,         setRuns]       = useState<RunData[]>([]);
  const [selSessionId, setSelSession] = useState('');
  const [selPartyId,   setSelParty]   = useState('');
  const [modal,        setModal]      = useState<ModalState>({ visible: false, title: '', fields: [], onSubmit: () => {} });
  const [modalVals,    setModalVals]  = useState<Record<string,any>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // ── API ──────────────────────────────────────────────────────────────────────
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
      Alert.alert('Erreur', data.error || 'Opération échouée');
      return null;
    } catch { Alert.alert('Erreur réseau', 'Impossible de contacter le serveur'); return null; }
    finally  { setLoading(false); }
  }, [adminEmail, adminPassword]);

  // ── Modal ────────────────────────────────────────────────────────────────────
  const openModal = (title: string, fields: ModalField[], onSubmit: (v: Record<string,any>) => void) => {
    const d: Record<string,any> = {};
    fields.forEach(f => { d[f.key] = f.isBoolean ? false : f.isNumber ? '0' : ''; });
    setModalVals(d);
    setModal({ visible: true, title, fields, onSubmit });
  };
  const closeModal  = () => setModal(m => ({ ...m, visible: false }));
  const submitModal = () => { modal.onSubmit(modalVals); closeModal(); };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleCreateSession = () => openModal('Nouvelle Session', [
    { key: 'title',       label: 'Titre *',     placeholder: 'Ex: Soirée Quiz' },
    { key: 'description', label: 'Description', placeholder: 'Optionnel' },
    { key: 'is_paid',     label: 'Payante ?',   placeholder: '', isBoolean: true },
    { key: 'price_cfa',   label: 'Prix (CFA)',  placeholder: '0', isNumber: true },
  ], async (v) => {
    const d = await api('createSession', { game_key: GAME_KEY, title: v.title, description: v.description || null, is_paid: v.is_paid, price_cfa: Number(v.price_cfa) || 0 });
    if (d?.session_id) setSessionId(d.session_id);
  });

  const handleCreateParty = () => {
    if (!sessionId) return Alert.alert('Attention', 'Créez une session d\'abord');
    openModal('Nouvelle Party', [
      { key: 'title',     label: 'Titre *',       placeholder: 'Ex: Groupe A' },
      { key: 'min_score', label: 'Score minimum', placeholder: '0', isNumber: true },
      { key: 'min_rank',  label: 'Rang minimum',  placeholder: 'Vide = aucun' },
    ], async (v) => {
      const d = await api('createParty', { session_id: sessionId, title: v.title, min_score: Number(v.min_score) || 0, min_rank: v.min_rank ? Number(v.min_rank) : null });
      if (d?.party_id) setPartyId(d.party_id);
    });
  };

  const handleCreateRun = () => {
    if (!partyId) return Alert.alert('Attention', 'Créez une party d\'abord');
    openModal('Nouvelle Manche (Run)', [
      { key: 'title', label: 'Titre *', placeholder: 'Ex: Manche 1 — Science' },
    ], async (v) => {
      const d = await api('createRun', { party_id: partyId, title: v.title });
      if (d?.run_id) setRunId(d.run_id);
    });
  };

  const handleAddQuestions = () => {
    if (!runId) return Alert.alert('Attention', 'Créez un run d\'abord');
    const questions = [
      { question: 'La Terre est plate ?',                         answer: false, score: 10 },
      { question: 'Le HTML est un langage de programmation ?',    answer: false, score: 10 },
      { question: 'React Native fonctionne sur iOS et Android ?', answer: true,  score: 20 },
      { question: 'Elon Musk a co-fondé Tesla ?',                 answer: true,  score: 10 },
      { question: 'Le ciel est vert pendant la journée ?',        answer: false, score: 5  },
    ];
    Alert.alert('Injecter les questions', `${questions.length} questions vont être ajoutées.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: async () => {
        const d = await api('addQuestions', { run_id: runId, questions });
        if (d) Alert.alert('✅ Succès', `${d.count} questions ajoutées`);
      }},
    ]);
  };

  const handleVisibility = async (rid: string, visible: boolean) => {
    const d = await api('setVisibility', { run_id: rid, visible });
    if (d) { setRuns(p => p.map(r => r.id === rid ? { ...r, is_visible: visible } : r)); }
  };

  const handleClose = async (rid: string, closed: boolean) => {
    const d = await api('closeRun', { run_id: rid, closed });
    if (d) { setRuns(p => p.map(r => r.id === rid ? { ...r, is_closed: closed } : r)); }
  };

  const handleStats = async (rid: string) => {
    const d = await api('getStatistics', { run_id: rid });
    if (d?.statistics) {
      const s = d.statistics;
      Alert.alert('📊 Statistiques',
        `Titre : ${s.title}\nQuestions : ${s.total_questions}\nRéponses : ${s.total_answers}\nJoueurs : ${s.total_players}\n` +
        `État : ${s.is_closed ? '🔒 Fermé' : '🔓 Ouvert'} | ${s.is_visible ? '👁 Visible' : '🙈 Caché'}`);
    }
  };

  const confirmDelete = (label: string, fn: () => void) =>
    Alert.alert(`Supprimer ${label}`, 'Action irréversible. Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: fn },
    ]);

  // ── Chargement listes ────────────────────────────────────────────────────────
  const loadSessions = async () => {
    const d = await api('listSessions', { game_key: GAME_KEY });
    if (d) { setSessions(d.sessions || []); setSelSession(''); setSelParty(''); setParties([]); setRuns([]); }
  };
  const loadParties = async (sid: string) => {
    setSelSession(sid); setSelParty(''); setParties([]); setRuns([]);
    const d = await api('listParties', { session_id: sid });
    if (d) setParties(d.parties || []);
  };
  const loadRuns = async (pid: string) => {
    setSelParty(pid); setRuns([]);
    const d = await api('listRuns', { party_id: pid });
    if (d) setRuns(d.runs || []);
  };

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* HEADER */}
        <LinearGradient colors={['#1A1500', '#0D0D0F']} style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={20} color={C.gold} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.crownRow}>
              <Ionicons name="shield-checkmark" size={14} color={C.gold} />
              <Text style={styles.headerBadge}>ADMINISTRATION</Text>
            </View>
            <Text style={styles.headerTitle}>Vrai ou Faux</Text>
          </View>
          <View style={styles.onlineDot} />
        </LinearGradient>

        {/* TABS */}
        <View style={styles.tabRow}>
          {(['create', 'manage'] as TabKey[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); if (tab === 'manage') loadSessions(); }}
            >
              <Ionicons name={tab === 'create' ? 'add-circle-outline' : 'settings-outline'} size={15} color={activeTab === tab ? C.gold : C.muted} />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'create' ? 'Créer' : 'Gérer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* LOADING */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={C.gold} />
              <Text style={styles.loadingText}>Traitement…</Text>
            </View>
          </View>
        )}

        {/* ── CRÉER ─────────────────────────────────────────────────────────── */}
        {activeTab === 'create' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <StepCard step={1} done={!!sessionId} title="Session de Jeu" subtitle="L'événement global"
              idValue={sessionId} onReset={() => { setSessionId(''); setPartyId(''); setRunId(''); }}
              onAction={handleCreateSession} actionLabel="Créer une Session" />

            <StepCard step={2} done={!!partyId} disabled={!sessionId} title="Groupe (Party)" subtitle="Le groupe de joueurs"
              idValue={partyId} onReset={() => { setPartyId(''); setRunId(''); }}
              onAction={handleCreateParty} actionLabel="Créer une Party" />

            <StepCard step={3} done={!!runId} disabled={!partyId} title="Manche (Run)" subtitle="Une série de questions"
              idValue={runId} onReset={() => setRunId('')}
              onAction={handleCreateRun} actionLabel="Créer un Run" />

            {!!runId && (
              <View style={styles.controlCard}>
                <Text style={styles.controlTitle}>COMMANDES DU RUN</Text>
                <ControlBtn icon="list-outline"          label="Injecter les questions" color={C.gold}    onPress={handleAddQuestions} />
                <View style={styles.row}>
                  <ControlBtn icon="eye-outline"         label="Rendre visible"         color={C.success} onPress={() => handleVisibility(runId, true)}  half />
                  <ControlBtn icon="eye-off-outline"     label="Masquer"                color={C.muted}   onPress={() => handleVisibility(runId, false)} half />
                </View>
                <View style={styles.row}>
                  <ControlBtn icon="lock-closed-outline" label="Fermer"                 color={C.danger}  onPress={() => handleClose(runId, true)}  half />
                  <ControlBtn icon="lock-open-outline"   label="Réouvrir"               color={C.info}    onPress={() => handleClose(runId, false)} half />
                </View>
                <ControlBtn icon="bar-chart-outline"     label="Statistiques live"      color={C.info}    onPress={() => handleStats(runId)} />
              </View>
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        {/* ── GÉRER ─────────────────────────────────────────────────────────── */}
        {activeTab === 'manage' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <SectionLabel label="Sessions" icon="albums-outline" onRefresh={loadSessions} />
            {sessions.length === 0 && <EmptyRow label="Aucune session — actualisez" />}
            {sessions.map(s => (
              <ManageRow key={s.id} title={s.title} subtitle={s.is_paid ? `💰 ${s.price_cfa} CFA` : 'Gratuit'}
                selected={selSessionId === s.id} onSelect={() => loadParties(s.id)}
                onDelete={() => confirmDelete('la session', async () => {
                  const r = await api('deleteSession', { session_id: s.id });
                  if (r) setSessions(p => p.filter(x => x.id !== s.id));
                })} />
            ))}

            {!!selSessionId && (
              <>
                <SectionLabel label="Parties" icon="people-outline" />
                {parties.length === 0 && <EmptyRow label="Aucune party" />}
                {parties.map(p => (
                  <ManageRow key={p.id} title={p.title} subtitle={p.is_initial ? '⭐ Initiale' : `Score min: ${p.min_score}`}
                    selected={selPartyId === p.id} onSelect={() => loadRuns(p.id)}
                    onDelete={p.is_initial ? undefined : () => confirmDelete('la party', async () => {
                      const r = await api('deleteParty', { party_id: p.id });
                      if (r) setParties(prev => prev.filter(x => x.id !== p.id));
                    })} />
                ))}
              </>
            )}

            {!!selPartyId && (
              <>
                <SectionLabel label="Runs (Manches)" icon="flash-outline" />
                {runs.length === 0 && <EmptyRow label="Aucun run" />}
                {runs.map(r => (
                  <RunManageRow key={r.id} run={r}
                    onVisibility={(v: boolean) => handleVisibility(r.id, v)}
                    onClose={(c: boolean)      => handleClose(r.id, c)}
                    onStats={() => handleStats(r.id)}
                    onDelete={() => confirmDelete('le run', async () => {
                      const res = await api('deleteRun', { run_id: r.id });
                      if (res) setRuns(prev => prev.filter(x => x.id !== r.id));
                    })} />
                ))}
              </>
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </Animated.View>

      {/* ── MODAL cross-platform (zéro Alert.prompt) ───────────────────────── */}
      <Modal transparent animationType="fade" visible={modal.visible} onRequestClose={closeModal} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <LinearGradient colors={['#1E1A00', '#16161A']} style={styles.modalHeader}>
              <Ionicons name="create-outline" size={17} color={C.gold} />
              <Text style={styles.modalTitle}>{modal.title}</Text>
            </LinearGradient>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modal.fields.map((f, i) => (
                <View key={f.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  {f.isBoolean ? (
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>{modalVals[f.key] ? 'Oui' : 'Non'}</Text>
                      <Switch
                        value={!!modalVals[f.key]}
                        onValueChange={v => setModalVals(p => ({ ...p, [f.key]: v }))}
                        thumbColor={modalVals[f.key] ? C.gold : C.muted}
                        trackColor={{ false: C.border, true: C.goldDark }}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={styles.fieldInput}
                      placeholder={f.placeholder}
                      placeholderTextColor={C.muted}
                      value={String(modalVals[f.key] ?? '')}
                      onChangeText={v => setModalVals(p => ({ ...p, [f.key]: v }))}
                      keyboardType={f.isNumber ? 'numeric' : 'default'}
                      autoFocus={i === 0}
                      returnKeyType="next"
                    />
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={closeModal}>
                <Text style={styles.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmWrap} onPress={submitModal}>
                <LinearGradient colors={[C.goldLight, C.gold]} style={styles.modalConfirmGrad}>
                  <Text style={styles.modalConfirmTxt}>Valider</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function StepCard({ step, done, disabled, title, subtitle, idValue, onReset, onAction, actionLabel }: any) {
  return (
    <View style={[SS.stepCard, disabled && SS.stepDisabled]}>
      <View style={SS.stepHeader}>
        <View style={[SS.stepBadge, done ? SS.stepBadgeDone : SS.stepBadgePending]}>
          {done ? <Ionicons name="checkmark" size={13} color={C.bg} /> : <Text style={SS.stepNum}>{step}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={SS.stepTitle}>{title}</Text>
          <Text style={SS.stepSub}>{subtitle}</Text>
        </View>
      </View>
      {done ? (
        <View style={SS.idRow}>
          <View style={SS.idBox}>
            <Ionicons name="key-outline" size={12} color={C.gold} />
            <Text style={SS.idText} numberOfLines={1}>{idValue}</Text>
          </View>
          <TouchableOpacity style={SS.resetBtn} onPress={onReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="refresh-outline" size={15} color={C.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[SS.stepBtn, disabled && SS.stepBtnOff]} onPress={onAction} disabled={!!disabled}>
          <Ionicons name="add-circle-outline" size={16} color={disabled ? C.muted : C.bg} />
          <Text style={[SS.stepBtnTxt, !!disabled && { color: C.muted }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ControlBtn({ icon, label, color, onPress, half }: any) {
  return (
    <TouchableOpacity style={[SS.ctrlBtn, half && SS.ctrlHalf, { borderColor: color + '44' }]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={[SS.ctrlTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ label, icon, onRefresh }: any) {
  return (
    <View style={SS.sectionRow}>
      <Ionicons name={icon} size={13} color={C.gold} />
      <Text style={SS.sectionTxt}>{label}</Text>
      {onRefresh && <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="refresh-outline" size={14} color={C.muted} /></TouchableOpacity>}
    </View>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <View style={SS.emptyRow}><Text style={SS.emptyTxt}>{label}</Text></View>;
}

function ManageRow({ title, subtitle, selected, onSelect, onDelete }: any) {
  return (
    <TouchableOpacity style={[SS.manageRow, selected && SS.manageRowSel]} onPress={onSelect} activeOpacity={0.75}>
      <View style={{ flex: 1 }}>
        <Text style={SS.manageTitle}>{title}</Text>
        <Text style={SS.manageSub}>{subtitle}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {selected && <Ionicons name="chevron-forward" size={14} color={C.gold} />}
        {onDelete && <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="trash-outline" size={14} color={C.danger} /></TouchableOpacity>}
      </View>
    </TouchableOpacity>
  );
}

function RunManageRow({ run, onVisibility, onClose, onStats, onDelete }: any) {
  return (
    <View style={SS.runRow}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={SS.runTitle} numberOfLines={2}>{run.title}</Text>
        <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '50%' }}>
          <Pill label={run.is_visible ? 'Visible' : 'Caché'} color={run.is_visible ? C.success : C.muted} />
          <Pill label={run.is_closed  ? 'Fermé'  : 'Ouvert'} color={run.is_closed  ? C.danger  : C.info}  />
          {run.is_started && <Pill label="Démarré" color={C.gold} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <RBtn icon={run.is_visible ? 'eye-off-outline' : 'eye-outline'}           color={C.gold}   onPress={() => onVisibility(!run.is_visible)} />
        <RBtn icon={run.is_closed  ? 'lock-open-outline' : 'lock-closed-outline'} color={C.info}   onPress={() => onClose(!run.is_closed)} />
        <RBtn icon="bar-chart-outline" color={C.info}   onPress={onStats} />
        <RBtn icon="trash-outline"     color={C.danger} onPress={onDelete} />
      </View>
    </View>
  );
}

function RBtn({ icon, color, onPress }: any) {
  return (
    <TouchableOpacity style={[SS.rBtn, { borderColor: color + '33' }]} onPress={onPress} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <Ionicons name={icon} size={16} color={color} />
    </TouchableOpacity>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[SS.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[SS.pillTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: Platform.OS === 'android' ? 14 : 8, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginRight: 12 },
  headerCenter: { flex: 1, alignItems: 'center' },
  crownRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  headerBadge: { fontSize: 9, fontWeight: '700', color: C.gold, letterSpacing: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.cream },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.success, marginLeft: 12 },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabText: { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.gold },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  loadingBox: { backgroundColor: C.surface, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44' },
  loadingText: { color: C.cream, marginTop: 12, fontSize: 14, fontWeight: '600' },
  scroll: { padding: 16 },
  controlCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.gold + '33' },
  controlTitle: { fontSize: 10, fontWeight: '800', color: C.gold, marginBottom: 14, letterSpacing: 1.5 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 480, backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.gold + '55' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.cream },
  modalBody: { padding: 16, maxHeight: 360 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 9, fontWeight: '700', color: C.gold, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  fieldInput: { backgroundColor: C.surfaceHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 15, color: C.cream, borderWidth: 1, borderColor: C.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 15, color: C.cream },
  modalFooter: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 4 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.surfaceHigh, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalCancelTxt: { color: C.muted, fontWeight: '600', fontSize: 14 },
  modalConfirmWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalConfirmGrad: { paddingVertical: 13, alignItems: 'center' },
  modalConfirmTxt: { color: C.bg, fontWeight: '800', fontSize: 14 },
});

const SS = StyleSheet.create({
  stepCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  stepDisabled: { opacity: 0.4 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepBadgeDone: { backgroundColor: C.gold },
  stepBadgePending: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  stepNum: { color: C.muted, fontSize: 12, fontWeight: '700' },
  stepTitle: { fontSize: 16, fontWeight: '700', color: C.cream, marginBottom: 2 },
  stepSub: { fontSize: 12, color: C.muted },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.gold + '44' },
  idText: { flex: 1, color: C.gold, fontSize: 11, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  resetBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  stepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, paddingVertical: 12, borderRadius: 12 },
  stepBtnOff: { backgroundColor: C.surfaceHigh },
  stepBtnTxt: { fontSize: 14, fontWeight: '700', color: C.bg },
  ctrlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, backgroundColor: C.surfaceHigh, marginBottom: 10 },
  ctrlHalf: { flex: 1, marginBottom: 0 },
  ctrlTxt: { fontSize: 13, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, marginBottom: 8 },
  sectionTxt: { flex: 1, fontSize: 10, fontWeight: '800', color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase' },
  emptyRow: { backgroundColor: C.surface, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  emptyTxt: { color: C.muted, fontSize: 12 },
  manageRow: { backgroundColor: C.surface, borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: C.border },
  manageRowSel: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  manageTitle: { fontSize: 14, fontWeight: '600', color: C.cream },
  manageSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  runRow: { backgroundColor: C.surface, borderRadius: 12, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  runTitle: { fontSize: 14, fontWeight: '600', color: C.cream, flex: 1, marginRight: 8 },
  rBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  pillTxt: { fontSize: 9, fontWeight: '700' },
});
