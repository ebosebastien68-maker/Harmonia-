// =====================================================
// UserProfileView — Profil public d'un utilisateur
// =====================================================
//
// Utilisation depuis n'importe quel écran :
//   <UserProfileView userId="xxx" viewerId="yyy" accessToken="zzz" asModal onClose={() => ...} />
//
// Logique amitié :
//   - accepted       → "Retirer ami" + "Voir plus" (posts amis+publics)
//   - pending_sent   → "En attente"
//   - pending_received → "Accepter"
//   - none           → "Ajouter ami" (posts: aucun)
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics       from 'expo-haptics';

import CommentsModal from './CommentsModal';
import LikersModal   from './LikersModal';

// ⚠️ Ajuste le chemin selon l'emplacement de ce fichier dans ton projet
const DEFAULT_AVATAR = require('../../assets/default-avatar.png');

const WS_BASE          = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const USER_PROFILE_URL = `${WS_BASE}/user-profile`;
const HOME_URL         = `${WS_BASE}/home`;
const NATIVE           = Platform.OS !== 'web';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

interface UserProfile {
  id:             string;
  nom:            string;
  prenom:         string;
  avatar_url?:    string;
  trophies_count: number;
  friends_count:  number;
  created_at:     string;
}

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
  user_liked?:  boolean;
  user_shared?: boolean;
  user_saved?:  boolean;
}

interface Props {
  userId:      string;
  viewerId:    string;
  accessToken: string;
  onClose?:    () => void;
  asModal?:    boolean;
}

const formatTimeAgo = (dateString: string) => {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
};

const getInitials = (nom: string, prenom: string) =>
  `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

// ─── POST CARD ────────────────────────────────────────────────────────────────

const PostCard = React.memo(({ post, viewerId, onLike, onShare, onSave, onOpenComments, onOpenLikers }: {
  post: Post; viewerId: string;
  onLike: (id: string, liked: boolean) => Promise<void>;
  onShare: (id: string, shared: boolean) => Promise<void>;
  onSave: (id: string, saved: boolean) => Promise<void>;
  onOpenComments: (id: string) => void;
  onOpenLikers: (id: string) => void;
}) => {
  const [liked,       setLiked]       = useState(post.user_liked  || false);
  const [shared,      setShared]      = useState(post.user_shared || false);
  const [saved,       setSaved]       = useState(post.user_saved  || false);
  const [likesCount,  setLikesCount]  = useState(post.reactions.likes);
  const [sharesCount, setSharesCount] = useState(post.reactions.shares);
  const [isAnim,      setIsAnim]      = useState(false);

  useEffect(() => {
    setLiked(post.user_liked  || false);
    setShared(post.user_shared || false);
    setSaved(post.user_saved  || false);
    setLikesCount(post.reactions.likes);
    setSharesCount(post.reactions.shares);
  }, [post.id, post.user_liked, post.user_shared, post.user_saved, post.reactions]);

  const handleLike = async () => {
    if (isAnim) return; setIsAnim(true);
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const n = !liked; setLiked(n); setLikesCount(p => n ? p + 1 : p - 1);
    try { await onLike(post.id, n); } catch { setLiked(!n); setLikesCount(p => n ? p - 1 : p + 1); }
    finally { setTimeout(() => setIsAnim(false), 300); }
  };

  const handleShare = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const n = !shared; setShared(n); setSharesCount(p => n ? p + 1 : p - 1);
    try { await onShare(post.id, n); } catch { setShared(!n); setSharesCount(p => n ? p - 1 : p + 1); }
  };

  const handleSave = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const n = !saved; setSaved(n);
    try { await onSave(post.id, n); } catch { setSaved(!n); }
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAuthor}>
          {/* Avatar auteur du post — default-avatar si pas de photo */}
          <Image
            source={post.author.avatar_url ? { uri: post.author.avatar_url } : DEFAULT_AVATAR}
            style={styles.postAvatar}
          />
          <View>
            <Text style={styles.authorName}>{post.author.prenom} {post.author.nom}</Text>
            <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      {post.imagepots && <Image source={{ uri: post.imagepots }} style={styles.postImage} resizeMode="cover" />}
      {post.vidposts && (
        <View style={styles.videoThumb}>
          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
          <Text style={styles.videoLabel}>Vidéo</Text>
        </View>
      )}

      <View style={styles.statsBar}>
        <TouchableOpacity onPress={() => { if (likesCount > 0) onOpenLikers(post.id); }}>
          <Text style={styles.statsText}>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</Text>
        </TouchableOpacity>
        <View style={styles.statsRight}>
          <Text style={styles.statsText}>{post.reactions.comments} commentaires</Text>
          <Text style={styles.statsSep}>•</Text>
          <Text style={styles.statsText}>{sharesCount} partages</Text>
        </View>
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity style={[styles.actionBtn, liked && styles.actionBtnActive]} onPress={handleLike} disabled={isAnim}>
          <LinearGradient colors={liked ? ['#FF0080','#FF0080'] : ['transparent','transparent']} style={styles.actionGrad}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#FFF' : '#666'} />
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>{liked ? 'Aimé' : 'Aimer'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenComments(post.id); }}>
          <View style={styles.actionGrad}>
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
            <Text style={styles.actionText}>Commenter</Text>
          </View>
        </TouchableOpacity>

        {/* Partage uniquement si post public */}
        {post.visibility === 'public' && (
          <TouchableOpacity style={[styles.actionBtn, shared && styles.actionBtnActive]} onPress={handleShare}>
            <LinearGradient colors={shared ? ['#10B981','#10B981'] : ['transparent','transparent']} style={styles.actionGrad}>
              <Ionicons name={shared ? 'repeat' : 'repeat-outline'} size={22} color={shared ? '#FFF' : '#666'} />
              <Text style={[styles.actionText, shared && styles.actionTextActive]}>{shared ? 'Partagé' : 'Partager'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? '#FFD700' : '#666'} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function UserProfileView({ userId, viewerId, accessToken, onClose, asModal = false }: Props) {
  const [profile,         setProfile]         = useState<UserProfile | null>(null);
  const [friendStatus,    setFriendStatus]    = useState<FriendStatus>('none');
  const [posts,           setPosts]           = useState<Post[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [loadingPosts,    setLoadingPosts]    = useState(false);
  const [showPosts,       setShowPosts]       = useState(false);
  const [friendLoading,   setFriendLoading]   = useState(false);

  const [showAvatarViewer,        setShowAvatarViewer]        = useState(false);
  const [showCommentsModal,       setShowCommentsModal]       = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);
  const [showLikersModal,         setShowLikersModal]         = useState(false);
  const [selectedPostForLikers,   setSelectedPostForLikers]   = useState<string | null>(null);

  useEffect(() => {
    if (userId && accessToken) loadUserProfile();
  }, [userId, accessToken]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const res  = await fetch(USER_PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-user-profile', access_token: accessToken, target_user_id: userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setFriendStatus(data.friendship_status || 'none');
      }
    } catch (err) { console.error('[UserProfileView] loadProfile:', err); }
    finally { setLoading(false); }
  };

  const loadUserPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res  = await fetch(USER_PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-user-posts', access_token: accessToken, target_user_id: userId }),
      });
      const data = await res.json();
      if (res.ok) setPosts(data.posts || []);
    } catch (err) { console.error('[UserProfileView] loadPosts:', err); }
    finally { setLoadingPosts(false); }
  }, [userId, accessToken]);

  const handleFriendAction = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFriendLoading(true);
    try {
      let action = '';
      if (friendStatus === 'none')              action = 'add-friend';
      else if (friendStatus === 'pending_sent') action = 'remove-friend';
      else if (friendStatus === 'pending_received') action = 'accept-friend';
      else if (friendStatus === 'accepted')     action = 'remove-friend';

      const res  = await fetch(USER_PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, access_token: accessToken, target_user_id: userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFriendStatus(data.friendship_status);
        if (data.friendship_status === 'accepted') { setShowPosts(true); loadUserPosts(); }
        if (data.friendship_status === 'none') { setShowPosts(false); setPosts([]); }
      }
    } catch (err) { console.error('[UserProfileView] friendAction:', err); }
    finally { setFriendLoading(false); }
  };

  const handleVoirPlus = () => {
    setShowPosts(true);
    loadUserPosts();
  };

  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    const res  = await fetch(HOME_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: liked ? 'like-post' : 'unlike-post', user_id: viewerId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: { ...p.reactions, likes: data.likes }, user_liked: liked } : p));
  }, [viewerId]);

  const handleShare = useCallback(async (postId: string, shared: boolean) => {
    const res  = await fetch(HOME_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: shared ? 'share-post' : 'unshare-post', user_id: viewerId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: { ...p.reactions, shares: data.shares }, user_shared: shared } : p));
  }, [viewerId]);

  const handleSave = useCallback(async (postId: string, saved: boolean) => {
    const res  = await fetch(HOME_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: saved ? 'save-post' : 'unsave-post', user_id: viewerId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_saved: saved } : p));
  }, [viewerId]);

  const handleOpenComments = useCallback((postId: string) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPostForComments(postId); setShowCommentsModal(true);
  }, []);

  const handleOpenLikers = useCallback((postId: string) => {
    setSelectedPostForLikers(postId); setShowLikersModal(true);
  }, []);

  // ── Bouton ami ────────────────────────────────────────────────────────────
  const renderFriendButton = () => {
    const configs: Record<FriendStatus, { label: string; icon: string; color: string[] }> = {
      none:              { label: 'Ajouter ami',    icon: 'person-add-outline',   color: ['#7B1FE8', '#4B0082'] },
      pending_sent:      { label: 'En attente',     icon: 'time-outline',          color: ['#999', '#777'] },
      pending_received:  { label: 'Accepter',       icon: 'checkmark-outline',     color: ['#10B981', '#059669'] },
      accepted:          { label: 'Retirer ami',    icon: 'person-remove-outline', color: ['#EF4444', '#DC2626'] },
    };
    const cfg = configs[friendStatus];
    return (
      <TouchableOpacity onPress={handleFriendAction} disabled={friendLoading} activeOpacity={0.8}>
        <LinearGradient colors={cfg.color as any} style={styles.friendBtn}>
          {friendLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name={cfg.icon as any} size={18} color="#fff" /><Text style={styles.friendBtnText}>{cfg.label}</Text></>}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const content = (
    <View style={[styles.container, asModal && styles.containerModal]}>
      {asModal && onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#7B1FE8" /></View>
      ) : !profile ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Profil introuvable</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Header */}
          <LinearGradient colors={['#7B1FE8', '#4B0082']} style={styles.header}>
            <TouchableOpacity onPress={() => profile.avatar_url && setShowAvatarViewer(true)} activeOpacity={profile.avatar_url ? 0.8 : 1}>
              {/* Avatar profil — default-avatar.png si pas de photo */}
              <Image
                source={profile.avatar_url ? { uri: profile.avatar_url } : DEFAULT_AVATAR}
                style={styles.avatar}
              />
            </TouchableOpacity>
            <Text style={styles.headerName}>{profile.prenom} {profile.nom}</Text>
            <Text style={styles.headerSub}>Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.friends_count || 0}</Text>
                <Text style={styles.statLabel}>Amis</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.trophies_count}</Text>
                <Text style={styles.statLabel}>Trophées</Text>
              </View>
            </View>

            {/* Bouton ami */}
            <View style={styles.friendBtnContainer}>
              {renderFriendButton()}
            </View>
          </LinearGradient>

          {/* Section posts */}
          <View style={styles.postsSection}>

            {friendStatus === 'accepted' && !showPosts && (
              <TouchableOpacity style={styles.voirPlusBtn} onPress={handleVoirPlus} activeOpacity={0.8}>
                <LinearGradient colors={['#7B1FE8', '#4B0082']} style={styles.voirPlusGrad}>
                  <Ionicons name="eye-outline" size={18} color="#fff" />
                  <Text style={styles.voirPlusText}>Voir les publications</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {showPosts && (
              <>
                <Text style={styles.sectionTitle}>Publications</Text>
                {loadingPosts ? (
                  <View style={styles.postsLoading}><ActivityIndicator size="small" color="#7B1FE8" /></View>
                ) : posts.length === 0 ? (
                  <View style={styles.emptyPosts}>
                    <Ionicons name="newspaper-outline" size={40} color="#DDD" />
                    <Text style={styles.emptyText}>Aucune publication</Text>
                  </View>
                ) : (
                  posts.map(post => (
                    <PostCard
                      key={post.id} post={post} viewerId={viewerId}
                      onLike={handleLike} onShare={handleShare} onSave={handleSave}
                      onOpenComments={handleOpenComments} onOpenLikers={handleOpenLikers}
                    />
                  ))
                )}
              </>
            )}

            {friendStatus !== 'accepted' && friendStatus !== 'pending_received' && (
              <View style={styles.notFriendBox}>
                <Ionicons name="lock-closed-outline" size={32} color="#CCC" />
                <Text style={styles.notFriendText}>
                  {friendStatus === 'pending_sent'
                    ? 'Demande envoyée — En attente de confirmation'
                    : 'Ajoutez cet utilisateur comme ami pour voir ses publications'}
                </Text>
              </View>
            )}
          </View>

        </ScrollView>
      )}

      {/* ── VIEWER PLEIN ÉCRAN ──────────────────────────────────────────── */}
      <Modal visible={showAvatarViewer} transparent animationType="fade" onRequestClose={() => setShowAvatarViewer(false)} statusBarTranslucent>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setShowAvatarViewer(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {profile?.avatar_url && <Image source={{ uri: profile.avatar_url }} style={styles.viewerImage} resizeMode="contain" />}
        </View>
      </Modal>

      <CommentsModal
        visible={showCommentsModal} postId={selectedPostForComments} userId={viewerId}
        onClose={() => { setShowCommentsModal(false); setSelectedPostForComments(null); }}
        onCommentAdded={() => loadUserPosts()}
      />
      <LikersModal
        visible={showLikersModal} postId={selectedPostForLikers}
        onClose={() => { setShowLikersModal(false); setSelectedPostForLikers(null); }}
      />
    </View>
  );

  if (asModal) {
    return <Modal visible animationType="slide" onRequestClose={onClose}>{content}</Modal>;
  }
  return content;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F5F5F5' },
  containerModal: { flex: 1 },
  scrollContent:  { paddingBottom: 80 },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, minHeight: 200 },
  errorText:      { fontSize: 15, color: '#EF4444', marginTop: 12 },
  closeBtn:       { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 30, right: 16, zIndex: 100, backgroundColor: 'rgba(123,31,232,0.8)', borderRadius: 20, padding: 8 },

  header:         { paddingTop: Platform.OS === 'ios' ? 64 : 44, paddingBottom: 24, alignItems: 'center', paddingHorizontal: 20 },
  avatar:         { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', backgroundColor: '#E0E0E0', marginBottom: 12 },
  avatarFallback: { backgroundColor: '#7B1FE8', justifyContent: 'center', alignItems: 'center' },
  avatarFallbackText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  headerName:     { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  headerSub:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },

  statsRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 28, gap: 20, marginBottom: 16 },
  statItem:     { alignItems: 'center', gap: 2 },
  statValue:    { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  statDivider:  { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },

  friendBtnContainer: { width: '100%', alignItems: 'center' },
  friendBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25, minWidth: 180, justifyContent: 'center' },
  friendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  postsSection:  { paddingHorizontal: 12, marginTop: 16 },
  sectionTitle:  { fontSize: 17, fontWeight: 'bold', color: '#2D0072', marginBottom: 12, paddingHorizontal: 4 },
  postsLoading:  { paddingVertical: 30, alignItems: 'center' },
  emptyPosts:    { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText:     { fontSize: 15, color: '#999' },

  voirPlusBtn:   { marginHorizontal: 4, marginBottom: 16 },
  voirPlusGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  voirPlusText:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  notFriendBox:  { alignItems: 'center', paddingVertical: 40, gap: 12, paddingHorizontal: 20 },
  notFriendText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },

  // PostCard
  postCard:          { backgroundColor: '#fff', marginVertical: 6, borderRadius: 14, paddingVertical: 14 },
  postHeader:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  postAuthor:        { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  postAvatar:        { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  avatarText:        { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  authorName:        { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  postTime:          { fontSize: 12, color: '#999', marginTop: 1 },
  postContent:       { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 14, marginBottom: 10 },
  postImage:         { width: '100%', height: 240, marginBottom: 10 },
  videoThumb:        { width: '100%', height: 180, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', marginBottom: 10, gap: 6 },
  videoLabel:        { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  statsBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F5F5F5', borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  statsText:         { fontSize: 12, color: '#666' },
  statsRight:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statsSep:          { color: '#CCC' },
  actionsBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, gap: 3 },
  actionBtn:         { flex: 1, borderRadius: 8, overflow: 'hidden' },
  actionBtnActive:   {},
  actionGrad:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 5 },
  actionText:        { fontSize: 12, fontWeight: '600', color: '#666' },
  actionTextActive:  { color: '#FFF' },
  saveBtn:           { padding: 8 },

  // Viewer plein écran
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerClose:   { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  viewerImage:   { width: '100%', height: '80%' },
});
