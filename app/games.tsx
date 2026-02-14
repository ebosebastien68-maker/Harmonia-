import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// =====================================================
// CONFIGURATION DES ACTIVITÉS (STATIQUE)
// =====================================================
const CATEGORIES = [
  {
    id: 'games',
    title: 'Jeux',
    icon: 'game-controller',
    color: '#8B5CF6',
    description: 'Affrontez-vous et gagnez',
    items: [
      { id: '1', key: 'vrai_faux', title: 'Vrai ou Faux', icon: 'help-circle', color: '#10B981', route: '/games/vrai-faux' },
      { id: '2', key: 'awale', title: 'Awalé', icon: 'extension-puzzle', color: '#F59E0B', route: '/games/awale' },
      { id: '3', key: 'ludo', title: 'Ludo', icon: 'dice', color: '#EF4444', route: '/games/ludo' },
      { id: '4', key: 'dames', title: 'Dames', icon: 'grid', color: '#6366F1', route: '/games/dames' },
      { id: '5', key: 'nombres', title: 'Nombres', icon: 'calculator', color: '#8B5CF6', route: '/games/nombres' },
    ],
  },
  {
    id: 'arts',
    title: 'Arts',
    icon: 'brush',
    color: '#EC4899',
    description: 'Exprimez votre créativité',
    items: [
      { id: '6', key: 'photo', title: 'Photo', icon: 'camera', color: '#EC4899', route: '/games/photo' },
      { id: '7', key: 'dessin', title: 'Dessin', icon: 'color-palette', color: '#F97316', route: '/games/dessin' },
      { id: '8', key: 'design', title: 'Design', icon: 'shapes', color: '#8B5CF6', route: '/games/design' },
    ],
  },
  {
    id: 'performances',
    title: 'Performances',
    icon: 'mic',
    color: '#F59E0B',
    description: 'Montrez vos talents',
    items: [
      { id: '9', key: 'comedie', title: 'Comédie', icon: 'happy', color: '#F97316', route: '/games/comedie' },
      { id: '10', key: 'danse', title: 'Danse', icon: 'body', color: '#EC4899', route: '/games/danse' },
      { id: '11', key: 'theatre', title: 'Théâtre', icon: 'people', color: '#8B5CF6', route: '/games/theatre' },
    ],
  },
  {
    id: 'music',
    title: 'Musique',
    icon: 'musical-notes',
    color: '#14B8A6',
    description: 'Faites vibrer votre audience',
    items: [
      { id: '12', key: 'music', title: 'Chant', icon: 'musical-notes', color: '#14B8A6', route: '/games/music' },
      { id: '13', key: 'piano', title: 'Piano', icon: 'musical-note', color: '#06B6D4', route: '/games/piano' },
      { id: '14', key: 'guitare', title: 'Guitare', icon: 'radio', color: '#3B82F6', route: '/games/guitare' },
      { id: '15', key: 'djing', title: 'DJ', icon: 'disc', color: '#8B5CF6', route: '/games/djing' },
    ],
  },
];

// =====================================================
// COMPOSANT PRINCIPAL
// =====================================================
export default function GamesScreen() {
  const router = useRouter();

  const handleItemPress = (item: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(item.route as any);
  };

  const CategorySection = ({ category }: { category: typeof CATEGORIES[0] }) => {
    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
            <Ionicons name={category.icon as any} size={24} color="#FFF" />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </View>
        </View>

        <View style={styles.itemsGrid}>
          {category.items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemIcon}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon as any} size={28} color="#FFF" />
              </View>
              <Text style={styles.itemLabel} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header avec Hero */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🎮</Text>
          <Text style={styles.heroTitle}>Centre de Divertissement</Text>
          <Text style={styles.heroSubtitle}>Révélez votre talent au monde</Text>
          
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.heroBadgeText}>Compétitions</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.heroBadgeText}>Talents</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="people" size={16} color="#FFD700" />
              <Text style={styles.heroBadgeText}>Communauté</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories */}
        {CATEGORIES.map((category) => (
          <CategorySection key={category.id} category={category} />
        ))}

        {/* Call to Action */}
        <View style={styles.ctaSection}>
          <LinearGradient colors={['#FFD700', '#FF0080']} style={styles.ctaGradient}>
            <Ionicons name="rocket" size={40} color="#FFF" />
            <Text style={styles.ctaTitle}>Révélez votre talent !</Text>
            <Text style={styles.ctaText}>
              Participez aux compétitions, gagnez des trophées et devenez une star Harmonia
            </Text>
          </LinearGradient>
        </View>

        {/* Info Footer */}
        <View style={styles.infoFooter}>
          <Ionicons name="information-circle" size={20} color="#8A2BE2" />
          <Text style={styles.infoText}>
            Nouveau contenu ajouté chaque semaine. Restez connecté !
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 30,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#E0D0FF',
    textAlign: 'center',
    marginBottom: 20,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  categorySection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 13,
    color: '#666',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
  },
  itemIcon: {
    width: (width - 64) / 4, // 4 colonnes
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    lineHeight: 14,
  },
  ctaSection: {
    marginHorizontal: 16,
    marginTop: 32,
    borderRadius: 20,
    overflow: 'hidden',
  },
  ctaGradient: {
    padding: 24,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.95,
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E6FF',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#8A2BE2',
    lineHeight: 18,
  },
});
      
