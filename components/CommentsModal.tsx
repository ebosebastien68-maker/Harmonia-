posts' React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import CommentLikersModal from './CommentLikersModal';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/comments';

interface Comment {
  id: string;
  author_id: string;
  author: {
    nom: string;
    prenom: string;
    avatar_url: string | null;
  };
  content: string;
  created_at: string;
  likes_count: number;
  user_liked: boolean;
  replies?: Comment[];
}

interface CommentsModalProps {
  visible: boolean;
  postId: string | null;
  userId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export default function CommentsModal({
  visible,
  postId,
  userId,
  onClose,
  onCommentAdded,
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [selectedCommentForLikers, setSelectedCommentForLikers] = useState<string | null>(null);

  useEffect(() => {
    if (visible && postId) {
      loadComments();
    }
  }, [visible, postId]);

  const loadComments = async () => {
    if (!postId) return;

    setLoading(true);
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-comments',
          post_id: postId,
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (data.success && data.comments) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !postId || submitting) return;

    setSubmitting(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'add-comment',
          post_id: postId,
          user_id: userId,
          content: newComment.trim(),
          parent_id: replyingTo,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewComment('');
        setReplyingTo(null);
        await loadComments();
        if (onCommentAdded) onCommentAdded();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, liked: boolean) => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: liked ? 'like-comment' : 'unlike-comment',
          comment_id: commentId,
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setComments(prev =>
          prev.map(comment =>
            comment.id === commentId
              ? { ...comment, likes_count: data.likes, user_liked: liked }
              : {
                  ...comment,
                  replies: comment.replies?.map(reply =>
                    reply.id === commentId
                      ? { ...reply, likes_count: data.likes, user_liked: liked }
                      : reply
                  ),
                }
          )
        );
      }
    } catch (error) {
      console.error('Error liking comment:', error);
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

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const [liked, setLiked] = useState(comment.user_liked);
    const [likesCount, setLikesCount] = useState(comment.likes_count);

    useEffect(() => {
      setLiked(comment.user_liked);
      setLikesCount(comment.likes_count);
    }, [comment.user_liked, comment.likes_count]);

    return (
      <View style={[styles.commentItem, isReply && styles.replyItem]}>
        <View style={styles.commentHeader}>
          {comment.author.avatar_url ? (
            <Image source={{ uri: comment.author.avatar_url }} style={styles.commentAvatar} />
          ) : (
            <View style={styles.commentAvatarPlaceholder}>
              <Text style={styles.commentAvatarText}>
                {getInitials(comment.author.nom, comment.author.prenom)}
              </Text>
            </View>
          )}
          <View style={styles.commentContent}>
            <View style={styles.commentBubble}>
              <Text style={styles.commentAuthor}>
                {comment.author.prenom} {comment.author.nom}
              </Text>
              <Text style={styles.commentText}>{comment.content}</Text>
            </View>
            
            <View style={styles.commentActions}>
              <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
              
              {/* Compteur de likes cliquable */}
              {likesCount > 0 && (
                <>
                  <Text style={styles.actionSeparator}>•</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setSelectedCommentForLikers(comment.id);
                      setShowLikersModal(true);
                    }}
                  >
                    <Text style={styles.likesCount}>
                      {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              
              <Text style={styles.actionSeparator}>•</Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  const newLiked = !liked;
                  setLiked(newLiked);
                  setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
                  handleLikeComment(comment.id, newLiked);
                }}
              >
                <Text style={[styles.actionButton, liked && styles.actionButtonActive]}>
                  {liked ? 'Aimé' : 'Aimer'}
                </Text>
              </TouchableOpacity>
              
              {!isReply && (
                <>
                  <Text style={styles.actionSeparator}>•</Text>
                  <TouchableOpacity onPress={() => setReplyingTo(comment.id)}>
                    <Text style={styles.actionButton}>Répondre</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {comment.replies && comment.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} isReply={true} />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commentaires</Text>
          <View style={styles.placeholder} />
        </LinearGradient>

        <ScrollView style={styles.commentsContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={80} color="#CCC" />
              <Text style={styles.emptyText}>Aucun commentaire</Text>
              <Text style={styles.emptySubtext}>Soyez le premier à commenter !</Text>
            </View>
          ) : (
            comments.map(comment => <CommentItem key={comment.id} comment={comment} />)
          )}
        </ScrollView>

        {replyingTo && (
          <View style={styles.replyingBanner}>
            <Text style={styles.replyingText}>
              Réponse à un commentaire
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={20} color="#8A2BE2" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ajouter un commentaire..."
            placeholderTextColor="#999"
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CommentLikersModal
        visible={showLikersModal}
        commentId={selectedCommentForLikers}
        onClose={() => {
          setShowLikersModal(false);
          setSelectedCommentForLikers(null);
        }}
      />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 55 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
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
  commentsContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
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
  commentItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyItem: {
    paddingLeft: 60,
  },
  commentHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
    gap: 6,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  likesCount: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '600',
  },
  actionSeparator: {
    fontSize: 12,
    color: '#CCC',
  },
  actionButton: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  actionButtonActive: {
    color: '#FF0080',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0E6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0D4FF',
  },
  replyingText: {
    fontSize: 13,
    color: '#8A2BE2',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
