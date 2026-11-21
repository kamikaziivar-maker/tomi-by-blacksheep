import { useEffect, useRef } from 'react';
import { ShakeSensitivity } from '../types/finance';

interface UseShakeDetectorOptions {
  enabled: boolean;
  sensitivity: ShakeSensitivity;
  cooldownMs?: number;
  onShake: () => void;
}

const THRESHOLDS: Record<ShakeSensitivity, { delta: number; linear: number }> = {
  soft: { delta: 14, linear: 12 },
  normal: { delta: 21, linear: 17 },
  strong: { delta: 29, linear: 24 },
};

export async function requestMotionPermissionIfNeeded(): Promise<'granted' | 'denied' | 'not_needed'> {
  if (typeof window === 'undefined') return 'not_needed';
  const DM = window.DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (DM && typeof DM.requestPermission === 'function') {
    try {
      const res = await DM.requestPermission();
      return res;
    } catch {
      return 'denied';
    }
  }
  return 'not_needed';
}

export function useShakeDetector({
  enabled,
  sensitivity,
  cooldownMs = 950,
  onShake,
}: UseShakeDetectorOptions) {
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return;
    }

    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;
    let lastTriggerAt = 0;

    const { delta: deltaThreshold, linear: linearThreshold } = THRESHOLDS[sensitivity];

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastTriggerAt < cooldownMs) return;

      // Prefer gravity-excluded linear acceleration if device provides valid numbers
      const lin = event.acceleration;
      if (
        lin &&
        typeof lin.x === 'number' &&
        typeof lin.y === 'number' &&
        typeof lin.z === 'number' &&
        (lin.x !== 0 || lin.y !== 0 || lin.z !== 0)
      ) {
        const mag = Math.sqrt(lin.x * lin.x + lin.y * lin.y + lin.z * lin.z);
        if (mag >= linearThreshold) {
          lastTriggerAt = now;
          onShakeRef.current();
          return;
        }
      }

      // Fallback / standard Android WebView: accelerationIncludingGravity frame delta
      const acc = event.accelerationIncludingGravity;
      if (!acc || typeof acc.x !== 'number' || typeof acc.y !== 'number' || typeof acc.z !== 'number') {
        return;
      }

      if (lastX !== null && lastY !== null && lastZ !== null) {
        const dx = Math.abs(acc.x - lastX);
        const dy = Math.abs(acc.y - lastY);
        const dz = Math.abs(acc.z - lastZ);
        const totalDelta = dx + dy + dz;

        if (totalDelta >= deltaThreshold) {
          lastTriggerAt = now;
          lastX = acc.x;
          lastY = acc.y;
          lastZ = acc.z;
          onShakeRef.current();
          return;
        }
      }

      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;
    };

    window.addEventListener('devicemotion', handleMotion, { passive: true });
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, sensitivity, cooldownMs]);
}
