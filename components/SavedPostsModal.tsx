import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const API_BASE_SAVED = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/saved-posts';
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
  user_liked: boolean;
  user_shared: boolean;
  user_saved: boolean;
}

interface SavedPostsModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onCommentPress: (postId: string) => void;
}

export default function SavedPostsModal({
  visible,
  userId,
  onClose,
  onCommentPress,
}: SavedPostsModalProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      loadSavedPosts();
    }
  }, [visible, userId]);

  const loadSavedPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE_SAVED, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-saved-posts',
          user_id: userId,
        }),
      });

      const data = await response.json();
      if (data.success && data.posts) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Error loading saved posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (postId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Optimistic update
    setPosts(prev => prev.filter(p => p.id !== postId));

    try {
      await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'unsave-post',
          user_id: userId,
          post_id: postId,
        }),
      });
    } catch (error) {
      console.error('Error unsaving post:', error);
      // Reload on error
      loadSavedPosts();
    }
  };

  const handleLike = async (postId: string, liked: boolean) => {
    try {
      const response = await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: liked ? 'like-post' : 'unlike-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, reactions: { ...post.reactions, likes: data.likes }, user_liked: liked }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleShare = async (postId: string, shared: boolean) => {
    try {
      const response = await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: shared ? 'share-post' : 'unshare-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, reactions: { ...post.reactions, shares: data.shares }, user_shared: shared }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
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

  const SavedPostCard = ({ post }: { post: Post }) => {
    const [liked, setLiked] = useState(post.user_liked);
    const [shared, setShared] = useState(post.user_shared);
    const [likesCount, setLikesCount] = useState(post.reactions.likes);
    const [sharesCount, setSharesCount] = useState(post.reactions.shares);

    useEffect(() => {
      setLiked(post.user_liked);
      setShared(post.user_shared);
      setLikesCount(post.reactions.likes);
      setSharesCount(post.reactions.shares);
    }, [post]);

    return (
      <View style={styles.postCard}>
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
          <TouchableOpacity onPress={() => handleUnsave(post.id)}>
            <Ionicons name="bookmark" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>

        <Text style={styles.postContent}>{post.content}</Text>

        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </Text>
          <View style={styles.statsRight}>
            <Text style={styles.statsText}>{post.reactions.comments} commentaires</Text>
            <Text style={styles.statsSeparator}>•</Text>
            <Text style={styles.statsText}>{sharesCount} partages</Text>
          </View>
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.actionButton, liked && styles.actionButtonActive]}
            onPress={() => {
              const newLiked = !liked;
              setLiked(newLiked);
              setLikesCount(prev => (newLiked ? prev + 1 : prev - 1));
              handleLike(post.id, newLiked);
            }}
          >
            <LinearGradient
              colors={liked ? ['#FF0080', '#FF0080'] : ['transparent', 'transparent']}
              style={styles.actionGradient}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#FFF' : '#666'} />
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
              onCommentPress(post.id);
            }}
          >
            <View style={styles.actionGradient}>
              <Ionicons name="chatbubble-outline" size={20} color="#666" />
              <Text style={styles.actionText}>Commenter</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, shared && styles.actionButtonActive]}
            onPress={() => {
              const newShared = !shared;
              setShared(newShared);
              setSharesCount(prev => (newShared ? prev + 1 : prev - 1));
              handleShare(post.id, newShared);
            }}
          >
            <LinearGradient
              colors={shared ? ['#10B981', '#10B981'] : ['transparent', 'transparent']}
              style={styles.actionGradient}
            >
              <Ionicons name={shared ? 'repeat' : 'repeat-outline'} size={22} color={shared ? '#FFF' : '#666'} />
              <Text style={[styles.actionText, shared && styles.actionTextActive]}>
                {shared ? 'Partagé' : 'Partager'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Posts sauvegardés</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={80} color="#CCC" />
              <Text style={styles.emptyText}>Aucun post sauvegardé</Text>
              <Text style={styles.emptySubtext}>
                Les posts que vous enregistrez apparaîtront ici
              </Text>
            </View>
          ) : (
            posts.map(post => <SavedPostCard key={post.id} post={post} />)
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 55 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#8A2BE2',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 8,
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: '#FFF',
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
});
