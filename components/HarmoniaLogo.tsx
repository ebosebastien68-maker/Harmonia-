import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

interface HarmoniaLogoProps {
  size?: number;
  showText?: boolean;
}

export default function HarmoniaLogo({ size = 32, showText = true }: HarmoniaLogoProps) {
  return (
    <View style={styles.container}>
      {/* Icon SVG */}
      <View style={[styles.iconContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <SvgGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="50%" stopColor="#FF0080" stopOpacity="1" />
              <Stop offset="100%" stopColor="#8A2BE2" stopOpacity="1" />
            </SvgGradient>
          </Defs>
          
          {/* Cercle extérieur */}
          <Circle cx="50" cy="50" r="45" stroke="url(#grad1)" strokeWidth="4" fill="none" />
          
          {/* Étoile centrale stylisée (H pour Harmonia) */}
          <Path
            d="M 30 30 L 30 70 M 30 50 L 50 50 M 50 30 L 50 50 M 50 50 L 70 70 M 70 30 L 70 50"
            stroke="url(#grad1)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          
          {/* Points décoratifs */}
          <Circle cx="50" cy="20" r="3" fill="#FFD700" />
          <Circle cx="50" cy="80" r="3" fill="#8A2BE2" />
          <Circle cx="20" cy="50" r="3" fill="#FF0080" />
          <Circle cx="80" cy="50" r="3" fill="#FFD700" />
        </Svg>
      </View>

      {/* Texte */}
      {showText && (
        <View style={styles.textContainer}>
          <LinearGradient
            colors={['#FFD700', '#FF0080', '#8A2BE2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            <Text style={styles.text}>HARMONIA</Text>
          </LinearGradient>
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
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    overflow: 'hidden',
    borderRadius: 4,
  },
  gradient: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
