/**
 * AdminAwale.tsx — Interface d'administration Awalé
 *
 * VUES :
 *   1. Liste des sessions → créer / modifier / supprimer / voir joueurs
 *   2. Détail session    → liste des runs + créer run #1 + lancer
 *   3. Détail run        → liste des matchs (joueur vs joueur, statut)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:         '#F0FAF4',
  surface:    '#FFFFFF',
  border:     '#D4EAD8',
  green:      '#059669',
  greenLight: '#10B981',
  greenDark:  '#047857',
  gold:       '#D97706',
  danger:     '#DC2626',
  muted:      '#6B7280',
  text:       '#111827',
  textSoft:   '#374151',
  created:    '#7C3AED',
  launched:   '#2563EB',
  finished:   '#059669',
  white:      '#FFFFFF',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type View = 'sessions' | 'runs' | 'matches';

interface Session {
  id: string; title: string; description?: string;
  is_paid: boolean; price_cfa: number;
  party_id: string | null;
  players_count: number; runs_count: number;
}
interface Run {
  id: string; run_number: number; title: string;
  status: 'created' | 'launched' | 'finished';
  prep_time_seconds: number; turn_time_seconds: number;
  launched_at?: string; finished_at?: string;
  matches_total: number; matches_finished: number;
}
interface Match {
  id: string; finished: boolean;
  player1: { id: string; name: string };
  player2: { id: string; name: string };
  winner: { id: string; name: string } | null;
}

interface AdminAwaleProps {
  adminEmail:    string;
  adminPassword: string;
  onBack:        () => void;
}

export default function AdminAwale({ adminEmail, adminPassword, onBack }: AdminAwaleProps) {

  // ─── Navigation ─────────────────────────────────────────────────────────
  const [view,        setView]        = useState<View>('sessions');
  const [selSession,  setSelSession]  = useState<Session | null>(null);
  const [selRun,      setSelRun]      = useState<Run | null>(null);

  // ─── Données ────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([]);
  const [runs,     setRuns]     = useState<Run[]>([]);
  const [matches,  setMatches]  = useState<Match[]>([]);
  const [partyId,  setPartyId]  = useState<string | null>(null);

  // ─── UI ─────────────────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,        setError]        = useState('');

  // ─── Formulaire session ──────────────────────────────────────────────────
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession,  setEditingSession]  = useState<Session | null>(null);
  const [formTitle,       setFormTitle]       = useState('');
  const [formDesc,        setFormDesc]        = useState('');
  const [formIsPaid,      setFormIsPaid]      = useState(false);
  const [formPrice,       setFormPrice]       = useState('');

  // ─── Formulaire run ──────────────────────────────────────────────────────
  const [showRunForm,  setShowRunForm]  = useState(false);
  const [runTitle,     setRunTitle]     = useState('');
  const [runPrep,      setRunPrep]      = useState('10');
  const [runTurn,      setRunTurn]      = useState('30');

  // ─── Modifier un run ────────────────────────────────────────────────────
  const [editingRun,   setEditingRun]   = useState<Run | null>(null);
  const [editRunPrep,  setEditRunPrep]  = useState('');
  const [editRunTurn,  setEditRunTurn]  = useState('');

  // ─── API ─────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const res = await fetch(`${BACKEND_URL}/admin-awale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:    adminEmail,
        password: adminPassword,
        ...body,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.details
        ? `${data?.error || 'Erreur'} — ${data.details}`
        : (data?.error || `Erreur ${res.status}`)
      );
    }
    return data;
  }, [adminEmail, adminPassword]);

  // ─── Chargements ────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'listSessions' });
      setSessions(data.sessions || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadRuns = useCallback(async (sessionId: string) => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'listRuns', session_id: sessionId });
      setRuns(data.runs || []);
      setPartyId(data.party_id || null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadMatches = useCallback(async (runId: string) => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'listMatches', run_id: runId });
      setMatches(data.matches || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const submitMatchResult = async (matchId: string, winnerId: string, winnerName: string) => {
    const msg = `Désigner "${winnerName}" comme gagnant ? Cette action est irréversible.`;
    const doSubmit = async () => {
      setActionLoading(`win-${matchId}-${winnerId}`); setError('');
      try {
        await api({ function: 'submitMatchResult', match_id: matchId, winner_id: winnerId });
        if (selRun) await loadMatches(selRun.id);
      } catch (e: any) { setError(e.message); }
      finally { setActionLoading(null); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doSubmit();
    } else {
      Alert.alert('Confirmer ?', msg, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: doSubmit },
      ]);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  // ─── Actions sessions ────────────────────────────────────────────────────
  const openSessionForm = (session?: Session) => {
    if (session) {
      setEditingSession(session);
      setFormTitle(session.title);
      setFormDesc(session.description || '');
      setFormIsPaid(session.is_paid);
      setFormPrice(String(session.price_cfa));
    } else {
      setEditingSession(null);
      setFormTitle(''); setFormDesc('');
      setFormIsPaid(false); setFormPrice('');
    }
    setShowSessionForm(true);
  };

  const submitSessionForm = async () => {
    if (!formTitle.trim()) return setError('Le titre est requis');
    setActionLoading('session-form'); setError('');
    try {
      if (editingSession) {
        await api({
          function: 'updateSession', session_id: editingSession.id,
          title: formTitle, description: formDesc,
          is_paid: formIsPaid, price_cfa: Number(formPrice) || 0,
        });
      } else {
        await api({
          function: 'createSession',
          title: formTitle, description: formDesc,
          is_paid: formIsPaid, price_cfa: Number(formPrice) || 0,
        });
      }
      setShowSessionForm(false);
      await loadSessions();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const confirmDelete = (session: Session) => {
    const msg = `Supprimer "${session.title}" ? Cette action est irréversible.`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      deleteSession(session.id);
    } else {
      Alert.alert('Supprimer ?', msg, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteSession(session.id) },
      ]);
    }
  };

  const deleteSession = async (id: string) => {
    setActionLoading(`del-${id}`); setError('');
    try {
      await api({ function: 'deleteSession', session_id: id });
      await loadSessions();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const openSession = (session: Session) => {
    setSelSession(session);
    setView('runs');
    loadRuns(session.id);
  };

  // ─── Actions runs ────────────────────────────────────────────────────────
  const submitRunForm = async () => {
    if (!runTitle.trim()) return setError('Le titre du run est requis');
    if (!partyId)         return setError('Aucune party liée à cette session');
    setActionLoading('run-form'); setError('');
    try {
      await api({
        function:          'createFirstRun',
        party_id:          partyId,
        title:             runTitle,
        prep_time_seconds: Number(runPrep) || 10,
        turn_time_seconds: Number(runTurn) || 30,
      });
      setShowRunForm(false);
      setRunTitle(''); setRunPrep('10'); setRunTurn('30');
      if (selSession) await loadRuns(selSession.id);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const launchRun = async (run: Run) => {
    const msg = `Lancer "${run.title}" ? Les matchs 1v1 seront générés automatiquement.`;
    if (Platform.OS !== 'web') {
      Alert.alert('Lancer le run ?', msg, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Lancer', onPress: () => doLaunchRun(run.id) },
      ]);
    } else {
      if (!window.confirm(msg)) return;
      doLaunchRun(run.id);
    }
  };

  const doLaunchRun = async (runId: string) => {
    setActionLoading(`launch-${runId}`); setError('');
    try {
      await api({ function: 'launchRun', run_id: runId });
      if (selSession) await loadRuns(selSession.id);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const openEditRun = (run: Run) => {
    setEditingRun(run);
    setEditRunPrep(String(run.prep_time_seconds));
    setEditRunTurn(String(run.turn_time_seconds));
  };

  const submitEditRun = async () => {
    if (!editingRun) return;
    setActionLoading(`edit-${editingRun.id}`); setError('');
    try {
      await api({
        function:          'updateRun',
        run_id:            editingRun.id,
        prep_time_seconds: Number(editRunPrep) || 10,
        turn_time_seconds: Number(editRunTurn) || 30,
      });
      setEditingRun(null);
      if (selSession) await loadRuns(selSession.id);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const finishRun = async (run: Run) => {
    const msg = `Terminer "${run.title}" ? Les résultats seront proclamés en frontend.`;
    if (Platform.OS !== 'web') {
      Alert.alert('Terminer le run ?', msg, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Terminer', style: 'destructive', onPress: () => doFinishRun(run.id) },
      ]);
    } else {
      if (!window.confirm(msg)) return;
      doFinishRun(run.id);
    }
  };

  const doFinishRun = async (runId: string) => {
    setActionLoading(`finish-${runId}`); setError('');
    try {
      await api({ function: 'finishRun', run_id: runId });
      if (selSession) await loadRuns(selSession.id);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const openRun = (run: Run) => {
    setSelRun(run);
    setView('matches');
    loadMatches(run.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <LinearGradient colors={['#059669', '#047857']} style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (view === 'matches') { setView('runs'); setSelRun(null); }
          else if (view === 'runs') { setView('sessions'); setSelSession(null); }
          else onBack();
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🎯 Admin Awalé</Text>
          <Text style={styles.headerSub}>
            {view === 'sessions' ? 'Sessions'
              : view === 'runs' ? selSession?.title ?? 'Runs'
              : selRun?.title ?? 'Matchs'}
          </Text>
        </View>
        {view === 'sessions' && (
          <TouchableOpacity onPress={loadSessions} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={C.white} />
          </TouchableOpacity>
        )}
        {view === 'runs' && selSession && (
          <TouchableOpacity onPress={() => loadRuns(selSession.id)} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={C.white} />
          </TouchableOpacity>
        )}
        {view === 'matches' && selRun && (
          <TouchableOpacity onPress={() => loadMatches(selRun.id)} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={C.white} />
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* ── Erreur ── */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color={C.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={C.danger} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>

          {/* ────── VUE SESSIONS ────── */}
          {view === 'sessions' && (
            <>
              <TouchableOpacity style={styles.addBtn} onPress={() => openSessionForm()}>
                <Ionicons name="add-circle" size={20} color={C.white} />
                <Text style={styles.addBtnText}>Créer une session</Text>
              </TouchableOpacity>

              {/* Formulaire création/édition */}
              {showSessionForm && (
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>
                    {editingSession ? '✏️ Modifier la session' : '➕ Nouvelle session'}
                  </Text>
                  <Text style={styles.label}>Titre *</Text>
                  <TextInput style={styles.input} value={formTitle}
                    onChangeText={setFormTitle} placeholder="Ex: Tournoi Awalé #1" />

                  <Text style={styles.label}>Description</Text>
                  <TextInput style={[styles.input, styles.inputMulti]}
                    value={formDesc} onChangeText={setFormDesc}
                    placeholder="Description optionnelle" multiline numberOfLines={3} />

                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Session payante</Text>
                    <Switch value={formIsPaid} onValueChange={setFormIsPaid}
                      trackColor={{ true: C.green }} />
                  </View>

                  {formIsPaid && (
                    <>
                      <Text style={styles.label}>Prix (CFA)</Text>
                      <TextInput style={styles.input} value={formPrice}
                        onChangeText={setFormPrice} keyboardType="numeric"
                        placeholder="Ex: 500" />
                    </>
                  )}

                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.cancelBtn}
                      onPress={() => setShowSessionForm(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn}
                      onPress={submitSessionForm}
                      disabled={actionLoading === 'session-form'}>
                      {actionLoading === 'session-form'
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <Text style={styles.saveBtnText}>
                            {editingSession ? 'Enregistrer' : 'Créer'}
                          </Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Liste des sessions */}
              {sessions.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="grid-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Aucune session Awalé</Text>
                </View>
              ) : (
                sessions.map(s => (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{s.title}</Text>
                        {s.is_paid && (
                          <View style={styles.paidBadge}>
                            <Text style={styles.paidText}>{s.price_cfa} CFA</Text>
                          </View>
                        )}
                      </View>
                      {s.description ? (
                        <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text>
                      ) : null}
                      <View style={styles.cardStats}>
                        <View style={styles.stat}>
                          <Ionicons name="people-outline" size={14} color={C.muted} />
                          <Text style={styles.statText}>{s.players_count} joueur{s.players_count > 1 ? 's' : ''}</Text>
                        </View>
                        <View style={styles.stat}>
                          <Ionicons name="layers-outline" size={14} color={C.muted} />
                          <Text style={styles.statText}>{s.runs_count} run{s.runs_count > 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openSession(s)}>
                        <Ionicons name="grid" size={16} color={C.green} />
                        <Text style={[styles.actionText, { color: C.green }]}>Gérer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openSessionForm(s)}>
                        <Ionicons name="create-outline" size={16} color={C.gold} />
                        <Text style={[styles.actionText, { color: C.gold }]}>Modifier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn}
                        onPress={() => confirmDelete(s)}
                        disabled={actionLoading === `del-${s.id}`}>
                        {actionLoading === `del-${s.id}`
                          ? <ActivityIndicator size="small" color={C.danger} />
                          : <>
                              <Ionicons name="trash-outline" size={16} color={C.danger} />
                              <Text style={[styles.actionText, { color: C.danger }]}>Supprimer</Text>
                            </>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* ────── VUE RUNS ────── */}
          {view === 'runs' && selSession && (
            <>
              {/* Infos session */}
              <View style={styles.infoBar}>
                <Ionicons name="people-outline" size={15} color={C.green} />
                <Text style={styles.infoBarText}>{selSession.players_count} joueur{selSession.players_count > 1 ? 's' : ''} inscrits</Text>
              </View>

              {/* Bouton créer run #1 (seulement si aucun run) */}
              {runs.length === 0 && (
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowRunForm(true)}>
                  <Ionicons name="add-circle" size={20} color={C.white} />
                  <Text style={styles.addBtnText}>Créer le Run #1</Text>
                </TouchableOpacity>
              )}

              {/* Formulaire run */}
              {showRunForm && (
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>🎮 Créer le Run #1</Text>

                  <Text style={styles.label}>Titre du run *</Text>
                  <TextInput style={styles.input} value={runTitle}
                    onChangeText={setRunTitle} placeholder="Ex: Manche 1" />

                  <View style={styles.twoCol}>
                    <View style={styles.halfField}>
                      <Text style={styles.label}>Préparation (sec)</Text>
                      <TextInput style={styles.input} value={runPrep}
                        onChangeText={setRunPrep} keyboardType="numeric" />
                    </View>
                    <View style={styles.halfField}>
                      <Text style={styles.label}>Temps/tour (sec)</Text>
                      <TextInput style={styles.input} value={runTurn}
                        onChangeText={setRunTurn} keyboardType="numeric" />
                    </View>
                  </View>

                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.cancelBtn}
                      onPress={() => setShowRunForm(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn}
                      onPress={submitRunForm}
                      disabled={actionLoading === 'run-form'}>
                      {actionLoading === 'run-form'
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <Text style={styles.saveBtnText}>Créer</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Liste des runs */}
              {runs.length === 0 && !showRunForm ? (
                <View style={styles.empty}>
                  <Ionicons name="layers-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Aucun run créé</Text>
                  <Text style={styles.emptyHint}>Créez le run #1 pour démarrer le tournoi</Text>
                </View>
              ) : (
                runs.map(run => (
                  <View key={run.id} style={styles.runCard}>
                    <View style={styles.runCardTop}>
                      <StatusBadge status={run.status} />
                      <Text style={styles.runTitle}>Run #{run.run_number} — {run.title}</Text>
                    </View>

                    <View style={styles.runMeta}>
                      <MetaCell icon="time-outline"      label="Prép."  value={`${run.prep_time_seconds}s`} />
                      <MetaCell icon="stopwatch-outline" label="Tour"   value={`${run.turn_time_seconds}s`} />
                      <MetaCell icon="game-controller-outline" label="Matchs"
                        value={`${run.matches_finished}/${run.matches_total}`} />
                    </View>

                    {run.launched_at && (
                      <Text style={styles.runDate}>
                        Lancé le {new Date(run.launched_at).toLocaleString('fr-FR')}
                      </Text>
                    )}

                    {/* ── Formulaire modification run ── */}
                    {editingRun?.id === run.id && (
                      <View style={styles.editRunForm}>
                        <View style={styles.twoCol}>
                          <View style={styles.halfField}>
                            <Text style={styles.label}>Prép. (sec)</Text>
                            <TextInput style={styles.input} value={editRunPrep}
                              onChangeText={setEditRunPrep} keyboardType="numeric" />
                          </View>
                          <View style={styles.halfField}>
                            <Text style={styles.label}>Tour (sec)</Text>
                            <TextInput style={styles.input} value={editRunTurn}
                              onChangeText={setEditRunTurn} keyboardType="numeric" />
                          </View>
                        </View>
                        <View style={styles.formActions}>
                          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingRun(null)}>
                            <Text style={styles.cancelBtnText}>Annuler</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.saveBtn}
                            onPress={submitEditRun}
                            disabled={actionLoading === `edit-${run.id}`}>
                            {actionLoading === `edit-${run.id}`
                              ? <ActivityIndicator size="small" color={C.white} />
                              : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View style={styles.runActions}>
                      {/* Bouton Lancer — uniquement si created */}
                      {run.status === 'created' && (
                        <>
                          <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => editingRun?.id === run.id ? setEditingRun(null) : openEditRun(run)}
                            disabled={!!actionLoading}>
                            <Ionicons name="create-outline" size={18} color={C.gold} />
                            <Text style={styles.editBtnText}>Modifier</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.launchBtn}
                            onPress={() => launchRun(run)}
                            disabled={!!actionLoading}>
                            {actionLoading === `launch-${run.id}`
                              ? <ActivityIndicator size="small" color={C.white} />
                              : <>
                                  <Ionicons name="play-circle" size={18} color={C.white} />
                                  <Text style={styles.launchBtnText}>Lancer</Text>
                                </>}
                          </TouchableOpacity>
                        </>
                      )}
                      {/* Boutons Voir matchs + Terminer — si launched */}
                      {run.status === 'launched' && (
                        <>
                          <TouchableOpacity style={styles.viewBtn} onPress={() => openRun(run)}>
                            <Ionicons name="eye-outline" size={18} color={C.green} />
                            <Text style={styles.viewBtnText}>Matchs</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.finishBtn}
                            onPress={() => finishRun(run)}
                            disabled={!!actionLoading}>
                            {actionLoading === `finish-${run.id}`
                              ? <ActivityIndicator size="small" color={C.white} />
                              : <>
                                  <Ionicons name="flag" size={18} color={C.white} />
                                  <Text style={styles.finishBtnText}>Terminer</Text>
                                </>}
                          </TouchableOpacity>
                        </>
                      )}
                      {/* Bouton Voir matchs — si finished */}
                      {run.status === 'finished' && (
                        <TouchableOpacity style={styles.viewBtn} onPress={() => openRun(run)}>
                          <Ionicons name="eye-outline" size={18} color={C.green} />
                          <Text style={styles.viewBtnText}>Voir les matchs</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* ────── VUE MATCHS ────── */}
          {view === 'matches' && selRun && (
            <>
              <View style={styles.infoBar}>
                <StatusBadge status={selRun.status} />
                <Text style={styles.infoBarText}>
                  {matches.filter(m => m.finished).length}/{matches.length} matchs terminés
                </Text>
              </View>

              {matches.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="game-controller-outline" size={40} color={C.muted} />
                  <Text style={styles.emptyText}>Aucun match généré</Text>
                </View>
              ) : (
                matches.map((m, i) => (
                  <View key={m.id} style={[styles.matchCard, m.finished && styles.matchCardDone]}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.matchNum}>Match {i + 1}</Text>
                      <View style={[styles.matchBadge,
                        m.finished ? styles.matchBadgeDone : styles.matchBadgePending]}>
                        <Text style={styles.matchBadgeText}>
                          {m.finished ? '✅ Terminé' : '⏳ En cours'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.matchVS}>
                      <PlayerChip
                        username={m.player1.name}
                        isWinner={m.winner?.id === m.player1.id}
                        finished={m.finished}
                      />
                      <Text style={styles.vsText}>VS</Text>
                      <PlayerChip
                        username={m.player2.name}
                        isWinner={m.winner?.id === m.player2.id}
                        finished={m.finished}
                      />
                    </View>
                    {m.finished && m.winner && (
                      <View style={styles.winnerRow}>
                        <Ionicons name="trophy" size={14} color={C.gold} />
                        <Text style={styles.winnerText}>Gagnant : {m.winner.name}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    created:  { bg: '#EDE9FE', text: C.created,  label: '⏳ En attente' },
    launched: { bg: '#DBEAFE', text: C.launched, label: '🔵 En cours'   },
    finished: { bg: '#D1FAE5', text: C.finished, label: '🟢 Terminé'    },
  }[status] ?? { bg: '#F3F4F6', text: C.muted, label: status };

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function MetaCell({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Ionicons name={icon} size={14} color={C.muted} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function PlayerChip({ username, isWinner, finished }:
  { username: string; isWinner: boolean; finished: boolean }) {
  return (
    <View style={[styles.playerChip,
      finished && isWinner  && styles.playerChipWin,
      finished && !isWinner && styles.playerChipLose,
    ]}>
      <Text style={styles.playerChipText}>{username}</Text>
      {finished && isWinner && <Ionicons name="trophy" size={12} color={C.gold} />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  flex:    { flex: 1 },
  scroll:  { padding: 16, paddingBottom: 40 },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                  paddingVertical: 14, paddingTop: Platform.OS === 'ios' ? 56 : 14 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { color: C.white, fontSize: 18, fontWeight: '800' },
  headerSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  backBtn:      { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  refreshBtn:   { padding: 8 },

  // Erreur
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12,
                 padding: 12, backgroundColor: '#FEF2F2', borderRadius: 10,
                 borderWidth: 1, borderColor: '#FCA5A5' },
  errorText:   { flex: 1, color: C.danger, fontSize: 13 },

  // Info bar
  infoBar:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
                 backgroundColor: C.surface, borderRadius: 10, padding: 12,
                 borderWidth: 1, borderColor: C.border },
  infoBarText: { color: C.textSoft, fontSize: 13 },

  // Bouton ajouter
  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, backgroundColor: C.green, borderRadius: 12, paddingVertical: 14,
                marginBottom: 16 },
  addBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },

  // Formulaire
  formBox:     { backgroundColor: C.surface, borderRadius: 14, padding: 16,
                 marginBottom: 16, borderWidth: 1, borderColor: C.border },
  formTitle:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },
  label:       { fontSize: 13, fontWeight: '600', color: C.textSoft, marginBottom: 6, marginTop: 10 },
  input:       { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14,
                 paddingVertical: 10, fontSize: 14, color: C.text,
                 borderWidth: 1, borderColor: C.border },
  inputMulti:  { height: 80, textAlignVertical: 'top' },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 marginTop: 10 },
  twoCol:      { flexDirection: 'row', gap: 12 },
  halfField:   { flex: 1 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:   { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
                 backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  saveBtn:     { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
                 backgroundColor: C.green },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  // Card session
  card:         { backgroundColor: C.surface, borderRadius: 14, marginBottom: 12,
                  borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTop:      { padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:    { color: C.text, fontSize: 16, fontWeight: '700', flex: 1 },
  cardDesc:     { color: C.muted, fontSize: 13, marginVertical: 6 },
  cardStats:    { flexDirection: 'row', gap: 16, marginTop: 8 },
  stat:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:     { color: C.muted, fontSize: 12 },
  cardActions:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 5, paddingVertical: 12 },
  actionText:   { fontSize: 13, fontWeight: '600' },

  // Paid badge
  paidBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8,
               paddingVertical: 3, borderWidth: 1, borderColor: '#FCD34D' },
  paidText:  { color: C.gold, fontSize: 11, fontWeight: '700' },

  // Run card
  runCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: C.border },
  runCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  runTitle:   { color: C.text, fontSize: 15, fontWeight: '700', flex: 1 },
  runMeta:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  runDate:    { color: C.muted, fontSize: 12, marginBottom: 10 },
  runActions: { flexDirection: 'row', gap: 10 },
  launchBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, backgroundColor: C.launched, borderRadius: 10, paddingVertical: 12 },
  launchBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  viewBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 12 },
  viewBtnText: { color: C.green, fontWeight: '700', fontSize: 14 },

  // Match card
  matchCard:       { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12,
                     borderWidth: 1, borderColor: C.border },
  matchCardDone:   { borderColor: '#A7F3D0' },
  matchHeader:     { flexDirection: 'row', alignItems: 'center',
                     justifyContent: 'space-between', marginBottom: 12 },
  matchNum:        { color: C.textSoft, fontSize: 13, fontWeight: '600' },
  matchBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  matchBadgeDone:  { backgroundColor: '#D1FAE5' },
  matchBadgePending: { backgroundColor: '#FEF3C7' },
  matchBadgeText:  { fontSize: 11, fontWeight: '700', color: C.text },
  matchVS:         { flexDirection: 'row', alignItems: 'center',
                     justifyContent: 'space-around', marginBottom: 10 },
  vsText:          { color: C.gold, fontSize: 18, fontWeight: '900' },
  winnerRow:       { flexDirection: 'row', alignItems: 'center', gap: 6,
                     paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  winnerText:      { color: C.gold, fontSize: 13, fontWeight: '700' },

  // Player chip
  playerChip:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 4, paddingVertical: 8, paddingHorizontal: 12,
                    borderRadius: 10, backgroundColor: C.bg,
                    borderWidth: 1, borderColor: C.border },
  playerChipWin:  { backgroundColor: '#FEF3C7', borderColor: C.gold },
  playerChipLose: { backgroundColor: '#F9FAFB', borderColor: C.border, opacity: 0.6 },
  playerChipText: { color: C.text, fontSize: 13, fontWeight: '600' },

  // Meta cell
  metaCell:  { flex: 1, alignItems: 'center', backgroundColor: C.bg,
               borderRadius: 8, padding: 8, gap: 2,
               borderWidth: 1, borderColor: C.border },
  metaLabel: { color: C.muted, fontSize: 10 },
  metaValue: { color: C.text, fontSize: 13, fontWeight: '700' },

  // Badge
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Edit run form
  editRunForm: { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12,
                 marginBottom: 10, borderWidth: 1, borderColor: '#FCD34D' },

  // Bouton modifier
  editBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, paddingVertical: 12,
                 borderWidth: 1, borderColor: '#FCD34D' },
  editBtnText: { color: C.gold, fontWeight: '700', fontSize: 14 },

  // Bouton terminer
  finishBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   gap: 8, backgroundColor: C.danger, borderRadius: 10, paddingVertical: 12 },
  finishBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  // Empty
  empty:     { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center' },
  emptyHint: { color: C.muted, fontSize: 13, textAlign: 'center', opacity: 0.7 },
});
