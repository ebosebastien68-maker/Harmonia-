import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import * as ImagePicker   from 'expo-image-picker';
import DateTimePicker     from '@react-native-community/datetimepicker';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WS_BASE      = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const PROFILE_URL  = `${WS_BASE}/profile`;
const REFRESH_URL  = `${WS_BASE}/refresh-token`;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface MyProfile {
  id:             string;
  nom:            string;
  prenom:         string;
  date_naissance: string | null;
  avatar_url?:    string;
  solde_cfa:      number;
  trophies_count: number;
  created_at:     string;
}

type MessageType = 'success' | 'error' | 'info';

// ─── COMPOSANT ────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();

  const [profile,         setProfile]         = useState<MyProfile | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editMode,        setEditMode]        = useState(false);
  const [toast,           setToast]           = useState<{ type: MessageType; text: string } | null>(null);

  // Champs éditables
  const [nom,            setNom]            = useState('');
  const [prenom,         setPrenom]         = useState('');
  const [dateNaissance,  setDateNaissance]  = useState<Date>(new Date(2000, 0, 1));
  const [dateNaissanceWeb, setDateNaissanceWeb] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Token ref — évite les re-renders
  const accessTokenRef  = useRef<string>('');
  const refreshTokenRef = useRef<string>('');
  const expiresAtRef    = useRef<number>(0);

  // ─── SESSION ──────────────────────────────────────────────────────────────
  useEffect(() => { initSession() }, []);

  const initSession = async () => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (!raw) { router.replace('/login'); return; }
      const session = JSON.parse(raw);
      accessTokenRef.current  = session.access_token  || '';
      refreshTokenRef.current = session.refresh_token || '';
      expiresAtRef.current    = session.expires_at    || 0;
      await loadProfile();
    } catch {
      router.replace('/login');
    }
  };

  // Token valide avec marge de 60s
  const getValidToken = async (): Promise<string> => {
    const now = Math.floor(Date.now() / 1000);
    if (expiresAtRef.current - now > 60) return accessTokenRef.current;

    try {
      const res  = await fetch(REFRESH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshTokenRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      accessTokenRef.current  = data.access_token;
      refreshTokenRef.current = data.refresh_token;
      expiresAtRef.current    = data.expires_at;

      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) {
        const session = JSON.parse(raw);
        await AsyncStorage.setItem('harmonia_session', JSON.stringify({
          ...session,
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
          expires_at:    data.expires_at,
        }));
      }
      return data.access_token;
    } catch {
      router.replace('/login');
      return '';
    }
  };

  // ─── TOAST ────────────────────────────────────────────────────────────────
  const showToast = (type: MessageType, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── CHARGER PROFIL ───────────────────────────────────────────────────────
  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;

      const res  = await fetch(PROFILE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'get-profile', access_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProfile(data.profile);

      // Initialiser les champs éditables
      setNom(data.profile.nom || '');
      setPrenom(data.profile.prenom || '');
      if (data.profile.date_naissance) {
        const d = new Date(data.profile.date_naissance);
        setDateNaissance(d);
        setDateNaissanceWeb(data.profile.date_naissance);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  // ─── SAUVEGARDER PROFIL ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim()) {
      showToast('error', 'Nom et prénom sont obligatoires'); return;
    }
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) return;

      const dateForAPI = Platform.OS === 'web'
        ? dateNaissanceWeb
        : `${dateNaissance.getFullYear()}-${(dateNaissance.getMonth()+1).toString().padStart(2,'0')}-${dateNaissance.getDate().toString().padStart(2,'0')}`;

      const res  = await fetch(PROFILE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'update-profile',
          access_token:   token,
          nom:            nom.trim(),
          prenom:         prenom.trim(),
          date_naissance: dateForAPI,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadProfile();
      setEditMode(false);
      showToast('success', 'Profil mis à jour avec succès !');
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  // ─── UPLOAD AVATAR ────────────────────────────────────────────────────────
  const pickAndUploadAvatar = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', "Nous avons besoin d'accéder à vos photos.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const token = await getValidToken();
      if (!token) return;

      // Étape 1 — Demander le signed URL au backend
      const urlRes  = await fetch(PROFILE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'get-upload-url', access_token: token }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      const { signed_url, path } = urlData;

      // Étape 2 — Upload direct vers Supabase Storage via le signed URL
      const imageUri  = result.assets[0].uri;
      const imageBlob = await uriToBlob(imageUri);

      const uploadRes = await fetch(signed_url, {
        method:  'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body:    imageBlob,
      });

      if (!uploadRes.ok) throw new Error("Échec de l'upload vers le stockage");

      // Étape 3 — Notifier le backend pour mettre à jour profiles.avatar_url
      const updateRes  = await fetch(PROFILE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'update-avatar', access_token: token, path }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error);

      await loadProfile();
      showToast('success', 'Photo de profil mise à jour !');
    } catch (err: any) {
      showToast('error', err.message || "Impossible de mettre à jour la photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Convertir URI en Blob pour l'upload
  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (Platform.OS === 'web') {
        fetch(uri).then(r => r.blob()).then(resolve).catch(reject);
      } else {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Conversion URI → Blob échouée'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      }
    });
  };

  // ─── DATE PICKER ─────────────────────────────────────────────────────────
  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDateNaissance(selectedDate);
  };

  const formatDateDisplay = (d: Date) =>
    `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;

  const formatDateReadable = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ─── DÉCONNEXION ──────────────────────────────────────────────────────────
  const handleLogout = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('harmonia_session');
          router.replace('/login');
        },
      },
    ]);
  };

  // ─── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7B1FE8" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Impossible de charger le profil</Text>
        <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── RENDU ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── TOAST ─────────────────────────────────────────────────────────── */}
        {toast && (
          <View style={[styles.toast, styles[`toast_${toast.type}` as keyof typeof styles]]}>
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'close-circle' : 'information-circle'}
              size={20} color="#fff"
            />
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        )}

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <LinearGradient colors={['#7B1FE8', '#4B0082']} style={styles.header}>

          {/* Bouton déconnexion */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <Image
              source={
                profile.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('./assets/default-avatar.png')
              }
              style={styles.avatar}
            />
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={pickAndUploadAvatar}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>

          {/* Nom */}
          <Text style={styles.headerName}>{profile.prenom} {profile.nom}</Text>
          <Text style={styles.headerSub}>
            Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
        </LinearGradient>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <LinearGradient colors={['#10B981', '#34D399']} style={styles.statCard}>
            <Ionicons name="wallet-outline" size={26} color="#fff" />
            <Text style={styles.statValue}>{profile.solde_cfa.toLocaleString()}</Text>
            <Text style={styles.statLabel}>CFA</Text>
          </LinearGradient>

          <LinearGradient colors={['#FFD700', '#FF8C00']} style={styles.statCard}>
            <Ionicons name="trophy-outline" size={26} color="#fff" />
            <Text style={styles.statValue}>{profile.trophies_count}</Text>
            <Text style={styles.statLabel}>Trophées</Text>
          </LinearGradient>
        </View>

        {/* ── INFORMATIONS PERSONNELLES ──────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>
            {!editMode && (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)}>
                <Ionicons name="pencil-outline" size={16} color="#7B1FE8" />
                <Text style={styles.editBtnText}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* MODE LECTURE */}
          {!editMode && (
            <View style={styles.card}>
              <InfoRow icon="person-outline"   label="Nom"               value={profile.nom} />
              <Separator />
              <InfoRow icon="person-outline"   label="Prénom"            value={profile.prenom} />
              <Separator />
              <InfoRow icon="calendar-outline" label="Date de naissance"
                value={profile.date_naissance ? formatDateReadable(profile.date_naissance) : '—'} />
            </View>
          )}

          {/* MODE ÉDITION */}
          {editMode && (
            <View style={styles.card}>

              <Text style={styles.fieldLabel}>Nom</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={nom}
                  onChangeText={setNom}
                  placeholder="Votre nom"
                  placeholderTextColor="#bbb"
                  autoCapitalize="words"
                />
              </View>

              <Text style={styles.fieldLabel}>Prénom</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={prenom}
                  onChangeText={setPrenom}
                  placeholder="Votre prénom"
                  placeholderTextColor="#bbb"
                  autoCapitalize="words"
                />
              </View>

              <Text style={styles.fieldLabel}>Date de naissance</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#999" style={styles.inputIcon} />
                  <input
                    type="date"
                    value={dateNaissanceWeb}
                    onChange={e => setDateNaissanceWeb(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    min="1900-01-01"
                    style={{
                      flex: 1, padding: 12, fontSize: 15,
                      border: 'none', outline: 'none',
                      backgroundColor: 'transparent', color: '#333',
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.inputContainer}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#999" style={styles.inputIcon} />
                    <Text style={[styles.input, { paddingVertical: 14 }]}>
                      {formatDateDisplay(dateNaissance)}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#bbb" />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={dateNaissance}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onDateChange}
                      maximumDate={new Date()}
                      minimumDate={new Date(1900, 0, 1)}
                    />
                  )}
                </>
              )}

              {/* Boutons action */}
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setEditMode(false);
                    setNom(profile.nom);
                    setPrenom(profile.prenom);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.saveBtnText}>Enregistrer</Text>
                  }
                </TouchableOpacity>
              </View>

            </View>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── COMPOSANTS INTERNES ──────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={20} color="#7B1FE8" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F4F0FA' },
  scrollContent: { paddingBottom: 40 },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F4F0FA', padding: 20,
  },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  errorText:   { marginTop: 16, fontSize: 16, color: '#EF4444', textAlign: 'center' },
  retryButton: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#7B1FE8', borderRadius: 10,
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Toast
  toast: {
    position: 'absolute', top: Platform.OS === 'ios' ? 55 : 15,
    left: 20, right: 20, zIndex: 100,
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, gap: 10,
  },
  toast_success: { backgroundColor: '#10B981' },
  toast_error:   { backgroundColor: '#EF4444' },
  toast_info:    { backgroundColor: '#3B82F6' },
  toastText:     { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },

  // Header
  header: {
    paddingTop:    Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 36,
    alignItems:    'center',
    position:      'relative',
  },
  logoutBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40,
    right: 20, padding: 6,
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 4, borderColor: '#fff',
    backgroundColor: '#E0E0E0',
  },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF8C00',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  headerName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  headerSub:  { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, marginTop: 20, marginBottom: 8,
  },
  statCard: {
    flex: 1, borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },

  // Section
  section:       { paddingHorizontal: 20, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 17, fontWeight: 'bold', color: '#2D0072' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#F0E6FF', borderRadius: 20,
  },
  editBtnText: { fontSize: 13, color: '#7B1FE8', fontWeight: '600' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#7B1FE8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  // Info row (lecture)
  infoRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0E6FF', justifyContent: 'center',
    alignItems: 'center', marginRight: 14,
  },
  infoLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#222' },
  separator: { height: 1, backgroundColor: '#F5F0FF', marginLeft: 54 },

  // Formulaire édition
  fieldLabel:    { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 12 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F5FF', borderRadius: 12,
    paddingHorizontal: 12, borderWidth: 1, borderColor: '#E8D5FF',
  },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, paddingVertical: 13, fontSize: 15, color: '#333' },

  // Boutons édition
  editActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#E0D0FF', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#7B1FE8', fontWeight: '600' },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#7B1FE8', alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});
