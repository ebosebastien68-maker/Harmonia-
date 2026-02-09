import React from 'react'; import { StyleSheet, View, Text, Platform } from 'react-native'; import Svg, { Defs, Circle, Path, G, RadialGradient, LinearGradient, Stop, Ellipse, Rect, Mask, } from 'react-native-svg';

type HarmoniaLogoProps = { size?: number; // square size in points showText?: boolean; variant?: 'light' | 'dark'; label?: string; // accessible label };

// Modern, simplified and balanced mark: a subtle globe with a trophy silhouette // integrated as negative/positive space. Clean gradients, softer shadow and // scalable typography.

export default function HarmoniaLogo({ size = 48, showText = true, variant = 'dark', label = 'Harmonia logo', }: HarmoniaLogoProps) { const isDark = variant === 'dark'; const textColor = isDark ? '#0F172A' : '#0F172A'; const bg = isDark ? 'transparent' : 'transparent';

// SVG viewBox is 0..120 so we can keep geometry simple and scale by size return ( <View style={[styles.container, { height: size }] } accessibilityLabel={label}> <View style={[styles.iconContainer, { width: size, height: size }]}> <Svg width={size} height={size} viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet"> <Defs> {/* soft radial globe gradient */} <RadialGradient id="gEarth" cx="45%" cy="45%" rx="60%" ry="60%" fx="35%" fy="35%"> <Stop offset="0%" stopColor="#9EE7FF" stopOpacity="1" /> <Stop offset="45%" stopColor="#34D399" stopOpacity="1" /> <Stop offset="100%" stopColor="#059669" stopOpacity="1" /> </RadialGradient>

{/* warm metallic gradient for the trophy */}
        <LinearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFDD57" stopOpacity="1" />
          <Stop offset="50%" stopColor="#FFB84D" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FFC857" stopOpacity="1" />
        </LinearGradient>

        {/* subtle ring stroke gradient */}
        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
        </LinearGradient>

        {/* a mask so the trophy can sit on top of the globe and remain crisp */}
        <Mask id="cupMask">
          {/* mask uses a white cup area on transparent background */}
          <Rect x="0" y="0" width="120" height="120" fill="#000" />
          <Path
            d="M40 28c0-6 6-10 10-10h20c4 0 10 4 10 10v5c0 6-6 10-10 10H50c-4 0-10-4-10-10z"
            fill="#fff"
          />
        </Mask>
      </Defs>

      {/* faint drop shadow ellipse under globe for elevation */}
      <Ellipse cx="60" cy="82" rx="26" ry="6" fill="#04111A" opacity="0.06" />

      {/* outer soft ring */}
      <Circle cx="60" cy="44" r="36" fill={bg} stroke="url(#ringGrad)" strokeWidth={2} />

      {/* globe */}
      <G>
        <Circle cx="60" cy="44" r="30" fill="url(#gEarth)" />

        {/* simplified continents — intentionally geometric and minimal */}
        <Path d="M48 34c5-3 10-4 14-2c6 3 10 10 6 16c-3 5-10 6-16 4c-6-2-8-9-4-18z" fill="#064E3B" opacity={0.9} />
        <Path d="M36 48c3-6 9-8 14-7" stroke="#065F46" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} fill="none" />
        <Path d="M70 54c2-4 6-6 9-5" stroke="#064E3B" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} fill="none" />

        {/* small glossy highlight */}
        <Ellipse cx="50" cy="36" rx="6" ry="4" fill="#fff" opacity={0.18} />
      </G>

      {/* trophy — placed above globe, slightly integrated (uses mask for crisp silhouette) */}
      <G mask="url(#cupMask)">
        {/* cup fill */}
        <Path
          d="M40 28c0-6 6-10 10-10h20c4 0 10 4 10 10v5c0 6-6 10-10 10H50c-4 0-10-4-10-10z"
          fill="url(#gGold)"
        />

        {/* handles */}
        <Path d="M36 30c0-6 6-8 6-8" stroke="#E08900" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
        <Path d="M84 30c0-6-6-8-6-8" stroke="#E08900" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />

        {/* base stem */}
        <Path d="M52 48h16v6c0 2-2 4-4 4H56c-2 0-4-2-4-4v-6z" fill="#C97E00" opacity={0.95} />

        {/* small inner shine */}
        <Path d="M48 26c6-2 20-2 26 0" stroke="#FFFFFF" strokeWidth={1} strokeLinecap="round" opacity={0.18} fill="none" />
      </G>

    </Svg>
  </View>

  {showText && (
    <View style={styles.textContainer}>
      <Text numberOfLines={1} style={[styles.text, { color: textColor, fontSize: Math.round(size * 0.33) }]}>
        HARMONIA
      </Text>
    </View>
  )}
</View>

); }

const styles = StyleSheet.create({ container: { flexDirection: 'row', alignItems: 'center', gap: 12, }, iconContainer: { justifyContent: 'center', alignItems: 'center', }, textContainer: { justifyContent: 'center', maxWidth: 260, }, text: { fontWeight: '700', letterSpacing: 2, includeFontPadding: false, ...Platform.select({ ios: { fontFamily: 'Inter-Bold' }, android: { fontFamily: 'Inter-Bold' }, web: { fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial', textTransform: 'uppercase', }, }), }, });
