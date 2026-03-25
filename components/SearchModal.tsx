// =====================================================
// SearchModal.tsx
//
// Recherche avec médias interactifs
// Vidéos (autoplay muted, tap → son), Images, Audio (seekbar), Vote inline
//
// Toutes les requêtes passent par le backend Render.
// Aucune Edge Function Supabase n'est utilisée.
//
// Auth : token récupéré depuis AsyncStorage via getValidToken,
//        identique à actu.tsx — refresh automatique si expiré.
//
// Routes :
//   Posts    → POST /home  { action: 'search-posts', user_id, access_token, query }
//   Subs     → POST /feed  { function: 'searchSubmissions', user_id, access_token, query }
//   Like     → POST /home  { action: 'like-post' | 'unlike-post', user_id, post_id }
//   Vote     → POST /feed  { function: 'voteSubmission' | 'unvoteSubmission', ... }
// =====================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, Modal, TouchableOpacity, TextInput,
  ScrollView, Image, Platform, ActivityIndicator, Keyboard,
  Dimensions, PanResponder,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, Audio, ResizeMode } from 'expo-av';
import * as Haptics   from 'expo-haptics';
import AsyncStorage   from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const HOME_URL    = `${BACKEND_URL}/home`;
const NATIVE      = Platform.OS !== 'web';

// ─── Types ────────────────────────────────────────────────────────────────────
type SearchCategory = 'all' | 'posts' | 'images' | 'videos' | 'music' | 'artisanat';

interface Post {
  id:         string;
  author_id:  string;
  author:     { nom: string; prenom: string; avatar_url: string | null };
  content:    string;
  created_at: string;
  imagepots?: string | null;
  vidposts?:  string | null;
  reactions:  { likes: number; comments: number; shares: number };
  user_liked:  boolean;
  user_shared: boolean;
  user_saved:  boolean;
}

interface SubmissionMedia { id: string; url: string; description?: string | null }

interface Submission {
  id:         string;
  game_type:  'arts' | 'performance' | 'music' | 'artisanat';
  badge:      string;
  run_id:     string;
  session_id: string;
  user_id:    string;
  run_number: number;
  run_title:  string;
  run_status: string;
  author:     { nom: string; prenom: string; avatar_url: string | null };
  media:      SubmissionMedia[];
  total_votes: number;
  user_voted:  boolean;
  created_at:  string;
}

type Result = ({ kind: 'post' } & Post) | ({ kind: 'sub' } & Submission);

interface SearchModalProps {
  visible:     boolean;
  onClose:     () => void;
  onPostPress: (postId: string) => void;
}

// ─── getValidToken — identique à actu.tsx ────────────────────────────────────
async function getValidToken(): Promise<{
  uid:           string;
  token:         string;
  refresh_token: string;
  expires_at:    number;
} | null> {
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
    if (expiresAt - now > 60)
      return { uid, token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };
    if (!refreshToken) return null;

    const res = await fetch(`${BACKEND_URL}/refresh-token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data           = await res.json();
    const updatedSession = {
      ...session,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
    await AsyncStorage.setItem('harmonia_session', JSON.stringify(updatedSession));
    return {
      uid,
      token:         data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
  } catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return "À l'instant";
  if (s < 3600)  return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
};
const ini   = (nom: string, p: string) => `${p[0]}${nom[0]}`.toUpperCase();
const fmtMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ─── Catégories ───────────────────────────────────────────────────────────────
const CATS: { key: SearchCategory; label: string; icon: string }[] = [
  { key: 'all',       label: 'Tout',         icon: 'apps-outline'          },
  { key: 'posts',     label: 'Publications', icon: 'document-text-outline' },
  { key: 'images',    label: 'Images',       icon: 'images-outline'        },
  { key: 'videos',    label: 'Vidéos',       icon: 'videocam-outline'      },
  { key: 'music',     label: 'Musique',      icon: 'musical-notes-outline' },
  { key: 'artisanat', label: 'Artisanat',    icon: 'hammer-outline'        },
];

const GT_FOR_CAT: Record<SearchCategory, string | null> = {
  all: null, posts: null, images: 'arts', videos: 'performance', music: 'music', artisanat: 'artisanat',
};

// ─── Highlighted ──────────────────────────────────────────────────────────────
function Hl({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <Text>{text}</Text>;
  const safe  = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'gi'));
  return (
    <Text>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <Text key={i} style={S.hl}>{p}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

// ─── AudioMini ────────────────────────────────────────────────────────────────
function AudioMini({ url, description }: { url: string; description?: string | null }) {
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);
  const [posMs,      setPosMs]      = useState(0);
  const [durMs,      setDurMs]      = useState(0);
  const soundRef    = useRef<Audio.Sound | null>(null);
  const barWidthRef = useRef(0);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const seekToRatio = useCallback(async (ratio: number) => {
    const s = soundRef.current; if (!s) return;
    const st = await s.getStatusAsync();
    if (!st.isLoaded || !st.durationMillis) return;
    const pos = Math.max(0, Math.min(Math.floor(ratio * st.durationMillis), st.durationMillis));
    await s.setPositionAsync(pos); setPosMs(pos);
  }, []);

  const skip = useCallback(async (delta: number) => {
    const s = soundRef.current; if (!s) return;
    const st = await s.getStatusAsync(); if (!st.isLoaded) return;
    const pos = Math.max(0, Math.min((st.positionMillis ?? 0) + delta, st.durationMillis ?? 0));
    await s.setPositionAsync(pos); setPosMs(pos);
  }, []);

  const pan = useRef(PanResponder.create({
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
  })).current;

  const togglePlay = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (!soundRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: ns } = await Audio.Sound.createAsync(
          { uri: url }, { shouldPlay: true },
          st => {
            if (!st.isLoaded) return;
            setPosMs(st.positionMillis ?? 0);
            setDurMs(st.durationMillis ?? 0);
            setIsPlaying(st.isPlaying);
            if (st.didJustFinish) { setIsPlaying(false); setPosMs(0); }
          }
        );
        soundRef.current = ns; setIsPlaying(true); setIsLoading(false);
      } else {
        const st = await soundRef.current.getStatusAsync(); if (!st.isLoaded) return;
        if (st.isPlaying) { await soundRef.current.pauseAsync(); setIsPlaying(false); }
        else {
          if ((st.positionMillis ?? 0) >= (st.durationMillis ?? 0) - 200)
            await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync(); setIsPlaying(true);
        }
      }
    } catch { setIsLoading(false); }
  };

  const prog = durMs > 0 ? posMs / durMs : 0;

  return (
    <View style={S.audioBox}>
      <View style={S.audioTop}>
        <Ionicons name="musical-notes" size={16} color="#7C3AED" />
        <Text style={S.audioDesc} numberOfLines={1}>{description || 'Piste audio'}</Text>
      </View>
      <View style={S.seekBar} onLayout={e => { barWidthRef.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
        <View style={S.seekTrack} />
        <View style={[S.seekFill, { width: `${Math.round(prog * 100)}%` }]} />
        <View style={[S.seekThumb, { left: `${Math.round(prog * 100)}%` as any }]} />
      </View>
      <View style={S.seekTimes}>
        <Text style={S.seekTime}>{fmtMs(posMs)}</Text>
        {durMs > 0 && <Text style={S.seekTime}>{fmtMs(durMs)}</Text>}
      </View>
      <View style={S.audioCtrl}>
        <TouchableOpacity style={S.skipBtn} onPress={() => skip(-10000)} disabled={!soundRef.current}>
          <Ionicons name="play-back" size={16} color={soundRef.current ? '#7C3AED' : '#CCC'} />
          <Text style={[S.skipTxt, !soundRef.current && { color: '#CCC' }]}>10</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.playBtn, isPlaying && S.playBtnActive]} onPress={togglePlay} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator size="small" color="#7C3AED" />
            : <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={isPlaying ? '#FFF' : '#7C3AED'} />}
        </TouchableOpacity>
        <TouchableOpacity style={S.skipBtn} onPress={() => skip(10000)} disabled={!soundRef.current}>
          <Ionicons name="play-forward" size={16} color={soundRef.current ? '#7C3AED' : '#CCC'} />
          <Text style={[S.skipTxt, !soundRef.current && { color: '#CCC' }]}>10</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── VideoMini ────────────────────────────────────────────────────────────────
function VideoMini({ url, description }: { url: string; description?: string | null }) {
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);

  return (
    <View style={S.videoBox}>
      <Video
        source={{ uri: url }}
        style={S.videoPlayer}
        resizeMode={ResizeMode.COVER}
        isLooping isMuted={muted} shouldPlay={playing} useNativeControls={false}
      />
      <TouchableOpacity
        style={S.videoOverlay} activeOpacity={0.85}
        onPress={() => {
          if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (!playing) { setPlaying(true); setMuted(false); }
          else setMuted(m => !m);
        }}
      >
        {!playing && (
          <View style={S.videoPlayIcon}><Ionicons name="play" size={28} color="#FFF" /></View>
        )}
        {playing && (
          <View style={S.videoMuteIcon}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
      {description && <Text style={S.videoDesc} numberOfLines={1}>{description}</Text>}
    </View>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────
// Like/unlike → POST /home via getValidToken (token frais depuis AsyncStorage)
interface PostCardProps {
  post: Post; q: string; onComment: () => void;
}

function PostCard({ post, q, onComment }: PostCardProps) {
  const [liked, setLiked] = useState(post.user_liked);
  const [likes, setLikes] = useState(post.reactions.likes);

  const doLike = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nl = !liked; setLiked(nl); setLikes(c => nl ? c + 1 : c - 1);
    try {
      const session = await getValidToken();
      if (!session) throw new Error('session invalide');
      const res = await fetch(HOME_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:   nl ? 'like-post' : 'unlike-post',
          user_id:  session.uid,
          post_id:  post.id,
        }),
      });
      const data = await res.json();
      if (data.success) setLikes(data.likes ?? likes);
    } catch { setLiked(!nl); setLikes(c => nl ? c - 1 : c + 1); }
  };

  return (
    <View style={S.card}>
      <View style={S.cardHead}>
        {post.author.avatar_url
          ? <Image source={{ uri: post.author.avatar_url }} style={S.av} />
          : <View style={S.avFb}><Text style={S.avTxt}>{ini(post.author.nom, post.author.prenom)}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={S.name}>{post.author.prenom} {post.author.nom}</Text>
          <Text style={S.time}>{fmtAgo(post.created_at)}</Text>
        </View>
        <View style={S.postBadge}><Text style={S.postBadgeTxt}>📝</Text></View>
      </View>

      <Text style={S.body}><Hl text={post.content} q={q} /></Text>

      {/* Image du post si présente */}
      {post.imagepots && (
        <Image source={{ uri: post.imagepots }} style={S.imgMedia} resizeMode="cover" />
      )}
      {/* Vidéo du post si présente */}
      {post.vidposts && (
        <VideoMini url={post.vidposts} />
      )}

      <View style={S.actions}>
        <TouchableOpacity style={S.actBtn} onPress={doLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#FF0080' : '#888'} />
          <Text style={[S.actTxt, liked && { color: '#FF0080' }]}>{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actBtn} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={18} color="#888" />
          <Text style={S.actTxt}>{post.reactions.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actBtn}>
          <Ionicons name="repeat-outline" size={18} color="#888" />
          <Text style={S.actTxt}>{post.reactions.shares}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SubCard ──────────────────────────────────────────────────────────────────
// Vote → POST /feed via getValidToken (token frais depuis AsyncStorage)
interface SubCardProps { sub: Submission; q: string; }

function SubCard({ sub, q }: SubCardProps) {
  const [votes,    setVotes]    = useState(sub.total_votes);
  const [voted,    setVoted]    = useState(sub.user_voted);
  const [voting,   setVoting]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isMusic = sub.game_type === 'music';
  const isImage = sub.game_type === 'arts';
  const badgeBg  = isImage ? '#F0E6FF' : isMusic ? '#EDE9FE' : '#FFF3E0';
  const badgeClr = isImage ? '#8E44AD' : isMusic ? '#7C3AED' : '#E65100';

  const stMap: Record<string, { label: string; color: string }> = {
    submissions_open: { label: 'Soumissions', color: '#0EA5E9' },
    voting_open:      { label: 'Vote ouvert',  color: '#10B981' },
    finished:         { label: 'Terminé',      color: '#6B7280' },
  };
  const st = stMap[sub.run_status] ?? { label: sub.run_status, color: '#999' };

  const doVote = async () => {
    if (voting) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoting(true);
    const nv = !voted; setVoted(nv); setVotes(v => nv ? v + 1 : v - 1);
    try {
      const session = await getValidToken();
      if (!session) throw new Error('session invalide');
      const res = await fetch(`${BACKEND_URL}/feed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function:         nv ? 'voteSubmission' : 'unvoteSubmission',
          user_id:          session.uid,
          access_token:     session.token,
          refresh_token:    session.refresh_token,
          expires_at:       session.expires_at,
          game_type:        sub.game_type,
          run_id:           sub.run_id,
          vote_for_user_id: sub.user_id,
          session_id:       sub.session_id,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      if (d.new_token) {
        const raw = await AsyncStorage.getItem('harmonia_session');
        if (raw) await AsyncStorage.setItem('harmonia_session', JSON.stringify({ ...JSON.parse(raw), ...d.new_token }));
      }
    } catch { setVoted(!nv); setVotes(v => nv ? v - 1 : v + 1); }
    finally { setVoting(false); }
  };

  const matchedDesc  = sub.media.find(m => m.description?.toLowerCase().includes(q.toLowerCase()))?.description;
  const mediaLabel   = isImage ? 'image' : isMusic ? 'piste' : 'vidéo';
  const mediaIcon    = isImage ? 'images-outline' : isMusic ? 'musical-notes-outline' : 'videocam-outline';

  return (
    <View style={S.card}>
      <View style={S.cardHead}>
        {sub.author.avatar_url
          ? <Image source={{ uri: sub.author.avatar_url }} style={S.av} />
          : <View style={[S.avFb, { backgroundColor: badgeClr }]}>
              <Text style={S.avTxt}>{ini(sub.author.nom, sub.author.prenom)}</Text>
            </View>}
        <View style={{ flex: 1 }}>
          <Text style={S.name}>{sub.author.prenom} {sub.author.nom}</Text>
          <Text style={S.time}>Run #{sub.run_number} — <Hl text={sub.run_title} q={q} /></Text>
        </View>
        <View style={[S.gameBadge, { backgroundColor: badgeBg }]}>
          <Text style={[S.gameBadgeTxt, { color: badgeClr }]}>{sub.badge}</Text>
        </View>
      </View>

      {matchedDesc && (
        <View style={S.descRow}>
          <Ionicons name="chatbubble-outline" size={13} color="#999" />
          <Text style={S.descTxt} numberOfLines={2}><Hl text={matchedDesc} q={q} /></Text>
        </View>
      )}

      {sub.media.length > 0 && (
        <>
          <TouchableOpacity style={S.mediaToggle} onPress={() => {
            if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpanded(e => !e);
          }}>
            <Ionicons name={mediaIcon as any} size={15} color="#8A2BE2" />
            <Text style={S.mediaToggleTxt}>
              {expanded ? 'Masquer' : `Voir ${sub.media.length} ${mediaLabel}${sub.media.length > 1 ? 's' : ''}`}
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#8A2BE2" />
          </TouchableOpacity>

          {expanded && (
            <View style={S.mediaList}>
              {sub.media.map(m =>
                isImage  ? <Image key={m.id} source={{ uri: m.url }} style={S.imgMedia} resizeMode="cover" />
                : isMusic ? <AudioMini key={m.id} url={m.url} description={m.description} />
                          : <VideoMini key={m.id} url={m.url} description={m.description} />
              )}
            </View>
          )}
        </>
      )}

      <View style={S.footer}>
        <View style={[S.statusPill, { backgroundColor: st.color + '22' }]}>
          <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {sub.run_status === 'voting_open' ? (
          <TouchableOpacity style={[S.voteBtn, voted && S.voteBtnVoted]} onPress={doVote} disabled={voting} activeOpacity={0.8}>
            {voting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <><Ionicons name={voted ? 'heart' : 'heart-outline'} size={16} color="#FFF" />
                  <Text style={S.voteTxt}>{voted ? 'Voté' : 'Voter'}</Text>
                  <Text style={S.voteCount}>{votes}</Text></>}
          </TouchableOpacity>
        ) : (
          <View style={S.voteStat}>
            <Ionicons name="heart" size={14} color="#E74C3C" />
            <Text style={S.voteStatTxt}>{votes} vote{votes !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── SearchModal ──────────────────────────────────────────────────────────────
export default function SearchModal({ visible, onClose, onPostPress }: SearchModalProps) {
  const [query,    setQuery]    = useState('');
  const [cat,      setCat]      = useState<SearchCategory>('all');
  const [results,  setResults]  = useState<Result[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); setSearched(false); setCat('all'); }
  }, [visible]);

  // ── Recherche posts → POST /home ─────────────────────────────────────────
  const fetchPosts = async (): Promise<Post[]> => {
    const session = await getValidToken();
    if (!session) return [];
    const res = await fetch(HOME_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:       'search-posts',
        user_id:      session.uid,
        access_token: session.token,
        query:        query.trim(),
      }),
    });
    const d = await res.json();
    return d.success && d.posts ? d.posts : [];
  };

  // ── Recherche submissions → POST /feed ───────────────────────────────────
  const fetchSubs = async (): Promise<Submission[]> => {
    const session  = await getValidToken();
    if (!session) return [];
    const gameType = GT_FOR_CAT[cat];
    const body: any = {
      function:      'searchSubmissions',
      user_id:       session.uid,
      access_token:  session.token,
      refresh_token: session.refresh_token,
      expires_at:    session.expires_at,
      query:         query.trim(),
    };
    if (gameType) body.game_type = gameType;
    const res = await fetch(`${BACKEND_URL}/feed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.new_token) {
      const raw = await AsyncStorage.getItem('harmonia_session');
      if (raw) await AsyncStorage.setItem('harmonia_session', JSON.stringify({ ...JSON.parse(raw), ...d.new_token }));
    }
    return d.success && d.submissions ? d.submissions : [];
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true); setSearched(true);
    try {
      const searchPosts = cat === 'all' || cat === 'posts';
      const searchSubs  = cat === 'all' || cat !== 'posts';
      const [posts, subs] = await Promise.all([
        searchPosts ? fetchPosts() : Promise.resolve([]),
        searchSubs  ? fetchSubs()  : Promise.resolve([]),
      ]);
      const merged: Result[] = [
        ...posts.map(p => ({ ...p, kind: 'post' as const })),
        ...subs.map(s  => ({ ...s, kind: 'sub'  as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setResults(merged);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const postsN = results.filter(r => r.kind === 'post').length;
  const subsN  = results.filter(r => r.kind === 'sub').length;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={S.root}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>
          <View style={S.headerTop}>
            <TouchableOpacity onPress={onClose} style={S.backBtn}>
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Rechercher</Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={S.bar}>
            <Ionicons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={S.input}
              placeholder="Mots-clés, descriptions, titres…"
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={doSearch}
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips} style={{ marginBottom: 10 }}>
            {CATS.map(c => {
              const active = cat === c.key;
              return (
                <TouchableOpacity key={c.key} style={[S.chip, active && S.chipOn]}
                  onPress={() => {
                    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCat(c.key); setResults([]); setSearched(false);
                  }}>
                  <Ionicons name={c.icon as any} size={13} color={active ? '#8A2BE2' : 'rgba(255,255,255,0.8)'} />
                  <Text style={[S.chipTxt, active && S.chipTxtOn]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[S.searchBtn, (!query.trim() || loading) && { opacity: 0.4 }]}
            onPress={doSearch} disabled={!query.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#FFF" />
              : <><Ionicons name="search" size={18} color="#FFF" /><Text style={S.searchBtnTxt}>Rechercher</Text></>}
          </TouchableOpacity>
        </LinearGradient>

        {/* ── RÉSULTATS ───────────────────────────────────────────────── */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {loading ? (
            <View style={S.center}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={S.stTxt}>Recherche en cours…</Text>
            </View>
          ) : searched && results.length === 0 ? (
            <View style={S.center}>
              <Ionicons name="search-outline" size={70} color="#CCC" />
              <Text style={S.stTitle}>Aucun résultat</Text>
              <Text style={S.stTxt}>Essayez avec d'autres mots-clés</Text>
            </View>
          ) : searched ? (
            <>
              <View style={S.countBar}>
                <Text style={S.countTxt}>{results.length} résultat{results.length > 1 ? 's' : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {postsN > 0 && <View style={S.pill}><Text style={S.pillTxt}>📝 {postsN}</Text></View>}
                  {subsN  > 0 && <View style={S.pill}><Text style={S.pillTxt}>🎭 {subsN}</Text></View>}
                </View>
              </View>
              {results.map(item =>
                item.kind === 'post'
                  ? <PostCard key={`p-${item.id}`} post={item} q={query}
                      onComment={() => { onClose(); onPostPress(item.id); }} />
                  : <SubCard  key={`s-${item.id}`} sub={item}  q={query} />
              )}
              <View style={{ height: 50 }} />
            </>
          ) : (
            <View style={S.center}>
              <Ionicons name="search-circle-outline" size={80} color="#E0D0FF" />
              <Text style={S.stTitle}>Rechercher dans Harmonia</Text>
              <Text style={S.stTxt}>Publications, vidéos, images, sons…{'\n'}Choisissez une catégorie et tapez vos mots-clés</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F5F5F5' },
  header:      { paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingBottom: 6, paddingHorizontal: 16 },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  bar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  input:       { flex: 1, fontSize: 15, color: '#333' },
  chips:       { paddingRight: 16, gap: 8, flexDirection: 'row' },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn:      { backgroundColor: '#FFF' },
  chipTxt:     { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTxtOn:   { color: '#8A2BE2' },
  searchBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 10, borderRadius: 10, gap: 6, marginTop: 4, marginBottom: 6 },
  searchBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  center:      { paddingVertical: 70, alignItems: 'center', paddingHorizontal: 40 },
  stTitle:     { fontSize: 17, fontWeight: '700', color: '#999', marginTop: 18, textAlign: 'center' },
  stTxt:       { fontSize: 13, color: '#BBB', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  countBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  countTxt:    { fontSize: 13, fontWeight: '700', color: '#8A2BE2' },
  pill:        { backgroundColor: '#F0E6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:     { fontSize: 11, fontWeight: '700', color: '#8A2BE2' },
  card:        {
    backgroundColor: '#FFF', marginHorizontal: 12, marginVertical: 6, borderRadius: 14, padding: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  cardHead:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  av:           { width: 36, height: 36, borderRadius: 18 },
  avFb:         { width: 36, height: 36, borderRadius: 18, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  avTxt:        { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  name:         { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  time:         { fontSize: 11, color: '#999', marginTop: 1 },
  postBadge:    { backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  postBadgeTxt: { fontSize: 12 },
  gameBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  gameBadgeTxt: { fontSize: 11, fontWeight: '700' },
  body:         { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 10 },
  hl:           { backgroundColor: '#FFF3CD', fontWeight: '700', color: '#8A2BE2' },
  actions:      { flexDirection: 'row', gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  actBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actTxt:       { fontSize: 13, color: '#666', fontWeight: '600' },
  descRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10, backgroundColor: '#FAFAFA', borderRadius: 8, padding: 8 },
  descTxt:      { flex: 1, fontSize: 13, color: '#555', lineHeight: 18 },
  mediaToggle:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  mediaToggleTxt: { flex: 1, fontSize: 13, color: '#8A2BE2', fontWeight: '600' },
  mediaList:      { gap: 10, marginBottom: 10 },
  imgMedia:       { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#EEE' },
  videoBox:       { borderRadius: 10, overflow: 'hidden', backgroundColor: '#000', height: 200 },
  videoPlayer:    { width: '100%', height: '100%' },
  videoOverlay:   { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  videoPlayIcon:  { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  videoMuteIcon:  { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  videoDesc:      { position: 'absolute', bottom: 8, left: 10, right: 10, color: '#FFF', fontSize: 12, fontWeight: '500' },
  audioBox:       { backgroundColor: '#F8F5FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E9D5FF', gap: 8 },
  audioTop:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audioDesc:      { flex: 1, fontSize: 12, color: '#555', fontWeight: '500' },
  seekBar:        { height: 28, justifyContent: 'center', paddingHorizontal: 2 },
  seekTrack:      { position: 'absolute', left: 2, right: 2, height: 4, backgroundColor: '#DDD6FE', borderRadius: 2 },
  seekFill:       { position: 'absolute', left: 2, height: 4, backgroundColor: '#7C3AED', borderRadius: 2 },
  seekThumb:      { position: 'absolute', top: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#7C3AED', marginLeft: -8, elevation: 3 },
  seekTimes:      { flexDirection: 'row', justifyContent: 'space-between' },
  seekTime:       { fontSize: 10, color: '#9CA3AF' },
  audioCtrl:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  skipBtn:        { alignItems: 'center', gap: 2 },
  skipTxt:        { fontSize: 10, color: '#7C3AED', fontWeight: '700' },
  playBtn:        { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  playBtnActive:  { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  footer:         { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5', gap: 8 },
  statusPill:     { borderRadius: 8, paddingHorizontO: 8, paddingVertical: 3, paddingHorizontal: 8 },
  statusTxt:      { fontSize: 11, fontWeight: '700' },
  voteBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#8A2BE2', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  voteBtnVoted:   { backgroundColor: '#E74C3C' },
  voteTxt:        { color: '#FFF', fontSize: 13, fontWeight: '700' },
  voteCount:      { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  voteStat:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteStatTxt:    { fontSize: 13, color: '#E74C3C', fontWeight: '700' },
});
