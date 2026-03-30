// CommentsModal.tsx — v3 (fix backdrop mobile intercepting touches)
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CommentLikersModal from './CommentLikersModal';

const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/comments';

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
  onClose: () => void;
  onCommentAdded: () => void;
}

async function getAccessToken(): Promise<string> {
  const sessionStr = await AsyncStorage.getItem('harmonia_session');
  if (!sessionStr) throw new Error('Session introuvable');
  const session = JSON.parse(sessionStr);
  if (!session.access_token) throw new Error('access_token manquant');
  return session.access_token;
}

// ─── CommentItem ──────────────────────────────────────────────────────────────

const CommentItem = ({
  comment,
  isReply,
  onLike,
  onReply,
  onShowLikers,
}: {
  comment: Comment;
  isReply: boolean;
  onLike: (commentId: string, liked: boolean) => Promise<void>;
  onReply: (comment: Comment) => void;
  onShowLikers: (commentId: string) => void;
}) => {
  const [localLiked, setLocalLiked] = useState(comment.user_liked);
  const [localLikes, setLocalLikes] = useState(comment.likes);

  const handleLike = async () => {
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikes(prev => (newLiked ? prev + 1 : prev - 1));
    try {
      await onLike(comment.id, newLiked);
    } catch {
      setLocalLiked(!newLiked);
      setLocalLikes(prev => (newLiked ? prev - 1 : prev + 1));
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diffInSeconds = Math.floor(
      (new Date().getTime() - new Date(dateString).getTime()) / 1000
    );
    if (diffInSeconds < 60)    return "À l'instant";
    if (diffInSeconds < 3600)  return `il y a ${Math.floor(diffInSeconds / 60)}min`;
    if (diffInSeconds < 86400) return `il y a ${Math.floor(diffInSeconds / 3600)}h`;
    return `il y a ${Math.floor(diffInSeconds / 86400)}j`;
  };

  const getInitials = (nom: string, prenom: string) =>
    `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

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

            {localLikes > 0 && (
              <>
                <Text style={styles.actionSeparator}>•</Text>
                <TouchableOpacity
                  style={styles.likesCountButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onShowLikers(comment.id);
                  }}
                >
                  <Text style={styles.likesCount}>
                    {localLikes} {localLikes === 1 ? 'like' : 'likes'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.actionSeparator}>•</Text>

            <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
              <Ionicons
                name={localLiked ? 'heart' : 'heart-outline'}
                size={16}
                color={localLiked ? '#7B1FA2' : '#666'}
              />
              <Text style={[styles.likeText, localLiked && styles.likeTextActive]}>
                {localLiked ? 'Aimé' : 'Aimer'}
              </Text>
            </TouchableOpacity>

            {!isReply && (
              <>
                <Text style={styles.actionSeparator}>•</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onReply(comment);
                  }}
                >
                  <Text style={styles.replyButton}>Répondre</Text>
                </TouchableOpacity>
              </>
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
              onShowLikers={onShowLikers}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ─── CommentsModal ────────────────────────────────────────────────────────────

export default function CommentsModal({
  visible,
  postId,
  onClose,
  onCommentAdded,
}: CommentsModalProps) {
  const [comments,                 setComments]                 = useState<Comment[]>([]);
  const [loading,                  setLoading]                  = useState(false);
  const [commentText,              setCommentText]              = useState('');
  const [replyingTo,               setReplyingTo]               = useState<Comment | null>(null);
  const [submitting,               setSubmitting]               = useState(false);
  const [showLikersModal,          setShowLikersModal]          = useState(false);
  const [selectedCommentForLikers, setSelectedCommentForLikers] = useState<string | null>(null);

  useEffect(() => {
    if (visible && postId) loadComments();
  }, [visible, postId]);

  const loadComments = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const access_token = await getAccessToken();
      const response = await fetch(API_BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-comments', post_id: postId, access_token }),
      });
      const data = await response.json();
      if (data.success && data.comments) setComments(data.comments);
    } catch (error) {
      console.error('[CommentsModal] loadComments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !postId || submitting) return;
    setSubmitting(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const access_token = await getAccessToken();
      const response = await fetch(API_BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    replyingTo ? 'reply-to-comment' : 'add-comment',
          post_id:   postId,
          content:   commentText.trim(),
          parent_id: replyingTo?.id ?? null,
          access_token,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCommentText('');
        setReplyingTo(null);
        await loadComments();
        onCommentAdded();
      } else {
        if (Platform.OS === 'web') {
          alert(data.error ?? "Erreur lors de l'envoi");
        } else {
          Alert.alert('Erreur', data.error ?? "Erreur lors de l'envoi");
        }
      }
    } catch (error) {
      console.error('[CommentsModal] handleAddComment:', error);
      if (Platform.OS === 'web') {
        alert('Erreur réseau, veuillez réessayer');
      } else {
        Alert.alert('Erreur réseau', 'Veuillez réessayer');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, liked: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const access_token = await getAccessToken();
      const response = await fetch(API_BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:     liked ? 'like-comment' : 'unlike-comment',
          comment_id: commentId,
          access_token,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const updateLikes = (list: Comment[]): Comment[] =>
          list.map(c => {
            if (c.id === commentId) return { ...c, likes: data.likes, user_liked: liked };
            if (c.replies) return { ...c, replies: updateLikes(c.replies) };
            return c;
          });
        setComments(prev => updateLikes(prev));
      }
    } catch (error) {
      console.error('[CommentsModal] handleLikeComment:', error);
    }
  };

  const handleShowLikers = (commentId: string) => {
    setSelectedCommentForLikers(commentId);
    setShowLikersModal(true);
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        {/*
          FIX MOBILE — le KAV est à la racine du Modal (flex:1).
          Le backdrop est un TouchableOpacity flex:1 dans le flux,
          au-dessus du sheet → il ne chevauche plus le contenu
          et ne capte plus les touches destinées aux boutons.
        */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalRoot}>

            {/* Backdrop dans le flux — flex:1 remplit tout l'espace au-dessus du sheet */}
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={onClose}
            />

            {/* Sheet — positionné naturellement sous le backdrop, sans chevauchement */}
            <View style={styles.modalContent}>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Commentaires</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Liste */}
              <ScrollView
                style={styles.commentsList}
                contentContainerStyle={styles.commentsListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7B1FA2" />
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
                      onShowLikers={handleShowLikers}
                    />
                  ))
                )}
              </ScrollView>

              {/* Barre "Répondre à" */}
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
                  placeholder={
                    replyingTo
                      ? `Répondre à ${replyingTo.author.prenom}...`
                      : 'Ajouter un commentaire...'
                  }
                  placeholderTextColor="#999"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!commentText.trim() || submitting) && styles.sendButtonDisabled,
                  ]}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CommentLikersModal hors du Modal principal — évite les conflits de couches */}
      <CommentLikersModal
        visible={showLikersModal}
        commentId={selectedCommentForLikers}
        onClose={() => {
          setShowLikersModal(false);
          setSelectedCommentForLikers(null);
        }}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // flex:1 + backgroundColor → le fond semi-transparent couvre tout l'écran.
  // Pas de justifyContent ici — c'est le flex:1 du backdrop qui pousse le sheet en bas.
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    flexShrink: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
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
    flexShrink: 1,
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  commentsListContent: {
    paddingVertical: 8,
    flexGrow: 1,
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
    backgroundColor: '#7B1FA2',
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
    gap: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  actionSeparator: {
    fontSize: 12,
    color: '#CCC',
  },
  likesCountButton: {
    paddingVertical: 2,
  },
  likesCount: {
    fontSize: 12,
    color: '#7B1FA2',
    fontWeight: '600',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  likeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  likeTextActive: {
    color: '#7B1FA2',
  },
  replyButton: {
    fontSize: 12,
    color: '#7B1FA2',
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyingToBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E1BEE7',
  },
  replyingToText: {
    fontSize: 13,
    color: '#7B1FA2',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
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
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
});
