import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useRouter }      from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar }      from 'expo-status-bar';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { Ionicons }       from '@expo/vector-icons';
import DateTimePicker     from '@react-native-community/datetimepicker';
import * as Haptics       from 'expo-haptics';
import HarmoniaLogo       from '../components/HarmoniaLogo';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const AUTH_URL    = `${BACKEND_URL}/auth`;

// Deep link de l'app — utilisé comme redirectTo pour les emails Supabase
// Supabase redirigera vers cette URL après confirmation / reset
const DEEP_LINK_RESET = Platform.OS === 'web'
  ? 'https://harmonia-world.vercel.app/auth/reset'
  : 'harmonia://auth/reset';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type AuthMode    = 'login' | 'signup' | 'reset' | 'verify-signup' | 'verify-reset';
type MessageType = 'success' | 'error' | 'info' | 'warning';

interface StatusMessage {
  type:    MessageType;
  text:    string;
  visible: boolean;
}

// ─── COMPOSANT ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [mode,    setMode]    = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({
    type: 'info', text: '', visible: false,
  });

  // Champs formulaire
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [nom,      setNom]      = useState('');
  const [prenom,   setPrenom]   = useState('');

  // Date de naissance
  const [dateNaissance,    setDateNaissance]    = useState<Date>(new Date(2000, 0, 1));
  const [dateNaissanceWeb, setDateNaissanceWeb] = useState<string>('2000-01-01');
  const [showDatePicker,   setShowDatePicker]   = useState(false);

  // Reset mot de passe
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken,      setResetToken]      = useState('');  // access_token du deep link

  // Visibilité mots de passe
  const [showPassword,        setShowPassword]        = useState(false);
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email en attente de confirmation
  const [pendingEmail, setPendingEmail] = useState('');

  // ─── DEEP LINK HANDLER ──────────────────────────────────────────────────────
  // Intercepte le deep link après que l'utilisateur a cliqué sur le lien de reset
  // URL attendue : harmonia://auth/reset?access_token=xxx&type=recovery
  // ou côté web  : https://harmonia-world.vercel.app/auth/reset#access_token=xxx

  const handleDeepLink = useCallback((url: string | null) => {
    if (!url) return;

    // Extraire les paramètres (query string ou fragment)
    const extractParams = (rawUrl: string): Record<string, string> => {
      const params: Record<string, string> = {};
      // Chercher d'abord dans le fragment (#), puis dans les query params (?)
      const fragment = rawUrl.includes('#') ? rawUrl.split('#')[1] : '';
      const query    = rawUrl.includes('?') ? rawUrl.split('?')[1].split('#')[0] : '';
      const source   = fragment || query;
      if (!source) return params;
      source.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
      });
      return params;
    };

    const params = extractParams(url);
    const { access_token, type } = params;

    if (access_token && type === 'recovery') {
      setResetToken(access_token);
      setMode('verify-reset');
    }
  }, []);

  // ─── SESSION + DEEP LINK ──────────────────────────────────────────────────
  useEffect(() => {
    checkExistingSession();

    // URL initiale (app ouverte depuis un lien)
    Linking.getInitialURL().then(handleDeepLink);

    // URL reçue pendant que l'app est ouverte
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, [handleDeepLink]);

  // Auto-hide status après 5s
  useEffect(() => {
    if (!statusMessage.visible) return;
    const t = setTimeout(() => setStatusMessage(p => ({ ...p, visible: false })), 5000);
    return () => clearTimeout(t);
  }, [statusMessage.visible]);

  const checkExistingSession = async () => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.access_token) router.replace('/home');
      }
    } catch { /* pas de session */ }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const showMsg = (type: MessageType, text: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        type === 'error'   ? Haptics.NotificationFeedbackType.Error   :
        type === 'success' ? Haptics.NotificationFeedbackType.Success :
                             Haptics.NotificationFeedbackType.Warning
      );
    }
    setStatusMessage({ type, text, visible: true });
  };

  const formatDateDisplay = (d: Date) => {
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const formatDateForAPI = (): string => {
    if (Platform.OS === 'web') return dateNaissanceWeb;
    const dd = dateNaissance.getDate().toString().padStart(2, '0');
    const mm = (dateNaissance.getMonth() + 1).toString().padStart(2, '0');
    return `${dateNaissance.getFullYear()}-${mm}-${dd}`;
  };

  const isValidDate = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s);
    return d instanceof Date && !isNaN(d.getTime());
  };

  const authFetch = async (body: Record<string, string>) => {
    const res = await fetch(AUTH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  };

  // ─── VÉRIFICATION INSCRIPTIONS OUVERTES ───────────────────────────────────
  const checkRegistrationsOpen = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_URL}/check-registrations`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      });
      if (!res.ok) { showMsg('error', 'Impossible de vérifier les inscriptions.'); return false; }
      const d = await res.json();
      if (d.registrations_open === false) {
        showMsg('error', d.registrations_message || 'Les inscriptions sont actuellement fermées. 🔐');
        return false;
      }
      return true;
    } catch {
      showMsg('error', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
      return false;
    }
  };

  // ─── INSCRIPTION ──────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !nom.trim() || !prenom.trim()) {
      showMsg('error', 'Veuillez remplir tous les champs'); return;
    }
    if (password.length < 6) {
      showMsg('error', 'Le mot de passe doit contenir au moins 6 caractères'); return;
    }
    const dateForAPI = formatDateForAPI();
    if (!isValidDate(dateForAPI)) {
      showMsg('error', 'Format de date invalide'); return;
    }

    const open = await checkRegistrationsOpen();
    if (!open) return;

    setLoading(true);
    showMsg('info', 'Création du compte en cours...');
    try {
      await authFetch({
        action:         'signup',
        email:          email.trim().toLowerCase(),
        password,
        nom:            nom.trim(),
        prenom:         prenom.trim(),
        date_naissance: dateForAPI,
      });
      // Conserver email + password en mémoire pour le check-confirmed
      setPendingEmail(email.trim().toLowerCase());
      setMode('verify-signup');
      showMsg('success', 'Compte créé ! Vérifiez votre boîte mail.');
    } catch (e: any) {
      showMsg('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── VÉRIFICATION EMAIL INSCRIPTION ──────────────────────────────────────
  // L'utilisateur clique "J'ai cliqué le lien" → on tente une connexion
  // Si l'email est confirmé → Supabase retourne une session → redirect /home
  // Sinon → message d'attente

  const handleCheckConfirmed = async () => {
    setLoading(true);
    showMsg('info', 'Vérification en cours...');
    try {
      const data = await authFetch({
        action:   'check-confirmed',
        email:    pendingEmail,
        password,
      });
      if (data.confirmed) {
        await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
        showMsg('success', 'Email confirmé ! Bienvenue sur Harmonia !');
        setTimeout(() => router.replace('/home'), 1500);
      } else {
        showMsg('warning', 'Email pas encore confirmé. Cliquez sur le lien dans votre mail.');
      }
    } catch (e: any) {
      showMsg('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── CONNEXION ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showMsg('error', 'Veuillez entrer votre email et mot de passe'); return;
    }
    setLoading(true);
    showMsg('info', 'Connexion en cours...');
    try {
      const data = await authFetch({
        action:   'login',
        email:    email.trim().toLowerCase(),
        password,
      });
      await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
      showMsg('success', 'Connexion réussie ! Bienvenue !');
      setTimeout(() => router.replace('/home'), 1500);
    } catch (e: any) {
      if (e.message.includes('non confirmé')) {
        showMsg('warning', 'Email non confirmé. Vérifiez votre boîte mail.');
      } else {
        showMsg('error', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── MOT DE PASSE OUBLIÉ ─────────────────────────────────────────────────
  const handleRequestReset = async () => {
    if (!email.trim()) {
      showMsg('error', 'Veuillez entrer votre email'); return;
    }
    setLoading(true);
    showMsg('info', 'Envoi du lien en cours...');
    try {
      await authFetch({
        action:     'request-reset',
        email:      email.trim().toLowerCase(),
        redirectTo: DEEP_LINK_RESET,
      });
      setPendingEmail(email.trim().toLowerCase());
      setMode('verify-reset');
      showMsg('success', 'Lien envoyé ! Consultez votre boîte mail.');
    } catch (e: any) {
      showMsg('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── RESET MOT DE PASSE ───────────────────────────────────────────────────
  // resetToken est rempli automatiquement par le deep link handler
  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showMsg('error', 'Veuillez remplir les deux champs'); return;
    }
    if (newPassword.length < 6) {
      showMsg('error', 'Le mot de passe doit contenir au moins 6 caractères'); return;
    }
    if (newPassword !== confirmPassword) {
      showMsg('error', 'Les mots de passe ne correspondent pas'); return;
    }
    setLoading(true);
    showMsg('info', 'Réinitialisation en cours...');
    try {
      const data = await authFetch({
        action:       'reset-password',
        token:        resetToken,
        new_password: newPassword,
      });
      if (data.session) {
        await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
        showMsg('success', 'Mot de passe modifié avec succès !');
        setTimeout(() => router.replace('/home'), 1500);
      } else {
        showMsg('success', 'Mot de passe modifié ! Connectez-vous.');
        setTimeout(() => setMode('login'), 1500);
      }
    } catch (e: any) {
      showMsg('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── DATE PICKER MOBILE ───────────────────────────────────────────────────
  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDateNaissance(selectedDate);
  };

  const renderDatePicker = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.inputContainer}>
          <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
          <input
            type="date"
            value={dateNaissanceWeb}
            onChange={e => setDateNaissanceWeb(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            min="1900-01-01"
            disabled={loading}
            style={{
              flex: 1, padding: 15, fontSize: 16,
              border: 'none', outline: 'none',
              backgroundColor: 'transparent', color: '#333',
            }}
          />
        </View>
      );
    }
    return (
      <>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowDatePicker(true)}
          disabled={loading}
        >
          <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
          <Text style={styles.dateText}>{formatDateDisplay(dateNaissance)}</Text>
          <Ionicons name="chevron-down-outline" size={20} color="#999" />
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
    );
  };

  // ─── RENDU PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />

      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.gradientBackground}>

        {/* MESSAGE DE STATUT */}
        {statusMessage.visible && (
          <View style={[
            styles.statusMessageContainer,
            styles[`statusMessage${statusMessage.type.charAt(0).toUpperCase() + statusMessage.type.slice(1)}` as keyof typeof styles],
          ]}>
            <Ionicons
              name={
                statusMessage.type === 'success' ? 'checkmark-circle'  :
                statusMessage.type === 'error'   ? 'close-circle'      :
                statusMessage.type === 'warning' ? 'warning'           :
                                                   'information-circle'
              }
              size={24} color="#fff" style={styles.statusIcon}
            />
            <Text style={styles.statusMessageText}>{statusMessage.text}</Text>
          </View>
        )}

        {/* LOADING OVERLAY */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <HarmoniaLogo size={80} showText={true} theme="light" />
            <Text style={styles.tagline}>Révélez Votre Talent</Text>
          </View>

          <View style={styles.card}>

            {/* ==================== CONNEXION ==================== */}
            {mode === 'login' && (
              <>
                <Text style={styles.title}>Connexion</Text>
                <Text style={styles.subtitle}>Bienvenue ! Connectez-vous pour continuer</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mot de passe"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setMode('reset')} disabled={loading}>
                  <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#FF0080', '#FF8C00']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Se connecter</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('signup')} style={styles.linkButton} disabled={loading}>
                  <Text style={styles.linkText}>
                    Pas encore inscrit ? <Text style={styles.linkBold}>Créer un compte</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== INSCRIPTION ==================== */}
            {mode === 'signup' && (
              <>
                <Text style={styles.title}>Inscription</Text>
                <Text style={styles.subtitle}>Créez votre compte Harmonia</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nom"
                    placeholderTextColor="#999"
                    value={nom}
                    onChangeText={setNom}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Prénom"
                    placeholderTextColor="#999"
                    value={prenom}
                    onChangeText={setPrenom}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>

                {renderDatePicker()}

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mot de passe (min. 6 caractères)"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleSignup} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Créer mon compte</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('login')} style={styles.linkButton} disabled={loading}>
                  <Text style={styles.linkText}>
                    Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== VÉRIFICATION INSCRIPTION ==================== */}
            {mode === 'verify-signup' && (
              <>
                <Ionicons
                  name="mail-open-outline" size={60} color="#8A2BE2"
                  style={{ alignSelf: 'center', marginBottom: 20 }}
                />
                <Text style={styles.title}>Confirmez votre email</Text>
                <Text style={styles.subtitle}>
                  Un lien de confirmation a été envoyé à{'\n'}
                  <Text style={{ fontWeight: 'bold' }}>{pendingEmail}</Text>
                </Text>

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    📧 Consultez votre boîte mail{'\n'}
                    🔗 Cliquez sur le lien de confirmation{'\n'}
                    ✅ Revenez ici et appuyez sur le bouton
                  </Text>
                </View>

                <TouchableOpacity onPress={handleCheckConfirmed} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#00c6ff', '#0072ff']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>J'ai cliqué le lien ✓</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('signup')} style={styles.linkButton} disabled={loading}>
                  <Text style={styles.linkText}>
                    <Text style={styles.linkBold}>← Retour à l'inscription</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== MOT DE PASSE OUBLIÉ ==================== */}
            {mode === 'reset' && (
              <>
                <Ionicons
                  name="key-outline" size={60} color="#FF0080"
                  style={{ alignSelf: 'center', marginBottom: 20 }}
                />
                <Text style={styles.title}>Mot de passe oublié</Text>
                <Text style={styles.subtitle}>Entrez votre email pour recevoir un lien</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity onPress={handleRequestReset} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#FF0080', '#FF8C00']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Envoyer le lien</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('login')} style={styles.linkButton} disabled={loading}>
                  <Text style={styles.linkText}>
                    <Text style={styles.linkBold}>← Retour à la connexion</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== VÉRIFICATION RESET ==================== */}
            {mode === 'verify-reset' && (
              <>
                <Ionicons
                  name="shield-checkmark-outline" size={60} color="#11998e"
                  style={{ alignSelf: 'center', marginBottom: 20 }}
                />

                {/* Attente du clic sur le lien — tant que resetToken n'est pas reçu */}
                {!resetToken && (
                  <>
                    <Text style={styles.title}>Vérifiez votre email</Text>
                    <Text style={styles.subtitle}>
                      Un lien de réinitialisation a été envoyé à{'\n'}
                      <Text style={{ fontWeight: 'bold' }}>{pendingEmail}</Text>
                    </Text>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>
                        📧 Consultez votre boîte mail{'\n'}
                        🔗 Cliquez sur le lien de réinitialisation{'\n'}
                        📱 L'application s'ouvrira automatiquement
                      </Text>
                    </View>
                  </>
                )}

                {/* Formulaire nouveau mot de passe — après réception du token via deep link */}
                {resetToken && (
                  <>
                    <Text style={styles.title}>Nouveau mot de passe</Text>
                    <Text style={styles.subtitle}>
                      Choisissez un nouveau mot de passe sécurisé
                    </Text>

                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nouveau mot de passe"
                        placeholderTextColor="#999"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showNewPassword}
                        autoCapitalize="none"
                        editable={!loading}
                      />
                      <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                        <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirmer le mot de passe"
                        placeholderTextColor="#999"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        editable={!loading}
                      />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                        <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleResetPassword} disabled={loading} activeOpacity={0.8}>
                      <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.primaryButton}>
                        <Text style={styles.buttonText}>Réinitialiser</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity onPress={() => setMode('login')} style={styles.linkButton} disabled={loading}>
                  <Text style={styles.linkText}>
                    <Text style={styles.linkBold}>← Retour à la connexion</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1 },
  gradientBackground: { flex: 1 },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingVertical: 40, paddingHorizontal: 20,
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  tagline:       { fontSize: 16, color: '#E0D0FF', fontStyle: 'italic', marginTop: 12, letterSpacing: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 25, padding: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  title:    { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 30, textAlign: 'center', lineHeight: 20 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, paddingHorizontal: 15, marginBottom: 15,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  inputIcon:      { marginRight: 10 },
  input:          { flex: 1, paddingVertical: 15, fontSize: 16, color: '#333' },
  dateText:       { flex: 1, paddingVertical: 15, fontSize: 16, color: '#333' },
  forgotPassword: { color: '#8A2BE2', fontSize: 14, textAlign: 'right', marginBottom: 20, fontWeight: '600' },
  primaryButton:  { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
  linkButton:     { marginTop: 20, alignItems: 'center' },
  linkText:       { color: '#666', fontSize: 14 },
  linkBold:       { color: '#8A2BE2', fontWeight: 'bold' },
  infoBox: {
    backgroundColor: '#F0F8FF', borderRadius: 12, padding: 20,
    marginVertical: 20, borderWidth: 1, borderColor: '#B0D4FF',
  },
  infoText:             { fontSize: 14, color: '#333', lineHeight: 24 },
  resetFormContainer:   { marginTop: 30, paddingTop: 30, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  resetFormTitle:       { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  statusMessageContainer: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', padding: 15,
    borderRadius: 12, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },
  statusMessageSuccess: { backgroundColor: '#10B981' },
  statusMessageError:   { backgroundColor: '#EF4444' },
  statusMessageWarning: { backgroundColor: '#F59E0B' },
  statusMessageInfo:    { backgroundColor: '#3B82F6' },
  statusIcon:           { marginRight: 10 },
  statusMessageText:    { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  loadingCard: {
    backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },
  loadingText: { marginTop: 15, fontSize: 16, color: '#333', fontWeight: '600' },
});
