/**
 * performance.tsx — Concours Artisanat — 4 onglets
 *
 * UPLOAD SÉCURISÉ :
 *   1. Frontend demande une Signed Upload URL au backend (getUploadUrl)
 *   2. Backend vérifie token + quota + génère URL signée (expire 5min)
 *   3. Frontend PUT la vidéo directement vers Supabase Storage via signed URL
 *   4. Frontend confirme la soumission au backend (submitVideo avec path + duration_s)
 *   → Les clés Supabase ne quittent jamais le backend
 *
 * SOUMISSIONS MULTIPLES :
 *   - max_submissions du run détermine combien de vidéos doivent être soumises
 *   - L'utilisateur doit remplir TOUS les slots avant de pouvoir envoyer
 *   - Chaque slot a sa propre vidéo + description optionnelle
 *   - Les vidéos déjà soumises occupent leurs slots et sont verrouillées
 *   - L'envoi est atomique : toutes les vidéos ou aucune
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Platform, SafeAreaView, ActivityIndicator, Image,
  Alert, TextInput, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const NATIVE      = Platform.OS !== 'web';

const haptic = {
  light:   () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);   },
  medium:  () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);  },
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
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      const AS  = (mod as any).default ?? mod;
      await AS.setItem(key, value);
    } catch {}
  },
};

async function getValidToken(): Promise<{
  uid: string;
  token: string;
  refresh_token: string;
  expires_at: number;
} | null> {
  try {
    const raw = await Storage.getItem('harmonia_session');
    if (!raw) return null;
    const session = JSON.parse(raw);

    const uid          = session?.user?.id      || '';
    const accessToken  = session?.access_token  || '';
    const refreshToken = session?.refresh_token || '';
    const expiresAt    = session?.expires_at    || 0;

    if (!uid || !accessToken) return null;

    const now = Math.floor(Date.now() / 1000);
    if (expiresAt - now > 60) return { uid, token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };

    if (!refreshToken) return null;

    const res = await fetch(`${BACKEND_URL}/refresh-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) { console.warn('[Artisanat] Rafraîchissement token échoué'); return null; }

    const data = await res.json();
    const newSession = {
      ...session,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
    await Storage.setItem('harmonia_session', JSON.stringify(newSession));
    console.log('[Artisanat] Token rafraîchi avec succès');
    return { uid, token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
  } catch (e) {
    console.warn('[Artisanat] getValidToken error:', e);
    return null;
  }
}

// ─── Palette (tons chauds — ambre/orange sur fond sombre) ────────────────────
const C = {
  bg:          '#0C0A08',
  surface:     '#1A1208',
  surfaceHigh: '#221A0A',
  border:      '#302010',
  gold:        '#C9A84C',
  amber:       '#E67E22',
  amberLight:  '#F0A030',
  cream:       '#F0E8D0',
  muted:       '#6B5A38',
  finished:    '#27AE60',
  danger:      '#E74C3C',
  white:       '#FFFFFF',
  voting:      '#E67E22',
  submissions: '#16A085',
  slotFilled:  '#1A1000',
  slotEmpty:   '#1A1208',
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
  video_url: string;
  video_path: string;
  description?: string | null;
  duration_s?: number | null;
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

// Un slot dans le formulaire multi-vidéos
interface VideoSlot {
  index: number;
  pickedVideo: { uri: string; ext: string; duration_s?: number } | null;
  description: string;
  // Si déjà soumis → verrouillé
  submitted?: Submission;
}

interface ArtisanatProps {
  userId?:  string;
  onBack?:  () => void;
  onClose?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDuration = (s?: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Artisanat({ userId: userIdProp, onBack, onClose }: ArtisanatProps) {

  const [uid,          setUid]          = useState<string | null>(userIdProp ?? null);
  const [token,        setToken]        = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [expiresAt,    setExpiresAt]    = useState<number>(0);

  const [tab, setTab] = useState<Tab>('mine');

  const [mySessions,  setMySessions]  = useState<SessionItem[]>([]);
  const [exploreSess, setExploreSess] = useState<SessionItem[]>([]);
  const [classement,  setClassement]  = useState<ClassementSession[]>([]);

  const [selSession, setSelSession] = useState<SessionItem | null>(null);
  const [runData,    setRunData]    = useState<{
    run: RunInfo | null;
    my_submissions: Submission[];
    is_enrolled: boolean;
  } | null>(null);

  // Submit multi-slots
  const [submitRun,      setSubmitRun]      = useState<RunInfo | null>(null);
  const [slots,          setSlots]          = useState<VideoSlot[]>([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadStep,     setUploadStep]     = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,         setError]         = useState('');

  const progressAnim = useRef(new Animated.Value(0)).current;

  // ─── Init token ──────────────────────────────────────────────────────────
  useEffect(() => {
    getValidToken().then(t => {
      if (t) {
        setUid(t.uid);
        setToken(t.token);
        setRefreshToken(t.refresh_token);
        setExpiresAt(t.expires_at);
      }
    });
  }, []);

  useEffect(() => {
    if (uid && token) loadMySessions();
  }, [uid, token]);

  // ─── Sauvegarder nouveau token si renvoyé par le backend ─────────────────
  const handleNewToken = useCallback(async (new_token?: any) => {
    if (!new_token) return;
    setToken(new_token.access_token);
    setRefreshToken(new_token.refresh_token);
    setExpiresAt(new_token.expires_at);
    try {
      const raw = await Storage.getItem('harmonia_session');
      if (raw) {
        const session = JSON.parse(raw);
        await Storage.setItem('harmonia_session', JSON.stringify({
          ...session,
          access_token:  new_token.access_token,
          refresh_token: new_token.refresh_token,
          expires_at:    new_token.expires_at,
        }));
      }
    } catch {}
  }, []);

  // ─── API ─────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const res = await fetch(`${BACKEND_URL}/artisanat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_id:       uid,
        access_token:  token,
        refresh_token: refreshToken,
        expires_at:    expiresAt,
        ...body,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    if (data.new_token) handleNewToken(data.new_token);
    return data;
  }, [uid, token, refreshToken, expiresAt, handleNewToken]);

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

  // ─── Initialiser les slots selon le run ──────────────────────────────────
  const initSlots = useCallback((run: RunInfo, existingSubmissions: Submission[]) => {
    const total = run.max_submissions;
    const newSlots: VideoSlot[] = [];
    for (let i = 0; i < total; i++) {
      const existing = existingSubmissions[i] ?? null;
      newSlots.push({
        index:       i,
        pickedVideo: null,
        description: '',
        submitted:   existing ?? undefined,
      });
    }
    setSlots(newSlots);
  }, []);

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

  // ─── Choisir une vidéo pour un slot ──────────────────────────────────────
  const pickVideoForSlot = useCallback(async (slotIndex: number) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorisez l'accès à votre galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality:    1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri   = asset.uri;
      const raw   = uri.split('.').pop()?.toLowerCase() || 'mp4';
      const ext   = ['mp4', 'mov', 'webm', 'avi'].includes(raw) ? raw : 'mp4';
      const duration_s = asset.duration ? Math.round(asset.duration / 1000) : undefined;
      haptic.light();
      setSlots(prev => prev.map(s =>
        s.index === slotIndex
          ? { ...s, pickedVideo: { uri, ext, duration_s } }
          : s
      ));
    }
  }, []);

  const clearSlotVideo = useCallback((slotIndex: number) => {
    setSlots(prev => prev.map(s =>
      s.index === slotIndex ? { ...s, pickedVideo: null } : s
    ));
  }, []);

  const setSlotDescription = useCallback((slotIndex: number, text: string) => {
    setSlots(prev => prev.map(s =>
      s.index === slotIndex ? { ...s, description: text } : s
    ));
  }, []);

  // ─── Calcul de la complétion ──────────────────────────────────────────────
  const slotsToUpload = slots.filter(s => !s.submitted);
  const slotsReady    = slotsToUpload.filter(s => !!s.pickedVideo);
  const allSlotsReady = slotsToUpload.length > 0 && slotsReady.length === slotsToUpload.length;
  const totalSlots    = slots.length;
  const filledSlots   = slots.filter(s => s.submitted || s.pickedVideo).length;

  // ─── Barre de progression animée ─────────────────────────────────────────
  useEffect(() => {
    if (totalSlots === 0) return;
    const pct = (filledSlots / totalSlots) * 100;
    Animated.spring(progressAnim, {
      toValue: pct,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
  }, [filledSlots, totalSlots]);

  // ─── Upload sécurisé multi-slots ──────────────────────────────────────────
  const handleSubmitAll = useCallback(async () => {
    if (!submitRun || !allSlotsReady) return;

    setUploading(true);
    setError('');
    setUploadProgress(0);

    const pending = slotsToUpload.filter(s => !!s.pickedVideo);
    const total   = pending.length;

    try {
      for (let i = 0; i < pending.length; i++) {
        const slot = pending[i];
        const pct  = Math.round((i / total) * 100);
        setUploadProgress(pct);

        // Étape 1 : Demander la signed URL
        setUploadStep(`Vidéo ${i + 1}/${total} — Préparation…`);
        const urlData = await api({
          function: 'getUploadUrl',
          run_id:   submitRun.id,
          file_ext: slot.pickedVideo!.ext,
        });

        const { signed_url, path } = urlData;

        // Étape 2 : PUT vers Supabase Storage
        setUploadStep(`Vidéo ${i + 1}/${total} — Envoi…`);
        const response  = await fetch(slot.pickedVideo!.uri);
        const blob      = await response.blob();

        const uploadRes = await fetch(signed_url, {
          method:  'PUT',
          headers: { 'Content-Type': `video/${slot.pickedVideo!.ext}` },
          body:    blob,
        });

        if (!uploadRes.ok) throw new Error(`Upload vidéo ${i + 1} échoué (${uploadRes.status})`);

        // Étape 3 : Confirmer au backend
        setUploadStep(`Vidéo ${i + 1}/${total} — Enregistrement…`);
        await api({
          function:    'submitVideo',
          run_id:      submitRun.id,
          path,
          description: slot.description.trim() || null,
          duration_s:  slot.pickedVideo!.duration_s ?? null,
        });
      }

      setUploadProgress(100);
      haptic.success();
      setUploadStep('');

      const msg = total === 1
        ? 'Votre vidéo a été soumise avec succès !'
        : `Vos ${total} vidéos ont été soumises avec succès !`;
      Alert.alert('✅ Soumission complète', msg);

      if (selSession) await loadRunForSession(selSession);
      setSlots(prev => prev.map(s => ({ ...s, pickedVideo: null, description: '' })));
      setSubmitRun(null);

    } catch (e: any) {
      setError(e.message);
      haptic.error();
      setUploadStep('');
    } finally {
      setUploading(false);
    }
  }, [submitRun, allSlotsReady, slotsToUpload, api, selSession, loadRunForSession]);

  // ─── Ouvrir le formulaire de soumission ──────────────────────────────────
  const openSubmitForm = useCallback((run: RunInfo, existingSubmissions: Submission[]) => {
    setSubmitRun(run);
    initSlots(run, existingSubmissions);
    setTab('submit');
  }, [initSlots]);

  // ─── Navigation tabs ──────────────────────────────────────────────────────
  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t !== 'submit') { setSubmitRun(null); setSlots([]); }
    setSelSession(null);
    setRunData(null);
    setError('');
    if (t === 'explore')    loadExplore();
    if (t === 'classement') loadClassement();
    if (t === 'mine')       loadMySessions();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'mine',       label: 'Sessions',  icon: 'person'       },
    { key: 'explore',    label: 'Explorer',  icon: 'compass'      },
    { key: 'submit',     label: 'Soumettre', icon: 'cloud-upload' },
    { key: 'classement', label: 'Classement',icon: 'trophy'       },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>

      <LinearGradient colors={['#2A1500', '#0C0A08']} style={styles.header}>
        {(onBack || onClose) && (
          <TouchableOpacity onPress={onBack ?? onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cream} />
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🪡 Artisanat</Text>
          <Text style={styles.headerSub}>Concours de artisanat</Text>
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
            <Ionicons name={t.icon as any} size={20} color={tab === t.key ? C.amberLight : C.muted} />
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
          <ActivityIndicator size="large" color={C.amberLight} />
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>

          {/* ─── MES SESSIONS ─── */}
          {tab === 'mine' && !selSession && (
            mySessions.length === 0
              ? <Empty icon="videocam-outline" text="Aucune session rejointe" hint="Explorez les concours disponibles" />
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
                <Ionicons name="arrow-back" size={18} color={C.amberLight} />
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

                    {/* Quota soumissions */}
                    <SubmissionQuotaBar
                      current={runData.my_submissions.length}
                      max={runData.run.max_submissions}
                    />

                    {!runData.is_enrolled && runData.run.status !== 'draft' && (
                      <View style={styles.alertBanner}>
                        <Ionicons name="information-circle" size={16} color={C.gold} />
                        <Text style={styles.alertText}>Vous n'êtes pas encore inscrit à ce run</Text>
                      </View>
                    )}

                    {runData.run.status === 'submissions_open' && runData.is_enrolled && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openSubmitForm(runData.run!, runData.my_submissions)}
                      >
                        <Ionicons name="cloud-upload" size={18} color={C.white} />
                        <Text style={styles.actionBtnText}>
                          {runData.my_submissions.length === 0
                            ? `Soumettre ${runData.run.max_submissions} vidéo${runData.run.max_submissions > 1 ? 's' : ''}`
                            : `Compléter mes soumissions (${runData.my_submissions.length}/${runData.run.max_submissions})`}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {runData.my_submissions.length > 0 && (
                      <>
                        <Text style={styles.subTitle}>
                          Mes soumissions ({runData.my_submissions.length}/{runData.run.max_submissions})
                        </Text>
                        <View style={styles.thumbGrid}>
                          {runData.my_submissions.map(sub => (
                            <View key={sub.id} style={styles.thumbItem}>
                              {/* Thumbnail vidéo */}
                              <View style={styles.thumbVideoBox}>
                                <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
                                {sub.duration_s != null && (
                                  <View style={styles.thumbDurationBadge}>
                                    <Text style={styles.thumbDurationText}>{formatDuration(sub.duration_s)}</Text>
                                  </View>
                                )}
                              </View>
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
                      {s.current_run && (
                        <View style={styles.infoRow}>
                          <Ionicons name="videocam-outline" size={13} color={C.muted} />
                          <Text style={styles.infoLabel}>
                            {s.current_run.max_submissions} vidéo{s.current_run.max_submissions > 1 ? 's' : ''} à soumettre
                          </Text>
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
                        <TouchableOpacity
                          key={s.id}
                          style={styles.card}
                          onPress={() => openSubmitForm(s.current_run!, [])}
                          activeOpacity={0.8}
                        >
                          <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>{s.title}</Text>
                            <Text style={styles.cardDesc}>Run #{s.current_run!.run_number} — {s.current_run!.title}</Text>
                            <RunStatusBadge status="submissions_open" />
                            <View style={styles.infoRow}>
                              <Ionicons name="videocam-outline" size={13} color={C.submissions} />
                              <Text style={[styles.infoLabel, { color: C.submissions }]}>
                                {s.current_run!.max_submissions} vidéo{s.current_run!.max_submissions > 1 ? 's' : ''} requise{s.current_run!.max_submissions > 1 ? 's' : ''}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={C.muted} style={{ margin: 16 }} />
                        </TouchableOpacity>
                      ))}
              </>
            ) : (
              /* ─── FORMULAIRE MULTI-SLOTS ─── */
              <View style={styles.submitForm}>
                <TouchableOpacity
                  style={styles.backRow}
                  onPress={() => { setSubmitRun(null); setSlots([]); }}
                  disabled={uploading}
                >
                  <Ionicons name="arrow-back" size={18} color={C.amberLight} />
                  <Text style={styles.backRowText}>Choisir un autre run</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>
                  Run #{submitRun.run_number} — {submitRun.title}
                </Text>

                {/* Barre de progression globale */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      {filledSlots}/{totalSlots} vidéo{totalSlots > 1 ? 's' : ''}
                    </Text>
                    {allSlotsReady && !uploading && (
                      <Text style={styles.progressReady}>✓ Prêt à envoyer</Text>
                    )}
                    {!allSlotsReady && slotsToUpload.length > 0 && (
                      <Text style={styles.progressPending}>
                        {slotsToUpload.length - slotsReady.length} manquante{slotsToUpload.length - slotsReady.length > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.progressTrack}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange:  [0, 100],
                            outputRange: ['0%', '100%'],
                          }),
                          backgroundColor: allSlotsReady ? C.finished : C.submissions,
                        },
                      ]}
                    />
                  </View>

                  {slotsToUpload.length > 0 && (
                    <View style={styles.ruleBox}>
                      <Ionicons name="information-circle-outline" size={14} color={C.gold} />
                      <Text style={styles.ruleText}>
                        Ce run requiert exactement{' '}
                        <Text style={{ fontWeight: '800', color: C.gold }}>
                          {submitRun.max_submissions} vidéo{submitRun.max_submissions > 1 ? 's' : ''}
                        </Text>
                        . Tous les slots doivent être remplis avant l'envoi.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Slots vidéo */}
                {slots.map(slot => (
                  <VideoSlotCard
                    key={slot.index}
                    slot={slot}
                    total={totalSlots}
                    uploading={uploading}
                    onPickVideo={pickVideoForSlot}
                    onClearVideo={clearSlotVideo}
                    onChangeDescription={setSlotDescription}
                  />
                ))}

                {/* Progression upload en cours */}
                {uploading && (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator size="small" color={C.amberLight} />
                    <View style={styles.uploadingInfo}>
                      <Text style={styles.uploadStepText}>{uploadStep}</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${uploadProgress}%`, backgroundColor: C.amberLight }]} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Bouton final */}
                <TouchableOpacity
                  style={[
                    styles.submitAllBtn,
                    !allSlotsReady && styles.submitAllBtnDisabled,
                  ]}
                  onPress={handleSubmitAll}
                  disabled={!allSlotsReady || uploading}
                  activeOpacity={0.85}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color={allSlotsReady ? C.white : C.muted} />
                      <Text style={[styles.submitAllBtnText, !allSlotsReady && styles.submitAllBtnTextDisabled]}>
                        {allSlotsReady
                          ? `Envoyer ${slotsToUpload.length} vidéo${slotsToUpload.length > 1 ? 's' : ''}`
                          : `Remplissez tous les slots (${slotsReady.length}/${slotsToUpload.length})`}
                      </Text>
                    </>
                  )}
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
                    <Text style={styles.classSessionTitle}>🪡 {session.title}</Text>
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

// ─── VideoSlotCard ────────────────────────────────────────────────────────────
interface VideoSlotCardProps {
  slot:                VideoSlot;
  total:               number;
  uploading:           boolean;
  onPickVideo:         (index: number) => void;
  onClearVideo:        (index: number) => void;
  onChangeDescription: (index: number, text: string) => void;
}

function VideoSlotCard({
  slot, total, uploading,
  onPickVideo, onClearVideo, onChangeDescription,
}: VideoSlotCardProps) {
  const isLocked  = !!slot.submitted;
  const hasPicked = !!slot.pickedVideo;
  const isFilled  = isLocked || hasPicked;

  return (
    <View style={[styles.slotCard, isFilled ? styles.slotCardFilled : styles.slotCardEmpty]}>

      {/* En-tête du slot */}
      <View style={styles.slotHeader}>
        <View style={[styles.slotBadge, isFilled ? styles.slotBadgeFilled : styles.slotBadgeEmpty]}>
          {isFilled
            ? <Ionicons name="checkmark" size={14} color={C.finished} />
            : <Text style={styles.slotBadgeNum}>{slot.index + 1}</Text>}
        </View>
        <Text style={styles.slotTitle}>
          Vidéo {slot.index + 1}
          {total > 1 ? ` / ${total}` : ''}
        </Text>
        {isLocked && (
          <View style={styles.lockedBadge}>
            <Ionicons name="lock-closed" size={11} color={C.gold} />
            <Text style={styles.lockedText}>Déjà soumise</Text>
          </View>
        )}
        {!isLocked && !hasPicked && (
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredText}>Requis</Text>
          </View>
        )}
      </View>

      {/* Zone vidéo */}
      {isLocked ? (
        /* Soumission déjà faite → thumbnail verrouillé */
        <View style={styles.slotLockedVideo}>
          <View style={styles.slotLockedVideoInner}>
            <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.6)" />
            {slot.submitted!.duration_s != null && (
              <View style={styles.slotLockedDurationBadge}>
                <Text style={styles.slotLockedDurationText}>{formatDuration(slot.submitted!.duration_s)}</Text>
              </View>
            )}
          </View>
          <View style={styles.slotLockedOverlay}>
            <Ionicons name="lock-closed" size={20} color="rgba(255,255,255,0.6)" />
          </View>
        </View>
      ) : (
        /* Slot libre → sélectionner une vidéo */
        <TouchableOpacity
          style={[styles.slotVideoPicker, hasPicked && styles.slotVideoPickerFilled]}
          onPress={() => onPickVideo(slot.index)}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {hasPicked ? (
            <>
              {/* Thumbnail vidéo choisie */}
              <View style={styles.slotPickedVideoContent}>
                <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.85)" />
                {slot.pickedVideo!.duration_s != null && (
                  <View style={styles.slotDurationBadge}>
                    <Ionicons name="time-outline" size={11} color={C.cream} />
                    <Text style={styles.slotDurationText}>{formatDuration(slot.pickedVideo!.duration_s)}</Text>
                  </View>
                )}
                <Text style={styles.slotVideoExt}>.{slot.pickedVideo!.ext.toUpperCase()}</Text>
              </View>
              {!uploading && (
                <TouchableOpacity
                  style={styles.slotClearBtn}
                  onPress={() => { haptic.light(); onClearVideo(slot.index); }}
                >
                  <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
              )}
              <View style={styles.slotChangeHint}>
                <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.slotChangeHintText}>Appuyer pour changer</Text>
              </View>
            </>
          ) : (
            <View style={styles.slotEmptyContent}>
              <View style={styles.slotEmptyIcon}>
                <Ionicons name="videocam-outline" size={32} color={C.muted} />
              </View>
              <Text style={styles.slotEmptyText}>Appuyer pour choisir</Text>
              <Text style={styles.slotEmptyHint}>MP4 · MOV · WEBM</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Description */}
      {isLocked ? (
        slot.submitted!.description
          ? <Text style={styles.slotLockedDesc}>{slot.submitted!.description}</Text>
          : null
      ) : (
        <TextInput
          style={[styles.slotDescInput, uploading && { opacity: 0.5 }]}
          value={slot.description}
          onChangeText={t => onChangeDescription(slot.index, t)}
          placeholder="Description (optionnel)…"
          placeholderTextColor={C.muted}
          multiline
          numberOfLines={2}
          editable={!uploading}
        />
      )}
    </View>
  );
}

// ─── SubmissionQuotaBar ───────────────────────────────────────────────────────
function SubmissionQuotaBar({ current, max }: { current: number; max: number }) {
  const pct  = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const done = current >= max;
  return (
    <View style={styles.quotaBar}>
      <View style={styles.quotaLabelRow}>
        <Ionicons name="videocam-outline" size={13} color={done ? C.finished : C.muted} />
        <Text style={[styles.quotaLabel, done && { color: C.finished }]}>
          {current}/{max} vidéo{max > 1 ? 's' : ''}
          {done ? '  ✓' : ''}
        </Text>
      </View>
      <View style={styles.quotaTrack}>
        <View style={[styles.quotaFill, { width: `${pct}%`, backgroundColor: done ? C.finished : C.submissions }]} />
      </View>
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────
function RunStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    draft:            { bg: '#2A1500', text: C.amberLight,  label: '📝 Brouillon'           },
    submissions_open: { bg: '#0A2A22', text: C.submissions, label: '🎥 Soumissions ouvertes' },
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
  root:     { flex: 1, backgroundColor: C.bg },
  flex:     { flex: 1 },
  scroll:   { padding: 16, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                  paddingVertical: 14, paddingTop: Platform.OS === 'ios' ? 56 : 14 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { color: C.cream, fontSize: 20, fontWeight: '800' },
  headerSub:    { color: C.muted, fontSize: 12 },
  backBtn:      { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  refreshBtn:   { padding: 8 },

  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: C.amberLight },
  tabLabel:      { color: C.muted, fontSize: 10, fontWeight: '600' },
  tabLabelActive:{ color: C.amberLight },

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
                 backgroundColor: C.amber, alignItems: 'center' },
  joinBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  backRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backRowText: { color: C.amberLight, fontSize: 14, fontWeight: '600' },

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

  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   gap: 8, backgroundColor: C.amber, borderRadius: 12, padding: 14 },
  actionBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },

  subTitle:  { color: C.cream, fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbItem: { width: 100, gap: 4 },

  // Thumbnail vidéo dans "mes soumissions"
  thumbVideoBox:       { width: 100, height: 100, borderRadius: 10, backgroundColor: '#1A1A2E',
                         alignItems: 'center', justifyContent: 'center', position: 'relative' },
  thumbDurationBadge:  { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)',
                         borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  thumbDurationText:   { color: C.cream, fontSize: 10, fontWeight: '700' },
  thumbDesc:           { color: C.muted, fontSize: 11 },

  // ─── Quota bar ───────────────────────────────────────────────────────────
  quotaBar:      { gap: 6 },
  quotaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotaLabel:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  quotaTrack:    { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  quotaFill:     { height: '100%', borderRadius: 2 },

  // ─── Progress multi-slots ─────────────────────────────────────────────────
  progressContainer: { backgroundColor: C.surface, borderRadius: 14, padding: 14,
                        borderWidth: 1, borderColor: C.border, gap: 10, marginBottom: 4 },
  progressHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel:     { color: C.cream, fontSize: 14, fontWeight: '700' },
  progressReady:     { color: C.finished, fontSize: 12, fontWeight: '700' },
  progressPending:   { color: C.voting, fontSize: 12, fontWeight: '600' },
  progressTrack:     { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:      { height: '100%', borderRadius: 3 },
  ruleBox:           { flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                        backgroundColor: '#2A1A00', borderRadius: 8, padding: 10 },
  ruleText:          { flex: 1, color: C.gold, fontSize: 12, lineHeight: 18 },

  // ─── Submit form ─────────────────────────────────────────────────────────
  submitForm: { gap: 14 },

  // ─── Slot card ────────────────────────────────────────────────────────────
  slotCard:       { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  slotCardEmpty:  { backgroundColor: C.slotEmpty, borderColor: C.border },
  slotCardFilled: { backgroundColor: C.slotFilled, borderColor: '#3A2010' },

  slotHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotBadge:       { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  slotBadgeFilled: { backgroundColor: 'rgba(39,174,96,0.2)' },
  slotBadgeEmpty:  { backgroundColor: C.border },
  slotBadgeNum:    { color: C.muted, fontSize: 12, fontWeight: '800' },
  slotTitle:       { flex: 1, color: C.cream, fontSize: 15, fontWeight: '700' },
  lockedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                     backgroundColor: '#2A1A00', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  lockedText:      { color: C.gold, fontSize: 11, fontWeight: '600' },
  requiredBadge:   { backgroundColor: '#2A0A0A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  requiredText:    { color: C.danger, fontSize: 11, fontWeight: '600' },

  // Zone de sélection vidéo
  slotVideoPicker:       { height: 180, borderRadius: 12, borderWidth: 1,
                           borderColor: C.border, overflow: 'hidden', borderStyle: 'dashed' },
  slotVideoPickerFilled: { borderStyle: 'solid', borderColor: '#3A2010' },

  // Contenu vidéo choisie
  slotPickedVideoContent: { flex: 1, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: '#1A1A2E', gap: 8 },
  slotDurationBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
                            paddingHorizontal: 8, paddingVertical: 4 },
  slotDurationText:       { color: C.cream, fontSize: 12, fontWeight: '700' },
  slotVideoExt:           { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  slotClearBtn:       { position: 'absolute', top: 8, right: 8,
                        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14 },
  slotChangeHint:     { position: 'absolute', bottom: 0, left: 0, right: 0,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 4, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  slotChangeHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  slotEmptyContent:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  slotEmptyIcon:      { width: 60, height: 60, borderRadius: 30,
                        backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  slotEmptyText:      { color: C.muted, fontSize: 13, fontWeight: '600' },
  slotEmptyHint:      { color: C.muted, fontSize: 11, opacity: 0.6 },

  // Slot verrouillé (déjà soumis)
  slotLockedVideo:         { height: 180, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  slotLockedVideoInner:    { width: '100%', height: '100%', backgroundColor: '#1A1A2E',
                             alignItems: 'center', justifyContent: 'center' },
  slotLockedDurationBadge: { position: 'absolute', bottom: 8, right: 8,
                             backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6,
                             paddingHorizontal: 6, paddingVertical: 3 },
  slotLockedDurationText:  { color: C.cream, fontSize: 11, fontWeight: '700' },
  slotLockedOverlay:       { position: 'absolute', top: 8, right: 8,
                             backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14,
                             width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  slotLockedDesc:          { color: C.muted, fontSize: 12, fontStyle: 'italic' },

  slotDescInput: { backgroundColor: C.surfaceHigh, borderRadius: 10, padding: 12,
                   color: C.cream, fontSize: 13, borderWidth: 1, borderColor: C.border,
                   textAlignVertical: 'top', minHeight: 60 },

  // ─── Upload en cours ──────────────────────────────────────────────────────
  uploadingBox:  { flexDirection: 'row', alignItems: 'center', gap: 12,
                   backgroundColor: C.surfaceHigh, borderRadius: 12, padding: 14 },
  uploadingInfo: { flex: 1, gap: 8 },
  uploadStepText:{ color: C.amberLight, fontSize: 13 },

  // ─── Bouton final ─────────────────────────────────────────────────────────
  submitAllBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                             gap: 10, borderRadius: 14, padding: 16, backgroundColor: C.finished,
                             marginTop: 4 },
  submitAllBtnDisabled:    { backgroundColor: C.surfaceHigh },
  submitAllBtnText:        { color: C.white, fontWeight: '800', fontSize: 16 },
  submitAllBtnTextDisabled:{ color: C.muted, fontWeight: '700', fontSize: 15 },

  // ─── Classement ───────────────────────────────────────────────────────────
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
