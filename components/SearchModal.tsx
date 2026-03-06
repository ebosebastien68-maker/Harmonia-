// SearchModal.tsx
// Recherche par mots-clés : Publications + Soumissions (Arts / Performance / Musique / Artisanat)
// Catégories : Tout | Publications | Images | Vidéos | Musique | Artisanat

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Modal, TouchableOpacity, TextInput,
  ScrollView, Image, Platform, ActivityIndicator, Keyboard, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const BACKEND_URL    = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const API_BASE_SEARCH = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/search';
const API_BASE_POSTS  = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';
const NATIVE = Platform.OS !== 'web';

// ─── Types ────────────────────────────────────────────────────────────────────
type SearchCategory = 'all' | 'posts' | 'images' | 'videos' | 'music' | 'artisanat';

interface Post {
  id: string; author_id: string;
  author: { nom: string; prenom: string; avatar_url: string | null };
  content: string; created_at: string;
  reactions: { likes: number; comments: number; shares: number };
  user_liked: boolean; user_shared: boolean; user_saved: boolean;
}

interface SubmissionMedia {
  id: string; url: string; description?: string | null;
}

interface Submission {
  id: string; game_type: 'arts' | 'performance' | 'music' | 'artisanat'; badge: string;
  run_id: string; session_id: string; user_id: string;
  run_number: number; run_title: string; run_status: string;
  author: { nom: string; prenom: string; avatar_url: string | null };
  media: SubmissionMedia[];
  total_votes: number; user_voted: boolean; created_at: string;
}

type SearchResult = ({ kind: 'post' } & Post) | ({ kind: 'sub' } & Submission);

interface SearchModalProps {
  visible:      boolean;
  userId:       string;
  accessToken:  string;
  onClose:      () => void;
  onPostPress:  (postId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTimeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return "À l'instant";
  if (s < 3600)  return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
};
const initials = (nom: string, p: string) => `${p.charAt(0)}${nom.charAt(0)}`.toUpperCase();

// Surligne les occurrences du mot-clé dans un texte
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <Text>{text}</Text>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <Text>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={S.highlight}>{p}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

// ─── Categories config ────────────────────────────────────────────────────────
const CATEGORIES: { key: SearchCategory; label: string; icon: string }[] = [
  { key: 'all',       label: 'Tout',         icon: 'apps-outline'           },
  { key: 'posts',     label: 'Publications', icon: 'document-text-outline'  },
  { key: 'images',    label: 'Images',       icon: 'images-outline'         },
  { key: 'videos',    label: 'Vidéos',       icon: 'videocam-outline'       },
  { key: 'music',     label: 'Musique',      icon: 'musical-notes-outline'  },
  { key: 'artisanat', label: 'Artisanat',    icon: 'hammer-outline'         },
];

const GAME_TYPE_FOR_CATEGORY: Record<SearchCategory, string | null> = {
  all: null, posts: null,
  images: 'arts', videos: 'performance', music: 'music', artisanat: 'artisanat',
};

// ─── PostResultCard ───────────────────────────────────────────────────────────
function PostResultCard({
  post, query, userId, onCommentPress,
}: { post: Post; query: string; userId: string; onCommentPress: () => void }) {
  const [liked,      setLiked]      = useState(post.user_liked);
  const [likesCount, setLikesCount] = useState(post.reactions.likes);

  const handleLike = async () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(c => newLiked ? c + 1 : c - 1);
    try {
      await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
        body: JSON.stringify({ action: newLiked ? 'like-post' : 'unlike-post', user_id: userId, post_id: post.id }),
      });
    } catch { setLiked(!newLiked); setLikesCount(c => newLiked ? c - 1 : c + 1); }
  };

  return (
    <View style={S.card}>
      <View style={S.cardHeader}>
        {post.author.avatar_url
          ? <Image source={{ uri: post.author.avatar_url }} style={S.avatar} />
          : <View style={S.avatarFallback}><Text style={S.avatarText}>{initials(post.author.nom, post.author.prenom)}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={S.authorName}>{post.author.prenom} {post.author.nom}</Text>
          <Text style={S.timeText}>{formatTimeAgo(post.created_at)}</Text>
        </View>
        <View style={S.postBadge}><Text style={S.postBadgeText}>📝 Publication</Text></View>
      </View>

      <Text style={S.cardBody}>
        <Highlighted text={post.content} query={query} />
      </Text>

      <View style={S.cardActions}>
        <TouchableOpacity style={S.actionBtn} onPress={handleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#FF0080' : '#888'} />
          <Text style={[S.actionText, liked && { color: '#FF0080' }]}>{likesCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actionBtn} onPress={onCommentPress}>
          <Ionicons name="chatbubble-outline" size={18} color="#888" />
          <Text style={S.actionText}>{post.reactions.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actionBtn}>
          <Ionicons name="repeat-outline" size={18} color="#888" />
          <Text style={S.actionText}>{post.reactions.shares}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SubmissionResultCard ─────────────────────────────────────────────────────
function SubmissionResultCard({ sub, query }: { sub: Submission; query: string }) {
  const isMusic   = sub.game_type === 'music';
  const isImage   = sub.game_type === 'arts';
  const isVideo   = sub.game_type === 'performance' || sub.game_type === 'artisanat';

  const badgeBg    = isImage ? '#F0E6FF' : isMusic ? '#EDE9FE' : '#FFF3E0';
  const badgeColor = isImage ? '#8E44AD' : isMusic ? '#7C3AED' : '#E65100';

  const mediaIcon  = isImage ? 'images-outline' : isMusic ? 'musical-notes-outline' : 'videocam-outline';
  const mediaLabel = isImage ? 'image' : isMusic ? 'piste' : 'vidéo';

  // Statut badge
  const statusConfig: Record<string, { label: string; color: string }> = {
    submissions_open: { label: 'En cours',     color: '#0EA5E9' },
    voting_open:      { label: 'Vote ouvert',  color: '#10B981' },
    finished:         { label: 'Terminé',      color: '#6B7280' },
  };
  const status = statusConfig[sub.run_status] ?? { label: sub.run_status, color: '#999' };

  // Chercher la description qui correspond à la query
  const matchedDesc = sub.media.find(m => m.description?.toLowerCase().includes(query.toLowerCase()))?.description;

  return (
    <View style={S.card}>
      {/* Header */}
      <View style={S.cardHeader}>
        {sub.author.avatar_url
          ? <Image source={{ uri: sub.author.avatar_url }} style={S.avatar} />
          : <View style={[S.avatarFallback, { backgroundColor: badgeColor }]}>
              <Text style={S.avatarText}>{initials(sub.author.nom, sub.author.prenom)}</Text>
            </View>}
        <View style={{ flex: 1 }}>
          <Text style={S.authorName}>{sub.author.prenom} {sub.author.nom}</Text>
          <Text style={S.timeText}>Run #{sub.run_number} — <Highlighted text={sub.run_title} query={query} /></Text>
        </View>
        <View style={[S.gameBadge, { backgroundColor: badgeBg }]}>
          <Text style={[S.gameBadgeText, { color: badgeColor }]}>{sub.badge}</Text>
        </View>
      </View>

      {/* Description matchée */}
      {matchedDesc ? (
        <View style={S.descRow}>
          <Ionicons name="chatbubble-outline" size={13} color="#999" />
          <Text style={S.descText} numberOfLines={2}>
            <Highlighted text={matchedDesc} query={query} />
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={S.cardFooter}>
        <View style={S.footerLeft}>
          <Ionicons name={mediaIcon as any} size={14} color="#888" />
          <Text style={S.footerText}>{sub.media.length} {mediaLabel}{sub.media.length > 1 ? 's' : ''}</Text>
        </View>
        <View style={S.footerMid}>
          <Ionicons name="heart" size={14} color="#E74C3C" />
          <Text style={S.footerText}>{sub.total_votes} vote{sub.total_votes !== 1 ? 's' : ''}</Text>
        </View>
        <View style={[S.statusPill, { backgroundColor: status.color + '22' }]}>
          <Text style={[S.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── SearchModal ──────────────────────────────────────────────────────────────
export default function SearchModal({ visible, userId, accessToken, onClose, onPostPress }: SearchModalProps) {
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); setSearched(false); setCategory('all'); }
  }, [visible]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setSearched(true);

    try {
      const searchPosts = category === 'all' || category === 'posts';
      const searchSubs  = category === 'all' || category !== 'posts';

      const [postsData, subsData] = await Promise.all([
        searchPosts ? fetchPosts() : Promise.resolve([]),
        searchSubs  ? fetchSubs()  : Promise.resolve([]),
      ]);

      // Fusionner et trier par date
      const merged: SearchResult[] = [
        ...postsData.map(p => ({ ...p, kind: 'post' as const })),
        ...subsData.map(s  => ({ ...s, kind: 'sub'  as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setResults(merged);
    } catch (e) {
      console.error('[Search] Erreur:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (): Promise<Post[]> => {
    const res = await fetch(API_BASE_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body: JSON.stringify({ action: 'search-posts', user_id: userId, query: query.trim() }),
    });
    const data = await res.json();
    return data.success && data.posts ? data.posts : [];
  };

  const fetchSubs = async (): Promise<Submission[]> => {
    const gameType = GAME_TYPE_FOR_CATEGORY[category];
    const body: any = {
      function:     'searchSubmissions',
      user_id:      userId,
      access_token: accessToken,
      query:        query.trim(),
    };
    if (gameType) body.game_type = gameType;

    const res = await fetch(`${BACKEND_URL}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.success && data.submissions ? data.submissions : [];
  };

  const postsCount = results.filter(r => r.kind === 'post').length;
  const subsCount  = results.filter(r => r.kind === 'sub').length;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={S.container}>

        {/* ─── Header gradient ─────────────────────────────────────── */}
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={S.header}>

          {/* Titre + back */}
          <View style={S.headerTop}>
            <TouchableOpacity onPress={onClose} style={S.backBtn}>
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Rechercher</Text>
            <View style={{ width: 34 }} />
          </View>

          {/* Barre de recherche */}
          <View style={S.searchBar}>
            <Ionicons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={S.searchInput}
              placeholder="Mots-clés..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Chips catégories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.chips}
            style={{ marginBottom: 10 }}
          >
            {CATEGORIES.map(cat => {
              const active = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[S.chip, active && S.chipActive]}
                  onPress={() => {
                    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(cat.key);
                    setResults([]);
                    setSearched(false);
                  }}
                >
                  <Ionicons name={cat.icon as any} size={14} color={active ? '#8A2BE2' : 'rgba(255,255,255,0.75)'} />
                  <Text style={[S.chipText, active && S.chipTextActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Bouton rechercher */}
          <TouchableOpacity
            style={[S.searchBtn, (!query.trim() || loading) && S.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!query.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#FFF" />
              : <><Ionicons name="search" size={18} color="#FFF" /><Text style={S.searchBtnText}>Rechercher</Text></>}
          </TouchableOpacity>

        </LinearGradient>

        {/* ─── Résultats ────────────────────────────────────────────── */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {loading ? (
            <View style={S.centerBox}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={S.stateText}>Recherche en cours…</Text>
            </View>

          ) : searched && results.length === 0 ? (
            <View style={S.centerBox}>
              <Ionicons name="search-outline" size={70} color="#CCC" />
              <Text style={S.stateTitle}>Aucun résultat</Text>
              <Text style={S.stateText}>Essayez avec d'autres mots-clés</Text>
            </View>

          ) : searched && results.length > 0 ? (
            <>
              {/* Compteurs */}
              <View style={S.countBar}>
                <Text style={S.countText}>{results.length} résultat{results.length > 1 ? 's' : ''}</Text>
                <View style={S.countPills}>
                  {postsCount > 0 && <View style={S.countPill}><Text style={S.countPillText}>📝 {postsCount}</Text></View>}
                  {subsCount  > 0 && <View style={S.countPill}><Text style={S.countPillText}>🎭 {subsCount}</Text></View>}
                </View>
              </View>

              {results.map(item =>
                item.kind === 'post'
                  ? <PostResultCard
                      key={`post-${item.id}`}
                      post={item}
                      query={query}
                      userId={userId}
                      onCommentPress={() => { onClose(); onPostPress(item.id); }}
                    />
                  : <SubmissionResultCard
                      key={`sub-${item.id}`}
                      sub={item}
                      query={query}
                    />
              )}
              <View style={{ height: 40 }} />
            </>

          ) : (
            <View style={S.centerBox}>
              <Ionicons name="search-circle-outline" size={80} color="#E0D0FF" />
              <Text style={S.stateTitle}>Rechercher dans Harmonia</Text>
              <Text style={S.stateText}>Publications, runs, descriptions…{'\n'}Choisissez une catégorie et tapez vos mots-clés</Text>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header:         { paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingBottom: 6, paddingHorizontal: 16 },
  headerTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn:        { padding: 4 },
  headerTitle:    { fontSize: 18, fontWeight: 'bold', color: '#FFF' },

  // Search bar
  searchBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
                    borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput:    { flex: 1, fontSize: 15, color: '#333' },

  // Chips
  chips:          { paddingRight: 16, gap: 8, flexDirection: 'row' },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
                    paddingHorizontal: 12, paddingVertical: 6 },
  chipActive:     { backgroundColor: '#FFF' },
  chipText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTextActive: { color: '#8A2BE2' },

  // Search button
  searchBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                       backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 10,
                       borderRadius: 10, gap: 6, marginTop: 4, marginBottom: 6 },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText:     { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // States
  centerBox:    { paddingVertical: 70, alignItems: 'center', paddingHorizontal: 40 },
  stateTitle:   { fontSize: 17, fontWeight: '700', color: '#999', marginTop: 18, textAlign: 'center' },
  stateText:    { fontSize: 13, color: '#BBB', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  // Count bar
  countBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   paddingHorizontal: 16, paddingVertical: 12,
                   backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  countText:     { fontSize: 13, fontWeight: '700', color: '#8A2BE2' },
  countPills:    { flexDirection: 'row', gap: 6 },
  countPill:     { backgroundColor: '#F0E6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  countPillText: { fontSize: 11, fontWeight: '700', color: '#8A2BE2' },

  // Card
  card:       { backgroundColor: '#FFF', marginHorizontal: 12, marginVertical: 6,
                borderRadius: 14, padding: 14,
                ...Platform.select({
                  ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
                  android: { elevation: 3 },
                }) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:          { width: 36, height: 36, borderRadius: 18 },
  avatarFallback:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#8A2BE2',
                     justifyContent: 'center', alignItems: 'center' },
  avatarText:      { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  authorName:      { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  timeText:        { fontSize: 11, color: '#999', marginTop: 1 },
  postBadge:       { backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  postBadgeText:   { fontSize: 11, fontWeight: '600', color: '#666' },
  gameBadge:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  gameBadgeText:   { fontSize: 11, fontWeight: '700' },

  cardBody:    { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 10 },
  highlight:   { backgroundColor: '#FFF3CD', fontWeight: '700', color: '#8A2BE2' },

  cardActions: { flexDirection: 'row', gap: 20, paddingTop: 10,
                 borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText:  { fontSize: 13, color: '#666', fontWeight: '600' },

  descRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6,
                marginBottom: 10, backgroundColor: '#FAFAFA', borderRadius: 8, padding: 8 },
  descText:   { flex: 1, fontSize: 13, color: '#555', lineHeight: 18 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerMid:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 'auto' },
  footerText: { fontSize: 12, color: '#888', fontWeight: '600' },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
});
