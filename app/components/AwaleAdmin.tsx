import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView
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
  
  // États pour stocker les IDs créés
  const [sessionId, setSessionId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [runId, setRunId] = useState('');

  // Gestion du Modal de saisie (remplace Alert.prompt pour Android)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [currentAction, setCurrentAction] = useState<((text: string) => void) | null>(null);

  // --- FONCTION GÉNÉRIQUE D'APPEL BACKEND ---
  const callAdminFunction = async (functionName: string, params: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    
    console.log(`📡 Appel Admin: ${functionName}`, params);

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
      console.log(`📥 Réponse:`, data);
      
      if (data.success || res.ok) {
        if (data.session_id) setSessionId(data.session_id);
        if (data.party_id) setPartyId(data.party_id);
        if (data.run_id) setRunId(data.run_id);
        
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return data;
      } else {
        Alert.alert('❌ Erreur', data.error || 'Opération échouée');
        return null;
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // --- OUVERTURE DU MODAL ---
  const openInputModal = (title: string, callback: (text: string) => void) => {
    setModalTitle(title);
    setInputText('');
    setCurrentAction(() => callback);
    setModalVisible(true);
  };

  const handleModalSubmit = () => {
    if (inputText.trim().length > 0 && currentAction) {
      currentAction(inputText);
      setModalVisible(false);
    }
  };

  // --- ACTIONS MÉTIER ---

  const handleCreateSession = () => {
    openInputModal('Titre de la Session', (title) => {
      callAdminFunction('createSession', {
        game_key: 'vrai_faux',
        title,
        description: 'Session Admin Rapide',
        is_paid: false,
        price_cfa: 0
      }).then(data => {
        if(data) Alert.alert("Succès", "Session créée ! Passez à l'étape suivante.");
      });
    });
  };

  const handleCreateParty = () => {
    if (!sessionId) return Alert.alert('Stop', 'Créez une session d\'abord.');
    openInputModal('Titre de la Partie', (title) => {
      callAdminFunction('createParty', { session_id: sessionId, title })
        .then(data => {
            if(data) Alert.alert("Succès", "Party créée !");
        });
    });
  };

  const handleCreateRun = () => {
    if (!partyId) return Alert.alert('Stop', 'Créez une party d\'abord.');
    openInputModal('Titre du Run (Manche)', (title) => {
      callAdminFunction('createRun', { party_id: partyId, title })
        .then(data => {
            if(data) Alert.alert("Succès", "Run créé ! Vous pouvez ajouter des questions.");
        });
    });
  };

  const handleAddQuestions = () => {
    if (!runId) return Alert.alert('Stop', 'Créez un run d\'abord.');
    
    // Questions exemples
    const questions = [
      { question: 'La terre est plate ?', answer: false, score: 10 },
      { question: 'Le HTML est un langage de programmation ?', answer: false, score: 10 },
      { question: 'Elon Musk a fondé Tesla ?', answer: true, score: 10 },
      { question: 'React Native utilise le même code pour iOS et Android ?', answer: true, score: 20 },
      { question: 'Le ciel est vert ?', answer: false, score: 5 },
    ];

    callAdminFunction('addQuestions', { run_id: runId, questions }).then((data) => {
      if (data) Alert.alert('✅ Questions ajoutées', `${data.count} questions insérées avec succès.`);
    });
  };

  const handleSetVisibility = (visible: boolean) => {
    if (!runId) return Alert.alert('Erreur', 'Aucun Run sélectionné');
    callAdminFunction('setVisibility', { run_id: runId, visible }).then((data) => {
        if(data) Alert.alert('Succès', visible ? 'Le jeu est maintenant VISIBLE' : 'Le jeu est MASQUÉ');
    });
  };

  const handleGetStats = async () => {
    if (!runId) return Alert.alert('Erreur', 'Aucun Run sélectionné');
    const data = await callAdminFunction('getStatistics', { run_id: runId });
    if (data?.statistics) {
      const s = data.statistics;
      Alert.alert(
        '📊 Statistiques du Run',
        `ID: ...${s.id.slice(-4)}\n` +
        `Questions: ${s.total_questions}\n` +
        `Réponses reçues: ${s.total_answers}\n` +
        `État: ${s.is_closed ? '🔒 Fermé' : '🔓 Ouvert'}\n` +
        `Visibilité: ${s.is_visible ? '👀 Visible' : '🙈 Caché'}`
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View>
            <Text style={styles.headerTitle}>Administration Jeu</Text>
            <Text style={styles.headerSubtitle}>Vrai ou Faux</Text>
        </View>
      </LinearGradient>

      {/* LOADING */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={{color: 'white', marginTop: 10, fontWeight: 'bold'}}>Traitement...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* ÉTAPE 1 : SESSION */}
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.badge, sessionId ? styles.bgSuccess : styles.bgGray]}>
                    <Text style={styles.badgeText}>1</Text>
                </View>
                <Text style={styles.cardTitle}>Session de Jeu</Text>
            </View>
            <Text style={styles.cardDesc}>Créez l'événement global (ex: "Soirée Quiz").</Text>
            
            {sessionId ? (
                <View style={styles.idBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.idText}>ID: {sessionId}</Text>
                </View>
            ) : (
                <TouchableOpacity style={styles.actionButton} onPress={handleCreateSession}>
                    <Text style={styles.actionBtnText}>Créer une Session</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* ÉTAPE 2 : PARTY */}
        <View style={[styles.card, !sessionId && styles.cardDisabled]}>
            <View style={styles.cardHeader}>
                <View style={[styles.badge, partyId ? styles.bgSuccess : styles.bgGray]}>
                    <Text style={styles.badgeText}>2</Text>
                </View>
                <Text style={styles.cardTitle}>Groupe (Party)</Text>
            </View>
            <Text style={styles.cardDesc}>Le groupe de joueurs pour cette session.</Text>

            {partyId ? (
                <View style={styles.idBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.idText}>ID: {partyId}</Text>
                </View>
            ) : (
                <TouchableOpacity 
                    style={[styles.actionButton, !sessionId && styles.btnDisabled]} 
                    onPress={handleCreateParty}
                    disabled={!sessionId}
                >
                    <Text style={styles.actionBtnText}>Créer une Party</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* ÉTAPE 3 : RUN */}
        <View style={[styles.card, !partyId && styles.cardDisabled]}>
            <View style={styles.cardHeader}>
                <View style={[styles.badge, runId ? styles.bgSuccess : styles.bgGray]}>
                    <Text style={styles.badgeText}>3</Text>
                </View>
                <Text style={styles.cardTitle}>Manche (Run)</Text>
            </View>
            <Text style={styles.cardDesc}>Une série spécifique de questions.</Text>

            {runId ? (
                <View style={styles.idBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.idText}>ID: {runId}</Text>
                </View>
            ) : (
                <TouchableOpacity 
                    style={[styles.actionButton, !partyId && styles.btnDisabled]} 
                    onPress={handleCreateRun}
                    disabled={!partyId}
                >
                    <Text style={styles.actionBtnText}>Créer un Run</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* ÉTAPE 4 : CONTROLES */}
        {runId && (
            <View style={styles.controlSection}>
                <Text style={styles.sectionHeader}>Commandes du Run</Text>
                
                <TouchableOpacity style={styles.controlButton} onPress={handleAddQuestions}>
                    <Ionicons name="list" size={24} color="#FFF" />
                    <Text style={styles.controlText}>Injecter Questions</Text>
                </TouchableOpacity>

                <View style={styles.row}>
                    <TouchableOpacity style={[styles.controlButton, styles.halfBtn, styles.bgGreen]} onPress={() => handleSetVisibility(true)}>
                        <Ionicons name="eye" size={24} color="#FFF" />
                        <Text style={styles.controlText}>Rendre Visible</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.controlButton, styles.halfBtn, styles.bgRed]} onPress={() => handleSetVisibility(false)}>
                        <Ionicons name="eye-off" size={24} color="#FFF" />
                        <Text style={styles.controlText}>Cacher</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.controlButton, styles.bgBlue]} onPress={handleGetStats}>
                    <Ionicons name="bar-chart" size={24} color="#FFF" />
                    <Text style={styles.controlText}>Voir Statistiques Live</Text>
                </TouchableOpacity>
            </View>
        )}

      </ScrollView>

      {/* --- MODAL INPUT PERSONNALISÉ (POUR ANDROID) --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{modalTitle}</Text>
                <TextInput 
                    style={styles.modalInput}
                    placeholder="Entrez le nom ici..."
                    value={inputText}
                    onChangeText={setInputText}
                    autoFocus
                />
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}>
                        <Text style={styles.modalBtnTextCancel}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleModalSubmit}>
                        <Text style={styles.modalBtnTextConfirm}>Valider</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, elevation: 4 },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  
  // CARDS
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardDisabled: { opacity: 0.6, backgroundColor: '#EEE' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  bgGray: { backgroundColor: '#D1D5DB' },
  bgSuccess: { backgroundColor: '#10B981' },
  badgeText: { color: '#FFF', fontWeight: 'bold' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  cardDesc: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  
  // BUTTONS & IDs
  actionButton: { backgroundColor: '#F59E0B', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  idBox: { flexDirection: 'row', backgroundColor: '#ECFDF5', padding: 10, borderRadius: 8, alignItems: 'center' },
  idText: { marginLeft: 8, color: '#059669', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // CONTROLS
  controlSection: { marginTop: 10 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  controlButton: { flexDirection: 'row', backgroundColor: '#4B5563', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  controlText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  halfBtn: { flex: 1 },
  bgGreen: { backgroundColor: '#10B981' },
  bgRed: { backgroundColor: '#EF4444' },
  bgBlue: { backgroundColor: '#3B82F6' },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.25, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  modalInput: { width: '100%', height: 50, borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, marginBottom: 20, fontSize: 16, backgroundColor: '#F9FAFB' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 10 },
  modalBtnCancel: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center' },
  modalBtnConfirm: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center' },
  modalBtnTextCancel: { color: '#374151', fontWeight: '600' },
  modalBtnTextConfirm: { color: '#FFF', fontWeight: 'bold' }
});
    
