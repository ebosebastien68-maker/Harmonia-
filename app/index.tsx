import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image,
  TouchableOpacity, Platform, Animated, ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import HarmoniaLogo from '../components/HarmoniaLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  purple:     '#6B21A8',
  purpleL:    '#7C3AED',
  purpleSoft: '#F3EEFF',
  gold:       '#F59E0B',
  goldSoft:   '#FFF8E8',
  blue:       '#2563EB',
  blueSoft:   '#EFF6FF',
  green:      '#059669',
  greenSoft:  '#ECFDF5',
  bg:         '#FAFAFA',
  white:      '#FFFFFF',
  text:       '#111827',
  textSub:    '#6B7280',
  textLight:  '#9CA3AF',
  border:     '#E5E7EB',
  shadow:     'rgba(107,33,168,0.10)',
};

// ─── Composants ───────────────────────────────────────────────────────────────

const Chip = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <View style={[styles.chip, { backgroundColor: bg }]}>
    <Text style={[styles.chipTxt, { color }]}>{label}</Text>
  </View>
);

const StatCard = ({ value, label, icon, color, bg }: {
  value: string; label: string; icon: string; color: string; bg: string;
}) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <Text style={{ fontSize: 24, marginBottom: 6 }}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const FeatureRow = ({ icon, title, desc, color, bg }: {
  icon: string; title: string; desc: string; color: string; bg: string;
}) => (
  <View style={styles.featureRow}>
    <View style={[styles.featureIconBox, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.featureRowTitle}>{title}</Text>
      <Text style={styles.featureRowDesc}>{desc}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={P.textLight} />
  </View>
);

const PrizeCard = ({ emoji, title, prize, tags, color, bg }: {
  emoji: string; title: string; prize: string; tags: string[]; color: string; bg: string;
}) => (
  <View style={[styles.prizeCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <View style={[styles.prizeEmoji, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.prizeTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {tags.map((t, i) => <Chip key={i} label={t} color={color} bg={bg} />)}
        </View>
      </View>
      <View style={[styles.prizeBadge, { backgroundColor: color }]}>
        <Text style={styles.prizeBadgeTxt}>{prize}</Text>
      </View>
    </View>
  </View>
);

const TestCard = ({ text, name, role, flag }: {
  text: string; name: string; role: string; flag: string;
}) => (
  <View style={styles.testCard}>
    <View style={styles.testStars}>
      {[1,2,3,4,5].map(i => <Ionicons key={i} name="star" size={14} color={P.gold} />)}
    </View>
    <Text style={styles.testText}>"{text}"</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
      <View style={styles.testAvatar}>
        <Text style={{ fontSize: 20 }}>{flag}</Text>
      </View>
      <View>
        <Text style={styles.testName}>{name}</Text>
        <Text style={styles.testRole}>{role}</Text>
      </View>
    </View>
  </View>
);

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const router  = useRouter();
  const lastTap = useRef<number>(0);

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (e: BeforeInstallPromptEvent) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBtn(true); };
    window.addEventListener('beforeinstallprompt', h as EventListener);
    window.addEventListener('appinstalled', () => { setShowInstallBtn(false); setInstallPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', h as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setShowInstallBtn(false); setInstallPrompt(null); }
  };

  const go = useCallback(() => router.push('/login'), []);

  const doubleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 300) { router.push('/auth-admin'); lastTap.current = 0; }
    else lastTap.current = now;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* PWA Banner */}
      {showInstallBtn && (
        <TouchableOpacity style={styles.pwaBanner} onPress={handleInstall} activeOpacity={0.9}>
          <LinearGradient colors={[P.purple, P.purpleL]} style={styles.pwaBannerInner}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <HarmoniaLogo size={24} showText={false} theme="light" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Installer Harmonia</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Accès rapide depuis votre écran</Text>
            </View>
            <View style={styles.pwaBtn}>
              <Text style={{ color: P.gold, fontWeight: '800', fontSize: 12 }}>Installer</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ══════════════════════════════════════════
            HERO — image 1.png en plein écran
        ══════════════════════════════════════════ */}
        <ImageBackground
          source={require('../assets/1.png')}
          style={styles.hero}
          imageStyle={{ opacity: 0.92, resizeMode: 'cover' }}
        >
          {/* Dégradé bas pour lisibilité du texte */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 0, y: 1 }}
          />

          <Animated.View style={[styles.heroContent, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            {/* Logo + nom */}
            <View style={styles.heroLogoRow}>
              <HarmoniaLogo size={52} showText={false} theme="light" />
              <Text style={styles.heroLogoName}>Harmonia</Text>
            </View>

            {/* Badge */}
            <View style={styles.heroBadge}>
              <View style={[styles.heroBadgeDot, { backgroundColor: '#4ADE80' }]} />
              <Text style={styles.heroBadgeTxt}>+50 000 membres actifs dans 120 pays</Text>
            </View>

            <Text style={styles.heroTitle}>
              Révélez votre{'\n'}
              <Text style={{ color: P.gold }}>talent</Text> au monde
            </Text>
            <Text style={styles.heroSub}>
              La plateforme qui connecte créateurs, gamers et{'\n'}entrepreneurs pour concourir et prospérer.
            </Text>

            <TouchableOpacity onPress={go} activeOpacity={0.88} style={{ width: '100%' }}>
              <LinearGradient colors={[P.gold, '#E8860A']} style={styles.heroCta}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.heroCtaTxt}>Démarrer gratuitement</Text>
                <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={go} style={styles.heroSecondary}>
              <Text style={styles.heroSecondaryTxt}>Découvrir les compétitions →</Text>
            </TouchableOpacity>
          </Animated.View>
        </ImageBackground>

        {/* ══════════════════════════════════════════
            STATS RAPIDES
        ══════════════════════════════════════════ */}
        <View style={styles.statsRow}>
          <StatCard value="50K+"  label="Membres"     icon="👥" color={P.purple} bg={P.purpleSoft} />
          <StatCard value="120"   label="Pays"        icon="🌍" color={P.blue}   bg={P.blueSoft}   />
          <StatCard value="500K€" label="Distribués"  icon="🏆" color={P.green}  bg={P.greenSoft}  />
          <StatCard value="4.9★"  label="Note"        icon="⭐" color={P.gold}   bg={P.goldSoft}   />
        </View>

        {/* ══════════════════════════════════════════
            VISION — image 2.png
        ══════════════════════════════════════════ */}
        <View style={styles.section}>
          <Chip label="NOTRE VISION" color={P.purple} bg={P.purpleSoft} />
          <Text style={styles.sectionTitle}>Une vision{'\n'}planétaire 🌍</Text>
          <Text style={styles.sectionSub}>
            Harmonia réunit les esprits brillants sans frontières. Artisans, créateurs numériques, gamers ou entrepreneurs — votre place est ici.
          </Text>

          {/* Image 2 affichée en grand */}
          <Image source={require('../assets/2.png')} style={styles.sectionImg} resizeMode="cover" />

          <View style={styles.featuresList}>
            <FeatureRow icon="🎯" title="Compétitions internationales" desc="Des concours ouverts à tous les niveaux, partout dans le monde."   color={P.purple} bg={P.purpleSoft} />
            <FeatureRow icon="💬" title="Chat temps réel"              desc="Groupes, messages privés et fils de discussion enrichis."           color={P.blue}   bg={P.blueSoft}   />
            <FeatureRow icon="📣" title="Feed social"                  desc="Partagez vos créations et suivez l'actualité de votre communauté."  color={P.green}  bg={P.greenSoft}  />
            <FeatureRow icon="🔔" title="Notifications push"           desc="Restez informé des concours, résultats et messages importants."    color={P.gold}   bg={P.goldSoft}   />
          </View>
        </View>

        {/* ══════════════════════════════════════════
            COMPÉTITIONS — image 3.png
        ══════════════════════════════════════════ */}
        <LinearGradient colors={[P.purpleSoft, '#EDE9FE']} style={styles.compSection}>
          <Chip label="COMPÉTITIONS" color={P.purple} bg={P.white} />
          <Text style={styles.sectionTitle}>Concours{'\n'}prestigieux 🏆</Text>
          <Text style={styles.sectionSub}>
            Des tournois internationaux avec des récompenses exceptionnelles pour tous les talents.
          </Text>

          {/* Image 3 affichée en grand */}
          <Image source={require('../assets/3.png')} style={styles.sectionImg} resizeMode="cover" />

          <View style={{ gap: 12, marginTop: 6 }}>
            <PrizeCard emoji="🎮" title="World Gaming Championship" prize="50 000€"
              tags={['Mondial','2 048 joueurs']} color={P.blue}   bg={P.blueSoft} />
            <PrizeCard emoji="🎨" title="Digital Arts Grand Prix"   prize="20 000€"
              tags={['International','834 artistes']} color={P.purple} bg={P.purpleSoft} />
            <PrizeCard emoji="💻" title="AI Innovation Hackathon"   prize="30 000€"
              tags={['Open','1 200 devs']}    color={P.green}  bg={P.greenSoft} />
            <PrizeCard emoji="🎤" title="Talent Show Africa"        prize="15 000€"
              tags={['Continental','600 talents']} color={P.gold}  bg={P.goldSoft} />
          </View>

          <TouchableOpacity onPress={go} activeOpacity={0.88} style={{ marginTop: 22 }}>
            <LinearGradient colors={[P.purple, P.purpleL]} style={styles.sectionCta}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.sectionCtaTxt}>Participer aux concours</Text>
              <Ionicons name="trophy-outline" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* ══════════════════════════════════════════
            COMMUNAUTÉ — image 4.png
        ══════════════════════════════════════════ */}
        <View style={styles.section}>
          <Chip label="COMMUNAUTÉ" color={P.green} bg={P.greenSoft} />
          <Text style={styles.sectionTitle}>Une famille{'\n'}mondiale 💎</Text>
          <Text style={styles.sectionSub}>
            Rejoignez des milliers de passionnés qui s'entraident, collaborent et progressent ensemble.
          </Text>

          {/* Image 4 affichée en grand */}
          <Image source={require('../assets/4.png')} style={styles.sectionImg} resizeMode="cover" />

          {/* Témoignages */}
          <View style={{ gap: 14, marginTop: 4 }}>
            <TestCard
              text="Harmonia a changé ma vie. J'ai gagné ma première compétition internationale et trouvé ma communauté."
              name="Kofi Mensah" role="Champion Gaming · Ghana" flag="🇬🇭"
            />
            <TestCard
              text="En 3 mois, mon audience a été multipliée par 10. Un réseau d'une qualité exceptionnelle."
              name="Amina Diallo" role="Artiste Digitale · Sénégal" flag="🇸🇳"
            />
            <TestCard
              text="Le hackathon Harmonia a lancé ma startup. Les mentors et les contacts sont inestimables."
              name="Youssef El Amri" role="Fondateur · Maroc" flag="🇲🇦"
            />
          </View>
        </View>

        {/* ══════════════════════════════════════════
            FINAL CTA — fond violet premium
        ══════════════════════════════════════════ */}
        <LinearGradient colors={[P.purple, '#4C1D95']} style={styles.finalSection}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {/* Cercles décoratifs */}
          <View style={styles.finalCircle1} />
          <View style={styles.finalCircle2} />

          <View style={styles.finalLogoRow}>
            <HarmoniaLogo size={50} showText={false} theme="light" />
            <Text style={styles.finalLogoName}>Harmonia</Text>
          </View>

          <Text style={styles.finalTitle}>
            Votre moment{'\n'}est venu ✨
          </Text>
          <Text style={styles.finalSub}>
            Ne laissez plus votre talent dans l'ombre.{'\n'}
            Rejoignez les meilleurs, dès aujourd'hui.
          </Text>

          <TouchableOpacity onPress={go} activeOpacity={0.88} style={{ width: '100%' }}>
            <LinearGradient colors={[P.gold, '#D97706']} style={styles.finalCta}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.finalCtaTxt}>🌟 Créer mon compte gratuitement</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.finalNote}>Gratuit · Sans carte bancaire · Accès immédiat</Text>

          <View style={styles.finalBadges}>
            {['Gaming', 'Arts', 'Tech', 'Spectacle', 'Business'].map((t, i) => (
              <View key={i} style={styles.finalTag}>
                <Text style={styles.finalTagTxt}>{t}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ══════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════ */}
        <View style={styles.footer}>
          <View style={styles.footerLogoRow}>
            <HarmoniaLogo size={28} showText={false} theme="dark" />
            <Text style={styles.footerBrand}>Harmonia</Text>
          </View>
          <View style={styles.footerSep} />
          <Text style={styles.footerCopy}>© 2024 Harmonia · Tous droits réservés</Text>
          <Text style={styles.footerTag}>
            Propulsant <Text onPress={doubleTap} style={{ color: P.purple }}>les</Text> talents vers l'infini.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: P.bg },
  scrollContent:{ paddingBottom: 0 },

  // PWA
  pwaBanner:      { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  pwaBannerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  pwaBtn:         { borderWidth: 1, borderColor: P.gold, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },

  // Hero
  hero:        { width: '100%', minHeight: 600, justifyContent: 'flex-end' },
  heroContent: { padding: 24, paddingBottom: 36, width: '100%' },
  heroLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  heroLogoName:{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  heroBadge:   { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  heroBadgeDot:{ width: 7, height: 7, borderRadius: 4 },
  heroBadgeTxt:{ color: '#fff', fontSize: 12, fontWeight: '600' },
  heroTitle:   { fontSize: 44, fontWeight: '900', color: '#fff', lineHeight: 52, marginBottom: 14, letterSpacing: -0.5 },
  heroSub:     { fontSize: 15, color: 'rgba(255,255,255,0.80)', lineHeight: 24, marginBottom: 28 },
  heroCta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17, borderRadius: 14, marginBottom: 12 },
  heroCtaTxt:  { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroSecondary:   { alignItems: 'center', paddingVertical: 8 },
  heroSecondaryTxt:{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },

  // Stats
  statsRow:  { flexDirection: 'row', backgroundColor: P.white, marginHorizontal: 16, marginTop: -24, borderRadius: 18, overflow: 'hidden', elevation: 6, shadowColor: P.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12 },
  statCard:  { flex: 1, alignItems: 'center', paddingVertical: 18, borderTopWidth: 3 },
  statValue: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 10, color: P.textLight, fontWeight: '500' },

  // Sections communes
  section:      { paddingHorizontal: 20, paddingVertical: 40 },
  compSection:  { paddingHorizontal: 20, paddingVertical: 40 },
  sectionTitle: { fontSize: 32, fontWeight: '900', color: P.text, lineHeight: 40, marginTop: 12, marginBottom: 12, letterSpacing: -0.5 },
  sectionSub:   { fontSize: 14, color: P.textSub, lineHeight: 23, marginBottom: 24 },
  sectionImg:   { width: '100%', height: 220, borderRadius: 18, marginBottom: 28 },
  sectionCta:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14 },
  sectionCtaTxt:{ color: '#fff', fontSize: 15, fontWeight: '800' },

  // Chip
  chip:    { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  // Feature rows
  featuresList: { gap: 4 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.border },
  featureIconBox:{ width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  featureRowTitle:{ fontSize: 14, fontWeight: '700', color: P.text, marginBottom: 3 },
  featureRowDesc: { fontSize: 12, color: P.textSub, lineHeight: 18 },

  // Prize cards
  prizeCard:   { backgroundColor: P.white, borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  prizeEmoji:  { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  prizeTitle:  { fontSize: 14, fontWeight: '700', color: P.text },
  prizeBadge:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  prizeBadgeTxt:{ color: '#fff', fontSize: 12, fontWeight: '800' },

  // Testimonials
  testCard:  { backgroundColor: P.white, borderRadius: 16, padding: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  testStars: { flexDirection: 'row', gap: 3, marginBottom: 12 },
  testText:  { fontSize: 13, color: P.text, lineHeight: 21, fontStyle: 'italic' },
  testAvatar:{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.purpleSoft, justifyContent: 'center', alignItems: 'center' },
  testName:  { fontSize: 13, fontWeight: '700', color: P.text },
  testRole:  { fontSize: 11, color: P.textSub },

  // Final CTA
  finalSection: { paddingHorizontal: 24, paddingVertical: 52, alignItems: 'center', overflow: 'hidden' },
  finalCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -80 },
  finalCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(245,158,11,0.08)', bottom: -50, left: -50 },
  finalLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  finalLogoName:{ fontSize: 24, fontWeight: '900', color: '#fff' },
  finalTitle:   { fontSize: 36, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 44, marginBottom: 14, letterSpacing: -0.5 },
  finalSub:     { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  finalCta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 15, width: '100%' },
  finalCtaTxt:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  finalNote:    { color: 'rgba(255,255,255,0.50)', fontSize: 12, marginTop: 14, marginBottom: 28 },
  finalBadges:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  finalTag:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  finalTagTxt:  { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '600' },

  // Footer
  footer:        { backgroundColor: P.white, paddingHorizontal: 24, paddingVertical: 30, alignItems: 'center', borderTopWidth: 1, borderTopColor: P.border },
  footerLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  footerBrand:   { fontSize: 18, fontWeight: '800', color: P.text },
  footerSep:     { width: '100%', height: 1, backgroundColor: P.border, marginBottom: 12 },
  footerCopy:    { fontSize: 12, color: P.textLight, marginBottom: 5 },
  footerTag:     { fontSize: 12, color: P.textLight },
});
