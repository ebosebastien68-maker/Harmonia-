import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

// Import des écrans depuis app/
import ActuScreen from './actu';
import GamesScreen from './games';
import MessagesScreen from './messages';
import FriendsScreen from './friends';
import ProfileScreen from './profile';

type TabName = 'actu' | 'games' | 'messages' | 'friends' | 'profile';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabName>('actu');
  const [userSession, setUserSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      
      if (!session) {
        router.replace('/login');
        return;
      }

      const parsed = JSON.parse(session);
      setUserSession(parsed);
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleTabPress = (tab: TabName) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'actu':
        return <ActuScreen />;
      case 'games':
        return <GamesScreen />;
      case 'messages':
        return <MessagesScreen />;
      case 'friends':
        return <FriendsScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <ActuScreen />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="sync" size={40} color="#8A2BE2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Contenu principal */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom Tab Navigation */}
      <View style={styles.bottomTabsContainer}>
        <LinearGradient
          colors={['rgba(138, 43, 226, 0.98)', 'rgba(75, 0, 130, 0.98)']}
          style={styles.tabsGradient}
        >
          <View style={styles.tabs}>
            {/* Actu Tab */}
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handleTabPress('actu')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'actu' ? 'home' : 'home-outline'}
                size={26}
                color={activeTab === 'actu' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'actu' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            {/* Games Tab */}
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handleTabPress('games')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'games' ? 'game-controller' : 'game-controller-outline'}
                size={26}
                color={activeTab === 'games' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'games' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            {/* Messages Tab */}
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handleTabPress('messages')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'messages' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={26}
                color={activeTab === 'messages' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'messages' && <View style={styles.activeIndicator} />}
              <View style={styles.badge}>
                <Animated.Text style={styles.badgeText}>3</Animated.Text>
              </View>
            </TouchableOpacity>

            {/* Friends Tab */}
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handleTabPress('friends')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'friends' ? 'people' : 'people-outline'}
                size={26}
                color={activeTab === 'friends' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'friends' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            {/* Profile Tab */}
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handleTabPress('profile')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={26}
                color={activeTab === 'profile' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'profile' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  bottomTabsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 -4px 8px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  tabsGradient: {
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    paddingTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 35,
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 8,
    backgroundColor: '#FF0080',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8A2BE2',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
