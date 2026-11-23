import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { font, radius, useTheme } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  disabled?: boolean;
  style?: ViewStyle;
};

/** Pill button that squishes slightly on press, with a light haptic. */
export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, style }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const palette = {
    primary: { bg: colors.ink, text: colors.bg, border: colors.ink },
    danger: { bg: 'transparent', text: colors.danger, border: colors.danger },
    ghost: { bg: 'transparent', text: colors.ink, border: colors.line },
  }[variant];
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      onHoverIn={() => to(1.03)}
      onHoverOut={() => to(1)}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[{ opacity: disabled ? 0.4 : 1 }, style]}
    >
      <Animated.View style={[styles.base, size === 'sm' && styles.sm,
      { backgroundColor: palette.bg, borderColor: palette.border, transform: [{ scale }] }]}>
        <Text style={[styles.text, size === 'sm' && styles.smText, { color: palette.text }]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: radius.pill, alignItems: 'center', borderWidth: 1.5 },
  sm: { paddingVertical: 8, paddingHorizontal: 14 },
  text: { fontSize: 16, fontWeight: font.bold },
  smText: { fontSize: 14 },
});
