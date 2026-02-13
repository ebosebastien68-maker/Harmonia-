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
// CONFIGURATION DES JEUX (STATIQUE - PAS DE BDD)
// =====================================================
const GAMES = [
  {
    id: '1',
    key_name: 'vrai_faux',
    title: 'Vrai ou Faux',
    icon: 'help-circle',
    color: '#10B981',
    route: '/games/vrai-faux',
  },
  {
    id: '2',
    key_name: 'awale',
    title: 'Awalé',
    icon: 'game-controller',
    color: '#F59E0B',
    route: '/games/awale',
  },
  {
    id: '3',
    key_name: 'ludo',
    title: 'Ludo',
    icon: 'dice',
    color: '#EF4444',
    route: '/games/ludo',
  },
  {
    id: '4',
    key_name: 'dames',
    title: 'Dames',
    icon: 'grid',
    color: '#6366F1',
    route: '/games/dames',
  },
  {
    id: '5',
    key_name: 'nombres',
    title: 'Nombres',
    icon: 'calculator',
    color: '#8B5CF6',
    route: '/games/nombres',
  },
  {
    id: '6',
    key_name: 'photo',
    title: 'Photo',
    icon: 'camera',
    color: '#EC4899',
    route: '/games/photo',
  },
  {
    id: '7',
    key_name: 'comedie',
    title: 'Comédie',
    icon: 'happy',
    color: '#F97316',
    route: '/games/comedie',
  },
  {
    id: '8',
    key_name: 'music',
    title: 'Music',
    icon: 'musical-notes',
    color: '#14B8A6',
    route: '/games/music',
  },
  {
    id: '9',
    key_name: 'piano',
    title: 'Piano',
    icon: 'musical-note',
    color: '#06B6D4',
    route: '/games/piano',
  },
  {
    id: '10',
    key_name: 'guitare',
    title: 'Guitare',
    icon: 'radio',
    color: '#3B82F6',
    route: '/games/guitare',
  },
];

// =====================================================
// COMPOSANT PRINCIPAL
// =====================================================
export default function GamesScreen() {
  const router = useRouter();

  const handleGamePress = (game: typeof GAMES[0]) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    router.push(game.route as any);
  };

  const GameIcon = ({ game }: { game: typeof GAMES[0] }) => {
    return (
      <TouchableOpacity
        style={styles.gameIcon}
        onPress={() => handleGamePress(game)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: game.color }]}>
          <Ionicons name={game.icon as any} size={32} color="#FFF" />
        </View>
        <Text style={styles.gameLabel} numberOfLines={2}>
          {game.title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>🎮 Jeux</Text>
            <Text style={styles.headerSubtitle}>Choisissez votre jeu préféré</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Grille d'icônes */}
        <View style={styles.gamesGrid}>
          {GAMES.map((game) => (
            <GameIcon key={game.id} game={game} />
          ))}
        </View>

        {/* Section info */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={24} color="#8A2BE2" />
          <Text style={styles.infoText}>
            Tapez sur un jeu pour commencer à jouer
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E0D0FF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    paddingTop: 24,
  },
  gameIcon: {
    width: (width - 64) / 3, // 3 colonnes avec espaces
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  gameLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E6FF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#8A2BE2',
    lineHeight: 20,
  },
});
          
