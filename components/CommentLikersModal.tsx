// CommentLikersModal.tsx — v2 (design amélioré + fix scroll mobile)
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

const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/comments';

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

  // Animation du sheet (slide + fade)
  const slideAnim  = useRef(new Animated.Value(300)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && commentId) {
      loadLikers();
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 12,
        }),
        Animated.timing(backdropOp, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
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
      if (data.success && data.likers) setLikers(data.likers);
    } catch (error) {
      console.error('[CommentLikersModal] Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (nom: string, prenom: string) =>
    `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>

        {/* Backdrop animé */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOp }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sheet animé */}
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header avec dégradé violet */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.heartBadge}>
                <MaterialIcons name="favorite" size={16} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {loading ? '…' : likers.length}{' '}
                  <Text style={styles.headerSub}>
                    {likers.length === 1 ? 'personne aime' : 'personnes aiment'}
                  </Text>
                </Text>
                <Text style={styles.headerCaption}>ce commentaire</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={20} color="#9E9E9E" />
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={styles.divider} />

          {/* Contenu — FIX: flex:1 pour scroll mobile correct */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
                  isLast={index === likers.length - 1}
                />
              ))
            )}
          </ScrollView>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── LikerRow ─────────────────────────────────────────────────────────────────

interface LikerRowProps {
  liker: Liker;
  index: number;
  isLast: boolean;
  getInitials: (nom: string, prenom: string) => string;
}

function LikerRow({ liker, index, isLast, getInitials }: LikerRowProps) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay: index * 45,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: index * 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.likerItem,
        !isLast && styles.likerItemBorder,
        { transform: [{ translateY }], opacity },
      ]}
    >
      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {liker.avatar_url ? (
          <Image source={{ uri: liker.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {getInitials(liker.nom, liker.prenom)}
            </Text>
          </View>
        )}
        {/* Badge cœur sur l'avatar */}
        <View style={styles.avatarHeartBadge}>
          <MaterialIcons name="favorite" size={9} color="#fff" />
        </View>
      </View>

      {/* Nom */}
      <View style={styles.likerInfo}>
        <Text style={styles.likerName} numberOfLines={1}>
          {liker.prenom} {liker.nom}
        </Text>
        <Text style={styles.likerSub}>A aimé ce commentaire</Text>
      </View>

      {/* Pill "like" */}
      <View style={styles.likePill}>
        <MaterialIcons name="favorite" size={13} color="#7B1FA2" />
        <Text style={styles.likePillText}>Like</Text>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // FIX: overflow:'hidden' + sans flexShrink pour scroll mobile
  modalContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '72%',
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    ...Platform.select({
      ios: {
        shadowColor: '#7B1FA2',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: { elevation: 12 },
    }),
  },

  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D8D8D8',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heartBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
    // Légère ombre violette
    ...Platform.select({
      ios: {
        shadowColor: '#7B1FA2',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 5 },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  headerSub: {
    fontSize: 16,
    fontWeight: '400',
    color: '#555',
  },
  headerCaption: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 1,
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

  // FIX: flex:1 pour que le ScrollView connaisse sa hauteur sur mobile
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 16,
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
    width: 76,
    height: 76,
    borderRadius: 38,
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
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  likerItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E1BEE7',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Petit cœur positionné en bas à droite de l'avatar
  avatarHeartBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FAFAFA',
  },

  likerInfo: {
    flex: 1,
  },
  likerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  likerSub: {
    fontSize: 12,
    color: '#AAAAAA',
  },

  // Pill violet clair à droite
  likePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  likePillText: {
    fontSize: 12,
    color: '#7B1FA2',
    fontWeight: '600',
  },
});
