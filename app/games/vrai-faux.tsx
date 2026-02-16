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
  const [runId, setRunId] = useState<string>('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [screen, setScreen] = useState<'sessions' | 'game' | 'result'>('sessions');

  useEffect(() => {
    loadUser();
    loadSessions();
  }, []);

  const loadUser = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'listSessions', game_key: 'vrai_faux' })
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les sessions');
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string) => {
    if (!userId) return Alert.alert('Erreur', 'Non connecté');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'joinSession', user_id: userId, session_id: sessionId })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('✅', 'Session rejointe !');
      } else {
        Alert.alert('Erreur', data.error);
      }
    } catch (error) {
      Alert.alert('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (rid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'getQuestions', user_id: userId, run_id: rid })
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions);
        setRunId(rid);
        setScreen('game');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les questions');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'submitAnswer',
          user_id: userId,
          run_question_id: questions[currentIndex].id,
          answer
        })
      });
      const data = await res.json();
      if (data.success) {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          loadLeaderboard();
        }
      } else {
        Alert.alert('Erreur', data.error);
      }
    } catch (error) {
      Alert.alert('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'getLeaderboard', user_id: userId, run_id: runId })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard);
        setScreen('result');
      }
    } catch (error) {
      Alert.alert('Erreur classement');
    } finally {
      setLoading(false);
    }
  };

  const darkerColor = color.replace(/[0-9A-F]{2}$/, (hex) => {
    const num = parseInt(hex, 16);
    return Math.max(0, num - 40).toString(16).padStart(2, '0');
  });

  // ÉCRAN SESSIONS
  if (screen === 'sessions') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[color, darkerColor]} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </LinearGradient>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={color} /></View>
        ) : (
          <ScrollView style={styles.scroll}>
            {sessions.map(s => (
              <TouchableOpacity key={s.id} style={styles.card} onPress={() => joinSession(s.id)}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Text style={styles.cardDesc}>{s.description}</Text>
                  {s.is_paid && <Text style={styles.price}>💰 {s.price_cfa} CFA</Text>}
                </View>
                <Ionicons name="play-circle" size={40} color={color} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ÉCRAN JEU
  if (screen === 'game' && questions.length > 0) {
    const q = questions[currentIndex];
    return (
      <View style={styles.container}>
        <LinearGradient colors={[color, darkerColor]} style={styles.header}>
          <Text style={styles.headerTitle}>Question {currentIndex + 1}/{questions.length}</Text>
        </LinearGradient>
        <View style={styles.gameContainer}>
          <Text style={styles.questionText}>{q.question_text}</Text>
          <Text style={styles.scoreText}>🏆 {q.score} points</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnTrue]} onPress={() => submitAnswer(true)} disabled={loading}>
              <Ionicons name="checkmark-circle" size={40} color="#FFF" />
              <Text style={styles.btnText}>VRAI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnFalse]} onPress={() => submitAnswer(false)} disabled={loading}>
              <Ionicons name="close-circle" size={40} color="#FFF" />
              <Text style={styles.btnText}>FAUX</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ÉCRAN RÉSULTAT
  return (
    <View style={styles.container}>
      <LinearGradient colors={[color, darkerColor]} style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Classement</Text>
      </LinearGradient>
      <ScrollView style={styles.scroll}>
        {leaderboard.map(e => (
          <View key={e.rank} style={[styles.leaderItem, e.is_current_user && styles.currentUser]}>
            <Text style={styles.rank}>#{e.rank}</Text>
            <Text style={styles.name}>{e.prenom} {e.nom}</Text>
            <Text style={styles.score}>{e.score} pts</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, padding: 16 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardDesc: { fontSize: 14, color: '#666', marginTop: 4 },
  price: { fontSize: 14, color: '#10B981', fontWeight: 'bold', marginTop: 4 },
  gameContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  questionText: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  scoreText: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 40 },
  btnRow: { flexDirection: 'row', gap: 16 },
  btn: { flex: 1, padding: 24, borderRadius: 16, alignItems: 'center' },
  btnTrue: { backgroundColor: '#10B981' },
  btnFalse: { backgroundColor: '#EF4444' },
  btnText: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginTop: 8 },
  leaderItem: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  currentUser: { backgroundColor: '#10B981' },
  rank: { fontSize: 18, fontWeight: 'bold', width: 50 },
  name: { flex: 1, fontSize: 16 },
  score: { fontSize: 16, fontWeight: 'bold' },
});
    
