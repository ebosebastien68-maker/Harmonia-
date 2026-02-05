import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Notification {
  id: string;
  type: 'friend_request' | 'message' | 'game' | 'trophy' | 'post';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'friend_request',
      title: 'Nouvelle demande d\'ami',
      message: 'Alice Dupont souhaite être votre ami',
      time: 'il y a 5min',
      read: false,
    },
    {
      id: '2',
      type: 'game',
      title: 'Session Awalé',
      message: 'Run 4 vient de commencer !',
      time: 'il y a 15min',
      read: false,
    },
    {
      id: '3',
      type: 'trophy',
      title: '🏆 Nouveau trophée !',
      message: 'Vous avez débloqué "Champion Awalé"',
      time: 'il y a 1h',
      read: true,
    },
    {
      id: '4',
      type: 'message',
      title: 'Nouveau message',
      message: 'Bob Martin vous a envoyé un message',
      time: 'il y a 2h',
      read: true,
    },
    {
      id: '5',
      type: 'post',
      title: 'Nouvelle publication',
      message: 'Marie Kouassi a aimé votre publication',
      time: 'il y a 3h',
      read: true,
    },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return { name: 'person-add', color: '#8A2BE2' };
      case 'message':
        return { name: 'chatbubble', color: '#FF0080' };
      case 'game':
        return { name: 'game-controller', color: '#10B981' };
      case 'trophy':
        return { name: 'trophy', color: '#FFD700' };
      case 'post':
        return { name: 'heart', color: '#EF4444' };
      default:
        return { name: 'notifications', color: '#999' };
    }
  };

  const markAsRead = (id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      {/* Header Compact */}
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>Aucune notification</Text>
            <Text style={styles.emptySubtext}>Vous êtes à jour !</Text>
          </View>
        ) : (
          notifications.map((notif) => {
            const icon = getIcon(notif.type);
            return (
              <TouchableOpacity
                key={notif.id}
                style={[
                  styles.notifCard,
                  !notif.read && styles.notifCardUnread
                ]}
                onPress={() => markAsRead(notif.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
                  <Ionicons name={icon.name as any} size={24} color={icon.color} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifMessage}>{notif.message}</Text>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                </View>
                {!notif.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  unreadBadge: {
    backgroundColor: '#FF0080',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  notifCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 6,
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notifCardUnread: {
    backgroundColor: '#F0F8FF',
    borderLeftWidth: 3,
    borderLeftColor: '#8A2BE2',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  notifMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 5,
  },
  notifTime: {
    fontSize: 11,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8A2BE2',
    marginLeft: 10,
  },
});
