import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useRouter }      from 'expo-router';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar }      from 'expo-status-bar';
import * as Haptics       from 'expo-haptics';

import ActuScreen     from './actu';
import GamesScreen    from './games-screen';
import MessagesScreen from './messages';
import FriendsScreen  from './friends';
import ProfileScreen  from './profile';

type TabName = 'actu' | 'games' | 'messages' | 'friends' | 'profile';

// Tous les onglets — montés dès le départ, affichés/cachés selon l'onglet actif
const ALL_TABS: TabName[] = ['actu', 'games', 'messages', 'friends', 'profile'];

export default function HomePage() {
  const router = useRouter();

  const [activeTab,  setActiveTab]  = useState<TabName>('actu');
  const [loading,    setLoading]    = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Meme pattern que profile.tsx — tokens en memoire via useRef
  const accessTokenRef  = useRef<string>('');
  const refreshTokenRef = useRef<string>('');
  const expiresAtRef    = useRef<number>(0);

  // Garde une trace des onglets déjà montés (pour ne monter que si visité au moins une fois)
  // actu est monté immédiatement, les autres dès le premier affichage
  const mountedTabs = useRef<Set<TabName>>(new Set<TabName>(['actu']));

  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initSession();
  }, []);

  // Pré-monter tous les onglets en arrière-plan après le chargement initial
  useEffect(() => {
    if (!loading) {
      // Légère temporisation pour laisser actu s'afficher en premier
      const timer = setTimeout(() => {
        ALL_TABS.forEach(tab => mountedTabs.current.add(tab));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // =====================================================
  // INIT SESSION — identique a profile.tsx
  // =====================================================

  const initSession = async () => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');

      if (!raw) {
        router.replace('/login');
        return;
      }

      const session = JSON.parse(raw);

      if (!session?.access_token) {
        router.replace('/login');
        return;
      }

      accessTokenRef.current  = session.access_token  || '';
      refreshTokenRef.current = session.refresh_token || '';
      expiresAtRef.current    = session.expires_at    || 0;

    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // NAVIGATION TABS
  // =====================================================

  const handleTabPress = (tab: TabName) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Marquer l'onglet comme monté dès qu'on le visite
    mountedTabs.current.add(tab);
    setActiveTab(tab);
    if (isChatOpen) {
      setIsChatOpen(false);
      showTabBar();
    }
  };

  const hideTabBar = () => {
    Animated.timing(tabBarTranslateY, {
      toValue: 100, duration: 300, useNativeDriver: true,
    }).start();
  };

  const showTabBar = () => {
    Animated.timing(tabBarTranslateY, {
      toValue: 0, duration: 300, useNativeDriver: true,
    }).start();
  };

  const handleChatModeChange = (isInChatMode: boolean) => {
    setIsChatOpen(isInChatMode);
    if (isInChatMode) { hideTabBar(); } else { showTabBar(); }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="sync" size={40} color="#8A2BE2" />
      </View>
    );
  }

  // =====================================================
  // RENDU PRINCIPAL
  // Tous les écrans sont montés simultanément.
  // Seul l'actif est visible (display: flex), les autres sont cachés (display: none).
  // Cela préserve leur état et évite les rechargements lors des changements d'onglet.
  // =====================================================

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>

        {/* actu — toujours monté, visible par défaut */}
        <View style={[styles.screen, activeTab === 'actu' ? styles.screenVisible : styles.screenHidden]}>
          <ActuScreen />
        </View>

        {/* games */}
        {mountedTabs.current.has('games') && (
          <View style={[styles.screen, activeTab === 'games' ? styles.screenVisible : styles.screenHidden]}>
            <GamesScreen />
          </View>
        )}

        {/* messages */}
        {mountedTabs.current.has('messages') && (
          <View style={[styles.screen, activeTab === 'messages' ? styles.screenVisible : styles.screenHidden]}>
            <MessagesScreen onChatModeChange={handleChatModeChange} />
          </View>
        )}

        {/* friends */}
        {mountedTabs.current.has('friends') && (
          <View style={[styles.screen, activeTab === 'friends' ? styles.screenVisible : styles.screenHidden]}>
            <FriendsScreen />
          </View>
        )}

        {/* profile */}
        {mountedTabs.current.has('profile') && (
          <View style={[styles.screen, activeTab === 'profile' ? styles.screenVisible : styles.screenHidden]}>
            <ProfileScreen />
          </View>
        )}

      </View>

      <Animated.View
        style={[
          styles.bottomTabsContainer,
          { transform: [{ translateY: tabBarTranslateY }] }
        ]}
      >
        <LinearGradient
          colors={['rgba(138, 43, 226, 0.98)', 'rgba(75, 0, 130, 0.98)']}
          style={styles.tabsGradient}
        >
          <View style={styles.tabs}>

            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress('actu')} activeOpacity={0.7}>
              <Ionicons
                name={activeTab === 'actu' ? 'home' : 'home-outline'}
                size={26}
                color={activeTab === 'actu' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'actu' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress('games')} activeOpacity={0.7}>
              <Ionicons
                name={activeTab === 'games' ? 'game-controller' : 'game-controller-outline'}
                size={26}
                color={activeTab === 'games' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'games' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress('messages')} activeOpacity={0.7}>
              <Ionicons
                name={activeTab === 'messages' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={26}
                color={activeTab === 'messages' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'messages' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress('friends')} activeOpacity={0.7}>
              <Ionicons
                name={activeTab === 'friends' ? 'people' : 'people-outline'}
                size={26}
                color={activeTab === 'friends' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'friends' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress('profile')} activeOpacity={0.7}>
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={26}
                color={activeTab === 'profile' ? '#FFD700' : '#E0D0FF'}
              />
              {activeTab === 'profile' && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  content:          { flex: 1 },

  // Chaque écran occupe tout l'espace — visible ou caché selon l'onglet actif
  screen:        { ...StyleSheet.absoluteFillObject },
  screenVisible: { display: 'flex' },
  screenHidden:  { display: 'none' },

  bottomTabsContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 12 },
      web:     { boxShadow: '0 -4px 8px rgba(0, 0, 0, 0.15)' },
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
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', paddingVertical: 8,
    paddingHorizontal: 12, minWidth: 60,
  },
  activeIndicator: {
    position: 'absolute', bottom: -4,
    width: 35, height: 4,
    backgroundColor: '#FFD700', borderRadius: 2,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4, elevation: 4,
  },
});
