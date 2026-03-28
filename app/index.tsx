import React, { useRef, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  ImageBackground,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import HarmoniaLogo from '../components/HarmoniaLogo';

const { width } = Dimensions.get('window');

// ── Type manquant dans les types DOM standard ─────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
// ─────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const lastTap = useRef<number>(0);

  // ── PWA Install Prompt (web uniquement) ───────────────────────────────────
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault(); // Empêche le mini-infobar automatique du navigateur
      setInstallPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // Si déjà installé → ne pas montrer le bouton
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleInstall = async (): Promise<void> => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setInstallPrompt(null);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const navigateToLogin = () => {
    router.push('/login');
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      router.push('/auth-admin');
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />

      {/* ── Bouton installer PWA ── */}
      {showInstallBtn && (
        <TouchableOpacity style={styles.installBanner} onPress={handleInstall} activeOpacity={0.9}>
          <LinearGradient
            colors={['#8A2BE2', '#4B0082']}
            style={styles.installBannerGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <HarmoniaLogo size={28} showText={false} theme="light" />
            <View style={styles.installBannerText}>
              <Text style={styles.installBannerTitle}>Installer Harmonia</Text>
              <Text style={styles.installBannerSub}>Accès rapide depuis votre écran</Text>
            </View>
            <View style={styles.installBannerBtn}>
              <Ionicons name="download-outline" size={16} color="#FFF" />
              <Text style={styles.installBannerBtnTxt}>Installer</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {/* --- HERO SECTION --- */}
        <ImageBackground 
          source={require('../assets/1.png')} 
          style={styles.heroBackground}
          imageStyle={{ opacity: 0.15 }}
        >
          <View style={styles.heroContent}>
            {/* LOGO AVEC COMPOSANT */}
            <View style={styles.logoContainer}>
              <HarmoniaLogo size={80} showText={true} theme="light" />
            </View>
            
            <Text style={styles.heroTitle}>
              Révélez Votre <Text style={styles.textGradientBlue}>Talent</Text> au Monde
            </Text>
            
            <Text style={styles.heroSubtitle}>
              Révélez • Brillez • Triomphez • Prospérez
            </Text>

            <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.8}>
              <LinearGradient
                colors={['#FF0080', '#FF8C00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaText}>Démarrez Votre Ascension</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* --- SECTION 1: VISION --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            🌍 Une Vision <Text style={styles.textGradientGreen}>Planétaire</Text>
          </Text>
          
          <View style={styles.card}>
            <Text style={styles.paragraph}>
              Harmonia transcende les frontières et réunit les esprits brillants. 
              Que vous soyez artisan, créateur numérique, gamer ou entrepreneur, 
              <Text style={styles.boldHighlight}> votre place est ici.</Text>
            </Text>
            
            <Image 
              source={require('../assets/2.png')} 
              style={styles.contentImage} 
              resizeMode="cover"
            />
          </View>
        </View>

        {/* --- SECTION 2: COMPETITIONS --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            🏆 Compétitions <Text style={styles.textGradientRed}>Prestigieuses</Text>
          </Text>
          
          <Text style={styles.paragraphCenter}>
            Des concours internationaux d'envergure mondiale pour démontrer votre savoir-faire.
          </Text>

          <View style={styles.gridContainer}>
            <FeatureCard title="🎮 Gaming" desc="Tournois mondiaux" color={['#4facfe', '#00f2fe']} />
            <FeatureCard title="🎨 Arts" desc="Exposez votre génie" color={['#f093fb', '#f5576c']} />
            <FeatureCard title="💻 Tech" desc="Innovations futures" color={['#43e97b', '#38f9d7']} />
            <FeatureCard title="🎭 Spectacle" desc="Captivez le public" color={['#fa709a', '#fee140']} />
          </View>

          <Image 
            source={require('../assets/3.png')} 
            style={styles.contentImage} 
            resizeMode="cover"
          />

          <TouchableOpacity onPress={navigateToLogin} style={{marginTop: 20}}>
            <LinearGradient
              colors={['#11998e', '#38ef7d']}
              style={styles.ctaButtonSmall}
            >
              <Text style={styles.ctaTextSmall}>Participez aux Concours</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* --- SECTION 3: COMMUNAUTÉ & RÉCOMPENSES --- */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(138,43,226,0.1)', 'rgba(75,0,130,0.1)']}
            style={styles.highlightCard}
          >
            <Text style={styles.sectionTitleSmall}>💎 Récompenses & Communauté</Text>
            <Text style={styles.paragraph}>
              Nos lauréats reçoivent des prix en espèces considérables et une visibilité internationale.
              Rejoignez une famille de passionnés.
            </Text>
            
            <Image 
              source={require('../assets/4.png')} 
              style={styles.contentImage} 
              resizeMode="cover"
            />
          </LinearGradient>
        </View>

        {/* --- FINAL CTA --- */}
        <View style={[styles.sectionContainer, { marginBottom: 60 }]}>
          <Text style={styles.finalTitle}>Votre Moment est Venu</Text>
          <Text style={styles.paragraphCenter}>
            Ne laissez pas votre talent dans l'ombre.
          </Text>
          
          <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.8}>
            <LinearGradient
              colors={['#00c6ff', '#0072ff']}
              style={[styles.ctaButton, { marginTop: 20 }]}
            >
              <Text style={styles.ctaText}>🌟 Inscrivez-Vous Maintenant</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* --- FOOTER --- */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2024 Harmonia</Text>
          <Text style={styles.footerSubText}>
            Propulsant <Text onPress={handleDoubleTap}>les</Text> talents vers l'infini.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const FeatureCard = ({ title, desc, color }: { title: string, desc: string, color: string[] }) => (
  <View style={styles.featureCard}>
    <LinearGradient colors={color} style={styles.iconPlaceholder} />
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDesc}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingBottom: 40 },

  // ── Bannière installation PWA ──────────────────────────────────────────────
  installBanner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 1000,
  },
  installBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  installBannerText: { flex: 1 },
  installBannerTitle: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  installBannerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  installBannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  installBannerBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  heroBackground: { width: width, height: 500, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  heroContent: { alignItems: 'center', paddingHorizontal: 20, marginTop: 60 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  heroTitle: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#333', lineHeight: 44, marginBottom: 10 },
  heroSubtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30, fontStyle: 'italic' },
  textGradientBlue: { color: '#0072ff' },
  textGradientGreen: { color: '#11998e' },
  textGradientRed: { color: '#FF0080' },
  boldHighlight: { fontWeight: 'bold', color: '#333' },
  ctaButton: { paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, elevation: 5 },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase' },
  ctaButtonSmall: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  ctaTextSmall: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sectionContainer: { paddingHorizontal: 20, marginBottom: 40 },
  sectionTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  sectionTitleSmall: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  paragraph: { fontSize: 16, lineHeight: 24, color: '#555', marginBottom: 15, textAlign: 'justify' },
  paragraphCenter: { fontSize: 16, lineHeight: 24, color: '#555', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 2 },
  highlightCard: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(138,43,226,0.1)' },
  contentImage: { width: '100%', height: 200, borderRadius: 15, marginTop: 10 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  featureCard: { width: '48%', backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, alignItems: 'center', elevation: 2 },
  iconPlaceholder: { width: 40, height: 40, borderRadius: 20, marginBottom: 10 },
  featureTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 5, color: '#333' },
  featureDesc: { fontSize: 12, color: '#777', textAlign: 'center' },
  finalTitle: { fontSize: 30, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#333' },
  footer: { backgroundColor: '#fff', padding: 30, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
  footerText: { fontWeight: 'bold', color: '#8A2BE2', marginBottom: 5 },
  footerSubText: { color: '#999', fontSize: 12 },
});
