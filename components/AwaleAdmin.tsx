import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

interface AwaleAdminProps {
  adminEmail: string;
  adminPassword: string;
  onBack: () => void;
}

export default function AwaleAdmin({ adminEmail, adminPassword, onBack }: AwaleAdminProps) {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [runId, setRunId] = useState('');

  const callAdminFunction = async (functionName: string, params: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: functionName,
          email: adminEmail,
          password: adminPassword,
          ...params
        })
      });
      const data = await res.json();
      
      if (data.success) {
        Alert.alert('✅ Succès', data.message || 'Opération réussie');
        
        // Stocker les IDs
        if (data.session_id) setSessionId(data.session_id);
        if (data.party_id) setPartyId(data.party_id);
        if (data.run_id) setRunId(data.run_id);
        
        return data;
      } else {
        Alert.alert('❌ Erreur', data.error || 'Opération échouée');
        return null;
      }
    } catch (error) {
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createSession = () => {
    Alert.prompt(
      'Créer une session',
      'Titre de la session',
      (title) => {
        if (title) {
          callAdminFunction('createSession', {
            game_key: 'vrai_faux',
            title,
            description: 'Session admin',
            is_paid: false,
            price_cfa: 0
          });
        }
      }
    );
  };

  const createParty = () => {
    if (!sessionId) return Alert.alert('Erreur', 'Créez d\'abord une session');
    Alert.prompt(
      'Créer une party',
      'Titre de la party',
      (title) => {
        if (title) {
          callAdminFunction('createParty', {
            session_id: sessionId,
            title
          });
        }
      }
    );
  };

  const createRun = () => {
    if (!partyId) return Alert.alert('Erreur', 'Créez d\'abord une party');
    Alert.prompt(
      'Créer un run',
      'Titre du run',
      (title) => {
        if (title) {
          callAdminFunction('createRun', {
            party_id: partyId,
            title
          });
        }
      }
    );
  };

  const addQuestions = () => {
    if (!runId) return Alert.alert('Erreur', 'Créez d\'abord un run');
    
    const sampleQuestions = [
      { question: 'Paris est la capitale de la France', answer: true, score: 10 },
      { question: 'Le soleil tourne autour de la Terre', answer: false, score: 10 },
      { question: '2 + 2 = 4', answer: true, score: 10 },
      { question: 'Les dauphins sont des poissons', answer: false, score: 10 },
      { question: 'L\'eau bout à 100°C', answer: true, score: 10 },
      { question: 'Il y a 8 continents', answer: false, score: 10 },
      { question: 'Le diamant est le minéral le plus dur', answer: true, score: 10 },
      { question: 'La Lune est une étoile', answer: false, score: 10 },
      { question: 'Il y a 365 jours dans une année', answer: true, score: 10 },
      { question: 'Les chauves-souris sont des oiseaux', answer: false, score: 10 },
    ];

    callAdminFunction('addQuestions', {
      run_id: runId,
      questions: sampleQuestions
    });
  };

  const setVisibility = (visible: boolean) => {
    if (!runId) return Alert.alert('Erreur', 'Créez d\'abord un run');
    callAdminFunction('setVisibility', {
      run_id: runId,
      visible
    });
  };

  const closeRun = (closed: boolean) => {
    if (!runId) return Alert.alert('Erreur', 'Créez d\'abord un run');
    callAdminFunction('closeRun', {
      run_id: runId,
      closed
    });
  };

  const getStatistics = async () => {
    if (!runId) return Alert.alert('Erreur', 'Créez d\'abord un run');
    const stats = await callAdminFunction('getStatistics', { run_id: runId });
    if (stats && stats.statistics) {
      Alert.alert(
        '📊 Statistiques',
        `Questions: ${stats.statistics.total_questions}\n` +
        `Réponses: ${stats.statistics.total_answers}\n` +
        `Joueurs: ${stats.statistics.total_players}\n` +
        `Visible: ${stats.statistics.is_visible ? 'Oui' : 'Non'}\n` +
        `Fermé: ${stats.statistics.is_closed ? 'Oui' : 'Non'}`
      );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Awalé Admin</Text>
      </LinearGradient>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {/* ÉTAPE 1 : SESSION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1️⃣ Créer une session</Text>
          <TouchableOpacity style={styles.button} onPress={createSession}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Créer Session</Text>
          </TouchableOpacity>
          {sessionId && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.infoText}>Session créée: {sessionId.substring(0, 8)}...</Text>
            </View>
          )}
        </View>

        {/* ÉTAPE 2 : PARTY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2️⃣ Créer une party</Text>
          <TouchableOpacity style={[styles.button, !sessionId && styles.buttonDisabled]} onPress={createParty} disabled={!sessionId}>
            <Ionicons name="people" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Créer Party</Text>
          </TouchableOpacity>
          {partyId && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.infoText}>Party créée: {partyId.substring(0, 8)}...</Text>
            </View>
          )}
        </View>

        {/* ÉTAPE 3 : RUN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3️⃣ Créer un run</Text>
          <TouchableOpacity style={[styles.button, !partyId && styles.buttonDisabled]} onPress={createRun} disabled={!partyId}>
            <Ionicons name="play" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Créer Run</Text>
          </TouchableOpacity>
          {runId && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.infoText}>Run créé: {runId.substring(0, 8)}...</Text>
            </View>
          )}
        </View>

        {/* ÉTAPE 4 : QUESTIONS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4️⃣ Ajouter questions</Text>
          <TouchableOpacity style={[styles.button, !runId && styles.buttonDisabled]} onPress={addQuestions} disabled={!runId}>
            <Ionicons name="help-circle" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Ajouter 10 Questions</Text>
          </TouchableOpacity>
        </View>

        {/* ÉTAPE 5 : VISIBILITÉ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5️⃣ Rendre visible</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.button, styles.buttonSuccess, !runId && styles.buttonDisabled]} onPress={() => setVisibility(true)} disabled={!runId}>
              <Ionicons name="eye" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Visible</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonDanger, !runId && styles.buttonDisabled]} onPress={() => setVisibility(false)} disabled={!runId}>
              <Ionicons name="eye-off" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Masquer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ÉTAPE 6 : FERMETURE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6️⃣ Gestion run</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.button, styles.buttonDanger, !runId && styles.buttonDisabled]} onPress={() => closeRun(true)} disabled={!runId}>
              <Ionicons name="lock-closed" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Fermer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSuccess, !runId && styles.buttonDisabled]} onPress={() => closeRun(false)} disabled={!runId}>
              <Ionicons name="lock-open" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Réouvrir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ÉTAPE 7 : STATS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7️⃣ Statistiques</Text>
          <TouchableOpacity style={[styles.button, styles.buttonInfo, !runId && styles.buttonDisabled]} onPress={getStatistics} disabled={!runId}>
            <Ionicons name="stats-chart" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Voir Stats</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  scrollView: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', padding: 16, borderRadius: 12, gap: 8, marginBottom: 8 },
  buttonDisabled: { opacity: 0.4 },
  buttonSuccess: { backgroundColor: '#10B981' },
  buttonDanger: { backgroundColor: '#EF4444' },
  buttonInfo: { backgroundColor: '#3B82F6' },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  row: { flexDirection: 'row', gap: 8 },
  infoBox: { flexDirection: 'row', backgroundColor: '#D1FAE5', padding: 12, borderRadius: 8, marginTop: 8, gap: 8, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 14, color: '#10B981' },
});
