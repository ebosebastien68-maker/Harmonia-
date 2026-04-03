import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import HarmoniaLogo from '../components/HarmoniaLogo';

// ── Type PWA ──────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isWeb = Platform.OS === 'web';

// ── Palette design dark premium ───────────────────────────────────────────────
const C = {
  bg:           '#08080F',
  surface:      'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.07)',
  text:         '#FFFFFF',
  textSub:      'rgba(255,255,255,0.55)',
  textMuted:    'rgba(255,255,255,0.30)',
  gold:         '#F5A623',
  goldDim:      'rgba(245,166,35,0.15)',
  purple:       '#7C3AED',
  blue:         '#4FC3F7',
  green:        '#10B981',
  pink:         '#EC4899',
};

// ── Composants réutilisables ──────────────────────────────────────────────────

const StatBadge = ({ value, label, color }: { value: string; label: string; color: string }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statDot, { backgroundColor: color }]} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const FeatureCard = ({ icon, title, desc, gradient }: {
  icon: string; title: string; desc: string; gradient: string[];
}) => (
  <View style={styles.featureCard}>
    <LinearGradient colors={gradient} style={styles.featureIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </LinearGradient>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDesc}>{desc}</Text>
  </View>
);

const CompRow = ({ emoji, title, prize, level, color }: {
  emoji: string; title: string; prize: string; level: string; color: string;
}) => (
  <View style={[styles.compRow, { borderLeftColor: color }]}>
    <Text style={{ fontSize: 24 }}>{emoji}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.compTitle}>{title}</Text>
      <Text style={styles.compLevel}>{level}</Text>
    </View>
    <View style={[styles.compPrizeBadge, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
      <Text style={[styles.compPrize, { color }]}>{prize}</Text>
    </View>
  </View>
);

const TestimonialCard = ({ quote, name, role, avatar }: {
  quote: string; name: string; role: string; avatar: string;
}) => (
  <View style={styles.testimonialCard}>
    <Text style={styles.testimonialQuote}>"{quote}"</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={styles.testimonialAvatar}>
        <Text style={{ fontSize: 20 }}>{avatar}</Text>
      </View>
      <View>
        <Text style={styles.testimonialName}>{name}</Text>
        <Text style={styles.testimonialRole}>{role}</Text>
      </View>
    </View>
  </View>
);

// ── Page principale ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router  = useRouter();
  const lastTap = useRef<number>(0);

  // Animations d'entrée
  const fadeHero    = useRef(new Animated.Value(0)).current;
  const slideHero   = useRef(new Animated.Value(28)).current;
  const fadeContent = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeHero,  { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(slideHero, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
      Animated.timing(fadeContent, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // PWA install
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if (!isWeb) return;
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault(); setInstallPrompt(e); setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    window.addEventListener('appinstalled', () => { setShowInstallBtn(false); setInstallPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setShowInstallBtn(false); setInstallPrompt(null); }
  };

  const navigateToLogin = useCallback(() => router.push('/login'), []);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 300) { router.push('/auth-admin'); lastTap.current = 0; }
    else lastTap.current = now;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Bannière PWA ── */}
      {showInstallBtn && (
        <TouchableOpacity style={styles.pwaBanner} onPress={handleInstall} activeOpacity={0.9}>
          <LinearGradient colors={['#1A0A2E', '#2D1B69']} style={styles.pwaBannerInner}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <HarmoniaLogo size={26} showText={false} theme="light" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.pwaBannerTitle}>Installer Harmonia</Text>
              <Text style={styles.pwaBannerSub}>Accès instantané depuis votre écran</Text>
            </View>
            <View style={styles.pwaBannerBtn}>
              <Ionicons name="download-outline" size={14} color={C.gold} />
              <Text style={[styles.pwaBannerBtnTxt, { color: C.gold }]}>Installer</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ══════════════════════════════════════════
            HERO
        ══════════════════════════════════════════ */}
        <View style={styles.heroWrapper}>
          <LinearGradient colors={['#12082A', '#0D0520', '#08080F']}
            style={StyleSheet.absoluteFillObject} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} />

          {/* Halos décoratifs */}
          <View style={styles.haloTL} />
          <View style={styles.haloBR} />

          {/* Image de fond très subtile */}
          <ImageBackground source={require('../assets/1.png')}
            style={StyleSheet.absoluteFillObject} imageStyle={{ opacity: 0.04, resizeMode: 'cover' }} />

          <Animated.View style={[styles.heroInner, {
            opacity: fadeHero, transform: [{ translateY: slideHero }],
          }]}>
            {/* Logo — taille maîtrisée, centré */}
            <View style={styles.logoWrap}>
              <HarmoniaLogo size={68} showText={false} theme="light" />
            </View>

            {/* Badge live */}
            <View style={styles.heroBadge}>
              <View style={[styles.heroBadgeDot, { backgroundColor: C.green }]} />
              <Text style={styles.heroBadgeText}>Plateforme mondiale · En direct</Text>
            </View>

            {/* Titre */}
            <Text style={styles.heroTitle}>
              Révélez votre{'\n'}
              <Text style={{ color: C.gold }}>talent</Text> au monde
            </Text>
            <Text style={styles.heroSub}>
              La plateforme premium qui propulse créateurs,{'\n'}gamers et entrepreneurs vers l'excellence.
            </Text>

            {/* Boutons */}
            <View style={styles.heroCtas}>
              <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.85} style={{ flex: 1 }}>
                <LinearGradient colors={['#F5A623', '#E8860A']} style={styles.ctaPrimary}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.ctaPrimaryTxt}>Commencer gratuitement</Text>
                  <Ionicons name="arrow-forward" size={16} color="#000" />
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.85} style={styles.ctaGhost}>
                <Text style={styles.ctaGhostTxt}>Découvrir</Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatBadge value="50K+"  label="Membres"    color={C.gold}  />
              <View style={styles.statSep} />
              <StatBadge value="120+"  label="Pays"       color={C.blue}  />
              <View style={styles.statSep} />
              <StatBadge value="500K€" label="Distribués" color={C.green} />
            </View>
          </Animated.View>
        </View>

        {/* ══════════════════════════════════════════
            RESTE DU CONTENU (fade in après hero)
        ══════════════════════════════════════════ */}
        <Animated.View style={{ opacity: fadeContent }}>

          {/* ── Fonctionnalités ── */}
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <View style={[styles.sectionBar, { backgroundColor: C.purple }]} />
              <Text style={styles.sectionLabelTxt}>FONCTIONNALITÉS</Text>
            </View>
            <Text style={styles.sectionTitle}>Tout ce dont vous{'\n'}avez besoin, ici</Text>
            <Text style={styles.sectionSub}>Un écosystème complet pour votre croissance.</Text>

            <View style={styles.featuresGrid}>
              <FeatureCard icon="🎮" title="Tournois Gaming"   desc="Compétitions mondiales avec classements live."           gradient={['#4FC3F7','#1976D2']} />
              <FeatureCard icon="🎨" title="Arts & Créativité" desc="Exposez vos œuvres à une audience internationale."       gradient={['#EC4899','#9333EA']} />
              <FeatureCard icon="💻" title="Innovation Tech"   desc="Hackathons et challenges avec des prix majeurs."         gradient={['#10B981','#059669']} />
              <FeatureCard icon="🎭" title="Spectacle Live"    desc="Diffusez vos performances à des milliers de fans."      gradient={['#F5A623','#EF4444']} />
              <FeatureCard icon="💬" title="Chat & Groupes"    desc="Échangez avec votre communauté en temps réel."          gradient={['#7C3AED','#4C1D95']} />
              <FeatureCard icon="🏅" title="Récompenses"       desc="Badges, prix et visibilité internationale garantie."    gradient={['#F59E0B','#D97706']} />
            </View>
          </View>

          {/* ── Compétitions ── */}
          <View style={[styles.section, { paddingBottom: 8 }]}>
            <View style={styles.sectionLabel}>
              <View style={[styles.sectionBar, { backgroundColor: C.gold }]} />
              <Text style={styles.sectionLabelTxt}>COMPÉTITIONS</Text>
            </View>
            <Text style={styles.sectionTitle}>Concours en cours</Text>
          </View>

          <View style={styles.compCard}>
            <LinearGradient colors={['rgba(124,58,237,0.12)','rgba(245,166,35,0.05)']}
              style={styles.compCardInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <CompRow emoji="🎮" title="World Gaming Championship" prize="50 000€" level="Mondial · 2 048 joueurs"    color={C.blue}  />
              <View style={styles.compSep} />
              <CompRow emoji="🎨" title="Digital Arts Grand Prix"   prize="20 000€" level="International · 834 artistes" color={C.pink}  />
              <View style={styles.compSep} />
              <CompRow emoji="💻" title="AI Innovation Hackathon"   prize="30 000€" level="Open · 1 200 devs"           color={C.green} />
              <View style={styles.compSep} />
              <CompRow emoji="🎤" title="Talent Show Africa"        prize="15 000€" level="Continental · 600 talents"   color={C.gold}  />

              <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.85} style={{ marginTop: 22 }}>
                <LinearGradient colors={['#F5A623','#E8860A']} style={styles.compCta}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.compCtaTxt}>Voir tous les concours</Text>
                  <Ionicons name="trophy-outline" size={17} color="#000" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* ── Témoignages ── */}
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <View style={[styles.sectionBar, { backgroundColor: C.green }]} />
              <Text style={styles.sectionLabelTxt}>TÉMOIGNAGES</Text>
            </View>
            <Text style={styles.sectionTitle}>Ils témoignent</Text>

            <TestimonialCard
              quote="Harmonia m'a permis de gagner ma première compétition internationale. Incroyablement intuitif."
              name="Kofi Mensah" role="Champion Gaming · Ghana" avatar="🏆"
            />
            <TestimonialCard
              quote="En 3 mois, mon audience a été multipliée par 10 et j'ai décroché un contrat avec une agence parisienne."
              name="Amina Diallo" role="Artiste Digitale · Sénégal" avatar="🎨"
            />
            <TestimonialCard
              quote="Le hackathon Harmonia a lancé ma startup. Le réseau et les mentors sont d'une qualité rare."
              name="Youssef El Amri" role="Fondateur TechStart · Maroc" avatar="🚀"
            />
          </View>

          {/* ── Communauté ── */}
          <LinearGradient colors={['#12082A','#1A0A3E','#12082A']} style={styles.communityBanner}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={[styles.commHalo, { left: -40, top: -40, backgroundColor: C.purple }]} />
            <View style={[styles.commHalo, { right: -40, bottom: -40, backgroundColor: C.gold }]} />

            <Image source={require('../assets/4.png')} style={styles.communityImg} resizeMode="cover" />

            <Text style={styles.communityTitle}>Rejoignez une{'\n'}communauté mondiale</Text>
            <Text style={styles.communitySub}>
              50 000 passionnés vous attendent. Créateurs, gamers, entrepreneurs — votre tribu est ici.
            </Text>

            <View style={styles.communityStats}>
              {[
                { n: '50K+', l: 'Membres actifs',    c: C.gold  },
                { n: '98%',  l: 'Satisfaction',       c: C.green },
                { n: '4.9★', l: 'Note moyenne',       c: C.blue  },
              ].map((s, i) => (
                <View key={i} style={styles.commStat}>
                  <Text style={[styles.commStatN, { color: s.c }]}>{s.n}</Text>
                  <Text style={styles.commStatL}>{s.l}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.85}>
              <LinearGradient colors={['#F5A623','#E8860A']} style={styles.ctaPrimary}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.ctaPrimaryTxt}>Rejoindre la communauté</Text>
                <Ionicons name="people" size={17} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>

          {/* ── Final CTA ── */}
          <View style={styles.finalSection}>
            <LinearGradient colors={['rgba(245,166,35,0.07)','rgba(124,58,237,0.07)']}
              style={styles.finalCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <HarmoniaLogo size={44} showText={false} theme="light" />
                <Text style={styles.finalBrand}>Harmonia</Text>
              </View>
              <Text style={styles.finalTitle}>Votre moment est venu</Text>
              <Text style={styles.finalSub}>
                Ne laissez plus votre talent dans l'ombre.{'\n'}Rejoignez les meilleurs dès aujourd'hui.
              </Text>
              <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.85}>
                <LinearGradient colors={['#F5A623','#E8860A']}
                  style={[styles.ctaPrimary, { paddingHorizontal: 36 }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.ctaPrimaryTxt}>🌟 Créer mon compte</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.finalNote}>Gratuit · Sans carte bancaire · Accès immédiat</Text>
            </LinearGradient>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <HarmoniaLogo size={30} showText={false} theme="light" />
              <Text style={styles.footerBrand}>Harmonia</Text>
            </View>
            <View style={styles.footerSep} />
            <Text style={styles.footerCopy}>© 2024 Harmonia · Tous droits réservés</Text>
            <Text style={styles.footerTag}>
              Propulsant{' '}
              <Text onPress={handleDoubleTap} style={{ color: C.gold }}>les</Text>
              {' '}talents vers l'infini.
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── StyleSheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  // PWA Banner
  pwaBanner:      { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  pwaBannerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(245,166,35,0.15)' },
  pwaBannerTitle: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  pwaBannerSub:   { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  pwaBannerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(245,166,35,0.35)', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6 },
  pwaBannerBtnTxt:{ fontWeight: '700', fontSize: 12 },

  // Hero
  heroWrapper: { width: '100%', minHeight: 640, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', paddingBottom: 44 },
  haloTL:      { position: 'absolute', top: -80, left: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(124,58,237,0.18)' },
  haloBR:      { position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(245,166,35,0.10)' },
  heroInner:   { width: '100%', alignItems: 'center', paddingHorizontal: 22, paddingTop: 72 },
  logoWrap:    { marginBottom: 22 },

  heroBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 26 },
  heroBadgeDot: { width: 7, height: 7, borderRadius: 4 },
  heroBadgeText:{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  heroTitle:  { fontSize: 40, fontWeight: '900', color: C.text, textAlign: 'center', lineHeight: 48, marginBottom: 14, letterSpacing: -0.5 },
  heroSub:    { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 23, marginBottom: 34 },

  heroCtas:     { flexDirection: 'row', gap: 11, width: '100%', marginBottom: 36 },
  ctaPrimary:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 24, borderRadius: 13 },
  ctaPrimaryTxt:{ color: '#000', fontSize: 14, fontWeight: '800' },
  ctaGhost:     { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' },
  ctaGhostTxt:  { color: C.text, fontSize: 14, fontWeight: '600' },

  statsRow:   { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 15, borderWidth: 1, borderColor: C.border, paddingVertical: 15 },
  statBadge:  { flex: 1, alignItems: 'center', gap: 3 },
  statSep:    { width: 1, height: 34, backgroundColor: C.border },
  statDot:    { width: 6, height: 6, borderRadius: 3, marginBottom: 1 },
  statValue:  { fontSize: 20, fontWeight: '800' },
  statLabel:  { fontSize: 10, color: C.textMuted, fontWeight: '500' },

  // Sections
  section:       { paddingHorizontal: 20, paddingVertical: 38 },
  sectionLabel:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  sectionBar:    { width: 3, height: 13, borderRadius: 2 },
  sectionLabelTxt:{ fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 1.6 },
  sectionTitle:  { fontSize: 28, fontWeight: '800', color: C.text, lineHeight: 36, marginBottom: 9, letterSpacing: -0.3 },
  sectionSub:    { fontSize: 14, color: C.textSub, lineHeight: 22, marginBottom: 26 },

  // Features
  featuresGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  featureCard:   { width: '47.5%', backgroundColor: C.surface, borderRadius: 15, padding: 16, borderWidth: 1, borderColor: C.border },
  featureIcon:   { width: 42, height: 42, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 13 },
  featureTitle:  { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 5 },
  featureDesc:   { fontSize: 11, color: C.textSub, lineHeight: 17 },

  // Competitions
  compCard:      { marginHorizontal: 20, marginBottom: 38, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  compCardInner: { padding: 18 },
  compRow:       { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderLeftWidth: 3, paddingLeft: 13 },
  compTitle:     { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 3 },
  compLevel:     { fontSize: 11, color: C.textSub },
  compPrizeBadge:{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 18, borderWidth: 1 },
  compPrize:     { fontSize: 12, fontWeight: '800' },
  compSep:       { height: 1, backgroundColor: C.border, marginLeft: 13 },
  compCta:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 13, borderRadius: 11 },
  compCtaTxt:    { color: '#000', fontWeight: '800', fontSize: 14 },

  // Testimonials
  testimonialCard:  { backgroundColor: C.surface, borderRadius: 15, padding: 18, marginBottom: 11, borderWidth: 1, borderColor: C.border },
  testimonialQuote: { fontSize: 13, color: C.text, lineHeight: 21, marginBottom: 14, fontStyle: 'italic' },
  testimonialAvatar:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(245,166,35,0.15)', justifyContent: 'center', alignItems: 'center' },
  testimonialName:  { fontSize: 13, fontWeight: '700', color: C.text },
  testimonialRole:  { fontSize: 11, color: C.textSub, marginTop: 2 },

  // Community
  communityBanner: { paddingHorizontal: 22, paddingVertical: 36, overflow: 'hidden' },
  commHalo:        { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.13 },
  communityImg:    { width: '100%', height: 175, borderRadius: 15, marginBottom: 22 },
  communityTitle:  { fontSize: 26, fontWeight: '800', color: C.text, lineHeight: 34, marginBottom: 11, letterSpacing: -0.3 },
  communitySub:    { fontSize: 13, color: C.textSub, lineHeight: 21, marginBottom: 22 },
  communityStats:  { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 13, paddingVertical: 15, marginBottom: 26 },
  commStat:        { alignItems: 'center' },
  commStatN:       { fontSize: 20, fontWeight: '800', marginBottom: 3 },
  commStatL:       { fontSize: 10, color: C.textSub },

  // Final CTA
  finalSection: { paddingHorizontal: 20, paddingVertical: 38 },
  finalCard:    { borderRadius: 22, padding: 30, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  finalBrand:   { fontSize: 20, fontWeight: '800', color: C.text },
  finalTitle:   { fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 11, letterSpacing: -0.3 },
  finalSub:     { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 26 },
  finalNote:    { fontSize: 11, color: C.textMuted, marginTop: 15 },

  // Footer
  footer:      { backgroundColor: '#060610', paddingHorizontal: 22, paddingVertical: 30, alignItems: 'center' },
  footerBrand: { fontSize: 17, fontWeight: '800', color: C.text },
  footerSep:   { width: '100%', height: 1, backgroundColor: C.border, marginBottom: 14 },
  footerCopy:  { fontSize: 11, color: C.textMuted, marginBottom: 5 },
  footerTag:   { fontSize: 11, color: C.textMuted },
});
