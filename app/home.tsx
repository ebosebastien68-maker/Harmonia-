import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import des écrans depuis app/
import ActuScreen from './actu';
import GamesScreen from './games';
import MessagesScreen from './messages';
import FriendsScreen from './friends';
import ProfileScreen from './profile';

type TabName = 'actu' | 'games' | 'messages' | 'friends' | 'profile';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabName>('actu');
  const [userSession, setUserSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Animations pour chaque tab
  const actuScale = useSharedValue(1);
  const gamesScale = useSharedValue(1);
  const messagesScale = useSharedValue(1);
  const friendsScale = useSharedValue(1);
  const profileScale = useSharedValue(1);

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
    // Animation bounce
    const scaleMap = {
      actu: actuScale,
      games: gamesScale,
      messages: messagesScale,
      friends: friendsScale,
      profile: profileScale,
    };

    const scale = scaleMap[tab];
    scale.value = withSpring(0.8, { damping: 10, stiffness: 200 }, () => {
      scale.value = withSpring(1);
    });

    setActiveTab(tab);
  };

  const getAnimatedStyle = (scale: Animated.SharedValue<number>) => {
    return useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));
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
        <Animated.View 
          style={{
            transform: [{ scale: withTiming(1.2, { duration: 1000 }) }]
          }}
        >
          <Ionicons name="sync" size={40} color="#8A2BE2" />
        </Animated.View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
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
            <AnimatedTouchable
              style={[styles.tab, getAnimatedStyle(actuScale)]}
              onPress={() => handleTabPress('actu')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'actu' ? 'home' : 'home-outline'}
                size={26}
                color={activeTab === 'actu' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'actu' && (
                <Animated.View 
                  style={styles.activeIndicator}
                  entering={withSpring}
                />
              )}
            </AnimatedTouchable>

            {/* Games Tab */}
            <AnimatedTouchable
              style={[styles.tab, getAnimatedStyle(gamesScale)]}
              onPress={() => handleTabPress('games')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'games' ? 'game-controller' : 'game-controller-outline'}
                size={26}
                color={activeTab === 'games' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'games' && (
                <Animated.View style={styles.activeIndicator} />
              )}
            </AnimatedTouchable>

            {/* Messages Tab */}
            <AnimatedTouchable
              style={[styles.tab, getAnimatedStyle(messagesScale)]}
              onPress={() => handleTabPress('messages')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'messages' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={26}
                color={activeTab === 'messages' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'messages' && (
                <Animated.View style={styles.activeIndicator} />
              )}
              <View style={styles.badge}>
                <Animated.Text 
                  style={styles.badgeText}
                  entering={withSpring}
                >
                  3
                </Animated.Text>
              </View>
            </AnimatedTouchable>

            {/* Friends Tab */}
            <AnimatedTouchable
              style={[styles.tab, getAnimatedStyle(friendsScale)]}
              onPress={() => handleTabPress('friends')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'friends' ? 'people' : 'people-outline'}
                size={26}
                color={activeTab === 'friends' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'friends' && (
                <Animated.View style={styles.activeIndicator} />
              )}
            </AnimatedTouchable>

            {/* Profile Tab */}
            <AnimatedTouchable
              style={[styles.tab, getAnimatedStyle(profileScale)]}
              onPress={() => handleTabPress('profile')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={26}
                color={activeTab === 'profile' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'profile' && (
                <Animated.View style={styles.activeIndicator} />
              )}
            </AnimatedTouchable>
          </View>
        </LinearGradient>
      </View>
    </GestureHandlerRootView>
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
