import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const API_BASE_SEARCH = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/search';
const API_BASE_POSTS = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';

interface Post {
  id: string;
  author_id: string;
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
  user_liked: boolean;
  user_shared: boolean;
  user_saved: boolean;
}

interface SearchModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onPostPress: (postId: string) => void;
}

export default function SearchModal({
  visible,
  userId,
  onClose,
  onPostPress,
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [visible]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const response = await fetch(API_BASE_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'search-posts',
          user_id: userId,
          query: searchQuery.trim(),
        }),
      });

      const data = await response.json();

      if (data.success && data.posts) {
        setResults(data.posts);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string, liked: boolean) => {
    try {
      const response = await fetch(API_BASE_POSTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: liked ? 'like-post' : 'unlike-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, reactions: { ...post.reactions, likes: data.likes }, user_liked: liked }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

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

  const highlightQuery = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts;
  };

  const SearchResult = ({ post }: { post: Post }) => {
    const [liked, setLiked] = useState(post.user_liked);
    const highlighted = highlightQuery(post.content, searchQuery);

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <View style={styles.resultAuthor}>
            {post.author.avatar_url ? (
              <Image source={{ uri: post.author.avatar_url }} style={styles.resultAvatar} />
            ) : (
              <View style={styles.resultAvatarPlaceholder}>
                <Text style={styles.resultAvatarText}>
                  {getInitials(post.author.nom, post.author.prenom)}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.resultAuthorName}>
                {post.author.prenom} {post.author.nom}
              </Text>
              <Text style={styles.resultTime}>{formatTimeAgo(post.created_at)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.resultContent}>
          {typeof highlighted === 'string' ? (
            highlighted
          ) : (
            highlighted.map((part, index) => (
              <Text
                key={index}
                style={
                  part.toLowerCase() === searchQuery.toLowerCase()
                    ? styles.highlightedText
                    : {}
                }
              >
                {part}
              </Text>
            ))
          )}
        </Text>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={styles.resultAction}
            onPress={() => {
              const newLiked = !liked;
              setLiked(newLiked);
              handleLike(post.id, newLiked);
            }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? '#FF0080' : '#666'}
            />
            <Text style={[styles.resultActionText, liked && styles.resultActionTextActive]}>
              {post.reactions.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resultAction}
            onPress={() => {
              onClose();
              onPostPress(post.id);
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#666" />
            <Text style={styles.resultActionText}>{post.reactions.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resultAction}>
            <Ionicons name="repeat-outline" size={18} color="#666" />
            <Text style={styles.resultActionText}>{post.reactions.shares}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rechercher</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Mots-clés, hashtags..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setResults([]);
                  setSearched(false);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!searchQuery.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#FFF" />
                <Text style={styles.searchButtonText}>Rechercher</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={styles.loadingText}>Recherche en cours...</Text>
            </View>
          ) : searched && results.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={80} color="#CCC" />
              <Text style={styles.emptyText}>Aucun résultat</Text>
              <Text style={styles.emptySubtext}>
                Essayez avec d'autres mots-clés
              </Text>
            </View>
          ) : searched && results.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </Text>
              </View>
              {results.map(post => (
                <SearchResult key={post.id} post={post} />
              ))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={80} color="#DDD" />
              <Text style={styles.emptyText}>Rechercher des posts</Text>
              <Text style={styles.emptySubtext}>
                Entrez des mots-clés pour commencer
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 55 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  placeholder: {
    width: 34,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  results: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 8,
    textAlign: 'center',
  },
  resultsHeader: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A2BE2',
  },
  resultCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  resultHeader: {
    marginBottom: 10,
  },
  resultAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  resultAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  resultAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  resultTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  resultContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 10,
  },
  highlightedText: {
    backgroundColor: '#FFF3CD',
    fontWeight: '600',
    color: '#8A2BE2',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  resultAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultActionText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  resultActionTextActive: {
    color: '#FF0080',
  },
});
