// =====================================================
// PushPromptModal.tsx
// Popup d'invitation à activer les notifications
//
// • Apparaît 10 secondes
// • Compte à rebours visible
// • "Activer" → initPush() → permission OS/navigateur
// • "Ignorer" ou timeout → se transforme en bouton clochette
// =====================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import HarmoniaLogo       from './HarmoniaLogo';

const DURATION = 10; // secondes

interface Props {
  visible:   boolean;
  onAccept:  () => void;
  onDismiss: () => void;
}

export default function PushPromptModal({ visible, onAccept, onDismiss }: Props) {
  const [countdown, setCountdown]     = useState(DURATION);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Entrée animée
  useEffect(() => {
    if (visible) {
      setCountdown(DURATION);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();

      // Compte à rebours
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            onDismiss();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible]);

  const handleAccept = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onAccept();
  };

  const handleDismiss = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onDismiss();
  };

  // Progression du compte à rebours (0 → 1)
  const progress = (DURATION - countdown) / DURATION;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={S.overlay}>
        <Animated.View
          style={[
            S.card,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Dégradé de fond */}
          <LinearGradient
            colors={['#6D28D9', '#4C1D95']}
            style={S.gradient}
          />

          {/* Bouton fermer */}
          <TouchableOpacity style={S.closeBtn} onPress={handleDismiss}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Logo Harmonia */}
          <View style={S.logoWrap}>
            <View style={S.logoBg}>
              <HarmoniaLogo size={52} showText={false} theme="light" />
            </View>
          </View>

          {/* Texte */}
          <Text style={S.title}>Restez informé !</Text>
          <Text style={S.subtitle}>
            Recevez les annonces importantes, vos trophées et les nouvelles sessions d'Harmonia directement sur votre appareil.
          </Text>

          {/* Icônes illustratives */}
          <View style={S.iconsRow}>
            {[
              { icon: 'trophy',            color: '#FCD34D', label: 'Trophées'  },
              { icon: 'megaphone',         color: '#A78BFA', label: 'Annonces'  },
              { icon: 'game-controller',   color: '#6EE7B7', label: 'Sessions'  },
            ].map(item => (
              <View key={item.icon} style={S.iconItem}>
                <View style={[S.iconCircle, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={S.iconLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Boutons */}
          <TouchableOpacity style={S.btnAccept} onPress={handleAccept} activeOpacity={0.85}>
            <LinearGradient
              colors={['#EC4899', '#8B5CF6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={S.btnAcceptGrad}
            >
              <Ionicons name="notifications" size={18} color="#FFF" />
              <Text style={S.btnAcceptTxt}>Activer les notifications</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={S.btnDismiss} onPress={handleDismiss} activeOpacity={0.7}>
            <Text style={S.btnDismissTxt}>Ignorer ({countdown}s)</Text>
          </TouchableOpacity>

          {/* Barre de progression */}
          <View style={S.progressTrack}>
            <Animated.View style={[S.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 8,
    backgroundColor: '#4C1D95',
    ...Platform.select({
      ios:     { shadowColor: '#6D28D9', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24 },
      android: { elevation: 20 },
      default: {},
    }),
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  closeBtn: {
    position: 'absolute',
    top: 14, right: 14,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 18 },
  logoBg:   {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  // Texte
  title:    { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20, marginBottom: 22 },

  // Icônes
  iconsRow:   { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 },
  iconItem:   { alignItems: 'center', gap: 6 },
  iconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  iconLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },

  // Bouton Activer
  btnAccept:     { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  btnAcceptGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  btnAcceptTxt:  { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Bouton Ignorer
  btnDismiss:    { alignItems: 'center', paddingVertical: 10, marginBottom: 14 },
  btnDismissTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },

  // Barre de progression
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginHorizontal: -24 },
  progressFill:  { height: 3, backgroundColor: 'rgba(255,255,255,0.4)',  borderRadius: 2 },
});
            
