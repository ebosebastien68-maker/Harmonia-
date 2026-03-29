import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/logout';

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
  onLogoutSuccess: () => void;
}

export default function LogoutModal({
  visible,
  onClose,
  onLogoutSuccess,
}: LogoutModalProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      const sessionStr = await AsyncStorage.getItem('harmonia_session');
      if (!sessionStr) throw new Error('Session introuvable');
      const session = JSON.parse(sessionStr);
      const access_token: string = session.access_token;

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token }),
      });

      const data = await response.json();

      if (data.success) {
        // Nettoyer la session locale dans tous les cas
        await AsyncStorage.removeItem('harmonia_session');
        onLogoutSuccess();
      } else {
        console.error('[LogoutModal] Échec:', data.error);
      }
    } catch (error) {
      console.error('[LogoutModal] Erreur:', error);
      // On nettoie quand même pour ne pas bloquer l'utilisateur
      await AsyncStorage.removeItem('harmonia_session');
      onLogoutSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalContent}>
          {/* Icône */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconCircle}>
              <Ionicons name="log-out-outline" size={36} color="#FF3B30" />
            </View>
          </View>

          {/* Texte */}
          <Text style={styles.title}>Se déconnecter ?</Text>
          <Text style={styles.message}>
            Êtes-vous sûr de vouloir vous déconnecter de votre compte ?
          </Text>

          {/* Séparateur */}
          <View style={styles.divider} />

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutButton, loading && styles.buttonDisabled]}
              onPress={handleLogout}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#FFF" />
                  <Text style={styles.logoutButtonText}>Déconnexion</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },

  // Icône
  iconWrapper: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF1F0',
    borderWidth: 2,
    borderColor: '#FFCDD2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Texte
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Séparateur
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    width: '100%',
    marginVertical: 24,
  },

  // Boutons
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444',
  },
  logoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
