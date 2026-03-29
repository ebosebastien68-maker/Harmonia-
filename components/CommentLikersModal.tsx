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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Remplace par l'URL de ton service Render ────────────────────────────────
const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/comments';
// ─────────────────────────────────────────────────────────────────────────────

interface Liker {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
}

interface CommentLikersModalProps {
  visible: boolean;
  commentId: string | null;
  onClose: () => void;
}

export default function CommentLikersModal({
  visible,
  commentId,
  onClose,
}: CommentLikersModalProps) {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && commentId) {
      loadLikers();
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, commentId]);

  const loadLikers = async () => {
    if (!commentId) return;

    setLoading(true);
    try {
      const sessionStr = await AsyncStorage.getItem('harmonia_session');
      if (!sessionStr) throw new Error('Session introuvable');

      const session = JSON.parse(sessionStr);
      const access_token: string = session.access_token;

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-comment-likers',
          comment_id: commentId,
          access_token,
        }),
      });

      const data = await response.json();

      if (data.success && data.likers) {
        setLikers(data.likers);
      }
    } catch (error) {
      console.error('[CommentLikersModal] Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (nom: string, prenom: string) =>
    `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.heartBadge}>
                <MaterialIcons name="favorite" size={16} color="#fff" />
              </View>
              <Text style={styles.headerTitle}>
                {likers.length}{' '}
                <Text style={styles.headerSub}>
                  {likers.length === 1 ? 'personne aime' : 'personnes aiment'}
                </Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color="#9E9E9E" />
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={styles.divider} />

          {/* Contenu */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#7B1FA2" />
                <Text style={styles.loadingText}>Chargement…</Text>
              </View>
            ) : likers.length === 0 ? (
              <View style={styles.centerContainer}>
                <View style={styles.emptyIconWrapper}>
                  <MaterialIcons name="favorite-border" size={40} color="#CE93D8" />
                </View>
                <Text style={styles.emptyTitle}>Aucun like pour l'instant</Text>
                <Text style={styles.emptySubtitle}>Sois le premier à réagir !</Text>
              </View>
            ) : (
              likers.map((liker, index) => (
                <LikerRow
                  key={liker.id}
                  liker={liker}
                  index={index}
                  getInitials={getInitials}
                />
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── LikerRow avec animation décalée ─────────────────────────────────────────

interface LikerRowProps {
  liker: Liker;
  index: number;
  getInitials: (nom: string, prenom: string) => string;
}

function LikerRow({ liker, index, getInitials }: LikerRowProps) {
  const slideAnim = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.likerItem,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      {/* Avatar */}
      {liker.avatar_url ? (
        <Image source={{ uri: liker.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {getInitials(liker.nom, liker.prenom)}
          </Text>
        </View>
      )}

      {/* Nom */}
      <View style={styles.likerInfo}>
        <Text style={styles.likerName} numberOfLines={1}>
          {liker.prenom} {liker.nom}
        </Text>
      </View>

      {/* Icône like */}
      <View style={styles.likeIconWrapper}>
        <MaterialIcons name="favorite" size={18} color="#7B1FA2" />
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '72%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#7B1FA2',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heartBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSub: {
    fontSize: 16,
    fontWeight: '400',
    color: '#555',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 20,
    marginBottom: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  centerContainer: {
    paddingVertical: 56,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  likerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FAFAFA',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#E1BEE7',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
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
    color: '#212121',
  },
  likeIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
