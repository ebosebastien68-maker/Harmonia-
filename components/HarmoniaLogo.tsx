import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  G,
  Mask,
  Rect
} from 'react-native-svg';

interface HarmoniaLogoProps {
  size?: number;
  showText?: boolean;
  theme?: 'light' | 'dark'; // Ajout d'une option de thème
}

export default function HarmoniaLogo({ 
  size = 48, 
  showText = true,
  theme = 'dark' 
}: HarmoniaLogoProps) {
  
  // Couleurs dynamiques selon le thème
  const textColor = theme === 'dark' ? '#FFFFFF' : '#1E293B';

  return (
    <View style={styles.container}>
      {/* Container de l'icône */}
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            {/* Gradient Terre : Bleu profond vers Cyan électrique */}
            <SvgGradient id="earthGrad" x1="20%" y1="20%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity="1" />
              <Stop offset="100%" stopColor="#2563EB" stopOpacity="1" />
            </SvgGradient>

            {/* Gradient Coupe : Or Métallique */}
            <SvgGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FDE047" stopOpacity="1" />
              <Stop offset="50%" stopColor="#D97706" stopOpacity="1" />
              <Stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
            </SvgGradient>

            {/* Ombre portée subtile pour la profondeur */}
            <SvgGradient id="shadowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
               <Stop offset="0%" stopColor="#000" stopOpacity="0.2" />
               <Stop offset="100%" stopColor="#000" stopOpacity="0" />
            </SvgGradient>
          </Defs>

          {/* 1. LA COUPE (Abstraite) */}
          {/* Forme stylisée en "V" ou ailes qui soutient la terre */}
          <G>
            {/* Aile Gauche */}
            <Path
              d="M 50 85 C 35 85, 15 70, 15 45 C 15 35, 20 25, 25 20"
              stroke="url(#goldGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
             {/* Aile Droite */}
             <Path
              d="M 50 85 C 65 85, 85 70, 85 45 C 85 35, 80 25, 75 20"
              stroke="url(#goldGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
          </G>

          {/* 2. LA TERRE (Flottante au centre) */}
          <G transform="translate(0, -5)"> 
            <Circle cx="50" cy="45" r="22" fill="url(#earthGrad)" />
            
            {/* Reflet brillant (Glossy effect) pour le réalisme moderne */}
            <Circle cx="42" cy="38" r="8" fill="#FFFFFF" opacity="0.15" />
            <Circle cx="60" cy="55" r="14" fill="#000000" opacity="0.1" />

            {/* Méridiens subtils (lignes blanches fines) pour rappeler la Terre sans la dessiner */}
            <Path 
              d="M 50 23 A 22 22 0 0 1 50 67" 
              stroke="#FFFFFF" 
              strokeWidth="0.5" 
              opacity="0.3" 
              fill="none"
            />
            <Path 
              d="M 28 45 A 22 22 0 0 1 72 45" 
              stroke="#FFFFFF" 
              strokeWidth="0.5" 
              opacity="0.3" 
              fill="none"
            />
          </G>

          {/* Petite étoile/étincelle au sommet (Le côté "Victoire") */}
          <Path 
            d="M 50 10 L 52 14 L 56 16 L 52 18 L 50 22 L 48 18 L 44 16 L 48 14 Z" 
            fill="#FDE047"
          />
        </Svg>
      </View>

      {/* Texte HARMONIA */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor, fontSize: size * 0.55 }]}>
            HARMONIA
          </Text>
          {/* Slogan optionnel ou ligne décorative */}
          <View style={[styles.underline, { backgroundColor: '#F59E0B' }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Espace plus aéré
  },
  textContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800', // Très gras pour l'impact
    letterSpacing: 4, // Espacement large = Luxe/Moderne
    ...Platform.select({
      ios: { fontFamily: 'Avenir Next' }, // Police très propre sur iOS
      android: { fontFamily: 'sans-serif-medium' },
      web: { fontFamily: '"Montserrat", "Inter", sans-serif' },
    }),
  },
  underline: {
    height: 2,
    width: 24, // Petite ligne sous le texte
    marginTop: 4,
    borderRadius: 1,
  }
});
