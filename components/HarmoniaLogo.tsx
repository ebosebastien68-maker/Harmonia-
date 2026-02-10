import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';

interface HarmoniaLogoProps {
  size?: number;
  showText?: boolean;
  theme?: 'light' | 'dark';
}

export default function HarmoniaLogo({ 
  size = 48, 
  showText = true,
  theme = 'dark' 
}: HarmoniaLogoProps) {
  
  const isDark = theme === 'dark';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const accentColor = '#F59E0B'; // Ambre Doré
  const secondaryAccent = '#38BDF8'; // Bleu Ciel Tech

  return (
    <View style={styles.container}>
      {/* --- LOGO SYMBOL (Modernisé : Abstrait & Géométrique) --- */}
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Defs>
            {/* Dégradé Bleu Profond (Terre/Tech) */}
            <LinearGradient id="blueGradient" x1="10%" y1="10%" x2="90%" y2="90%">
              <Stop offset="0%" stopColor="#0EA5E9" />
              <Stop offset="100%" stopColor="#2563EB" />
            </LinearGradient>

            {/* Dégradé Or Riche (Luxe/Dynamisme) */}
            <LinearGradient id="goldGradient" x1="0%" y1="50%" x2="100%" y2="50%">
              <Stop offset="0%" stopColor="#FBBF24" />
              <Stop offset="100%" stopColor="#D97706" />
            </LinearGradient>
          </Defs>

          {/* L'Orbe Central (La Terre simplifiée) */}
          <Circle cx="50" cy="50" r="22" fill="url(#blueGradient)" />
          
          {/* Reflet subtil sur l'orbe pour effet 3D */}
          <Circle cx="44" cy="42" r="8" fill="white" opacity="0.2" />

          {/* Anneaux dynamiques (L'Harmonie/Les Ailes abstraites) */}
          <G transform="rotate(-15, 50, 50)">
            {/* Swoosh bas */}
            <Path 
              d="M 30 68 C 30 68, 45 82, 70 65" 
              stroke="url(#goldGradient)" 
              strokeWidth="5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            {/* Swoosh haut */}
            <Path 
              d="M 70 32 C 70 32, 55 18, 30 35" 
              stroke="url(#goldGradient)" 
              strokeWidth="5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </G>
          
          {/* Petite étincelle (Modernité) */}
          <Circle cx="82" cy="25" r="3" fill={secondaryAccent} />
        </Svg>
      </View>

      {/* --- TYPOGRAPHIE (Alignée et Épurée) --- */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.baseText, { fontSize: size * 0.55, color: textColor }]}>
            Harmonia
          </Text>
          <View style={[styles.dot, { backgroundColor: accentColor, width: size * 0.12, height: size * 0.12 }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Espacement optimal icône-texte
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline', // Aligne le texte et le point parfaitement
  },
  baseText: {
    fontFamily: Platform.select({
      ios: 'Avenir Next', // Police très propre sur iOS
      android: 'sans-serif-medium', // Police moderne sur Android
      web: 'Inter, sans-serif'
    }),
    fontWeight: '600',
    letterSpacing: -0.5, // Un peu plus serré pour un look pro
    includeFontPadding: false,
  },
  dot: {
    borderRadius: 50,
    marginLeft: 4,
    marginBottom: 4, // Ajustement fin pour l'alignement avec la baseline
  }
});
