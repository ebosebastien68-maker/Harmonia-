import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  ImageBackground 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import HarmoniaLogo from '../components/HarmoniaLogo';

const { width } = Dimensions.get('window');

export default function LandingPage() {
  const router = useRouter();

  const navigateToLogin = () => {
    router.push('/login');
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />
      
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
          <Text style={styles.footerSubText}>Propulsant les talents vers l'infini.</Text>
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
  heroBackground: { width: width, height: 500, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  heroContent: { alignItems: 'center', paddingHorizontal: 20, marginTop: 60 },
  // Nouveau style container pour le logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
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
