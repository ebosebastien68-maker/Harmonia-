import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ visible, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const maxChars = 500;

  const handleTextChange = (text: string) => {
    if (text.length <= maxChars) {
      setContent(text);
      setCharCount(text.length);
    }
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }

    setLoading(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (!session) return;

      const parsed = JSON.parse(session);

      const response = await fetch('https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'create-post',
          user_id: parsed.user.id,
          content: content.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setContent('');
        setCharCount(0);
        onPostCreated();
        onClose();
      } else {
        throw new Error(data.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setContent('');
      setCharCount(0);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={handleClose}
        />
        
        <View style={styles.modalContainer}>
          {/* Header moderne avec Gradient */}
          <LinearGradient
            colors={['#8A2BE2', '#4B0082']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Barre de "grab" visuelle pour l'effet Bottom Sheet moderne */}
            <View style={styles.grabBarContainer}>
              <View style={styles.grabBar} />
            </View>

            <View style={styles.headerToolbar}>
              <TouchableOpacity
                onPress={handleClose}
                disabled={loading}
                style={styles.iconButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Créer</Text>

              <TouchableOpacity
                onPress={handlePublish}
                disabled={loading || !content.trim()}
                style={[
                  styles.publishButton,
                  (!content.trim() || loading) && styles.publishButtonDisabled
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#8A2BE2" size="small" />
                ) : (
                  <>
                    <Text style={[
                      styles.publishButtonText,
                      !content.trim() && styles.publishButtonTextDisabled
                    ]}>Publier</Text>
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={content.trim() ? '#8A2BE2' : '#999'}
                      style={{ marginLeft: 4 }}
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Exprimez-vous..."
                placeholderTextColor="#A0A0A0"
                multiline
                maxLength={maxChars}
                value={content}
                onChangeText={handleTextChange}
                autoFocus
                editable={!loading}
                textAlignVertical="top"
              />
            </View>

            {/* Tools Bar & Counter */}
            <View style={styles.toolsContainer}>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity style={styles.toolButton} disabled={loading}>
                  <Ionicons name="image-outline" size={22} color="#8A2BE2" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolButton} disabled={loading}>
                  <Ionicons name="location-outline" size={22} color="#8A2BE2" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolButton} disabled={loading}>
                  <Ionicons name="happy-outline" size={22} color="#8A2BE2" />
                </TouchableOpacity>
              </View>

              <Text style={[
                styles.charCounter,
                charCount > maxChars * 0.9 && styles.charCounterWarning,
                charCount === maxChars && styles.charCounterMax
              ]}>
                {charCount} / {maxChars}
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)', // Fond un peu plus sombre pour le focus
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30, // Plus arrondi
    borderTopRightRadius: 30,
    height: '80%', // Hauteur fixe confortable
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  grabBarContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  grabBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  headerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', // Effet "Glass"
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff', // Bouton blanc contrastant
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  publishButtonDisabled: {
    backgroundColor: '#E0E0E0',
    elevation: 0,
  },
  publishButtonText: {
    color: '#8A2BE2',
    fontWeight: '700',
    fontSize: 14,
  },
  publishButtonTextDisabled: {
    color: '#999',
  },
  content: {
    flex: 1,
  },
  inputWrapper: {
    padding: 24,
    flex: 1,
  },
  input: {
    fontSize: 20, // Police plus grande
    color: '#1A1A1A',
    lineHeight: 28,
    minHeight: 120,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // Safe area
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 15, // Espacement moderne
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F0FF', // Fond très léger violet
    justifyContent: 'center',
    alignItems: 'center',
  },
  charCounter: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  charCounterWarning: {
    color: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  charCounterMax: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
  },
});
            
