import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { 
  Path, 
  Circle, 
  Ellipse,
  Defs, 
  LinearGradient as SvgGradient, 
  Stop,
  G 
} from 'react-native-svg';

interface HarmoniaLogoProps {
  size?: number;
  showText?: boolean;
}

export default function HarmoniaLogo({ size = 32, showText = true }: HarmoniaLogoProps) {
  return (
    <View style={styles.container}>
      {/* Icon SVG - Terre + Coupe */}
      <View style={[styles.iconContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            {/* Gradient Terre (bleu/vert) */}
            <SvgGradient id="earthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0EA5E9" stopOpacity="1" />
              <Stop offset="50%" stopColor="#10B981" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0EA5E9" stopOpacity="1" />
            </SvgGradient>
            
            {/* Gradient Coupe (or) */}
            <SvgGradient id="trophyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="50%" stopColor="#FFA500" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFD700" stopOpacity="1" />
            </SvgGradient>

            {/* Gradient texte */}
            <SvgGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="33%" stopColor="#FF0080" stopOpacity="1" />
              <Stop offset="66%" stopColor="#8A2BE2" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0EA5E9" stopOpacity="1" />
            </SvgGradient>
          </Defs>
          
          {/* Planète Terre au centre */}
          <G>
            {/* Cercle Terre principal */}
            <Circle 
              cx="50" 
              cy="55" 
              r="28" 
              fill="url(#earthGrad)"
            />
            
            {/* Continents (formes simplifiées) */}
            <Path
              d="M 35 45 Q 40 42, 45 45 L 42 52 Q 38 50, 35 45 Z"
              fill="#10B981"
              opacity="0.8"
            />
            <Path
              d="M 52 48 Q 58 46, 62 50 L 60 58 Q 54 56, 52 48 Z"
              fill="#10B981"
              opacity="0.8"
            />
            <Path
              d="M 42 62 Q 48 60, 54 63 L 52 70 Q 46 68, 42 62 Z"
              fill="#10B981"
              opacity="0.8"
            />
            
            {/* Reflet lumineux */}
            <Ellipse
              cx="42"
              cy="48"
              rx="8"
              ry="6"
              fill="#fff"
              opacity="0.3"
            />
          </G>

          {/* Coupe de trophée en haut */}
          <G>
            {/* Base de la coupe */}
            <Path
              d="M 45 30 L 55 30 L 53 35 L 47 35 Z"
              fill="url(#trophyGrad)"
            />
            
            {/* Corps de la coupe */}
            <Path
              d="M 40 18 L 60 18 L 58 25 Q 50 28, 42 25 Z"
              fill="url(#trophyGrad)"
            />
            
            {/* Anses de la coupe */}
            <Path
              d="M 38 20 Q 33 20, 33 24 Q 33 26, 38 26"
              stroke="url(#trophyGrad)"
              strokeWidth="2"
              fill="none"
            />
            <Path
              d="M 62 20 Q 67 20, 67 24 Q 67 26, 62 26"
              stroke="url(#trophyGrad)"
              strokeWidth="2"
              fill="none"
            />
            
            {/* Étoile sur la coupe */}
            <Path
              d="M 50 20 L 51 23 L 54 23 L 52 25 L 53 28 L 50 26 L 47 28 L 48 25 L 46 23 L 49 23 Z"
              fill="#FFF"
              opacity="0.9"
            />
          </G>

          {/* Cercle extérieur élégant */}
          <Circle 
            cx="50" 
            cy="50" 
            r="48" 
            stroke="url(#textGrad)" 
            strokeWidth="2" 
            fill="none"
            opacity="0.6"
          />

          {/* Points lumineux décoratifs */}
          <Circle cx="50" cy="5" r="2" fill="#FFD700" opacity="0.8" />
          <Circle cx="50" cy="95" r="2" fill="#0EA5E9" opacity="0.8" />
          <Circle cx="5" cy="50" r="2" fill="#FF0080" opacity="0.8" />
          <Circle cx="95" cy="50" r="2" fill="#10B981" opacity="0.8" />
        </Svg>
      </View>

      {/* Texte HARMONIA */}
      {showText && (
        <View style={styles.textContainer}>
          <LinearGradient
            colors={['#FFD700', '#FF0080', '#8A2BE2', '#0EA5E9']}
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
    gap: 10,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
