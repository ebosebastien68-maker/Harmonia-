import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, RefreshControl, Modal, Dimensions, Platform,
  Animated, FlatList, StatusBar, SafeAreaView, ActivityIndicator,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Video, Audio, ResizeMode } from 'expo-av';
import HarmoniaLogo from '../components/HarmoniaLogo';
import CreatePostModal from '../components/CreatePostModal';
import CommentsModal from '../components/CommentsModal';
import LikersModal from '../components/LikersModal';
import EditPostModal from '../components/EditPostModal';
import SavedPostsModal from '../components/SavedPostsModal';
import SearchModal from '../components/SearchModal';
import LogoutModal from '../components/LogoutModal';

const { width, height } = Dimensions.get('window');
const BACKEND_URL    = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const API_BASE_HOME  = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/home';
const API_BASE_POSTS = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';
const HEADER_HEIGHT  = 75;
const NATIVE         = Platform.OS !== 'web';

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterMode = 'all' | 'posts' | 'images' | 'videos' | 'audios' | 'artisanat';

interface Post {
  item_type: 'post';
  id: string;
  author_id: string;
  author: { nom: string; prenom: string; avatar_url: string | null };
  content: string;
  created_at: string;
  reactions: { likes: number; comments: number; shares: number };
  user_liked?: boolean;
  user_shared?: boolean;
  user_saved?: boolean;
}

interface SubmissionMedia {
  id: string;
  url: string;               // image_url (Arts) ou video_url (Performance)
  description?: string | null;
}

interface Submission {
  item_type:   'submission';
  game_type:   'arts' | 'performance' | 'music' | 'artisanat';
  badge:       string;       // '🎨 Arts' | '🎭 Performance' | '🎵 Music'
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

// Item aplati pour le modal TikTok
interface VideoFeedItem {
  mediaId:     string;
  videoUrl:    string;
  description: string | null;
  author:      { nom: string; prenom: string; avatar_url: string | null };
  run_number:  number;
  run_title:   string;
  session_id:  string;
  total_votes: number;
  user_voted:  boolean;
  game_type:   'performance';  // TikTok modal uniquement pour les vidéos
  run_id:      string;
  user_id:     string;
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

// ─── getValidToken — même logique que arts.tsx ────────────────────────────────
// Vérifie expires_at AVANT la requête. Si le token expire dans < 60s → refresh préventif.
async function getValidToken(): Promise<{
  uid: string;
  token: string;
  refresh_token: string;
  expires_at: number;
} | null> {
  try {
    const raw = await AsyncStorage.getItem('harmonia_session');
    if (!raw) return null;
    const session = JSON.parse(raw);

    const uid          = session?.user?.id      || '';
    const accessToken  = session?.access_token  || '';
    const refreshToken = session?.refresh_token || '';
    const expiresAt    = session?.expires_at    || 0;

    if (!uid || !accessToken) return null;

    const now = Math.floor(Date.now() / 1000);

    // Token encore valide (> 60s restantes) → on le retourne directement
    if (expiresAt - now > 60) {
      return { uid, token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };
    }

    // Token expiré ou bientôt expiré → refresh préventif
    if (!refreshToken) return null;

    console.log('[ActuScreen] Token expiré, rafraîchissement…');
    const res = await fetch(`${BACKEND_URL}/refresh-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      console.warn('[ActuScreen] Rafraîchissement token échoué');
      return null;
    }

    const data = await res.json();
    const updatedSession = {
      ...session,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
    await AsyncStorage.setItem('harmonia_session', JSON.stringify(updatedSession));
    console.log('[ActuScreen] Token rafraîchi avec succès ✓');

    return {
      uid,
      token:         data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
  } catch (e) {
    console.warn('[ActuScreen] getValidToken error:', e);
    return null;
  }
}

// ─── MemoLogo — stable, ne re-render jamais ──────────────────────────────────
const MemoLogo = React.memo(() => <HarmoniaLogo size={26} showText={true} />, () => true);

// ─── Props types ──────────────────────────────────────────────────────────────
interface PostCardProps {
  post: Post;
  userId: string;
  onLike: (postId: string, liked: boolean) => Promise<void>;
  onShare: (postId: string, shared: boolean) => Promise<void>;
  onSave: (postId: string, saved: boolean) => Promise<void>;
  onOpenComments: (postId: string) => void;
  onOpenLikers: (postId: string) => void;
  onOpenEdit: (post: { id: string; content: string }) => void;
  onLongPress: (post: Post) => void;
}

interface SubmissionCardProps {
  sub:             Submission;
  allVideoItems:   VideoFeedItem[];
  onVote:          (gameType: 'arts' | 'performance' | 'music' | 'artisanat', runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => Promise<void>;
  openVideoModal:  (items: VideoFeedItem[], startIndex: number) => void;
}

// ─── PostCard ─────────────────────────────────────────────────────────────────
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
    setLiked(post.user_liked || false);
    setShared(post.user_shared || false);
    setSaved(post.user_saved || false);
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
            ? <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} />
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

// ─── AudioTrackCard ──────────────────────────────────────────────────────────
// Lecteur audio avec seekbar tactile + boutons -10s / +10s
function AudioTrackCard({ item, index, total }: { item: SubmissionMedia; index: number; total: number }) {
  const [sound,      setSound]      = useState<Audio.Sound | null>(null);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const soundRef    = useRef<Audio.Sound | null>(null);
  const barWidthRef = useRef(0);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // Seek à une position ratio 0–1
  const seekToRatio = useCallback(async (ratio: number) => {
    const s = soundRef.current;
    if (!s) return;
    const status = await s.getStatusAsync();
    if (!status.isLoaded || !status.durationMillis) return;
    const newPos = Math.max(0, Math.min(Math.floor(ratio * status.durationMillis), status.durationMillis));
    await s.setPositionAsync(newPos);
    setPositionMs(newPos);
  }, []);

  // Skip ±10 secondes
  const skip = useCallback(async (deltaMs: number) => {
    const s = soundRef.current;
    if (!s) return;
    const status = await s.getStatusAsync();
    if (!status.isLoaded) return;
    const dur = status.durationMillis ?? 0;
    const newPos = Math.max(0, Math.min((status.positionMillis ?? 0) + deltaMs, dur));
    await s.setPositionAsync(newPos);
    setPositionMs(newPos);
  }, []);

  // PanResponder sur la seekbar
  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const x = Math.max(0, Math.min(e.nativeEvent.locationX, barWidthRef.current));
        seekToRatio(barWidthRef.current > 0 ? x / barWidthRef.current : 0);
      },
      onPanResponderMove: (e) => {
        const x = Math.max(0, Math.min(e.nativeEvent.locationX, barWidthRef.current));
        seekToRatio(barWidthRef.current > 0 ? x / barWidthRef.current : 0);
      },
    })
  ).current;

  const togglePlay = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (!soundRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: item.url },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setPositionMs(status.positionMillis ?? 0);
            setDurationMs(status.durationMillis ?? 0);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) { setIsPlaying(false); setPositionMs(0); }
          }
        );
        soundRef.current = newSound;
        setSound(newSound);
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          if ((status.positionMillis ?? 0) >= (status.durationMillis ?? 0) - 200) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.warn('[AudioTrackCard] Erreur lecture:', err);
      setIsLoading(false);
    }
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={styles.audioTrack}>
      {total > 1 && (
        <Text style={styles.audioTrackNum}>Piste {index + 1}/{total}</Text>
      )}
      {item.description ? (
        <Text style={styles.audioTrackDesc} numberOfLines={1}>{item.description}</Text>
      ) : null}

      {/* Seekbar tactile */}
      <View
        style={styles.audioSeekBar}
        onLayout={e => { barWidthRef.current = e.nativeEvent.layout.width; }}
        {...seekPan.panHandlers}
      >
        <View style={styles.audioSeekTrack} />
        <View style={[styles.audioSeekFill, { width: `${Math.round(progress * 100)}%` }]} />
        {/* Thumb */}
        <View style={[styles.audioSeekThumb, { left: `${Math.round(progress * 100)}%` as any }]} />
      </View>

      {/* Temps */}
      <View style={styles.audioTimings}>
        <Text style={styles.audioTime}>{formatMs(positionMs)}</Text>
        {durationMs > 0 && <Text style={styles.audioTime}>{formatMs(durationMs)}</Text>}
      </View>

      {/* Contrôles : -10s | play/pause | +10s */}
      <View style={styles.audioControls}>
        <TouchableOpacity style={styles.audioSkipBtn} onPress={() => skip(-10000)} disabled={!sound}>
          <Ionicons name="play-back" size={18} color={sound ? '#7C3AED' : '#CCC'} />
          <Text style={[styles.audioSkipText, !sound && { color: '#CCC' }]}>10</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.audioPlayBtn, isPlaying && styles.audioPlayBtnActive]}
          onPress={togglePlay}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="#7C3AED" />
            : <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color={isPlaying ? '#FFF' : '#7C3AED'}
              />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.audioSkipBtn} onPress={() => skip(10000)} disabled={!sound}>
          <Ionicons name="play-forward" size={18} color={sound ? '#7C3AED' : '#CCC'} />
          <Text style={[styles.audioSkipText, !sound && { color: '#CCC' }]}>10</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SubmissionCard ───────────────────────────────────────────────────────────
// Gère Arts (images), Performance (vidéos) et Music (audios) via sub.game_type
const SubmissionCard = React.memo(({ sub, onVote, allVideoItems, openVideoModal }: SubmissionCardProps) => {
  const [totalVotes,  setTotalVotes]  = useState(sub.total_votes);
  const [userVoted,   setUserVoted]   = useState(sub.user_voted);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVoting,    setIsVoting]    = useState(false);

  useEffect(() => {
    setTotalVotes(sub.total_votes);
    setUserVoted(sub.user_voted);
  }, [sub]);

  const isPerformance = sub.game_type === 'performance' || sub.game_type === 'artisanat';
  const isMusic       = sub.game_type === 'music';

  // Fallback : supporte l'ancien format (images[]) pendant la transition backend
  const media: SubmissionMedia[] = sub.media
    ?? ((sub as any).images ?? []).map((img: any) => ({
        id:          img.id,
        url:         img.image_url,
        description: img.description ?? null,
      }));

  const slideWidth = media.length > 1 ? width - 48 : width - 24;

  const handleVoteLocal = async () => {
    if (isVoting) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsVoting(true);
    const newVoted = !userVoted;
    setUserVoted(newVoted);
    setTotalVotes(p => newVoted ? p + 1 : p - 1);
    try {
      await onVote(sub.game_type ?? 'arts', sub.run_id, sub.user_id, sub.session_id, userVoted);
    } catch {
      setUserVoted(!newVoted);
      setTotalVotes(p => newVoted ? p - 1 : p + 1);
    } finally {
      setIsVoting(false);
    }
  };

  // Couleur du badge selon le jeu
  const isArtisanat   = sub.game_type === 'artisanat';
  const badgeBg    = isPerformance || isArtisanat ? '#FFF3E0' : isMusic ? '#EDE9FE' : '#F0E6FF';
  const badgeColor = isPerformance || isArtisanat ? '#E65100' : isMusic ? '#7C3AED' : '#8E44AD';
  // Badge label : fallback pour l'ancien format sans badge
  const badgeLabel = sub.badge ?? '🎨 Arts';

  return (
    <View style={styles.subCard}>

      {/* Header : badge + auteur + compteur votes */}
      <View style={styles.subHeader}>
        <View style={[styles.artsBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.artsBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
        <View style={styles.postAuthor}>
          {sub.author.avatar_url
            ? <Image source={{ uri: sub.author.avatar_url }} style={styles.avatar} />
            : <View style={[styles.avatarPlaceholder, { backgroundColor: badgeColor }]}>
                <Text style={styles.avatarText}>{getInitials(sub.author.nom, sub.author.prenom)}</Text>
              </View>}
          <View>
            <Text style={styles.authorName}>{sub.author.prenom} {sub.author.nom}</Text>
            <Text style={styles.postTime}>Run #{sub.run_number} — {sub.run_title}</Text>
          </View>
        </View>
        <View style={styles.totalVotesBadge}>
          <Ionicons name="heart" size={13} color="#E74C3C" />
          <Text style={styles.totalVotesText}>{totalVotes}</Text>
        </View>
      </View>

      {/* Music : lecteur audio (pas de carrousel) */}
      {isMusic ? (
        <View style={styles.musicList}>
          {media.map((item, index) => (
            <AudioTrackCard
              key={item.id}
              item={item}
              index={index}
              total={media.length}
            />
          ))}
        </View>
      ) : (
        /* Carrousel — Image (Arts) ou Vidéo (Performance) */
        <FlatList
          data={media}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled={media.length > 1}
          showsHorizontalScrollIndicator={false}
          style={styles.imagesList}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
            setActiveIndex(idx);
          }}
          renderItem={({ item, index }) => (
            <View style={[styles.imageSlide, { width: slideWidth }]}>
              {isPerformance ? (
                /* Performance : lecteur vidéo inline + tap → modal TikTok */
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.videoThumb}
                  onPress={() => {
                    const startIdx = allVideoItems.findIndex(v => v.mediaId === item.id);
                    openVideoModal(allVideoItems, startIdx >= 0 ? startIdx : 0);
                  }}
                >
                  <Video
                    source={{ uri: item.url }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={ResizeMode.COVER}
                    isLooping
                    isMuted
                    shouldPlay={activeIndex === index}
                  />
                  {/* Overlay play */}
                  <View style={styles.videoPlayOverlay}>
                    <Ionicons name="expand-outline" size={22} color="rgba(255,255,255,0.85)" />
                  </View>
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={12} color="#FFF" />
                    <Text style={styles.videoBadgeText}>Vidéo</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                /* Arts : image normale */
                <Image source={{ uri: item.url }} style={styles.subImage} resizeMode="cover" />
              )}
              {media.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>{index + 1}/{media.length}</Text>
                </View>
              )}
              {item.description
                ? <Text style={styles.imgDesc} numberOfLines={2}>{item.description}</Text>
                : null}
            </View>
          )}
        />
      )}

      {media.length > 1 && (
        <View style={styles.dots}>
          {media.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Bouton vote unique au niveau du run */}
      <TouchableOpacity
        style={[styles.voteBtn, userVoted && styles.voteBtnVoted]}
        onPress={handleVoteLocal}
        disabled={isVoting}
        activeOpacity={0.8}
      >
        {userVoted
          ? <><Text style={styles.voteBtnText}>Voté 💪</Text><Text style={styles.voteBtnCount}>{totalVotes}</Text></>
          : <><Ionicons name="heart-outline" size={16} color="#FFF" /><Text style={styles.voteBtnText}>Voter</Text><Text style={styles.voteBtnCount}>{totalVotes}</Text></>}
      </TouchableOpacity>

    </View>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ActuScreen() {
  const router = useRouter();

  const [userId,      setUserId]      = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [posts,       setPosts]       = useState<Post[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filterMode,  setFilterMode]  = useState<FilterMode>('all');
  const [showFilter,  setShowFilter]  = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedPost,            setSelectedPost]            = useState<Post | null>(null);
  const [showCreateModal,         setShowCreateModal]         = useState(false);
  const [showCommentsModal,       setShowCommentsModal]       = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);
  const [showLikersModal,         setShowLikersModal]         = useState(false);
  const [selectedPostForLikers,   setSelectedPostForLikers]   = useState<string | null>(null);
  const [showEditModal,           setShowEditModal]           = useState(false);
  const [selectedPostForEdit,     setSelectedPostForEdit]     = useState<{id: string; content: string} | null>(null);
  const [showSavedPostsModal,     setShowSavedPostsModal]     = useState(false);
  const [showSearchModal,         setShowSearchModal]         = useState(false);
  const [showLogoutModal,         setShowLogoutModal]         = useState(false);

  // ─── Modal TikTok vidéo ───────────────────────────────────────────────────
  const [videoModal,      setVideoModal]      = useState(false);
  const [videoItems,      setVideoItems]      = useState<VideoFeedItem[]>([]);
  const [videoStartIndex, setVideoStartIndex] = useState(0);

  const openVideoModal = useCallback((items: VideoFeedItem[], startIndex: number) => {
    setVideoItems(items);
    setVideoStartIndex(startIndex);
    setVideoModal(true);
  }, []);

  const [headerVisible,  setHeaderVisible]  = useState(true);
  const headerAnim       = useRef(new Animated.Value(0)).current;
  const headerHeightRef  = useRef(75);   // mis à jour via onLayout
  const lastTapRef       = useRef<number | null>(null);

  const userIdRef  = useRef('');
  const tokenRef   = useRef('');
  const filterRef  = useRef<FilterMode>('all');

  // ─── Init session ─────────────────────────────────────────────────────────
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
  }, [userId, accessToken]);

  // ─── loadSubmissions — getValidToken avant chaque appel ───────────────────
  const loadSubmissions = useCallback(async () => {
    try {
      // Récupérer un token valide (refresh préventif si nécessaire)
      const session = await getValidToken();
      if (!session) {
        console.warn('[loadSubmissions] Session invalide');
        return;
      }
      // Mettre à jour les refs avec le token potentiellement rafraîchi
      tokenRef.current  = session.token;
      userIdRef.current = session.uid;

      const res = await fetch(`${BACKEND_URL}/feed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          function:     'getSubmissions',
          user_id:      session.uid,
          access_token: session.token,
        }),
      });

      if (res.status === 401) {
        console.warn('[loadSubmissions] 401 malgré refresh → déconnexion');
        await AsyncStorage.removeItem('harmonia_session');
        router.replace('/login');
        return;
      }

      const data = await res.json();
      if (data.submissions) {
        setSubmissions(data.submissions.map((s: any) => ({ ...s, item_type: 'submission' })));
      }
    } catch (err) { console.error('Error loading submissions:', err); }
  }, []);

  // ─── loadPosts — Edge Function Supabase (anon key, pas de token user) ─────
  const loadPosts = useCallback(async () => {
    try {
      const res  = await fetch(API_BASE_HOME, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
        body:    JSON.stringify({ action: 'get-feed', user_id: userIdRef.current }),
      });
      const data = await res.json();
      if (data.posts)   setPosts(data.posts.map((p: any) => ({ ...p, item_type: 'post' })));
      if (data.profile) setUserProfile(data.profile);
    } catch (err) { console.error('Error loading posts:', err); }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (filterMode !== 'images' && filterMode !== 'videos' && filterMode !== 'audios' && filterMode !== 'artisanat') await loadPosts();
    if (filterMode !== 'posts') await loadSubmissions();
    setRefreshing(false);
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    if (filterRef.current !== 'images' && filterRef.current !== 'videos' && filterRef.current !== 'audios' && filterRef.current !== 'artisanat') await loadPosts();
    if (filterRef.current !== 'posts')  await loadSubmissions();
    setIsRefreshing(false);
  };

  const applyFilter = async (mode: FilterMode) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    filterRef.current = mode;
    setFilterMode(mode);
    setShowFilter(false);
    if (mode === 'posts')  { await loadPosts(); }
    if (mode === 'images') { await loadSubmissions(); }
    if (mode === 'videos') { await loadSubmissions(); }
    if (mode === 'audios') { await loadSubmissions(); }
    if (mode === 'artisanat') { await loadSubmissions(); }
    if (mode === 'all')    { await Promise.all([loadPosts(), loadSubmissions()]); }
  };

  const displayedItems: FeedItem[] = (() => {
    if (filterMode === 'posts')  return posts;
    if (filterMode === 'images') return submissions.filter(s => (s as Submission).game_type === 'arts');
    if (filterMode === 'videos') return submissions.filter(s => (s as Submission).game_type === 'performance');
    if (filterMode === 'audios') return submissions.filter(s => (s as Submission).game_type === 'music');
    if (filterMode === 'artisanat') return submissions.filter(s => (s as Submission).game_type === 'artisanat');
    return [...posts, ...submissions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  // Liste aplatie de toutes les vidéos du feed → pour le modal TikTok
  const allVideoItems: VideoFeedItem[] = displayedItems
    .filter((item): item is Submission => item.item_type === 'submission' && ((item as Submission).game_type === 'performance' || (item as Submission).game_type === 'artisanat'))
    .flatMap(sub =>
      (sub.media ?? []).map(m => ({
        mediaId:     m.id,
        videoUrl:    m.url,
        description: m.description ?? null,
        author:      sub.author,
        run_number:  sub.run_number,
        run_title:   sub.run_title,
        session_id:  sub.session_id,
        total_votes: sub.total_votes,
        user_voted:  sub.user_voted,
        game_type:   sub.game_type,
        run_id:      sub.run_id,
        user_id:     sub.user_id,
      }))
    );

  const toggleHeader = useCallback(() => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHeaderVisible(prev => {
      const nextVisible = !prev;
      Animated.spring(headerAnim, {
        toValue: nextVisible ? 0 : -headerHeightRef.current,
        useNativeDriver: true, tension: 100, friction: 12,
      }).start();
      return nextVisible;
    });
  }, []);  // stable

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      toggleHeader();
      lastTapRef.current = null;
    } else {
      lastTapRef.current = now;
    }
  }, []);  // stable — toggleHeader est aussi stable

  // ─── Post actions ─────────────────────────────────────────────────────────
  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    const res  = await fetch(API_BASE_POSTS, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body:    JSON.stringify({ action: liked ? 'like-post' : 'unlike-post', user_id: userId, post_id: postId }),
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body:    JSON.stringify({ action: shared ? 'share-post' : 'unshare-post', user_id: userId, post_id: postId }),
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body:    JSON.stringify({ action: saved ? 'save-post' : 'unsave-post', user_id: userId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_saved: saved } : p));
    }
  }, [userId]);

  // ─── Vote — par run, Arts ou Performance ─────────────────────────────────
  const handleVote = useCallback(async (gameType: 'arts' | 'performance' | 'music' | 'artisanat', runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => {
    try {
      const session = await getValidToken();
      if (!session) return;
      tokenRef.current = session.token;

      const res = await fetch(`${BACKEND_URL}/feed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          function:          currentlyVoted ? 'unvoteSubmission' : 'voteSubmission',
          user_id:           session.uid,
          access_token:      session.token,
          refresh_token:     session.refresh_token,
          expires_at:        session.expires_at,
          game_type:         gameType,
          run_id:            runId,
          vote_for_user_id:  voteForUserId,
          session_id:        sessionId,
        }),
      });

      if (res.status === 401) {
        console.warn('[handleVote] 401 malgré refresh → déconnexion');
        await AsyncStorage.removeItem('harmonia_session');
        router.replace('/login');
        return;
      }

      const data = await res.json();
      if (data.new_token) {
        tokenRef.current = data.new_token.access_token;
        const raw = await AsyncStorage.getItem('harmonia_session');
        if (raw) {
          await AsyncStorage.setItem('harmonia_session', JSON.stringify({
            ...JSON.parse(raw), ...data.new_token,
          }));
        }
      }
      if (!data.success) throw new Error(data.error);
    } catch (err) { console.error('Error voting:', err); }
  }, []);

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

  const filterLabel: Record<FilterMode, string> = { all: 'Tout', posts: 'Publications', images: 'Images', videos: 'Vidéos', audios: 'Musique', artisanat: 'Artisanat' };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerAnim }] }]}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}
          onLayout={e => { headerHeightRef.current = e.nativeEvent.layout.height; }}>

          <View style={styles.headerTop}>
            {/* Logo mémoïsé — ne re-render pas */}
            <MemoLogo />
            <View style={styles.balanceBox}>
              <Ionicons name="wallet-outline" size={14} color="#FFD700" />
              <Text style={styles.balanceText}>
                {userProfile?.solde_cfa?.toLocaleString() || '0'} CFA
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.filterBtn} onPress={() => {
              if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilter(true);
            }}>
              <Ionicons name="filter" size={16} color="#FFD700" />
              <Text style={styles.filterBtnText}>{filterLabel[filterMode]}</Text>
            </TouchableOpacity>

            <View style={styles.actionsBtns}>
              <TouchableOpacity onPress={handleManualRefresh} disabled={isRefreshing}>
                <Ionicons
                  name="refresh-outline"
                  size={22}
                  color={isRefreshing ? 'rgba(255,255,255,0.4)' : '#fff'}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSearchModal(true);
              }}>
                <Ionicons name="search-outline" size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreateModal(true);
              }}>
                <LinearGradient colors={['#FFD700','#FF0080']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.createBtnGrad}>
                  <Ionicons name="add" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notifications');
              }}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSavedPostsModal(true);
              }}>
                <Ionicons name="arrow-down-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLogoutModal(true);
              }}>
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
            <Text style={styles.emptyText}>Connexion en cours ...</Text>
            <Text style={styles.emptySub}>Veuillez patienter</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {displayedItems.map(item =>
              item.item_type === 'post'
                ? <PostCard
                    key={item.id}
                    post={item}
                    userId={userId}
                    onLike={handleLike}
                    onShare={handleShare}
                    onSave={handleSave}
                    onOpenComments={handleOpenComments}
                    onOpenLikers={handleOpenLikers}
                    onOpenEdit={handleOpenEdit}
                    onLongPress={handleLongPress}
                  />
                : <SubmissionCard
                    key={item.id}
                    sub={item}
                    onVote={handleVote}
                    allVideoItems={allVideoItems}
                    openVideoModal={openVideoModal}
                  />
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showFilter} transparent animationType="fade" onRequestClose={() => setShowFilter(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilter(false)}>
          <View style={styles.filterMenu}>
            <Text style={styles.filterMenuTitle}>Afficher</Text>
            {([
              { key: 'all',    label: 'Tout',         icon: 'apps-outline'          },
              { key: 'posts',  label: 'Publications', icon: 'document-text-outline'  },
              { key: 'images', label: 'Images',       icon: 'images-outline'         },
              { key: 'videos', label: 'Vidéos',       icon: 'videocam-outline'       },
              { key: 'audios',     label: 'Musique',    icon: 'musical-notes-outline'  },
              { key: 'artisanat', label: 'Artisanat',  icon: 'hammer-outline'         },
            ] as { key: FilterMode; label: string; icon: string }[]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterOption, filterMode === opt.key && styles.filterOptionActive]}
                onPress={() => applyFilter(opt.key)}
              >
                <Ionicons name={opt.icon as any} size={20} color={filterMode === opt.key ? '#8A2BE2' : '#666'} />
                <Text style={[styles.filterOptionText, filterMode === opt.key && styles.filterOptionTextActive]}>{opt.label}</Text>
                {filterMode === opt.key && <Ionicons name="checkmark" size={18} color="#8A2BE2" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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

      <CreatePostModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onPostCreated={async () => { await loadPosts(); }} />
      <CommentsModal visible={showCommentsModal} postId={selectedPostForComments} userId={userId} onClose={() => { setShowCommentsModal(false); setSelectedPostForComments(null); }} onCommentAdded={() => { loadPosts(); }} />
      <LikersModal visible={showLikersModal} postId={selectedPostForLikers} onClose={() => { setShowLikersModal(false); setSelectedPostForLikers(null); }} />
      <EditPostModal visible={showEditModal} postId={selectedPostForEdit?.id || null} userId={userId} initialContent={selectedPostForEdit?.content || ''} onClose={() => { setShowEditModal(false); setSelectedPostForEdit(null); }} onPostUpdated={async () => { await loadPosts(); }} />
      <SavedPostsModal visible={showSavedPostsModal} userId={userId} onClose={() => setShowSavedPostsModal(false)} onCommentPress={(postId) => { setShowSavedPostsModal(false); setSelectedPostForComments(postId); setShowCommentsModal(true); }} />
      <SearchModal visible={showSearchModal} userId={userId} accessToken={accessToken} onClose={() => setShowSearchModal(false)} onPostPress={(postId) => { setSelectedPostForComments(postId); setShowCommentsModal(true); }} />
      <LogoutModal visible={showLogoutModal} userId={userId} onClose={() => setShowLogoutModal(false)} onLogoutSuccess={async () => { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); }} />

      {/* Modal TikTok — scroll vertical plein écran */}
      <TikTokVideoModal
        visible={videoModal}
        items={videoItems}
        startIndex={videoStartIndex}
        onClose={() => setVideoModal(false)}
        onVote={handleVote}
      />
    </View>
  );
}

// ─── TikTokVideoModal ─────────────────────────────────────────────────────────
interface TikTokVideoModalProps {
  visible:    boolean;
  items:      VideoFeedItem[];
  startIndex: number;
  onClose:    () => void;
  onVote:     (gameType: 'arts' | 'performance', runId: string, voteForUserId: string, sessionId: string, currentlyVoted: boolean) => Promise<void>;
}

function TikTokVideoModal({ visible, items, startIndex, onClose, onVote }: TikTokVideoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const flatRef = useRef<FlatList>(null);

  // viewabilityConfig stable en ref — déclenche l'autoplay dès 80% visible
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  useEffect(() => {
    if (visible && flatRef.current && items.length > 0) {
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
        setCurrentIndex(startIndex);
      }, 50);
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
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item, index }) => (
            <TikTokVideoItem
              item={item}
              isActive={index === currentIndex}
              onVote={onVote}
            />
          )}
        />
      </View>
    </Modal>
  );
}

// ─── TikTokVideoItem ──────────────────────────────────────────────────────────
function TikTokVideoItem({
  item,
  isActive,
  onVote,
}: {
  item: VideoFeedItem;
  isActive: boolean;
  onVote: TikTokVideoModalProps['onVote'];
}) {
  const [totalVotes, setTotalVotes] = useState(item.total_votes);
  const [userVoted,  setUserVoted]  = useState(item.user_voted);
  const [isVoting,   setIsVoting]   = useState(false);

  useEffect(() => {
    setTotalVotes(item.total_votes);
    setUserVoted(item.user_voted);
  }, [item]);

  const handleVoteLocal = async () => {
    if (isVoting) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsVoting(true);
    const newVoted = !userVoted;
    setUserVoted(newVoted);
    setTotalVotes(p => newVoted ? p + 1 : p - 1);
    try {
      await onVote(item.game_type, item.run_id, item.user_id, item.session_id, userVoted);
    } catch {
      setUserVoted(!newVoted);
      setTotalVotes(p => newVoted ? p - 1 : p + 1);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <View style={tikStyles.item}>
      {/* Vidéo plein écran */}
      <Video
        source={{ uri: item.videoUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted={false}
        shouldPlay={isActive}
        useNativeControls={false}
      />

      {/* Dégradé bas */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={tikStyles.gradient}
      />

      {/* Infos auteur + description */}
      <View style={tikStyles.infoRow}>
        {item.author.avatar_url
          ? <Image source={{ uri: item.author.avatar_url }} style={tikStyles.avatar} />
          : <View style={[tikStyles.avatar, tikStyles.avatarFallback]}>
              <Text style={tikStyles.avatarText}>
                {item.author.prenom.charAt(0)}{item.author.nom.charAt(0)}
              </Text>
            </View>}
        <View style={tikStyles.infoText}>
          <Text style={tikStyles.authorName}>{item.author.prenom} {item.author.nom}</Text>
          <Text style={tikStyles.runLabel}>Run #{item.run_number} — {item.run_title}</Text>
          {item.description
            ? <Text style={tikStyles.desc} numberOfLines={2}>{item.description}</Text>
            : null}
        </View>
      </View>

      {/* Bouton vote flottant */}
      <TouchableOpacity
        style={[tikStyles.voteBtn, userVoted && tikStyles.voteBtnVoted]}
        onPress={handleVoteLocal}
        disabled={isVoting}
        activeOpacity={0.85}
      >
        <Ionicons
          name={userVoted ? 'heart' : 'heart-outline'}
          size={26}
          color={userVoted ? '#FF4D6A' : '#FFF'}
        />
        <Text style={tikStyles.voteCount}>{totalVotes}</Text>
      </TouchableOpacity>
    </View>
  );
}

const tikStyles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#000' },
  closeBtn:     { position: 'absolute', top: TIK_CLOSE_TOP, right: 16,
                  zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
                  width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  item:         { width, height, backgroundColor: '#000' },
  gradient:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },
  infoRow:      { position: 'absolute', bottom: 60, left: 16, right: 80,
                  flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },
  avatarFallback:{ backgroundColor: '#E65100', alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#FFF', fontWeight: '800', fontSize: 14 },
  infoText:     { flex: 1, gap: 3 },
  authorName:   { color: '#FFF', fontWeight: '800', fontSize: 15 },
  runLabel:     { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  desc:         { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  voteBtn:      { position: 'absolute', right: 16, bottom: 80,
                  alignItems: 'center', gap: 4,
                  backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 30,
                  paddingHorizontal: 10, paddingVertical: 12 },
  voteBtnVoted: { backgroundColor: 'rgba(255,77,106,0.2)' },
  voteCount:    { color: '#FFF', fontSize: 13, fontWeight: '800' },
});


const FILTER_OVERLAY_TOP = Platform.OS === 'ios' ? 110 : 90;
const HEADER_PADDING_TOP = Platform.OS === 'ios' ? 50 : 30;
const TIK_CLOSE_TOP      = Platform.OS === 'ios' ? 54 : 30;

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  header:          { paddingTop: HEADER_PADDING_TOP, paddingBottom: 8, paddingHorizontal: 14 },

  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  balanceText:  { color: '#FFD700', fontSize: 12, fontWeight: '800' },

  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  filterBtnText: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  actionsBtns:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  createBtnGrad: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },

  doubleTapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E6FF', paddingVertical: 6, gap: 4 },
  doubleTapText: { fontSize: 11, color: '#8A2BE2', fontWeight: '600' },

  scrollView:    { flex: 1 },
  scrollContent: { paddingTop: HEADER_HEIGHT + 20 },
  feedList:      { paddingVertical: 8, paddingBottom: 100 },
  emptyBox:      { alignItems: 'center', paddingVertical: 60 },
  emptyText:     { fontSize: 16, color: '#999', marginTop: 12 },
  emptySub:      { fontSize: 12, color: '#CCC', marginTop: 5 },

  postCard:          { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, paddingVertical: 14 },
  postHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  postAuthor:        { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatar:            { width: 40, height: 40, borderRadius: 20 },
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

  subCard:          { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, overflow: 'hidden' },
  subHeader:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  artsBadge:        { backgroundColor: '#F0E6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  artsBadgeText:    { color: '#8E44AD', fontSize: 11, fontWeight: '700' },
  totalVotesBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  totalVotesText:   { color: '#E74C3C', fontSize: 13, fontWeight: '700' },
  imagesList:       { flexGrow: 0 },
  imageSlide:       { paddingHorizontal: 12 },
  subImage:         { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#F0F0F0' },
  videoThumb:       { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#1A1A2E',
                      justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  videoPlayOverlay: { position: 'absolute', top: 10, right: 10,
                      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16,
                      padding: 6 },
  videoBadge:       { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row',
                      alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  videoBadgeText:   { color: '#FFF', fontSize: 11, fontWeight: '700' },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: width * 0.85, maxWidth: 400 },
  modalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInfo:    { marginBottom: 12 },
  modalLabel:   { fontSize: 12, color: '#999', marginBottom: 3 },
  modalValue:   { fontSize: 14, color: '#333', fontWeight: '600' },
  modalBtn:     { backgroundColor: '#8A2BE2', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // ─── Music / Audio ──────────────────────────────────────────────────────────
  musicList:         { paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  audioTrack:        { backgroundColor: '#F8F5FF', borderRadius: 14, padding: 14,
                       borderWidth: 1, borderColor: '#E9D5FF', gap: 8 },
  audioTrackNum:     { fontSize: 11, color: '#7C3AED', fontWeight: '700',
                       textTransform: 'uppercase', letterSpacing: 0.5 },
  audioTrackDesc:    { fontSize: 13, color: '#444', fontWeight: '500', marginBottom: 2 },

  // Seekbar tactile
  audioSeekBar:   { height: 28, justifyContent: 'center', paddingHorizontal: 2 },
  audioSeekTrack: { position: 'absolute', left: 2, right: 2, height: 4,
                    backgroundColor: '#DDD6FE', borderRadius: 2 },
  audioSeekFill:  { position: 'absolute', left: 2, height: 4,
                    backgroundColor: '#7C3AED', borderRadius: 2 },
  audioSeekThumb: { position: 'absolute', top: 6, width: 16, height: 16,
                    borderRadius: 8, backgroundColor: '#7C3AED',
                    marginLeft: -8, elevation: 3,
                    shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 4 },

  audioTimings:   { flexDirection: 'row', justifyContent: 'space-between' },
  audioTime:      { fontSize: 10, color: '#9CA3AF' },

  // Contrôles
  audioControls:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  audioSkipBtn:   { alignItems: 'center', gap: 2 },
  audioSkipText:  { fontSize: 10, color: '#7C3AED', fontWeight: '700' },
  audioPlayBtn:   { width: 48, height: 48, borderRadius: 24, borderWidth: 2,
                    borderColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
                    backgroundColor: '#FFF' },
  audioPlayBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
});
