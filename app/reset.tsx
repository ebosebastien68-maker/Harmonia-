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
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import HarmoniaLogo from '../components/HarmoniaLogo';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/auth';

type MessageType = 'success' | 'error' | 'info' | 'warning';

interface StatusMessage {
  type:    MessageType;
  text:    string;
  visible: boolean;
}

// ─── COMPOSANT ────────────────────────────────────────────────────────────────
// Cet écran est atteint depuis le lien de reset dans l'email Supabase
// URL : https://www.harmoniaworld.world/reset#access_token=xxx&type=recovery
// Le token est extrait depuis le fragment de l'URL

export default function ResetScreen() {
  const router = useRouter();

  const [token,           setToken]           = useState('');
  const [tokenLoaded,     setTokenLoaded]     = useState(false);
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [statusMessage,   setStatusMessage]   = useState<StatusMessage>({
    type: 'info', text: '', visible: false,
  });

  // ─── EXTRACTION DU TOKEN DEPUIS L'URL ─────────────────────────────────────
  // Supabase injecte le token dans le fragment (#) de l'URL de redirection :
  // https://www.harmoniaworld.world/reset#access_token=xxx&type=recovery

  useEffect(() => {
    extractTokenFromURL();
  }, []);

  const extractTokenFromURL = () => {
    try {
      if (Platform.OS === 'web') {
        // Web — lire directement window.location.hash
        const hash   = window.location.hash.substring(1); // supprimer le #
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const type        = params.get('type');

        if (accessToken && type === 'recovery') {
          setToken(accessToken);
          setTokenLoaded(true);
        } else {
          setTokenLoaded(true); // token absent — afficher l'erreur
        }
      } else {
        // Mobile — le token n'est pas accessible depuis l'URL directement
        // Il faut passer par Linking (géré depuis login.tsx si deep link configuré)
        // Ici on affiche un message d'erreur car le deep link n'est pas configuré
        setTokenLoaded(true);
      }
    } catch (err) {
      console.error('[reset] extractTokenFromURL:', err);
      setTokenLoaded(true);
    }
  };

  // Auto-hide status après 5s
  useEffect(() => {
    if (!statusMessage.visible) return;
    const t = setTimeout(() => setStatusMessage(p => ({ ...p, visible: false })), 5000);
    return () => clearTimeout(t);
  }, [statusMessage.visible]);

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

  // ─── RÉINITIALISATION MOT DE PASSE ────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showMessage('error', 'Veuillez remplir les deux champs'); return;
    }
    if (newPassword.length < 6) {
      showMessage('error', 'Le mot de passe doit contenir au moins 6 caractères'); return;
    }
    if (newPassword !== confirmPassword) {
      showMessage('error', 'Les mots de passe ne correspondent pas'); return;
    }

    setLoading(true);
    showMessage('info', 'Réinitialisation en cours...');

    try {
      const response = await fetch(API_BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:       'reset-password',
          token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }

      await AsyncStorage.setItem('harmonia_session', JSON.stringify(data.session));
      showMessage('success', 'Mot de passe modifié avec succès !');
      setTimeout(() => router.replace('/home'), 1500);
    } catch (error: any) {
      showMessage('error', error.message || 'Impossible de réinitialiser le mot de passe');
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDU ────────────────────────────────────────────────────────────────
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
          <View style={styles.logoContainer}>
            <HarmoniaLogo size={80} showText={true} theme="light" />
            <Text style={styles.tagline}>Révélez Votre Talent</Text>
          </View>

          <View style={styles.card}>

            {/* Chargement du token en cours */}
            {!tokenLoaded && (
              <>
                <ActivityIndicator size="large" color="#8A2BE2" style={{ marginVertical: 40 }} />
                <Text style={styles.subtitle}>Vérification du lien...</Text>
              </>
            )}

            {/* Token absent ou invalide */}
            {tokenLoaded && !token && (
              <>
                <Ionicons name="close-circle-outline" size={60} color="#EF4444" style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text style={styles.title}>Lien invalide</Text>
                <Text style={styles.subtitle}>
                  Ce lien est invalide ou a expiré.{'\n'}
                  Veuillez refaire une demande de réinitialisation.
                </Text>

                <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.8}>
                  <LinearGradient colors={['#FF0080', '#FF8C00']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Retour à la connexion</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Formulaire nouveau mot de passe */}
            {tokenLoaded && token && (
              <>
                <Ionicons name="lock-open-outline" size={60} color="#8A2BE2" style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text style={styles.title}>Nouveau mot de passe</Text>
                <Text style={styles.subtitle}>
                  Choisissez un nouveau mot de passe sécurisé pour votre compte.
                </Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNew}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                    <Ionicons name={showNew ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
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
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleResetPassword} disabled={loading} activeOpacity={0.8}>
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.primaryButton}>
                    <Text style={styles.buttonText}>Réinitialiser mon mot de passe</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.replace('/login')} style={styles.linkButton} disabled={loading}>
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
  primaryButton:  { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
  linkButton:     { marginTop: 20, alignItems: 'center' },
  linkText:       { color: '#666', fontSize: 14 },
  linkBold:       { color: '#8A2BE2', fontWeight: 'bold' },
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
