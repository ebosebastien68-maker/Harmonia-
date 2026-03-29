// =====================================================
// VueProfil.tsx
// Modal de visualisation du profil d'un utilisateur
// =====================================================
// Auth : token récupéré depuis AsyncStorage (harmonia_session)
//        envoyé dans req.body.access_token → requireAuth Render
// API  : Render backend /friends
// =====================================================

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

// ── 🔧 Remplacez par l'URL de votre service Render ──────────────────────────
const API_BASE = 'https://VOTRE_APP.onrender.com/friends';
// ────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Récupère { access_token, user_id } depuis la session stockée
// ─────────────────────────────────────────────────────────────────────────────
async function getSession(): Promise<{ access_token: string; user_id: string } | null> {
  try {
    const raw = await AsyncStorage.getItem('harmonia_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    const access_token = session?.access_token;
    const user_id = session?.user?.id;
    if (!access_token || !user_id) return null;
    return { access_token, user_id };
  } catch (error) {
    console.error('[VueProfil] getSession error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper fetch vers Render — injecte access_token dans le body
// ─────────────────────────────────────────────────────────────────────────────
async function apiFriends(
  access_token: string,
  payload: Record<string, unknown>
): Promise<any> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, access_token }),
  });
  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────
export default function VueProfil({ visible, userId, onClose }: VueProfilProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>({ status: 'none' });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [session, setSession] = useState<{ access_token: string; user_id: string } | null>(null);
  const [avatarZoomed, setAvatarZoomed] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      loadProfile();
    }
  }, [visible, userId]);

  // ── Chargement du profil + statut d'amitié ──────────────────────────────
  const loadProfile = async () => {
    setLoading(true);

    const sess = await getSession();
    if (!sess) {
      console.warn('[VueProfil] Session introuvable');
      setLoading(false);
      return;
    }
    setSession(sess);

    try {
      // Profil public de l'utilisateur cible
      const profileData = await apiFriends(sess.access_token, {
        action: 'get-user-profile',
        user_id: sess.user_id,
        target_user_id: userId,
      });

      if (profileData.success && profileData.profile) {
        setProfile(profileData.profile);
      }

      // Statut de la relation
      const statusData = await apiFriends(sess.access_token, {
        action: 'get-friendship-status',
        user_id: sess.user_id,
        target_user_id: userId,
      });

      if (statusData.success) {
        setFriendshipStatus({
          status: statusData.status,
          requestId: statusData.request_id ?? undefined,
        });
      }
    } catch (error) {
      console.error('[VueProfil] loadProfile error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Envoyer une demande ──────────────────────────────────────────────────
  const sendRequest = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      const data = await apiFriends(session.access_token, {
        action: 'send-request',
        user_id: session.user_id,
        target_user_id: userId,
      });
      if (data.success) await loadProfile();
    } catch (error) {
      console.error('[VueProfil] sendRequest error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Annuler / Refuser / Retirer ami ─────────────────────────────────────
  const cancelOrRemove = async () => {
    if (!session || !friendshipStatus.requestId) return;
    setActionLoading(true);
    try {
      const data = await apiFriends(session.access_token, {
        action: 'cancel-request',
        user_id: session.user_id,
        request_id: friendshipStatus.requestId,
      });
      if (data.success) await loadProfile();
    } catch (error) {
      console.error('[VueProfil] cancelOrRemove error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Accepter une demande ─────────────────────────────────────────────────
  const acceptRequest = async () => {
    if (!session || !friendshipStatus.requestId) return;
    setActionLoading(true);
    try {
      const data = await apiFriends(session.access_token, {
        action: 'accept-request',
        user_id: session.user_id,
        request_id: friendshipStatus.requestId,
      });
      if (data.success) await loadProfile();
    } catch (error) {
      console.error('[VueProfil] acceptRequest error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Bouton d'action selon le statut ─────────────────────────────────────
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

  const avatarSource = profile?.avatar_url ? { uri: profile.avatar_url } : DEFAULT_AVATAR;

  return (
    <>
      {/* ── MODAL PRINCIPAL ────────────────────────────────────────────────── */}
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
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
                {/* Photo de profil cliquable */}
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => setAvatarZoomed(true)}
                  activeOpacity={0.85}
                >
                  <Image source={avatarSource} style={styles.avatar} />
                  <View style={styles.zoomBadge}>
                    <Ionicons name="expand" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>

                <Text style={styles.name}>{profile.prenom} {profile.nom}</Text>

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

                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#999" />
                  <Text style={styles.infoText}>
                    Membre depuis{' '}
                    {new Date(profile.created_at).toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

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

      {/* ── MODAL ZOOM AVATAR ──────────────────────────────────────────────── */}
      <Modal
        visible={avatarZoomed}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAvatarZoomed(false)}
      >
        <TouchableOpacity
          style={styles.zoomOverlay}
          activeOpacity={1}
          onPress={() => setAvatarZoomed(false)}
        >
          <TouchableOpacity style={styles.zoomCloseBtn} onPress={() => setAvatarZoomed(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          <Image source={avatarSource} style={styles.zoomedAvatar} resizeMode="contain" />

          {profile && (
            <Text style={styles.zoomedName}>{profile.prenom} {profile.nom}</Text>
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 10 },
      web: { boxShadow: '0 -3px 10px rgba(0,0,0,0.1)' } as any,
    }),
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  closeButton: { padding: 5 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

  // Avatar
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E0E0E0',
    borderWidth: 4,
    borderColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 5 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } as any,
    }),
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: '30%',
    backgroundColor: '#8A2BE2',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Infos
  name: { fontSize: 28, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 12 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeIcon: { marginRight: 6 },
  premiumText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  infoText: { fontSize: 14, color: '#999', marginLeft: 8 },

  // Actions
  actionContainer: { marginTop: 10 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonIcon: { marginRight: 8 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
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
  actionButtonSecondaryText: { color: '#666', fontSize: 16, fontWeight: '600' },
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
  actionButtonDangerText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  actionButtonsRow: { flexDirection: 'row', gap: 12 },
  halfButton: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  errorText: { marginTop: 16, fontSize: 16, color: '#EF4444' },

  // Zoom modal
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  zoomedAvatar: {
    width: 300,
    height: 300,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  zoomedName: { marginTop: 20, fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
});
