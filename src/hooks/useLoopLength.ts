import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_LOOP_LENGTH,
  LOOP_LENGTHS,
  STEP_COUNT_PER_PAGE,
  STORAGE_KEY_LOOP,
  type LoopLengthType,
} from '../constants';

interface PersistedLoopState {
  loopLength: LoopLengthType;
  stepPage: number;
}

const isLoopLength = (v: unknown): v is LoopLengthType =>
  (LOOP_LENGTHS as readonly number[]).includes(v as number);

const loadState = (): PersistedLoopState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOOP);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedLoopState>;
      const loopLength = isLoopLength(parsed.loopLength)
        ? parsed.loopLength
        : DEFAULT_LOOP_LENGTH;
      const stepPage =
        typeof parsed.stepPage === 'number' && parsed.stepPage >= 0
          ? Math.floor(parsed.stepPage)
          : 0;
      return { loopLength, stepPage };
    }
  } catch {
    /* ignore */
  }
  return { loopLength: DEFAULT_LOOP_LENGTH, stepPage: 0 };
};

/**
 * Manages the per-bar step count (loopLength) and which 16-step page is
 * currently visible on screen. The Tone.Sequence inside the engine reads
 * `loopLength` and rebuilds when it changes; the StepGrid reads `stepPage`
 * to decide which 16 steps to render.
 */
export const useLoopLength = () => {
  const [state, setState] = useState<PersistedLoopState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOOP, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setLoopLength = useCallback((loopLength: LoopLengthType) => {
    setState((prev) => {
      // Snap stepPage so it always points at a page that exists for the
      // new loop length.
      const maxPage = Math.max(0, Math.ceil(loopLength / STEP_COUNT_PER_PAGE) - 1);
      return {
        loopLength,
        stepPage: Math.min(prev.stepPage, maxPage),
      };
    });
  }, []);

  const setStepPage = useCallback((stepPage: number) => {
    setState((prev) => ({ ...prev, stepPage: Math.max(0, Math.floor(stepPage)) }));
  }, []);

  /** Number of pages currently selectable (1..4). */
  const totalPages = Math.max(1, Math.ceil(state.loopLength / STEP_COUNT_PER_PAGE));

  return {
    loopLength: state.loopLength,
    stepPage: state.stepPage,
    totalPages,
    setLoopLength,
    setStepPage,
    /** Replace whole state in one go — used by Timeline load. */
    setFull: (next: Partial<PersistedLoopState>) =>
      setState((prev) => ({ ...prev, ...next })),
  };
};
