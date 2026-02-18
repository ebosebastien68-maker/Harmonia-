/**
 * AwaleAdmin.tsx
 * Panneau d'administration — Design Royal Doré
 * Conforme au backend v2 (createSession, createParty, createRun,
 * addQuestions, setVisibility, closeRun, getStatistics,
 * listSessions, listParties, listRuns, deleteSession,
 * deleteParty, deleteRun, updateSession, updateParty, updateRun)
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Animated,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const GAME_KEY    = 'vrai_faux';

// ─── Palette Royale ────────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AwaleAdminProps {
  adminEmail: string;
  adminPassword: string;
  onBack: () => void;
}

interface SessionData { id: string; title: string; description?: string; is_paid: boolean; price_cfa: number; }
interface PartyData   { id: string; title: string; is_initial: boolean; min_score: number; min_rank: number | null; }
interface RunData     { id: string; title: string; is_visible: boolean; is_closed: boolean; is_started: boolean; }

type TabKey = 'create' | 'manage';

// ─── Composant principal ───────────────────────────────────────────────────────
export default function AwaleAdmin({ adminEmail, adminPassword, onBack }: AwaleAdminProps) {
  const [loading, setLoading]         = useState(false);
  const [activeTab, setActiveTab]     = useState<TabKey>('create');

  // IDs du flux de création
  const [sessionId, setSessionId]     = useState('');
  const [partyId, setPartyId]         = useState('');
  const [runId, setRunId]             = useState('');

  // Données listées
  const [sessions, setSessions]       = useState<SessionData[]>([]);
  const [parties, setParties]         = useState<PartyData[]>([]);
  const [runs, setRuns]               = useState<RunData[]>([]);

  // IDs sélectionnés dans l'onglet Gérer
  const [selSessionId, setSelSession] = useState('');
  const [selPartyId, setSelParty]     = useState('');
  const [selRunId, setSelRun]         = useState('');

  // Modal générique
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    fields: { key: string; label: string; placeholder: string; isBoolean?: boolean; isNumber?: boolean }[];
    onSubmit: (vals: Record<string, any>) => void;
  }>({ visible: false, title: '', fields: [], onSubmit: () => {} });
  const [modalVals, setModalVals] = useState<Record<string, any>>({});

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // ─── Appel backend ─────────────────────────────────────────────────────────
  const api = useCallback(async (functionName: string, params: Record<string, any>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: functionName, email: adminEmail, password: adminPassword, ...params }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return data;
      }
      Alert.alert('Erreur', data.error || 'Opération échouée');
      return null;
    } catch {
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
      return null;
    } finally {
      setLoading(false);
    }
  }, [adminEmail, adminPassword]);

  // ─── Ouverture modale ──────────────────────────────────────────────────────
  const openModal = (
    title: string,
    fields: typeof modal.fields,
    onSubmit: (vals: Record<string, any>) => void,
  ) => {
    const defaults: Record<string, any> = {};
    fields.forEach(f => { defaults[f.key] = f.isBoolean ? false : f.isNumber ? '0' : ''; });
    setModalVals(defaults);
    setModal({ visible: true, title, fields, onSubmit });
  };

  const submitModal = () => {
    modal.onSubmit(modalVals);
    setModal(m => ({ ...m, visible: false }));
  };

  // ─── CRÉER SESSION ──────────────────────────────────────────────────────────
  const handleCreateSession = () => openModal(
    'Nouvelle Session',
    [
      { key: 'title',       label: 'Titre',       placeholder: 'Ex: Soirée Quiz' },
      { key: 'description', label: 'Description', placeholder: 'Description (optionnel)' },
      { key: 'is_paid',     label: 'Payante ?',   placeholder: '', isBoolean: true },
      { key: 'price_cfa',   label: 'Prix (CFA)',  placeholder: '0', isNumber: true },
    ],
    async (vals) => {
      const data = await api('createSession', {
        game_key:    GAME_KEY,
        title:       vals.title,
        description: vals.description || null,
        is_paid:     vals.is_paid,
        price_cfa:   Number(vals.price_cfa) || 0,
      });
      if (data?.session_id) { setSessionId(data.session_id); }
    },
  );

  // ─── CRÉER PARTY ───────────────────────────────────────────────────────────
  const handleCreateParty = () => {
    if (!sessionId) return Alert.alert('Attention', 'Créez une session d\'abord');
    openModal(
      'Nouvelle Party',
      [
        { key: 'title',     label: 'Titre',         placeholder: 'Ex: Groupe A' },
        { key: 'min_score', label: 'Score minimum', placeholder: '0', isNumber: true },
        { key: 'min_rank',  label: 'Rang minimum',  placeholder: 'Laisser vide = aucun' },
      ],
      async (vals) => {
        const data = await api('createParty', {
          session_id: sessionId,
          title:      vals.title,
          min_score:  Number(vals.min_score) || 0,
          min_rank:   vals.min_rank ? Number(vals.min_rank) : null,
        });
        if (data?.party_id) setPartyId(data.party_id);
      },
    );
  };

  // ─── CRÉER RUN ─────────────────────────────────────────────────────────────
  const handleCreateRun = () => {
    if (!partyId) return Alert.alert('Attention', 'Créez une party d\'abord');
    openModal(
      'Nouvelle Manche (Run)',
      [{ key: 'title', label: 'Titre', placeholder: 'Ex: Manche 1 - Science' }],
      async (vals) => {
        const data = await api('createRun', { party_id: partyId, title: vals.title });
        if (data?.run_id) setRunId(data.run_id);
      },
    );
  };

  // ─── AJOUTER QUESTIONS ─────────────────────────────────────────────────────
  const handleAddQuestions = () => {
    if (!runId) return Alert.alert('Attention', 'Créez un run d\'abord');
    const questions = [
      { question: 'La Terre est plate ?',                          answer: false, score: 10 },
      { question: 'Le HTML est un langage de programmation ?',     answer: false, score: 10 },
      { question: 'React Native fonctionne sur iOS et Android ?',  answer: true,  score: 20 },
      { question: 'Elon Musk a co-fondé Tesla ?',                  answer: true,  score: 10 },
      { question: 'Le ciel est vert pendant la journée ?',         answer: false, score: 5  },
    ];
    Alert.alert(
      'Injecter les questions',
      `${questions.length} questions vont être ajoutées au run.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const data = await api('addQuestions', { run_id: runId, questions });
            if (data) Alert.alert('✅ Succès', `${data.count} questions ajoutées`);
          },
        },
      ],
    );
  };

  // ─── VISIBILITÉ / FERMETURE RUN ────────────────────────────────────────────
  const handleVisibility = async (rid: string, visible: boolean) => {
    const data = await api('setVisibility', { run_id: rid, visible });
    if (data) {
      setSessions(s => s);
      loadRuns(selPartyId);
      Alert.alert('✅', visible ? 'Run maintenant visible' : 'Run masqué');
    }
  };

  const handleClose = async (rid: string, closed: boolean) => {
    const data = await api('closeRun', { run_id: rid, closed });
    if (data) {
      loadRuns(selPartyId);
      Alert.alert('✅', closed ? 'Run fermé' : 'Run réouvert');
    }
  };

  // ─── STATISTIQUES ─────────────────────────────────────────────────────────
  const handleStats = async (rid: string) => {
    const data = await api('getStatistics', { run_id: rid });
    if (data?.statistics) {
      const s = data.statistics;
      Alert.alert(
        '📊 Statistiques',
        `Titre : ${s.title}\n` +
        `Questions : ${s.total_questions}\n` +
        `Réponses : ${s.total_answers}\n` +
        `Joueurs : ${s.total_players}\n` +
        `État : ${s.is_closed ? '🔒 Fermé' : '🔓 Ouvert'} | ${s.is_visible ? '👁 Visible' : '🙈 Caché'}`,
      );
    }
  };

  // ─── SUPPRESSION ──────────────────────────────────────────────────────────
  const confirmDelete = (label: string, fn: () => void) => {
    Alert.alert(
      `Supprimer ${label}`,
      'Cette action est irréversible. Confirmer ?',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: fn }],
    );
  };

  // ─── CHARGEMENT LISTES ────────────────────────────────────────────────────
  const loadSessions = async () => {
    const data = await api('listSessions', { game_key: GAME_KEY });
    if (data) setSessions(data.sessions || []);
  };

  const loadParties = async (sid: string) => {
    setSelSession(sid); setSelParty(''); setSelRun('');
    setParties([]); setRuns([]);
    const data = await api('listParties', { session_id: sid });
    if (data) setParties(data.parties || []);
  };

  const loadRuns = async (pid: string) => {
    setSelParty(pid); setSelRun('');
    setRuns([]);
    const data = await api('listRuns', { party_id: pid });
    if (data) setRuns(data.runs || []);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* HEADER ROYAL */}
      <LinearGradient colors={['#1A1500', '#0D0D0F']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.gold} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.crownRow}>
            <Ionicons name="shield-checkmark" size={18} color={C.gold} />
            <Text style={styles.headerBadge}>ADMINISTRATION</Text>
          </View>
          <Text style={styles.headerTitle}>Vrai ou Faux</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.onlineDot} />
        </View>
      </LinearGradient>

      {/* TABS */}
      <View style={styles.tabRow}>
        {(['create', 'manage'] as TabKey[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); if (tab === 'manage') loadSessions(); }}
          >
            <Ionicons
              name={tab === 'create' ? 'add-circle-outline' : 'settings-outline'}
              size={16}
              color={activeTab === tab ? C.gold : C.muted}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'create' ? 'Créer' : 'Gérer'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LOADING OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.gold} />
            <Text style={styles.loadingText}>Traitement…</Text>
          </View>
        </View>
      )}

      {/* ── ONGLET CRÉER ─────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ÉTAPE 1 */}
          <StepCard
            step={1}
            done={!!sessionId}
            title="Session de Jeu"
            subtitle="L'événement global (ex : Soirée Quiz)"
            idValue={sessionId}
            onReset={() => { setSessionId(''); setPartyId(''); setRunId(''); }}
            onAction={handleCreateSession}
            actionLabel="Créer une Session"
          />

          {/* ÉTAPE 2 */}
          <StepCard
            step={2}
            done={!!partyId}
            disabled={!sessionId}
            title="Groupe (Party)"
            subtitle="Le groupe de joueurs pour cette session"
            idValue={partyId}
            onReset={() => { setPartyId(''); setRunId(''); }}
            onAction={handleCreateParty}
            actionLabel="Créer une Party"
          />

          {/* ÉTAPE 3 */}
          <StepCard
            step={3}
            done={!!runId}
            disabled={!partyId}
            title="Manche (Run)"
            subtitle="Une série de questions indépendante"
            idValue={runId}
            onReset={() => setRunId('')}
            onAction={handleCreateRun}
            actionLabel="Créer un Run"
          />

          {/* CONTRÔLES RUN */}
          {runId !== '' && (
            <View style={styles.controlCard}>
              <Text style={styles.controlTitle}>Commandes du Run</Text>

              <ControlBtn icon="list-outline"   label="Injecter les questions" color={C.gold}    onPress={handleAddQuestions} />
              <View style={styles.row}>
                <ControlBtn icon="eye-outline"     label="Rendre visible"    color={C.success} onPress={() => handleVisibility(runId, true)}  half />
                <ControlBtn icon="eye-off-outline" label="Masquer"           color={C.muted}   onPress={() => handleVisibility(runId, false)} half />
              </View>
              <View style={styles.row}>
                <ControlBtn icon="lock-closed-outline" label="Fermer"     color={C.danger} onPress={() => handleClose(runId, true)}  half />
                <ControlBtn icon="lock-open-outline"   label="Réouvrir"   color={C.info}   onPress={() => handleClose(runId, false)} half />
              </View>
              <ControlBtn icon="bar-chart-outline" label="Voir les statistiques" color={C.info} onPress={() => handleStats(runId)} />
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── ONGLET GÉRER ─────────────────────────────────────────────────── */}
      {activeTab === 'manage' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* SESSIONS */}
          <SectionLabel label="Sessions" icon="albums-outline" onRefresh={loadSessions} />
          {sessions.length === 0 && <EmptyRow label="Aucune session" />}
          {sessions.map(s => (
            <ManageRow
              key={s.id}
              title={s.title}
              subtitle={s.is_paid ? `💰 ${s.price_cfa} CFA` : 'Gratuit'}
              selected={selSessionId === s.id}
              onSelect={() => loadParties(s.id)}
              onDelete={() => confirmDelete('la session', async () => {
                const r = await api('deleteSession', { session_id: s.id });
                if (r) { setSessions(prev => prev.filter(x => x.id !== s.id)); }
              })}
            />
          ))}

          {/* PARTIES */}
          {selSessionId !== '' && (
            <>
              <SectionLabel label="Parties" icon="people-outline" />
              {parties.length === 0 && <EmptyRow label="Aucune party" />}
              {parties.map(p => (
                <ManageRow
                  key={p.id}
                  title={p.title}
                  subtitle={p.is_initial ? '⭐ Initiale' : `Score min: ${p.min_score}`}
                  selected={selPartyId === p.id}
                  onSelect={() => loadRuns(p.id)}
                  onDelete={p.is_initial ? undefined : () => confirmDelete('la party', async () => {
                    const r = await api('deleteParty', { party_id: p.id });
                    if (r) setParties(prev => prev.filter(x => x.id !== p.id));
                  })}
                />
              ))}
            </>
          )}

          {/* RUNS */}
          {selPartyId !== '' && (
            <>
              <SectionLabel label="Runs (Manches)" icon="flash-outline" />
              {runs.length === 0 && <EmptyRow label="Aucun run" />}
              {runs.map(r => (
                <RunManageRow
                  key={r.id}
                  run={r}
                  onVisibility={(v) => handleVisibility(r.id, v)}
                  onClose={(c) => handleClose(r.id, c)}
                  onStats={() => handleStats(r.id)}
                  onDelete={() => confirmDelete('le run', async () => {
                    const res = await api('deleteRun', { run_id: r.id });
                    if (res) setRuns(prev => prev.filter(x => x.id !== r.id));
                  })}
                />
              ))}
            </>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── MODAL SAISIE ─────────────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={modal.visible} onRequestClose={() => setModal(m => ({ ...m, visible: false }))}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <LinearGradient colors={['#1E1A00', '#16161A']} style={styles.modalHeader}>
              <Ionicons name="create-outline" size={20} color={C.gold} />
              <Text style={styles.modalTitle}>{modal.title}</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              {modal.fields.map(f => (
                <View key={f.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  {f.isBoolean ? (
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>{modalVals[f.key] ? 'Oui' : 'Non'}</Text>
                      <Switch
                        value={!!modalVals[f.key]}
                        onValueChange={v => setModalVals(prev => ({ ...prev, [f.key]: v }))}
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
                      onChangeText={v => setModalVals(prev => ({ ...prev, [f.key]: v }))}
                      keyboardType={f.isNumber ? 'numeric' : 'default'}
                      autoFocus={modal.fields[0].key === f.key}
                    />
                  )}
                </View>
              ))}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModal(m => ({ ...m, visible: false }))}>
                <Text style={styles.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={submitModal}>
                <LinearGradient colors={[C.goldLight, C.gold]} style={styles.modalConfirmGrad}>
                  <Text style={styles.modalConfirmTxt}>Valider</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  );
}

// ─── Sous-composants ───────────────────────────────────────────────────────────

function StepCard({ step, done, disabled, title, subtitle, idValue, onReset, onAction, actionLabel }: any) {
  return (
    <View style={[styles.stepCard, disabled && styles.stepDisabled]}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, done ? styles.stepBadgeDone : styles.stepBadgePending]}>
          {done
            ? <Ionicons name="checkmark" size={14} color={C.bg} />
            : <Text style={styles.stepBadgeNum}>{step}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepSub}>{subtitle}</Text>
        </View>
      </View>

      {done ? (
        <View style={styles.idRow}>
          <View style={styles.idBox}>
            <Ionicons name="key-outline" size={14} color={C.gold} />
            <Text style={styles.idText} numberOfLines={1}>{idValue}</Text>
          </View>
          <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
            <Ionicons name="refresh-outline" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.stepBtn, disabled && styles.stepBtnOff]}
          onPress={onAction}
          disabled={disabled}
        >
          <Ionicons name="add-circle-outline" size={18} color={disabled ? C.muted : C.bg} />
          <Text style={[styles.stepBtnTxt, disabled && { color: C.muted }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ControlBtn({ icon, label, color, onPress, half }: any) {
  return (
    <TouchableOpacity style={[styles.ctrlBtn, half && styles.ctrlHalf, { borderColor: color + '44' }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.ctrlTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ label, icon, onRefresh }: any) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={16} color={C.gold} />
      <Text style={styles.sectionLabelTxt}>{label}</Text>
      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={16} color={C.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyTxt}>{label}</Text>
    </View>
  );
}

function ManageRow({ title, subtitle, selected, onSelect, onDelete }: any) {
  return (
    <TouchableOpacity style={[styles.manageRow, selected && styles.manageRowSel]} onPress={onSelect}>
      <View style={{ flex: 1 }}>
        <Text style={styles.manageTitle}>{title}</Text>
        <Text style={styles.manageSub}>{subtitle}</Text>
      </View>
      <View style={styles.manageActions}>
        {selected && <Ionicons name="chevron-forward" size={16} color={C.gold} />}
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function RunManageRow({ run, onVisibility, onClose, onStats, onDelete }: any) {
  return (
    <View style={styles.runRow}>
      <View style={styles.runRowTop}>
        <Text style={styles.runTitle}>{run.title}</Text>
        <View style={styles.runBadges}>
          <StatusPill label={run.is_visible ? 'Visible' : 'Caché'}   color={run.is_visible ? C.success : C.muted} />
          <StatusPill label={run.is_closed  ? 'Fermé'  : 'Ouvert'}   color={run.is_closed  ? C.danger  : C.info}  />
          {run.is_started && <StatusPill label="Démarré" color={C.gold} />}
        </View>
      </View>
      <View style={styles.runActions}>
        <RunBtn icon={run.is_visible ? 'eye-off-outline' : 'eye-outline'} color={C.gold}    onPress={() => onVisibility(!run.is_visible)} />
        <RunBtn icon={run.is_closed  ? 'lock-open-outline' : 'lock-closed-outline'} color={C.info}    onPress={() => onClose(!run.is_closed)} />
        <RunBtn icon="bar-chart-outline"  color={C.info}    onPress={onStats} />
        <RunBtn icon="trash-outline"      color={C.danger}  onPress={onDelete} />
      </View>
    </View>
  );
}

function RunBtn({ icon, color, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.runBtn, { borderColor: color + '33' }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={color} />
    </TouchableOpacity>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.pillTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header:       { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  headerCenter: { flex: 1, alignItems: 'center' },
  crownRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  headerBadge:  { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: C.cream, letterSpacing: 0.5 },
  headerRight:  { width: 38, alignItems: 'center' },
  onlineDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.success, shadowColor: C.success, shadowRadius: 4, shadowOpacity: 0.8, elevation: 4 },

  // Tabs
  tabRow:       { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabText:      { fontSize: 14, fontWeight: '600', color: C.muted },
  tabTextActive:{ color: C.gold },

  // Loading
  loadingOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  loadingBox:    { backgroundColor: C.surface, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.gold + '44' },
  loadingText:   { color: C.cream, marginTop: 12, fontSize: 14, fontWeight: '600' },

  scroll: { padding: 16 },

  // Step Cards
  stepCard:     { backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  stepDisabled: { opacity: 0.45 },
  stepHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  stepBadge:    { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  stepBadgeDone:   { backgroundColor: C.gold },
  stepBadgePending:{ backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  stepBadgeNum: { color: C.muted, fontSize: 13, fontWeight: '700' },
  stepTitle:    { fontSize: 17, fontWeight: '700', color: C.cream, marginBottom: 2 },
  stepSub:      { fontSize: 13, color: C.muted },
  idRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idBox:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.gold + '44' },
  idText:       { flex: 1, color: C.gold, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  resetBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  stepBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, paddingVertical: 13, borderRadius: 12 },
  stepBtnOff:   { backgroundColor: C.surfaceHigh },
  stepBtnTxt:   { fontSize: 15, fontWeight: '700', color: C.bg },

  // Control card
  controlCard:  { backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.gold + '33' },
  controlTitle: { fontSize: 15, fontWeight: '700', color: C.gold, marginBottom: 14, letterSpacing: 0.5 },
  row:          { flexDirection: 'row', gap: 10, marginBottom: 10 },
  ctrlBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, backgroundColor: C.surfaceHigh, marginBottom: 10 },
  ctrlHalf:     { flex: 1, marginBottom: 0 },
  ctrlTxt:      { fontSize: 14, fontWeight: '600' },

  // Manage tab
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  sectionLabelTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: C.gold, letterSpacing: 1, textTransform: 'uppercase' },
  refreshBtn:      { padding: 4 },
  emptyRow:        { backgroundColor: C.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  emptyTxt:        { color: C.muted, fontSize: 13 },

  manageRow:     { backgroundColor: C.surface, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: C.border },
  manageRowSel:  { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  manageTitle:   { fontSize: 15, fontWeight: '600', color: C.cream },
  manageSub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  manageActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteBtn:     { padding: 6 },

  runRow:        { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  runRowTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  runTitle:      { fontSize: 15, fontWeight: '600', color: C.cream, flex: 1, marginRight: 8 },
  runBadges:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  runActions:    { flexDirection: 'row', gap: 8 },
  runBtn:        { width: 38, height: 38, borderRadius: 10, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  pill:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pillTxt:       { fontSize: 10, fontWeight: '700' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox:      { width: '100%', backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.gold + '55' },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: C.cream },
  modalBody:     { padding: 20 },
  fieldWrap:     { marginBottom: 16 },
  fieldLabel:    { fontSize: 12, fontWeight: '600', color: C.gold, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldInput:    { backgroundColor: C.surfaceHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.cream, borderWidth: 1, borderColor: C.border },
  switchRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel:   { fontSize: 15, color: C.cream },
  modalFooter:   { flexDirection: 'row', gap: 10, padding: 20, paddingTop: 0 },
  modalCancel:   { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.surfaceHigh, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalCancelTxt:{ color: C.muted, fontWeight: '600', fontSize: 15 },
  modalConfirm:  { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalConfirmGrad:{ paddingVertical: 14, alignItems: 'center' },
  modalConfirmTxt:{ color: C.bg, fontWeight: '800', fontSize: 15 },
});
