// =====================================================
// LikersModal.tsx
// Modal affichant les utilisateurs qui ont aimé un post
// API : Render /likers — token via AsyncStorage
// Compatible : Web · Android · iOS
// =====================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const STORAGE_KEY = 'harmonia_session';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

interface Liker {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
}

interface LikersModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function LikersModal({ visible, postId, onClose }: LikersModalProps) {
  const [likers, setLikers]       = useState<Liker[]>([]);
  const [loading, setLoading]     = useState(false);
  const [initializing, setInit]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Animation du slide-up
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // ── Animations ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ── Chargement ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible && postId) {
      loadLikers();
    } else {
      setLikers([]);
      setError(null);
    }
  }, [visible, postId]);

  const getSession = async (): Promise<Session | null> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  };

  const loadLikers = async () => {
    if (!postId) return;

    setInit(true);
    setError(null);

    try {
      const session = await getSession();

      if (!session?.access_token) {
        setError('Session introuvable — reconnectez-vous');
        return;
      }

      setInit(false);
      setLoading(true);

      const response = await fetch(`${API_BASE}/likers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-post-likers',
          post_id: postId,
          access_token: session.access_token,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error ?? `Erreur serveur (${response.status})`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.likers)) {
        setLikers(data.likers);
      } else {
        setLikers([]);
      }
    } catch (err: any) {
      console.error('[LikersModal] Erreur:', err?.message);
      setError(err?.message ?? 'Impossible de charger les likes');
    } finally {
      setInit(false);
      setLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getInitials = (nom: string, prenom: string) =>
    `${(prenom ?? '?').charAt(0)}${(nom ?? '?').charAt(0)}`.toUpperCase();

  const handleClose = () => {
    onClose();
  };

  // ── Rendu état initialisation ────────────────────────────────────────────────

  const renderInitializing = () => (
    <View style={styles.initContainer}>
      <View style={styles.initIconWrapper}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
      <Text style={styles.initTitle}>Synchronisation en cours…</Text>
      <Text style={styles.initSub}>Récupération des mentions J'aime</Text>
    </View>
  );

  // ── Rendu état erreur ────────────────────────────────────────────────────────

  const renderError = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="cloud-offline-outline" size={40} color="#7C3AED" />
      </View>
      <Text style={styles.emptyText}>Une erreur est survenue</Text>
      <Text style={styles.emptySubtext}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadLikers}>
        <Ionicons name="refresh" size={16} color="#FFF" />
        <Text style={styles.retryText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Rendu liste vide ─────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="heart-outline" size={40} color="#7C3AED" />
      </View>
      <Text style={styles.emptyText}>Aucun like pour l'instant</Text>
      <Text style={styles.emptySubtext}>Soyez le premier à aimer ce post !</Text>
    </View>
  );

  // ── Rendu item liker ─────────────────────────────────────────────────────────

  const renderLiker = (liker: Liker, index: number) => (
    <View key={liker.id} style={[styles.likerItem, index === 0 && styles.likerItemFirst]}>
      {liker.avatar_url ? (
        <Image
          source={{ uri: liker.avatar_url }}
          style={styles.avatar}
          defaultSource={require('../app/assets/default-avatar.png')}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{getInitials(liker.nom, liker.prenom)}</Text>
        </View>
      )}
      <View style={styles.likerInfo}>
        <Text style={styles.likerName}>
          {liker.prenom} {liker.nom}
        </Text>
      </View>
      <View style={styles.likerBadge}>
        <Ionicons name="heart" size={14} color="#EC4899" />
      </View>
    </View>
  );

  // ── Rendu principal ──────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {Platform.OS === 'android' && <StatusBar backgroundColor="rgba(0,0,0,0.5)" translucent />}

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheetWrapper,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrapper}>
              <Ionicons name="heart" size={18} color="#EC4899" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Mentions J'aime</Text>
              {likers.length > 0 && !loading && !initializing && (
                <Text style={styles.headerCount}>
                  {likers.length} {likers.length === 1 ? 'personne' : 'personnes'}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Séparateur */}
        <View style={styles.divider} />

        {/* Contenu */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS !== 'web'}
        >
          {initializing
            ? renderInitializing()
            : error
            ? renderError()
            : loading
            ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.loadingText}>Chargement…</Text>
              </View>
            )
            : likers.length === 0
            ? renderEmpty()
            : likers.map((liker, i) => renderLiker(liker, i))
          }
        </ScrollView>

        {/* Safe area bottom pour iOS & Android */}
        <View style={styles.safeBottom} />
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 10, 30, 0.55)',
  },

  // Sheet
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.72,
    minHeight: 220,
    ...Platform.select({
      ios: {
        shadowColor: '#4C1D95',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: {
        boxShadow: '0px -4px 24px rgba(76, 29, 149, 0.12)',
      },
    }),
  },

  // Drag handle
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexGrow: 1,
  },

  // État init / synchronisation
  initContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  initIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  initTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  initSub: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  // État loading
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },

  // État vide / erreur
  emptyContainer: {
    flex: 1,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
    gap: 6,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Liker item
  likerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  likerItemFirst: {
    borderTopWidth: 0,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  likerInfo: {
    flex: 1,
  },
  likerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  likerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Safe area bottom
  safeBottom: {
    height: Platform.select({ ios: 28, android: 16, web: 12, default: 12 }),
  },
});
