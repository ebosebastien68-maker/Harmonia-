import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
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

export default function HarmoniaLogo({ size = 36, showText = true }: HarmoniaLogoProps) {
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
          </Defs>
          
          {/* Planète Terre au centre */}
          <G>
            <Circle 
              cx="50" 
              cy="55" 
              r="28" 
              fill="url(#earthGrad)"
            />
            
            {/* Continents */}
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
            
            {/* Reflet */}
            <Ellipse
              cx="42"
              cy="48"
              rx="8"
              ry="6"
              fill="#fff"
              opacity="0.3"
            />
          </G>

          {/* Coupe de trophée */}
          <G>
            <Path
              d="M 45 30 L 55 30 L 53 35 L 47 35 Z"
              fill="url(#trophyGrad)"
            />
            <Path
              d="M 40 18 L 60 18 L 58 25 Q 50 28, 42 25 Z"
              fill="url(#trophyGrad)"
            />
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
            <Path
              d="M 50 20 L 51 23 L 54 23 L 52 25 L 53 28 L 50 26 L 47 28 L 48 25 L 46 23 L 49 23 Z"
              fill="#FFF"
              opacity="0.9"
            />
          </G>
        </Svg>
      </View>

      {/* Texte HARMONIA - Typographie moderne et élégante */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={styles.text}>HARMONIA</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
  },
  text: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 3,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '700',
      },
      android: {
        fontFamily: 'sans-serif-light',
        fontWeight: '700',
      },
      web: {
        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontWeight: '700',
        textTransform: 'uppercase',
      },
    }),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
