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

// --- IMPORT DES COMPOSANTS ---
import AwaleAdmin from './components/AwaleAdmin'; 
import AdminAwale from './components/AdminAwale'; 
import AdminDames from './components/AdminDames'; 
import AdminArts from './components/AdminArts'; 
import AdminPerformance from './components/AdminPerformance'; // NOUVEAU composant Performance

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

export default function AuthAdmin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  
  const [adminData, setAdminData] = useState<any>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Erreur', 'Email et mot de passe requis');
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'login', 
          email: email.trim(),
          password: password,
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAdminData({ 
          ...data.user, 
          email: email.trim(), 
          password 
        });
        setAuthenticated(true);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        const errorMsg = data.error || 'Identifiants invalides';
        Alert.alert('❌ Échec', errorMsg);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Erreur', 'Impossible de joindre le serveur Harmonia');
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

  // --- VUE 1 : CONNEXION ---
  if (!authenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <Ionicons name="shield-checkmark" size={60} color="#FFD700" />
          <Text style={styles.headerTitle}>Admin Harmonia</Text>
          <Text style={styles.headerSubtitle}>Vérification d'identité</Text>
        </LinearGradient>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#8A2BE2" />
            <TextInput
              style={styles.input}
              placeholder="Email administrateur"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#8A2BE2" />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#999', '#666'] : ['#8A2BE2', '#4B0082']}
              style={styles.loginGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="key" size={20} color="#FFF" />
                  <Text style={styles.loginText}>Accéder au Panneau</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#8A2BE2" />
            <Text style={styles.infoText}>
              Seuls les profils avec le rang "Supreme", "AdminPro" ou "Admin" peuvent se connecter.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // --- VUE 2 : DASHBOARD (Connecté) ---
  if (authenticated && !selectedGame) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Bienvenue, {adminData.prenom}</Text>
              <Text style={styles.headerRole}>Rang : {adminData.role.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={28} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.dashboardContainer}>
          <Text style={styles.sectionTitle}>🎮 Gestionnaires Disponibles</Text>
          
          <View style={styles.gamesGrid}>
            
            {/* BOUTON 1 : VRAI OU FAUX */}
            <TouchableOpacity 
              style={styles.gameCard} 
              onPress={() => setSelectedGame('vraioufaux')}
            >
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gameIconContainer}>
                <Ionicons name="help-circle" size={40} color="#FFF" />
              </LinearGradient>
              <Text style={styles.gameName}>Vrai ou Faux</Text>
              <Text style={styles.gameDescription}>Séquences & Questions</Text>
            </TouchableOpacity>

            {/* BOUTON 2 : AWALÉ */}
            <TouchableOpacity 
              style={styles.gameCard} 
              onPress={() => setSelectedGame('awale')}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={styles.gameIconContainer}>
                <Ionicons name="grid" size={40} color="#FFF" />
              </LinearGradient>
              <Text style={styles.gameName}>Awalé</Text>
              <Text style={styles.gameDescription}>Gestion du jeu</Text>
            </TouchableOpacity>

            {/* BOUTON 3 : DAMES */}
            <TouchableOpacity 
              style={styles.gameCard} 
              onPress={() => setSelectedGame('dames')}
            >
              <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.gameIconContainer}>
                <Ionicons name="apps" size={40} color="#FFF" />
              </LinearGradient>
              <Text style={styles.gameName}>Dames</Text>
              <Text style={styles.gameDescription}>Gestion des pions</Text>
            </TouchableOpacity>

            {/* BOUTON 4 : ARTS */}
            <TouchableOpacity 
              style={styles.gameCard} 
              onPress={() => setSelectedGame('arts')}
            >
              <LinearGradient colors={['#EC4899', '#BE185D']} style={styles.gameIconContainer}>
                <Ionicons name="color-palette" size={40} color="#FFF" />
              </LinearGradient>
              <Text style={styles.gameName}>Arts</Text>
              <Text style={styles.gameDescription}>Galerie & Médias</Text>
            </TouchableOpacity>

            {/* BOUTON 5 : PERFORMANCE (NOUVEAU) */}
            <TouchableOpacity 
              style={styles.gameCard} 
              onPress={() => setSelectedGame('performance')}
            >
              <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gameIconContainer}>
                <Ionicons name="flash" size={40} color="#FFF" />
              </LinearGradient>
              <Text style={styles.gameName}>Performance</Text>
              <Text style={styles.gameDescription}>Stats & Analyses</Text>
            </TouchableOpacity>

            {/* BOUTON 6 : CLASSEMENTS (DÉSACTIVÉ) */}
            <View style={[styles.gameCard, styles.gameCardDisabled]}>
              <View style={styles.gameIconContainer}>
                <Ionicons name="trophy-outline" size={40} color="#CCC" />
              </View>
              <Text style={styles.gameNameDisabled}>Classements</Text>
              <Text style={styles.comingSoon}>Bientôt disponible</Text>
            </View>
            
          </View>
        </View>
      </View>
    );
  }

  // --- VUE 3 : GESTIONNAIRE DE JEU ---
  
  if (selectedGame === 'vraioufaux') {
    return (
      <AwaleAdmin 
        adminEmail={adminData.email} 
        adminPassword={adminData.password} 
        onBack={() => setSelectedGame(null)} 
      />
    );
  }

  if (selectedGame === 'awale') {
    return (
      <AdminAwale 
        adminEmail={adminData.email} 
        adminPassword={adminData.password} 
        onBack={() => setSelectedGame(null)} 
      />
    );
  }

  if (selectedGame === 'dames') {
    return (
      <AdminDames 
        adminEmail={adminData.email} 
        adminPassword={adminData.password} 
        onBack={() => setSelectedGame(null)} 
      />
    );
  }

  if (selectedGame === 'arts') {
    return (
      <AdminArts 
        adminEmail={adminData.email} 
        adminPassword={adminData.password} 
        onBack={() => setSelectedGame(null)} 
      />
    );
  }

  // Rendu de la nouvelle interface "Performance"
  if (selectedGame === 'performance') {
    return (
      <AdminPerformance 
        adminEmail={adminData.email} 
        adminPassword={adminData.password} 
        onBack={() => setSelectedGame(null)} 
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 30, 
    paddingHorizontal: 25, 
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 16, color: '#E0D0FF', marginTop: 5 },
  headerRole: { fontSize: 13, color: '#FFD700', fontWeight: '600', marginTop: 4, letterSpacing: 1 },
  logoutButton: { padding: 5 },
  formContainer: { flex: 1, padding: 25, justifyContent: 'center' },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 15, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    marginBottom: 16, 
    borderWidth: 1,
    borderColor: '#EEE'
  },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: '#333' },
  loginButton: { borderRadius: 15, overflow: 'hidden', marginTop: 10, elevation: 5 },
  loginButtonDisabled: { opacity: 0.6 },
  loginGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  loginText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  infoBox: { 
    flexDirection: 'row', 
    backgroundColor: '#F0E6FF', 
    padding: 16, 
    borderRadius: 15, 
    marginTop: 30, 
    gap: 12,
    alignItems: 'center'
  },
  infoText: { flex: 1, fontSize: 13, color: '#6A0DAD', lineHeight: 18 },
  dashboardContainer: { flex: 1, padding: 25 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  gameCard: { 
    width: '47%', 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 20, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  gameCardDisabled: { opacity: 0.6, backgroundColor: '#F0F0F0' },
  gameIconContainer: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  gameName: { fontSize: 15, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  gameDescription: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  gameNameDisabled: { fontSize: 15, fontWeight: 'bold', color: '#999', textAlign: 'center' },
  comingSoon: { fontSize: 10, color: '#AAA', marginTop: 4, fontWeight: 'bold' },
});
