import { useCallback, useState } from 'react';
import type { BottomTab } from '../components/BottomEditPanel';
import type { TrackGroup } from '../utils/mobileLayout';

/**
 * UI state for the mobile shell: slide-in drawer, bottom sheet, focus
 * mode and the active track group. Deliberately NOT persisted — a live
 * set should always boot with the grid unobstructed.
 *
 * Invariants:
 *  - drawer and sheet are never open together (opening one closes the
 *    other, so the grid is occluded by at most one surface);
 *  - focus mode closes both (it exists to clear the stage).
 */
export const useMobileUI = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<BottomTab | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [trackGroup, setTrackGroup] = useState<TrackGroup>('drum');

  const openDrawer = useCallback(() => {
    setSheetTab(null);
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => {
    setDrawerOpen((open) => {
      if (!open) setSheetTab(null);
      return !open;
    });
  }, []);

  const openSheet = useCallback((tab: BottomTab) => {
    setDrawerOpen(false);
    setSheetTab(tab);
  }, []);
  const closeSheet = useCallback(() => setSheetTab(null), []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((on) => {
      const next = !on;
      if (next) {
        setDrawerOpen(false);
        setSheetTab(null);
      }
      return next;
    });
  }, []);

  return {
    drawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    sheetTab,
    openSheet,
    closeSheet,
    focusMode,
    toggleFocusMode,
    trackGroup,
    setTrackGroup,
  };
};
