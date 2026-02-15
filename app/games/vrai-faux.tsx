import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface VraiFauxTestProps {
  title: string;
  icon: string;
  color: string;
  onClose?: () => void;
}

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

export default function VraiFauxTest({ title, icon, color, onClose }: VraiFauxTestProps) {
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  const handleGoBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onClose) {
      onClose();
    }
  };

  // Calculer couleur gradient
  const darkerColor = color.replace(/[0-9A-F]{2}$/, (hex) => {
    const num = parseInt(hex, 16);
    const darker = Math.max(0, num - 40);
    return darker.toString(16).padStart(2, '0');
  });

  // Fonction pour récupérer le message du backend
  const fetchMessage = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const response = await fetch(`${BACKEND_URL}/vrai-faux`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: 'getMessage'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur serveur');
      }

      setMessage(data.message);
      setConnectionStatus(`✅ Connecté - ${data.from}`);

    } catch (err: any) {
      console.error('Erreur:', err);
      setError(err.message || 'Impossible de contacter le serveur');
      setConnectionStatus('❌ Déconnecté');
    } finally {
      setLoading(false);
    }
  };

  // Tester la connexion au chargement
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/vrai-faux`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: 'testConnection'
        })
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus(`✅ ${data.message}`);
      }
    } catch (err) {
      setConnectionStatus('❌ Backend non accessible');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient 
        colors={[color, darkerColor]} 
        style={styles.header}
      >
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {/* Icône */}
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={80} color={color} />
        </View>

        {/* Titre */}
        <Text style={styles.title}>🧪 Test Backend</Text>
        
        {/* Status connexion */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{connectionStatus}</Text>
        </View>

        {/* Message du backend */}
        {message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* Erreur */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Bouton pour récupérer un message */}
        <TouchableOpacity 
          style={[styles.fetchButton, loading && styles.fetchButtonDisabled]} 
          onPress={fetchMessage}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#999', '#666'] : [color, darkerColor]}
            style={styles.fetchButtonGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="sync" size={20} color="#FFF" />
            )}
            <Text style={styles.fetchButtonText}>
              {loading ? 'Chargement...' : 'Récupérer un message'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bouton retour */}
        <TouchableOpacity style={styles.backHomeButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={20} color="#FFF" />
          <Text style={styles.backHomeText}>Retour</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  messageContainer: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
    width: '100%',
  },
  messageText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    flex: 1,
  },
  fetchButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  fetchButtonDisabled: {
    opacity: 0.6,
  },
  fetchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  fetchButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  backHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8A2BE2',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  backHomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
          
