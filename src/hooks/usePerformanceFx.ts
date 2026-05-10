import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FxMode,
  PerformanceFx,
  RepeatRate,
} from '../audio/performanceFx';
import { createPerformanceFx } from '../audio/performanceFx';

const STORAGE_KEY = 'step-sequencer:perfFx:v1';

export interface PerformanceFxState {
  beatRepeatRate: RepeatRate;
  beatRepeatMode: FxMode;
  stutterRate: RepeatRate;
  stutterDepth: number; // 0..1
  stutterMode: FxMode;
  tapeStopTime: number; // seconds
  tapeStopMode: 'release' | 'resume';
}

const DEFAULT_STATE: PerformanceFxState = {
  beatRepeatRate: '16n',
  beatRepeatMode: 'momentary',
  stutterRate: '16n',
  stutterDepth: 1,
  stutterMode: 'momentary',
  tapeStopTime: 0.5,
  tapeStopMode: 'release',
};

const VALID_RATES = new Set(['4n', '8n', '16n', '32n']);

const load = (): PerformanceFxState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PerformanceFxState>;
      return {
        beatRepeatRate: VALID_RATES.has(parsed.beatRepeatRate as string)
          ? (parsed.beatRepeatRate as RepeatRate)
          : DEFAULT_STATE.beatRepeatRate,
        beatRepeatMode:
          parsed.beatRepeatMode === 'latch' ? 'latch' : 'momentary',
        stutterRate: VALID_RATES.has(parsed.stutterRate as string)
          ? (parsed.stutterRate as RepeatRate)
          : DEFAULT_STATE.stutterRate,
        stutterDepth:
          typeof parsed.stutterDepth === 'number'
            ? Math.max(0, Math.min(1, parsed.stutterDepth))
            : DEFAULT_STATE.stutterDepth,
        stutterMode: parsed.stutterMode === 'latch' ? 'latch' : 'momentary',
        tapeStopTime:
          typeof parsed.tapeStopTime === 'number'
            ? parsed.tapeStopTime
            : DEFAULT_STATE.tapeStopTime,
        tapeStopMode: parsed.tapeStopMode === 'resume' ? 'resume' : 'release',
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_STATE;
};

interface Args {
  /**
   * Called by Beat Repeat on each tick. The consumer should re-fire all
   * currently-active step content.
   */
  onBeatRepeatTick: () => void;
}

export const usePerformanceFx = ({ onBeatRepeatTick }: Args) => {
  const [state, setState] = useState<PerformanceFxState>(load);
  const [beatActive, setBeatActive] = useState(false);
  const [stutterActive, setStutterActive] = useState(false);
  const [tapeActive, setTapeActive] = useState(false);

  const fxRef = useRef<PerformanceFx | null>(null);
  const onTickRef = useRef(onBeatRepeatTick);
  useEffect(() => {
    onTickRef.current = onBeatRepeatTick;
  }, [onBeatRepeatTick]);

  // Build the FX engine once
  useEffect(() => {
    const fx = createPerformanceFx();
    fxRef.current = fx;
    return () => {
      fx.dispose();
      fxRef.current = null;
    };
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  // ── Settings ──────────────────────────────────────────────────
  const setBeatRepeatRate = useCallback((rate: RepeatRate) => {
    setState((p) => ({ ...p, beatRepeatRate: rate }));
    fxRef.current?.setBeatRepeatRate(rate);
  }, []);
  const setBeatRepeatMode = useCallback((mode: FxMode) => {
    setState((p) => ({ ...p, beatRepeatMode: mode }));
  }, []);
  const setStutterRate = useCallback((rate: RepeatRate) => {
    setState((p) => ({ ...p, stutterRate: rate }));
    // Restart with new rate if currently active
    if (stutterActive) {
      fxRef.current?.startStutter(rate, state.stutterDepth);
    }
  }, [state.stutterDepth, stutterActive]);
  const setStutterDepth = useCallback((d: number) => {
    setState((p) => ({ ...p, stutterDepth: d }));
    fxRef.current?.setStutterDepth(d);
  }, []);
  const setStutterMode = useCallback((mode: FxMode) => {
    setState((p) => ({ ...p, stutterMode: mode }));
  }, []);
  const setTapeStopTime = useCallback((t: number) => {
    setState((p) => ({ ...p, tapeStopTime: t }));
  }, []);
  const setTapeStopMode = useCallback((mode: 'release' | 'resume') => {
    setState((p) => ({ ...p, tapeStopMode: mode }));
  }, []);

  // ── FX actions ─────────────────────────────────────────────────
  const startBeatRepeat = useCallback(() => {
    if (!fxRef.current) return;
    fxRef.current.startBeatRepeat(state.beatRepeatRate, () =>
      onTickRef.current(),
    );
    setBeatActive(true);
  }, [state.beatRepeatRate]);
  const stopBeatRepeat = useCallback(() => {
    fxRef.current?.stopBeatRepeat();
    setBeatActive(false);
  }, []);
  const toggleBeatRepeat = useCallback(() => {
    if (beatActive) stopBeatRepeat();
    else startBeatRepeat();
  }, [beatActive, startBeatRepeat, stopBeatRepeat]);

  const startStutter = useCallback(() => {
    if (!fxRef.current) return;
    fxRef.current.startStutter(state.stutterRate, state.stutterDepth);
    setStutterActive(true);
  }, [state.stutterRate, state.stutterDepth]);
  const stopStutter = useCallback(() => {
    fxRef.current?.stopStutter();
    setStutterActive(false);
  }, []);
  const toggleStutter = useCallback(() => {
    if (stutterActive) stopStutter();
    else startStutter();
  }, [stutterActive, startStutter, stopStutter]);

  const triggerTapeStop = useCallback(() => {
    if (!fxRef.current) return;
    setTapeActive(true);
    fxRef.current.startTapeStop(state.tapeStopTime, () => {
      if (state.tapeStopMode === 'resume') {
        fxRef.current?.resumeTapeStop(0.4);
      }
      setTapeActive(false);
    });
  }, [state.tapeStopTime, state.tapeStopMode]);

  const panic = useCallback(() => {
    fxRef.current?.panic();
    setBeatActive(false);
    setStutterActive(false);
    setTapeActive(false);
  }, []);

  return {
    state,
    beatActive,
    stutterActive,
    tapeActive,
    setBeatRepeatRate,
    setBeatRepeatMode,
    setStutterRate,
    setStutterDepth,
    setStutterMode,
    setTapeStopTime,
    setTapeStopMode,
    startBeatRepeat,
    stopBeatRepeat,
    toggleBeatRepeat,
    startStutter,
    stopStutter,
    toggleStutter,
    triggerTapeStop,
    panic,
  };
};
