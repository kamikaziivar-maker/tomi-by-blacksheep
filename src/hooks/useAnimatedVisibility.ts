import { useEffect, useState } from 'react';

export const MODAL_TRANSITION_MS = 220;

export function useAnimatedVisibility(
  isOpen: boolean,
  durationMs: number = MODAL_TRANSITION_MS
): { shouldRender: boolean; isVisible: boolean } {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let timer: number | undefined;

    if (isOpen) {
      setShouldRender(true);
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      timer = window.setTimeout(() => {
        setShouldRender(false);
      }, durationMs);
    }

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isOpen, durationMs]);

  return { shouldRender, isVisible };
}

export function backdropMotionClass(isVisible: boolean): string {
  return `transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
  }`;
}

export function sheetMotionClass(isVisible: boolean): string {
  return `transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
    isVisible
      ? 'opacity-100 translate-y-0 sm:scale-100'
      : 'opacity-0 translate-y-6 sm:translate-y-2 sm:scale-[0.97]'
  }`;
}

export function dialogMotionClass(isVisible: boolean): string {
  return `transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
    isVisible
      ? 'opacity-100 translate-y-0 scale-100'
      : 'opacity-0 translate-y-3 scale-[0.96]'
  }`;
}
