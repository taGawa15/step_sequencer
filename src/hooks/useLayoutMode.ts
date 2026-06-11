import { useEffect, useState } from 'react';
import { computeLayoutMode, type LayoutMode } from '../utils/mobileLayout';

const read = (): LayoutMode => {
  if (typeof window === 'undefined') return 'desktop';
  return computeLayoutMode(window.innerWidth, window.innerHeight);
};

/**
 * Live layout mode incl. the phone-landscape performance mode. Listens
 * to resize + orientationchange (innerWidth/Height are the source of
 * truth — matchMedia alone can't express "landscape AND short").
 */
export const useLayoutMode = (): LayoutMode => {
  const [mode, setMode] = useState<LayoutMode>(read);

  useEffect(() => {
    const handler = () => setMode(read());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return mode;
};
