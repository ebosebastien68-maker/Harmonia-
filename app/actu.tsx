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
import HarmoniaLogo from '../components/HarmoniaLogo';
import CreatePostModal from '../components/CreatePostModal';

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

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'get-feed',
          user_id: parsed.user.id,
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
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedPost(post);
  };

  const handleLike = async (postId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // TODO: Implémenter like
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
      {/* Header Professionnel avec Logo */}
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.header}
      >
        {/* Logo plus haut (centré) */}
        <View style={styles.logoRow}>
          <HarmoniaLogo size={40} showText={true} />
        </View>

        {/* Boutons en dessous */}
        <View style={styles.buttonsRow}>
          {/* Bouton Créer Publication */}
          <TouchableOpacity 
              style={styles.createButton}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                setShowCreateModal(true);
              }}
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

            {/* Bouton Notifications */}
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.push('/notifications');
              }}
            >
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>5</Text>
              </View>
            </TouchableOpacity>

            {/* Solde */}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stories Section */}
        <View style={styles.storiesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.storiesScroll}
            contentContainerStyle={styles.storiesContent}
          >
            {stories.length === 0 ? (
              <View style={styles.emptyStories}>
                <Text style={styles.emptyText}>Aucun ami actif</Text>
              </View>
            ) : (
              stories.map((story) => (
                <TouchableOpacity 
                  key={story.id}
                  style={styles.storyItem}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <LinearGradient
                    colors={story.isActive ? ['#FF0080', '#FFD700'] : ['#E0E0E0', '#E0E0E0']}
                    style={styles.storyBorder}
                  >
                    <View style={styles.storyAvatar}>
                      {story.user.avatar_url ? (
                        <Image
                          source={{ uri: story.user.avatar_url }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {getInitials(story.user.nom, story.user.prenom)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                  <Text style={styles.storyName} numberOfLines={1}>
                    {story.user.prenom}
                  </Text>
                  {story.isActive && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="newspaper-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>Aucune publication</Text>
              <Text style={styles.emptySubtext}>Ajoutez des amis pour voir leurs publications !</Text>
            </View>
          ) : (
            posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                activeOpacity={0.95}
                onLongPress={() => handleLongPress(post)}
              >
                {/* Post Header */}
                <View style={styles.postHeader}>
                  <View style={styles.postAuthor}>
                    {post.author.avatar_url ? (
                      <Image
                        source={{ uri: post.author.avatar_url }}
                        style={styles.postAvatar}
                      />
                    ) : (
                      <View style={styles.postAvatarPlaceholder}>
                        <Text style={styles.postAvatarText}>
                          {getInitials(post.author.nom, post.author.prenom)}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.postAuthorName}>
                        {post.author.prenom} {post.author.nom}
                      </Text>
                      <Text style={styles.postTime}>
                        {formatTimeAgo(post.created_at)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Post Content */}
                <Text style={styles.postContent}>{post.content}</Text>

                {/* Post Actions */}
                <View style={styles.postActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleLike(post.id)}
                  >
                    <Ionicons name="heart-outline" size={22} color="#FF0080" />
                    <Text style={styles.actionText}>{post.reactions.likes}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={20} color="#8A2BE2" />
                    <Text style={styles.actionText}>{post.reactions.comments}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="repeat-outline" size={22} color="#10B981" />
                    <Text style={styles.actionText}>{post.reactions.shares}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-outline" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal Info Appui Long */}
      {selectedPost && (
        <Modal
          visible={!!selectedPost}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPost(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedPost(null)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📊 Détails</Text>
              <View style={styles.modalInfo}>
                <Text style={styles.modalLabel}>Auteur :</Text>
                <Text style={styles.modalValue}>
                  {selectedPost.author.prenom} {selectedPost.author.nom}
                </Text>
              </View>
              <View style={styles.modalInfo}>
                <Text style={styles.modalLabel}>Publié :</Text>
                <Text style={styles.modalValue}>{formatTimeAgo(selectedPost.created_at)}</Text>
              </View>
              <View style={styles.modalInfo}>
                <Text style={styles.modalLabel}>Réactions :</Text>
                <Text style={styles.modalValue}>
                  ❤️ {selectedPost.reactions.likes} · 💬 {selectedPost.reactions.comments} · 🔄 {selectedPost.reactions.shares}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setSelectedPost(null)}
              >
                <Text style={styles.modalButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Modal Création de Publication */}
      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={async () => {
          await loadFeedData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 55,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createButton: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)',
      },
    }),
  },
  createButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF0080',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    gap: 5,
  },
  balanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  storiesSection: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  storiesScroll: {
    paddingHorizontal: 10,
  },
  storiesContent: {
    paddingHorizontal: 5,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  storyBorder: {
    padding: 3,
    borderRadius: 35,
  },
  storyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  storyName: {
    fontSize: 11,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 3,
  },
  emptyStories: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  postsSection: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  postTime: {
    fontSize: 12,
    color: '#999',
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  emptyPosts: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#CCC',
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: width * 0.85,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInfo: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  modalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#8A2BE2',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
