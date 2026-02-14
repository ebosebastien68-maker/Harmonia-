import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface ComingSoonProps {
  title: string;
  icon?: string;
  color?: string;
  description?: string;
  estimatedDate?: string;
}

export default function ComingSoon({
  title,
  icon = 'construct',
  color = '#8A2BE2',
  description,
  estimatedDate,
}: ComingSoonProps) {
  const router = useRouter();

  const handleGoBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[color, '#4B0082']} style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={80} color="#FFF" />
        </View>

        <Text style={styles.title}>Bientôt disponible !</Text>
        
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}

        {estimatedDate && (
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={20} color="#8A2BE2" />
            <Text style={styles.dateText}>Disponible : {estimatedDate}</Text>
          </View>
        )}

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Ce qui vous attend :</Text>
          
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.featureText}>Compétitions passionnantes</Text>
          </View>
          
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.featureText}>Classements en temps réel</Text>
          </View>
          
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.featureText}>Récompenses exclusives</Text>
          </View>
          
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.featureText}>Communauté active</Text>
          </View>
        </View>

        <View style={styles.ctaContainer}>
          <LinearGradient colors={['#FFD700', '#FF0080']} style={styles.ctaGradient}>
            <Ionicons name="notifications" size={24} color="#FFF" />
            <Text style={styles.ctaText}>
              Activez les notifications pour être informé du lancement !
            </Text>
          </LinearGradient>
        </View>

        <TouchableOpacity style={styles.backHomeButton} onPress={handleGoBack}>
          <Ionicons name="home" size={20} color="#8A2BE2" />
          <Text style={styles.backHomeText}>Retour à l'Arena</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 30,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A2BE2',
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
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
    }),
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#555',
  },
  ctaContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  ctaText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    lineHeight: 20,
  },
  backHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E6FF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  backHomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A2BE2',
  },
});
