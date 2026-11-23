import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

/** Round sun/moon button that flips between light and dark mode. */
export function ThemeToggle() {
  const { mode, colors, toggle } = useTheme();
  const dark = mode === 'dark';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: dark }}
      hitSlop={8}
      onPress={() => { void Haptics.selectionAsync(); toggle(); }}
      style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      <Text style={styles.icon}>{dark ? '☀️' : '🌙'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 17 },
});
