import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/comments';

interface Comment {
  id: string;
  author: {
    nom: string;
    prenom: string;
    avatar_url: string | null;
  };
  content: string;
  created_at: string;
  likes: number;
  user_liked: boolean;
  replies?: Comment[];
  parent_id: string | null;
}

interface CommentsModalProps {
  visible: boolean;
  postId: string | null;
  userId: string;
  onClose: () => void;
  onCommentAdded: () => void;
}

// ✅ COMPOSANT COMMENTAIRE (au lieu d'une fonction)
const CommentItem = ({ 
  comment, 
  isReply, 
  onLike, 
  onReply 
}: { 
  comment: Comment; 
  isReply: boolean;
  onLike: (commentId: string, liked: boolean) => Promise<void>;
  onReply: (comment: Comment) => void;
}) => {
  const [localLiked, setLocalLiked] = useState(comment.user_liked);
  const [localLikes, setLocalLikes] = useState(comment.likes);

  const handleLike = async () => {
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikes(prev => newLiked ? prev + 1 : prev - 1);

    try {
      await onLike(comment.id, newLiked);
    } catch (error) {
      setLocalLiked(!newLiked);
      setLocalLikes(prev => newLiked ? prev - 1 : prev + 1);
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
            <TouchableOpacity
              style={styles.likeButton}
              onPress={handleLike}
            >
              <Text style={[styles.likeText, localLiked && styles.likeTextActive]}>
                👍 {localLikes > 0 && localLikes}
              </Text>
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onReply(comment);
                }}
              >
                <Text style={styles.replyButton}>Répondre</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply={true}
              onLike={onLike}
              onReply={onReply}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default function CommentsModal({
  visible,
  postId,
  userId,
  onClose,
  onCommentAdded,
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          'Origin': 'https://harmonia-world.vercel.app'
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
    if (!commentText.trim() || !postId || submitting) return;

    setSubmitting(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: replyingTo ? 'reply-to-comment' : 'add-comment',
          post_id: postId,
          user_id: userId,
          content: commentText.trim(),
          parent_id: replyingTo?.id || null,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCommentText('');
        setReplyingTo(null);
        await loadComments();
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, liked: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: liked ? 'like-comment' : 'unlike-comment',
          comment_id: commentId,
          user_id: userId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Mettre à jour localement
        const updateCommentLikes = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return { ...comment, likes: data.likes, user_liked: liked };
            }
            if (comment.replies) {
              return { ...comment, replies: updateCommentLikes(comment.replies) };
            }
            return comment;
          });
        };
        setComments(updateCommentLikes(comments));
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Commentaires</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8A2BE2" />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={60} color="#CCC" />
                <Text style={styles.emptyText}>Aucun commentaire</Text>
                <Text style={styles.emptySubtext}>Soyez le premier à commenter !</Text>
              </View>
            ) : (
              comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isReply={false}
                  onLike={handleLikeComment}
                  onReply={setReplyingTo}
                />
              ))
            )}
          </ScrollView>

          {/* Reply Indicator */}
          {replyingTo && (
            <View style={styles.replyingToBar}>
              <Text style={styles.replyingToText}>
                Répondre à {replyingTo.author.prenom}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={replyingTo ? `Répondre à ${replyingTo.author.prenom}...` : "Ajouter un commentaire..."}
              placeholderTextColor="#999"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4,
  },
  commentItem: {
    marginVertical: 8,
  },
  replyItem: {
    marginLeft: 40,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    gap: 12,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  likeButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  likeText: {
    fontSize: 12,
    color: '#666',
  },
  likeTextActive: {
    color: '#FF0080',
    fontWeight: 'bold',
  },
  replyButton: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyingToBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  replyingToText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 8,
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
    backgroundColor: '#CCC',
  },
});
