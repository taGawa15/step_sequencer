import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FxMode,
  PerformanceFx,
  RepeatRate,
} from '../audio/performanceFx';
import { createPerformanceFx } from '../audio/performanceFx';
import type { AudioGraph } from '../audio/createAudioGraph';

const STORAGE_KEY = 'step-sequencer:perfFx:v1';

export interface PerformanceFxState {
  beatRepeatRate: RepeatRate;
  beatRepeatMode: FxMode;
  stutterRate: RepeatRate;
  stutterDepth: number; // 0..1 (engine clamps the gate floor at 0.85)
  stutterMode: FxMode;
  tapeStopTime: number; // seconds
  tapeStopMode: 'release' | 'resume';
  throwMode: FxMode;
  freezeMode: FxMode;
  crushMode: FxMode;
}

const DEFAULT_STATE: PerformanceFxState = {
  beatRepeatRate: '16n',
  beatRepeatMode: 'momentary',
  stutterRate: '16n',
  stutterDepth: 1,
  stutterMode: 'momentary',
  tapeStopTime: 0.5,
  tapeStopMode: 'release',
  throwMode: 'momentary',
  freezeMode: 'momentary',
  crushMode: 'momentary',
};

const VALID_RATES = new Set(['4n', '8n', '16n', '32n']);

const mode = (v: unknown): FxMode => (v === 'latch' ? 'latch' : 'momentary');

const load = (): PerformanceFxState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PerformanceFxState>;
      return {
        beatRepeatRate: VALID_RATES.has(parsed.beatRepeatRate as string)
          ? (parsed.beatRepeatRate as RepeatRate)
          : DEFAULT_STATE.beatRepeatRate,
        beatRepeatMode: mode(parsed.beatRepeatMode),
        stutterRate: VALID_RATES.has(parsed.stutterRate as string)
          ? (parsed.stutterRate as RepeatRate)
          : DEFAULT_STATE.stutterRate,
        stutterDepth:
          typeof parsed.stutterDepth === 'number'
            ? Math.max(0, Math.min(1, parsed.stutterDepth))
            : DEFAULT_STATE.stutterDepth,
        stutterMode: mode(parsed.stutterMode),
        tapeStopTime:
          typeof parsed.tapeStopTime === 'number'
            ? parsed.tapeStopTime
            : DEFAULT_STATE.tapeStopTime,
        tapeStopMode: parsed.tapeStopMode === 'resume' ? 'resume' : 'release',
        throwMode: mode(parsed.throwMode),
        freezeMode: mode(parsed.freezeMode),
        crushMode: mode(parsed.crushMode),
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_STATE;
};

export type FxLastTrigger = Record<
  'beat' | 'stutter' | 'tape' | 'throw' | 'freeze' | 'crush',
  number | null
>;

const NO_TRIGGERS: FxLastTrigger = {
  beat: null,
  stutter: null,
  tape: null,
  throw: null,
  freeze: null,
  crush: null,
};

interface Args {
  /** Live audio graph — master-bus FX (stutter gate / throw / freeze /
   *  crush) are driven through it. Null while the graph boots. */
  audioGraph: AudioGraph | null;
  /**
   * Called by Beat Repeat on each tick with the Loop's precise scheduled
   * time. The consumer should re-fire the captured slice AT that time.
   */
  onBeatRepeatTick: (time: number) => void;
  /**
   * Engage/release hooks around Beat Repeat. The consumer captures the
   * repeat slice on engage and suppresses the sequencer's own triggers
   * until release, so the repeat REPLACES the stream (stacking both
   * collided on the same mono voices at high rates — the 1/32 bug).
   */
  onBeatRepeatEngage?: () => void;
  onBeatRepeatRelease?: () => void;
  /**
   * Called when a release-mode tape stop completes — the consumer should
   * stop the transport here. BPM is restored silently right after.
   */
  onTapeRelease?: () => void;
}

export const usePerformanceFx = ({
  audioGraph,
  onBeatRepeatTick,
  onBeatRepeatEngage,
  onBeatRepeatRelease,
  onTapeRelease,
}: Args) => {
  const [state, setState] = useState<PerformanceFxState>(load);
  const [beatActive, setBeatActive] = useState(false);
  const [stutterActive, setStutterActive] = useState(false);
  const [tapeActive, setTapeActive] = useState(false);
  const [throwActive, setThrowActive] = useState(false);
  const [freezeActive, setFreezeActive] = useState(false);
  const [crushActive, setCrushActive] = useState(false);
  /** Per-FX wall-clock ms of the most recent engage (Debug Panel). */
  const [lastTrigger, setLastTrigger] = useState<FxLastTrigger>(NO_TRIGGERS);
  /** Set when an FX was engaged before the audio graph existed. */
  const [fxWarning, setFxWarning] = useState<string | null>(null);

  const fxRef = useRef<PerformanceFx | null>(null);
  const graphRef = useRef<AudioGraph | null>(audioGraph);
  useEffect(() => {
    graphRef.current = audioGraph;
  }, [audioGraph]);
  const onTickRef = useRef(onBeatRepeatTick);
  useEffect(() => {
    onTickRef.current = onBeatRepeatTick;
  }, [onBeatRepeatTick]);
  const onTapeReleaseRef = useRef(onTapeRelease);
  useEffect(() => {
    onTapeReleaseRef.current = onTapeRelease;
  }, [onTapeRelease]);
  const onBeatEngageRef = useRef(onBeatRepeatEngage);
  useEffect(() => {
    onBeatEngageRef.current = onBeatRepeatEngage;
  }, [onBeatRepeatEngage]);
  const onBeatReleaseRef = useRef(onBeatRepeatRelease);
  useEffect(() => {
    onBeatReleaseRef.current = onBeatRepeatRelease;
  }, [onBeatRepeatRelease]);

  const mark = useCallback((key: keyof FxLastTrigger) => {
    setLastTrigger((p) => ({ ...p, [key]: Date.now() }));
  }, []);

  const requireGraph = useCallback((fxName: string): AudioGraph | null => {
    const g = graphRef.current;
    if (!g) {
      setFxWarning(
        `${fxName} を起動できません — オーディオエンジン初期化前です（一度 PLAY を押してください）`,
      );
      return null;
    }
    setFxWarning(null);
    return g;
  }, []);

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
  const setBeatRepeatMode = useCallback((m: FxMode) => {
    setState((p) => ({ ...p, beatRepeatMode: m }));
  }, []);
  const setStutterRate = useCallback(
    (rate: RepeatRate) => {
      setState((p) => ({ ...p, stutterRate: rate }));
      // Restart with new rate if currently active
      if (stutterActive) {
        fxRef.current?.startStutter(
          rate,
          state.stutterDepth,
          graphRef.current?.master.stutterGate.gain ?? null,
        );
      }
    },
    [state.stutterDepth, stutterActive],
  );
  const setStutterDepth = useCallback((d: number) => {
    setState((p) => ({ ...p, stutterDepth: d }));
    fxRef.current?.setStutterDepth(d);
  }, []);
  const setStutterMode = useCallback((m: FxMode) => {
    setState((p) => ({ ...p, stutterMode: m }));
  }, []);
  const setTapeStopTime = useCallback((t: number) => {
    setState((p) => ({ ...p, tapeStopTime: t }));
  }, []);
  const setTapeStopMode = useCallback((m: 'release' | 'resume') => {
    setState((p) => ({ ...p, tapeStopMode: m }));
  }, []);
  const setThrowMode = useCallback((m: FxMode) => {
    setState((p) => ({ ...p, throwMode: m }));
  }, []);
  const setFreezeMode = useCallback((m: FxMode) => {
    setState((p) => ({ ...p, freezeMode: m }));
  }, []);
  const setCrushMode = useCallback((m: FxMode) => {
    setState((p) => ({ ...p, crushMode: m }));
  }, []);

  // ── Beat Repeat ────────────────────────────────────────────────
  const startBeatRepeat = useCallback(() => {
    if (!fxRef.current) return;
    // Capture the slice + mute the sequencer's own stream first, so the
    // very first loop tick already plays the snapshot exclusively.
    onBeatEngageRef.current?.();
    fxRef.current.startBeatRepeat(state.beatRepeatRate, (time) =>
      onTickRef.current(time),
    );
    setBeatActive(true);
    mark('beat');
  }, [state.beatRepeatRate, mark]);
  const stopBeatRepeat = useCallback(() => {
    fxRef.current?.stopBeatRepeat();
    onBeatReleaseRef.current?.();
    setBeatActive(false);
  }, []);
  const toggleBeatRepeat = useCallback(() => {
    if (beatActive) stopBeatRepeat();
    else startBeatRepeat();
  }, [beatActive, startBeatRepeat, stopBeatRepeat]);

  // ── Stutter ────────────────────────────────────────────────────
  const startStutter = useCallback(() => {
    if (!fxRef.current) return;
    const g = requireGraph('STUTTER');
    if (!g) return;
    const ok = fxRef.current.startStutter(
      state.stutterRate,
      state.stutterDepth,
      g.master.stutterGate.gain,
    );
    if (ok) {
      setStutterActive(true);
      mark('stutter');
    }
  }, [state.stutterRate, state.stutterDepth, requireGraph, mark]);
  const stopStutter = useCallback(() => {
    fxRef.current?.stopStutter();
    setStutterActive(false);
  }, []);
  const toggleStutter = useCallback(() => {
    if (stutterActive) stopStutter();
    else startStutter();
  }, [stutterActive, startStutter, stopStutter]);

  // ── Tape Stop ──────────────────────────────────────────────────
  const triggerTapeStop = useCallback(() => {
    if (!fxRef.current) return;
    // Two layers of re-trigger protection: the React flag covers the UI,
    // and startTapeStop's synchronous internal flag covers key-repeat /
    // double keydown races that land before this state updates.
    if (tapeActive) return;
    const started = fxRef.current.startTapeStop(state.tapeStopTime, () => {
      if (state.tapeStopMode === 'resume') {
        fxRef.current?.resumeTapeStop(0.4);
      } else {
        // Release: stop the transport first (silence), then restore the
        // internal BPM so the next Play runs at the original tempo —
        // never leave the transport crawling at 5 BPM.
        onTapeReleaseRef.current?.();
        fxRef.current?.finishTapeStop();
      }
      setTapeActive(false);
    });
    if (started) {
      setTapeActive(true);
      mark('tape');
    }
  }, [state.tapeStopTime, state.tapeStopMode, tapeActive, mark]);

  // ── Master-bus FX: Delay Throw / Reverb Freeze / Bit Crush ─────
  const startThrow = useCallback(() => {
    const g = requireGraph('DELAY THROW');
    if (!g) return;
    g.master.setDelayThrow(true);
    setThrowActive(true);
    mark('throw');
  }, [requireGraph, mark]);
  const stopThrow = useCallback(() => {
    graphRef.current?.master.setDelayThrow(false);
    setThrowActive(false);
  }, []);
  const toggleThrow = useCallback(() => {
    if (throwActive) stopThrow();
    else startThrow();
  }, [throwActive, startThrow, stopThrow]);

  const startFreeze = useCallback(() => {
    const g = requireGraph('REVERB FREEZE');
    if (!g) return;
    g.master.setReverbFreeze(true);
    setFreezeActive(true);
    mark('freeze');
  }, [requireGraph, mark]);
  const stopFreeze = useCallback(() => {
    graphRef.current?.master.setReverbFreeze(false);
    setFreezeActive(false);
  }, []);
  const toggleFreeze = useCallback(() => {
    if (freezeActive) stopFreeze();
    else startFreeze();
  }, [freezeActive, startFreeze, stopFreeze]);

  const startCrush = useCallback(() => {
    const g = requireGraph('BIT CRUSH');
    if (!g) return;
    g.master.setBitCrush(true);
    setCrushActive(true);
    mark('crush');
  }, [requireGraph, mark]);
  const stopCrush = useCallback(() => {
    graphRef.current?.master.setBitCrush(false);
    setCrushActive(false);
  }, []);
  const toggleCrush = useCallback(() => {
    if (crushActive) stopCrush();
    else startCrush();
  }, [crushActive, startCrush, stopCrush]);

  const panic = useCallback(() => {
    fxRef.current?.panic();
    onBeatReleaseRef.current?.(); // un-suppress the sequencer stream
    const g = graphRef.current;
    if (g) {
      g.master.setDelayThrow(false);
      g.master.setReverbFreeze(false);
      g.master.setBitCrush(false);
    }
    setBeatActive(false);
    setStutterActive(false);
    setTapeActive(false);
    setThrowActive(false);
    setFreezeActive(false);
    setCrushActive(false);
  }, []);

  return {
    state,
    beatActive,
    stutterActive,
    tapeActive,
    throwActive,
    freezeActive,
    crushActive,
    lastTrigger,
    fxWarning,
    setBeatRepeatRate,
    setBeatRepeatMode,
    setStutterRate,
    setStutterDepth,
    setStutterMode,
    setTapeStopTime,
    setTapeStopMode,
    setThrowMode,
    setFreezeMode,
    setCrushMode,
    startBeatRepeat,
    stopBeatRepeat,
    toggleBeatRepeat,
    startStutter,
    stopStutter,
    toggleStutter,
    triggerTapeStop,
    startThrow,
    stopThrow,
    toggleThrow,
    startFreeze,
    stopFreeze,
    toggleFreeze,
    startCrush,
    stopCrush,
    toggleCrush,
    panic,
  };
};
