import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, Alert,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import * as ImagePicker   from 'expo-image-picker';
import DateTimePicker     from '@react-native-community/datetimepicker';
import * as Haptics       from 'expo-haptics';

// ── Modals — même import que actu.tsx ─────────────────────────────────────────
import CommentsModal  from '../components/CommentsModal';
import LikersModal    from '../components/LikersModal';
import EditPostModal  from '../components/EditPostModal';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WS_BASE        = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const PROFILE_URL    = `${WS_BASE}/profile`;
const REFRESH_URL    = `${WS_BASE}/refresh-token`;
// Même endpoint que actu.tsx pour les interactions posts
const API_BASE_POSTS = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';
const NATIVE         = Platform.OS !== 'web';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface MyProfile {
  id:             string;
  nom:            string;
  prenom:         string;
  date_naissance: string | null;
  avatar_url?:    string;
  solde_cfa:      number;
  trophies_count: number;
  created_at:     string;
}

// Même interface Post que actu.tsx
interface Post {
  item_type: 'post';
  id: string;
  author_id: string;
  author: { nom: string; prenom: string; avatar_url: string | null };
  content: string;
  created_at: string;
  reactions: { likes: number; comments: number; shares: number };
  user_liked?:  boolean;
  user_shared?: boolean;
  user_saved?:  boolean;
}

type MessageType = 'success' | 'error' | 'info';
type Visibility  = 'public' | 'friends' | 'private';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const formatTimeAgo = (dateString: string) => {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
};

const getInitials = (nom: string, prenom: string) =>
  `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

// ─── POSTCARD — copie exacte de actu.tsx ──────────────────────────────────────
interface PostCardProps {
  post:           Post;
  userId:         string;
  onLike:         (postId: string, liked: boolean)  => Promise<void>;
  onShare:        (postId: string, shared: boolean) => Promise<void>;
  onSave:         (postId: string, saved: boolean)  => Promise<void>;
  onOpenComments: (postId: string) => void;
  onOpenLikers:   (postId: string) => void;
  onOpenEdit:     (post: { id: string; content: string }) => void;
  onLongPress:    (post: Post) => void;
}

const PostCard = React.memo(({
  post, userId,
  onLike, onShare, onSave,
  onOpenComments, onOpenLikers, onOpenEdit, onLongPress,
}: PostCardProps) => {
  const [liked,       setLiked]       = useState(post.user_liked  || false);
  const [shared,      setShared]      = useState(post.user_shared || false);
  const [saved,       setSaved]       = useState(post.user_saved  || false);
  const [likesCount,  setLikesCount]  = useState(post.reactions.likes);
  const [sharesCount, setSharesCount] = useState(post.reactions.shares);
  const [isAnim,      setIsAnim]      = useState(false);
  const isOwn = post.author_id === userId;

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
    const newLiked = !liked;
    setLiked(newLiked); setLikesCount(p => newLiked ? p + 1 : p - 1);
    try { await onLike(post.id, newLiked); }
    catch { setLiked(!newLiked); setLikesCount(p => newLiked ? p - 1 : p + 1); }
    finally { setTimeout(() => setIsAnim(false), 300); }
  };

  const handleShare = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newShared = !shared;
    setShared(newShared); setSharesCount(p => newShared ? p + 1 : p - 1);
    try { await onShare(post.id, newShared); }
    catch { setShared(!newShared); setSharesCount(p => newShared ? p - 1 : p + 1); }
  };

  const handleSave = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSaved = !saved; setSaved(newSaved);
    try { await onSave(post.id, newSaved); }
    catch { setSaved(!newSaved); }
  };

  return (
    <TouchableOpacity style={styles.postCard} activeOpacity={0.98} onLongPress={() => onLongPress(post)}>
      <View style={styles.postHeader}>
        <View style={styles.postAuthor}>
          {post.author.avatar_url
            ? <Image source={{ uri: post.author.avatar_url }} style={styles.postAvatar} />
            : <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitials(post.author.nom, post.author.prenom)}</Text>
              </View>}
          <View>
            <Text style={styles.authorName}>{post.author.prenom} {post.author.nom}</Text>
            <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </View>
        {isOwn && (
          <TouchableOpacity onPress={() => onOpenEdit({ id: post.id, content: post.content })}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

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

        <TouchableOpacity style={styles.actionBtn} onPress={() => {
          if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenComments(post.id);
        }}>
          <View style={styles.actionGrad}>
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
            <Text style={styles.actionText}>Commenter</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, shared && styles.actionBtnActive]} onPress={handleShare}>
          <LinearGradient colors={shared ? ['#10B981','#10B981'] : ['transparent','transparent']} style={styles.actionGrad}>
            <Ionicons name={shared ? 'repeat' : 'repeat-outline'} size={22} color={shared ? '#FFF' : '#666'} />
            <Text style={[styles.actionText, shared && styles.actionTextActive]}>{shared ? 'Partagé' : 'Partager'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? '#FFD700' : '#666'} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();

  const [profile,          setProfile]          = useState<MyProfile | null>(null);
  const [posts,            setPosts]            = useState<Post[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [loadingPosts,     setLoadingPosts]     = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [uploadingAvatar,  setUploadingAvatar]  = useState(false);
  const [editMode,         setEditMode]         = useState(false);
  const [toast,            setToast]            = useState<{ type: MessageType; text: string } | null>(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [showCreatePost,   setShowCreatePost]   = useState(false);

  // ── Même états modals que actu.tsx ────────────────────────────────────────
  const [selectedPost,            setSelectedPost]            = useState<Post | null>(null);
  const [showCommentsModal,       setShowCommentsModal]       = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);
  const [showLikersModal,         setShowLikersModal]         = useState(false);
  const [selectedPostForLikers,   setSelectedPostForLikers]   = useState<string | null>(null);
  const [showEditModal,           setShowEditModal]           = useState(false);
  const [selectedPostForEdit,     setSelectedPostForEdit]     = useState<{ id: string; content: string } | null>(null);

  // Champs édition profil
  const [nom,              setNom]              = useState('');
  const [prenom,           setPrenom]           = useState('');
  const [dateNaissance,    setDateNaissance]    = useState<Date>(new Date(2000, 0, 1));
  const [dateNaissanceWeb, setDateNaissanceWeb] = useState('');
  const [showDatePicker,   setShowDatePicker]   = useState(false);

  // Champs création post
  const [postContent,    setPostContent]    = useState('');
  const [postVisibility, setPostVisibility] = useState<Visibility>('friends');
  const [creatingPost,   setCreatingPost]   = useState(false);

  // userId exposé pour les modals
  const [userId, setUserId] = useState('');

  const accessTokenRef  = useRef<string>('');
  const refreshTokenRef = useRef<string>('');
  const expiresAtRef    = useRef<number>(0);

  useEffect(() => { initSession() }, []);

  const initSession = async () => {
    try {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (!raw) { router.replace('/login'); return; }
      const session = JSON.parse(raw);
      accessTokenRef.current  = session.access_token  || '';
      refreshTokenRef.current = session.refresh_token || '';
      expiresAtRef.current    = session.expires_at    || 0;
      // Extraire userId depuis la session (même logique que actu.tsx)
      const uid = session?.user?.id || '';
      setUserId(uid);
      await Promise.all([loadProfile(), loadPosts()]);
    } catch {
      router.replace('/login');
    }
  };

  const getValidToken = async (): Promise<string> => {
    const now = Math.floor(Date.now() / 1000);
    if (expiresAtRef.current - now > 60) return accessTokenRef.current;
    try {
      const res  = await fetch(REFRESH_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshTokenRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      accessTokenRef.current  = data.access_token;
      refreshTokenRef.current = data.refresh_token;
      expiresAtRef.current    = data.expires_at;
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) {
        await AsyncStorage.setItem('harmonia_session', JSON.stringify({
          ...JSON.parse(raw),
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
          expires_at:    data.expires_at,
        }));
      }
      return data.access_token;
    } catch {
      router.replace('/login');
      return '';
    }
  };

  const showToast = (type: MessageType, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── CHARGER PROFIL ───────────────────────────────────────────────────────
  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res  = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-profile', access_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      setNom(data.profile.nom || '');
      setPrenom(data.profile.prenom || '');
      if (data.profile.date_naissance) {
        const d = new Date(data.profile.date_naissance);
        setDateNaissance(d);
        setDateNaissanceWeb(data.profile.date_naissance);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  // ─── CHARGER POSTS ────────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res  = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-posts', access_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Normaliser pour correspondre à l'interface Post de actu.tsx
      const normalized = (data.posts || []).map((p: any) => ({
        item_type:  'post' as const,
        id:         p.post_id,
        author_id:  p.original_author_id,
        author:     p.author,
        content:    p.content,
        created_at: p.published_at,
        reactions:  p.reactions || { likes: 0, comments: 0, shares: 0 },
        user_liked:  p.user_liked  || false,
        user_shared: p.user_shared || false,
        user_saved:  p.user_saved  || false,
      }));
      setPosts(normalized);
    } catch (err: any) {
      console.error('[loadPosts]', err.message);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  // ─── INTERACTIONS POSTS — même logique exacte que actu.tsx ────────────────

  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    const res  = await fetch(API_BASE_POSTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body: JSON.stringify({ action: liked ? 'like-post' : 'unlike-post', user_id: userId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, reactions: { ...p.reactions, likes: data.likes }, user_liked: liked } : p
      ));
    }
  }, [userId]);

  const handleShare = useCallback(async (postId: string, shared: boolean) => {
    const res  = await fetch(API_BASE_POSTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body: JSON.stringify({ action: shared ? 'share-post' : 'unshare-post', user_id: userId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, reactions: { ...p.reactions, shares: data.shares }, user_shared: shared } : p
      ));
    }
  }, [userId]);

  const handleSave = useCallback(async (postId: string, saved: boolean) => {
    const res  = await fetch(API_BASE_POSTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body: JSON.stringify({ action: saved ? 'save-post' : 'unsave-post', user_id: userId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_saved: saved } : p));
    }
  }, [userId]);

  // ── Même handlers modals que actu.tsx ─────────────────────────────────────
  const handleOpenComments = useCallback((postId: string) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPostForComments(postId);
    setShowCommentsModal(true);
  }, []);

  const handleOpenLikers = useCallback((postId: string) => {
    setSelectedPostForLikers(postId);
    setShowLikersModal(true);
  }, []);

  const handleOpenEdit = useCallback((post: { id: string; content: string }) => {
    setSelectedPostForEdit(post);
    setShowEditModal(true);
  }, []);

  const handleLongPress = useCallback((post: Post) => {
    setSelectedPost(post);
  }, []);

  // ─── CRÉER UN POST ────────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!postContent.trim()) { showToast('error', 'Le contenu est obligatoire'); return; }
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreatingPost(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res  = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-post', access_token: token,
          content: postContent.trim(), visibility: postVisibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPostContent('');
      setPostVisibility('friends');
      setShowCreatePost(false);
      await loadPosts();
      showToast('success', 'Post publié !');
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de publier');
    } finally {
      setCreatingPost(false);
    }
  };

  // ─── SAUVEGARDER PROFIL ───────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!nom.trim() || !prenom.trim()) { showToast('error', 'Nom et prénom sont obligatoires'); return; }
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const dateForAPI = Platform.OS === 'web'
        ? dateNaissanceWeb
        : `${dateNaissance.getFullYear()}-${(dateNaissance.getMonth()+1).toString().padStart(2,'0')}-${dateNaissance.getDate().toString().padStart(2,'0')}`;
      const res  = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-profile', access_token: token, nom: nom.trim(), prenom: prenom.trim(), date_naissance: dateForAPI }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadProfile();
      setEditMode(false);
      showToast('success', 'Profil mis à jour !');
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  // ─── UPLOAD AVATAR ────────────────────────────────────────────────────────
  const pickAndUploadAvatar = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', "Nous avons besoin d'accéder à vos photos."); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const urlRes  = await fetch(PROFILE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get-upload-url', access_token: token }) });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);
      const { signed_url, path } = urlData;
      const imageBlob = await uriToBlob(result.assets[0].uri);
      const uploadRes = await fetch(signed_url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: imageBlob });
      if (!uploadRes.ok) throw new Error("Échec de l'upload");
      const updateRes  = await fetch(PROFILE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update-avatar', access_token: token, path }) });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error);
      await loadProfile();
      showToast('success', 'Photo de profil mise à jour !');
    } catch (err: any) {
      showToast('error', err.message || "Impossible de mettre à jour la photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uriToBlob = (uri: string): Promise<Blob> =>
    new Promise((resolve, reject) => {
      if (Platform.OS === 'web') { fetch(uri).then(r => r.blob()).then(resolve).catch(reject); }
      else {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Blob échoué'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      }
    });

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDateNaissance(selectedDate);
  };

  const formatDateDisplay   = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  const formatDateReadable  = (iso: string) => !iso ? '—' : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleLogout = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); } },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7B1FE8" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Impossible de charger le profil</Text>
        <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── VIEWER PLEIN ÉCRAN ────────────────────────────────────────────── */}
      <Modal visible={showAvatarViewer} transparent animationType="fade" onRequestClose={() => setShowAvatarViewer(false)} statusBarTranslucent>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setShowAvatarViewer(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {profile.avatar_url && <Image source={{ uri: profile.avatar_url }} style={styles.viewerImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* ── MODAL CRÉER POST ──────────────────────────────────────────────── */}
      <Modal visible={showCreatePost} transparent animationType="slide" onRequestClose={() => setShowCreatePost(false)}>
        <View style={styles.createPostOverlay}>
          <View style={styles.createPostCard}>
            <View style={styles.createPostHeader}>
              <Text style={styles.createPostTitle}>Nouvelle publication</Text>
              <TouchableOpacity onPress={() => setShowCreatePost(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.createPostAuthorRow}>
              {profile.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.createPostAvatar} />
                : <View style={[styles.createPostAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{getInitials(profile.nom, profile.prenom)}</Text>
                  </View>}
              <View>
                <Text style={styles.createPostAuthorName}>{profile.prenom} {profile.nom}</Text>
                <View style={styles.visibilityRow}>
                  {(['public', 'friends', 'private'] as Visibility[]).map(v => (
                    <TouchableOpacity key={v}
                      style={[styles.visibilityBtn, postVisibility === v && styles.visibilityBtnActive]}
                      onPress={() => setPostVisibility(v)}
                    >
                      <Ionicons name={v === 'public' ? 'globe-outline' : v === 'friends' ? 'people-outline' : 'lock-closed-outline'} size={12} color={postVisibility === v ? '#fff' : '#666'} />
                      <Text style={[styles.visibilityText, postVisibility === v && styles.visibilityTextActive]}>
                        {v === 'public' ? 'Public' : v === 'friends' ? 'Amis' : 'Privé'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TextInput style={styles.createPostInput} placeholder="Quoi de neuf ?" placeholderTextColor="#bbb"
              value={postContent} onChangeText={setPostContent} multiline maxLength={1000} autoFocus />
            <Text style={styles.charCount}>{postContent.length}/1000</Text>
            <TouchableOpacity
              style={[styles.publishBtn, !postContent.trim() && styles.publishBtnDisabled]}
              onPress={handleCreatePost} disabled={creatingPost || !postContent.trim()} activeOpacity={0.8}
            >
              {creatingPost
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.publishBtnText}>Publier</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL DÉTAILS POST — même que actu.tsx ────────────────────────── */}
      {selectedPost && (
        <Modal visible={!!selectedPost} transparent animationType="fade" onRequestClose={() => setSelectedPost(null)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedPost(null)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📊 Détails</Text>
              <View style={styles.modalInfo}><Text style={styles.modalLabel}>Auteur :</Text><Text style={styles.modalValue}>{selectedPost.author.prenom} {selectedPost.author.nom}</Text></View>
              <View style={styles.modalInfo}><Text style={styles.modalLabel}>Publié :</Text><Text style={styles.modalValue}>{formatTimeAgo(selectedPost.created_at)}</Text></View>
              <View style={styles.modalInfo}><Text style={styles.modalLabel}>Réactions :</Text><Text style={styles.modalValue}>❤️ {selectedPost.reactions.likes} · 💬 {selectedPost.reactions.comments} · 🔄 {selectedPost.reactions.shares}</Text></View>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setSelectedPost(null)}>
                <Text style={styles.modalBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── TOAST ──────────────────────────────────────────────────────── */}
        {toast && (
          <View style={[styles.toast, styles[`toast_${toast.type}` as keyof typeof styles]]}>
            <Ionicons name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'close-circle' : 'information-circle'} size={20} color="#fff" />
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        )}

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <LinearGradient colors={['#7B1FE8', '#4B0082']} style={styles.header}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={() => profile.avatar_url && setShowAvatarViewer(true)} activeOpacity={profile.avatar_url ? 0.8 : 1}>
              <Image source={profile.avatar_url ? { uri: profile.avatar_url } : require('./assets/default-avatar.png')} style={styles.avatar} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraBtn} onPress={pickAndUploadAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.headerName}>{profile.prenom} {profile.nom}</Text>
          <Text style={styles.headerSub}>Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</Text>
        </LinearGradient>

        {/* ── STATS ──────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <LinearGradient colors={['#10B981', '#34D399']} style={styles.statCard}>
            <Ionicons name="wallet-outline" size={26} color="#fff" />
            <Text style={styles.statValue}>{profile.solde_cfa.toLocaleString()}</Text>
            <Text style={styles.statLabel}>CFA</Text>
          </LinearGradient>
          <LinearGradient colors={['#FFD700', '#FF8C00']} style={styles.statCard}>
            <Ionicons name="trophy-outline" size={26} color="#fff" />
            <Text style={styles.statValue}>{profile.trophies_count}</Text>
            <Text style={styles.statLabel}>Trophées</Text>
          </LinearGradient>
        </View>

        {/* ── INFORMATIONS PERSONNELLES ───────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>
            {!editMode && (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)}>
                <Ionicons name="pencil-outline" size={16} color="#7B1FE8" />
                <Text style={styles.editBtnText}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {!editMode ? (
            <View style={styles.card}>
              <InfoRow icon="person-outline"   label="Nom"    value={profile.nom} />
              <Separator />
              <InfoRow icon="person-outline"   label="Prénom" value={profile.prenom} />
              <Separator />
              <InfoRow icon="calendar-outline" label="Date de naissance" value={profile.date_naissance ? formatDateReadable(profile.date_naissance) : '—'} />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Nom</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#999" style={styles.inputIcon} />
                <TextInput style={styles.input} value={nom} onChangeText={setNom} placeholder="Votre nom" placeholderTextColor="#bbb" autoCapitalize="words" />
              </View>
              <Text style={styles.fieldLabel}>Prénom</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#999" style={styles.inputIcon} />
                <TextInput style={styles.input} value={prenom} onChangeText={setPrenom} placeholder="Votre prénom" placeholderTextColor="#bbb" autoCapitalize="words" />
              </View>
              <Text style={styles.fieldLabel}>Date de naissance</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#999" style={styles.inputIcon} />
                  <input type="date" value={dateNaissanceWeb} onChange={e => setDateNaissanceWeb(e.target.value)}
                    max={new Date().toISOString().split('T')[0]} min="1900-01-01"
                    style={{ flex: 1, padding: 12, fontSize: 15, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#333' }} />
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={18} color="#999" style={styles.inputIcon} />
                    <Text style={[styles.input, { paddingVertical: 14 }]}>{formatDateDisplay(dateNaissance)}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#bbb" />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker value={dateNaissance} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onDateChange} maximumDate={new Date()} minimumDate={new Date(1900, 0, 1)} />
                  )}
                </>
              )}
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditMode(false); setNom(profile.nom); setPrenom(profile.prenom); }}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── PUBLICATIONS ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Publications ({posts.length})</Text>
            <TouchableOpacity
              style={styles.newPostBtn}
              onPress={() => {
                if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreatePost(true);
              }}
            >
              <LinearGradient colors={['#FF0080', '#FF8C00']} style={styles.newPostGrad}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.newPostText}>Publier</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {loadingPosts ? (
            <View style={styles.postsLoading}>
              <ActivityIndicator size="small" color="#7B1FE8" />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="newspaper-outline" size={48} color="#DDD" />
              <Text style={styles.emptyPostsText}>Aucune publication</Text>
              <Text style={styles.emptyPostsSub}>Partagez votre première publication !</Text>
            </View>
          ) : (
            // ── Même appel PostCard que actu.tsx ──────────────────────────
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                userId={userId}
                onLike={handleLike}
                onShare={handleShare}
                onSave={handleSave}
                onOpenComments={handleOpenComments}
                onOpenLikers={handleOpenLikers}
                onOpenEdit={handleOpenEdit}
                onLongPress={handleLongPress}
              />
            ))
          )}
        </View>

      </ScrollView>

      {/* ── MODALS — même appel exact que actu.tsx ────────────────────────── */}
      <CommentsModal
        visible={showCommentsModal}
        postId={selectedPostForComments}
        userId={userId}
        onClose={() => { setShowCommentsModal(false); setSelectedPostForComments(null); }}
        onCommentAdded={() => { loadPosts(); }}
      />
      <LikersModal
        visible={showLikersModal}
        postId={selectedPostForLikers}
        onClose={() => { setShowLikersModal(false); setSelectedPostForLikers(null); }}
      />
      <EditPostModal
        visible={showEditModal}
        postId={selectedPostForEdit?.id || null}
        userId={userId}
        initialContent={selectedPostForEdit?.content || ''}
        onClose={() => { setShowEditModal(false); setSelectedPostForEdit(null); }}
        onPostUpdated={async () => { await loadPosts(); }}
      />

    </KeyboardAvoidingView>
  );
}

// ─── COMPOSANTS INTERNES ──────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}><Ionicons name={icon} size={20} color="#7B1FE8" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Separator() { return <View style={styles.separator} />; }

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingBottom: 100 },
  centered:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 20 },
  loadingText:   { marginTop: 16, fontSize: 16, color: '#666' },
  errorText:     { marginTop: 16, fontSize: 16, color: '#EF4444', textAlign: 'center' },
  retryButton:   { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#7B1FE8', borderRadius: 10 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  toast: { position: 'absolute', top: Platform.OS === 'ios' ? 55 : 15, left: 20, right: 20, zIndex: 100, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 10 },
  toast_success: { backgroundColor: '#10B981' },
  toast_error:   { backgroundColor: '#EF4444' },
  toast_info:    { backgroundColor: '#3B82F6' },
  toastText:     { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },

  header:        { paddingTop: Platform.OS === 'ios' ? 64 : 44, paddingBottom: 36, alignItems: 'center', position: 'relative' },
  logoutBtn:     { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, padding: 6 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar:        { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#fff', backgroundColor: '#E0E0E0' },
  cameraBtn:     { position: 'absolute', bottom: 2, right: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF8C00', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  headerName:    { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  headerSub:     { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  statsRow:  { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20, marginBottom: 8 },
  statCard:  { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },

  section:       { paddingHorizontal: 12, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 8 },
  sectionTitle:  { fontSize: 17, fontWeight: 'bold', color: '#2D0072' },
  editBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0E6FF', borderRadius: 20 },
  editBtnText:   { fontSize: 13, color: '#7B1FE8', fontWeight: '600' },
  newPostBtn:    {},
  newPostGrad:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newPostText:   { color: '#fff', fontSize: 13, fontWeight: '700' },

  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#7B1FE8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0E6FF', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  infoLabel:   { fontSize: 12, color: '#999', marginBottom: 2 },
  infoValue:   { fontSize: 15, fontWeight: '600', color: '#222' },
  separator:   { height: 1, backgroundColor: '#F5F0FF', marginLeft: 54 },

  fieldLabel:      { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 12 },
  inputContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F5FF', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E8D5FF' },
  inputIcon:       { marginRight: 8 },
  input:           { flex: 1, paddingVertical: 13, fontSize: 15, color: '#333' },
  editActions:     { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0D0FF', alignItems: 'center' },
  cancelBtnText:   { fontSize: 15, color: '#7B1FE8', fontWeight: '600' },
  saveBtn:         { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#7B1FE8', alignItems: 'center' },
  saveBtnText:     { fontSize: 15, color: '#fff', fontWeight: 'bold' },

  // Posts
  postsLoading:    { paddingVertical: 30, alignItems: 'center' },
  emptyPosts:      { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyPostsText:  { fontSize: 16, color: '#999', fontWeight: '600' },
  emptyPostsSub:   { fontSize: 13, color: '#bbb' },

  // PostCard — même styles que actu.tsx
  postCard:          { backgroundColor: '#fff', marginHorizontal: 0, marginVertical: 6, borderRadius: 14, paddingVertical: 14 },
  postHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  postAuthor:        { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  postAvatar:        { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  avatarText:        { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  authorName:        { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  postTime:          { fontSize: 12, color: '#999', marginTop: 1 },
  postContent:       { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 14, marginBottom: 10 },
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

  // Viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerClose:   { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  viewerImage:   { width: '100%', height: '80%' },

  // Modal créer post
  createPostOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  createPostCard:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  createPostHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  createPostTitle:      { fontSize: 18, fontWeight: 'bold', color: '#2D0072' },
  createPostAuthorRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  createPostAvatar:     { width: 44, height: 44, borderRadius: 22 },
  createPostAuthorName: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 6 },
  visibilityRow:        { flexDirection: 'row', gap: 6 },
  visibilityBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  visibilityBtnActive:  { backgroundColor: '#7B1FE8', borderColor: '#7B1FE8' },
  visibilityText:       { fontSize: 11, color: '#666', fontWeight: '600' },
  visibilityTextActive: { color: '#fff' },
  createPostInput:      { fontSize: 16, color: '#333', minHeight: 100, textAlignVertical: 'top', paddingVertical: 12, marginBottom: 8 },
  charCount:            { fontSize: 12, color: '#bbb', textAlign: 'right', marginBottom: 16 },
  publishBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7B1FE8', borderRadius: 14, paddingVertical: 16 },
  publishBtnDisabled:   { backgroundColor: '#C4B5FD' },
  publishBtnText:       { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal détails
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: '85%', maxWidth: 400 },
  modalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInfo:    { marginBottom: 12 },
  modalLabel:   { fontSize: 12, color: '#999', marginBottom: 3 },
  modalValue:   { fontSize: 14, color: '#333', fontWeight: '600' },
  modalBtn:     { backgroundColor: '#8A2BE2', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
