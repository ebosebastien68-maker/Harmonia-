import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/games';

interface Game {
  id: string;
  key_name: string;
  title: string;
  description: string;
}

const GAME_ICONS: { [key: string]: string } = {
  'vrai_faux': 'help-circle',
  'awale': 'game-controller',
  'ludo': 'dice',
  'dames': 'grid',
  'nombres': 'calculator',
  'photo': 'camera',
  'comedie': 'happy',
  'music': 'musical-notes',
  'piano': 'musical-note',
  'guitare': 'radio',
};

const GAME_COLORS: { [key: string]: string[] } = {
  'vrai_faux': ['#10B981', '#059669'],
  'awale': ['#F59E0B', '#D97706'],
  'ludo': ['#EF4444', '#DC2626'],
  'dames': ['#6366F1', '#4F46E5'],
  'nombres': ['#8B5CF6', '#7C3AED'],
  'photo': ['#EC4899', '#DB2777'],
  'comedie': ['#F97316', '#EA580C'],
  'music': ['#14B8A6', '#0D9488'],
  'piano': ['#06B6D4', '#0891B2'],
  'guitare': ['#3B82F6', '#2563EB'],
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

    // Router vers le jeu spécifique
    switch (game.key_name) {
      case 'vrai_faux':
        router.push('/games/vrai-faux');
        break;
      case 'awale':
        router.push('/games/awale');
        break;
      case 'ludo':
        router.push('/games/ludo');
        break;
      case 'dames':
        router.push('/games/dames');
        break;
      case 'nombres':
        router.push('/games/nombres');
        break;
      case 'photo':
        router.push('/games/photo');
        break;
      case 'comedie':
        router.push('/games/comedie');
        break;
      case 'music':
        router.push('/games/music');
        break;
      case 'piano':
        router.push('/games/piano');
        break;
      case 'guitare':
        router.push('/games/guitare');
        break;
      default:
        console.log('Game not implemented:', game.key_name);
    }
  };

  const GameCard = ({ game }: { game: Game }) => {
    const icon = GAME_ICONS[game.key_name] || 'game-controller';
    const colors = GAME_COLORS[game.key_name] || ['#8A2BE2', '#4B0082'];

    return (
      <TouchableOpacity
        style={styles.gameCard}
        onPress={() => handleGamePress(game)}
        activeOpacity={0.9}
      >
        <LinearGradient colors={colors} style={styles.gameGradient}>
          <View style={styles.gameIcon}>
            <Ionicons name={icon as any} size={40} color="#FFF" />
          </View>
          <Text style={styles.gameTitle}>{game.title}</Text>
          <Text style={styles.gameDescription} numberOfLines={2}>
            {game.description}
          </Text>
          <View style={styles.playButton}>
            <Ionicons name="play" size={16} color="#FFF" />
            <Text style={styles.playButtonText}>Jouer</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <Text style={styles.headerTitle}>🎮 Jeux</Text>
        <Text style={styles.headerSubtitle}>Choisissez votre jeu</Text>
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
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.gamesGrid}
          showsVerticalScrollIndicator={false}
        >
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
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
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
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
    fontSize: 18,
    color: '#999',
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
  },
  gamesGrid: {
    padding: 16,
    paddingBottom: 100,
  },
  gameCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
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
  gameGradient: {
    padding: 24,
    minHeight: 180,
  },
  gameIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  gameDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  playButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
