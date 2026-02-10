import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
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
import SearchModal from '../components/SearchModal';

const { width } = Dimensions.get('window');
const API_BASE_HOME = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/home';
const API_BASE_POSTS = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';
const HEADER_HEIGHT = 75;

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
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [userId, setUserId] = useState<string>('');
  
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastTap, setLastTap] = useState<number | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

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

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      toggleHeader();
    } else {
      setLastTap(now);
    }
  };

  const toggleHeader = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const toValue = headerVisible ? -HEADER_HEIGHT : 0;
    
    Animated.spring(headerAnim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    
    setHeaderVisible(!headerVisible);
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
      <Animated.View 
        style={[
          styles.headerContainer,
          { transform: [{ translateY: headerAnim }] }
        ]}
      >
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <View style={styles.headerContent}>
            <HarmoniaLogo size={26} showText={true} />
            
            <View style={styles.buttonsRow}>
              {/* NOUVEAU : Bouton recherche */}
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowSearchModal(true);
                }}
              >
                <Ionicons name="search-outline" size={20} color="#fff" />
              </TouchableOpacity>

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
                  <Ionicons name="add" size={18} color="#fff" />
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
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>5</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowSavedPostsModal(true);
                }}
              >
                <Ionicons name="arrow-down-circle-outline" size={20} color="#fff" />
              </TouchableOpacity>

              <View style={styles.balanceContainer}>
                <Ionicons name="wallet-outline" size={14} color="#FFD700" />
                <Text style={styles.balanceText}>
                  {userProfile?.solde_cfa?.toLocaleString() || '0'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {!headerVisible && (
        <View style={styles.doubleTapHint}>
          <Ionicons name="chevron-down-outline" size={16} color="#8A2BE2" />
          <Text style={styles.doubleTapText}>Double-tap pour afficher</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        onTouchEnd={handleDoubleTap}
      >
        <View style={styles.postsSection}>
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="newspaper-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>Chargement en Cours</Text>
              <Text style={styles.emptySubtext}>Veuillez Patienter</Text>
            </View>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </View>
      </ScrollView>

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

      <SearchModal
        visible={showSearchModal}
        userId={userId}
        onClose={() => setShowSearchModal(false)}
        onPostPress={(postId) => {
          setSelectedPostForComments(postId);
          setShowCommentsModal(true);
        }}
      />
    </View>
  );
}

// [Styles identiques - trop long pour répéter]
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 35, paddingBottom: 6, paddingHorizontal: 12 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  createButton: { borderRadius: 16, overflow: 'hidden' },
  createButtonGradient: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerButton: { position: 'relative' },
  notifBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF0080', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, gap: 3 },
  balanceText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  doubleTapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E6FF', paddingVertical: 6, gap: 4 },
  doubleTapText: { fontSize: 11, color: '#8A2BE2', fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: HEADER_HEIGHT },
  postsSection: { paddingVertical: 8, paddingBottom: 100 },
  postCard: { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, paddingVertical: 14 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  postAuthor: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  postAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  postAuthorName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  postTime: { fontSize: 12, color: '#999', marginTop: 1 },
  postContent: { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 14, marginBottom: 10 },
  statsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F5F5F5', borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  statsText: { fontSize: 12, color: '#666' },
  statsRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statsSeparator: { color: '#CCC' },
  actionsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, gap: 3 },
  actionButton: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  actionButtonActive: {},
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 5 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#666' },
  actionTextActive: { color: '#FFF' },
  saveButton: { padding: 8 },
  emptyPosts: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  emptySubtext: { fontSize: 12, color: '#CCC', marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: width * 0.85, maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInfo: { marginBottom: 12 },
  modalLabel: { fontSize: 12, color: '#999', marginBottom: 3 },
  modalValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  modalButton: { backgroundColor: '#8A2BE2', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  modalButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
