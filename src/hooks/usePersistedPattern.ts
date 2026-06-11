import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_VELOCITY,
  DRUM_TRACKS,
  NOTE_DURATIONS,
  PROBABILITY_MAX,
  PROBABILITY_MIN,
  MICRO_TIMING_MAX,
  MICRO_TIMING_MIN,
  REPEAT_OPTIONS,
  MAX_STEP_COUNT,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  STORAGE_KEY_V3,
  STORAGE_KEY_V4,
  SYNTH_TRACKS,
  VELOCITY_MAX,
  VELOCITY_MIN,
  clamp,
  createDrumStep,
  createEmptyPattern,
  createStepComponents,
  createSynthStep,
} from '../constants';
import type {
  DrumStep,
  DrumTrackId,
  NoteDuration,
  Pattern,
  RepeatCount,
  Selection,
  StepComponents,
  SynthStep,
  SynthTrackDef,
  SynthTrackId,
} from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Tolerant normalizers — fill missing/invalid fields with sensible defaults
// instead of failing outright. v3 reads, v2 reads (no components yet), and
// partially-corrupted v3 reads all funnel through here.
// ──────────────────────────────────────────────────────────────────────────

const normalizeComponents = (raw: unknown): StepComponents => {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<StepComponents>;
  return {
    probability:
      typeof c.probability === 'number'
        ? clamp(c.probability, PROBABILITY_MIN, PROBABILITY_MAX)
        : 100,
    repeat: (REPEAT_OPTIONS as readonly number[]).includes(c.repeat as number)
      ? (c.repeat as RepeatCount)
      : 1,
    microTiming:
      typeof c.microTiming === 'number'
        ? clamp(c.microTiming, MICRO_TIMING_MIN, MICRO_TIMING_MAX)
        : 0,
    filterCutoff:
      typeof c.filterCutoff === 'number' && Number.isFinite(c.filterCutoff)
        ? c.filterCutoff
        : null,
    pan: typeof c.pan === 'number' && Number.isFinite(c.pan) ? c.pan : null,
    pitchOffset:
      typeof c.pitchOffset === 'number' && Number.isFinite(c.pitchOffset)
        ? c.pitchOffset
        : null,
  };
};

const normalizeDrumStep = (raw: unknown): DrumStep => {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<DrumStep>;
  return {
    active: !!s.active,
    velocity:
      typeof s.velocity === 'number'
        ? clamp(s.velocity, VELOCITY_MIN, VELOCITY_MAX)
        : DEFAULT_VELOCITY,
    components: normalizeComponents((s as { components?: unknown }).components),
  };
};

const normalizeSynthStep = (raw: unknown, track: SynthTrackDef): SynthStep => {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<SynthStep>;
  const note = typeof s.note === 'string' ? s.note : track.defaultNote;
  const duration = (NOTE_DURATIONS as readonly string[]).includes(s.duration as string)
    ? (s.duration as NoteDuration)
    : track.defaultDuration;
  return {
    active: !!s.active,
    note,
    duration,
    velocity:
      typeof s.velocity === 'number'
        ? clamp(s.velocity, VELOCITY_MIN, VELOCITY_MAX)
        : DEFAULT_VELOCITY,
    components: normalizeComponents((s as { components?: unknown }).components),
  };
};

/**
 * Accepts anything that looks like a "kind-split" pattern (`{drums, synths}`)
 * — including v2 (no components, no drum velocity) and partially-corrupted
 * v3 — and returns a fully-formed v3 Pattern. Returns null if the top-level
 * shape is unrecognizable (missing drums or synths).
 *
 * Exported so Timeline snapshot validation can reuse the exact same
 * tolerant rules (see utils/projectSnapshot.ts).
 */
export const normalizeKindSplitPattern = (raw: unknown): Pattern | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as { drums?: unknown; synths?: unknown };
  if (!data.drums || typeof data.drums !== 'object') return null;
  if (!data.synths || typeof data.synths !== 'object') return null;

  const drums = data.drums as Record<string, unknown>;
  const synths = data.synths as Record<string, unknown>;

  const result = createEmptyPattern();
  for (const t of DRUM_TRACKS) {
    const arr = drums[t.id];
    if (!Array.isArray(arr)) {
      result.drums[t.id] = Array.from({ length: MAX_STEP_COUNT }, createDrumStep);
    } else {
      // Pad up to MAX_STEP_COUNT for v4. Older v3 (16 steps) zero-pads.
      const padded = pad(arr, MAX_STEP_COUNT, () => undefined);
      result.drums[t.id] = padded.map((s) =>
        s === undefined ? createDrumStep() : normalizeDrumStep(s),
      );
    }
  }
  for (const t of SYNTH_TRACKS) {
    const arr = synths[t.id];
    if (!Array.isArray(arr)) {
      result.synths[t.id] = Array.from({ length: MAX_STEP_COUNT }, () =>
        createSynthStep(t),
      );
    } else {
      const padded = pad(arr, MAX_STEP_COUNT, () => undefined);
      result.synths[t.id] = padded.map((s) =>
        s === undefined ? createSynthStep(t) : normalizeSynthStep(s, t),
      );
    }
  }
  return result;
};

/** Pad/truncate an array to exactly `len` items. */
const pad = <T,>(arr: readonly T[], len: number, makeMissing: () => T): T[] => {
  const out: T[] = [];
  for (let i = 0; i < len; i++) out.push(i < arr.length ? arr[i] : makeMissing());
  return out;
};

// ──────────────────────────────────────────────────────────────────────────
// v1 (flat boolean[]) → v3 migration
// ──────────────────────────────────────────────────────────────────────────

const isV1Pattern = (data: unknown): data is Record<string, boolean[]> => {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  for (const t of [...DRUM_TRACKS, ...SYNTH_TRACKS]) {
    const arr = obj[t.id];
    if (!Array.isArray(arr) || !arr.every((s) => typeof s === 'boolean')) {
      return false;
    }
  }
  return true;
};

const migrateV1ToV3 = (v1: Record<string, boolean[]>): Pattern => {
  const empty = createEmptyPattern();
  for (const t of DRUM_TRACKS) {
    const old = v1[t.id];
    if (Array.isArray(old)) {
      empty.drums[t.id] = old.map<DrumStep>((b) => ({
        ...createDrumStep(),
        active: !!b,
      }));
    }
  }
  for (const t of SYNTH_TRACKS) {
    const old = v1[t.id];
    if (Array.isArray(old)) {
      empty.synths[t.id] = old.map<SynthStep>((b) => ({
        ...createSynthStep(t),
        active: !!b,
      }));
    }
  }
  return empty;
};

// ──────────────────────────────────────────────────────────────────────────
// Load
// ──────────────────────────────────────────────────────────────────────────

const loadPattern = (): Pattern => {
  // Newest schemas first. v4 uses 64-step arrays; v3/v2 normalize via padding.
  for (const key of [STORAGE_KEY_V4, STORAGE_KEY_V3, STORAGE_KEY_V2]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeKindSplitPattern(parsed);
      if (normalized) return normalized;
    } catch {
      /* fallthrough */
    }
  }
  // Fall back to v1 (legacy boolean[]) → upgrade.
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isV1Pattern(parsed)) return migrateV1ToV3(parsed);
    }
  } catch {
    /* fallthrough */
  }
  return createEmptyPattern();
};

// ──────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────

export const usePersistedPattern = () => {
  const [pattern, setPattern] = useState<Pattern>(loadPattern);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(pattern));
    } catch {
      // storage unavailable (quota / private mode) — silently skip
    }
  }, [pattern]);

  // ── Drum actions ────────────────────────────────────────────────────

  const toggleDrumStep = useCallback((trackId: DrumTrackId, idx: number) => {
    setPattern((prev) => {
      const list = prev.drums[trackId].slice();
      list[idx] = { ...list[idx], active: !list[idx].active };
      return { ...prev, drums: { ...prev.drums, [trackId]: list } };
    });
  }, []);

  const updateDrumStep = useCallback(
    (trackId: DrumTrackId, idx: number, patch: Partial<DrumStep>) => {
      setPattern((prev) => {
        const list = prev.drums[trackId].slice();
        list[idx] = { ...list[idx], ...patch };
        return { ...prev, drums: { ...prev.drums, [trackId]: list } };
      });
    },
    [],
  );

  // ── Synth actions ───────────────────────────────────────────────────

  const toggleSynthStep = useCallback((trackId: SynthTrackId, idx: number) => {
    setPattern((prev) => {
      const list = prev.synths[trackId].slice();
      list[idx] = { ...list[idx], active: !list[idx].active };
      return { ...prev, synths: { ...prev.synths, [trackId]: list } };
    });
  }, []);

  const updateSynthStep = useCallback(
    (trackId: SynthTrackId, idx: number, patch: Partial<SynthStep>) => {
      setPattern((prev) => {
        const list = prev.synths[trackId].slice();
        list[idx] = { ...list[idx], ...patch };
        return { ...prev, synths: { ...prev.synths, [trackId]: list } };
      });
    },
    [],
  );

  const setSynthActive = useCallback(
    (trackId: SynthTrackId, idx: number, active: boolean) => {
      setPattern((prev) => {
        if (prev.synths[trackId][idx].active === active) return prev;
        const list = prev.synths[trackId].slice();
        list[idx] = { ...list[idx], active };
        return { ...prev, synths: { ...prev.synths, [trackId]: list } };
      });
    },
    [],
  );

  // ── Components action (kind-agnostic) ───────────────────────────────

  const updateStepComponents = useCallback(
    (sel: Selection, patch: Partial<StepComponents>) => {
      setPattern((prev) => {
        if (sel.kind === 'drum') {
          const list = prev.drums[sel.trackId].slice();
          list[sel.stepIndex] = {
            ...list[sel.stepIndex],
            components: { ...list[sel.stepIndex].components, ...patch },
          };
          return { ...prev, drums: { ...prev.drums, [sel.trackId]: list } };
        }
        const list = prev.synths[sel.trackId].slice();
        list[sel.stepIndex] = {
          ...list[sel.stepIndex],
          components: { ...list[sel.stepIndex].components, ...patch },
        };
        return { ...prev, synths: { ...prev.synths, [sel.trackId]: list } };
      });
    },
    [],
  );

  const clearPattern = useCallback(() => {
    setPattern((prev) => ({
      // Wipe drum activations but keep velocity / components so plocks survive.
      drums: DRUM_TRACKS.reduce(
        (acc, t) => {
          acc[t.id] = prev.drums[t.id].map((s) => ({ ...s, active: false }));
          return acc;
        },
        {} as Pattern['drums'],
      ),
      // Same idea for synths — preserve note / components, drop activations.
      synths: SYNTH_TRACKS.reduce(
        (acc, t) => {
          acc[t.id] = prev.synths[t.id].map((s) => ({ ...s, active: false }));
          return acc;
        },
        {} as Pattern['synths'],
      ),
    }));
  }, []);

  /** Reset all components on a step to their defaults. */
  const resetStepComponents = useCallback((sel: Selection) => {
    setPattern((prev) => {
      if (sel.kind === 'drum') {
        const list = prev.drums[sel.trackId].slice();
        list[sel.stepIndex] = {
          ...list[sel.stepIndex],
          components: createStepComponents(),
        };
        return { ...prev, drums: { ...prev.drums, [sel.trackId]: list } };
      }
      const list = prev.synths[sel.trackId].slice();
      list[sel.stepIndex] = {
        ...list[sel.stepIndex],
        components: createStepComponents(),
      };
      return { ...prev, synths: { ...prev.synths, [sel.trackId]: list } };
    });
  }, []);

  /** Wholesale replace — used by Timeline Load. */
  const replacePattern = useCallback((next: Pattern) => {
    setPattern(next);
  }, []);

  return {
    pattern,
    toggleDrumStep,
    updateDrumStep,
    toggleSynthStep,
    updateSynthStep,
    setSynthActive,
    updateStepComponents,
    resetStepComponents,
    clearPattern,
    replacePattern,
  };
};

