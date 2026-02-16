import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

interface VraiFauxProps {
  title: string;
  icon: string;
  color: string;
  onClose?: () => void;
}

export default function VraiFaux({ title, icon, color, onClose }: VraiFauxProps) {
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('🚀 VraiFaux component mounted');
    loadUser();
    loadSessions();
  }, []);

  const loadUser = async () => {
    try {
      console.log('📱 Loading user from AsyncStorage...');
      const session = await AsyncStorage.getItem('harmonia_session');
      console.log('📱 Session data:', session ? 'Found' : 'Not found');
      
      if (session) {
        const parsed = JSON.parse(session);
        console.log('✅ User ID:', parsed.user?.id);
        setUserId(parsed.user?.id || '');
      } else {
        console.warn('⚠️ No session found in AsyncStorage');
        // Utiliser un ID de test si pas de session
        setUserId('test-user-id');
      }
    } catch (error) {
      console.error('❌ Error loading user:', error);
      setError('Erreur chargement utilisateur');
      // Utiliser un ID de test en cas d'erreur
      setUserId('test-user-id');
    }
  };

  const loadSessions = async () => {
    console.log('🎮 Loading sessions...');
    setLoading(true);
    setError('');
    
    try {
      console.log('🌐 Calling backend:', BACKEND_URL);
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          function: 'listSessions', 
          game_key: 'vrai_faux' 
        })
      });
      
      console.log('📡 Response status:', res.status);
      const data = await res.json();
      console.log('📦 Response data:', data);
      
      if (data.success) {
        console.log('✅ Sessions loaded:', data.sessions?.length || 0);
        setSessions(data.sessions || []);
      } else {
        console.error('❌ Backend error:', data.error);
        setError(data.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      console.error('❌ Network error:', error);
      setError('Erreur réseau: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string) => {
    console.log('🎯 Joining session:', sessionId);
    
    if (!userId) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          function: 'joinSession', 
          user_id: userId, 
          session_id: sessionId 
        })
      });
      
      const data = await res.json();
      console.log('Join response:', data);
      
      if (data.success) {
        Alert.alert('✅ Succès', 'Session rejointe !');
      } else {
        Alert.alert('❌ Erreur', data.error || 'Impossible de rejoindre');
      }
    } catch (error: any) {
      console.error('Join error:', error);
      Alert.alert('Erreur', 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const darkerColor = color.replace(/[0-9A-F]{2}$/, (hex) => {
    const num = parseInt(hex, 16);
    return Math.max(0, num - 40).toString(16).padStart(2, '0');
  });

  console.log('🎨 Rendering component...');

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={[color, darkerColor]} style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </LinearGradient>

      {/* CONTENU */}
      <View style={styles.content}>
        {/* USER ID DEBUG */}
        <View style={styles.debugBox}>
          <Text style={styles.debugText}>👤 User ID: {userId || 'Non défini'}</Text>
          <Text style={styles.debugText}>🌐 Backend: {BACKEND_URL}</Text>
        </View>

        {/* ERREUR */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadSessions}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* LOADING */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={color} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : null}

        {/* SESSIONS */}
        {!loading && !error && sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="game-controller-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>Aucune session disponible</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadSessions}>
              <Text style={styles.retryText}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && sessions.length > 0 ? (
          <ScrollView style={styles.scrollView}>
            <Text style={styles.sectionTitle}>📋 Sessions disponibles ({sessions.length})</Text>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => joinSession(session.id)}
              >
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>{session.title || 'Sans titre'}</Text>
                  <Text style={styles.sessionDescription}>
                    {session.description || 'Pas de description'}
                  </Text>
                  {session.is_paid && (
                    <Text style={styles.sessionPrice}>💰 {session.price_cfa} CFA</Text>
                  )}
                </View>
                <Ionicons name="play-circle" size={40} color={color} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  debugBox: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionDescription: {
    fontSize: 14,
    color: '#666',
  },
  sessionPrice: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: 'bold',
    marginTop: 4,
  },
});
    
