import React, { useMemo } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Core, Doc } from '../core/types';
import { Button } from '../components/Button';
import { font, radius, useTheme, type Palette } from '../theme';

type Props = {
  core: Core;
  doc: Doc;
  lockEnabled: boolean;
  lockAvailable: boolean;
  onChange: (doc: Doc) => void;
  onToggleLock: (on: boolean) => void;
  onWipe: () => void;
  onBack: () => void;
};

function confirm(title: string, message: string, ok: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) ok();
  } else {
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: ok }]);
  }
}

export function ManageScreen({ core, doc, lockEnabled, lockAvailable, onChange, onToggleLock, onWipe, onBack }: Props) {
  const { colors, mode, toggle } = useTheme();
  const wide = useWindowDimensions().width >= 768;
  const styles = useMemo(() => makeStyles(colors, wide), [colors, wide]);
  const run = (f: () => Doc) => { try { onChange(f()); } catch { /* ids come from the doc itself */ } };
  const track = { true: colors.primary, false: colors.line };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <Text style={styles.title}>settings</Text>
          <Button title="Done" size="sm" onPress={onBack} />
        </View>

        <Text style={styles.section}>Your QRs</Text>
        <View style={styles.group}>
          {doc.profiles.length === 0 && <Text style={[styles.kind, styles.pad]}>Nothing saved yet.</Text>}
          {doc.profiles.map((p, i) => (
            <View key={p.id} style={[styles.row, i > 0 && styles.divider]}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.label}</Text>
                <Text style={styles.kind}>{p.id === doc.defaultId ? 'Main · ' : ''}{p.kind.toUpperCase()}</Text>
              </View>
              {p.id !== doc.defaultId && (
                <Button title="Make main" size="sm" variant="ghost" onPress={() => run(() => core.setDefaultProfile(doc, p.id))} />
              )}
              <Button title="Delete" size="sm" variant="danger"
                onPress={() => confirm('Delete this QR?', p.label, () => run(() => core.removeProfile(doc, p.id)))} />
            </View>
          ))}
        </View>

        <Text style={styles.section}>App</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Dark mode</Text>
              <Text style={styles.kind}>Easy on the eyes at night</Text>
            </View>
            <Switch value={mode === 'dark'} onValueChange={toggle} trackColor={track} thumbColor="#FFFFFF" />
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Face / fingerprint lock</Text>
              <Text style={styles.kind}>{lockAvailable ? 'Ask before showing your QR' : 'Not available on this device'}</Text>
            </View>
            <Switch value={lockEnabled} disabled={!lockAvailable} onValueChange={onToggleLock} trackColor={track} thumbColor="#FFFFFF" />
          </View>
        </View>

        {!core.encrypted && <Text style={styles.dev}>Dev build: encryption is off (TS fallback core).</Text>}
        <Button title="Delete all my data" variant="danger" style={{ marginTop: 12 }}
          onPress={() => confirm('Delete everything?', 'All saved QRs and the encryption key are erased from this device.', onWipe)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette, wide: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  body: { padding: wide ? 40 : 24, paddingTop: wide ? 56 : 24, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: wide ? 48 : 36, fontWeight: font.heavy, color: c.ink, letterSpacing: -1.4 },
  section: { marginTop: 14, fontSize: 13, fontWeight: font.bold, color: c.muted, marginLeft: 4 },
  group: { backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  pad: { padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 16, fontWeight: font.bold, color: c.ink },
  kind: { fontSize: 13, color: c.muted, marginTop: 2 },
  dev: { color: c.warn, backgroundColor: c.warnBg, padding: 12, borderRadius: radius.sm, overflow: 'hidden', marginTop: 12 },
});
