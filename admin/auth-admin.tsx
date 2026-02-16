import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AwaleAdmin from '../components/AwaleAdmin';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

export default function AuthAdmin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Email et mot de passe requis');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'getStatistics', email: email.trim(), password, run_id: 'test' })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error.includes('rôle')) {
          Alert.alert('❌ Accès refusé', 'Vous n\'avez pas les droits admin');
        } else {
          Alert.alert('❌ Erreur', data.error || 'Identifiants incorrects');
        }
        return;
      }

      setAdminData({ email: email.trim(), password });
      setAuthenticated(true);
      Alert.alert('✅', 'Bienvenue administrateur !');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setAdminData(null);
    setSelectedGame(null);
    setEmail('');
    setPassword('');
  };

  // ÉCRAN CONNEXION
  if (!authenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <Ionicons name="shield-checkmark" size={60} color="#FFD700" />
          <Text style={styles.headerTitle}>Admin Harmonia</Text>
          <Text style={styles.headerSubtitle}>Panneau d'administration</Text>
        </LinearGradient>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#8A2BE2" />
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#8A2BE2" />
            <TextInput style={styles.input} placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <TouchableOpacity style={[styles.loginButton, loading && styles.loginButtonDisabled]} onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={loading ? ['#999', '#666'] : ['#8A2BE2', '#4B0082']} style={styles.loginGradient}>
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="log-in" size={20} color="#FFF" />
                  <Text style={styles.loginText}>Se connecter</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#8A2BE2" />
            <Text style={styles.infoText}>Accès réservé aux admin, adminpro, supreme</Text>
          </View>
        </View>
      </View>
    );
  }

  // DASHBOARD
  if (authenticated && !selectedGame) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Dashboard Admin</Text>
              <Text style={styles.headerEmail}>{adminData.email}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.dashboardContainer}>
          <Text style={styles.sectionTitle}>🎮 Gestion des jeux</Text>
          <View style={styles.gamesGrid}>
            <TouchableOpacity style={styles.gameCard} onPress={() => setSelectedGame('awale')}>
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gameIconContainer}>
                <Ionicons name="extension-puzzle" size={40} color="#FFF" />
              </LinearGradient>
              <Text style={styles.gameName}>Awalé Admin</Text>
            </TouchableOpacity>

            <View style={[styles.gameCard, styles.gameCardDisabled]}>
              <View style={styles.gameIconContainer}>
                <Ionicons name="game-controller" size={40} color="#CCC" />
              </View>
              <Text style={styles.gameNameDisabled}>Autres jeux</Text>
              <Text style={styles.comingSoon}>Bientôt...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // AWALÉ ADMIN
  if (selectedGame === 'awale') {
    return <AwaleAdmin adminEmail={adminData.email} adminPassword={adminData.password} onBack={() => setSelectedGame(null)} />;
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 30, paddingHorizontal: 20, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginTop: 16 },
  headerSubtitle: { fontSize: 16, color: '#E0D0FF', marginTop: 8 },
  headerEmail: { fontSize: 14, color: '#E0D0FF', marginTop: 4 },
  logoutButton: { padding: 8 },
  formContainer: { flex: 1, padding: 24, justifyContent: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  input: { flex: 1, marginLeft: 12, fontSize: 16 },
  loginButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  loginButtonDisabled: { opacity: 0.6 },
  loginGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  loginText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  infoBox: { flexDirection: 'row', backgroundColor: '#F0E6FF', padding: 16, borderRadius: 12, marginTop: 24, gap: 12 },
  infoText: { flex: 1, fontSize: 13, color: '#8A2BE2', lineHeight: 18 },
  dashboardContainer: { flex: 1, padding: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gameCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  gameCardDisabled: { opacity: 0.5 },
  gameIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12, backgroundColor: '#EEE' },
  gameName: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  gameNameDisabled: { fontSize: 16, fontWeight: 'bold', color: '#999', textAlign: 'center' },
  comingSoon: { fontSize: 12, color: '#999', marginTop: 4 },
});
