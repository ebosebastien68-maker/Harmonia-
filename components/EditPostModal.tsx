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
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Remplace par l'URL de ton service Render ─────────────────────────────────
const API_BASE = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com/posts';
// ─────────────────────────────────────────────────────────────────────────────

interface EditPostModalProps {
  visible: boolean;
  postId: string | null;
  initialContent: string;
  onClose: () => void;
  onPostUpdated: () => void;
}

async function getAccessToken(): Promise<string> {
  const sessionStr = await AsyncStorage.getItem('harmonia_session');
  if (!sessionStr) throw new Error('Session introuvable');
  const session = JSON.parse(sessionStr);
  if (!session.access_token) throw new Error('access_token manquant');
  return session.access_token;
}

export default function EditPostModal({
  visible,
  postId,
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
      const access_token = await getAccessToken();
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit-post',
          post_id: postId,
          content: content.trim(),
          access_token,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onPostUpdated();
        onClose();
      }
    } catch (error) {
      console.error('[EditPostModal] handleEdit:', error);
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
      const access_token = await getAccessToken();
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-post',
          post_id: postId,
          access_token,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onPostUpdated();
        onClose();
      }
    } catch (error) {
      console.error('[EditPostModal] confirmDelete:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* ── CONFIRMATION SUPPRESSION ── */}
        {showDeleteConfirm ? (
          <View style={styles.confirmContent}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="warning-outline" size={38} color="#FF3B30" />
            </View>

            <Text style={styles.confirmTitle}>Supprimer le post ?</Text>
            <Text style={styles.confirmText}>
              Cette action est irréversible. Le post sera définitivement supprimé.
            </Text>

            <View style={styles.divider} />

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowDeleteConfirm(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteButton, deleting && styles.buttonDisabled]}
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={17} color="#FFF" />
                    <Text style={styles.confirmDeleteText}>Supprimer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

        /* ── MENU DE CHOIX ── */
        ) : showMenu ? (
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
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="create-outline" size={20} color="#7B1FA2" />
              </View>
              <Text style={styles.menuOptionText}>Modifier</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowDeleteConfirm(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#FFF1F0' }]}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </View>
              <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>
                Supprimer
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.menuCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>

        /* ── FORMULAIRE D'ÉDITION ── */
        ) : (
          <View style={styles.editContent}>
            <View style={styles.editHandle} />

            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={styles.backButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Modifier le post</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#9E9E9E" />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Quoi de neuf ?"
                placeholderTextColor="#BDBDBD"
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={500}
                autoFocus
              />
              <Text style={[
                styles.charCount,
                content.length > 450 && styles.charCountWarning,
              ]}>
                {content.length}/500
              </Text>
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!content.trim() || submitting) && styles.buttonDisabled,
                ]}
                onPress={handleEdit}
                disabled={!content.trim() || submitting}
                activeOpacity={0.85}
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
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },

  // ── Menu ──────────────────────────────────────────
  menuContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#7B1FA2',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  menuHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 14,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  menuOptionTextDanger: {
    color: '#FF3B30',
  },
  menuCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  menuCancelText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '600',
  },

  // ── Confirmation ──────────────────────────────────
  confirmContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  confirmIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF1F0',
    borderWidth: 2,
    borderColor: '#FFCDD2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 21,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444',
  },
  confirmDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    gap: 8,
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // ── Édition ───────────────────────────────────────
  editContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#7B1FA2',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  editHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  inputContainer: {
    padding: 20,
  },
  input: {
    fontSize: 16,
    color: '#212121',
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: '#BDBDBD',
    textAlign: 'right',
    marginTop: 6,
  },
  charCountWarning: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  editActions: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7B1FA2',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
