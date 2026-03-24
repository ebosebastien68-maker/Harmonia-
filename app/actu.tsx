import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, RefreshControl, Modal, Dimensions, Platform,
  Animated, FlatList, StatusBar, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import HarmoniaLogo      from '../components/HarmoniaLogo';
import CommentsModal     from '../components/CommentsModal';
import LikersModal       from '../components/LikersModal';
import EditPostModal     from '../components/EditPostModal';
import SavedPostsModal   from '../components/SavedPostsModal';
import SearchModal       from '../components/SearchModal';
import LogoutModal       from '../components/LogoutModal';
import UserProfileView   from '../components/UserProfileView';
import { initPush }      from './push';
import PushPromptModal   from '../components/PushPromptModal';

const { width, height } = Dimensions.get('window');

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const HOME_URL    = `${BACKEND_URL}/home`;
const PROFILE_URL = `${BACKEND_URL}/profile`;

const HEADER_HEIGHT  = 75;
const NATIVE         = Platform.OS !== 'web';

const FILTER_OVERLAY_TOP = Platform.OS === 'ios' ? 110 : 90;
const HEADER_PADDING_TOP = Platform.OS === 'ios' ? 50  : 30;
const TIK_CLOSE_TOP      = Platform.OS === 'ios' ? 54  : 30;
const AUD_CLOSE_TOP      = Platform.OS === 'ios' ? 54  : 30;

type FilterMode  = 'all' | 'posts' | 'images' | 'videos' | 'music';
type GameType    = 'arts' | 'performance' | 'music' | 'artisanat';
type Visibility  = 'public' | 'friends' | 'private';
type ToastType   = 'success' | 'error' | 'info';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Post {
  item_type:  'post';
  id:         string;
  author_id:  string;
  author:     { nom: string; prenom: string; avatar_url: string | null };
  content:    string;
  visibility: string;
  created_at: string;
  imagepots?: string | null;
  vidposts?:  string | null;
  reactions:  { likes: number; comments: number; shares: number };
  user_liked?:  boolean;
  user_shared?: boolean;
  user_saved?:  boolean;
}

interface SubmissionMedia { id: string; url: string; description?: string | null }

interface Submission {
  item_type:   'submission';
  game_type:   GameType;
  badge:       string;
  id:          string;
  run_id:      string;
  session_id:  string;
  user_id:     string;
  run_number:  number;
  run_title:   string;
  author:      { nom: string; prenom: string; avatar_url: string | null };
  media:       SubmissionMedia[];
  total_votes: number;
  user_voted:  boolean;
  created_at:  string;
}

type FeedItem = Post | Submission;

interface UserProfile { solde_cfa: number; trophies_count: number }

interface MyProfile {
  id:        string;
  nom:       string;
  prenom:    string;
  avatar_url?: string;
  role:      string;
}

interface VideoFeedItem {
  mediaId: string; videoUrl: string; description: string | null;
  author: { nom: string; prenom: string; avatar_url: string | null };
  run_number: number; run_title: string; session_id: string;
  total_votes: number; user_voted: boolean; game_type: GameType; run_id: string; user_id: string;
}

interface AudioFeedItem {
  mediaId: string; audioUrl: string; description: string | null;
  author: { nom: string; prenom: string; avatar_url: string | null };
  run_number: number; run_title: string; session_id: string;
  total_votes: number; user_voted: boolean; game_type: GameType; run_id: string; user_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTimeAgo = (dateString: string) => {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
};

const getInitials = (nom: string, prenom: string) =>
  `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

// ─── URI → Blob ───────────────────────────────────────────────────────────────
const uriToBlob = (uri: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    if (Platform.OS === 'web') {
      fetch(uri).then(r => r.blob()).then(resolve).catch(reject);
    } else {
      const xhr = new XMLHttpRequest();
      xhr.onload  = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Blob échoué'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    }
  });

// ─── Upload direct Supabase Storage ──────────────────────────────────────────
// Content-Type lu depuis blob.type — aucun type codé en dur, tous formats acceptés.
const uploadToStorage = async (signedUrl: string, uri: string): Promise<void> => {
  const blob        = await uriToBlob(uri);
  const contentType = blob.type || 'application/octet-stream';
  const uploadRes   = await fetch(signedUrl, {
    method:  'PUT',
    headers: { 'Content-Type': contentType },
    body:    blob,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Échec upload Supabase Storage (${uploadRes.status}) ${errText}`);
  }
};

// ─── getValidToken ────────────────────────────────────────────────────────────
async function getValidToken(): Promise<{ uid: string; token: string; refresh_token: string; expires_at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem('harmonia_session');
    if (!raw) return null;
    const session      = JSON.parse(raw);
    const uid          = session?.user?.id      || '';
    const accessToken  = session?.access_token  || '';
    const refreshToken = session?.refresh_token || '';
    const expiresAt    = session?.expires_at    || 0;
    if (!uid || !accessToken) return null;

    const now = Math.floor(Date.now() / 1000);
    if (expiresAt - now > 60) return { uid, token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };
    if (!refreshToken) return null;

    const res = await fetch(`${BACKEND_URL}/refresh-token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data           = await res.json();
    const updatedSession = { ...session, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
    await AsyncStorage.setItem('harmonia_session', JSON.stringify(updatedSession));
    return { uid, token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
  } catch { return null; }
}

// ─── MediaViewer — fullscreen image ou vidéo ─────────────────────────────────
// Clic sur le contenu → ferme le viewer (toggle).
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
        {/* Bouton fermer */}
        <TouchableOpacity style={mvStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        {type === 'image' ? (
          // Clic sur l'image → ferme le viewer
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={mvStyles.imageWrapper}>
            <Image source={{ uri: url }} style={mvStyles.image} resizeMode="contain" />
          </TouchableOpacity>
        ) : Platform.OS === 'web' ? (
          // @ts-ignore — élément HTML natif, web uniquement
          <video
            src={url}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '90%', objectFit: 'contain', backgroundColor: '#000' }}
          />
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
  imageWrapper: { width: width, height: height * 0.85, justifyContent: 'center', alignItems: 'center' },
  image:        { width: width, height: height * 0.85 },
  videoNative:  { justifyContent: 'center', alignItems: 'center', gap: 16 },
  videoHint:    { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
});

// ─── PostCard ─────────────────────────────────────────────────────────────────
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
  onAuthorPress:  (authorId: string) => void;
}

const PostCard = React.memo(({
  post, userId,
  onLike, onShare, onSave,
  onOpenComments, onOpenLikers, onOpenEdit, onLongPress, onAuthorPress,
}: PostCardProps) => {
  const [liked,       setLiked]       = useState(post.user_liked  || false);
  const [shared,      setShared]      = useState(post.user_shared || false);
  const [saved,       setSaved]       = useState(post.user_saved  || false);
  const [likesCount,  setLikesCount]  = useState(post.reactions.likes);
  const [sharesCount, setSharesCount] = useState(post.reactions.shares);
  const [isAnim,      setIsAnim]      = useState(false);

  // Viewer fullscreen local au PostCard
  const [viewerUrl,  setViewerUrl]  = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<'image' | 'video'>('image');

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
    <>
      {/* Viewer fullscreen — clic sur le contenu ferme le modal */}
      <MediaViewer
        visible={!!viewerUrl}
        url={viewerUrl}
        type={viewerType}
        onClose={() => setViewerUrl(null)}
      />

      <TouchableOpacity style={styles.postCard} activeOpacity={0.98} onLongPress={() => onLongPress(post)}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postAuthor}
            onPress={() => { if (!isOwn) onAuthorPress(post.author_id); }}
            activeOpacity={isOwn ? 1 : 0.7}
          >
            {post.author.avatar_url
              ? <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{getInitials(post.author.nom, post.author.prenom)}</Text>
                </View>}
            <View>
              <Text style={styles.authorName}>{post.author.prenom} {post.author.nom}</Text>
              <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
            </View>
          </TouchableOpacity>
          {isOwn && (
            <TouchableOpacity onPress={() => onOpenEdit({ id: post.id, content: post.content })}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.postContent}>{post.content}</Text>

        {/* Image — clic → fullscreen, reclic → ferme */}
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

        {/* Vidéo post — clic → fullscreen player, reclic → ferme */}
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
      </TouchableOpacity>
    </>
  );
});

// ─── SubmissionCard ───────────────────────────────────────────────────────────
interface SubmissionCardProps {
  sub:            Submission;
  allVideoItems:  VideoFeedItem[];
  allAudioItems:  AudioFeedItem[];
  onVote:         (gameType: GameType, runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => Promise<void>;
  openVideoModal: (items: VideoFeedItem[], startIndex: number) => void;
  openAudioModal: (items: AudioFeedItem[], startIndex: number) => void;
  onAuthorPress:  (authorId: string) => void;
}

const SubmissionCard = React.memo(({
  sub, onVote, allVideoItems, allAudioItems, openVideoModal, openAudioModal, onAuthorPress,
}: SubmissionCardProps) => {
  const [totalVotes,  setTotalVotes]  = useState(sub.total_votes);
  const [userVoted,   setUserVoted]   = useState(sub.user_voted);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVoting,    setIsVoting]    = useState(false);

  useEffect(() => { setTotalVotes(sub.total_votes); setUserVoted(sub.user_voted); }, [sub]);

  const isPerformance = sub.game_type === 'performance';
  const isArtisanat   = sub.game_type === 'artisanat';
  const isVideo       = isPerformance || isArtisanat;
  const isMusic       = sub.game_type === 'music';

  const media: SubmissionMedia[] = sub.media
    ?? ((sub as any).images ?? []).map((img: any) => ({ id: img.id, url: img.image_url, description: img.description ?? null }));

  const slideWidth = media.length > 1 ? width - 48 : width - 24;

  const handleVoteLocal = async () => {
    if (isVoting) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsVoting(true);
    const n = !userVoted; setUserVoted(n); setTotalVotes(p => n ? p + 1 : p - 1);
    try { await onVote(sub.game_type ?? 'arts', sub.run_id, sub.user_id, sub.session_id, userVoted); }
    catch { setUserVoted(!n); setTotalVotes(p => n ? p - 1 : p + 1); }
    finally { setIsVoting(false); }
  };

  const badgeBg    = isPerformance ? '#FFF3E0' : isArtisanat ? '#FFF8E1' : isMusic ? '#E8F5E9' : '#F0E6FF';
  const badgeColor = isPerformance ? '#E65100' : isArtisanat ? '#B45309' : isMusic ? '#2E7D32' : '#8E44AD';
  const badgeLabel = sub.badge ?? (isArtisanat ? '🪡 Artisanat' : '🎨 Arts');

  return (
    <View style={styles.subCard}>
      <View style={styles.subHeader}>
        <View style={[styles.artsBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.artsBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
        <TouchableOpacity style={styles.postAuthor} onPress={() => onAuthorPress(sub.user_id)} activeOpacity={0.7}>
          {sub.author.avatar_url
            ? <Image source={{ uri: sub.author.avatar_url }} style={styles.avatar} />
            : <View style={[styles.avatarPlaceholder, { backgroundColor: badgeColor }]}>
                <Text style={styles.avatarText}>{getInitials(sub.author.nom, sub.author.prenom)}</Text>
              </View>}
          <View>
            <Text style={styles.authorName}>{sub.author.prenom} {sub.author.nom}</Text>
            <Text style={styles.postTime}>Run #{sub.run_number} — {sub.run_title}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.totalVotesBadge}>
          <Ionicons name="heart" size={13} color="#E74C3C" />
          <Text style={styles.totalVotesText}>{totalVotes}</Text>
        </View>
      </View>

      <FlatList
        data={media} keyExtractor={item => item.id} horizontal
        pagingEnabled={media.length > 1} showsHorizontalScrollIndicator={false}
        style={styles.imagesList}
        onMomentumScrollEnd={e => { const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth); setActiveIndex(idx); }}
        renderItem={({ item, index }) => (
          <View style={[styles.imageSlide, { width: slideWidth }]}>
            {isMusic ? (
              <TouchableOpacity activeOpacity={0.9} style={styles.audioThumb}
                onPress={() => { const si = allAudioItems.findIndex(a => a.mediaId === item.id); openAudioModal(allAudioItems, si >= 0 ? si : 0); }}>
                <LinearGradient colors={['#1E0A3C', '#0D0B1A']} style={StyleSheet.absoluteFill} />
                <View style={styles.audioWave}><Ionicons name="musical-notes" size={52} color="rgba(168,85,247,0.75)" /></View>
                <View style={styles.audioPlayIcon}><Ionicons name="play" size={18} color="rgba(255,255,255,0.9)" /></View>
                <View style={styles.audioBadge}><Ionicons name="musical-notes" size={12} color="#FFF" /><Text style={styles.audioBadgeText}>Audio</Text></View>
              </TouchableOpacity>
            ) : isVideo ? (
              <TouchableOpacity activeOpacity={0.9} style={styles.videoThumbSub}
                onPress={() => { const si = allVideoItems.findIndex(v => v.mediaId === item.id); openVideoModal(allVideoItems, si >= 0 ? si : 0); }}>
                <Video source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} isLooping isMuted shouldPlay={activeIndex === index} />
                <View style={styles.videoPlayOverlay}><Ionicons name="expand-outline" size={22} color="rgba(255,255,255,0.85)" /></View>
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={12} color="#FFF" />
                  <Text style={styles.videoBadgeText}>{isArtisanat ? 'Artisanat' : 'Vidéo'}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Image source={{ uri: item.url }} style={styles.subImage} resizeMode="cover" />
            )}
            {media.length > 1 && <View style={styles.imageCounter}><Text style={styles.imageCounterText}>{index + 1}/{media.length}</Text></View>}
            {item.description ? <Text style={styles.imgDesc} numberOfLines={2}>{item.description}</Text> : null}
          </View>
        )}
      />

      {media.length > 1 && (
        <View style={styles.dots}>
          {media.map((_, i) => <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />)}
        </View>
      )}

      <TouchableOpacity style={[styles.voteBtn, userVoted && styles.voteBtnVoted]} onPress={handleVoteLocal} disabled={isVoting} activeOpacity={0.8}>
        {userVoted
          ? <><Text style={styles.voteBtnText}>Voté 💪</Text><Text style={styles.voteBtnCount}>{totalVotes}</Text></>
          : <><Ionicons name="heart-outline" size={16} color="#FFF" /><Text style={styles.voteBtnText}>Voter</Text><Text style={styles.voteBtnCount}>{totalVotes}</Text></>}
      </TouchableOpacity>
    </View>
  );
});

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function ActuScreen() {
  const router = useRouter();

  // Auth
  const [userId,      setUserId]      = useState('');
  const [accessToken, setAccessToken] = useState('');
  const userIdRef  = useRef('');
  const tokenRef   = useRef('');
  const filterRef  = useRef<FilterMode>('all');

  // Feed
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts,        setPosts]       = useState<Post[]>([]);
  const [submissions,  setSubmissions] = useState<Submission[]>([]);
  const [filterMode,   setFilterMode]  = useState<FilterMode>('all');
  const [showFilter,   setShowFilter]  = useState(false);
  const [refreshing,   setRefreshing]  = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: ToastType; text: string } | null>(null);
  const showToast = (type: ToastType, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Création de post
  const [showCreatePost,  setShowCreatePost]  = useState(false);
  const [postContent,     setPostContent]     = useState('');
  const [postVisibility,  setPostVisibility]  = useState<Visibility>('friends');
  const [postImageUrl,    setPostImageUrl]    = useState<string | null>(null);
  const [postVideoUrl,    setPostVideoUrl]    = useState<string | null>(null);
  const [creatingPost,    setCreatingPost]    = useState(false);
  const [uploadingMedia,  setUploadingMedia]  = useState(false);

  // Push
  const [pushDone,       setPushDone]       = useState(false);
  const [showPushBtn,    setShowPushBtn]     = useState(false);
  const [showPushPrompt, setShowPushPrompt]  = useState(false);

  // Modals
  const [selectedPost,            setSelectedPost]            = useState<Post | null>(null);
  const [showCommentsModal,       setShowCommentsModal]       = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);
  const [showLikersModal,         setShowLikersModal]         = useState(false);
  const [selectedPostForLikers,   setSelectedPostForLikers]   = useState<string | null>(null);
  const [showEditModal,           setShowEditModal]           = useState(false);
  const [selectedPostForEdit,     setSelectedPostForEdit]     = useState<{id: string; content: string} | null>(null);
  const [showSavedPostsModal,     setShowSavedPostsModal]     = useState(false);
  const [showSearchModal,         setShowSearchModal]         = useState(false);
  const [showLogoutModal,         setShowLogoutModal]         = useState(false);

  // UserProfileView
  const [selectedAuthorId,     setSelectedAuthorId]     = useState<string | null>(null);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);

  // Modal TikTok / Audio
  const [videoModal,      setVideoModal]      = useState(false);
  const [videoItems,      setVideoItems]      = useState<VideoFeedItem[]>([]);
  const [videoStartIndex, setVideoStartIndex] = useState(0);
  const [audioModal,      setAudioModal]      = useState(false);
  const [audioItems,      setAudioItems]      = useState<AudioFeedItem[]>([]);
  const [audioStartIndex, setAudioStartIndex] = useState(0);

  const openVideoModal = useCallback((items: VideoFeedItem[], startIndex: number) => { setVideoItems(items); setVideoStartIndex(startIndex); setVideoModal(true); }, []);
  const openAudioModal = useCallback((items: AudioFeedItem[], startIndex: number) => { setAudioItems(items); setAudioStartIndex(startIndex); setAudioModal(true); }, []);

  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastTap,       setLastTap]       = useState<number | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    getValidToken().then(t => {
      if (!t) return;
      userIdRef.current = t.uid;
      tokenRef.current  = t.token;
      setUserId(t.uid);
      setAccessToken(t.token);
    });
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) return;
    loadPosts();
    loadSubmissions();
    loadMyProfile();
  }, [userId, accessToken]);

  // Push
  useEffect(() => {
    if (!userId) return;
    const getAuth = async () => {
      const t = await getValidToken();
      if (!t) return null;
      return { user_id: t.uid, access_token: t.token };
    };
    checkPushSilent(getAuth).then(already => {
      if (already) setPushDone(true);
      else setTimeout(() => setShowPushPrompt(true), 1500);
    });
  }, [userId]);

  const checkPushSilent = async (getAuthFn: () => Promise<any>): Promise<boolean> => {
    try {
      const auth = await getAuthFn();
      if (!auth) return true;
      if (Platform.OS === 'web') {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return true;
        const reg = await navigator.serviceWorker.getRegistration('/service-worker.js').catch(() => null);
        if (reg) { const existing = await reg.pushManager.getSubscription(); if (existing) return true; }
      } else {
        const cached = await AsyncStorage.getItem('harmonia_push_mobile_registered');
        if (cached === 'true') return true;
      }
      const platform = Platform.OS === 'web' ? 'web' : 'mobile';
      const res = await fetch(`${BACKEND_URL}/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'checkSubscription', platform, ...auth }) }).catch(() => null);
      if (res?.ok) { const data = await res.json(); return data.subscribed === true; }
      return false;
    } catch { return false; }
  };

  const handleEnablePush = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPushPrompt(false); setShowPushBtn(false);
    const getAuthFn = async () => { const t = await getValidToken(); if (!t) return null; return { user_id: t.uid, access_token: t.token }; };
    try { await initPush(getAuthFn); setPushDone(true); } catch { setPushDone(true); }
  };

  const handleDismissPrompt = () => { setShowPushPrompt(false); setShowPushBtn(true); };

  // ─── Charge mon profil ────────────────────────────────────────────────────
  const loadMyProfile = useCallback(async () => {
    try {
      const session = await getValidToken();
      if (!session) return;
      const res  = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-profile', access_token: session.token }),
      });
      const data = await res.json();
      if (data.profile) setMyProfile(data.profile);
    } catch (err) { console.error('[loadMyProfile]', err); }
  }, []);

  // ─── Charge posts ─────────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    try {
      const session = await getValidToken();
      if (!session) return;
      tokenRef.current  = session.token;
      userIdRef.current = session.uid;
      const res = await fetch(HOME_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-feed', user_id: session.uid, access_token: session.token }),
      });
      if (res.status === 401) { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); return; }
      const data = await res.json();
      if (data.posts)   setPosts(data.posts.map((p: any) => ({ ...p, item_type: 'post' })));
      if (data.profile) setUserProfile(data.profile);
    } catch (err) { console.error('[loadPosts]', err); }
  }, []);

  // ─── Charge soumissions ───────────────────────────────────────────────────
  const loadSubmissions = useCallback(async () => {
    try {
      const session = await getValidToken();
      if (!session) return;
      const res = await fetch(`${BACKEND_URL}/feed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'getSubmissions', user_id: session.uid, access_token: session.token }),
      });
      if (res.status === 401) { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); return; }
      const data = await res.json();
      if (data.submissions) setSubmissions(data.submissions.map((s: any) => ({ ...s, item_type: 'submission' })));
    } catch (err) { console.error('[loadSubmissions]', err); }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (filterRef.current !== 'images' && filterRef.current !== 'videos' && filterRef.current !== 'music') await loadPosts();
    if (filterRef.current !== 'posts') await loadSubmissions();
    setRefreshing(false);
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    if (filterRef.current !== 'images' && filterRef.current !== 'videos' && filterRef.current !== 'music') await loadPosts();
    if (filterRef.current !== 'posts') await loadSubmissions();
    setIsRefreshing(false);
  };

  const applyFilter = async (mode: FilterMode) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    filterRef.current = mode; setFilterMode(mode); setShowFilter(false);
    if (mode === 'posts' || mode === 'all') await loadPosts();
    if (mode !== 'posts') await loadSubmissions();
  };

  // ─── Création de post — nouveau flux upload ───────────────────────────────
  //
  // 1. get-upload-url (context: 'image' | 'video') → signed_url + public_url
  // 2. uploadToStorage → PUT direct, Content-Type = blob.type (MIME réel)
  // 3. public_url stockée dans le state → intégrée à create-post ensuite
  //
  // Aucun type de fichier codé en dur. Tous formats acceptés.

  const handlePickMedia = async (mediaType: 'image' | 'video') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', 'Accès aux médias requis.'); return; }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    mediaType === 'video'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: mediaType === 'image',
      quality:       0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingMedia(true);
    try {
      const session = await getValidToken();
      if (!session) return;

      const context = mediaType === 'image' ? 'image' : 'video';

      // 1. Signed Upload URL + public_url depuis le serveur
      const urlRes  = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-upload-url', access_token: session.token, context }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      // 2. Upload direct — MIME lu depuis le Blob, aucun type imposé
      await uploadToStorage(urlData.signed_url, result.assets[0].uri);

      // 3. Stocker la public_url → envoyée dans create-post
      if (mediaType === 'image') setPostImageUrl(urlData.public_url);
      else                       setPostVideoUrl(urlData.public_url);

      showToast('success', `${mediaType === 'image' ? 'Image' : 'Vidéo'} ajoutée !`);
    } catch (err: any) {
      showToast('error', err.message || "Impossible d'ajouter le média");
    } finally { setUploadingMedia(false); }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) { showToast('error', 'Le contenu est obligatoire'); return; }
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreatingPost(true);
    try {
      const session = await getValidToken();
      if (!session) return;
      const res = await fetch(PROFILE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:       'create-post',
          access_token: session.token,
          content:      postContent.trim(),
          visibility:   postVisibility,
          imagepots:    postImageUrl  || undefined,
          vidposts:     postVideoUrl  || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPostContent(''); setPostVisibility('friends'); setPostImageUrl(null); setPostVideoUrl(null);
      setShowCreatePost(false);
      await loadPosts();
      showToast('success', 'Post publié !');
    } catch (err: any) { showToast('error', err.message || 'Impossible de publier'); }
    finally { setCreatingPost(false); }
  };

  // ─── Feed ─────────────────────────────────────────────────────────────────
  const displayedItems: FeedItem[] = (() => {
    if (filterMode === 'posts')  return posts;
    if (filterMode === 'images') return submissions.filter(s => s.game_type === 'arts');
    if (filterMode === 'videos') return submissions.filter(s => s.game_type === 'performance' || s.game_type === 'artisanat');
    if (filterMode === 'music')  return submissions.filter(s => s.game_type === 'music');
    return [...posts, ...submissions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  })();

  const allVideoItems: VideoFeedItem[] = displayedItems
    .filter((item): item is Submission => item.item_type === 'submission' && (item.game_type === 'performance' || item.game_type === 'artisanat'))
    .flatMap(sub => (sub.media ?? []).map(m => ({
      mediaId: m.id, videoUrl: m.url, description: m.description ?? null,
      author: sub.author, run_number: sub.run_number, run_title: sub.run_title,
      session_id: sub.session_id, total_votes: sub.total_votes, user_voted: sub.user_voted,
      game_type: sub.game_type, run_id: sub.run_id, user_id: sub.user_id,
    })));

  const allAudioItems: AudioFeedItem[] = displayedItems
    .filter((item): item is Submission => item.item_type === 'submission' && item.game_type === 'music')
    .flatMap(sub => (sub.media ?? []).map(m => ({
      mediaId: m.id, audioUrl: m.url, description: m.description ?? null,
      author: sub.author, run_number: sub.run_number, run_title: sub.run_title,
      session_id: sub.session_id, total_votes: sub.total_votes, user_voted: sub.user_voted,
      game_type: sub.game_type, run_id: sub.run_id, user_id: sub.user_id,
    })));

  // ─── Post actions ─────────────────────────────────────────────────────────
  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    const session = await getValidToken();
    if (!session) return;
    const res  = await fetch(HOME_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: liked ? 'like-post' : 'unlike-post', user_id: session.uid, post_id: postId }) });
    const data = await res.json();
    if (data.success) setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: { ...p.reactions, likes: data.likes }, user_liked: liked } : p));
  }, []);

  const handleShare = useCallback(async (postId: string, shared: boolean) => {
    const session = await getValidToken();
    if (!session) return;
    const res  = await fetch(HOME_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: shared ? 'share-post' : 'unshare-post', user_id: session.uid, post_id: postId }) });
    const data = await res.json();
    if (data.success) setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: { ...p.reactions, shares: data.shares }, user_shared: shared } : p));
  }, []);

  const handleSave = useCallback(async (postId: string, saved: boolean) => {
    const session = await getValidToken();
    if (!session) return;
    const res  = await fetch(HOME_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: saved ? 'save-post' : 'unsave-post', user_id: session.uid, post_id: postId }) });
    const data = await res.json();
    if (data.success) setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_saved: saved } : p));
  }, []);

  const handleVote = useCallback(async (gameType: GameType, runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => {
    try {
      const session = await getValidToken();
      if (!session) return;
      const res = await fetch(`${BACKEND_URL}/feed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: currentlyVoted ? 'unvoteSubmission' : 'voteSubmission',
          user_id: session.uid, access_token: session.token,
          refresh_token: session.refresh_token, expires_at: session.expires_at,
          game_type: gameType, run_id: runId, vote_for_user_id: voteForUserId, session_id: sessionId,
        }),
      });
      if (res.status === 401) { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); return; }
      const data = await res.json();
      if (data.new_token) {
        const raw = await AsyncStorage.getItem('harmonia_session');
        if (raw) await AsyncStorage.setItem('harmonia_session', JSON.stringify({ ...JSON.parse(raw), ...data.new_token }));
      }
      if (!data.success) throw new Error(data.error);
    } catch (err) { console.error('[handleVote]', err); }
  }, []);

  const handleOpenComments = useCallback((postId: string) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPostForComments(postId); setShowCommentsModal(true);
  }, []);

  const handleOpenLikers = useCallback((postId: string) => {
    setSelectedPostForLikers(postId); setShowLikersModal(true);
  }, []);

  const handleOpenEdit = useCallback((post: { id: string; content: string }) => {
    setSelectedPostForEdit(post); setShowEditModal(true);
  }, []);

  const handleLongPress = useCallback((post: Post) => { setSelectedPost(post); }, []);

  const handleAuthorPress = useCallback((authorId: string) => {
    if (!authorId || authorId === userId) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAuthorId(authorId);
    setShowUserProfileModal(true);
  }, [userId]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap && now - lastTap < 300) toggleHeader();
    else setLastTap(now);
  };

  const toggleHeader = () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(headerAnim, { toValue: headerVisible ? -HEADER_HEIGHT : 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    setHeaderVisible(!headerVisible);
  };

  const filterLabel: Record<FilterMode, string> = {
    all: 'Tout', posts: 'Publications', images: 'Images', videos: 'Vidéos', music: 'Musique',
  };

  const isPro = myProfile?.role === 'userpro';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>

        {/* ── TOAST ─────────────────────────────────────────────────────── */}
        {toast && (
          <View style={[styles.toast, styles[`toast_${toast.type}` as keyof typeof styles] as any]}>
            <Ionicons name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'close-circle' : 'information-circle'} size={20} color="#fff" />
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        )}

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerAnim }] }]}>
          <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
            <View style={styles.headerTop}>
              <HarmoniaLogo size={26} showText={true} />
              <View style={styles.balanceBox}>
                <Ionicons name="wallet-outline" size={14} color="#FFD700" />
                <Text style={styles.balanceText}>{userProfile?.solde_cfa?.toLocaleString() || '0'} CFA</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.filterBtn} onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilter(true); }}>
                <Ionicons name="filter" size={16} color="#FFD700" />
                <Text style={styles.filterBtnText}>{filterLabel[filterMode]}</Text>
              </TouchableOpacity>

              <View style={styles.actionsBtns}>
                <TouchableOpacity onPress={handleManualRefresh} disabled={isRefreshing}>
                  <Ionicons name="refresh-outline" size={22} color={isRefreshing ? 'rgba(255,255,255,0.4)' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSearchModal(true); }}>
                  <Ionicons name="search-outline" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreatePost(true); }}>
                  <LinearGradient colors={['#FFD700','#FF0080']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.createBtnGrad}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                {Platform.OS === 'web' && showPushBtn && !pushDone && (
                  <TouchableOpacity onPress={handleEnablePush} style={styles.pushEnableBtn}>
                    <Ionicons name="notifications-circle" size={24} color="#FFD700" />
                    <View style={styles.pushEnableDot} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/notifications'); }}>
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSavedPostsModal(true); }}>
                  <Ionicons name="arrow-down-circle-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowLogoutModal(true); }}>
                  <Ionicons name="log-out-outline" size={22} color="#FFD700" />
                </TouchableOpacity>
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

        {/* ── FEED ──────────────────────────────────────────────────────── */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          onTouchEnd={handleDoubleTap}
        >
          {displayedItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="newspaper-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>Connexion en cours...</Text>
              <Text style={styles.emptySub}>Veuillez patienter</Text>
            </View>
          ) : (
            <View style={styles.feedList}>
              {displayedItems.map(item =>
                item.item_type === 'post'
                  ? <PostCard
                      key={item.id} post={item} userId={userId}
                      onLike={handleLike} onShare={handleShare} onSave={handleSave}
                      onOpenComments={handleOpenComments} onOpenLikers={handleOpenLikers}
                      onOpenEdit={handleOpenEdit} onLongPress={handleLongPress}
                      onAuthorPress={handleAuthorPress}
                    />
                  : <SubmissionCard
                      key={item.id} sub={item} onVote={handleVote}
                      allVideoItems={allVideoItems} allAudioItems={allAudioItems}
                      openVideoModal={openVideoModal} openAudioModal={openAudioModal}
                      onAuthorPress={handleAuthorPress}
                    />
              )}
            </View>
          )}
        </ScrollView>

        {/* ── MODAL FILTRE ──────────────────────────────────────────────── */}
        <Modal visible={showFilter} transparent animationType="fade" onRequestClose={() => setShowFilter(false)}>
          <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilter(false)}>
            <View style={styles.filterMenu}>
              <Text style={styles.filterMenuTitle}>Afficher</Text>
              {([
                { key: 'all',    label: 'Tout',         icon: 'apps-outline' },
                { key: 'posts',  label: 'Publications', icon: 'document-text-outline' },
                { key: 'images', label: 'Images',       icon: 'images-outline' },
                { key: 'videos', label: 'Vidéos',       icon: 'videocam-outline' },
                { key: 'music',  label: 'Musique',      icon: 'musical-notes-outline' },
              ] as { key: FilterMode; label: string; icon: string }[]).map(opt => (
                <TouchableOpacity key={opt.key} style={[styles.filterOption, filterMode === opt.key && styles.filterOptionActive]} onPress={() => applyFilter(opt.key)}>
                  <Ionicons name={opt.icon as any} size={20} color={filterMode === opt.key ? '#8A2BE2' : '#666'} />
                  <Text style={[styles.filterOptionText, filterMode === opt.key && styles.filterOptionTextActive]}>{opt.label}</Text>
                  {filterMode === opt.key && <Ionicons name="checkmark" size={18} color="#8A2BE2" />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── MODAL CRÉER POST ──────────────────────────────────────────── */}
        <Modal visible={showCreatePost} transparent animationType="slide" onRequestClose={() => setShowCreatePost(false)}>
          <View style={styles.cpOverlay}>
            <View style={styles.cpCard}>
              <View style={styles.cpHeader}>
                <Text style={styles.cpTitle}>Nouvelle publication</Text>
                <TouchableOpacity onPress={() => { setShowCreatePost(false); setPostImageUrl(null); setPostVideoUrl(null); setPostContent(''); }}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.cpAuthorRow}>
                {myProfile?.avatar_url
                  ? <Image source={{ uri: myProfile.avatar_url }} style={styles.cpAvatar} />
                  : <View style={[styles.cpAvatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {myProfile ? getInitials(myProfile.nom, myProfile.prenom) : '?'}
                      </Text>
                    </View>}
                <View>
                  <Text style={styles.cpAuthorName}>
                    {myProfile ? `${myProfile.prenom} ${myProfile.nom}` : '…'}
                  </Text>
                  {isPro && (
                    <View style={styles.cpProBadge}>
                      <Text style={styles.cpProBadgeText}>⭐ PRO</Text>
                    </View>
                  )}
                  <View style={styles.cpVisibilityRow}>
                    {(['public', 'friends', 'private'] as Visibility[]).map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.cpVisibilityBtn, postVisibility === v && styles.cpVisibilityBtnActive]}
                        onPress={() => setPostVisibility(v)}
                      >
                        <Ionicons
                          name={v === 'public' ? 'globe-outline' : v === 'friends' ? 'people-outline' : 'lock-closed-outline'}
                          size={12}
                          color={postVisibility === v ? '#fff' : '#666'}
                        />
                        <Text style={[styles.cpVisibilityText, postVisibility === v && styles.cpVisibilityTextActive]}>
                          {v === 'public' ? 'Public' : v === 'friends' ? 'Amis' : 'Privé'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <TextInput
                style={styles.cpInput}
                placeholder="Quoi de neuf ?"
                placeholderTextColor="#bbb"
                value={postContent}
                onChangeText={setPostContent}
                multiline
                maxLength={1000}
                autoFocus
              />
              <Text style={styles.cpCharCount}>{postContent.length}/1000</Text>

              {postImageUrl && (
                <View style={styles.cpMediaContainer}>
                  <Image source={{ uri: postImageUrl }} style={styles.cpMediaPreview} resizeMode="cover" />
                  <TouchableOpacity style={styles.cpMediaRemove} onPress={() => setPostImageUrl(null)}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {postVideoUrl && (
                <View style={styles.cpMediaContainer}>
                  <View style={[styles.cpMediaPreview, styles.cpVideoPreviewBg]}>
                    <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.cpVideoPreviewLabel}>Vidéo prête</Text>
                  </View>
                  <TouchableOpacity style={styles.cpMediaRemove} onPress={() => setPostVideoUrl(null)}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {isPro && !postImageUrl && !postVideoUrl && (
                <View style={styles.cpMediaButtons}>
                  <TouchableOpacity style={styles.cpMediaBtn} onPress={() => handlePickMedia('image')} disabled={uploadingMedia}>
                    {uploadingMedia
                      ? <ActivityIndicator size="small" color="#8A2BE2" />
                      : <><Ionicons name="image-outline" size={20} color="#8A2BE2" /><Text style={styles.cpMediaBtnText}>Photo</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cpMediaBtn} onPress={() => handlePickMedia('video')} disabled={uploadingMedia}>
                    {uploadingMedia
                      ? <ActivityIndicator size="small" color="#8A2BE2" />
                      : <><Ionicons name="videocam-outline" size={20} color="#8A2BE2" /><Text style={styles.cpMediaBtnText}>Vidéo</Text></>}
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.cpPublishBtn, !postContent.trim() && styles.cpPublishBtnDisabled]}
                onPress={handleCreatePost}
                disabled={creatingPost || !postContent.trim()}
                activeOpacity={0.8}
              >
                {creatingPost
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.cpPublishBtnText}>Publier</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── MODAL DÉTAILS POST ────────────────────────────────────────── */}
        {selectedPost && (
          <Modal visible={!!selectedPost} transparent animationType="fade" onRequestClose={() => setSelectedPost(null)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedPost(null)}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>📊 Détails</Text>
                <View style={styles.modalInfo}><Text style={styles.modalLabel}>Auteur :</Text><Text style={styles.modalValue}>{selectedPost.author.prenom} {selectedPost.author.nom}</Text></View>
                <View style={styles.modalInfo}><Text style={styles.modalLabel}>Publié :</Text><Text style={styles.modalValue}>{formatTimeAgo(selectedPost.created_at)}</Text></View>
                <View style={styles.modalInfo}><Text style={styles.modalLabel}>Réactions :</Text><Text style={styles.modalValue}>❤️ {selectedPost.reactions.likes} · 💬 {selectedPost.reactions.comments} · 🔄 {selectedPost.reactions.shares}</Text></View>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setSelectedPost(null)}><Text style={styles.modalBtnText}>Fermer</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* ── UserProfileView ───────────────────────────────────────────── */}
        {showUserProfileModal && selectedAuthorId && (
          <UserProfileView
            userId={selectedAuthorId}
            viewerId={userId}
            accessToken={accessToken}
            asModal
            onClose={() => { setShowUserProfileModal(false); setSelectedAuthorId(null); }}
          />
        )}

        <CommentsModal visible={showCommentsModal} postId={selectedPostForComments} userId={userId} onClose={() => { setShowCommentsModal(false); setSelectedPostForComments(null); }} onCommentAdded={() => { loadPosts(); }} />
        <LikersModal visible={showLikersModal} postId={selectedPostForLikers} onClose={() => { setShowLikersModal(false); setSelectedPostForLikers(null); }} />
        <EditPostModal visible={showEditModal} postId={selectedPostForEdit?.id || null} userId={userId} initialContent={selectedPostForEdit?.content || ''} onClose={() => { setShowEditModal(false); setSelectedPostForEdit(null); }} onPostUpdated={async () => { await loadPosts(); }} />
        <SavedPostsModal visible={showSavedPostsModal} userId={userId} onClose={() => setShowSavedPostsModal(false)} onCommentPress={(postId) => { setShowSavedPostsModal(false); setSelectedPostForComments(postId); setShowCommentsModal(true); }} />
        <SearchModal visible={showSearchModal} userId={userId} onClose={() => setShowSearchModal(false)} onPostPress={(postId) => { setSelectedPostForComments(postId); setShowCommentsModal(true); }} />
        <LogoutModal visible={showLogoutModal} userId={userId} onClose={() => setShowLogoutModal(false)} onLogoutSuccess={async () => { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); }} />

        <TikTokVideoModal visible={videoModal} items={videoItems} startIndex={videoStartIndex} onClose={() => setVideoModal(false)} onVote={handleVote} />
        <AudioFeedModal visible={audioModal} items={audioItems} startIndex={audioStartIndex} onClose={() => setAudioModal(false)} onVote={handleVote} />

        <PushPromptModal visible={showPushPrompt} onAccept={handleEnablePush} onDismiss={handleDismissPrompt} />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── TikTokVideoModal ─────────────────────────────────────────────────────────
interface TikTokVideoModalProps {
  visible: boolean; items: VideoFeedItem[]; startIndex: number;
  onClose: () => void;
  onVote: (gameType: GameType, runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => Promise<void>;
}

function TikTokVideoModal({ visible, items, startIndex, onClose, onVote }: TikTokVideoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const flatRef      = useRef<FlatList>(null);
  const webScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible || items.length === 0) return;
    setCurrentIndex(startIndex);
    if (Platform.OS === 'web') {
      setTimeout(() => { webScrollRef.current?.scrollTo({ y: startIndex * height, animated: false }); }, 50);
    } else {
      flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
    }
  }, [visible, startIndex]);

  if (!visible || items.length === 0) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={tikStyles.root}>
        <TouchableOpacity style={tikStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>

        {Platform.OS === 'web' ? (
          <ScrollView
            ref={webScrollRef}
            style={{ flex: 1 }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={1}
            onScroll={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.y / height);
              if (idx !== currentIndex) setCurrentIndex(idx);
            }}
          >
            {items.map((item, index) => (
              <View key={item.mediaId} style={{ width, height }}>
                <TikTokVideoItem item={item} isActive={index === currentIndex} onVote={onVote} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatRef}
            data={items}
            keyExtractor={item => item.mediaId}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            initialScrollIndex={startIndex}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.y / height);
              setCurrentIndex(idx);
            }}
            renderItem={({ item, index }) => (
              <TikTokVideoItem item={item} isActive={index === currentIndex} onVote={onVote} />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

function TikTokVideoItem({ item, isActive, onVote }: { item: VideoFeedItem; isActive: boolean; onVote: TikTokVideoModalProps['onVote'] }) {
  const [totalVotes, setTotalVotes] = useState(item.total_votes);
  const [userVoted,  setUserVoted]  = useState(item.user_voted);
  const [isVoting,   setIsVoting]   = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => { setTotalVotes(item.total_votes); setUserVoted(item.user_voted); }, [item]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) { videoRef.current.playAsync().catch(() => {}); }
    else          { videoRef.current.pauseAsync().catch(() => {}); }
  }, [isActive]);

  const handleVoteLocal = async () => {
    if (isVoting) return; if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsVoting(true);
    const n = !userVoted; setUserVoted(n); setTotalVotes(p => n ? p + 1 : p - 1);
    try { await onVote(item.game_type, item.run_id, item.user_id, item.session_id, userVoted); }
    catch { setUserVoted(!n); setTotalVotes(p => n ? p - 1 : p + 1); } finally { setIsVoting(false); }
  };

  return (
    <View style={tikStyles.item}>
      <Video ref={videoRef} source={{ uri: item.videoUrl }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} isLooping isMuted={false} shouldPlay={isActive} useNativeControls={false} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={tikStyles.gradient} />
      <View style={tikStyles.infoRow}>
        {item.author.avatar_url
          ? <Image source={{ uri: item.author.avatar_url }} style={tikStyles.avatar} />
          : <View style={[tikStyles.avatar, tikStyles.avatarFallback]}><Text style={tikStyles.avatarText}>{item.author.prenom.charAt(0)}{item.author.nom.charAt(0)}</Text></View>}
        <View style={tikStyles.infoText}>
          <Text style={tikStyles.authorName}>{item.author.prenom} {item.author.nom}</Text>
          <Text style={tikStyles.runLabel}>Run #{item.run_number} — {item.run_title}</Text>
          {item.description ? <Text style={tikStyles.desc} numberOfLines={2}>{item.description}</Text> : null}
        </View>
      </View>
      <TouchableOpacity style={[tikStyles.voteBtn, userVoted && tikStyles.voteBtnVoted]} onPress={handleVoteLocal} disabled={isVoting} activeOpacity={0.85}>
        <Ionicons name={userVoted ? 'heart' : 'heart-outline'} size={26} color={userVoted ? '#FF4D6A' : '#FFF'} />
        <Text style={tikStyles.voteCount}>{totalVotes}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── AudioFeedModal ───────────────────────────────────────────────────────────
interface AudioFeedModalProps {
  visible: boolean; items: AudioFeedItem[]; startIndex: number;
  onClose: () => void;
  onVote: (gameType: GameType, runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => Promise<void>;
}

function AudioFeedModal({ visible, items, startIndex, onClose, onVote }: AudioFeedModalProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const flatRef      = useRef<FlatList>(null);
  const webScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible || items.length === 0) return;
    setCurrentIndex(startIndex);
    if (Platform.OS === 'web') {
      setTimeout(() => { webScrollRef.current?.scrollTo({ y: startIndex * height, animated: false }); }, 50);
    } else {
      flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
    }
  }, [visible, startIndex]);

  if (!visible || items.length === 0) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={audStyles.root}>
        <TouchableOpacity style={audStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>

        {Platform.OS === 'web' ? (
          <ScrollView
            ref={webScrollRef}
            style={{ flex: 1 }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={1}
            onScroll={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.y / height);
              if (idx !== currentIndex) setCurrentIndex(idx);
            }}
          >
            {items.map((item, index) => (
              <View key={item.mediaId} style={{ width, height }}>
                <AudioFeedItem item={item} isActive={index === currentIndex} onVote={onVote} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatRef}
            data={items}
            keyExtractor={item => item.mediaId}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            initialScrollIndex={startIndex}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.y / height);
              setCurrentIndex(idx);
            }}
            renderItem={({ item, index }) => (
              <AudioFeedItem item={item} isActive={index === currentIndex} onVote={onVote} />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

function AudioFeedItem({ item, isActive, onVote }: { item: AudioFeedItem; isActive: boolean; onVote: AudioFeedModalProps['onVote'] }) {
  const [sound,      setSound]      = useState<Audio.Sound | null>(null);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isLoading,  setIsLoading]  = useState(false);
  const [totalVotes, setTotalVotes] = useState(item.total_votes);
  const [userVoted,  setUserVoted]  = useState(item.user_voted);
  const [isVoting,   setIsVoting]   = useState(false);
  useEffect(() => { setTotalVotes(item.total_votes); setUserVoted(item.user_voted); }, [item]);

  useEffect(() => {
    let snd: Audio.Sound | null = null;
    if (!isActive) { setSound(prev => { if (prev) prev.unloadAsync(); return null; }); setIsPlaying(false); setPositionMs(0); return; }
    async function loadAndPlay() {
      setIsLoading(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync({ uri: item.audioUrl }, { shouldPlay: true }, (status: any) => {
          if (status.isLoaded) { setIsPlaying(status.isPlaying ?? false); setPositionMs(status.positionMillis ?? 0); setDurationMs(status.durationMillis ?? 0); }
        });
        snd = s; setSound(s);
      } catch (e) { console.warn('[AudioFeedItem]', e); } finally { setIsLoading(false); }
    }
    loadAndPlay();
    return () => { snd?.unloadAsync(); };
  }, [isActive, item.audioUrl]);

  const togglePlay = async () => {
    if (!sound || isLoading) return; if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (isPlaying) { await sound.pauseAsync(); }
      else { if (durationMs > 0 && positionMs >= durationMs) { await sound.replayAsync(); } else { await sound.playAsync(); } }
    } catch (e) { console.warn(e); }
  };

  const handleVoteLocal = async () => {
    if (isVoting) return; if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsVoting(true);
    const n = !userVoted; setUserVoted(n); setTotalVotes(p => n ? p + 1 : p - 1);
    try { await onVote(item.game_type, item.run_id, item.user_id, item.session_id, userVoted); }
    catch { setUserVoted(!n); setTotalVotes(p => n ? p - 1 : p + 1); } finally { setIsVoting(false); }
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const fmtMs = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  return (
    <View style={audStyles.item}>
      <LinearGradient colors={['#1E0A3C', '#080810']} style={StyleSheet.absoluteFill} />
      <View style={audStyles.albumArt}><View style={audStyles.albumCircle}><Ionicons name="musical-notes" size={64} color="#A855F7" /></View></View>
      <View style={audStyles.trackInfo}>
        <Text style={audStyles.trackTitle}>{item.run_title}</Text>
        <Text style={audStyles.trackSub}>Run #{item.run_number}</Text>
        {item.description ? <Text style={audStyles.trackDesc} numberOfLines={2}>{item.description}</Text> : null}
      </View>
      <View style={audStyles.progressContainer}>
        <View style={audStyles.progressBg}><View style={[audStyles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} /></View>
        <View style={audStyles.timeRow}><Text style={audStyles.timeText}>{fmtMs(positionMs)}</Text><Text style={audStyles.timeText}>{fmtMs(durationMs)}</Text></View>
      </View>
      <TouchableOpacity style={audStyles.playBtn} onPress={togglePlay} disabled={isLoading}>
        {isLoading ? <ActivityIndicator size="large" color="#A855F7" /> : <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={72} color="#A855F7" />}
      </TouchableOpacity>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={audStyles.gradient} />
      <View style={audStyles.infoRow}>
        {item.author.avatar_url
          ? <Image source={{ uri: item.author.avatar_url }} style={audStyles.avatar} />
          : <View style={[audStyles.avatar, audStyles.avatarFallback]}><Text style={audStyles.avatarText}>{item.author.prenom.charAt(0)}{item.author.nom.charAt(0)}</Text></View>}
        <View style={audStyles.infoText}>
          <Text style={audStyles.authorName}>{item.author.prenom} {item.author.nom}</Text>
          <Text style={audStyles.runLabel}>Run #{item.run_number} — {item.run_title}</Text>
        </View>
      </View>
      <TouchableOpacity style={[audStyles.voteBtn, userVoted && audStyles.voteBtnVoted]} onPress={handleVoteLocal} disabled={isVoting} activeOpacity={0.85}>
        <Ionicons name={userVoted ? 'heart' : 'heart-outline'} size={26} color={userVoted ? '#FF4D6A' : '#FFF'} />
        <Text style={audStyles.voteCount}>{totalVotes}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── tikStyles ────────────────────────────────────────────────────────────────
const tikStyles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#000' },
  closeBtn:       { position: 'absolute', top: TIK_CLOSE_TOP, right: 16, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  item:           { width, height, backgroundColor: '#000' },
  gradient:       { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },
  infoRow:        { position: 'absolute', bottom: 60, left: 16, right: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  avatar:         { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },
  avatarFallback: { backgroundColor: '#E65100', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#FFF', fontWeight: '800', fontSize: 14 },
  infoText:       { flex: 1, gap: 3 },
  authorName:     { color: '#FFF', fontWeight: '800', fontSize: 15 },
  runLabel:       { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  desc:           { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  voteBtn:        { position: 'absolute', right: 16, bottom: 80, alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 12 },
  voteBtnVoted:   { backgroundColor: 'rgba(255,77,106,0.2)' },
  voteCount:      { color: '#FFF', fontSize: 13, fontWeight: '800' },
});

// ─── audStyles ────────────────────────────────────────────────────────────────
const audStyles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#080810' },
  closeBtn:          { position: 'absolute', top: AUD_CLOSE_TOP, right: 16, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  item:              { width, height, overflow: 'hidden' },
  albumArt:          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  albumCircle:       { width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 2, borderColor: 'rgba(168,85,247,0.3)', justifyContent: 'center', alignItems: 'center' },
  trackInfo:         { position: 'absolute', top: 80, left: 24, right: 24, alignItems: 'center' },
  trackTitle:        { color: '#FFF', fontWeight: '800', fontSize: 18, textAlign: 'center' },
  trackSub:          { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  trackDesc:         { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, textAlign: 'center' },
  progressContainer: { position: 'absolute', bottom: 230, left: 32, right: 32 },
  progressBg:        { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  progressFill:      { height: 4, backgroundColor: '#A855F7', borderRadius: 2 },
  timeRow:           { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText:          { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  playBtn:           { position: 'absolute', bottom: 160, left: 0, right: 0, alignItems: 'center' },
  gradient:          { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },
  infoRow:           { position: 'absolute', bottom: 60, left: 16, right: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  avatar:            { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },
  avatarFallback:    { backgroundColor: '#6200EA', alignItems: 'center', justifyContent: 'center' },
  avatarText:        { color: '#FFF', fontWeight: '800', fontSize: 14 },
  infoText:          { flex: 1, gap: 3 },
  authorName:        { color: '#FFF', fontWeight: '800', fontSize: 15 },
  runLabel:          { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  voteBtn:           { position: 'absolute', right: 16, bottom: 80, alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 12 },
  voteBtnVoted:      { backgroundColor: 'rgba(255,77,106,0.2)' },
  voteCount:         { color: '#FFF', fontSize: 13, fontWeight: '800' },
});

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  header:          { paddingTop: HEADER_PADDING_TOP, paddingBottom: 8, paddingHorizontal: 14 },
  headerTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  balanceText:     { color: '#FFD700', fontSize: 12, fontWeight: '800' },
  headerActions:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  filterBtnText:   { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  actionsBtns:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pushEnableBtn:   { position: 'relative' },
  pushEnableDot:   { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0080', borderWidth: 1.5, borderColor: '#4B0082' },
  createBtnGrad:   { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  doubleTapHint:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E6FF', paddingVertical: 6, gap: 4 },
  doubleTapText:   { fontSize: 11, color: '#8A2BE2', fontWeight: '600' },
  scrollView:      { flex: 1 },
  scrollContent:   { paddingTop: HEADER_HEIGHT + 20 },
  feedList:        { paddingVertical: 8, paddingBottom: 100 },
  emptyBox:        { alignItems: 'center', paddingVertical: 60 },
  emptyText:       { fontSize: 16, color: '#999', marginTop: 12 },
  emptySub:        { fontSize: 12, color: '#CCC', marginTop: 5 },

  toast:         { position: 'absolute', top: Platform.OS === 'ios' ? 55 : 15, left: 20, right: 20, zIndex: 2000, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 10 },
  toast_success: { backgroundColor: '#10B981' },
  toast_error:   { backgroundColor: '#EF4444' },
  toast_info:    { backgroundColor: '#3B82F6' },
  toastText:     { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },

  // PostCard
  postCard:          { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, paddingVertical: 14 },
  postHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  postAuthor:        { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatar:            { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  avatarText:        { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  authorName:        { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  postTime:          { fontSize: 12, color: '#999', marginTop: 1 },
  postContent:       { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 14, marginBottom: 10 },
  postImage:         { width: '100%', height: 240, marginBottom: 10 },
  mediaExpandHint:   { position: 'absolute', bottom: 18, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: 4 },
  videoThumb:        { width: '100%', height: 180, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', marginBottom: 10, gap: 6 },
  videoThumbLabel:   { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
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

  // SubmissionCard
  subCard:          { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, overflow: 'hidden' },
  subHeader:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  artsBadge:        { backgroundColor: '#F0E6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  artsBadgeText:    { color: '#8E44AD', fontSize: 11, fontWeight: '700' },
  totalVotesBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  totalVotesText:   { color: '#E74C3C', fontSize: 13, fontWeight: '700' },
  imagesList:       { flexGrow: 0 },
  imageSlide:       { paddingHorizontal: 12 },
  subImage:         { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#F0F0F0' },
  videoThumbSub:    { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  videoPlayOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, padding: 6 },
  videoBadge:       { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  videoBadgeText:   { color: '#FFF', fontSize: 11, fontWeight: '700' },
  audioThumb:       { width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  audioWave:        { alignItems: 'center', justifyContent: 'center' },
  audioPlayIcon:    { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, padding: 6 },
  audioBadge:       { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  audioBadgeText:   { color: '#FFF', fontSize: 11, fontWeight: '700' },
  imageCounter:     { position: 'absolute', top: 12, right: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  imageCounterText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  imgDesc:          { fontSize: 13, color: '#555', marginTop: 8, paddingHorizontal: 4 },
  voteBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#8A2BE2', borderRadius: 25, paddingVertical: 10, paddingHorizontal: 20, marginTop: 10, marginBottom: 14, marginHorizontal: 14, alignSelf: 'center' },
  voteBtnVoted:     { backgroundColor: '#E74C3C' },
  voteBtnText:      { color: '#FFF', fontWeight: '700', fontSize: 14 },
  voteBtnCount:     { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  dots:             { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },
  dotActive:        { backgroundColor: '#8A2BE2', width: 18, borderRadius: 3 },

  filterOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-start', paddingTop: FILTER_OVERLAY_TOP, paddingLeft: 14 },
  filterMenu:             { backgroundColor: '#FFF', borderRadius: 16, padding: 8, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  filterMenuTitle:        { color: '#999', fontSize: 11, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, textTransform: 'uppercase' },
  filterOption:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  filterOptionActive:     { backgroundColor: '#F0E6FF' },
  filterOptionText:       { flex: 1, fontSize: 14, color: '#333', fontWeight: '600' },
  filterOptionTextActive: { color: '#8A2BE2' },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent:  { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: width * 0.85, maxWidth: 400 },
  modalTitle:    { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInfo:     { marginBottom: 12 },
  modalLabel:    { fontSize: 12, color: '#999', marginBottom: 3 },
  modalValue:    { fontSize: 14, color: '#333', fontWeight: '600' },
  modalBtn:      { backgroundColor: '#8A2BE2', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  modalBtnText:  { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  cpOverlay:             { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  cpCard:                { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  cpHeader:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cpTitle:               { fontSize: 18, fontWeight: 'bold', color: '#2D0072' },
  cpAuthorRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  cpAvatar:              { width: 44, height: 44, borderRadius: 22 },
  cpAuthorName:          { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  cpProBadge:            { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6, alignSelf: 'flex-start' },
  cpProBadgeText:        { color: '#F59E0B', fontSize: 11, fontWeight: '700' },
  cpVisibilityRow:       { flexDirection: 'row', gap: 6 },
  cpVisibilityBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  cpVisibilityBtnActive: { backgroundColor: '#8A2BE2', borderColor: '#8A2BE2' },
  cpVisibilityText:      { fontSize: 11, color: '#666', fontWeight: '600' },
  cpVisibilityTextActive:{ color: '#fff' },
  cpInput:               { fontSize: 16, color: '#333', minHeight: 100, textAlignVertical: 'top', paddingVertical: 12, marginBottom: 8 },
  cpCharCount:           { fontSize: 12, color: '#bbb', textAlign: 'right', marginBottom: 12 },
  cpMediaButtons:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  cpMediaBtn:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0E6FF', borderRadius: 12 },
  cpMediaBtnText:        { fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  cpMediaContainer:      { position: 'relative', marginBottom: 12 },
  cpMediaPreview:        { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F0F0F0' },
  cpVideoPreviewBg:      { backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', gap: 8 },
  cpVideoPreviewLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  cpMediaRemove:         { position: 'absolute', top: 8, right: 8 },
  cpPublishBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8A2BE2', borderRadius: 14, paddingVertical: 16 },
  cpPublishBtnDisabled:  { backgroundColor: '#C4B5FD' },
  cpPublishBtnText:      { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
