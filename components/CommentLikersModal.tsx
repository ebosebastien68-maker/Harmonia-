// CommentLikersModal.tsx — v3 (popup centré, bouton retour, cross-platform)
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/comments';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && commentId) {
      loadLikers();
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
      setLikers([]);
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

  const renderItem = ({ item, index }: { item: Liker; index: number }) => (
    <LikerRow
      liker={item}
      index={index}
      getInitials={getInitials}
      isLast={index === likers.length - 1}
    />
  );

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      {/* Backdrop — tap pour fermer */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Popup centré à dimensions fixes — aucune ambiguïté de layout */}
      <Animated.View
        style={[
          styles.popup,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Bouton retour */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#7B1FA2" />
          </TouchableOpacity>

          {/* Titre centré */}
          <View style={styles.headerCenter}>
            <View style={styles.heartBadge}>
              <MaterialIcons name="favorite" size={13} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>
              {loading ? '…' : likers.length}{' '}
              <Text style={styles.headerSub}>
                {likers.length === 1 ? 'like' : 'likes'}
              </Text>
            </Text>
          </View>

          {/* Spacer miroir pour centrer */}
          <View style={styles.backButtonSpacer} />
        </View>

        <View style={styles.divider} />

        {/* ── Contenu : FlatList à hauteur fixe, scroll natif sans ambiguïté ── */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7B1FA2" />
            <Text style={styles.loadingText}>Chargement…</Text>
          </View>
        ) : likers.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconWrapper}>
              <MaterialIcons name="favorite-border" size={36} color="#CE93D8" />
            </View>
            <Text style={styles.emptyTitle}>Aucun like pour l'instant</Text>
            <Text style={styles.emptySubtitle}>Sois le premier à réagir !</Text>
          </View>
        ) : (
          <FlatList
            data={likers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Animated.View>
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
  const translateX = useRef(new Animated.Value(-16)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 240,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.likerItem,
        !isLast && styles.likerItemBorder,
        { transform: [{ translateX }], opacity },
      ]}
    >
      {/* Avatar + badge cœur */}
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
        <View style={styles.avatarHeartBadge}>
          <MaterialIcons name="favorite" size={8} color="#fff" />
        </View>
      </View>

      {/* Nom + sous-titre */}
      <View style={styles.likerInfo}>
        <Text style={styles.likerName} numberOfLines={1}>
          {liker.prenom} {liker.nom}
        </Text>
        <Text style={styles.likerSub}>A aimé ce commentaire</Text>
      </View>

      {/* Pill */}
      <View style={styles.likePill}>
        <MaterialIcons name="favorite" size={11} color="#7B1FA2" />
        <Text style={styles.likePillText}>Like</Text>
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// Dimensions fixes → le layout natif n'a jamais à deviner les hauteurs
const POPUP_WIDTH  = Math.min(SCREEN_WIDTH  * 0.88, 380);
const POPUP_HEIGHT = Math.min(SCREEN_HEIGHT * 0.55, 480);

const styles = StyleSheet.create({

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  popup: {
    position: 'absolute',
    top:  (SCREEN_HEIGHT - POPUP_HEIGHT) / 2,
    left: (SCREEN_WIDTH  - POPUP_WIDTH)  / 2,
    width:  POPUP_WIDTH,
    height: POPUP_HEIGHT,
    backgroundColor: '#FAFAFA',
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FAFAFA',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonSpacer: {
    width: 36,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heartBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#7B1FA2',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
      android: { elevation: 4 },
    }),
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSub: {
    fontSize: 15,
    fontWeight: '400',
    color: '#666',
  },

  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
  },
  emptyIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
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
  },
  likerItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E1BEE7',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarHeartBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  likerSub: {
    fontSize: 11,
    color: '#AAAAAA',
  },

  likePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E5F5',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  likePillText: {
    fontSize: 11,
    color: '#7B1FA2',
    fontWeight: '600',
  },
});
