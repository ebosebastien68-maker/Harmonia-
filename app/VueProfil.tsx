import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/friends';
const DEFAULT_AVATAR = require('./assets/default-avatar.png');

interface VueProfilProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  nom: string;
  prenom: string;
  avatar_url?: string;
  role: string;
  created_at: string;
}

interface FriendshipStatus {
  status: 'none' | 'sent' | 'received' | 'friends';
  requestId?: string;
}

export default function VueProfil({ visible, userId, onClose }: VueProfilProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>({ status: 'none' });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    if (visible && userId) {
      loadProfile();
    }
  }, [visible, userId]);

  // Récupérer le user_id de la session
  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.user?.id || null;
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }
    return null;
  };

  // Charger le profil
  const loadProfile = async () => {
    setLoading(true);

    const myUserId = await getCurrentUserId();
    if (!myUserId) {
      setLoading(false);
      return;
    }

    setCurrentUserId(myUserId);

    try {
      // Récupérer le profil
      const profileResponse = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-user-profile',
          user_id: myUserId,
          target_user_id: userId,
        }),
      });

      const profileData = await profileResponse.json();

      if (profileData.success && profileData.profile) {
        setProfile(profileData.profile);
      }

      // Récupérer le statut d'amitié
      const statusResponse = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-friendship-status',
          user_id: myUserId,
          target_user_id: userId,
        }),
      });

      const statusData = await statusResponse.json();

      if (statusData.success) {
        setFriendshipStatus({
          status: statusData.status,
          requestId: statusData.request_id,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Envoyer invitation
  const sendRequest = async () => {
    setActionLoading(true);

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'send-request',
          user_id: currentUserId,
          target_user_id: userId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadProfile(); // Recharger pour mettre à jour le statut
      }
    } catch (error) {
      console.error('Error sending request:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Annuler demande ou retirer ami
  const cancelOrRemove = async () => {
    if (!friendshipStatus.requestId) return;

    setActionLoading(true);

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'cancel-request',
          user_id: currentUserId,
          request_id: friendshipStatus.requestId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadProfile();
      }
    } catch (error) {
      console.error('Error canceling/removing:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Accepter invitation (si reçue)
  const acceptRequest = async () => {
    if (!friendshipStatus.requestId) return;

    setActionLoading(true);

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'accept-request',
          user_id: currentUserId,
          request_id: friendshipStatus.requestId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadProfile();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Rendu du bouton d'action
  const renderActionButton = () => {
    if (actionLoading) {
      return (
        <View style={styles.actionButton}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }

    switch (friendshipStatus.status) {
      case 'none':
        return (
          <TouchableOpacity onPress={sendRequest} activeOpacity={0.8}>
            <LinearGradient
              colors={['#8A2BE2', '#DA70D6']}
              style={styles.actionButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="person-add" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>Envoyer invitation</Text>
            </LinearGradient>
          </TouchableOpacity>
        );

      case 'sent':
        return (
          <TouchableOpacity onPress={cancelOrRemove} activeOpacity={0.8}>
            <View style={styles.actionButtonSecondary}>
              <Ionicons name="close" size={20} color="#666" style={styles.buttonIcon} />
              <Text style={styles.actionButtonSecondaryText}>Annuler demande</Text>
            </View>
          </TouchableOpacity>
        );

      case 'received':
        return (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity onPress={acceptRequest} activeOpacity={0.8} style={styles.halfButton}>
              <LinearGradient
                colors={['#10B981', '#34D399']}
                style={styles.actionButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Accepter</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelOrRemove} activeOpacity={0.8} style={styles.halfButton}>
              <View style={styles.actionButtonSecondary}>
                <Ionicons name="close" size={20} color="#666" />
                <Text style={styles.actionButtonSecondaryText}>Refuser</Text>
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'friends':
        return (
          <TouchableOpacity onPress={cancelOrRemove} activeOpacity={0.8}>
            <View style={styles.actionButtonDanger}>
              <Ionicons name="person-remove" size={20} color="#EF4444" style={styles.buttonIcon} />
              <Text style={styles.actionButtonDangerText}>Retirer ami</Text>
            </View>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : profile ? (
            <>
              {/* Photo de profil */}
              <View style={styles.avatarContainer}>
                <Image
                  source={profile.avatar_url ? { uri: profile.avatar_url } : DEFAULT_AVATAR}
                  style={styles.avatar}
                />
              </View>

              {/* Nom complet */}
              <Text style={styles.name}>
                {profile.prenom} {profile.nom}
              </Text>

              {/* Badge Premium (uniquement pour userpro) */}
              {profile.role === 'userpro' && (
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.premiumBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="diamond" size={16} color="#fff" style={styles.badgeIcon} />
                  <Text style={styles.premiumText}>Premium</Text>
                </LinearGradient>
              )}

              {/* Date d'inscription */}
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color="#999" />
                <Text style={styles.infoText}>
                  Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {/* Bouton d'action */}
              <View style={styles.actionContainer}>
                {renderActionButton()}
              </View>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
              <Text style={styles.errorText}>Impossible de charger le profil</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    minHeight: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 -3px 10px rgba(0,0,0,0.1)',
      },
    }),
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  closeButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E0E0E0',
    borderWidth: 4,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeIcon: {
    marginRight: 6,
  },
  premiumText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  actionContainer: {
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  actionButtonDangerText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
  },
});
