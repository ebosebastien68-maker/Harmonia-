import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/friends';
const DEFAULT_AVATAR = require('./assets/default-avatar.png');

interface MyProfile {
  id: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  avatar_url?: string;
  solde_cfa: number;
  trophies_count: number;
  created_at: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Récupérer l'user_id de la session
  const getUserId = async (): Promise<string | null> => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.user?.id || null;
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }
    return null;
  };

  // Charger le profil
  const loadProfile = async () => {
    setLoading(true);

    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-my-profile',
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Choisir une photo de profil
  const pickImage = async () => {
    // Demander la permission
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder à vos photos.');
        return;
      }
    }

    // Ouvrir la galerie
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  // Upload avatar
  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);

    const userId = await getUserId();
    if (!userId) {
      setUploadingAvatar(false);
      return;
    }

    try {
      // Créer FormData
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as any);

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'update-avatar',
          user_id: userId,
          avatar_data: uri, // Pour l'instant, on envoie juste l'URI
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadProfile(); // Recharger le profil
        Alert.alert('Succès', 'Photo de profil mise à jour');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Déconnexion
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('harmonia_session');
            router.replace('/login');
          },
        },
      ]
    );
  };

  // Ouvrir les paramètres (placeholder)
  const openSettings = () => {
    Alert.alert('Paramètres', 'Cette fonctionnalité sera disponible prochainement');
  };

  // Ouvrir SoldEdit (placeholder)
  const openSoldEdit = () => {
    Alert.alert('Gestion du solde', 'Cette fonctionnalité sera disponible prochainement');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Impossible de charger le profil</Text>
        <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header avec dégradé */}
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          {/* Photo de profil */}
          <View style={styles.avatarContainer}>
            <Image
              source={profile.avatar_url ? { uri: profile.avatar_url } : DEFAULT_AVATAR}
              style={styles.avatar}
            />
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={pickImage}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Nom complet */}
          <Text style={styles.name}>
            {profile.prenom} {profile.nom}
          </Text>

          {/* Date d'inscription */}
          <Text style={styles.memberSince}>
            Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </LinearGradient>

      {/* Contenu */}
      <View style={styles.content}>
        {/* Statistiques */}
        <View style={styles.statsContainer}>
          {/* Solde (cliquable) */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={openSoldEdit}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#10B981', '#34D399']}
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="wallet" size={28} color="#fff" />
              <Text style={styles.statValue}>{profile.solde_cfa.toLocaleString()} CFA</Text>
              <Text style={styles.statLabel}>Solde</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" style={styles.statArrow} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Trophées */}
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="trophy" size={28} color="#fff" />
              <Text style={styles.statValue}>{profile.trophies_count}</Text>
              <Text style={styles.statLabel}>Trophées</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Informations personnelles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>

          {/* Date de naissance */}
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={24} color="#8A2BE2" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date de naissance</Text>
              <Text style={styles.infoValue}>
                {new Date(profile.date_naissance).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {/* Paramètres */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={openSettings}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="settings-outline" size={24} color="#666" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Paramètres</Text>
              <Text style={styles.actionDescription}>Gérer vos préférences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Déconnexion */}
          <TouchableOpacity
            style={[styles.actionCard, styles.logoutCard]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, styles.logoutIcon]}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionLabel, styles.logoutLabel]}>Déconnexion</Text>
              <Text style={styles.actionDescription}>Se déconnecter du compte</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8A2BE2',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E0E0E0',
    borderWidth: 4,
    borderColor: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      },
    }),
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statArrow: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0E6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#999',
  },
  logoutCard: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  logoutIcon: {
    backgroundColor: '#FEE2E2',
  },
  logoutLabel: {
    color: '#EF4444',
  },
});
