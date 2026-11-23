import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Profile } from '../core/types';
import { font, radius, useTheme } from '../theme';

/** One-tap switcher between saved QRs. Hidden when there is only one. wrap lays them out in lines (wide screens). */
export function ProfileChips({ profiles, activeId, onSelect, wrap }: { profiles: Profile[]; activeId: string; onSelect: (id: string) => void; wrap?: boolean }) {
  const { colors } = useTheme();
  if (profiles.length < 2) return null;
  const chips = profiles.map((p) => {
    const on = p.id === activeId;
    return (
      <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: on }}
        onPress={() => { void Haptics.selectionAsync(); onSelect(p.id); }}
        style={[styles.chip, on
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: 'transparent', borderColor: colors.line }]}>
        <View style={[styles.dot, { backgroundColor: p.color }]} />
        <Text style={[styles.text, { color: on ? colors.bg : colors.ink }]} numberOfLines={1}>{p.label}</Text>
      </Pressable>
    );
  });
  if (wrap) return <View style={styles.wrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{chips}</ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 24 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, maxWidth: 180 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontWeight: font.bold, fontSize: 14 },
});
