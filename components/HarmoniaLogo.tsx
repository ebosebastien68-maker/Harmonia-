import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
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
  
  const textColor = theme === 'dark' ? '#FFFFFF' : '#1E293B';
  const accentColor = '#F59E0B'; // La couleur Or/Ambre

  return (
    <View style={styles.container}>
      {/* --- ICÔNE (Terre + Ailes dorées) --- */}
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <SvgGradient id="earthGrad" x1="20%" y1="20%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity="1" />
              <Stop offset="100%" stopColor="#2563EB" stopOpacity="1" />
            </SvgGradient>

            <SvgGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FDE047" stopOpacity="1" />
              <Stop offset="50%" stopColor="#D97706" stopOpacity="1" />
              <Stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
            </SvgGradient>
          </Defs>

          {/* Ailes dorées (la coupe abstraite) */}
          <G>
            <Path
              d="M 50 85 C 35 85, 15 70, 15 45 C 15 35, 20 25, 25 20"
              stroke="url(#goldGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
             <Path
              d="M 50 85 C 65 85, 85 70, 85 45 C 85 35, 80 25, 75 20"
              stroke="url(#goldGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
          </G>

          {/* Terre flottante */}
          <G transform="translate(0, -5)"> 
            <Circle cx="50" cy="45" r="22" fill="url(#earthGrad)" />
            <Circle cx="42" cy="38" r="8" fill="#FFFFFF" opacity="0.15" />
            
            {/* Méridiens fins */}
            <Path d="M 50 23 A 22 22 0 0 1 50 67" stroke="#FFF" strokeWidth="0.5" opacity="0.3" fill="none"/>
            <Path d="M 28 45 A 22 22 0 0 1 72 45" stroke="#FFF" strokeWidth="0.5" opacity="0.3" fill="none"/>
          </G>

          {/* Étoile de victoire */}
          <Path d="M 50 10 L 52 14 L 56 16 L 52 18 L 50 22 L 48 18 L 44 16 L 48 14 Z" fill="#FDE047"/>
        </Svg>
      </View>

      {/* --- TEXTE MODERNE (Le grand changement) --- */}
      {showText && (
        <View style={styles.textWrapper}>
          <Text style={styles.textRow}>
            {/* Le grand "H" stylisé et coloré */}
            <Text style={[
              styles.letterH, 
              { fontSize: size * 0.7, color: accentColor }
            ]}>
              H
            </Text>
            
            {/* Le reste du mot "armonia" plus fin et moderne */}
            <Text style={[
              styles.wordRest, 
              { fontSize: size * 0.55, color: textColor }
            ]}>
              armonia
            </Text>

            {/* Le point final (touche tech) */}
            <Text style={{ fontSize: size * 0.55, color: accentColor, fontWeight: 'bold' }}>
              .
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  textWrapper: {
    justifyContent: 'center',
    // Correction de l'alignement vertical optique
    paddingTop: 4, 
  },
  textRow: {
    // Permet d'aligner le H et le reste sur la même ligne de base
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  letterH: {
    // Style du "H"
    fontWeight: '800', // Très gras
    fontFamily: Platform.select({
      ios: 'AvenirNext-Heavy',
      android: 'sans-serif-black', // Le plus gras disponible sur Android
      web: 'Montserrat, sans-serif'
    }),
    letterSpacing: -1, // Un peu serré pour faire bloc
  },
  wordRest: {
    // Style de "armonia"
    fontWeight: '400', // Normal / Fin
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif',
      web: 'Inter, sans-serif'
    }),
    letterSpacing: 0.5, // Légèrement aéré pour la lisibilité
  }
});
