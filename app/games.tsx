import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/games';

interface Game {
  id: string;
  key_name: string;
  title: string;
  description: string;
}

// Configuration des icônes et couleurs par jeu
const GAME_CONFIG: { [key: string]: { icon: string; color: string } } = {
  'vrai_faux': { icon: 'help-circle', color: '#10B981' },
  'awale': { icon: 'game-controller', color: '#F59E0B' },
  'ludo': { icon: 'dice', color: '#EF4444' },
  'dames': { icon: 'grid', color: '#6366F1' },
  'nombres': { icon: 'calculator', color: '#8B5CF6' },
  'photo': { icon: 'camera', color: '#EC4899' },
  'comedie': { icon: 'happy', color: '#F97316' },
  'music': { icon: 'musical-notes', color: '#14B8A6' },
  'piano': { icon: 'musical-note', color: '#06B6D4' },
  'guitare': { icon: 'radio', color: '#3B82F6' },
};

export default function GamesScreen() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    loadUserAndGames();
  }, []);

  const loadUserAndGames = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
      }

      await loadGames();
    } catch (error) {
      console.error('Error loading:', error);
    }
  };

  const loadGames = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'list-games',
        }),
      });

      const data = await response.json();
      if (data.success && data.games) {
        setGames(data.games);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGamePress = (game: Game) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Navigation vers le jeu spécifique
    const routes: { [key: string]: string } = {
      'vrai_faux': '/games/vrai-faux',
      'awale': '/games/awale',
      'ludo': '/games/ludo',
      'dames': '/games/dames',
      'nombres': '/games/nombres',
      'photo': '/games/photo',
      'comedie': '/games/comedie',
      'music': '/games/music',
      'piano': '/games/piano',
      'guitare': '/games/guitare',
    };

    const route = routes[game.key_name];
    if (route) {
      router.push(route as any);
    } else {
      console.log('Game not implemented:', game.key_name);
    }
  };

  const GameIcon = ({ game }: { game: Game }) => {
    const config = GAME_CONFIG[game.key_name] || { icon: 'game-controller', color: '#8A2BE2' };
    
    return (
      <TouchableOpacity
        style={styles.gameIcon}
        onPress={() => handleGamePress(game)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon as any} size={32} color="#FFF" />
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
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Chargement des jeux...</Text>
        </View>
      ) : games.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="game-controller-outline" size={80} color="#CCC" />
          <Text style={styles.emptyText}>Aucun jeu disponible</Text>
          <Text style={styles.emptySubtext}>Revenez plus tard</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Grille d'icônes */}
          <View style={styles.gamesGrid}>
            {games.map((game) => (
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
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 8,
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
