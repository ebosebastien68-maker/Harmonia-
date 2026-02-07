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

      // TODO: Appeler l'API pour créer le post
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
      // TODO: Afficher un message d'erreur
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
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={['#8A2BE2', '#4B0082']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={handleClose}
                disabled={loading}
                style={styles.headerButton}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Nouvelle publication</Text>
              <TouchableOpacity
                onPress={handlePublish}
                disabled={loading || !content.trim()}
                style={[
                  styles.headerButton,
                  (!content.trim() || loading) && styles.headerButtonDisabled
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFD700" size="small" />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={28}
                    color={content.trim() ? '#FFD700' : '#999'}
                  />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Quoi de neuf ?"
                placeholderTextColor="#999"
                multiline
                maxLength={maxChars}
                value={content}
                onChangeText={handleTextChange}
                autoFocus
                editable={!loading}
                textAlignVertical="top"
              />
            </View>

            {/* Character Counter */}
            <View style={styles.footer}>
              <Text style={[
                styles.charCounter,
                charCount > maxChars * 0.9 && styles.charCounterWarning,
                charCount === maxChars && styles.charCounterMax
              ]}>
                {charCount}/{maxChars}
              </Text>
            </View>

            {/* Action Buttons (Future features) */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} disabled={loading}>
                <Ionicons name="image-outline" size={24} color="#999" />
                <Text style={styles.actionButtonText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} disabled={loading}>
                <Ionicons name="location-outline" size={24} color="#999" />
                <Text style={styles.actionButtonText}>Lieu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} disabled={loading}>
                <Ionicons name="happy-outline" size={24} color="#999" />
                <Text style={styles.actionButtonText}>Humeur</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  header: {
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    padding: 5,
    width: 40,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    padding: 20,
    minHeight: 200,
  },
  input: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    minHeight: 150,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'flex-end',
  },
  charCounter: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  charCounterWarning: {
    color: '#FF9800',
  },
  charCounterMax: {
    color: '#F44336',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    alignItems: 'center',
    opacity: 0.4,
  },
  actionButtonText: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
  },
});
