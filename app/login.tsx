import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import HarmoniaLogo from '../components/HarmoniaLogo';

const WS_BASE  = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const API_BASE = `${WS_BASE}/auth`;

type AuthMode    = 'login' | 'signup' | 'reset' | 'verify-signup';
type MessageType = 'success' | 'error' | 'info' | 'warning';

interface StatusMessage {
  type: MessageType;
  text: string;
  visible: boolean;
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode]       = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({
    type: 'info', text: '', visible: false,
  });

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [nom,      setNom]      = useState('');
  const [prenom,   setPrenom]   = useState('');

  const [dateNaissance,    setDateNaissance]    = useState<Date>(new Date(2000, 0, 1));
  const [dateNaissanceWeb, setDateNaissanceWeb] = useState<string>('2000-01-01');
  const [showDatePicker,   setShowDatePicker]   = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => { checkExistingSession() }, []);

  useEffect(() => {
    if (statusMessage.visible) {
      const timer = setTimeout(() => {
        setStatusMessage(prev => ({ ...prev, visible: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage.visible]);

  const checkExistingSession = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.access_token) router.replace('/home');
      }
    } catch { console.log('No existing session') }
  };

  const showMessage = (type: MessageType, text: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        type === 'error'   ? Haptics.NotificationFeedbackType.Error   :
        type === 'success' ? Haptics.NotificationFeedbackType.Success :
                             Haptics.NotificationFeedbackType.Warning
      );
    }
    setStatusMessage({ type, text, visible: true });
  };

  const formatDateDisplay = (date: Date): string => {
    const day   = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  };

  const formatDateForAPI = (): string => {
    if (Platform.OS === 'web') return dateNaissanceWeb;
    const day   = dateNaissance.getDate().toString().padStart(2, '0');
    const month = (dateNaissance.getMonth() + 1).toString().padStart(2, '0');
    return `${dateNaissance.getFullYear()}-${month}-${day}`;
  };

  const isValidDate = (dateString: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // =====================
  // INSCRIPTION
  // =====================
  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !nom.trim() || !prenom.trim()) {
      showMessage('error', 'Veuillez remplir tous les champs'); return;
    }
    if (password.length < 6) {
      showMessage('error', 'Le mot de passe doit contenir au moins 6 caractères'); return;
    }
    const dateForAPI = formatDateForAPI();
    if (!isValidDate(dateForAPI)) {
      showMessage('error', 'Format de date invalide'); return;
    }

    try {
      const chkRes = await fetch(`${WS_BASE}/check-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (chkRes.ok) {
        const chk = await chkRes.json();
        if (chk.registrations_open === false) {
          showMessage('error', chk.registrations_message || 'Les inscriptions sont actuellement fermées. 🔐');
          return;
        }
      } else {
        showMessage('error', 'Impossible de vérifier les inscriptions. Réessayez plus tard.'); return;
      }
    } catch {
      showMessage('error', 'Impossible de joindre le serveur. Vérifiez votre connexion.'); return;
    }

    setLoading(true);
    showMessage('info', 'Création du compte en cours...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email:  email.trim().toLowerCase(),
          password,
          nom:            nom.trim(),
          prenom:         prenom.trim(),
          date_naissance: dateForAPI,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'inscription");
      setPendingEmail(email.trim().toLowerCase());
      setMode('verify-signup');
      showMessage('success', 'Compte créé ! Vérifiez votre email.');
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // VÉRIFICATION EMAIL
  // =====================
  const handleVerifySignup = async () => {
    setLoading(true);
    showMessage('info', 'Vérification en cours...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-email', email: pendingEmail, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur de vérification');
      if (data.verified) {
        await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
        showMessage('success', 'Email vérifié ! Bienvenue sur Harmonia !');
        setTimeout(() => router.replace('/home'), 1500);
      } else {
        showMessage('warning', 'Email non vérifié. Cliquez sur le lien dans votre email.');
      }
    } catch (error: any) {
      showMessage('error', error.message || "Impossible de vérifier l'email");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // CONNEXION
  // =====================
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showMessage('error', 'Veuillez entrer votre email et mot de passe'); return;
    }
    setLoading(true);
    showMessage('info', 'Connexion en cours...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: email.trim().toLowerCase(), password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error?.includes('Email not confirmed')) {
          showMessage('warning', 'Email non confirmé. Vérifiez votre boîte mail.'); return;
        }
        throw new Error(data.error || 'Identifiants incorrects');
      }
      await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
      showMessage('success', 'Connexion réussie ! Bienvenue !');
      setTimeout(() => router.replace('/home'), 1500);
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de se connecter');
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // MOT DE PASSE OUBLIÉ
  // =====================
  const handleRequestReset = async () => {
    if (!email.trim()) {
      showMessage('error', 'Veuillez entrer votre email'); return;
    }
    setLoading(true);
    showMessage('info', "Envoi de l'email en cours...");
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request-reset', email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error?.includes('not found')) {
          showMessage('error', 'Aucun compte avec cet email'); return;
        }
        throw new Error(data.error || 'Erreur lors de la demande');
      }
      showMessage('success', 'Lien envoyé ! Consultez votre boîte mail et cliquez le lien.');
    } catch (error: any) {
      showMessage('error', error.message || "Impossible d'envoyer l'email");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // CONNEXION GOOGLE
  // =====================
  const handleGoogleSignin = async () => {
    setLoading(true);
    showMessage('info', 'Redirection vers Google...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'google-signin' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur Google');

      // Ouvrir l'URL OAuth Google dans le navigateur
      await Linking.openURL(data.url);

      showMessage('info', 'Connectez-vous avec Google dans votre navigateur.');
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de se connecter avec Google');
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // DATE PICKER
  // =====================
  const onDateChange = (event: any, selectedDate?: Date) => {
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
            onChange={(e) => setDateNaissanceWeb(e.target.value)}
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

  // =====================
  // BOUTON GOOGLE — réutilisé sur login et signup
  // =====================
  const renderGoogleButton = () => (
    <>
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignin}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
          style={styles.googleLogo}
        />
        <Text style={styles.googleButtonText}>Continuer avec Google</Text>
      </TouchableOpacity>
    </>
  );

  // =====================
  // RENDU
  // =====================
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
            styles[`statusMessage${statusMessage.type.charAt(0).toUpperCase() + statusMessage.type.slice(1)}` as keyof typeof styles]
          ]}>
            <Ionicons
              name={
                statusMessage.type === 'success' ? 'checkmark-circle' :
                statusMessage.type === 'error'   ? 'close-circle'     :
                statusMessage.type === 'warning' ? 'warning'          :
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

                {renderGoogleButton()}

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

                {renderGoogleButton()}

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
                <Ionicons name="mail-open-outline" size={60} color="#8A2BE2" style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text style={styles.title}>Vérifiez votre email</Text>
                <Text style={styles.subtitle}>
                  Un lien de confirmation a été envoyé à {'\n'}
                  <Text style={{ fontWeight: 'bold' }}>{pendingEmail}</Text>
                </Text>

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    📧 Consultez votre boîte mail{'\n'}
                    🔗 Cliquez sur le lien de confirmation{'\n'}
                    ✅ Revenez ici et cliquez sur "Vérifier"
                  </Text>
                </View>

                <TouchableOpacity onPress={handleVerifySignup} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#00c6ff', '#0072ff']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Vérifier l'activation</Text>
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
                <Ionicons name="key-outline" size={60} color="#FF0080" style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text style={styles.title}>Mot de passe oublié</Text>
                <Text style={styles.subtitle}>
                  Entrez votre email pour recevoir un lien de réinitialisation
                </Text>

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

          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

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
  infoText: { fontSize: 14, color: '#333', lineHeight: 24 },

  // ── Divider ──────────────────────────────────────────────────────────────────
  dividerContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 14 },

  // ── Bouton Google ─────────────────────────────────────────────────────────────
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  googleLogo:       { width: 22, height: 22, marginRight: 12 },
  googleButtonText: { fontSize: 16, color: '#333', fontWeight: '600' },

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
