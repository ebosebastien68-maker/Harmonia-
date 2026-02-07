import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface PostCardProps {
  post: {
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
  };
  userId: string;
  onLike: (postId: string, liked: boolean) => Promise<void>;
  onShare: (postId: string, shared: boolean) => Promise<void>;
  onSave: (postId: string, saved: boolean) => Promise<void>;
  onComment: (postId: string) => void;
  onLongPress?: (post: any) => void;
}

export default function PostCard({
  post,
  userId,
  onLike,
  onShare,
  onSave,
  onComment,
  onLongPress,
}: PostCardProps) {
  const [liked, setLiked] = useState(post.user_liked || false);
  const [shared, setShared] = useState(post.user_shared || false);
  const [saved, setSaved] = useState(post.user_saved || false);
  const [likesCount, setLikesCount] = useState(post.reactions.likes);
  const [sharesCount, setSharesCount] = useState(post.reactions.shares);
  const [isAnimating, setIsAnimating] = useState(false);

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

  const handleLike = async () => {
    if (isAnimating) return;
    setIsAnimating(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((prev) => (newLiked ? prev + 1 : prev - 1));

    try {
      await onLike(post.id, newLiked);
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount((prev) => (newLiked ? prev - 1 : prev + 1));
    } finally {
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newShared = !shared;
    setShared(newShared);
    setSharesCount((prev) => (newShared ? prev + 1 : prev - 1));

    try {
      await onShare(post.id, newShared);
    } catch (error) {
      setShared(!newShared);
      setSharesCount((prev) => (newShared ? prev - 1 : prev + 1));
    }
  };

  const handleSave = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newSaved = !saved;
    setSaved(newSaved);

    try {
      await onSave(post.id, newSaved);
    } catch (error) {
      setSaved(!newSaved);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.98}
      onLongPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onLongPress?.(post);
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.authorInfo}>
          {post.author.avatar_url ? (
            <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {getInitials(post.author.nom, post.author.prenom)}
              </Text>
            </View>
          )}
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>
              {post.author.prenom} {post.author.nom}
            </Text>
            <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Stats Bar */}
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

      {/* Actions Bar */}
      <View style={styles.actionsBar}>
        {/* Like */}
        <TouchableOpacity
          style={[styles.actionButton, liked && styles.actionButtonActive]}
          onPress={handleLike}
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

        {/* Comment */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onComment(post.id);
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>Commenter</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.actionButton, shared && styles.actionButtonActive]}
          onPress={handleShare}
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

        {/* Save */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={saved ? '#FFD700' : '#666'}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
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
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  authorDetails: {
    marginLeft: 12,
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  timestamp: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  content: {
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
  actionButtonActive: {
    // Style pour les boutons actifs
  },
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
});
