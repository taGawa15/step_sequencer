import { useEffect, useState } from 'react';

export type Viewport = 'mobile' | 'tablet' | 'desktop';

const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

const compute = (): Viewport => {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w >= DESKTOP_MIN) return 'desktop';
  if (w >= TABLET_MIN) return 'tablet';
  return 'mobile';
};

/**
 * Returns the current viewport bucket. Updates on resize via matchMedia.
 * Used to choose what to render in which slot of the AppShell so that
 * larger viewports can keep panels always-visible while mobile gets a
 * tabbed bottom sheet.
 */
export const useViewport = (): Viewport => {
  const [viewport, setViewport] = useState<Viewport>(compute);

  useEffect(() => {
    const tabletMq = window.matchMedia(`(min-width: ${TABLET_MIN}px)`);
    const desktopMq = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
    const handler = () => setViewport(compute());
    tabletMq.addEventListener('change', handler);
    desktopMq.addEventListener('change', handler);
    return () => {
      tabletMq.removeEventListener('change', handler);
      desktopMq.removeEventListener('change', handler);
    };
  }, []);

  return viewport;
};
