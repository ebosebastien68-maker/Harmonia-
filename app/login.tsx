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
import { supabase } from '../supabase';

const WS_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const API_BASE = `${WS_BASE}/auth`;

// =====================================================
// CONFIGURATION GOOGLE SIGN-IN NATIVE (MOBILE UNIQUEMENT)
// =====================================================

const GOOGLE_CLIENT_ID_WEB =
  '492467723054-m39j327gd1bjr0ipqqdo6ejglrgu69gc.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_ANDROID =
  '492467723054-u1duqlk51tnnf80uilf1jpn8li8s1hop.apps.googleusercontent.com';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let GoogleSignin: GoogleSigninModule['GoogleSignin'] | null = null;
let statusCodes: GoogleSigninModule['statusCodes'] | null = null;

const initGoogle = async () => {
  if (Platform.OS === 'web') return;

  if (GoogleSignin && statusCodes) return;

  const GSignIn: GoogleSigninModule = await import('@react-native-google-signin/google-signin');
  GoogleSignin = GSignIn.GoogleSignin;
  statusCodes = GSignIn.statusCodes;

  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    offlineAccess: false,
  });
};

type AuthMode = 'login' | 'signup' | 'reset' | 'verify-signup' | 'confirm-google';
type MessageType = 'success' | 'error' | 'info' | 'warning';

interface StatusMessage {
  type: MessageType;
  text: string;
  visible: boolean;
}

interface GooglePendingInfo {
  idToken: string;
  name: string;
  email: string;
  photo: string;
}

// =====================================================
// COMPOSANT PRINCIPAL
// =====================================================

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({
    type: 'info',
    text: '',
    visible: false,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');

  const [dateNaissance, setDateNaissance] = useState<Date>(new Date(2000, 0, 1));
  const [dateNaissanceWeb, setDateNaissanceWeb] = useState<string>('2000-01-01');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const [googlePendingInfo, setGooglePendingInfo] = useState<GooglePendingInfo | null>(null);

  // =====================================================
  // INITIALISATION
  // =====================================================

  useEffect(() => {
    void initGoogle();
    void checkExistingSession();
  }, []);

  useEffect(() => {
    if (statusMessage.visible) {
      const timer = setTimeout(() => {
        setStatusMessage((prev) => ({ ...prev, visible: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage.visible]);

  // =====================================================
  // CHECK SESSION EXISTANTE
  // =====================================================

  const checkExistingSession = async () => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) {
          router.replace('/home');
        }
      }
    } catch {
      console.log('No existing session');
    }
  };

  // =====================================================
  // MESSAGES
  // =====================================================

  const showMessage = (type: MessageType, text: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(
        type === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : type === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
      );
    }
    setStatusMessage({ type, text, visible: true });
  };

  // =====================================================
  // DATE
  // =====================================================

  const formatDateDisplay = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  };

  const formatDateForAPI = (): string => {
    if (Platform.OS === 'web') return dateNaissanceWeb;
    const day = dateNaissance.getDate().toString().padStart(2, '0');
    const month = (dateNaissance.getMonth() + 1).toString().padStart(2, '0');
    return `${dateNaissance.getFullYear()}-${month}-${day}`;
  };

  const isValidDate = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // =====================================================
  // INSCRIPTION
  // =====================================================

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !nom.trim() || !prenom.trim()) {
      showMessage('error', 'Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 6) {
      showMessage('error', 'Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    const dateForAPI = formatDateForAPI();
    if (!isValidDate(dateForAPI)) {
      showMessage('error', 'Format de date invalide');
      return;
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
          showMessage(
            'error',
            chk.registrations_message || 'Les inscriptions sont actuellement fermees.'
          );
          return;
        }
      } else {
        showMessage('error', 'Impossible de verifier les inscriptions.');
        return;
      }
    } catch {
      showMessage('error', 'Impossible de joindre le serveur.');
      return;
    }

    setLoading(true);
    showMessage('info', 'Creation du compte en cours...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email: email.trim().toLowerCase(),
          password,
          nom: nom.trim(),
          prenom: prenom.trim(),
          date_naissance: dateForAPI,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'inscription");

      setPendingEmail(email.trim().toLowerCase());
      setMode('verify-signup');
      showMessage('success', 'Compte cree ! Verifiez votre email.');
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de creer le compte');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // VERIFICATION EMAIL
  // =====================================================

  const handleVerifySignup = async () => {
    setLoading(true);
    showMessage('info', 'Verification en cours...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-email', email: pendingEmail, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur de verification');

      if (data.verified) {
        await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
        showMessage('success', 'Email verifie ! Bienvenue sur Harmonia !');
        setTimeout(() => router.replace('/home'), 1500);
      } else {
        showMessage('warning', 'Email non verifie. Cliquez sur le lien dans votre email.');
      }
    } catch (error: any) {
      showMessage('error', error.message || "Impossible de verifier l'email");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CONNEXION
  // =====================================================

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showMessage('error', 'Veuillez entrer votre email et mot de passe');
      return;
    }

    setLoading(true);
    showMessage('info', 'Connexion en cours...');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.error?.includes('Email not confirmed')) {
          showMessage('warning', 'Email non confirme. Verifiez votre boite mail.');
          return;
        }
        throw new Error(data.error || 'Identifiants incorrects');
      }

      await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
      showMessage('success', 'Connexion reussie ! Bienvenue !');
      setTimeout(() => router.replace('/home'), 1500);
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de se connecter');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // MOT DE PASSE OUBLIE
  // =====================================================

  const handleRequestReset = async () => {
    if (!email.trim()) {
      showMessage('error', 'Veuillez entrer votre email');
      return;
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
          showMessage('error', 'Aucun compte avec cet email');
          return;
        }
        throw new Error(data.error || 'Erreur lors de la demande');
      }

      showMessage('success', 'Lien envoye ! Consultez votre boite mail.');
    } catch (error: any) {
      showMessage('error', error.message || "Impossible d'envoyer l'email");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // GOOGLE SIGNIN (WEB + MOBILE)
  // =====================================================

  const handleGoogleSignin = async () => {
    setLoading(true);

    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
        });

        if (error) throw error;
        return;
      }

      if (!GoogleSignin) {
        throw new Error('Module GoogleSignin non initialisé');
      }

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo.idToken) {
        throw new Error("Token d'authentification Google manquant");
      }

      setGooglePendingInfo({
        idToken: userInfo.idToken,
        name: userInfo.user.name || '',
        email: userInfo.user.email,
        photo: userInfo.user.photo || '',
      });

      setMode('confirm-google');
    } catch (error: any) {
      if (Platform.OS !== 'web' && statusCodes) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          showMessage('warning', 'Connexion Google annulée');
        } else if (error.code === statusCodes.IN_PROGRESS) {
          showMessage('info', 'Connexion Google déjà en cours');
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          showMessage('error', 'Les services Google Play ne sont pas disponibles');
        } else {
          showMessage('error', error.message || 'Erreur lors de la connexion Google');
        }
      } else {
        showMessage('error', error.message || 'Erreur lors de la connexion Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGoogle = async () => {
    if (!googlePendingInfo?.idToken) return;
    setLoading(true);
    showMessage('info', 'Certification de votre identité...');

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-google-token',
          id_token: googlePendingInfo.idToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Échec de la validation Google côté serveur');
      }

      await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
      showMessage('success', `Bienvenue, ${googlePendingInfo.name} !`);
      setTimeout(() => router.replace('/home'), 1000);
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de finaliser la connexion Google');
      setLoading(false);
    }
  };

  // =====================================================
  // DATE PICKER
  // =====================================================

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
              flex: 1,
              padding: 15,
              fontSize: 16,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: '#333',
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

  // =====================================================
  // BOUTON GOOGLE
  // =====================================================

  const renderGoogleButton = () => (
    <>
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.googleButton, loading && styles.googleButtonDisabled]}
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

  // =====================================================
  // RENDU
  // =====================================================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />

      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.gradientBackground}>
        {statusMessage.visible && (
          <View
            style={[
              styles.statusMessageContainer,
              styles[
                `statusMessage${statusMessage.type.charAt(0).toUpperCase() + statusMessage.type.slice(1)}` as keyof typeof styles
              ],
            ]}
          >
            <Ionicons
              name={
                statusMessage.type === 'success'
                  ? 'checkmark-circle'
                  : statusMessage.type === 'error'
                    ? 'close-circle'
                    : statusMessage.type === 'warning'
                      ? 'warning'
                      : 'information-circle'
              }
              size={24}
              color="#fff"
              style={styles.statusIcon}
            />
            <Text style={styles.statusMessageText}>{statusMessage.text}</Text>
          </View>
        )}

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
            <Text style={styles.tagline}>Revelez Votre Talent</Text>
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
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setMode('reset')} disabled={loading}>
                  <Text style={styles.forgotPassword}>Mot de passe oublie ?</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#FF0080', '#FF8C00']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Se connecter</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {renderGoogleButton()}

                <TouchableOpacity
                  onPress={() => setMode('signup')}
                  style={styles.linkButton}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>
                    Pas encore inscrit ? <Text style={styles.linkBold}>Creer un compte</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== INSCRIPTION ==================== */}
            {mode === 'signup' && (
              <>
                <Text style={styles.title}>Inscription</Text>
                <Text style={styles.subtitle}>Creez votre compte Harmonia</Text>

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
                    placeholder="Prenom"
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
                    placeholder="Mot de passe (min. 6 caracteres)"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleSignup} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Creer mon compte</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {renderGoogleButton()}

                <TouchableOpacity
                  onPress={() => setMode('login')}
                  style={styles.linkButton}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>
                    Deja un compte ? <Text style={styles.linkBold}>Se connecter</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== VERIFICATION INSCRIPTION ==================== */}
            {mode === 'verify-signup' && (
              <>
                <Ionicons
                  name="mail-open-outline"
                  size={60}
                  color="#8A2BE2"
                  style={{ alignSelf: 'center', marginBottom: 20 }}
                />
                <Text style={styles.title}>Verifiez votre email</Text>
                <Text style={styles.subtitle}>
                  Un lien de confirmation a ete envoye a {'\n'}
                  <Text style={{ fontWeight: 'bold' }}>{pendingEmail}</Text>
                </Text>

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Consultez votre boite mail{'\n'}
                    Cliquez sur le lien de confirmation{'\n'}
                    Revenez ici et cliquez sur "Verifier"
                  </Text>
                </View>

                <TouchableOpacity onPress={handleVerifySignup} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#00c6ff', '#0072ff']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Verifier l'activation</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMode('signup')}
                  style={styles.linkButton}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>
                    <Text style={styles.linkBold}>Retour a l'inscription</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== MOT DE PASSE OUBLIE ==================== */}
            {mode === 'reset' && (
              <>
                <Ionicons
                  name="key-outline"
                  size={60}
                  color="#FF0080"
                  style={{ alignSelf: 'center', marginBottom: 20 }}
                />
                <Text style={styles.title}>Mot de passe oublie</Text>
                <Text style={styles.subtitle}>
                  Entrez votre email pour recevoir un lien de reinitialisation
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

                <TouchableOpacity
                  onPress={handleRequestReset}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#FF0080', '#FF8C00']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Envoyer le lien</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMode('login')}
                  style={styles.linkButton}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>
                    <Text style={styles.linkBold}>Retour a la connexion</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ==================== CONFIRMATION GOOGLE ==================== */}
            {mode === 'confirm-google' && googlePendingInfo && (
              <>
                {googlePendingInfo.photo ? (
                  <Image
                    source={{ uri: googlePendingInfo.photo }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      alignSelf: 'center',
                      marginBottom: 20,
                    }}
                  />
                ) : (
                  <Ionicons
                    name="person-circle-outline"
                    size={80}
                    color="#8A2BE2"
                    style={{ alignSelf: 'center', marginBottom: 20 }}
                  />
                )}

                <Text style={styles.title}>Confirmer l'identité</Text>
                <Text style={styles.subtitle}>
                  Continuer en tant que {'\n'}
                  <Text style={{ fontWeight: 'bold', color: '#333' }}>
                    {googlePendingInfo.name}
                  </Text>{' '}
                  {'\n'}
                  ({googlePendingInfo.email}) ?
                </Text>

                <TouchableOpacity
                  onPress={handleConfirmGoogle}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Continuer</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setMode('login');
                    setGooglePendingInfo(null);
                  }}
                  style={styles.linkButton}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>
                    <Text style={styles.linkBold}>Annuler</Text>
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

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradientBackground: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  tagline: {
    fontSize: 16,
    color: '#E0D0FF',
    fontStyle: 'italic',
    marginTop: 12,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#333' },
  dateText: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#333' },
  forgotPassword: {
    color: '#8A2BE2',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 20,
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
  linkBold: { color: '#8A2BE2', fontWeight: 'bold' },
  infoBox: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#B0D4FF',
  },
  infoText: { fontSize: 14, color: '#333', lineHeight: 24 },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 14 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonDisabled: { opacity: 0.5 },
  googleLogo: { width: 22, height: 22, marginRight: 12 },
  googleButtonText: { fontSize: 16, color: '#333', fontWeight: '600' },
  statusMessageContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusMessageSuccess: { backgroundColor: '#10B981' },
  statusMessageError: { backgroundColor: '#EF4444' },
  statusMessageWarning: { backgroundColor: '#F59E0B' },
  statusMessageInfo: { backgroundColor: '#3B82F6' },
  statusIcon: { marginRight: 10 },
  statusMessageText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: { marginTop: 15, fontSize: 16, color: '#333', fontWeight: '600' },
});
