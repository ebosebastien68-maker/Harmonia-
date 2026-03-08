import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// =====================================================
// IMPORTS DES COMPOSANTS
// =====================================================
import VraiFaux from './games/vrai-faux';
import Awale from './games/awale';
import Dames from './games/dames';
import Photo from './games/photo';
import Comedie from './games/comedie';
import Music from './games/music';
import Djing from './games/djing';

const { width } = Dimensions.get('window');

// =====================================================
// PALETTE & THÈME PREMIUM
// =====================================================
const THEME = {
  bg: '#0D0D14',
  surface: '#16161F',
  card: '#1E1E2E',
  border: '#2A2A3D',
  text: '#F0EEF8',
  textMuted: '#7B7A9A',
  accent: '#C084FC',
};

// =====================================================
// CONFIGURATION DES CATÉGORIES
// =====================================================
const CATEGORIES = [
  {
    id: 'strategie',
    title: 'Jeux Stratégiques',
    icon: 'chess-board' as const,
    ionIcon: 'extension-puzzle',
    gradient: ['#1A1033', '#2D1B69'],
    accentColor: '#7C3AED',
    glowColor: '#7C3AED40',
    badge: '♟',
    description: 'Réflexion & tactique',
    items: [
      {
        id: 's1',
        title: 'Awalé',
        icon: 'ellipse' as const,
        emoji: '🔵',
        color: '#7C3AED',
        gradientColors: ['#7C3AED', '#5B21B6'] as const,
        component: Awale,
      },
      {
        id: 's2',
        title: 'Dames',
        icon: 'grid' as const,
        emoji: '⬜',
        color: '#6D28D9',
        gradientColors: ['#6D28D9', '#4C1D95'] as const,
        component: Dames,
      },
    ],
  },
  {
    id: 'connaissance',
    title: 'Jeux de Connaissances',
    icon: 'bulb',
    ionIcon: 'bulb',
    gradient: ['#0A2540', '#0E3A5C'],
    accentColor: '#0EA5E9',
    glowColor: '#0EA5E940',
    badge: '🧠',
    description: 'Testez votre savoir',
    items: [
      {
        id: 'c1',
        title: 'Vrai ou Faux',
        icon: 'checkmark-circle' as const,
        emoji: '✅',
        color: '#0EA5E9',
        gradientColors: ['#0EA5E9', '#0284C7'] as const,
        component: VraiFaux,
      },
    ],
  },
  {
    id: 'arts',
    title: 'Arts',
    icon: 'color-palette',
    ionIcon: 'color-palette',
    gradient: ['#2D0A3A', '#4A1259'],
    accentColor: '#EC4899',
    glowColor: '#EC489940',
    badge: '🎨',
    description: 'Créativité & expression',
    items: [
      {
        id: 'a1',
        title: 'Photo',
        icon: 'camera' as const,
        emoji: '📸',
        color: '#EC4899',
        gradientColors: ['#EC4899', '#BE185D'] as const,
        component: Photo,
      },
      {
        id: 'a2',
        title: 'Dessin',
        icon: 'pencil' as const,
        emoji: '✏️',
        color: '#F97316',
        gradientColors: ['#F97316', '#EA580C'] as const,
        component: Photo, // ouvre Photo
      },
      {
        id: 'a3',
        title: 'Design',
        icon: 'shapes' as const,
        emoji: '🖌️',
        color: '#A855F7',
        gradientColors: ['#A855F7', '#7C3AED'] as const,
        component: Photo, // ouvre Photo
      },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    icon: 'mic',
    ionIcon: 'mic',
    gradient: ['#1A0A00', '#3D1500'],
    accentColor: '#F59E0B',
    glowColor: '#F59E0B40',
    badge: '🎭',
    description: 'Montez sur scène',
    items: [
      {
        id: 'p1',
        title: 'Comédie',
        icon: 'happy' as const,
        emoji: '😄',
        color: '#F59E0B',
        gradientColors: ['#F59E0B', '#D97706'] as const,
        component: Comedie,
      },
      {
        id: 'p2',
        title: 'Danse',
        icon: 'body' as const,
        emoji: '💃',
        color: '#EF4444',
        gradientColors: ['#EF4444', '#DC2626'] as const,
        component: Comedie, // ouvre Comedie
      },
      {
        id: 'p3',
        title: 'Théâtre',
        icon: 'film' as const,
        emoji: '🎭',
        color: '#8B5CF6',
        gradientColors: ['#8B5CF6', '#7C3AED'] as const,
        component: Comedie, // ouvre Comedie
      },
    ],
  },
  {
    id: 'musique',
    title: 'Musique',
    icon: 'musical-notes',
    ionIcon: 'musical-notes',
    gradient: ['#001A1A', '#003333'],
    accentColor: '#14B8A6',
    glowColor: '#14B8A640',
    badge: '🎵',
    description: 'Faites vibrer la scène',
    items: [
      {
        id: 'm1',
        title: 'Chant',
        icon: 'mic' as const,
        emoji: '🎤',
        color: '#14B8A6',
        gradientColors: ['#14B8A6', '#0D9488'] as const,
        component: Music,
      },
      {
        id: 'm2',
        title: 'Piano',
        icon: 'musical-note' as const,
        emoji: '🎹',
        color: '#06B6D4',
        gradientColors: ['#06B6D4', '#0891B2'] as const,
        component: Music, // ouvre Music (Chant)
      },
      {
        id: 'm3',
        title: 'Guitare',
        icon: 'radio' as const,
        emoji: '🎸',
        color: '#3B82F6',
        gradientColors: ['#3B82F6', '#2563EB'] as const,
        component: Music, // ouvre Music (Chant)
      },
    ],
  },
  {
    id: 'artisanat',
    title: 'Artisanat',
    icon: 'construct',
    ionIcon: 'construct',
    gradient: ['#1A0D00', '#2D1A00'],
    accentColor: '#D97706',
    glowColor: '#D9770640',
    badge: '🛠',
    description: 'Savoir-faire & métiers',
    items: [
      {
        id: 'ar1',
        title: 'Couture',
        icon: 'cut' as const,
        emoji: '🧵',
        color: '#D97706',
        gradientColors: ['#D97706', '#B45309'] as const,
        component: Djing,
      },
      {
        id: 'ar2',
        title: 'Menuiserie',
        icon: 'hammer' as const,
        emoji: '🪚',
        color: '#92400E',
        gradientColors: ['#92400E', '#78350F'] as const,
        component: Djing,
      },
      {
        id: 'ar3',
        title: 'Coiffure',
        icon: 'sparkles' as const,
        emoji: '✂️',
        color: '#BE185D',
        gradientColors: ['#BE185D', '#9D174D'] as const,
        component: Djing,
      },
      {
        id: 'ar4',
        title: 'Soudure',
        icon: 'flame' as const,
        emoji: '🔥',
        color: '#DC2626',
        gradientColors: ['#DC2626', '#B91C1C'] as const,
        component: Djing,
      },
      {
        id: 'ar5',
        title: 'Mécanique',
        icon: 'settings' as const,
        emoji: '⚙️',
        color: '#374151',
        gradientColors: ['#6B7280', '#374151'] as const,
        component: Djing,
      },
    ],
  },
];

// =====================================================
// COMPOSANT ITEM CARD
// =====================================================
const ItemCard = ({
  item,
  onPress,
}: {
  item: (typeof CATEGORIES)[0]['items'][0];
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.itemCard, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={item.gradientColors}
          style={styles.itemCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.itemEmoji}>{item.emoji}</Text>
          <Text style={styles.itemTitle}>{item.title}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// =====================================================
// COMPOSANT CATÉGORIE
// =====================================================
const CategorySection = ({
  category,
  onItemPress,
}: {
  category: (typeof CATEGORIES)[0];
  onItemPress: (item: any) => void;
}) => {
  return (
    <View style={styles.categoryWrapper}>
      <LinearGradient
        colors={category.gradient as any}
        style={styles.categoryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header catégorie */}
        <View style={styles.catHeader}>
          <View style={[styles.catBadgeContainer, { borderColor: category.accentColor + '60' }]}>
            <Text style={styles.catBadgeEmoji}>{category.badge}</Text>
          </View>
          <View style={styles.catInfo}>
            <Text style={styles.catTitle}>{category.title}</Text>
            <Text style={[styles.catDesc, { color: category.accentColor }]}>
              {category.description}
            </Text>
          </View>
          <View style={[styles.catDot, { backgroundColor: category.accentColor }]} />
        </View>

        {/* Séparateur lumineux */}
        <View style={[styles.catDivider, { backgroundColor: category.accentColor + '30' }]} />

        {/* Grille d'items */}
        <View style={styles.itemsRow}>
          {category.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onPress={() => onItemPress(item)}
            />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

// =====================================================
// COMPOSANT PRINCIPAL
// =====================================================
export default function GamesScreen() {
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleItemPress = (item: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedGame(item);
    setModalVisible(true);
  };

  const handleCloseGame = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedGame(null), 300);
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER HERO ── */}
      <LinearGradient
        colors={['#12001F', '#1A0035', '#0D0D14']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Orbe décoratif */}
        <View style={styles.heroOrb} />

        <View style={styles.heroContent}>
          <View style={styles.heroPill}>
            <View style={styles.heroPillDot} />
            <Text style={styles.heroPillText}>Harmonia · Centre des Talents</Text>
          </View>

          <Text style={styles.heroTitle}>Révélez votre{'\n'}Talent</Text>
          <Text style={styles.heroSubtitle}>
            Compétitions, créations & savoir-faire
          </Text>

          <View style={styles.heroStats}>
            {[
              { icon: '🏆', label: 'Trophées' },
              { icon: '⚡', label: 'Live' },
              { icon: '🌍', label: 'Communauté' },
            ].map((s) => (
              <View key={s.label} style={styles.heroStatItem}>
                <Text style={styles.heroStatIcon}>{s.icon}</Text>
                <Text style={styles.heroStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* ── CONTENU ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionIntro}>Choisissez votre discipline</Text>

        {CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            onItemPress={handleItemPress}
          />
        ))}

        {/* CTA */}
        <View style={styles.cta}>
          <LinearGradient
            colors={['#7C3AED', '#C026D3', '#EC4899']}
            style={styles.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.ctaEmoji}>🚀</Text>
            <Text style={styles.ctaTitle}>Prêt à dominer ?</Text>
            <Text style={styles.ctaText}>
              Nouveau contenu chaque semaine. Revenez souvent !
            </Text>
          </LinearGradient>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL JEU ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseGame}
      >
        <View style={styles.modalContainer}>
          {selectedGame?.component && (
            <selectedGame.component
              title={selectedGame.title}
              icon={selectedGame.icon}
              color={selectedGame.color}
              onClose={handleCloseGame}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================
const CARD_RADIUS = 20;
const ITEM_SIZE = (width - 64) / 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  // ── HEADER ──
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 36,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7C3AED',
    opacity: 0.15,
  },
  heroContent: {
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(196, 132, 252, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(196, 132, 252, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 18,
    gap: 8,
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C084FC',
  },
  heroPillText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#9D8FBB',
    marginBottom: 28,
    letterSpacing: 0.2,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 16,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroStatIcon: {
    fontSize: 14,
  },
  heroStatLabel: {
    color: '#E0D8F5',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── SCROLL ──
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  sectionIntro: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },

  // ── CATEGORY CARD ──
  categoryWrapper: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  categoryCard: {
    borderRadius: CARD_RADIUS,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  catBadgeContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catBadgeEmoji: {
    fontSize: 22,
  },
  catInfo: {
    flex: 1,
  },
  catTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  catDesc: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
  catDivider: {
    height: 1,
    borderRadius: 1,
    marginBottom: 16,
  },

  // ── ITEMS ROW ──
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCard: {
    width: ITEM_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  itemCardGradient: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  itemEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // ── CTA ──
  cta: {
    marginHorizontal: 16,
    marginTop: 28,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  ctaGradient: {
    padding: 28,
    alignItems: 'center',
  },
  ctaEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  ctaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── MODAL ──
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
});
