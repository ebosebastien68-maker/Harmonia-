import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/posts';

interface EditPostModalProps {
  visible: boolean;
  postId: string | null;
  userId: string;
  initialContent: string;
  onClose: () => void;
  onPostUpdated: () => void;
}

export default function EditPostModal({
  visible,
  postId,
  userId,
  initialContent,
  onClose,
  onPostUpdated,
}: EditPostModalProps) {
  const [showMenu, setShowMenu] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setShowMenu(true);
      setShowDeleteConfirm(false);
      setContent(initialContent);
    }
  }, [visible, initialContent]);

  const handleEdit = async () => {
    if (!content.trim() || !postId || submitting) return;

    setSubmitting(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'edit-post',
          user_id: userId,
          post_id: postId,
          content: content.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        onPostUpdated();
        onClose();
      }
    } catch (error) {
      console.error('Error editing post:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!postId || deleting) return;

    setDeleting(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'delete-post',
          user_id: userId,
          post_id: postId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onPostUpdated();
        onClose();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        {showDeleteConfirm ? (
          /* CONFIRMATION DE SUPPRESSION */
          <View style={styles.confirmContent}>
            <Ionicons name="warning-outline" size={60} color="#FF3B30" />
            <Text style={styles.confirmTitle}>Supprimer le post ?</Text>
            <Text style={styles.confirmText}>
              Cette action est irréversible. Êtes-vous sûr de vouloir supprimer ce post ?
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowDeleteConfirm(false);
                }}
              >
                <Text style={styles.confirmCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteButton, deleting && styles.buttonDisabled]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : showMenu ? (
          /* MENU DE CHOIX */
          <View style={styles.menuContent}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Options du post</Text>
            
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowMenu(false);
              }}
            >
              <Ionicons name="create-outline" size={24} color="#8A2BE2" />
              <Text style={styles.menuOptionText}>Modifier</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, styles.menuOptionDanger]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowDeleteConfirm(true);
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>
                Supprimer
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* FORMULAIRE D'ÉDITION */
          <View style={styles.editContent}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Modifier le post</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Quoi de neuf ?"
                placeholderTextColor="#999"
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={500}
                autoFocus
              />
              <Text style={styles.charCount}>{content.length}/500</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.saveButton, (!content.trim() || submitting) && styles.buttonDisabled]}
                onPress={handleEdit}
                disabled={!content.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  
  // MENU DE CHOIX
  menuContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuOptionDanger: {},
  menuOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  menuOptionTextDanger: {
    color: '#FF3B30',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },

  // CONFIRMATION SUPPRESSION
  confirmContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // FORMULAIRE D'ÉDITION
  editContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    padding: 20,
  },
  input: {
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A2BE2',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
