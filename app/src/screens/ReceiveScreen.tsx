import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Doc } from '../core/types';
import { QRCard } from '../components/QRCard';
import { ProfileChips } from '../components/ProfileChips';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { Logo, LogoMark } from '../components/Logo';
import { useReceiveDisplay } from '../hooks/useReceiveDisplay';
import { font, radius, useTheme, type Palette } from '../theme';

type Props = {
  doc: Doc;
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onManage: () => void;
};

/** Screens at least this wide (tablets, laptops, desktop browsers) get a two-column layout. */
const WIDE = 768;

/** The default screen. One glance: who is being paid, a big QR, and nothing else. */
export function ReceiveScreen({ doc, activeId, onSelect, onAdd, onManage }: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  const styles = useMemo(() => makeStyles(colors, wide), [colors, wide]);
  const active = doc.profiles.find((p) => p.id === activeId) ?? doc.profiles[0];
  useReceiveDisplay(!!active);

  const header = <View style={styles.header}><Logo /><ThemeToggle /></View>;

  if (!active) {
    return (
      <SafeAreaView style={styles.screen}>
        {header}
        <View style={styles.emptyWrap}>
          <View style={styles.empty}>
            <LogoMark size={wide ? 84 : 72} />
            <Text style={styles.title}>get paid in{'\n'}one tap.</Text>
            <Text style={styles.sub}>Save your payment QR once. It's right here every time you open the app.</Text>
          </View>
          <View style={styles.footer}>
            <Button title="Add my QR" onPress={onAdd} />
            <Text style={styles.privacy}>Stays on this device. Never uploaded.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const tag = (
    <View style={styles.tag}>
      <View style={styles.liveDot} />
      <Text style={styles.tagText}>scan to pay</Text>
    </View>
  );
  const addButton = (
    <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add another QR" style={styles.round}>
      <Text style={styles.roundText}>+</Text>
    </Pressable>
  );

  if (wide) {
    // Desktop/tablet: details on the left, a large QR on the right.
    const size = Math.max(240, Math.min(height - 260, width * 0.36, 440));
    return (
      <SafeAreaView style={styles.screen}>
        {header}
        <View style={styles.split}>
          <View style={styles.side}>
            {tag}
            <Text style={styles.bigName} numberOfLines={2}>{active.label}</Text>
            <Text style={styles.sub}>Ask them to scan this with any UPI app. Money lands straight in your account.</Text>
            <ProfileChips wrap profiles={doc.profiles} activeId={active.id} onSelect={onSelect} />
            <View style={styles.actions}>
              {addButton}
              <Button title="Manage" variant="ghost" onPress={onManage} style={{ minWidth: 140 }} />
            </View>
          </View>
          <QRCard value={active.payload} size={size} accent={active.color} />
        </View>
      </SafeAreaView>
    );
  }

  const size = Math.max(200, Math.min(width - 96, height * 0.42, 400));
  return (
    <SafeAreaView style={styles.screen}>
      {header}
      <ProfileChips profiles={doc.profiles} activeId={active.id} onSelect={onSelect} />
      <View style={styles.center}>
        {tag}
        <QRCard value={active.payload} size={size} accent={active.color} />
        <Text style={styles.name} numberOfLines={1}>{active.label}</Text>
      </View>
      <View style={styles.bottom}>
        {addButton}
        <Button title="Manage" variant="ghost" onPress={onManage} style={{ minWidth: 140 }} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette, wide: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: wide ? 40 : 24, paddingTop: wide ? 24 : 12, paddingBottom: 16,
    width: '100%', maxWidth: 1120, alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 20 },
  split: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 56,
    paddingHorizontal: 40, paddingBottom: 40, width: '100%', maxWidth: 1120, alignSelf: 'center',
  },
  side: { flex: 1, maxWidth: 460, gap: 20, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderColor: c.line, borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, borderWidth: 1, borderColor: c.accentInk },
  tagText: { color: c.ink, fontSize: 14, fontWeight: font.bold },
  name: { fontSize: 20, fontWeight: font.heavy, color: c.ink, maxWidth: 320, letterSpacing: -0.4 },
  bigName: { fontSize: 56, lineHeight: 60, fontWeight: font.heavy, color: c.ink, letterSpacing: -2.2 },
  emptyWrap: { flex: 1, width: '100%', maxWidth: wide ? 480 : undefined, alignSelf: 'center', justifyContent: wide ? 'center' : 'flex-start' },
  // Phone: fills the space above the pinned footer. Wide: natural height, centred with the footer.
  empty: wide
    ? { paddingHorizontal: 28, gap: 20, marginBottom: 40 }
    : { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 20 },
  title: { fontSize: wide ? 60 : 44, lineHeight: wide ? 62 : 46, fontWeight: font.heavy, color: c.ink, letterSpacing: wide ? -2.6 : -1.8 },
  sub: { fontSize: 16, lineHeight: 23, color: c.muted, maxWidth: 360 },
  footer: { paddingHorizontal: wide ? 28 : 24, paddingBottom: 20, gap: 14 },
  privacy: { color: c.muted, fontSize: 13, textAlign: 'center' },
  round: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ink },
  roundText: { fontSize: 26, lineHeight: 28, color: c.bg, fontWeight: font.bold },
});
