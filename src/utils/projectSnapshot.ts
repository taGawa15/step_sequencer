import {
  DEFAULT_BPM,
  DEFAULT_LOOP_LENGTH,
  LOOP_LENGTHS,
  MAX_BPM,
  MIN_BPM,
  TRACKS,
  clamp,
  createEmptyMutes,
  type LoopLengthType,
} from '../constants';
import type { MuteMap } from '../types';
import type { ProjectSnapshot, TimelineSlot } from '../types/timeline';
import { normalizeKindSplitPattern } from '../hooks/usePersistedPattern';
import {
  normalizePerformance,
  normalizeSnapshots,
} from '../hooks/usePerformanceControls';
import { clampSwing } from './swing';

/**
 * Timeline snapshot validation / normalization.
 *
 * Policy ("可能な範囲で正規化、復元不可は拒否"):
 *  - the snapshot must be an object and its `pattern` must be recognizable
 *    by normalizeKindSplitPattern — otherwise we REJECT (return null),
 *    because a missing pattern is the white-screen vector;
 *  - every other field (bpm, swing, loopLength, mutes, performance,
 *    snapshots) is individually normalized with safe defaults, so old or
 *    partially-corrupted saves still load.
 */

const normalizeMutes = (raw: unknown): MuteMap => {
  const mutes = createEmptyMutes();
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const t of TRACKS) {
      if (typeof obj[t.id] === 'boolean') mutes[t.id] = obj[t.id] as boolean;
    }
  }
  return mutes;
};

const normalizeLoopLength = (raw: unknown): LoopLengthType =>
  (LOOP_LENGTHS as readonly number[]).includes(raw as number)
    ? (raw as LoopLengthType)
    : DEFAULT_LOOP_LENGTH;

const normalizeBpm = (raw: unknown): number =>
  typeof raw === 'number' && Number.isFinite(raw)
    ? clamp(Math.round(raw), MIN_BPM, MAX_BPM)
    : DEFAULT_BPM;

/**
 * Returns a fully-normalized ProjectSnapshot, or null when the data is
 * beyond repair (not an object / pattern unrecognizable).
 */
export const normalizeProjectSnapshot = (raw: unknown): ProjectSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Record<keyof ProjectSnapshot, unknown>>;

  const pattern = normalizeKindSplitPattern(r.pattern);
  if (!pattern) return null;

  return {
    bpm: normalizeBpm(r.bpm),
    swing: clampSwing(r.swing),
    loopLength: normalizeLoopLength(r.loopLength),
    pattern,
    mutes: normalizeMutes(r.mutes),
    performance: normalizePerformance(r.performance),
    snapshots: normalizeSnapshots(r.snapshots),
  };
};

/**
 * Validate one stored timeline slot. Returns a slot whose `data` has been
 * normalized, or null when the slot (or its snapshot) is unusable.
 */
export const normalizeTimelineSlot = (raw: unknown): TimelineSlot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const slot = raw as Partial<TimelineSlot>;
  const data = normalizeProjectSnapshot(slot.data);
  if (!data) return null;
  return {
    name: typeof slot.name === 'string' ? slot.name : 'Timeline',
    savedAt:
      typeof slot.savedAt === 'string' ? slot.savedAt : new Date(0).toISOString(),
    data,
  };
};
