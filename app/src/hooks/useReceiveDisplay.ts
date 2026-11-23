import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * While `active`: screen stays on and brightness is 100%. The previous brightness
 * is restored on exit. Web has no brightness API, so only the wake lock applies.
 */
export function useReceiveDisplay(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let previous: number | null = null;
    let cancelled = false;
    const TAG = 'receive';
    activateKeepAwakeAsync(TAG).catch(() => {});
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          previous = await Brightness.getBrightnessAsync();
          if (!cancelled) await Brightness.setBrightnessAsync(1);
        } catch {
          /* brightness is best-effort */
        }
      })();
    }
    return () => {
      cancelled = true;
      void deactivateKeepAwake(TAG);
      if (Platform.OS !== 'web' && previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
  }, [active]);
}
