import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPRESSOR_RATIO_MAX,
  COMPRESSOR_RATIO_MIN,
  COMPRESSOR_THRESHOLD_MAX,
  COMPRESSOR_THRESHOLD_MIN,
  DELAY_FEEDBACK_MAX,
  DELAY_TIMES,
  FILTER_RESONANCE_MAX,
  FILTER_RESONANCE_MIN,
  FILTER_SWEEP_MAX,
  FILTER_SWEEP_MIN,
  MASTER_VOLUME_MAX,
  MASTER_VOLUME_MIN,
  REVERB_DECAY_MAX,
  REVERB_DECAY_MIN,
  STORAGE_KEY_PERFORMANCE,
  STORAGE_KEY_SNAPSHOTS,
  TRACKS,
  TRACK_SEND_MAX,
  TRACK_SEND_MIN,
  clamp,
} from '../constants';
import type { TrackId } from '../types';
import type {
  ParamDescriptor,
  PerformanceState,
  Snapshot,
  SnapshotMap,
  SnapshotSlot,
  TrackSends,
} from '../types/audio';
import type { AudioGraph } from '../audio/createAudioGraph';

// ──────────────────────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────────────────────

const defaultTrackSends = (): TrackSends =>
  TRACKS.reduce((acc, t) => {
    acc[t.id] = { delay: 0, reverb: 0.1 };
    return acc;
  }, {} as TrackSends);

const defaultPerformanceState = (): PerformanceState => ({
  masterVolume: -6,
  filterSweep: 0,
  filterResonance: 0.7,
  delay: { enabled: false, wet: 0.3, feedback: 0.4, time: '8n' },
  reverb: { enabled: true, wet: 0.3, decay: 2.5 },
  compressor: { enabled: false, threshold: -18, ratio: 3 },
  kill: { low: false, mid: false, high: false },
  trackSends: defaultTrackSends(),
});

const emptySnapshot = (): Snapshot => ({
  empty: true,
  state: defaultPerformanceState(),
});

const defaultSnapshots = (): SnapshotMap => ({
  A: emptySnapshot(),
  B: emptySnapshot(),
  C: emptySnapshot(),
  D: emptySnapshot(),
});

// ──────────────────────────────────────────────────────────────────────────
// Tolerant normalizers (storage migration / partial recovery)
// ──────────────────────────────────────────────────────────────────────────

const num = (v: unknown, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : def;
const bool = (v: unknown, def: boolean): boolean =>
  typeof v === 'boolean' ? v : def;

const normalizeTrackSends = (raw: unknown): TrackSends => {
  const def = defaultTrackSends();
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Record<string, unknown>;
  for (const t of TRACKS) {
    const cell = obj[t.id] as { delay?: unknown; reverb?: unknown } | undefined;
    if (cell) {
      def[t.id] = {
        delay: clamp(num(cell.delay, 0), TRACK_SEND_MIN, TRACK_SEND_MAX),
        reverb: clamp(num(cell.reverb, 0.1), TRACK_SEND_MIN, TRACK_SEND_MAX),
      };
    }
  }
  return def;
};

const normalizePerformance = (raw: unknown): PerformanceState => {
  const d = defaultPerformanceState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<PerformanceState> & Record<string, unknown>;
  return {
    masterVolume: clamp(num(r.masterVolume, d.masterVolume), MASTER_VOLUME_MIN, MASTER_VOLUME_MAX),
    filterSweep: clamp(num(r.filterSweep, d.filterSweep), FILTER_SWEEP_MIN, FILTER_SWEEP_MAX),
    filterResonance: clamp(num(r.filterResonance, d.filterResonance), FILTER_RESONANCE_MIN, FILTER_RESONANCE_MAX),
    delay: {
      enabled: bool(r.delay?.enabled, d.delay.enabled),
      wet: clamp(num(r.delay?.wet, d.delay.wet), 0, 1),
      feedback: clamp(num(r.delay?.feedback, d.delay.feedback), 0, DELAY_FEEDBACK_MAX),
      time: (DELAY_TIMES as readonly string[]).includes(r.delay?.time as string)
        ? (r.delay!.time as PerformanceState['delay']['time'])
        : d.delay.time,
    },
    reverb: {
      enabled: bool(r.reverb?.enabled, d.reverb.enabled),
      wet: clamp(num(r.reverb?.wet, d.reverb.wet), 0, 1),
      decay: clamp(num(r.reverb?.decay, d.reverb.decay), REVERB_DECAY_MIN, REVERB_DECAY_MAX),
    },
    compressor: {
      enabled: bool(r.compressor?.enabled, d.compressor.enabled),
      threshold: clamp(num(r.compressor?.threshold, d.compressor.threshold), COMPRESSOR_THRESHOLD_MIN, COMPRESSOR_THRESHOLD_MAX),
      ratio: clamp(num(r.compressor?.ratio, d.compressor.ratio), COMPRESSOR_RATIO_MIN, COMPRESSOR_RATIO_MAX),
    },
    kill: {
      low: bool(r.kill?.low, false),
      mid: bool(r.kill?.mid, false),
      high: bool(r.kill?.high, false),
    },
    trackSends: normalizeTrackSends(r.trackSends),
  };
};

const normalizeSnapshots = (raw: unknown): SnapshotMap => {
  const result = defaultSnapshots();
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, { empty?: unknown; state?: unknown } | undefined>;
  for (const slot of ['A', 'B', 'C', 'D'] as SnapshotSlot[]) {
    const v = obj[slot];
    if (v && !v.empty && v.state) {
      result[slot] = { empty: false, state: normalizePerformance(v.state) };
    }
  }
  return result;
};

const loadPerformance = (): PerformanceState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERFORMANCE);
    if (raw) return normalizePerformance(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return defaultPerformanceState();
};

const loadSnapshots = (): SnapshotMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (raw) return normalizeSnapshots(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return defaultSnapshots();
};

// ──────────────────────────────────────────────────────────────────────────
// Param descriptor registry — used for ID-based access (MIDI mapping in MVP4)
// ──────────────────────────────────────────────────────────────────────────

const buildDescriptors = (): ParamDescriptor[] => {
  const list: ParamDescriptor[] = [
    { id: 'master.volume', label: 'Master Volume', type: 'number', min: MASTER_VOLUME_MIN, max: MASTER_VOLUME_MAX, step: 0.5, unit: 'dB' },
    { id: 'master.filterSweep', label: 'Filter Sweep', type: 'number', min: FILTER_SWEEP_MIN, max: FILTER_SWEEP_MAX, step: 1 },
    { id: 'master.filterResonance', label: 'Filter Q', type: 'number', min: FILTER_RESONANCE_MIN, max: FILTER_RESONANCE_MAX, step: 0.1 },
    { id: 'master.kill.low', label: 'Kill Low', type: 'boolean' },
    { id: 'master.kill.mid', label: 'Kill Mid', type: 'boolean' },
    { id: 'master.kill.high', label: 'Kill High', type: 'boolean' },
    { id: 'master.delay.enabled', label: 'Delay On', type: 'boolean' },
    { id: 'master.delay.wet', label: 'Delay Wet', type: 'number', min: 0, max: 1, step: 0.01 },
    { id: 'master.delay.feedback', label: 'Delay Feedback', type: 'number', min: 0, max: DELAY_FEEDBACK_MAX, step: 0.01 },
    { id: 'master.delay.time', label: 'Delay Time', type: 'enum', values: DELAY_TIMES },
    { id: 'master.reverb.enabled', label: 'Reverb On', type: 'boolean' },
    { id: 'master.reverb.wet', label: 'Reverb Wet', type: 'number', min: 0, max: 1, step: 0.01 },
    { id: 'master.reverb.decay', label: 'Reverb Decay', type: 'number', min: REVERB_DECAY_MIN, max: REVERB_DECAY_MAX, step: 0.1, unit: 's' },
    { id: 'master.compressor.enabled', label: 'Comp On', type: 'boolean' },
    { id: 'master.compressor.threshold', label: 'Comp Threshold', type: 'number', min: COMPRESSOR_THRESHOLD_MIN, max: COMPRESSOR_THRESHOLD_MAX, step: 1, unit: 'dB' },
    { id: 'master.compressor.ratio', label: 'Comp Ratio', type: 'number', min: COMPRESSOR_RATIO_MIN, max: COMPRESSOR_RATIO_MAX, step: 0.5 },
  ];
  for (const t of TRACKS) {
    list.push({ id: `track.${t.id}.delaySend`, label: `${t.label} Delay Send`, type: 'number', min: 0, max: 1, step: 0.01 });
    list.push({ id: `track.${t.id}.reverbSend`, label: `${t.label} Reverb Send`, type: 'number', min: 0, max: 1, step: 0.01 });
  }
  return list;
};

export const PARAM_DESCRIPTORS: readonly ParamDescriptor[] = buildDescriptors();

// ──────────────────────────────────────────────────────────────────────────
// Apply state to the audio graph (push UI values into Tone nodes)
// ──────────────────────────────────────────────────────────────────────────

interface ApplyOpts {
  ramp?: number;
}

const applyState = (graph: AudioGraph, s: PerformanceState, opts: ApplyOpts = {}) => {
  const r = opts.ramp;
  const m = graph.master;
  m.setMasterVolume(s.masterVolume, r);
  m.setFilterSweep(s.filterSweep, r);
  m.setFilterResonance(s.filterResonance, r);
  m.setKill('low', s.kill.low);
  m.setKill('mid', s.kill.mid);
  m.setKill('high', s.kill.high);
  m.setDelayEnabled(s.delay.enabled, r);
  m.setDelayWet(s.delay.wet, r);
  m.setDelayFeedback(s.delay.feedback, r);
  m.setDelayTime(s.delay.time);
  m.setReverbEnabled(s.reverb.enabled, r);
  m.setReverbWet(s.reverb.wet, r);
  m.setReverbDecay(s.reverb.decay);
  m.setCompressorEnabled(s.compressor.enabled, r);
  m.setCompressorThreshold(s.compressor.threshold, r);
  m.setCompressorRatio(s.compressor.ratio, r);
  for (const t of TRACKS) {
    const send = s.trackSends[t.id];
    graph.tracks[t.id].setDelaySend(send.delay, r);
    graph.tracks[t.id].setReverbSend(send.reverb, r);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────

export const usePerformanceControls = (audioGraph: AudioGraph | null) => {
  const [state, setState] = useState<PerformanceState>(loadPerformance);
  const [snapshots, setSnapshots] = useState<SnapshotMap>(loadSnapshots);
  const [morphTime, setMorphTime] = useState(1);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PERFORMANCE, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  // Persist snapshots
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(snapshots));
    } catch {
      /* ignore */
    }
  }, [snapshots]);

  // Sync state → audio graph whenever either changes
  useEffect(() => {
    if (!audioGraph) return;
    applyState(audioGraph, state);
  }, [audioGraph, state]);

  // ── Setters (typed) ────────────────────────────────────────────────

  const update = useCallback((patch: Partial<PerformanceState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setMasterVolume = useCallback((v: number) => {
    update({ masterVolume: clamp(v, MASTER_VOLUME_MIN, MASTER_VOLUME_MAX) });
  }, [update]);

  const setFilterSweep = useCallback((v: number) => {
    update({ filterSweep: clamp(v, FILTER_SWEEP_MIN, FILTER_SWEEP_MAX) });
  }, [update]);

  const setFilterResonance = useCallback((q: number) => {
    update({ filterResonance: clamp(q, FILTER_RESONANCE_MIN, FILTER_RESONANCE_MAX) });
  }, [update]);

  const setKill = useCallback((band: 'low' | 'mid' | 'high', killed: boolean) => {
    setState((prev) => ({ ...prev, kill: { ...prev.kill, [band]: killed } }));
  }, []);

  const setDelay = useCallback((patch: Partial<PerformanceState['delay']>) => {
    setState((prev) => ({ ...prev, delay: { ...prev.delay, ...patch } }));
  }, []);

  const setReverb = useCallback((patch: Partial<PerformanceState['reverb']>) => {
    setState((prev) => ({ ...prev, reverb: { ...prev.reverb, ...patch } }));
  }, []);

  const setCompressor = useCallback((patch: Partial<PerformanceState['compressor']>) => {
    setState((prev) => ({ ...prev, compressor: { ...prev.compressor, ...patch } }));
  }, []);

  const setTrackSend = useCallback(
    (trackId: TrackId, kind: 'delay' | 'reverb', value: number) => {
      const v = clamp(value, TRACK_SEND_MIN, TRACK_SEND_MAX);
      setState((prev) => ({
        ...prev,
        trackSends: {
          ...prev.trackSends,
          [trackId]: { ...prev.trackSends[trackId], [kind]: v },
        },
      }));
    },
    [],
  );

  // ── Snapshots ──────────────────────────────────────────────────────

  const saveSnapshot = useCallback((slot: SnapshotSlot) => {
    setSnapshots((prev) => ({
      ...prev,
      [slot]: { empty: false, state: stateRef.current },
    }));
  }, []);

  const recallSnapshot = useCallback(
    (slot: SnapshotSlot) => {
      const snap = snapshots[slot];
      if (snap.empty) return;
      // Update React state instantly (UI snaps to new values)
      setState(snap.state);
      // Audio rampTo for smooth morph (visual is snapped, audio glides)
      if (audioGraph) applyState(audioGraph, snap.state, { ramp: morphTime });
    },
    [snapshots, audioGraph, morphTime],
  );

  const clearSnapshot = useCallback((slot: SnapshotSlot) => {
    setSnapshots((prev) => ({ ...prev, [slot]: emptySnapshot() }));
  }, []);

  // ── ID-based setter (for MVP4 MIDI) ───────────────────────────────

  const setParamById = useCallback(
    (id: string, value: number | boolean | string) => {
      // master.* params
      if (id === 'master.volume') return setMasterVolume(Number(value));
      if (id === 'master.filterSweep') return setFilterSweep(Number(value));
      if (id === 'master.filterResonance') return setFilterResonance(Number(value));
      if (id === 'master.kill.low') return setKill('low', Boolean(value));
      if (id === 'master.kill.mid') return setKill('mid', Boolean(value));
      if (id === 'master.kill.high') return setKill('high', Boolean(value));
      if (id === 'master.delay.enabled') return setDelay({ enabled: Boolean(value) });
      if (id === 'master.delay.wet') return setDelay({ wet: Number(value) });
      if (id === 'master.delay.feedback') return setDelay({ feedback: Number(value) });
      if (id === 'master.delay.time')
        return setDelay({ time: value as PerformanceState['delay']['time'] });
      if (id === 'master.reverb.enabled') return setReverb({ enabled: Boolean(value) });
      if (id === 'master.reverb.wet') return setReverb({ wet: Number(value) });
      if (id === 'master.reverb.decay') return setReverb({ decay: Number(value) });
      if (id === 'master.compressor.enabled') return setCompressor({ enabled: Boolean(value) });
      if (id === 'master.compressor.threshold') return setCompressor({ threshold: Number(value) });
      if (id === 'master.compressor.ratio') return setCompressor({ ratio: Number(value) });
      // track.<id>.delaySend / reverbSend
      const m = /^track\.([^.]+)\.(delaySend|reverbSend)$/.exec(id);
      if (m) {
        const trackId = m[1] as TrackId;
        const kind = m[2] === 'delaySend' ? 'delay' : 'reverb';
        return setTrackSend(trackId, kind, Number(value));
      }
    },
    [setMasterVolume, setFilterSweep, setFilterResonance, setKill, setDelay, setReverb, setCompressor, setTrackSend],
  );

  const descriptors = useMemo(() => PARAM_DESCRIPTORS, []);

  return {
    state,
    snapshots,
    morphTime,
    setMorphTime,
    descriptors,
    setMasterVolume,
    setFilterSweep,
    setFilterResonance,
    setKill,
    setDelay,
    setReverb,
    setCompressor,
    setTrackSend,
    saveSnapshot,
    recallSnapshot,
    clearSnapshot,
    setParamById,
  };
};
