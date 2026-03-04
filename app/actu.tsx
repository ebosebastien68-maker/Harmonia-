import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, RefreshControl, Modal, Dimensions, Platform,
  Animated, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import HarmoniaLogo from '../components/HarmoniaLogo';
import CreatePostModal from '../components/CreatePostModal';
import CommentsModal from '../components/CommentsModal';
import LikersModal from '../components/LikersModal';
import EditPostModal from '../components/EditPostModal';
import SavedPostsModal from '../components/SavedPostsModal';
import SearchModal from '../components/SearchModal';
import LogoutModal from '../components/LogoutModal';

const { width }      = Dimensions.get('window');
const BACKEND_URL    = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const API_BASE_HOME  = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/home';
const API_BASE_POSTS = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';
const HEADER_HEIGHT  = 75;
const NATIVE         = Platform.OS !== 'web';


// ─── Types ────────────────────────────────────────────────────────────────────
type FilterMode = 'all' | 'posts' | 'images';

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

interface SubmissionImage {
  id: string;
  image_url: string;
  description?: string | null;
  votes: number;
  user_voted: boolean;
}

interface Submission {
  item_type: 'submission';
  id: string;
  run_id: string;
  session_id: string;
  user_id: string;
  run_number: number;
  run_title: string;
  author: { nom: string; prenom: string; avatar_url: string | null };
  images: SubmissionImage[];
  total_votes: number;
  created_at: string;
}

type FeedItem = Post | Submission;
interface UserProfile { solde_cfa: number; trophies_count: number }

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

  // Modals
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

  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastTap,       setLastTap]       = useState<number | null>(null);
  const headerAnim    = useRef(new Animated.Value(0)).current;

  const userIdRef     = useRef('');
  const tokenRef      = useRef('');
  const filterRef     = useRef<FilterMode>('all');

  // ─── Init session ─────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('harmonia_session').then(raw => {
      if (!raw) return;
      const s = JSON.parse(raw);
      userIdRef.current  = s.user.id;
      tokenRef.current   = s.access_token;
      setUserId(s.user.id);
      setAccessToken(s.access_token);
    });
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) return;
    // Chargement initial
    loadPosts();
    loadSubmissions();

  }, [userId, accessToken]);

  // ─── Chargement posts ─────────────────────────────────────────────────────
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

  // Version silencieuse (pas de loader visible)

  const loadSubmissions = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/feed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          function:     'getSubmissions',
          user_id:      userIdRef.current,
          access_token: tokenRef.current,
        }),
      });
      const data = await res.json();
      if (data.submissions) {
        setSubmissions(data.submissions.map((s: any) => ({ ...s, item_type: 'submission' })));
      }
    } catch (err) { console.error('Error loading submissions:', err); }
  }, []);


  const onRefresh = async () => {
    setRefreshing(true);
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (filterMode !== 'images') await loadPosts();
    if (filterMode !== 'posts')  await loadSubmissions();
    setRefreshing(false);
  };

  // ─── Refresh manuel ───────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    if (filterRef.current !== 'images') await loadPosts();
    if (filterRef.current !== 'posts')  await loadSubmissions();
    setIsRefreshing(false);
  };

  // ─── Filtre — requête complète à chaque changement ────────────────────────
  const applyFilter = async (mode: FilterMode) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    filterRef.current = mode;
    setFilterMode(mode);
    setShowFilter(false);
    // Requête complète selon le filtre choisi
    if (mode === 'posts')  { await loadPosts(); }
    if (mode === 'images') { await loadSubmissions(); }
    if (mode === 'all')    { await Promise.all([loadPosts(), loadSubmissions()]); }
  };

  // ─── Items affichés ───────────────────────────────────────────────────────
  const displayedItems: FeedItem[] = (() => {
    if (filterMode === 'posts')  return posts;
    if (filterMode === 'images') return submissions;
    return [...posts, ...submissions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  // ─── Header toggle ────────────────────────────────────────────────────────
  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap && now - lastTap < 300) toggleHeader();
    else setLastTap(now);
  };

  const toggleHeader = () => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(headerAnim, {
      toValue: headerVisible ? -HEADER_HEIGHT : 0,
      useNativeDriver: true, tension: 80, friction: 10,
    }).start();
    setHeaderVisible(!headerVisible);
  };

  // ─── Post actions ─────────────────────────────────────────────────────────
  const handleLike = async (postId: string, liked: boolean) => {
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
  };

  const handleShare = async (postId: string, shared: boolean) => {
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
  };

  const handleSave = async (postId: string, saved: boolean) => {
    const res  = await fetch(API_BASE_POSTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://harmonia-world.vercel.app' },
      body: JSON.stringify({ action: saved ? 'save-post' : 'unsave-post', user_id: userId, post_id: postId }),
    });
    const data = await res.json();
    if (data.success) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_saved: saved } : p));
    }
  };

  // ─── Vote soumission ──────────────────────────────────────────────────────
  const handleVote = async (submissionKey: string, imageId: string, currentlyVoted: boolean) => {
    if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res  = await fetch(`${BACKEND_URL}/feed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          function:      currentlyVoted ? 'unvoteSubmission' : 'voteSubmission',
          user_id:       userId,
          access_token:  accessToken,
          submission_id: imageId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(prev => prev.map(sub => {
          if (sub.id !== submissionKey) return sub;
          const newImages = sub.images.map(img =>
            img.id === imageId
              ? { ...img, votes: data.votes, user_voted: data.user_voted }
              : img
          );
          return { ...sub, images: newImages, total_votes: newImages.reduce((s, i) => s + i.votes, 0) };
        }));
      }
    } catch (err) { console.error('Error voting:', err); }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatTimeAgo = (dateString: string) => {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60)    return "À l'instant";
    if (diff < 3600)  return `il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return `il y a ${Math.floor(diff / 86400)}j`;
  };

  const getInitials = (nom: string, prenom: string) =>
    `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  // ─── PostCard ─────────────────────────────────────────────────────────────
  const PostCard = ({ post }: { post: Post }) => {
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

    const onLike = async () => {
      if (isAnim) return; setIsAnim(true);
      if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newLiked = !liked;
      setLiked(newLiked); setLikesCount(p => newLiked ? p + 1 : p - 1);
      try { await handleLike(post.id, newLiked); }
      catch { setLiked(!newLiked); setLikesCount(p => newLiked ? p - 1 : p + 1); }
      finally { setTimeout(() => setIsAnim(false), 300); }
    };

    const onShare = async () => {
      if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newShared = !shared;
      setShared(newShared); setSharesCount(p => newShared ? p + 1 : p - 1);
      try { await handleShare(post.id, newShared); }
      catch { setShared(!newShared); setSharesCount(p => newShared ? p - 1 : p + 1); }
    };

    const onSave = async () => {
      if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newSaved = !saved; setSaved(newSaved);
      try { await handleSave(post.id, newSaved); }
      catch { setSaved(!newSaved); }
    };

    return (
      <TouchableOpacity style={styles.postCard} activeOpacity={0.98} onLongPress={() => setSelectedPost(post)}>
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
            <TouchableOpacity onPress={() => { setSelectedPostForEdit({ id: post.id, content: post.content }); setShowEditModal(true); }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.postContent}>{post.content}</Text>

        <View style={styles.statsBar}>
          <TouchableOpacity onPress={() => { if (likesCount > 0) { setSelectedPostForLikers(post.id); setShowLikersModal(true); } }}>
            <Text style={styles.statsText}>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</Text>
          </TouchableOpacity>
          <View style={styles.statsRight}>
            <Text style={styles.statsText}>{post.reactions.comments} commentaires</Text>
            <Text style={styles.statsSep}>•</Text>
            <Text style={styles.statsText}>{sharesCount} partages</Text>
          </View>
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity style={[styles.actionBtn, liked && styles.actionBtnActive]} onPress={onLike} disabled={isAnim}>
            <LinearGradient colors={liked ? ['#FF0080','#FF0080'] : ['transparent','transparent']} style={styles.actionGrad}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#FFF' : '#666'} />
              <Text style={[styles.actionText, liked && styles.actionTextActive]}>{liked ? 'Aimé' : 'Aimer'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPostForComments(post.id); setShowCommentsModal(true); }}>
            <View style={styles.actionGrad}>
              <Ionicons name="chatbubble-outline" size={20} color="#666" />
              <Text style={styles.actionText}>Commenter</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, shared && styles.actionBtnActive]} onPress={onShare}>
            <LinearGradient colors={shared ? ['#10B981','#10B981'] : ['transparent','transparent']} style={styles.actionGrad}>
              <Ionicons name={shared ? 'repeat' : 'repeat-outline'} size={22} color={shared ? '#FFF' : '#666'} />
              <Text style={[styles.actionText, shared && styles.actionTextActive]}>{shared ? 'Partagé' : 'Partager'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? '#FFD700' : '#666'} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── SubmissionCard ───────────────────────────────────────────────────────
  const SubmissionCard = ({ sub }: { sub: Submission }) => {
    const [images,     setImages]     = useState(sub.images);
    const [totalVotes, setTotalVotes] = useState(sub.total_votes);

    useEffect(() => { setImages(sub.images); setTotalVotes(sub.total_votes); }, [sub]);

    const onVote = async (imageId: string, currentlyVoted: boolean) => {
      const updated = images.map(img =>
        img.id === imageId
          ? { ...img, votes: currentlyVoted ? img.votes - 1 : img.votes + 1, user_voted: !currentlyVoted }
          : img
      );
      setImages(updated);
      setTotalVotes(updated.reduce((s, i) => s + i.votes, 0));
      await handleVote(sub.id, imageId, currentlyVoted);
    };

    return (
      <View style={styles.subCard}>
        <View style={styles.subHeader}>
          <View style={styles.artsBadge}>
            <Text style={styles.artsBadgeText}>🎨 Arts</Text>
          </View>
          <View style={styles.postAuthor}>
            {sub.author.avatar_url
              ? <Image source={{ uri: sub.author.avatar_url }} style={styles.avatar} />
              : <View style={[styles.avatarPlaceholder, { backgroundColor: '#8E44AD' }]}>
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

        <FlatList
          data={images}
          keyExtractor={img => img.id}
          horizontal
          pagingEnabled={images.length > 1}
          showsHorizontalScrollIndicator={false}
          style={styles.imagesList}
          renderItem={({ item: img, index }) => (
            <View style={[styles.imageSlide, { width: images.length > 1 ? width - 48 : width - 24 }]}>
              <Image source={{ uri: img.image_url }} style={styles.subImage} resizeMode="cover" />
              {images.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>{index + 1}/{images.length}</Text>
                </View>
              )}
              {img.description ? <Text style={styles.imgDesc} numberOfLines={2}>{img.description}</Text> : null}
              <TouchableOpacity
                style={[styles.voteBtn, img.user_voted && styles.voteBtnVoted]}
                onPress={() => onVote(img.id, img.user_voted)}
                activeOpacity={0.8}
              >
                {img.user_voted
                  ? <><Text style={styles.voteBtnText}>Voté 💪</Text><Text style={styles.voteBtnCount}>{img.votes}</Text></>
                  : <><Ionicons name="heart-outline" size={16} color="#FFF" /><Text style={styles.voteBtnText}>Voter</Text><Text style={styles.voteBtnCount}>{img.votes}</Text></>}
              </TouchableOpacity>
            </View>
          )}
        />

        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => <View key={i} style={styles.dot} />)}
          </View>
        )}
      </View>
    );
  };

  const filterLabel: Record<FilterMode, string> = { all: 'Tout', posts: 'Publications', images: 'Images' };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerAnim }] }]}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>

          {/* Ligne 1 : Logo + Solde */}
          <View style={styles.headerTop}>
            <HarmoniaLogo size={26} showText={true} />
            <View style={styles.balanceBox}>
              <Ionicons name="wallet-outline" size={14} color="#FFD700" />
              <Text style={styles.balanceText}>
                {userProfile?.solde_cfa?.toLocaleString() || '0'} CFA
              </Text>
            </View>
          </View>

          {/* Ligne 2 : Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.filterBtn} onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilter(true); }}>
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

              <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSearchModal(true); }}>
                <Ionicons name="search-outline" size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreateModal(true); }}>
                <LinearGradient colors={['#FFD700','#FF0080']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.createBtnGrad}>
                  <Ionicons name="add" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

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
                ? <PostCard       key={item.id} post={item} />
                : <SubmissionCard key={item.id} sub={item}  />
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal filtre */}
      <Modal visible={showFilter} transparent animationType="fade" onRequestClose={() => setShowFilter(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilter(false)}>
          <View style={styles.filterMenu}>
            <Text style={styles.filterMenuTitle}>Afficher</Text>
            {([
              { key: 'all',    label: 'Tout',         icon: 'apps-outline'          },
              { key: 'posts',  label: 'Publications', icon: 'document-text-outline'  },
              { key: 'images', label: 'Images',       icon: 'images-outline'         },
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

      {/* Modal détail post */}
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
      <SearchModal visible={showSearchModal} userId={userId} onClose={() => setShowSearchModal(false)} onPostPress={(postId) => { setSelectedPostForComments(postId); setShowCommentsModal(true); }} />
      <LogoutModal visible={showLogoutModal} userId={userId} onClose={() => setShowLogoutModal(false)} onLogoutSuccess={async () => { await AsyncStorage.removeItem('harmonia_session'); router.replace('/login'); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  header:          { paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 8, paddingHorizontal: 14 },

  // Header ligne 1 : Logo + Solde
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  balanceText:  { color: '#FFD700', fontSize: 12, fontWeight: '800' },

  // Header ligne 2 : Filtre + Actions
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
  imageCounter:     { position: 'absolute', top: 12, right: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  imageCounterText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  imgDesc:          { fontSize: 13, color: '#555', marginTop: 8, paddingHorizontal: 4 },
  voteBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#8A2BE2', borderRadius: 25, paddingVertical: 10, paddingHorizontal: 20, marginTop: 12, marginBottom: 4, alignSelf: 'center' },
  voteBtnVoted:     { backgroundColor: '#E74C3C' },
  voteBtnText:      { color: '#FFF', fontWeight: '700', fontSize: 14 },
  voteBtnCount:     { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  dots:             { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },

  filterOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-start', paddingTop: Platform.OS === 'ios' ? 110 : 90, paddingLeft: 14 },
  filterMenu:            { backgroundColor: '#FFF', borderRadius: 16, padding: 8, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  filterMenuTitle:       { color: '#999', fontSize: 11, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, textTransform: 'uppercase' },
  filterOption:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  filterOptionActive:    { backgroundColor: '#F0E6FF' },
  filterOptionText:      { flex: 1, fontSize: 14, color: '#333', fontWeight: '600' },
  filterOptionTextActive:{ color: '#8A2BE2' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: width * 0.85, maxWidth: 400 },
  modalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInfo:    { marginBottom: 12 },
  modalLabel:   { fontSize: 12, color: '#999', marginBottom: 3 },
  modalValue:   { fontSize: 14, color: '#333', fontWeight: '600' },
  modalBtn:     { backgroundColor: '#8A2BE2', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
