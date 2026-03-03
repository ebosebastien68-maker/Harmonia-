/**
 * arts.tsx — Concours Arts — 4 onglets
 *
 * ONGLET 1 "Mes Sessions"  → sessions rejointes → run actif → soumettre image
 * ONGLET 2 "Explorer"      → sessions disponibles → Participer
 * ONGLET 3 "Soumettre"     → upload image depuis galerie → soumettre au run actif
 * ONGLET 4 "Classement"    → sessions → runs voting_open/finished → rang + votes
 *
 * ARCHITECTURE :
 *   • BACKEND_URL/arts
 *   • AsyncStorage lazy → SSR safe
 *   • Upload image : galerie → Supabase Storage bucket arts_images → image_url
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Platform, SafeAreaView, ActivityIndicator, Image,
  Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL   = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  || '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON || '';
const NATIVE        = Platform.OS !== 'web';

const haptic = {
  light:   () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);   },
  medium:  () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);  },
  success: () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   },
};

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080C0A',
  surface:     '#0F1A12',
  surfaceHigh: '#162019',
  border:      '#1E3022',
  gold:        '#C9A84C',
  purple:      '#8E44AD',
  purpleLight: '#A569BD',
  cream:       '#E8F0E0',
  muted:       '#4A6B52',
  launched:    '#2980B9',
  finished:    '#27AE60',
  danger:      '#E74C3C',
  white:       '#FFFFFF',
  voting:      '#E67E22',
  submissions: '#16A085',
};

// ─── AsyncStorage lazy ───────────────────────────────────────────────────────
const Storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      const AS  = (mod as any).default ?? mod;
      return AS.getItem(key);
    } catch { return null; }
  },
};

async function getValidToken(): Promise<{ uid: string; token: string } | null> {
  try {
    const raw = await Storage.getItem('harmonia_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    const uid   = session.user?.id;
    const token = session.access_token;
    if (!uid || !token) return null;
    return { uid, token };
  } catch { return null; }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'mine' | 'explore' | 'submit' | 'classement';

interface RunInfo {
  id: string;
  run_number: number;
  title: string;
  status: 'draft' | 'submissions_open' | 'voting_open' | 'finished';
  max_submissions: number;
  min_votes_qualify?: number | null;
  min_rank_qualify?: number | null;
}

interface Submission {
  id: string;
  image_url: string;
  description?: string | null;
  created_at: string;
}

interface SessionItem {
  id: string;
  title: string;
  description?: string;
  is_paid: boolean;
  price_cfa: number;
  current_run: RunInfo | null;
}

interface ClassementEntry {
  user_id: string;
  nom: string;
  prenom: string;
  total_votes: number;
  rank: number;
}

interface ClassementRun {
  id: string;
  run_number: number;
  title: string;
  status: string;
  classement: ClassementEntry[];
}

interface ClassementSession {
  id: string;
  title: string;
  runs: ClassementRun[];
}

interface ArtsProps {
  userId?:  string;
  onBack?:  () => void;
  onClose?: () => void;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Arts({ userId: userIdProp, onBack, onClose }: ArtsProps) {

  const [uid,   setUid]   = useState<string | null>(userIdProp ?? null);
  const [token, setToken] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('mine');

  const [mySessions,    setMySessions]    = useState<SessionItem[]>([]);
  const [exploreSess,   setExploreSess]   = useState<SessionItem[]>([]);
  const [classement,    setClassement]    = useState<ClassementSession[]>([]);

  const [selSession,    setSelSession]    = useState<SessionItem | null>(null);
  const [runData,       setRunData]       = useState<{
    run: RunInfo | null;
    my_submissions: Submission[];
    is_enrolled: boolean;
  } | null>(null);

  // Submit
  const [submitRun,     setSubmitRun]     = useState<RunInfo | null>(null);
  const [pickedImage,   setPickedImage]   = useState<string | null>(null);
  const [description,   setDescription]  = useState('');
  const [uploading,     setUploading]     = useState(false);

  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,         setError]         = useState('');

  // ─── Init token ──────────────────────────────────────────────────────────
  useEffect(() => {
    getValidToken().then(t => {
      if (t) { setUid(t.uid); setToken(t.token); }
    });
  }, []);

  useEffect(() => {
    if (uid && token) {
      loadMySessions();
    }
  }, [uid, token]);

  // ─── API ──────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const res = await fetch(`${BACKEND_URL}/arts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: uid, access_token: token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    return data;
  }, [uid, token]);

  // ─── Chargements ──────────────────────────────────────────────────────────
  const loadMySessions = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'listMySessions' });
      setMySessions(data.sessions || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadExplore = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'listAvailableSessions' });
      setExploreSess(data.sessions || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadClassement = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'getClassement' });
      setClassement(data.sessions || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadRunForSession = useCallback(async (session: SessionItem) => {
    setLoading(true); setError('');
    try {
      const data = await api({ function: 'getRunForSession', session_id: session.id });
      setRunData({
        run:            data.run,
        my_submissions: data.my_submissions || [],
        is_enrolled:    data.is_enrolled,
      });
      setSelSession(session);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  // ─── Join session ─────────────────────────────────────────────────────────
  const joinSession = useCallback(async (session_id: string) => {
    setActionLoading(`join-${session_id}`); setError('');
    try {
      await api({ function: 'joinSession', session_id });
      haptic.success();
      setExploreSess(prev => prev.filter(s => s.id !== session_id));
      await loadMySessions();
    } catch (e: any) {
      setError(e.message);
      haptic.error();
    } finally { setActionLoading(null); }
  }, [api, loadMySessions]);

  // ─── Choisir image ────────────────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'accès à votre galerie.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImage(result.assets[0].uri);
    }
  }, []);

  // ─── Upload & soumettre ───────────────────────────────────────────────────
  const submitImage = useCallback(async () => {
    if (!pickedImage || !submitRun) return;
    setUploading(true); setError('');
    try {
      // Upload vers Supabase Storage
      const supabase  = createClient(SUPABASE_URL, SUPABASE_ANON);
      const ext       = pickedImage.split('.').pop() || 'jpg';
      const filename  = `${uid}_${Date.now()}.${ext}`;
      const response  = await fetch(pickedImage);
      const blob      = await response.blob();

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('arts_images')
        .upload(`submissions/${filename}`, blob, { contentType: `image/${ext}` });

      if (uploadErr) throw new Error(`Upload échoué: ${uploadErr.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('arts_images')
        .getPublicUrl(`submissions/${filename}`);

      // Soumettre via backend
      await api({
        function:    'submitImage',
        run_id:      submitRun.id,
        image_url:   publicUrl,
        description: description.trim() || null,
      });

      haptic.success();
      setPickedImage(null);
      setDescription('');
      Alert.alert('✅ Soumis !', 'Votre œuvre a été soumise avec succès.');

      // Rafraîchir les données
      if (selSession) await loadRunForSession(selSession);
    } catch (e: any) {
      setError(e.message);
      haptic.error();
    } finally { setUploading(false); }
  }, [pickedImage, submitRun, uid, description, api, selSession, loadRunForSession]);

  // ─── Navigation tabs ──────────────────────────────────────────────────────
  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSelSession(null);
    setRunData(null);
    setError('');
    if (t === 'explore')     loadExplore();
    if (t === 'classement')  loadClassement();
    if (t === 'mine')        loadMySessions();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'mine',       label: 'Mes Sessions', icon: 'person'         },
    { key: 'explore',    label: 'Explorer',     icon: 'compass'        },
    { key: 'submit',     label: 'Soumettre',    icon: 'cloud-upload'   },
    { key: 'classement', label: 'Classement',   icon: 'trophy'         },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <LinearGradient colors={['#0F0A1A', '#080C0A']} style={styles.header}>
        {(onBack || onClose) && (
          <TouchableOpacity onPress={onBack ?? onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cream} />
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🎨 Arts</Text>
          <Text style={styles.headerSub}>Concours créatifs</Text>
        </View>
        <TouchableOpacity onPress={() => handleTabChange(tab)} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={C.cream} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => handleTabChange(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={20}
              color={tab === t.key ? C.purpleLight : C.muted}
            />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Erreur */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={14} color={C.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={14} color={C.danger} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.purpleLight} />
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>

          {/* ─── ONGLET MES SESSIONS ─── */}
          {tab === 'mine' && !selSession && (
            <>
              {mySessions.length === 0 ? (
                <Empty icon="easel-outline" text="Aucune session rejointe" hint="Explorez les concours disponibles" />
              ) : (
                mySessions.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.card}
                    onPress={() => loadRunForSession(s)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.description ? <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text> : null}
                      {s.current_run ? (
                        <RunStatusBadge status={s.current_run.status} />
                      ) : (
                        <View style={styles.noRunBadge}>
                          <Text style={styles.noRunText}>Aucun run actif</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardArrow}>
                      <Ionicons name="chevron-forward" size={18} color={C.muted} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          {/* Détail session → run → soumissions */}
          {tab === 'mine' && selSession && runData && (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => { setSelSession(null); setRunData(null); }}>
                <Ionicons name="arrow-back" size={18} color={C.purpleLight} />
                <Text style={styles.backRowText}>Retour</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>{selSession.title}</Text>

              {!runData.run ? (
                <Empty icon="time-outline" text="Aucun run actif pour cette session" />
              ) : (
                <View style={styles.runBox}>
                  <View style={styles.runBoxTop}>
                    <RunStatusBadge status={runData.run.status} />
                    <Text style={styles.runTitle}>Run #{runData.run.run_number} — {runData.run.title}</Text>
                  </View>
                  <InfoRow icon="images-outline" label="Max soumissions" value={String(runData.run.max_submissions)} />

                  {!runData.is_enrolled && runData.run.status !== 'draft' && (
                    <View style={styles.notEnrolledBanner}>
                      <Ionicons name="information-circle" size={16} color={C.gold} />
                      <Text style={styles.notEnrolledText}>Vous n'êtes pas encore inscrit à ce run</Text>
                    </View>
                  )}

                  {runData.run.status === 'submissions_open' && runData.is_enrolled && (
                    <TouchableOpacity
                      style={styles.submitBtn}
                      onPress={() => { setSubmitRun(runData.run); setTab('submit'); }}
                    >
                      <Ionicons name="cloud-upload" size={18} color={C.white} />
                      <Text style={styles.submitBtnText}>Soumettre une œuvre</Text>
                    </TouchableOpacity>
                  )}

                  {/* Mes soumissions */}
                  {runData.my_submissions.length > 0 && (
                    <>
                      <Text style={styles.subSectionTitle}>Mes soumissions ({runData.my_submissions.length}/{runData.run.max_submissions})</Text>
                      <View style={styles.submissionsGrid}>
                        {runData.my_submissions.map(sub => (
                          <View key={sub.id} style={styles.submissionThumb}>
                            <Image source={{ uri: sub.image_url }} style={styles.thumbImage} />
                            {sub.description ? (
                              <Text style={styles.thumbDesc} numberOfLines={2}>{sub.description}</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {/* ─── ONGLET EXPLORER ─── */}
          {tab === 'explore' && (
            <>
              {exploreSess.length === 0 ? (
                <Empty icon="search-outline" text="Aucun concours disponible" hint="Revenez plus tard" />
              ) : (
                exploreSess.map(s => (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.description ? <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text> : null}
                      {s.is_paid && (
                        <View style={styles.paidBadge}>
                          <Text style={styles.paidText}>{s.price_cfa} CFA</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.joinBtn}
                      onPress={() => joinSession(s.id)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === `join-${s.id}`
                        ? <ActivityIndicator size="small" color={C.white} />
                        : <Text style={styles.joinBtnText}>
                            {s.is_paid ? `Participer — ${s.price_cfa} CFA` : 'Participer — Gratuit'}
                          </Text>}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}

          {/* ─── ONGLET SOUMETTRE ─── */}
          {tab === 'submit' && (
            <>
              {!submitRun ? (
                <>
                  <Text style={styles.sectionTitle}>Choisir un run</Text>
                  {mySessions.filter(s => s.current_run?.status === 'submissions_open').length === 0 ? (
                    <Empty icon="cloud-upload-outline" text="Aucun run ouvert aux soumissions" hint="Attendez que l'administrateur ouvre les soumissions" />
                  ) : (
                    mySessions
                      .filter(s => s.current_run?.status === 'submissions_open')
                      .map(s => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.card}
                          onPress={() => setSubmitRun(s.current_run!)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.cardTitle}>{s.title}</Text>
                          <Text style={styles.cardDesc}>Run #{s.current_run!.run_number} — {s.current_run!.title}</Text>
                          <RunStatusBadge status="submissions_open" />
                        </TouchableOpacity>
                      ))
                  )}
                </>
              ) : (
                <View style={styles.submitForm}>
                  <TouchableOpacity style={styles.backRow} onPress={() => { setSubmitRun(null); setPickedImage(null); }}>
                    <Ionicons name="arrow-back" size={18} color={C.purpleLight} />
                    <Text style={styles.backRowText}>Choisir un autre run</Text>
                  </TouchableOpacity>

                  <Text style={styles.sectionTitle}>Run #{submitRun.run_number} — {submitRun.title}</Text>

                  {/* Zone image */}
                  <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                    {pickedImage ? (
                      <Image source={{ uri: pickedImage }} style={styles.pickedImage} />
                    ) : (
                      <View style={styles.imagePickerEmpty}>
                        <Ionicons name="image-outline" size={48} color={C.muted} />
                        <Text style={styles.imagePickerText}>Appuyer pour choisir une image</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Description */}
                  <Text style={styles.inputLabel}>Description (optionnel)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Décrivez votre œuvre…"
                    placeholderTextColor={C.muted}
                    multiline
                    numberOfLines={3}
                  />

                  <TouchableOpacity
                    style={[styles.submitBtn, !pickedImage && styles.submitBtnDisabled]}
                    onPress={submitImage}
                    disabled={!pickedImage || uploading}
                  >
                    {uploading
                      ? <ActivityIndicator size="small" color={C.white} />
                      : <>
                          <Ionicons name="cloud-upload" size={18} color={C.white} />
                          <Text style={styles.submitBtnText}>Soumettre mon œuvre</Text>
                        </>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* ─── ONGLET CLASSEMENT ─── */}
          {tab === 'classement' && (
            <>
              {classement.length === 0 ? (
                <Empty icon="trophy-outline" text="Aucun résultat disponible" hint="Le classement apparaît quand les votes sont ouverts" />
              ) : (
                classement.map(session => (
                  <View key={session.id} style={styles.classSessionBox}>
                    <Text style={styles.classSessionTitle}>🎨 {session.title}</Text>
                    {session.runs.length === 0 ? (
                      <Text style={styles.classMuted}>Aucun run disponible</Text>
                    ) : (
                      session.runs.map(run => (
                        <View key={run.id} style={styles.classRunBox}>
                          <View style={styles.classRunHeader}>
                            <RunStatusBadge status={run.status as any} />
                            <Text style={styles.classRunTitle}>Run #{run.run_number} — {run.title}</Text>
                          </View>
                          {run.classement.length === 0 ? (
                            <Text style={styles.classMuted}>Aucune soumission</Text>
                          ) : (
                            run.classement.map((entry, i) => (
                              <View key={entry.user_id} style={[styles.classRow, i === 0 && styles.classRow1]}>
                                <View style={styles.classRank}>
                                  <Text style={[styles.classRankText, i === 0 && styles.classRank1Text]}>
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank}`}
                                  </Text>
                                </View>
                                <View style={styles.classInfo}>
                                  <Text style={styles.classNameText}>
                                    {entry.prenom} {entry.nom}
                                  </Text>
                                </View>
                                <View style={styles.classVotes}>
                                  <Ionicons name="heart" size={14} color={C.danger} />
                                  <Text style={styles.classVotesText}>{entry.total_votes}</Text>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      ))
                    )}
                  </View>
                ))
              )}
            </>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────
function RunStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    draft:            { bg: '#1A0A2E', text: C.purpleLight, label: '📝 Brouillon'        },
    submissions_open: { bg: '#0A2A22', text: C.submissions, label: '🖼️ Soumissions ouvertes' },
    voting_open:      { bg: '#2A1500', text: C.voting,      label: '🗳️ Votes ouverts'    },
    finished:         { bg: '#0A2A10', text: C.finished,    label: '🏆 Terminé'          },
  };
  const c = cfg[status] ?? { bg: '#1A1A1A', text: C.muted, label: status };
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusBadgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={14} color={C.muted} />
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

function Empty({ icon, text, hint }: { icon: string; text: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon as any} size={44} color={C.muted} />
      <Text style={styles.emptyText}>{text}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  flex:    { flex: 1 },
  scroll:  { padding: 16, paddingBottom: 40 },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                  paddingVertical: 14, paddingTop: Platform.OS === 'ios' ? 56 : 14 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { color: C.cream, fontSize: 20, fontWeight: '800' },
  headerSub:    { color: C.muted, fontSize: 12 },
  backBtn:      { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  refreshBtn:   { padding: 8 },

  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: C.purpleLight },
  tabLabel:      { color: C.muted, fontSize: 10, fontWeight: '600' },
  tabLabelActive:{ color: C.purpleLight },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12,
                 padding: 10, backgroundColor: '#2A0A0A', borderRadius: 8,
                 borderWidth: 1, borderColor: C.danger },
  errorText:   { flex: 1, color: C.danger, fontSize: 12 },

  card:     { backgroundColor: C.surface, borderRadius: 14, marginBottom: 12,
              borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTop:  { padding: 16, gap: 8 },
  cardTitle:{ color: C.cream, fontSize: 16, fontWeight: '700' },
  cardDesc: { color: C.muted, fontSize: 13 },
  cardArrow:{ padding: 16, alignItems: 'flex-end' },

  statusBadge:    { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: 8, marginTop: 4 },
  statusBadgeText:{ fontSize: 12, fontWeight: '700' },

  noRunBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
                borderRadius: 8, backgroundColor: '#1A1A1A', marginTop: 4 },
  noRunText:  { color: C.muted, fontSize: 12 },

  paidBadge: { alignSelf: 'flex-start', backgroundColor: '#2A1A00', borderRadius: 6,
               paddingHorizontal: 8, paddingVertical: 3 },
  paidText:  { color: C.gold, fontSize: 11, fontWeight: '700' },

  joinBtn:     { margin: 16, marginTop: 0, padding: 14, borderRadius: 12,
                 backgroundColor: C.purple, alignItems: 'center' },
  joinBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  backRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backRowText: { color: C.purpleLight, fontSize: 14, fontWeight: '600' },

  sectionTitle: { color: C.cream, fontSize: 18, fontWeight: '800', marginBottom: 12 },

  runBox:    { backgroundColor: C.surface, borderRadius: 14, padding: 16,
               borderWidth: 1, borderColor: C.border, gap: 10 },
  runBoxTop: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  runTitle:  { color: C.cream, fontSize: 15, fontWeight: '700', flex: 1 },

  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoRowLabel:  { color: C.muted, fontSize: 12, flex: 1 },
  infoRowValue:  { color: C.cream, fontSize: 12, fontWeight: '700' },

  notEnrolledBanner: { flexDirection: 'row', alignItems: 'center', gap: 8,
                       backgroundColor: '#2A1A00', borderRadius: 8, padding: 10 },
  notEnrolledText:   { color: C.gold, fontSize: 12, flex: 1 },

  submitBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                       gap: 8, backgroundColor: C.purple, borderRadius: 12, padding: 14 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: C.white, fontWeight: '700', fontSize: 15 },

  subSectionTitle: { color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  submissionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  submissionThumb: { width: 100, gap: 4 },
  thumbImage:      { width: 100, height: 100, borderRadius: 10, backgroundColor: C.surfaceHigh },
  thumbDesc:       { color: C.muted, fontSize: 11 },

  submitForm:   { gap: 16 },
  imagePicker:  { height: 220, backgroundColor: C.surface, borderRadius: 14,
                  borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  imagePickerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePickerText:  { color: C.muted, fontSize: 13 },
  pickedImage:  { width: '100%', height: '100%', resizeMode: 'cover' },
  inputLabel:   { color: C.muted, fontSize: 13, fontWeight: '600' },
  textInput:    { backgroundColor: C.surface, borderRadius: 10, padding: 12,
                  color: C.cream, fontSize: 14, borderWidth: 1, borderColor: C.border,
                  textAlignVertical: 'top', minHeight: 80 },

  classSessionBox:   { marginBottom: 20 },
  classSessionTitle: { color: C.cream, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  classRunBox:       { backgroundColor: C.surface, borderRadius: 14, padding: 14,
                       borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  classRunHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  classRunTitle:     { color: C.cream, fontSize: 14, fontWeight: '700', flex: 1 },
  classMuted:        { color: C.muted, fontSize: 12, paddingVertical: 8 },

  classRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                   borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  classRow1:     { borderTopWidth: 0 },
  classRank:     { width: 36, alignItems: 'center' },
  classRankText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  classRank1Text:{ fontSize: 20 },
  classInfo:     { flex: 1 },
  classNameText: { color: C.cream, fontSize: 14, fontWeight: '600' },
  classVotes:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classVotesText:{ color: C.cream, fontSize: 14, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center' },
  emptyHint: { color: C.muted, fontSize: 12, textAlign: 'center', opacity: 0.7 },
});
