import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Nos composants personnalisés
import HarmoniaLogo from '../components/HarmoniaLogo';
import CreatePostModal from '../components/CreatePostModal';
import PostCard from '../components/PostCard'; 

const { width } = Dimensions.get('window');
const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/home';

interface Story {
  id: string;
  user: {
    nom: string;
    prenom: string;
    avatar_url: string | null;
  };
  isActive: boolean;
}

interface Post {
  id: string;
  author: {
    nom: string;
    prenom: string;
    avatar_url: string | null;
  };
  content: string;
  created_at: string;
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  user_liked?: boolean;
  user_shared?: boolean;
  user_saved?: boolean;
}

interface UserProfile {
  solde_cfa: number;
  trophies_count: number;
}

export default function ActuScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string>(''); // Stocker l'ID de l'utilisateur actuel
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadFeedData();
  }, []);

  const loadFeedData = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);
      const currentId = parsed.user.id;
      setUserId(currentId);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-feed',
          user_id: currentId,
        }),
      });

      const data = await response.json();

      if (data.stories) setStories(data.stories);
      if (data.posts) setPosts(data.posts);
      if (data.profile) setUserProfile(data.profile);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await loadFeedData();
    setRefreshing(false);
  };

  const handleLongPress = (post: Post) => {
    setSelectedPost(post);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `il y a ${Math.floor(diffInSeconds / 60)}min`;
    if (diffInSeconds < 86400) return `il y a ${Math.floor(diffInSeconds / 3600)}h`;
    return `il y a ${Math.floor(diffInSeconds / 86400)}j`;
  };

  const getInitials = (nom: string, prenom: string) => {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <View style={styles.logoRow}>
          <HarmoniaLogo size={40} showText={true} />
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <LinearGradient
              colors={['#FFD700', '#FF0080']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>5</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.balanceContainer}>
            <Ionicons name="wallet-outline" size={18} color="#FFD700" />
            <Text style={styles.balanceText}>
              {userProfile?.solde_cfa?.toLocaleString() || '0'} CFA
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stories Section */}
        <View style={styles.storiesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesContent}>
            {stories.length === 0 ? (
              <View style={styles.emptyStories}><Text style={styles.emptyText}>Aucun ami actif</Text></View>
            ) : (
              stories.map((story) => (
                <TouchableOpacity key={story.id} style={styles.storyItem}>
                  <LinearGradient
                    colors={story.isActive ? ['#FF0080', '#FFD700'] : ['#E0E0E0', '#E0E0E0']}
                    style={styles.storyBorder}
                  >
                    <View style={styles.storyAvatar}>
                      {story.user.avatar_url ? (
                        <Image source={{ uri: story.user.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>{getInitials(story.user.nom, story.user.prenom)}</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                  <Text style={styles.storyName} numberOfLines={1}>{story.user.prenom}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* Posts Section - Utilisation de PostCard */}
        <View style={styles.postsSection}>
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="newspaper-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>Aucune publication</Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                userId={userId}
                onLike={async (postId, liked) => {
                  console.log(`Post ${postId} liked: ${liked}`);
                  // Ici tu ajouteras ton appel API pour le Like
                }}
                onShare={async (postId, shared) => {
                  console.log(`Post ${postId} shared`);
                }}
                onSave={async (postId, saved) => {
                  console.log(`Post ${postId} saved`);
                }}
                onComment={(postId) => {
                  router.push(`/comments/${postId}`);
                }}
                onLongPress={handleLongPress}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal Détails */}
      {selectedPost && (
        <Modal visible={!!selectedPost} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setSelectedPost(null)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📊 Détails</Text>
              <Text style={styles.modalValue}>Auteur : {selectedPost.author.prenom} {selectedPost.author.nom}</Text>
              <Text style={styles.modalValue}>Likes : {selectedPost.reactions.likes}</Text>
              <TouchableOpacity style={styles.modalButton} onPress={() => setSelectedPost(null)}>
                <Text style={styles.modalButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={loadFeedData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: 55, paddingBottom: 12, paddingHorizontal: 16 },
  logoRow: { alignItems: 'center', marginBottom: 12 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  createButton: { borderRadius: 20, overflow: 'hidden' },
  createButtonGradient: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerButton: { position: 'relative' },
  notifBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF0080', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, gap: 5 },
  balanceText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  storiesSection: { backgroundColor: '#fff', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  storiesContent: { paddingHorizontal: 15 },
  storyItem: { alignItems: 'center', marginHorizontal: 8, width: 70 },
  storyBorder: { padding: 3, borderRadius: 35 },
  storyAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  storyName: { fontSize: 11, color: '#666', marginTop: 5, textAlign: 'center' },
  emptyStories: { paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  postsSection: { paddingVertical: 10, paddingBottom: 100 },
  emptyPosts: { alignItems: 'center', paddingVertical: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: width * 0.85 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalValue: { fontSize: 14, color: '#333', marginBottom: 10 },
  modalButton: { backgroundColor: '#8A2BE2', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  modalButtonText: { color: '#fff', fontWeight: 'bold' },
});
