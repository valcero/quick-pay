import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { radius } from '../theme';

/**
 * White quiet-zone card around the QR. Springs in whenever `value` changes.
 * Stays black-on-white in dark mode too, so the payer's camera always gets full contrast.
 * `accent` tints a thin outline so each saved QR is recognisable at a glance.
 */
export function QRCard({ value, size, accent }: { value: string; size: number; accent: string }) {
  const scale = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    scale.setValue(0.94);
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [value, scale]);
  return (
    <Animated.View style={[styles.card, { borderColor: accent, transform: [{ scale }] }]}
      accessible accessibilityLabel="Your payment QR code">
      <View>
        {/* ecl "M": scans reliably while keeping modules large on dense UPI payloads */}
        <QRCode value={value} size={size} ecl="M" color="#000" backgroundColor="#fff" quietZone={4} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: radius.lg, borderWidth: 3 },
});
