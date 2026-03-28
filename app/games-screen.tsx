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
import HarmoniaLogo from '../components/HarmoniaLogo';

// =====================================================
// IMPORTS DES COMPOSANTS DE JEUX
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
// PALETTE HARMONIA
// =====================================================
const BRAND = {
  purple:      '#8A2BE2',
  purpleDark:  '#4B0082',
  purpleMid:   '#6A1BB2',
  orange:      '#FF8C00',
  orangeLight: '#FFA500',
  gold:        '#FFD700',
  bg:          '#0E0017',
  surface:     '#160020',
  card:        '#1C0030',
  border:      '#2E1050',
  text:        '#F5F0FF',
  textMuted:   '#9B82C4',
};

// =====================================================
// CONFIGURATION DES CATÉGORIES
// =====================================================
const CATEGORIES = [
  {
    id: 'strategie',
    title: 'Jeux Stratégiques',
    ionIcon: 'extension-puzzle-outline' as const,
    gradient: ['#1A0840', '#2D1469'] as const,
    accentColor: '#A78BFA',
    description: 'Réflexion & tactique',
    items: [
      {
        id: 's1',
        title: 'Awalé',
        accentIcon: 'ellipse' as const,
        color: '#7C3AED',
        gradientColors: ['#4C1D95', '#6D28D9'] as const,
        component: Awale,
      },
      {
        id: 's2',
        title: 'Dames',
        accentIcon: 'grid' as const,
        color: '#8B5CF6',
        gradientColors: ['#3B0764', '#6D28D9'] as const,
        component: Dames,
      },
    ],
  },
  {
    id: 'connaissance',
    title: 'Jeux de Connaissances',
    ionIcon: 'bulb-outline' as const,
    gradient: ['#001830', '#002D50'] as const,
    accentColor: '#38BDF8',
    description: 'Testez votre savoir',
    items: [
      {
        id: 'c1',
        title: 'Vrai ou Faux',
        accentIcon: 'checkmark-circle' as const,
        color: '#0EA5E9',
        gradientColors: ['#0C4A6E', '#0369A1'] as const,
        component: VraiFaux,
      },
    ],
  },
  {
    id: 'arts',
    title: 'Arts',
    ionIcon: 'color-palette-outline' as const,
    gradient: ['#2D0A3A', '#4A1259'] as const,
    accentColor: '#F472B6',
    description: 'Créativité & expression',
    items: [
      {
        id: 'a1',
        title: 'Photo',
        accentIcon: 'camera' as const,
        color: '#EC4899',
        gradientColors: ['#831843', '#BE185D'] as const,
        component: Photo,
      },
      {
        id: 'a2',
        title: 'Dessin',
        accentIcon: 'pencil' as const,
        color: '#F97316',
        gradientColors: ['#7C2D12', '#C2410C'] as const,
        component: Photo,
      },
      {
        id: 'a3',
        title: 'Design',
        accentIcon: 'shapes' as const,
        color: '#A855F7',
        gradientColors: ['#4C1D95', '#7E22CE'] as const,
        component: Photo,
      },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    ionIcon: 'mic-outline' as const,
    gradient: ['#1A0800', '#351200'] as const,
    accentColor: '#FBBF24',
    description: 'Montez sur scène',
    items: [
      {
        id: 'p1',
        title: 'Comédie',
        accentIcon: 'happy' as const,
        color: '#F59E0B',
        gradientColors: ['#78350F', '#B45309'] as const,
        component: Comedie,
      },
      {
        id: 'p2',
        title: 'Danse',
        accentIcon: 'body' as const,
        color: '#F43F5E',
        gradientColors: ['#881337', '#BE123C'] as const,
        component: Comedie,
      },
      {
        id: 'p3',
        title: 'Théâtre',
        accentIcon: 'film' as const,
        color: '#818CF8',
        gradientColors: ['#1E1B4B', '#3730A3'] as const,
        component: Comedie,
      },
    ],
  },
  {
    id: 'musique',
    title: 'Musique',
    ionIcon: 'musical-notes-outline' as const,
    gradient: ['#001A1A', '#003030'] as const,
    accentColor: '#2DD4BF',
    description: 'Faites vibrer la scène',
    items: [
      {
        id: 'm1',
        title: 'Chant',
        accentIcon: 'mic' as const,
        color: '#14B8A6',
        gradientColors: ['#134E4A', '#0F766E'] as const,
        component: Music,
      },
      {
        id: 'm2',
        title: 'Piano',
        accentIcon: 'musical-note' as const,
        color: '#06B6D4',
        gradientColors: ['#164E63', '#0E7490'] as const,
        component: Music,
      },
      {
        id: 'm3',
        title: 'Guitare',
        accentIcon: 'radio' as const,
        color: '#3B82F6',
        gradientColors: ['#1E3A8A', '#1D4ED8'] as const,
        component: Music,
      },
    ],
  },
  {
    id: 'artisanat',
    title: 'Artisanat',
    ionIcon: 'construct-outline' as const,
    gradient: ['#1A0C00', '#2E1800'] as const,
    accentColor: '#F59E0B',
    description: 'Savoir-faire & métiers',
    items: [
      {
        id: 'ar1',
        title: 'Couture',
        accentIcon: 'cut' as const,
        color: '#D97706',
        gradientColors: ['#78350F', '#92400E'] as const,
        component: Djing,
      },
      {
        id: 'ar2',
        title: 'Menuiserie',
        accentIcon: 'hammer' as const,
        color: '#A16207',
        gradientColors: ['#422006', '#713F12'] as const,
        component: Djing,
      },
      {
        id: 'ar3',
        title: 'Coiffure',
        accentIcon: 'sparkles' as const,
        color: '#DB2777',
        gradientColors: ['#831843', '#9D174D'] as const,
        component: Djing,
      },
      {
        id: 'ar4',
        title: 'Soudure',
        accentIcon: 'flame' as const,
        color: '#DC2626',
        gradientColors: ['#7F1D1D', '#991B1B'] as const,
        component: Djing,
      },
      {
        id: 'ar5',
        title: 'Mécanique',
        accentIcon: 'settings' as const,
        color: '#64748B',
        gradientColors: ['#1E293B', '#334155'] as const,
        component: Djing,
      },
    ],
  },
];

// =====================================================
// ITEM CARD
// =====================================================
const ItemCard = ({
  item,
  onPress,
}: {
  item: (typeof CATEGORIES)[0]['items'][0];
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.91, useNativeDriver: true, speed: 60 }).start();

  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.itemCard,
          {
            transform: [{ scale }],
            shadowColor: item.color,
          },
        ]}
      >
        <LinearGradient
          colors={item.gradientColors}
          style={styles.itemCardInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.itemIconCircle}>
            <Ionicons name={item.accentIcon} size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.itemTitle}>{item.title}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// =====================================================
// CATEGORY SECTION
// =====================================================
const CategorySection = ({
  category,
  onItemPress,
}: {
  category: (typeof CATEGORIES)[0];
  onItemPress: (item: any) => void;
}) => (
  <View style={styles.categoryWrapper}>
    <LinearGradient
      colors={category.gradient}
      style={styles.categoryCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Header */}
      <View style={styles.catHeader}>
        <View style={[styles.catIconWrap, { borderColor: category.accentColor + '50' }]}>
          <Ionicons name={category.ionIcon} size={22} color={category.accentColor} />
        </View>
        <View style={styles.catInfo}>
          <Text style={styles.catTitle}>{category.title}</Text>
          <Text style={[styles.catDesc, { color: category.accentColor }]}>
            {category.description}
          </Text>
        </View>
      </View>

      {/* Séparateur */}
      <View style={[styles.catLine, { backgroundColor: category.accentColor + '25' }]} />

      {/* Items */}
      <View style={styles.itemsRow}>
        {category.items.map((item) => (
          <ItemCard key={item.id} item={item} onPress={() => onItemPress(item)} />
        ))}
      </View>
    </LinearGradient>
  </View>
);

// =====================================================
// ÉCRAN PRINCIPAL
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

      {/* ── HEADER ── */}
      <LinearGradient
        colors={[BRAND.purpleDark, BRAND.purple, '#A020F0']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Orbes décoratifs de fond */}
        <View style={[styles.orb, { width: 180, height: 180, top: -55, right: -45, backgroundColor: BRAND.orange, opacity: 0.14 }]} />
        <View style={[styles.orb, { width: 90, height: 90, bottom: -20, left: 15, backgroundColor: BRAND.gold, opacity: 0.10 }]} />

        <View style={styles.headerContent}>
          {/* Logo Harmonia */}
          <HarmoniaLogo size={50} showText={true} theme="light" />

          {/* Pill "Centre des Talents" */}
          <View style={styles.taglinePill}>
            <Ionicons name="star" size={11} color={BRAND.gold} />
            <Text style={styles.taglineText}>Centre des Talents</Text>
            <Ionicons name="star" size={11} color={BRAND.gold} />
          </View>

          {/* Titre */}
          <Text style={styles.heroTitle}>Révélez votre Talent</Text>

          {/* Badges */}
          <View style={styles.badgesRow}>
            {[
              { icon: 'trophy'  as const, label: 'Trophées'   },
              { icon: 'flash'   as const, label: 'Live'        },
              { icon: 'earth'   as const, label: 'Communauté' },
            ].map((b) => (
              <View key={b.label} style={styles.badge}>
                <Ionicons name={b.icon} size={13} color={BRAND.gold} />
                <Text style={styles.badgeText}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* ── SCROLL ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Label section */}
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>CHOISISSEZ VOTRE DISCIPLINE</Text>
          <View style={styles.sectionDot} />
        </View>

        {CATEGORIES.map((cat) => (
          <CategorySection key={cat.id} category={cat} onItemPress={handleItemPress} />
        ))}

        {/* Note bas de page */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={15} color={BRAND.textMuted} />
          <Text style={styles.footerNoteText}>
            Nouveau contenu ajouté chaque semaine — restez connecté !
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── MODAL ── */}
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
              icon={selectedGame.accentIcon}
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
const ITEM_SIZE = (width - 72) / 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingBottom: 26,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  headerContent: {
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 12,
  },
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.32)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
  },
  taglineText: {
    color: BRAND.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeText: {
    color: '#EDE9FE',
    fontSize: 11,
    fontWeight: '600',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 20 },

  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND.orange,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.textMuted,
    letterSpacing: 2.5,
  },

  // Category
  categoryWrapper: {
    paddingHorizontal: 14,
    marginBottom: 11,
  },
  categoryCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  catIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: { flex: 1 },
  catTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  catDesc: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  catLine: {
    height: 1,
    borderRadius: 1,
    marginBottom: 12,
  },

  // Items
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  itemCard: {
    width: ITEM_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  itemCardInner: {
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 82,
    gap: 7,
  },
  itemIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // Footer note
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(138,43,226,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.22)',
  },
  footerNoteText: {
    fontSize: 12,
    color: BRAND.textMuted,
    fontStyle: 'italic',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
});
