/**
 * arts.tsx — Concours Arts — 4 onglets
 *
 * UPLOAD SÉCURISÉ :
 *   1. Frontend demande une Signed Upload URL au backend (getUploadUrl)
 *   2. Backend vérifie token + quota + génère URL signée (expire 5min)
 *   3. Frontend PUT l'image directement vers Supabase Storage via signed URL
 *   4. Frontend confirme la soumission au backend (submitImage avec path)
 *   → Les clés Supabase ne quittent jamais le backend
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

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const NATIVE      = Platform.OS !== 'web';

const haptic = {
  light:   () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);   },
  success: () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error:   () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   },
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

    const uid          = session?.user?.id      || '';
    const accessToken  = session?.access_token  || '';
    const refreshToken = session?.refresh_token || '';
    const expiresAt    = session?.expires_at    || 0;

    if (!uid || !accessToken) return null;

    // Token encore valide (marge 60s)
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt - now > 60) return { uid, token: accessToken };

    // Token expiré → rafraîchir via backend
    if (!refreshToken) return null;

    const res = await fetch(`${BACKEND_URL}/refresh-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      console.warn('[Arts] Rafraîchissement token échoué');
      return null;
    }

    const data = await res.json();

    const newSession = {
      ...session,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
    await Storage.setItem('harmonia_session', JSON.stringify(newSession));
    console.log('[Arts] Token rafraîchi avec succès');
    return { uid, token: data.access_token };

  } catch (e) {
    console.warn('[Arts] getValidToken error:', e);
    return null;
  }
}

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
  finished:    '#27AE60',
  danger:      '#E74C3C',
  white:       '#FFFFFF',
  voting:      '#E67E22',
  submissions: '#16A085',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'mine' | 'explore' | 'submit' | 'classement';

interface RunInfo {
  id: string;
  run_number: number;
  title: string;
  status: 'draft' | 'submissions_open' | 'voting_open' | 'finished';
  max_submissions: number;
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

  const [mySessions,  setMySessions]  = useState<SessionItem[]>([]);
  const [exploreSess, setExploreSess] = useState<SessionItem[]>([]);
  const [classement,  setClassement]  = useState<ClassementSession[]>([]);

  const [selSession,  setSelSession]  = useState<SessionItem | null>(null);
  const [runData,     setRunData]     = useState<{
    run: RunInfo | null;
    my_submissions: Submission[];
    is_enrolled: boolean;
  } | null>(null);

  // Submit
  const [submitRun,    setSubmitRun]    = useState<RunInfo | null>(null);
  const [pickedImage,  setPickedImage]  = useState<{ uri: string; ext: string } | null>(null);
  const [description,  setDescription] = useState('');
  const [uploading,    setUploading]   = useState(false);
  const [uploadStep,   setUploadStep]  = useState('');

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
    if (uid && token) loadMySessions();
  }, [uid, token]);

  // ─── API ─────────────────────────────────────────────────────────────────
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

  // ─── Chargements ─────────────────────────────────────────────────────────
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
      Alert.alert('Permission requise', "Autorisez l'accès à votre galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      setPickedImage({ uri, ext: ['jpg','jpeg','png','webp'].includes(ext) ? ext : 'jpg' });
    }
  }, []);

  // ─── Upload sécurisé ─────────────────────────────────────────────────────
  // Étape 1 : backend génère Signed Upload URL
  // Étape 2 : frontend PUT l'image directement sur Supabase Storage
  // Étape 3 : frontend confirme au backend avec le path
  const handleSubmit = useCallback(async () => {
    if (!pickedImage || !submitRun) return;
    setUploading(true); setError('');

    try {
      // ── Étape 1 : Demander la signed URL ─────────────────────────────────
      setUploadStep('Préparation de l\'upload…');
      const urlData = await api({
        function: 'getUploadUrl',
        run_id:   submitRun.id,
        file_ext: pickedImage.ext,
      });

      const { signed_url, path } = urlData;

      // ── Étape 2 : Uploader l'image via signed URL ─────────────────────────
      setUploadStep('Envoi de l\'image…');
      const response  = await fetch(pickedImage.uri);
      const blob      = await response.blob();

      const uploadRes = await fetch(signed_url, {
        method:  'PUT',
        headers: { 'Content-Type': `image/${pickedImage.ext}` },
        body:    blob,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload échoué (${uploadRes.status})`);
      }

      // ── Étape 3 : Confirmer la soumission au backend ──────────────────────
      setUploadStep('Enregistrement…');
      await api({
        function:    'submitImage',
        run_id:      submitRun.id,
        path,
        description: description.trim() || null,
      });

      haptic.success();
      setPickedImage(null);
      setDescription('');
      setUploadStep('');
      Alert.alert('✅ Soumis !', 'Votre œuvre a été soumise avec succès.');

      if (selSession) await loadRunForSession(selSession);
    } catch (e: any) {
      setError(e.message);
      haptic.error();
      setUploadStep('');
    } finally { setUploading(false); }
  }, [pickedImage, submitRun, description, api, selSession, loadRunForSession]);

  // ─── Navigation tabs ──────────────────────────────────────────────────────
  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSelSession(null);
    setRunData(null);
    setError('');
    if (t === 'explore')    loadExplore();
    if (t === 'classement') loadClassement();
    if (t === 'mine')       loadMySessions();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'mine',       label: 'Sessions',   icon: 'person'        },
    { key: 'explore',    label: 'Explorer',   icon: 'compass'       },
    { key: 'submit',     label: 'Soumettre',  icon: 'cloud-upload'  },
    { key: 'classement', label: 'Classement', icon: 'trophy'        },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>

      <LinearGradient colors={['#1A0A2E', '#080C0A']} style={styles.header}>
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
            <Ionicons name={t.icon as any} size={20} color={tab === t.key ? C.purpleLight : C.muted} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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

          {/* ─── MES SESSIONS ─── */}
          {tab === 'mine' && !selSession && (
            mySessions.length === 0
              ? <Empty icon="easel-outline" text="Aucune session rejointe" hint="Explorez les concours disponibles" />
              : mySessions.map(s => (
                  <TouchableOpacity key={s.id} style={styles.card} onPress={() => loadRunForSession(s)} activeOpacity={0.8}>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.description ? <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text> : null}
                      {s.current_run
                        ? <RunStatusBadge status={s.current_run.status} />
                        : <View style={styles.noRunBadge}><Text style={styles.noRunText}>Aucun run actif</Text></View>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.muted} style={{ margin: 16 }} />
                  </TouchableOpacity>
                ))
          )}

          {/* Détail session */}
          {tab === 'mine' && selSession && runData && (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => { setSelSession(null); setRunData(null); }}>
                <Ionicons name="arrow-back" size={18} color={C.purpleLight} />
                <Text style={styles.backRowText}>Retour</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>{selSession.title}</Text>

              {!runData.run
                ? <Empty icon="time-outline" text="Aucun run actif pour cette session" />
                : (
                  <View style={styles.runBox}>
                    <View style={styles.runBoxTop}>
                      <RunStatusBadge status={runData.run.status} />
                      <Text style={styles.runTitle}>Run #{runData.run.run_number} — {runData.run.title}</Text>
                    </View>
                    <InfoRow icon="images-outline" label="Max soumissions" value={String(runData.run.max_submissions)} />

                    {!runData.is_enrolled && runData.run.status !== 'draft' && (
                      <View style={styles.alertBanner}>
                        <Ionicons name="information-circle" size={16} color={C.gold} />
                        <Text style={styles.alertText}>Vous n'êtes pas encore inscrit à ce run</Text>
                      </View>
                    )}

                    {runData.run.status === 'submissions_open' && runData.is_enrolled && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => { setSubmitRun(runData.run); setTab('submit'); }}
                      >
                        <Ionicons name="cloud-upload" size={18} color={C.white} />
                        <Text style={styles.actionBtnText}>Soumettre une œuvre</Text>
                      </TouchableOpacity>
                    )}

                    {runData.my_submissions.length > 0 && (
                      <>
                        <Text style={styles.subTitle}>Mes soumissions ({runData.my_submissions.length}/{runData.run.max_submissions})</Text>
                        <View style={styles.thumbGrid}>
                          {runData.my_submissions.map(sub => (
                            <View key={sub.id} style={styles.thumbItem}>
                              <Image source={{ uri: sub.image_url }} style={styles.thumbImg} />
                              {sub.description
                                ? <Text style={styles.thumbDesc} numberOfLines={2}>{sub.description}</Text>
                                : null}
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}
            </>
          )}

          {/* ─── EXPLORER ─── */}
          {tab === 'explore' && (
            exploreSess.length === 0
              ? <Empty icon="search-outline" text="Aucun concours disponible" hint="Revenez plus tard" />
              : exploreSess.map(s => (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.description ? <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text> : null}
                      {s.is_paid && (
                        <View style={styles.paidBadge}><Text style={styles.paidText}>{s.price_cfa} CFA</Text></View>
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

          {/* ─── SOUMETTRE ─── */}
          {tab === 'submit' && (
            !submitRun ? (
              <>
                <Text style={styles.sectionTitle}>Choisir un run</Text>
                {mySessions.filter(s => s.current_run?.status === 'submissions_open').length === 0
                  ? <Empty icon="cloud-upload-outline" text="Aucun run ouvert aux soumissions" hint="Attendez que l'administrateur ouvre les soumissions" />
                  : mySessions
                      .filter(s => s.current_run?.status === 'submissions_open')
                      .map(s => (
                        <TouchableOpacity key={s.id} style={styles.card} onPress={() => setSubmitRun(s.current_run!)} activeOpacity={0.8}>
                          <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>{s.title}</Text>
                            <Text style={styles.cardDesc}>Run #{s.current_run!.run_number} — {s.current_run!.title}</Text>
                            <RunStatusBadge status="submissions_open" />
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={C.muted} style={{ margin: 16 }} />
                        </TouchableOpacity>
                      ))}
              </>
            ) : (
              <View style={styles.submitForm}>
                <TouchableOpacity style={styles.backRow} onPress={() => { setSubmitRun(null); setPickedImage(null); setDescription(''); }}>
                  <Ionicons name="arrow-back" size={18} color={C.purpleLight} />
                  <Text style={styles.backRowText}>Choisir un autre run</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Run #{submitRun.run_number} — {submitRun.title}</Text>

                {/* Zone image */}
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8} disabled={uploading}>
                  {pickedImage ? (
                    <Image source={{ uri: pickedImage.uri }} style={styles.pickedImage} />
                  ) : (
                    <View style={styles.imagePickerEmpty}>
                      <Ionicons name="image-outline" size={48} color={C.muted} />
                      <Text style={styles.imagePickerText}>Appuyer pour choisir une image</Text>
                      <Text style={styles.imagePickerHint}>JPG, PNG, WEBP autorisés</Text>
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
                  editable={!uploading}
                />

                {/* Étape upload en cours */}
                {!!uploadStep && (
                  <View style={styles.uploadStepRow}>
                    <ActivityIndicator size="small" color={C.purpleLight} />
                    <Text style={styles.uploadStepText}>{uploadStep}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, !pickedImage && styles.actionBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!pickedImage || uploading}
                >
                  {uploading
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <>
                        <Ionicons name="cloud-upload" size={18} color={C.white} />
                        <Text style={styles.actionBtnText}>Soumettre mon œuvre</Text>
                      </>}
                </TouchableOpacity>
              </View>
            )
          )}

          {/* ─── CLASSEMENT ─── */}
          {tab === 'classement' && (
            classement.length === 0
              ? <Empty icon="trophy-outline" text="Aucun résultat disponible" hint="Le classement apparaît quand les votes sont ouverts" />
              : classement.map(session => (
                  <View key={session.id} style={styles.classSessionBox}>
                    <Text style={styles.classSessionTitle}>🎨 {session.title}</Text>
                    {session.runs.length === 0
                      ? <Text style={styles.classMuted}>Aucun run disponible</Text>
                      : session.runs.map(run => (
                          <View key={run.id} style={styles.classRunBox}>
                            <View style={styles.classRunHeader}>
                              <RunStatusBadge status={run.status} />
                              <Text style={styles.classRunTitle}>Run #{run.run_number} — {run.title}</Text>
                            </View>
                            {run.classement.length === 0
                              ? <Text style={styles.classMuted}>Aucune soumission</Text>
                              : run.classement.map((entry, i) => (
                                  <View key={entry.user_id} style={[styles.classRow, i === 0 && styles.classRow1]}>
                                    <Text style={styles.classRankText}>
                                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank}`}
                                    </Text>
                                    <Text style={styles.classNameText}>{entry.prenom} {entry.nom}</Text>
                                    <View style={styles.classVotes}>
                                      <Ionicons name="heart" size={13} color={C.danger} />
                                      <Text style={styles.classVotesText}>{entry.total_votes}</Text>
                                    </View>
                                  </View>
                                ))}
                          </View>
                        ))}
                  </View>
                ))
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────
function RunStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    draft:            { bg: '#1A0A2E', text: C.purpleLight, label: '📝 Brouillon'           },
    submissions_open: { bg: '#0A2A22', text: C.submissions, label: '🖼️ Soumissions ouvertes' },
    voting_open:      { bg: '#2A1500', text: C.voting,      label: '🗳️ Votes ouverts'       },
    finished:         { bg: '#0A2A10', text: C.finished,    label: '🏆 Terminé'             },
  };
  const c = cfg[status] ?? { bg: '#1A1A1A', text: C.muted, label: status };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={14} color={C.muted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

  card:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
              borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardBody: { flex: 1, padding: 16, gap: 8 },
  cardTitle:{ color: C.cream, fontSize: 16, fontWeight: '700' },
  cardDesc: { color: C.muted, fontSize: 13 },

  badge:    { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText:{ fontSize: 12, fontWeight: '700' },

  noRunBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
                borderRadius: 8, backgroundColor: '#1A1A1A' },
  noRunText:  { color: C.muted, fontSize: 12 },

  paidBadge: { alignSelf: 'flex-start', backgroundColor: '#2A1A00', borderRadius: 6,
               paddingHorizontal: 8, paddingVertical: 3 },
  paidText:  { color: C.gold, fontSize: 11, fontWeight: '700' },

  joinBtn:     { margin: 16, padding: 14, borderRadius: 12,
                 backgroundColor: C.purple, alignItems: 'center' },
  joinBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  backRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backRowText: { color: C.purpleLight, fontSize: 14, fontWeight: '600' },

  sectionTitle: { color: C.cream, fontSize: 18, fontWeight: '800', marginBottom: 12 },

  runBox:    { backgroundColor: C.surface, borderRadius: 14, padding: 16,
               borderWidth: 1, borderColor: C.border, gap: 10 },
  runBoxTop: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  runTitle:  { color: C.cream, fontSize: 15, fontWeight: '700', flex: 1 },

  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { color: C.muted, fontSize: 12, flex: 1 },
  infoValue: { color: C.cream, fontSize: 12, fontWeight: '700' },

  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8,
                 backgroundColor: '#2A1A00', borderRadius: 8, padding: 10 },
  alertText:   { color: C.gold, fontSize: 12, flex: 1 },

  actionBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                       gap: 8, backgroundColor: C.purple, borderRadius: 12, padding: 14 },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText:     { color: C.white, fontWeight: '700', fontSize: 15 },

  subTitle:  { color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbItem: { width: 100, gap: 4 },
  thumbImg:  { width: 100, height: 100, borderRadius: 10, backgroundColor: C.surfaceHigh },
  thumbDesc: { color: C.muted, fontSize: 11 },

  submitForm:       { gap: 16 },
  imagePicker:      { height: 220, backgroundColor: C.surface, borderRadius: 14,
                      borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  imagePickerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePickerText:  { color: C.muted, fontSize: 13 },
  imagePickerHint:  { color: C.muted, fontSize: 11, opacity: 0.6 },
  pickedImage:      { width: '100%', height: '100%', resizeMode: 'cover' },
  inputLabel:       { color: C.muted, fontSize: 13, fontWeight: '600' },
  textInput:        { backgroundColor: C.surface, borderRadius: 10, padding: 12,
                      color: C.cream, fontSize: 14, borderWidth: 1, borderColor: C.border,
                      textAlignVertical: 'top', minHeight: 80 },
  uploadStepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: C.surfaceHigh, borderRadius: 10, padding: 12 },
  uploadStepText:   { color: C.purpleLight, fontSize: 13 },

  classSessionBox:   { marginBottom: 20 },
  classSessionTitle: { color: C.cream, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  classRunBox:       { backgroundColor: C.surface, borderRadius: 14, padding: 14,
                       borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  classRunHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8,
                       marginBottom: 10, flexWrap: 'wrap' },
  classRunTitle:     { color: C.cream, fontSize: 14, fontWeight: '700', flex: 1 },
  classMuted:        { color: C.muted, fontSize: 12, paddingVertical: 8 },
  classRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                       borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  classRow1:         { borderTopWidth: 0 },
  classRankText:     { width: 32, textAlign: 'center', color: C.muted, fontSize: 14, fontWeight: '700' },
  classNameText:     { flex: 1, color: C.cream, fontSize: 14, fontWeight: '600' },
  classVotes:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classVotesText:    { color: C.cream, fontSize: 14, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center' },
  emptyHint: { color: C.muted, fontSize: 12, textAlign: 'center', opacity: 0.7 },
});
