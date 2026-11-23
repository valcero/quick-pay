import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, useTheme } from '../theme';

/** The app mark (QR finder square: ring + lime core), drawn in views so it scales crisply. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  const ring = size * 0.2;
  const core = size * 0.34;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, borderWidth: ring, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: core, height: core, borderRadius: core * 0.3, backgroundColor: colors.accent }} />
    </View>
  );
}

/** Mark + lowercase wordmark, used in screen headers. */
export function Logo() {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="QuickPay">
      <LogoMark size={26} />
      <Text style={[styles.word, { color: colors.ink }]}>quickpay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontSize: 19, fontWeight: font.heavy, letterSpacing: -0.6 },
});
