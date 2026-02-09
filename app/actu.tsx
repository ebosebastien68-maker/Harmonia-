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
import CommentsModal from '../components/CommentsModal';
import LikersModal from '../components/LikersModal';
import EditPostModal from '../components/EditPostModal';
import SavedPostsModal from '../components/SavedPostsModal';

const { width } = Dimensions.get('window');
const API_BASE_HOME = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/home';
const API_BASE_POSTS = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';

interface Post {
  id: string;
  author_id: string;
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [selectedPostForLikers, setSelectedPostForLikers] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPostForEdit, setSelectedPostForEdit] = useState<{id: string, content: string} | null>(null);
  const [showSavedPostsModal, setShowSavedPostsModal] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    loadUserSession();
  }, []);

  useEffect(() => {
    if (userId) {
      loadFeedData();
    }
  }, [userId]);

  const loadUserSession = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadFeedData = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      const response = await fetch(API_BASE_HOME, {
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

  const handleLike = async (postId: string, liked: boolean) => {
    try {
      const response = await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: liked ? 'like-post' : 'unlike-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, reactions: { ...post.reactions, likes: data.likes }, user_liked: liked }
            : post
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  };

  const handleShare = async (postId: string, shared: boolean) => {
    try {
      const response = await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: shared ? 'share-post' : 'unshare-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, reactions: { ...post.reactions, shares: data.shares }, user_shared: shared }
            : post
        ));
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      throw error;
    }
  };

  const handleSave = async (postId: string, saved: boolean) => {
    try {
      const response = await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: saved ? 'save-post' : 'unsave-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, user_saved: saved }
            : post
        ));
      }
    } catch (error) {
      console.error('Error saving post:', error);
      throw error;
    }
  };

  const handleComment = (postId: string) => {
    setSelectedPostForComments(postId);
    setShowCommentsModal(true);
  };

  const handleLongPress = (post: Post) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedPost(post);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return "À l'instant";
    if (diffInSeconds < 3600) return `il y a ${Math.floor(diffInSeconds / 60)}min`;
    if (diffInSeconds < 86400) return `il y a ${Math.floor(diffInSeconds / 3600)}h`;
    return `il y a ${Math.floor(diffInSeconds / 86400)}j`;
  };

  const getInitials = (nom: string, prenom: string) => {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  };

  const PostCard = ({ post }: { post: Post }) => {
    const [liked, setLiked] = useState(post.user_liked || false);
    const [shared, setShared] = useState(post.user_shared || false);
    const [saved, setSaved] = useState(post.user_saved || false);
    const [likesCount, setLikesCount] = useState(post.reactions.likes);
    const [sharesCount, setSharesCount] = useState(post.reactions.shares);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
      setLiked(post.user_liked || false);
      setShared(post.user_shared || false);
      setSaved(post.user_saved || false);
      setLikesCount(post.reactions.likes);
      setSharesCount(post.reactions.shares);
    }, [post.id, post.user_liked, post.user_shared, post.user_saved, post.reactions]);

    const isOwnPost = post.author_id === userId;

    const onLike = async () => {
      if (isAnimating) return;
      setIsAnimating(true);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const newLiked = !liked;
      setLiked(newLiked);
      setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

      try {
        await handleLike(post.id, newLiked);
      } catch (error) {
        setLiked(!newLiked);
        setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
      } finally {
        setTimeout(() => setIsAnimating(false), 300);
      }
    };

    const onShare = async () => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newShared = !shared;
      setShared(newShared);
      setSharesCount(prev => newShared ? prev + 1 : prev - 1);

      try {
        await handleShare(post.id, newShared);
      } catch (error) {
        setShared(!newShared);
        setSharesCount(prev => newShared ? prev - 1 : prev + 1);
      }
    };

    const onSave = async () => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newSaved = !saved;
      setSaved(newSaved);

      try {
        await handleSave(post.id, newSaved);
      } catch (error) {
        setSaved(!newSaved);
      }
    };

    return (
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.98}
        onLongPress={() => handleLongPress(post)}
      >
        <View style={styles.postHeader}>
          <View style={styles.postAuthor}>
            {post.author.avatar_url ? (
              <Image source={{ uri: post.author.avatar_url }} style={styles.postAvatar} />
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
              <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
            </View>
          </View>
          {isOwnPost && (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setSelectedPostForEdit({ id: post.id, content: post.content });
                setShowEditModal(true);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.postContent}>{post.content}</Text>

        <View style={styles.statsBar}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              if (likesCount > 0) {
                setSelectedPostForLikers(post.id);
                setShowLikersModal(true);
              }
            }}
          >
            <Text style={styles.statsText}>
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
          <View style={styles.statsRight}>
            <Text style={styles.statsText}>{post.reactions.comments} commentaires</Text>
            <Text style={styles.statsSeparator}>•</Text>
            <Text style={styles.statsText}>{sharesCount} partages</Text>
          </View>
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.actionButton, liked && styles.actionButtonActive]}
            onPress={onLike}
            disabled={isAnimating}
          >
            <LinearGradient
              colors={liked ? ['#FF0080', '#FF0080'] : ['transparent', 'transparent']}
              style={styles.actionGradient}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? '#FFF' : '#666'}
              />
              <Text style={[styles.actionText, liked && styles.actionTextActive]}>
                {liked ? 'Aimé' : 'Aimer'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              handleComment(post.id);
            }}
          >
            <View style={styles.actionGradient}>
              <Ionicons name="chatbubble-outline" size={20} color="#666" />
              <Text style={styles.actionText}>Commenter</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, shared && styles.actionButtonActive]}
            onPress={onShare}
          >
            <LinearGradient
              colors={shared ? ['#10B981', '#10B981'] : ['transparent', 'transparent']}
              style={styles.actionGradient}
            >
              <Ionicons
                name={shared ? 'repeat' : 'repeat-outline'}
                size={22}
                color={shared ? '#FFF' : '#666'}
              />
              <Text style={[styles.actionText, shared && styles.actionTextActive]}>
                {shared ? 'Partagé' : 'Partager'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={saved ? '#FFD700' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        {/* Logo en haut */}
        <View style={styles.logoContainer}>
          <HarmoniaLogo size={40} showText={true} />
        </View>

        {/* Boutons */}
        <View style={styles.buttonsRow}>
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

          {/* NOUVEAU : Bouton Posts sauvegardés */}
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowSavedPostsModal(true);
            }}
          >
            <Ionicons name="arrow-down-circle-outline" size={24} color="#fff" />
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
        {/* Section Posts (Stories supprimée) */}
        <View style={styles.postsSection}>
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="newspaper-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>Aucune publication</Text>
              <Text style={styles.emptySubtext}>Créez votre premier post !</Text>
            </View>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </View>
      </ScrollView>

      {/* Modal détails post (long press) */}
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

      {/* Modals */}
      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={async () => {
          await loadFeedData();
        }}
      />

      <CommentsModal
        visible={showCommentsModal}
        postId={selectedPostForComments}
        userId={userId}
        onClose={() => {
          setShowCommentsModal(false);
          setSelectedPostForComments(null);
        }}
        onCommentAdded={() => {
          loadFeedData();
        }}
      />

      <LikersModal
        visible={showLikersModal}
        postId={selectedPostForLikers}
        onClose={() => {
          setShowLikersModal(false);
          setSelectedPostForLikers(null);
        }}
      />

      <EditPostModal
        visible={showEditModal}
        postId={selectedPostForEdit?.id || null}
        userId={userId}
        initialContent={selectedPostForEdit?.content || ''}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPostForEdit(null);
        }}
        onPostUpdated={async () => {
          await loadFeedData();
        }}
      />

      <SavedPostsModal
        visible={showSavedPostsModal}
        userId={userId}
        onClose={() => setShowSavedPostsModal(false)}
        onCommentPress={(postId) => {
          setShowSavedPostsModal(false);
          setSelectedPostForComments(postId);
          setShowCommentsModal(true);
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
  logoContainer: {
    marginBottom: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  postsSection: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 16,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  postTime: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  statsText: {
    fontSize: 13,
    color: '#666',
  },
  statsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsSeparator: {
    color: '#CCC',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionButtonActive: {},
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  actionTextActive: {
    color: '#FFF',
  },
  saveButton: {
    padding: 10,
  },
  emptyPosts: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
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
