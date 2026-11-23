import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { font, useTheme } from '../theme';

const BURST = 14;
const DURATION = 1300;

/**
 * Full-screen "got it" moment after a QR is read: the backdrop fades in, two rings ripple
 * out, a lime check pops with a spin, and a ring of confetti bursts outward. Calls
 * `onDone` once it has faded away. Purely decorative, so it ignores touches.
 */
export function ScanSuccess({ title, subtitle, onDone }: { title: string; subtitle?: string; onDone: () => void }) {
  const { colors } = useTheme();
  const backdrop = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  // Confetti pieces: evenly spread angles with a little jitter, alternating brand colours.
  const pieces = useMemo(() => Array.from({ length: BURST }, (_, i) => {
    const angle = (i / BURST) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
    const dist = 110 + (i % 3) * 28;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      size: 8 + (i % 3) * 3,
      round: i % 2 === 0,
      color: [colors.accent, colors.primary, colors.ink][i % 3],
      spin: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
    };
  }), [colors]);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.timing(ripple, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(text, { toValue: 1, duration: 260, delay: 160, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      ]),
      Animated.delay(DURATION - 750 - 240),
      Animated.timing(backdrop, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => { if (finished) onDone(); });
    return () => anim.stop();
    // Plays once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rippleRing = (delay: number) => {
    const t = ripple.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
    return {
      opacity: t.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.6, 0] }),
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.6] }) }],
    };
  };

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.bg, opacity: backdrop }]}
      accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${subtitle ?? ''}`}>
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, { borderColor: colors.primary }, rippleRing(0)]} />
        <Animated.View style={[styles.ring, { borderColor: colors.accent }, rippleRing(0.25)]} />
        {pieces.map((p, i) => (
          <Animated.View key={i} style={{
            position: 'absolute', width: p.size, height: p.size, borderRadius: p.round ? p.size / 2 : 2, backgroundColor: p.color,
            opacity: burst.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.y] }) },
              { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] }) },
              { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.2, 0.6] }) },
            ],
          }} />
        ))}
        <Animated.View style={[styles.check, { backgroundColor: colors.accent }, {
          transform: [
            { scale: pop },
            { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
          ],
        }]}>
          <Text style={[styles.tick, { color: colors.accentInk }]}>✓</Text>
        </Animated.View>
      </View>
      <Animated.View style={{ alignItems: 'center', gap: 6, opacity: text,
        transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{subtitle}</Text>}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 10 },
  stage: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  check: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 54, lineHeight: 60, fontWeight: font.heavy },
  title: { fontSize: 34, fontWeight: font.heavy, letterSpacing: -1.2 },
  sub: { fontSize: 15, maxWidth: 300 },
});
