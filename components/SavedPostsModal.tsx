import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView,
  Image, Platform, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { LinearGradient }  from 'expo-linear-gradient';
import * as Haptics        from 'expo-haptics';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const HOME_URL    = `${BACKEND_URL}/home`;

const { width, height } = Dimensions.get('window');
const NATIVE = Platform.OS !== 'web';

interface Post {
  item_type:   'post';
  id:          string;
  author_id:   string;
  author:      { nom: string; prenom: string; avatar_url: string | null };
  content:     string;
  visibility:  string;
  created_at:  string;
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
  accessToken:    string;        // ← requis pour passer requireAuth sur /home
  onClose:        () => void;
  onCommentPress: (postId: string) => void;
}

const formatTimeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return "À l'instant";
  if (s < 3600)  return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
};
const getInitials = (nom: string, prenom: string) =>
  `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

// ─── MediaViewer ──────────────────────────────────────────────────────────────
function MediaViewer({ visible, url, type, onClose }: {
  visible: boolean; url: string | null; type: 'image' | 'video'; onClose: () => void;
}) {
  if (!url) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={mv.overlay}>
        <TouchableOpacity style={mv.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        {type === 'image' ? (
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={mv.imgWrap}>
            <Image source={{ uri: url }} style={mv.img} resizeMode="contain" />
          </TouchableOpacity>
        ) : Platform.OS === 'web' ? (
          // @ts-ignore
          <video src={url} controls autoPlay style={{ width: '100%', maxHeight: '90%', objectFit: 'contain', backgroundColor: '#000' }} />
        ) : (
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={mv.videoNative}>
            <Ionicons name="play-circle" size={72} color="rgba(255,255,255,0.9)" />
            <Text style={mv.videoHint}>Appuyez pour fermer</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}
const mv = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center', alignItems: 'center' },
  closeBtn:   { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  imgWrap:    { width, height: height * 0.85, justifyContent: 'center', alignItems: 'center' },
  img:        { width, height: height * 0.85 },
  videoNative:{ justifyContent: 'center', alignItems: 'center', gap: 16 },
  videoHint:  { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
});

// ─── Carte post (même logique que PostCard dans actu.tsx) ─────────────────────
function SavedPostCard({ post, onUnsave, onLike, onShare, onCommentPress }: {
  post: Post;
  onUnsave:       (id: string) => void;
  onLike:         (id: string, liked: boolean) => Promise<void>;
  onShare:        (id: string, shared: boolean) => Promise<void>;
  onCommentPress: (id: string) => void;
}) {
  const [liked,       setLiked]       = useState(post.user_liked);
  const [shared,      setShared]      = useState(post.user_shared);
  const [likesCount,  setLikesCount]  = useState(post.reactions.likes);
  const [sharesCount, setSharesCount] = useState(post.reactions.shares);
  const [isAnim,      setIsAnim]      = useState(false);
  const [viewerUrl,   setViewerUrl]   = useState<string | null>(null);
  const [viewerType,  setViewerType]  = useState<'image' | 'video'>('image');

  useEffect(() => {
    setLiked(post.user_liked); setShared(post.user_shared);
    setLikesCount(post.reactions.likes); setSharesCount(post.reactions.shares);
  }, [post.id, post.user_liked, post.user_shared, post.reactions]);

  const handleLike = async () => {
    if (isAnim) return; setIsAnim(true);
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const n = !liked; setLiked(n); setLikesCount(p => n ? p + 1 : p - 1);
    try   { await onLike(post.id, n); }
    catch { setLiked(!n); setLikesCount(p => n ? p - 1 : p + 1); }
    finally { setTimeout(() => setIsAnim(false), 300); }
  };

  const handleShare = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const n = !shared; setShared(n); setSharesCount(p => n ? p + 1 : p - 1);
    try   { await onShare(post.id, n); }
    catch { setShared(!n); setSharesCount(p => n ? p - 1 : p + 1); }
  };

  return (
    <>
      <MediaViewer visible={!!viewerUrl} url={viewerUrl} type={viewerType} onClose={() => setViewerUrl(null)} />
      <View style={s.postCard}>
        {/* En-tête */}
        <View style={s.postHeader}>
          <View style={s.postAuthor}>
            {post.author.avatar_url
              ? <Image source={{ uri: post.author.avatar_url }} style={s.avatar} />
              : <View style={s.avatarPH}><Text style={s.avatarTxt}>{getInitials(post.author.nom, post.author.prenom)}</Text></View>}
            <View>
              <Text style={s.authorName}>{post.author.prenom} {post.author.nom}</Text>
              <Text style={s.postTime}>{formatTimeAgo(post.created_at)}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => onUnsave(post.id)}>
            <Ionicons name="bookmark" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* Texte */}
        <Text style={s.postContent}>{post.content}</Text>

        {/* Image */}
        {post.imagepots && (
          <TouchableOpacity activeOpacity={0.92} onPress={() => { setViewerType('image'); setViewerUrl(post.imagepots!); }}>
            <Image source={{ uri: post.imagepots }} style={s.postImage} resizeMode="cover" />
            <View style={s.expandHint}><Ionicons name="expand-outline" size={16} color="rgba(255,255,255,0.85)" /></View>
          </TouchableOpacity>
        )}

        {/* Vidéo */}
        {post.vidposts && (
          <TouchableOpacity style={s.videoThumb} activeOpacity={0.92} onPress={() => { setViewerType('video'); setViewerUrl(post.vidposts!); }}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
            <Text style={s.videoLabel}>Appuyer pour lire</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={s.statsBar}>
          <Text style={s.statsText}>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</Text>
          <View style={s.statsRight}>
            <Text style={s.statsText}>{post.reactions.comments} commentaires</Text>
            <Text style={s.statsSep}>•</Text>
            <Text style={s.statsText}>{sharesCount} partages</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionsBar}>
          <TouchableOpacity style={[s.actionBtn, liked && s.actionBtnActive]} onPress={handleLike} disabled={isAnim}>
            <LinearGradient colors={liked ? ['#FF0080','#FF0080'] : ['transparent','transparent']} style={s.actionGrad}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#FFF' : '#666'} />
              <Text style={[s.actionText, liked && s.actionTextActive]}>{liked ? 'Aimé' : 'Aimer'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCommentPress(post.id); }}>
            <View style={s.actionGrad}>
              <Ionicons name="chatbubble-outline" size={20} color="#666" />
              <Text style={s.actionText}>Commenter</Text>
            </View>
          </TouchableOpacity>

          {post.visibility === 'public' && (
            <TouchableOpacity style={[s.actionBtn, shared && s.actionBtnActive]} onPress={handleShare}>
              <LinearGradient colors={shared ? ['#10B981','#10B981'] : ['transparent','transparent']} style={s.actionGrad}>
                <Ionicons name={shared ? 'repeat' : 'repeat-outline'} size={22} color={shared ? '#FFF' : '#666'} />
                <Text style={[s.actionText, shared && s.actionTextActive]}>{shared ? 'Partagé' : 'Partager'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function SavedPostsModal({ visible, userId, accessToken, onClose, onCommentPress }: SavedPostsModalProps) {
  const [posts,   setPosts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId && accessToken) loadSavedPosts();
  }, [visible, userId, accessToken]);

  // Helper : injecte user_id + access_token dans chaque appel /home
  const homePost = (body: Record<string, any>) =>
    fetch(HOME_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...body, user_id: userId, access_token: accessToken }),
    });

  const loadSavedPosts = async () => {
    setLoading(true);
    try {
      const res  = await homePost({ action: 'get-saved-posts' });
      const data = await res.json();
      if (data.success && data.posts) setPosts(data.posts);
    } catch (err) { console.error('[SavedPostsModal] loadSavedPosts:', err); }
    finally { setLoading(false); }
  };

  const handleUnsave = async (postId: string) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts(prev => prev.filter(p => p.id !== postId));
    try { await homePost({ action: 'unsave-post', post_id: postId }); }
    catch { console.error('[SavedPostsModal] handleUnsave'); loadSavedPosts(); }
  };

  const handleLike = async (postId: string, liked: boolean) => {
    try {
      const res  = await homePost({ action: liked ? 'like-post' : 'unlike-post', post_id: postId });
      const data = await res.json();
      if (data.success) setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, reactions: { ...p.reactions, likes: data.likes }, user_liked: liked } : p
      ));
    } catch (err) { console.error('[SavedPostsModal] handleLike:', err); }
  };

  const handleShare = async (postId: string, shared: boolean) => {
    try {
      const res  = await homePost({ action: shared ? 'share-post' : 'unshare-post', post_id: postId });
      const data = await res.json();
      if (data.success) setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, reactions: { ...p.reactions, shares: data.shares }, user_shared: shared } : p
      ));
    } catch (err) { console.error('[SavedPostsModal] handleShare:', err); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Posts sauvegardés</Text>
          <View style={s.placeholder} />
        </View>

        <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.loading}><ActivityIndicator size="large" color="#8A2BE2" /></View>
          ) : posts.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bookmark-outline" size={80} color="#CCC" />
              <Text style={s.emptyText}>Aucun post sauvegardé</Text>
              <Text style={s.emptySub}>Les posts que vous enregistrez apparaîtront ici</Text>
            </View>
          ) : (
            <View style={{ paddingVertical: 8, paddingBottom: 40 }}>
              {posts.map(post => (
                <SavedPostCard
                  key={post.id} post={post}
                  onUnsave={handleUnsave} onLike={handleLike}
                  onShare={handleShare} onCommentPress={onCommentPress}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F5F5F5' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 55 : 20, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#8A2BE2' },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  placeholder: { width: 36 },
  scrollView:  { flex: 1 },
  loading:     { paddingVertical: 60, alignItems: 'center' },
  empty:       { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyText:   { fontSize: 18, fontWeight: '600', color: '#999', marginTop: 20 },
  emptySub:    { fontSize: 14, color: '#CCC', marginTop: 8, textAlign: 'center' },

  postCard:    { backgroundColor: '#FFF', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, paddingVertical: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 4 } }) },
  postHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  postAuthor:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatar:      { width: 40, height: 40, borderRadius: 20 },
  avatarPH:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  authorName:  { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  postTime:    { fontSize: 12, color: '#999', marginTop: 1 },
  postContent: { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 14, marginBottom: 10 },

  postImage:  { width: '100%', height: 240, marginBottom: 10 },
  expandHint: { position: 'absolute', bottom: 18, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: 4 },
  videoThumb: { width: '100%', height: 180, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', marginBottom: 10, gap: 6 },
  videoLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  statsBar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F5F5F5', borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  statsText:  { fontSize: 12, color: '#666' },
  statsRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statsSep:   { color: '#CCC' },

  actionsBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, gap: 3 },
  actionBtn:       { flex: 1, borderRadius: 8, overflow: 'hidden' },
  actionBtnActive: {},
  actionGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 5 },
  actionText:      { fontSize: 12, fontWeight: '600', color: '#666' },
  actionTextActive:{ color: '#FFF' },
});
