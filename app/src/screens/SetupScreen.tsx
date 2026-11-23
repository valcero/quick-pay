import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, View, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { Core, Doc, Parsed } from '../core/types';
import { Button } from '../components/Button';
import { ScanSuccess } from '../components/ScanSuccess';
import { font, radius, useTheme, type Palette } from '../theme';

type Props = { core: Core; doc: Doc; onSave: (doc: Doc, newId: string) => void; onCancel: () => void };

/** Add a QR by scanning it with the camera or pasting its text. Preview, name, save. */
export function SetupScreen({ core, doc, onSave, onCancel }: Props) {
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= 768;
  const styles = useMemo(() => makeStyles(colors, wide), [colors, wide]);
  const [mode, setMode] = useState<'scan' | 'paste'>('scan');
  const [perm, requestPerm] = useCameraPermissions();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  // The camera reports the same code many times a second; only the first read counts.
  const locked = useRef(false);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!parsed || celebrate) return;
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [parsed, celebrate, reveal]);

  const accept = (raw: string) => {
    if (locked.current) return;
    try {
      const p = core.parseQR(raw);
      locked.current = true;
      setCelebrate(true);
      setParsed(p);
      setLabel(p.displayName);
      setError('');
    } catch (e) {
      setParsed(null);
      setError((e as Error).message);
    }
  };

  const save = () => {
    if (!parsed) return;
    try {
      const next = core.addProfile(doc, label, parsed.normalized);
      const added = next.profiles[next.profiles.length - 1];
      onSave(next, added.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{parsed && !celebrate ? 'looks good.' : 'add your QR.'}</Text>
        {(!parsed || celebrate) && (
          <>
            <View style={styles.tabs}>
              {(['scan', 'paste'] as const).map((m) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabOn]}>
                  <Text style={[styles.tabText, mode === m && { color: colors.bg }]}>{m === 'scan' ? 'Scan' : 'Paste'}</Text>
                </Pressable>
              ))}
            </View>
            {mode === 'scan' ? (
              perm?.granted ? (
                <View style={styles.camera}>
                  <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={({ data }) => accept(data)} />
                </View>
              ) : (
                <View style={styles.box}>
                  <Text style={styles.hint}>Camera is only used to read your QR here. Nothing is recorded or sent.</Text>
                  <Button title="Allow camera" onPress={() => void requestPerm()} />
                </View>
              )
            ) : (
              <TextInput value={text} onChangeText={(t) => { setText(t); if (t.trim()) accept(t); }}
                placeholder="upi://pay?pa=you@bank&pn=Your Name" placeholderTextColor={colors.muted}
                autoCapitalize="none" autoCorrect={false} multiline style={styles.input} />
            )}
          </>
        )}
        {parsed && !celebrate && (
          <Animated.View style={[styles.box, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
            <Text style={styles.hint}>{parsed.kind === 'upi' ? `UPI · ${parsed.vpa}` : parsed.kind === 'emv' ? 'Merchant QR' : 'Custom QR'}</Text>
            <TextInput value={label} onChangeText={setLabel} maxLength={30} placeholder="Name (e.g. Personal, Shop)"
              placeholderTextColor={colors.muted} style={styles.input} />
            {parsed.warnings?.map((w) => <Text key={w} style={styles.warn}>⚠️ {w}</Text>)}
          </Animated.View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={{ gap: 12, marginTop: 8 }}>
          {parsed && !celebrate && <Button title="Save and show" onPress={save} />}
          {parsed && !celebrate && <Button title="Scan a different one" variant="ghost" onPress={() => { locked.current = false; setText(''); setParsed(null); }} />}
          <Button title="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </ScrollView>
      {celebrate && parsed && (
        <ScanSuccess title="got it." subtitle={parsed.kind === 'upi' ? parsed.vpa : parsed.displayName}
          onDone={() => setCelebrate(false)} />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette, wide: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  body: { padding: wide ? 40 : 24, gap: 16, paddingTop: wide ? 64 : 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontSize: wide ? 48 : 36, fontWeight: font.heavy, color: c.ink, letterSpacing: -1.4 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.line, backgroundColor: 'transparent' },
  tabOn: { backgroundColor: c.ink, borderColor: c.ink },
  tabText: { fontWeight: font.bold, color: c.ink },
  camera: { height: wide ? 380 : 320, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 3, borderColor: c.primary },
  box: { gap: 12, backgroundColor: c.card, padding: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.line },
  hint: { color: c.muted, fontSize: 15 },
  input: { minHeight: 52, backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.line, padding: 14, fontSize: 16, color: c.ink },
  warn: { color: c.warn, backgroundColor: c.warnBg, padding: 10, borderRadius: radius.sm, overflow: 'hidden' },
  error: { color: c.danger, fontWeight: font.bold },
});
