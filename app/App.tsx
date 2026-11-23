import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { initCore } from './src/core';
import type { Core, Doc } from './src/core/types';
import { getLockEnabled, loadDoc, saveDoc, setLockEnabled, wipeAll } from './src/storage';
import { ReceiveScreen } from './src/screens/ReceiveScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { ManageScreen } from './src/screens/ManageScreen';
import { Button } from './src/components/Button';
import { LogoMark } from './src/components/Logo';
import { font, ThemeProvider, useTheme } from './src/theme';

type Screen = 'receive' | 'setup' | 'manage';

export default function App() {
  return <SafeAreaProvider><ThemeProvider><Main /></ThemeProvider></SafeAreaProvider>;
}

function Main() {
  const { colors, mode } = useTheme();
  const [core, setCore] = useState<Core | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [activeId, setActiveId] = useState('');
  const [screen, setScreen] = useState<Screen>('receive');
  const [lockOn, setLockOn] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [fatal, setFatal] = useState('');

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Show your QR', disableDeviceFallback: false });
    setLocked(!r.success);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await initCore();
        const [d, lock, hw] = await Promise.all([
          loadDoc(c),
          getLockEnabled(),
          Platform.OS === 'web' ? false : LocalAuthentication.hasHardwareAsync().then(async (h) => h && (await LocalAuthentication.isEnrolledAsync())),
        ]);
        setCore(c);
        setDoc(d);
        setActiveId(d.defaultId);
        setLockAvailable(hw);
        setLockOn(lock && hw);
        if (lock && hw) { setLocked(true); void unlock(); }
      } catch (e) {
        setFatal((e as Error).message);
      }
    })();
  }, [unlock]);

  // Re-lock when the app goes to the background.
  useEffect(() => {
    if (!lockOn) return;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'background') setLocked(true); else if (s === 'active') void unlock(); });
    return () => sub.remove();
  }, [lockOn, unlock]);

  const commit = useCallback(async (next: Doc) => {
    setDoc(next);
    if (core) await saveDoc(core, next);
  }, [core]);

  if (fatal) return <Center><Text style={[styles.title, { color: colors.ink }]}>Something went wrong</Text><Text style={[styles.sub, { color: colors.muted }]}>{fatal}</Text></Center>;
  if (!core || !doc) return <Center><ActivityIndicator color={colors.primary} size="large" /></Center>;
  if (locked) return <Center><LogoMark size={64} /><Text style={[styles.title, { color: colors.ink }]}>locked.</Text><Button title="Unlock" onPress={() => void unlock()} /></Center>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {screen === 'receive' && (
        <ReceiveScreen doc={doc} activeId={activeId} onSelect={setActiveId}
          onAdd={() => setScreen('setup')} onManage={() => setScreen('manage')} />
      )}
      {screen === 'setup' && (
        <SetupScreen core={core} doc={doc} onCancel={() => setScreen('receive')}
          onSave={(next, id) => { void commit(next); setActiveId(id); setScreen('receive'); }} />
      )}
      {screen === 'manage' && (
        <ManageScreen core={core} doc={doc} lockEnabled={lockOn} lockAvailable={lockAvailable}
          onChange={(next) => { void commit(next); if (!next.profiles.some((p) => p.id === activeId)) setActiveId(next.defaultId); }}
          onToggleLock={(on) => { setLockOn(on); void setLockEnabled(on); }}
          onWipe={async () => { await wipeAll(); const fresh = core.newDocument(); setDoc(fresh); setActiveId(''); setLockOn(false); await setLockEnabled(false); setScreen('receive'); }}
          onBack={() => setScreen('receive')} />
      )}
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  const { colors, mode } = useTheme();
  return (
    <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 26, fontWeight: font.heavy },
  sub: { textAlign: 'center' },
  emoji: { fontSize: 64 },
});
