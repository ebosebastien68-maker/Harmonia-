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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// ─── Tous les appels passent par le backend Render (plus aucun Edge) ──────────
const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const HOME_URL    = `${BACKEND_URL}/home`;

const { width, height } = Dimensions.get('window');
const NATIVE = Platform.OS !== 'web';

// ─── Interface Post identique au retour de enrichPosts ────────────────────────
interface Post {
  item_type:   'post';
  id:          string;
  author_id:   string;
  author:      { nom: string; prenom: string; avatar_url: string | null };
  content:     string;
  visibility:  string;
  created_at:  string;
  is_shared?:  boolean;
  imagepots?:  string | null;
  vidposts?:   string | null;
  reactions:   { likes: number; comments: number; shares: number };
  user_liked:  boolean;
  user_shared: boolean;
  user_saved:  boolean;
}

interface SavedPostsModalProps {
  visible:        boolean;
  userId:         string;
  onClose:        () => void;
  onCommentPress: (postId: string) => void;
}

// ─── Helpers (mêmes que actu.tsx) ─────────────────────────────────────────────
const formatTimeAgo = (dateString: string) => {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
};

const getInitials = (nom: string, prenom: string) =>
  `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

// ─── MediaViewer fullscreen (même logique que actu.tsx) ──────────────────────
interface MediaViewerProps {
  visible: boolean;
  url:     string | null;
  type:    'image' | 'video';
  onClose: () => void;
}

function MediaViewer({ visible, url, type, onClose }: MediaViewerProps) {
  if (!url) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={mvStyles.overlay}>
        <TouchableOpacity style={mvStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        {type === 'image' ? (
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={mvStyles.imageWrapper}>
            <Image source={{ uri: url }} style={mvStyles.image} resizeMode="contain" />
          </TouchableOpacity>
        ) : Platform.OS === 'web' ? (
          // @ts-ignore
          <video src={url} controls autoPlay style={{ width: '100%', maxHeight: '90%', objectFit: 'contain', backgroundColor: '#000' }} />
        ) : (
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={mvStyles.videoNative}>
            <Ionicons name="play-circle" size={72} color="rgba(255,255,255,0.9)" />
            <Text style={mvStyles.videoHint}>Appuyez pour fermer</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const mvStyles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center', alignItems: 'center' },
  closeBtn:     { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  imageWrapper: { width, height: height * 0.85, justifyContent: 'center', alignItems: 'center' },
  image:        { width, height: height * 0.85 },
  videoNative:  { justifyContent: 'center', alignItems: 'center', gap: 16 },
  videoHint:    { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
});

// ─── Carte de post sauvegardé — même logique que PostCard dans actu.tsx ───────
function SavedPostCard({
  post,
  userId,
  onUnsave,
  onLike,
  onShare,
  onCommentPress,
}: {
  post:           Post;
  userId:         string;
  onUnsave:       (postId: string) => void;
  onLike:         (postId: string, liked: boolean) => Promise<void>;
  onShare:        (postId: string, shared: boolean) => Promise<void>;
  onCommentPress: (postId: string) => void;
}) {
  const [liked,       setLiked]       = useState(post.user_liked);
  const [shared,      setShared]      = useState(post.user_shared);
  const [likesCount,  setLikesCount]  = useState(post.reactions.likes);
  const [sharesCount, setSharesCount] = useState(post.reactions.shares);
  const [isAnim,      setIsAnim]      = useState(false);
  const [viewerUrl,   setViewerUrl]   = useState<string | null>(null);
  const [viewerType,  setViewerType]  = useState<'image' | 'video'>('image');

  useEffect(() => {
    setLiked(post.user_liked);
    setShared(post.user_shared);
    setLikesCount(post.reactions.likes);
    setSharesCount(post.reactions.shares);
  }, [post.id, post.user_liked, post.user_shared, post.reactions]);

  const handleLike = async () => {
    if (isAnim) return;
    setIsAnim(true);
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !liked;
    setLiked(next);
    setLikesCount(p => next ? p + 1 : p - 1);
    try   { await onLike(post.id, next); }
    catch { setLiked(!next); setLikesCount(p => next ? p - 1 : p + 1); }
    finally { setTimeout(() => setIsAnim(false), 300); }
  };

  const handleShare = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !shared;
    setShared(next);
    setSharesCount(p => next ? p + 1 : p - 1);
    try   { await onShare(post.id, next); }
    catch { setShared(!next); setSharesCount(p => next ? p - 1 : p + 1); }
  };

  return (
    <>
      <MediaViewer
        visible={!!viewerUrl}
        url={viewerUrl}
        type={viewerType}
        onClose={() => setViewerUrl(null)}
      />

      <View style={styles.postCard}>
        {/* ── En-tête auteur ──────────────────────────────────────── */}
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
          {/* Bouton désarchiver */}
          <TouchableOpacity onPress={() => onUnsave(post.id)}>
            <Ionicons name="bookmark" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* ── Contenu texte ────────────────────────────────────────── */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* ── Image (même logique que PostCard dans actu.tsx) ─────── */}
        {post.imagepots && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => { setViewerType('image'); setViewerUrl(post.imagepots!); }}
          >
            <Image source={{ uri: post.imagepots }} style={styles.postImage} resizeMode="cover" />
            <View style={styles.mediaExpandHint}>
              <Ionicons name="expand-outline" size={16} color="rgba(255,255,255,0.85)" />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Vidéo (même logique que PostCard dans actu.tsx) ──────── */}
        {post.vidposts && (
          <TouchableOpacity
            style={styles.videoThumb}
            activeOpacity={0.92}
            onPress={() => { setViewerType('video'); setViewerUrl(post.vidposts!); }}
          >
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
            <Text style={styles.videoThumbLabel}>Appuyer pour lire</Text>
          </TouchableOpacity>
        )}

        {/* ── Statistiques ─────────────────────────────────────────── */}
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

        {/* ── Actions (même style que PostCard dans actu.tsx) ─────── */}
        <View style={styles.actionsBar}>
          {/* Aimer */}
          <TouchableOpacity
            style={[styles.actionButton, liked && styles.actionButtonActive]}
            onPress={handleLike}
            disabled={isAnim}
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

          {/* Commenter */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onCommentPress(post.id);
            }}
          >
            <View style={styles.actionGradient}>
              <Ionicons name="chatbubble-outline" size={20} color="#666" />
              <Text style={styles.actionText}>Commenter</Text>
            </View>
          </TouchableOpacity>

          {/* Partager (uniquement si public, même règle que actu.tsx) */}
          {post.visibility === 'public' && (
            <TouchableOpacity
              style={[styles.actionButton, shared && styles.actionButtonActive]}
              onPress={handleShare}
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
          )}
        </View>
      </View>
    </>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function SavedPostsModal({
  visible,
  userId,
  onClose,
  onCommentPress,
}: SavedPostsModalProps) {
  const [posts,   setPosts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId) loadSavedPosts();
  }, [visible, userId]);

  // ─── Charger les posts sauvegardés via le backend Render ─────────────────
  const loadSavedPosts = async () => {
    setLoading(true);
    try {
      const res  = await fetch(HOME_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:  'get-saved-posts',
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (data.success && data.posts) setPosts(data.posts);
    } catch (err) {
      console.error('[SavedPostsModal] loadSavedPosts:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Désarchiver (optimiste) ──────────────────────────────────────────────
  const handleUnsave = async (postId: string) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts(prev => prev.filter(p => p.id !== postId));   // optimiste
    try {
      await fetch(HOME_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:  'unsave-post',
          user_id: userId,
          post_id: postId,
        }),
      });
    } catch (err) {
      console.error('[SavedPostsModal] handleUnsave:', err);
      loadSavedPosts();   // rollback si erreur
    }
  };

  // ─── Liker / Unliker ──────────────────────────────────────────────────────
  const handleLike = async (postId: string, liked: boolean) => {
    try {
      const res  = await fetch(HOME_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:  liked ? 'like-post' : 'unlike-post',
          user_id: userId,
          post_id: postId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, reactions: { ...p.reactions, likes: data.likes }, user_liked: liked }
            : p
        ));
      }
    } catch (err) {
      console.error('[SavedPostsModal] handleLike:', err);
    }
  };

  // ─── Partager / Annuler le partage ────────────────────────────────────────
  const handleShare = async (postId: string, shared: boolean) => {
    try {
      const res  = await fetch(HOME_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:  shared ? 'share-post' : 'unshare-post',
          user_id: userId,
          post_id: postId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, reactions: { ...p.reactions, shares: data.shares }, user_shared: shared }
            : p
        ));
      }
    } catch (err) {
      console.error('[SavedPostsModal] handleShare:', err);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
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
            <View style={{ paddingVertical: 8, paddingBottom: 40 }}>
              {posts.map(post => (
                <SavedPostCard
                  key={post.id}
                  post={post}
                  userId={userId}
                  onUnsave={handleUnsave}
                  onLike={handleLike}
                  onShare={handleShare}
                  onCommentPress={onCommentPress}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingTop:      Platform.OS === 'ios' ? 55 : 20,
    paddingBottom:   16,
    paddingHorizontal: 16,
    backgroundColor: '#8A2BE2',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  placeholder: { width: 36 },
  scrollView:  { flex: 1 },

  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyContainer:   { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyText:        { fontSize: 18, fontWeight: '600', color: '#999', marginTop: 20 },
  emptySubtext:     { fontSize: 14, color: '#CCC', marginTop: 8, textAlign: 'center' },

  // ── Post card (aligné sur PostCard dans actu.tsx) ─────────────────────────
  postCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical:   6,
    borderRadius:     14,
    paddingVertical:  14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  postHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 14,
    marginBottom:   10,
  },
  postAuthor: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center',
  },
  postAvatarText:  { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  postAuthorName:  { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  postTime:        { fontSize: 12, color: '#999', marginTop: 1 },
  postContent:     { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 14, marginBottom: 10 },

  // ── Médias (mêmes dimensions que actu.tsx) ───────────────────────────────
  postImage: { width: '100%', height: 240, marginBottom: 10 },
  mediaExpandHint: {
    position: 'absolute', bottom: 18, right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: 4,
  },
  videoThumb: {
    width: '100%', height: 180, backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10, gap: 6,
  },
  videoThumbLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  // ── Stats bar ─────────────────────────────────────────────────────────────
  statsBar: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth:    1, borderTopColor:    '#F5F5F5',
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  statsText:      { fontSize: 12, color: '#666' },
  statsRight:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statsSeparator: { color: '#CCC' },

  // ── Actions bar (alginées sur actu.tsx) ──────────────────────────────────
  actionsBar: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 6,
    paddingTop:    6,
    gap:           3,
  },
  actionButton:       { flex: 1, borderRadius: 8, overflow: 'hidden' },
  actionButtonActive: {},
  actionGradient: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical:   8,
    paddingHorizontal: 10,
    gap: 5,
  },
  actionText:       { fontSize: 12, fontWeight: '600', color: '#666' },
  actionTextActive: { color: '#FFF' },
});
