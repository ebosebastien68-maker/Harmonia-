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
  const accentColor = '#F59E0B';

  return (
    <View style={styles.container}>
      {/* ICÔNE compacte */}
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

          {/* Ailes dorées */}
          <G>
            <Path
              d="M 50 85 C 35 85, 15 70, 15 45 C 15 35, 20 25, 25 20"
              stroke="url(#goldGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
             <Path
              d="M 50 85 C 65 85, 85 70, 85 45 C 85 35, 80 25, 75 20"
              stroke="url(#goldGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
          </G>

          {/* Terre */}
          <G transform="translate(0, -5)"> 
            <Circle cx="50" cy="45" r="20" fill="url(#earthGrad)" />
            <Circle cx="42" cy="38" r="7" fill="#FFFFFF" opacity="0.15" />
            <Path d="M 50 25 A 20 20 0 0 1 50 65" stroke="#FFF" strokeWidth="0.5" opacity="0.3" fill="none"/>
            <Path d="M 30 45 A 20 20 0 0 1 70 45" stroke="#FFF" strokeWidth="0.5" opacity="0.3" fill="none"/>
          </G>

          {/* Étoile */}
          <Path d="M 50 12 L 51.5 15 L 54 16 L 51.5 17 L 50 20 L 48.5 17 L 46 16 L 48.5 15 Z" fill="#FDE047"/>
        </Svg>
      </View>

      {/* TEXTE ultra-compact */}
      {showText && (
        <View style={styles.textWrapper}>
          <Text style={styles.textRow}>
            <Text style={[
              styles.letterH, 
              { fontSize: size * 0.55, color: accentColor }
            ]}>
              H
            </Text>
            <Text style={[
              styles.wordRest, 
              { fontSize: size * 0.42, color: textColor }
            ]}>
              armonia
            </Text>
            <Text style={{ fontSize: size * 0.42, color: accentColor, fontWeight: 'bold' }}>
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
    gap: 8,
  },
  textWrapper: {
    justifyContent: 'center',
  },
  textRow: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  letterH: {
    fontWeight: '800',
    fontFamily: Platform.select({
      ios: 'AvenirNext-Heavy',
      android: 'sans-serif-black',
      web: 'Montserrat, sans-serif'
    }),
    letterSpacing: -0.5,
  },
  wordRest: {
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif',
      web: 'Inter, sans-serif'
    }),
    letterSpacing: 0.3,
  }
});
