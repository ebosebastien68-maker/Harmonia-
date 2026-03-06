/**
 * AdminMusic.tsx — Interface d'administration Music
 *
 * VUES :
 *   1. Liste des sessions → créer / modifier / supprimer / voir joueurs
 *   2. Détail session    → liste des runs + créer run
 *   3. Détail run        → joueurs inscrits + soumissions vidéos + classement + changer status
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

const C = {
  bg:          '#FFF8F0',
  surface:     '#FFFFFF',
  border:      '#F0E0CC',
  orange:      '#E65100',
  orangeLight: '#FF7043',
  gold:        '#D97706',
  danger:      '#DC2626',
  muted:       '#6B7280',
  text:        '#111827',
  textSoft:    '#374151',
  submissions: '#0D9488',
  voting:      '#EA580C',
  finished:    '#059669',
  draft:       '#E65100',
  white:       '#FFFFFF',
};

type ViewName = 'sessions' | 'runs' | 'run_detail';

interface Session {
  id: string; title: string; description?: string;
  is_paid: boolean; price_cfa: number;
  players_count: number; runs_count: number;
}
interface Run {
  id: string; run_number: number; title: string;
  status: 'draft' | 'submissions_open' | 'voting_open' | 'finished';
  max_submissions: number;
  min_votes_qualify?: number | null;
  min_rank_qualify?: number | null;
  players_count: number; submissions_count: number;
}
interface SubmissionGroup {
  user_id: string; nom_complet: string; avatar_url: string | null;
  votes: number;
  videos: { id: string; audio_url: string; description?: string; duration_s?: number }[];
}
interface ClassementEntry {
  user_id: string; nom: string; prenom: string;
  total_votes: number; rank: number;
}

interface AdminMusicProps {
  adminEmail:    string;
  adminPassword: string;
  onBack:        () => void;
}

export default function AdminMusic({ adminEmail, adminPassword, onBack }: AdminMusicProps) {

  const [view,       setView]       = useState<ViewName>('sessions');
  const [selSession, setSelSession] = useState<Session | null>(null);
  const [selRun,     setSelRun]     = useState<Run | null>(null);

  const [sessions,    setSessions]    = useState<Session[]>([]);
  const [runs,        setRuns]        = useState<Run[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionGroup[]>([]);
  const [classement,  setClassement]  = useState<ClassementEntry[]>([]);
  const [runTab,      setRunTab]      = useState<'submissions' | 'classement'>('submissions');

  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,         setError]         = useState('');

  // Formulaire session
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession,  setEditingSession]  = useState<Session | null>(null);
  const [formTitle,       setFormTitle]       = useState('');
  const [formDesc,        setFormDesc]        = useState('');
  const [formIsPaid,      setFormIsPaid]      = useState(false);
  const [formPrice,       setFormPrice]       = useState('');

  // Formulaire run
  const [showRunForm, setShowRunForm] = useState(false);
  const [runTitle,    setRunTitle]    = useState('');
  const [runMaxSub,   setRunMaxSub]   = useState('1');
  const [runMinVotes, setRunMinVotes] = useState('');
  const [runMinRank,  setRunMinRank]  = useState('');

  // ─── API ─────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const res = await fetch(`${BACKEND_URL}/admin-music`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: adminEmail, password: adminPassword, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.details ? `${data?.error} — ${data.details}` : (data?.error || `Erreur ${res.status}`));
    return data;
  }, [adminEmail, adminPassword]);

  // ─── Chargements ─────────────────────────────────────────────────────────
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
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadRunDetail = useCallback(async (run: Run) => {
    setLoading(true); setError('');
    try {
      const [subData, classData] = await Promise.all([
        api({ function: 'listSubmissions', run_id: run.id }),
        api({ function: 'getClassement',   run_id: run.id }),
      ]);
      setSubmissions(subData.submissions || []);
      setClassement(classData.classement || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { loadSessions(); }, []);

  // ─── Navigation ──────────────────────────────────────────────────────────
  const openSession = (s: Session) => { setSelSession(s); setView('runs'); loadRuns(s.id); };
  const openRun = (run: Run) => { setSelRun(run); setView('run_detail'); setRunTab('submissions'); loadRunDetail(run); };
  const goBack = () => {
    if (view === 'run_detail') { setView('runs'); setSelRun(null); }
    else if (view === 'runs')  { setView('sessions'); setSelSession(null); }
    else onBack();
  };

  // ─── Session CRUD ─────────────────────────────────────────────────────────
  const openSessionForm = (session?: Session) => {
    setEditingSession(session ?? null);
    setFormTitle(session?.title ?? '');
    setFormDesc(session?.description ?? '');
    setFormIsPaid(session?.is_paid ?? false);
    setFormPrice(String(session?.price_cfa ?? ''));
    setShowSessionForm(true);
  };

  const submitSessionForm = async () => {
    if (!formTitle.trim()) return setError('Le titre est requis');
    setActionLoading('session-form'); setError('');
    try {
      if (editingSession) {
        await api({ function: 'updateSession', session_id: editingSession.id,
          title: formTitle, description: formDesc, is_paid: formIsPaid, price_cfa: Number(formPrice) || 0 });
      } else {
        await api({ function: 'createSession',
          title: formTitle, description: formDesc, is_paid: formIsPaid, price_cfa: Number(formPrice) || 0 });
      }
      setShowSessionForm(false);
      await loadSessions();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const confirmDelete = (s: Session) => {
    const msg = `Supprimer "${s.title}" ?`;
    if (Platform.OS === 'web') { if (window.confirm(msg)) deleteSession(s.id); }
    else Alert.alert('Supprimer ?', msg, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteSession(s.id) },
    ]);
  };

  const deleteSession = async (id: string) => {
    setActionLoading(`del-${id}`); setError('');
    try { await api({ function: 'deleteSession', session_id: id }); await loadSessions(); }
    catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  // ─── Run actions ──────────────────────────────────────────────────────────
  const submitRunForm = async () => {
    if (!runTitle.trim() || !selSession) return setError('Le titre du run est requis');
    setActionLoading('run-form'); setError('');
    try {
      await api({
        function:          'createRun',
        session_id:        selSession.id,
        title:             runTitle,
        max_submissions:   Number(runMaxSub) || 1,
        min_votes_qualify: runMinVotes ? Number(runMinVotes) : null,
        min_rank_qualify:  runMinRank  ? Number(runMinRank)  : null,
      });
      setShowRunForm(false);
      setRunTitle(''); setRunMaxSub('1'); setRunMinVotes(''); setRunMinRank('');
      await loadRuns(selSession.id);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const enrollPlayers = async (runId: string) => {
    setActionLoading(`enroll-${runId}`); setError('');
    try {
      const data = await api({ function: 'enrollPlayers', run_id: runId });
      Alert.alert('✅ Joueurs inscrits', `${data.enrolled} joueur(s) inscrit(s) au run.`);
      if (selSession) await loadRuns(selSession.id);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const setRunStatus = async (runId: string, status: string) => {
    const labels: Record<string, string> = {
      submissions_open: 'Ouvrir les soumissions',
      voting_open:      'Ouvrir les votes',
      finished:         'Terminer le run',
    };
    const doIt = async () => {
      setActionLoading(`status-${runId}`); setError('');
      try {
        await api({ function: 'setRunStatus', run_id: runId, status });
        if (selSession) await loadRuns(selSession.id);
        if (selRun?.id === runId) setSelRun(prev => prev ? { ...prev, status: status as any } : prev);
      } catch (e: any) { setError(e.message); }
      finally { setActionLoading(null); }
    };
    const msg = `${labels[status] ?? status} ?`;
    if (Platform.OS === 'web') { if (window.confirm(msg)) doIt(); }
    else Alert.alert('Confirmer', msg, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: doIt },
    ]);
  };

  const deleteSubmission = async (subId: string) => {
    const doIt = async () => {
      setActionLoading(`sub-${subId}`); setError('');
      try {
        await api({ function: 'deleteSubmission', submission_id: subId });
        setSubmissions(prev => prev.map(g => ({
          ...g, videos: g.videos.filter(v => v.id !== subId)
        })).filter(g => g.videos.length > 0));
      } catch (e: any) { setError(e.message); }
      finally { setActionLoading(null); }
    };
    const msg = 'Supprimer cette vidéo ?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) doIt(); }
    else Alert.alert('Supprimer ?', msg, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: doIt },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      <LinearGradient colors={['#BF360C', '#E65100']} style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🎵 Admin Music</Text>
          <Text style={styles.headerSub}>
            {view === 'sessions' ? 'Sessions'
              : view === 'runs' ? selSession?.title ?? 'Runs'
              : selRun?.title ?? 'Détail run'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => {
          if (view === 'sessions') loadSessions();
          else if (view === 'runs' && selSession) loadRuns(selSession.id);
          else if (view === 'run_detail' && selRun) loadRunDetail(selRun);
        }}>
          <Ionicons name="refresh" size={20} color={C.white} />
        </TouchableOpacity>
      </LinearGradient>

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
        <View style={styles.centered}><ActivityIndicator size="large" color={C.orange} /></View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>

          {/* ────── VUE SESSIONS ────── */}
          {view === 'sessions' && (
            <>
              <TouchableOpacity style={styles.addBtn} onPress={() => openSessionForm()}>
                <Ionicons name="add-circle" size={20} color={C.white} />
                <Text style={styles.addBtnText}>Créer une session</Text>
              </TouchableOpacity>

              {showSessionForm && (
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>{editingSession ? '✏️ Modifier' : '➕ Nouvelle session'}</Text>
                  <Text style={styles.label}>Titre *</Text>
                  <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle} placeholder="Ex: Concours Danse #1" />
                  <Text style={styles.label}>Description</Text>
                  <TextInput style={[styles.input, styles.inputMulti]} value={formDesc}
                    onChangeText={setFormDesc} multiline numberOfLines={3} placeholder="Description optionnelle" />
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Session payante</Text>
                    <Switch value={formIsPaid} onValueChange={setFormIsPaid} trackColor={{ true: C.orange }} />
                  </View>
                  {formIsPaid && (
                    <>
                      <Text style={styles.label}>Prix (CFA)</Text>
                      <TextInput style={styles.input} value={formPrice} onChangeText={setFormPrice} keyboardType="numeric" placeholder="Ex: 500" />
                    </>
                  )}
                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSessionForm(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={submitSessionForm} disabled={actionLoading === 'session-form'}>
                      {actionLoading === 'session-form'
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <Text style={styles.saveBtnText}>{editingSession ? 'Enregistrer' : 'Créer'}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {sessions.length === 0 ? (
                <View style={styles.empty}><Ionicons name="musical-notes-outline" size={40} color={C.muted} /><Text style={styles.emptyText}>Aucune session Music</Text></View>
              ) : (
                sessions.map(s => (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{s.title}</Text>
                        {s.is_paid && <View style={styles.paidBadge}><Text style={styles.paidText}>{s.price_cfa} CFA</Text></View>}
                      </View>
                      {s.description ? <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text> : null}
                      <View style={styles.cardStats}>
                        <View style={styles.stat}><Ionicons name="people-outline" size={14} color={C.muted} /><Text style={styles.statText}>{s.players_count} joueur(s)</Text></View>
                        <View style={styles.stat}><Ionicons name="layers-outline" size={14} color={C.muted} /><Text style={styles.statText}>{s.runs_count} run(s)</Text></View>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openSession(s)}>
                        <Ionicons name="grid" size={16} color={C.orange} /><Text style={[styles.actionText, { color: C.orange }]}>Gérer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openSessionForm(s)}>
                        <Ionicons name="create-outline" size={16} color={C.gold} /><Text style={[styles.actionText, { color: C.gold }]}>Modifier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(s)} disabled={!!actionLoading}>
                        {actionLoading === `del-${s.id}`
                          ? <ActivityIndicator size="small" color={C.danger} />
                          : <><Ionicons name="trash-outline" size={16} color={C.danger} /><Text style={[styles.actionText, { color: C.danger }]}>Supprimer</Text></>}
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
              <View style={styles.infoBar}>
                <Ionicons name="people-outline" size={15} color={C.orange} />
                <Text style={styles.infoBarText}>{selSession.players_count} joueur(s) inscrits</Text>
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={() => setShowRunForm(true)}>
                <Ionicons name="add-circle" size={20} color={C.white} />
                <Text style={styles.addBtnText}>Créer un Run</Text>
              </TouchableOpacity>

              {showRunForm && (
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>🎥 Nouveau Run</Text>
                  <Text style={styles.label}>Titre *</Text>
                  <TextInput style={styles.input} value={runTitle} onChangeText={setRunTitle} placeholder="Ex: Manche 1 — Chorégraphie libre" />
                  <Text style={styles.label}>Max vidéos par joueur</Text>
                  <TextInput style={styles.input} value={runMaxSub} onChangeText={setRunMaxSub} keyboardType="numeric" placeholder="1" />
                  <Text style={[styles.label, { marginTop: 10, color: C.muted }]}>Conditions run suivant (optionnel)</Text>
                  <View style={styles.twoCol}>
                    <View style={styles.halfField}>
                      <Text style={styles.label}>Min votes</Text>
                      <TextInput style={styles.input} value={runMinVotes} onChangeText={setRunMinVotes} keyboardType="numeric" placeholder="Ex: 5" />
                    </View>
                    <View style={styles.halfField}>
                      <Text style={styles.label}>Min rang</Text>
                      <TextInput style={styles.input} value={runMinRank} onChangeText={setRunMinRank} keyboardType="numeric" placeholder="Ex: 10" />
                    </View>
                  </View>
                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRunForm(false)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={submitRunForm} disabled={actionLoading === 'run-form'}>
                      {actionLoading === 'run-form'
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <Text style={styles.saveBtnText}>Créer</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {runs.length === 0 && !showRunForm ? (
                <View style={styles.empty}><Ionicons name="layers-outline" size={40} color={C.muted} /><Text style={styles.emptyText}>Aucun run créé</Text></View>
              ) : (
                runs.map(run => (
                  <View key={run.id} style={styles.runCard}>
                    <View style={styles.runCardTop}>
                      <RunStatusBadge status={run.status} />
                      <Text style={styles.runTitle}>Run #{run.run_number} — {run.title}</Text>
                    </View>
                    <View style={styles.runMeta}>
                      <MetaCell icon="musical-notes-outline"  label="Max vidéos" value={String(run.max_submissions)} />
                      <MetaCell icon="people-outline"    label="Joueurs"    value={String(run.players_count)} />
                      <MetaCell icon="film-outline"      label="Soum."      value={String(run.submissions_count)} />
                    </View>
                    {(run.min_votes_qualify || run.min_rank_qualify) && (
                      <Text style={styles.conditionText}>
                        Conditions suivant : {run.min_votes_qualify ? `≥${run.min_votes_qualify} votes` : ''}{run.min_votes_qualify && run.min_rank_qualify ? ' / ' : ''}{run.min_rank_qualify ? `rang ≤${run.min_rank_qualify}` : ''}
                      </Text>
                    )}
                    <View style={styles.runActions}>
                      {run.status === 'draft' && (
                        <TouchableOpacity style={styles.enrollBtn} onPress={() => enrollPlayers(run.id)} disabled={!!actionLoading}>
                          {actionLoading === `enroll-${run.id}`
                            ? <ActivityIndicator size="small" color={C.white} />
                            : <><Ionicons name="people" size={16} color={C.white} /><Text style={styles.enrollBtnText}>Inscrire joueurs</Text></>}
                        </TouchableOpacity>
                      )}
                      {run.status === 'draft' && (
                        <TouchableOpacity style={styles.statusBtn} onPress={() => setRunStatus(run.id, 'submissions_open')} disabled={!!actionLoading}>
                          {actionLoading === `status-${run.id}`
                            ? <ActivityIndicator size="small" color={C.white} />
                            : <><Ionicons name="cloud-upload" size={16} color={C.white} /><Text style={styles.statusBtnText}>Ouvrir soumissions</Text></>}
                        </TouchableOpacity>
                      )}
                      {run.status === 'submissions_open' && (
                        <TouchableOpacity style={[styles.statusBtn, { backgroundColor: C.voting }]} onPress={() => setRunStatus(run.id, 'voting_open')} disabled={!!actionLoading}>
                          {actionLoading === `status-${run.id}`
                            ? <ActivityIndicator size="small" color={C.white} />
                            : <><Ionicons name="checkmark-circle" size={16} color={C.white} /><Text style={styles.statusBtnText}>Ouvrir votes</Text></>}
                        </TouchableOpacity>
                      )}
                      {run.status === 'voting_open' && (
                        <TouchableOpacity style={[styles.statusBtn, { backgroundColor: C.danger }]} onPress={() => setRunStatus(run.id, 'finished')} disabled={!!actionLoading}>
                          {actionLoading === `status-${run.id}`
                            ? <ActivityIndicator size="small" color={C.white} />
                            : <><Ionicons name="flag" size={16} color={C.white} /><Text style={styles.statusBtnText}>Terminer</Text></>}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.viewBtn} onPress={() => openRun(run)}>
                        <Ionicons name="eye-outline" size={16} color={C.orange} />
                        <Text style={styles.viewBtnText}>Détail</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* ────── VUE DÉTAIL RUN ────── */}
          {view === 'run_detail' && selRun && (
            <>
              <View style={styles.runDetailHeader}>
                <RunStatusBadge status={selRun.status} />
                <Text style={styles.runDetailTitle}>Run #{selRun.run_number} — {selRun.title}</Text>
              </View>

              <View style={styles.innerTabBar}>
                {(['submissions', 'classement'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.innerTabItem, runTab === t && styles.innerTabActive]}
                    onPress={() => setRunTab(t)}
                  >
                    <Text style={[styles.innerTabText, runTab === t && styles.innerTabTextActive]}>
                      {t === 'submissions' ? '🎥 Vidéos' : '🏆 Classement'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Soumissions vidéos — groupées par artiste */}
              {runTab === 'submissions' && (
                <>
                  {submissions.length === 0 ? (
                    <View style={styles.empty}><Ionicons name="musical-notes-outline" size={40} color={C.muted} /><Text style={styles.emptyText}>Aucune vidéo soumise</Text></View>
                  ) : (
                    submissions.map(group => (
                      <View key={group.user_id} style={styles.subCard}>
                        <View style={styles.subCardHeader}>
                          <Text style={styles.subAuthor}>{group.nom_complet}</Text>
                          <View style={styles.subVotes}>
                            <Ionicons name="heart" size={13} color={C.danger} />
                            <Text style={styles.subVotesText}>{group.votes} votes</Text>
                          </View>
                        </View>
                        {group.videos.map(video => (
                          <View key={video.id} style={styles.videoRow}>
                            <View style={styles.videoThumb}>
                              <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.85)" />
                            </View>
                            <View style={styles.videoInfo}>
                              {video.description ? <Text style={styles.videoDesc} numberOfLines={2}>{video.description}</Text> : null}
                              {video.duration_s   ? <Text style={styles.videoDuration}>{Math.floor(video.duration_s / 60)}:{String(video.duration_s % 60).padStart(2, '0')}</Text> : null}
                            </View>
                            <TouchableOpacity style={styles.subDelBtn} onPress={() => deleteSubmission(video.id)} disabled={!!actionLoading}>
                              {actionLoading === `sub-${video.id}`
                                ? <ActivityIndicator size="small" color={C.danger} />
                                : <Ionicons name="trash-outline" size={18} color={C.danger} />}
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </>
              )}

              {/* Classement */}
              {runTab === 'classement' && (
                <>
                  {classement.length === 0 ? (
                    <View style={styles.empty}><Ionicons name="trophy-outline" size={40} color={C.muted} /><Text style={styles.emptyText}>Aucun résultat</Text></View>
                  ) : (
                    classement.map((entry, i) => (
                      <View key={entry.user_id} style={[styles.classRow, i === 0 && styles.classRow1st]}>
                        <Text style={styles.classRank}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank}`}
                        </Text>
                        <View style={styles.classInfo}>
                          <Text style={styles.className}>{entry.prenom} {entry.nom}</Text>
                        </View>
                        <View style={styles.classVotes}>
                          <Ionicons name="heart" size={14} color={C.danger} />
                          <Text style={styles.classVotesText}>{entry.total_votes}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────
function RunStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    draft:            { bg: '#FBE9E7', text: C.draft,       label: '📝 Brouillon'       },
    submissions_open: { bg: '#CCFBF1', text: C.submissions, label: '🎥 Soumissions'     },
    voting_open:      { bg: '#FFEDD5', text: C.voting,      label: '🗳️ Votes ouverts'   },
    finished:         { bg: '#D1FAE5', text: C.finished,    label: '🏆 Terminé'         },
  };
  const c = cfg[status] ?? { bg: '#F3F4F6', text: C.muted, label: status };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  flex:     { flex: 1 },
  scroll:   { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                  paddingVertical: 14, paddingTop: Platform.OS === 'ios' ? 56 : 14 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { color: C.white, fontSize: 18, fontWeight: '800' },
  headerSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  backBtn:      { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  refreshBtn:   { padding: 8 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12,
                 padding: 12, backgroundColor: '#FEF2F2', borderRadius: 10,
                 borderWidth: 1, borderColor: '#FCA5A5' },
  errorText:   { flex: 1, color: C.danger, fontSize: 13 },

  infoBar:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
                 backgroundColor: C.surface, borderRadius: 10, padding: 12,
                 borderWidth: 1, borderColor: C.border },
  infoBarText: { color: C.textSoft, fontSize: 13 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14, marginBottom: 16 },
  addBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },

  formBox:     { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 16,
                 borderWidth: 1, borderColor: C.border },
  formTitle:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },
  label:       { fontSize: 13, fontWeight: '600', color: C.textSoft, marginBottom: 6, marginTop: 10 },
  input:       { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14,
                 paddingVertical: 10, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  inputMulti:  { height: 80, textAlignVertical: 'top' },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  twoCol:      { flexDirection: 'row', gap: 12 },
  halfField:   { flex: 1 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:   { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
                 backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  saveBtn:     { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: C.orange },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  card:         { backgroundColor: C.surface, borderRadius: 14, marginBottom: 12,
                  borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTop:      { padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:    { color: C.text, fontSize: 16, fontWeight: '700', flex: 1 },
  cardDesc:     { color: C.muted, fontSize: 13, marginVertical: 4 },
  cardStats:    { flexDirection: 'row', gap: 16, marginTop: 8 },
  stat:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:     { color: C.muted, fontSize: 12 },
  cardActions:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 5, paddingVertical: 12 },
  actionText:   { fontSize: 13, fontWeight: '600' },

  paidBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  paidText:  { color: C.gold, fontSize: 11, fontWeight: '700' },

  runCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: C.border },
  runCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  runTitle:   { color: C.text, fontSize: 15, fontWeight: '700', flex: 1 },
  runMeta:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  conditionText: { color: C.muted, fontSize: 12, marginBottom: 10 },
  runActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  enrollBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.orangeLight,
                  borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  enrollBtnText:{ color: C.white, fontWeight: '700', fontSize: 13 },
  statusBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.submissions,
                  borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  statusBtnText:{ color: C.white, fontWeight: '700', fontSize: 13 },
  viewBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FBE9E7',
                  borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  viewBtnText:  { color: C.orange, fontWeight: '700', fontSize: 13 },

  runDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  runDetailTitle:  { color: C.text, fontSize: 16, fontWeight: '800', flex: 1 },

  innerTabBar:        { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12,
                        borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' },
  innerTabItem:       { flex: 1, paddingVertical: 12, alignItems: 'center' },
  innerTabActive:     { backgroundColor: C.orange },
  innerTabText:       { color: C.muted, fontSize: 13, fontWeight: '600' },
  innerTabTextActive: { color: C.white },

  subCard:       { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10,
                   borderWidth: 1, borderColor: C.border },
  subCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subAuthor:     { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  subVotes:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subVotesText:  { color: C.danger, fontSize: 12, fontWeight: '700' },

  videoRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
                   backgroundColor: C.bg, borderRadius: 10, padding: 10 },
  videoThumb:    { width: 48, height: 48, borderRadius: 8, backgroundColor: '#1A1A2E',
                   justifyContent: 'center', alignItems: 'center' },
  videoInfo:     { flex: 1, gap: 3 },
  videoDesc:     { color: C.textSoft, fontSize: 12 },
  videoDuration: { color: C.muted, fontSize: 11 },
  subDelBtn:     { padding: 8 },

  classRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
                   borderRadius: 12, padding: 14, marginBottom: 8, gap: 10,
                   borderWidth: 1, borderColor: C.border },
  classRow1st:   { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  classRank:     { fontSize: 20, width: 36, textAlign: 'center' },
  classInfo:     { flex: 1 },
  className:     { color: C.text, fontSize: 14, fontWeight: '700' },
  classVotes:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classVotesText:{ color: C.danger, fontSize: 14, fontWeight: '700' },

  metaCell:  { flex: 1, alignItems: 'center', backgroundColor: C.bg, borderRadius: 8,
               padding: 8, gap: 2, borderWidth: 1, borderColor: C.border },
  metaLabel: { color: C.muted, fontSize: 10 },
  metaValue: { color: C.text, fontSize: 13, fontWeight: '700' },

  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  empty:     { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center' },
});
