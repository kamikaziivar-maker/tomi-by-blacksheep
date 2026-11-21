import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = () => Capacitor.isNativePlatform();

export const haptics = {
  async tap(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
    try {
      if (isNative()) {
        await Haptics.impact({ style });
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
    } catch {
      // Ignore silencieusement si non supporté
    }
  },

  async success(): Promise<void> {
    try {
      if (isNative()) {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 40, 30]);
      }
    } catch {
      // Ignore silencieusement
    }
  },

  async warning(): Promise<void> {
    try {
      if (isNative()) {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 30, 40]);
      }
    } catch {
      // Ignore silencieusement
    }
  },

  async heavy(): Promise<void> {
    try {
      if (isNative()) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(35);
      }
    } catch {
      // Ignore silencieusement
    }
  },
};