import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages';
const STREAM_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/messages-stream';

interface Message {
  id: string;
  content: string;
  senderId: string;
  isFromMe: boolean;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  isRead?: boolean;
  type?: string;
  mediaUrl?: string;
}

interface ChatBoxProps {
  conversationId: string;
  conversationType: 'private' | 'group';
  userId: string;
  otherUser?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url: string | null;
    isOnline?: boolean;
  };
  groupName?: string;
  memberCount?: number;
  onBack: () => void;
}

export default function ChatBox({
  conversationId,
  conversationType,
  userId,
  otherUser,
  groupName,
  memberCount,
  onBack
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadMessages();
    markAsRead();
    setupRealtimeStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (conversationType === 'private') {
        updateTypingStatus(false);
      }
    };
  }, [conversationId]);

  // =====================
  // TEMPS RÉEL VIA SERVER-SENT EVENTS
  // =====================
  const setupRealtimeStream = () => {
    const streamUrl = conversationType === 'private'
      ? `${STREAM_BASE}?user_id=${userId}&conversation_id=${conversationId}`
      : `${STREAM_BASE}?user_id=${userId}&group_id=${conversationId}`;

    eventSourceRef.current = new EventSource(streamUrl);

    eventSourceRef.current.addEventListener('connected', () => {
      console.log('✅ Connexion temps réel établie');
    });

    eventSourceRef.current.addEventListener('new-message', async (event: any) => {
      const data = JSON.parse(event.data);
      
      await loadMessages();
      
      if (data.message.sender_id !== userId) {
        markAsRead();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    eventSourceRef.current.addEventListener('message-updated', () => {
      loadMessages();
    });

    eventSourceRef.current.addEventListener('typing-status', (event: any) => {
      const data = JSON.parse(event.data);
      setOtherUserTyping(data.isTyping);
    });

    eventSourceRef.current.addEventListener('heartbeat', () => {
      // Connexion maintenue
    });

    eventSourceRef.current.onerror = () => {
      console.log('❌ Erreur connexion temps réel, reconnexion...');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setTimeout(setupRealtimeStream, 5000);
    };
  };

  const loadMessages = async () => {
    try {
      const action = conversationType === 'private' ? 'get-conversation-messages' : 'get-group-messages';
      const idParam = conversationType === 'private' ? 'conversation_id' : 'group_id';

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action,
          [idParam]: conversationId,
          user_id: userId
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim()) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const content = messageInput.trim();
    setMessageInput('');
    setSending(true);

    if (conversationType === 'private') {
      updateTypingStatus(false);
    }

    try {
      const action = conversationType === 'private' ? 'send-private-message' : 'send-group-message';
      const idParam = conversationType === 'private' ? 'conversation_id' : 'group_id';

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action,
          user_id: userId,
          [idParam]: conversationId,
          content
        })
      });

      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        throw new Error('Erreur envoi');
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async () => {
    if (conversationType !== 'private') return;

    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'mark-as-read',
          conversation_id: conversationId,
          user_id: userId
        })
      });
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  const handleTyping = (text: string) => {
    setMessageInput(text);

    if (conversationType !== 'private') return;

    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const updateTypingStatus = async (typing: boolean) => {
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app'
        },
        body: JSON.stringify({
          action: 'update-typing-status',
          conversation_id: conversationId,
          user_id: userId,
          is_typing: typing
        })
      });
    } catch (error) {
      console.error('Erreur statut frappe:', error);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderAvatar = (size: number = 40) => {
    if (!otherUser) return null;

    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>
          {otherUser.prenom.charAt(0)}{otherUser.nom.charAt(0)}
        </Text>
        {otherUser.isOnline && (
          <View style={[styles.onlineIndicator, {
            width: size / 4,
            height: size / 4,
            borderRadius: size / 8,
            bottom: size / 20,
            right: size / 20
          }]} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* EN-TÊTE */}
      <LinearGradient colors={['#8A2BE2', '#4B0082']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {conversationType === 'private' ? (
          <>
            {renderAvatar(40)}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>
                {otherUser?.prenom} {otherUser?.nom}
              </Text>
              <Text style={styles.headerStatus}>
                {otherUserTyping
                  ? '✍️ En train d\'écrire...'
                  : otherUser?.isOnline
                    ? '🟢 En ligne'
                    : '⚪ Hors ligne'
                }
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.avatar, styles.groupAvatar, { width: 40, height: 40 }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{groupName}</Text>
              <Text style={styles.headerStatus}>{memberCount} membres</Text>
            </View>
          </>
        )}
      </LinearGradient>

      {/* MESSAGES */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8A2BE2" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={styles.emptyChatText}>Aucun message</Text>
            <Text style={styles.emptyChatSubtext}>Commencez la conversation !</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isFromMe ? styles.myMessage : styles.theirMessage
              ]}
            >
              {!message.isFromMe && conversationType === 'group' && (
                <Text style={styles.messageSender}>{message.senderName}</Text>
              )}
              <Text style={[
                styles.messageText,
                message.isFromMe ? styles.myMessageText : styles.theirMessageText
              ]}>
                {message.content}
              </Text>
              <Text style={[
                styles.messageTime,
                message.isFromMe ? styles.myMessageTime : styles.theirMessageTime
              ]}>
                {formatMessageTime(message.createdAt)}
                {message.isFromMe && message.isRead && ' ✓✓'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* INPUT MESSAGE - TOUJOURS VISIBLE */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Écrivez un message..."
            placeholderTextColor="#999"
            value={messageInput}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageInput.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!messageInput.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    marginRight: 12,
    padding: 5,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStatus: {
    fontSize: 12,
    color: '#E0D0FF',
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  groupAvatar: {
    backgroundColor: '#FF8C00',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
    bottom: 2,
    right: 2,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#8A2BE2',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A2BE2',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  myMessageTime: {
    color: '#E0D0FF',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
