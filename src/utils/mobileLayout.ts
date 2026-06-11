/**
 * Pure layout math for the mobile redesign — kept free of React/DOM so
 * breakpoints, orientation detection, the step-page mini map and the
 * quick-memory save guard are all unit-testable.
 */

export type LayoutMode = 'mobile' | 'mobileLandscape' | 'tablet' | 'desktop';

/**
 * Breakpoints (spec):
 *   ≤767        → Mobile
 *   768–1023    → Tablet
 *   ≥1024       → Desktop
 *   landscape && height<500 && width<1024 → Mobile Landscape (live
 *   performance mode) — takes precedence, because an 844×390 phone
 *   held sideways is a phone, not a tablet.
 */
export const computeLayoutMode = (width: number, height: number): LayoutMode => {
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > height &&
    height < 500 &&
    width < 1024
  ) {
    return 'mobileLandscape';
  }
  if (width <= 767) return 'mobile';
  if (width <= 1023) return 'tablet';
  return 'desktop';
};

export const isMobileLike = (mode: LayoutMode): boolean =>
  mode === 'mobile' || mode === 'mobileLandscape';

// ── Mini map ──────────────────────────────────────────────────────────

export interface MiniMapItem {
  /** 0-based page index. */
  page: number;
  /** First/last step number (1-based) for the a11y label. */
  firstStep: number;
  lastStep: number;
  /** The page currently shown in the grid. */
  isActive: boolean;
  /** The page the playhead is currently inside (-1 step → none). */
  isPlaying: boolean;
}

/**
 * One item per 16-step page. Shows where the visible window sits inside
 * the full loop and doubles as the pager (tap → jump).
 */
export const buildMiniMap = (
  loopLength: number,
  stepPage: number,
  currentStep: number,
  perPage = 16,
): MiniMapItem[] => {
  const safeLoop = Number.isFinite(loopLength) && loopLength > 0 ? loopLength : perPage;
  const totalPages = Math.max(1, Math.ceil(safeLoop / perPage));
  const playingPage = currentStep >= 0 ? Math.floor(currentStep / perPage) : -1;
  return Array.from({ length: totalPages }, (_, page) => ({
    page,
    firstStep: page * perPage + 1,
    lastStep: Math.min(safeLoop, (page + 1) * perPage),
    isActive: page === stepPage,
    isPlaying: page === playingPage,
  }));
};

// ── Quick Memory guard ────────────────────────────────────────────────

/**
 * Quick Memory Bar policy: LOAD is one tap (the existing timeline
 * confirm-guard still applies); SAVE must never be a stray tap — the
 * bar arms first, and overwriting a NON-EMPTY slot additionally asks
 * for confirmation. Returns whether the save may proceed.
 */
export const confirmQuickSave = (
  slotId: string,
  slotHasData: boolean,
  confirmFn: (message: string) => boolean,
): boolean => {
  if (!slotHasData) return true; // empty slot → saving is harmless
  return confirmFn(`MEMORY ${slotId} を上書き保存しますか？`);
};

// ── Track groups (mobile shows one group at a time) ──────────────────

export type TrackGroup = 'drum' | 'bass' | 'lead';

export const TRACK_GROUPS: ReadonlyArray<{ id: TrackGroup; label: string }> = [
  { id: 'drum', label: 'DRUM' },
  { id: 'bass', label: 'BASS' },
  { id: 'lead', label: 'LEAD' },
];
