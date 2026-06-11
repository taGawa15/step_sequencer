import type { DrumTrackId } from '../types';
import { DRUM_TRACKS } from '../constants';

export interface SampleMetadata {
  id: string;
  name: string;
  createdAt: string;
  durationSec: number;
  /** Object URL for in-session playback (regenerated from IndexedDB on load). */
  url: string;
  /** Track this sample is assigned to (replaces that track's drum voice). */
  assignedTo: DrumTrackId | null;
  gain: number; // 0..1
  pitch: number; // semitones
  /** Trim window start within the recording, in seconds. */
  trimStart: number;
  /** Trim window end in seconds; null = play to the end. */
  trimEnd: number | null;
}

/** Minimum playable trim window, seconds. */
export const MIN_TRIM_GAP = 0.05;

export interface TrimWindow {
  trimStart: number;
  trimEnd: number | null;
}

/**
 * Clamp an arbitrary (possibly user-typed or stale-storage) trim pair into
 * a valid window inside [0, durationSec]. Guarantees trimStart < trimEnd
 * (when trimEnd is non-null) with at least MIN_TRIM_GAP between them.
 */
export const normalizeTrim = (
  rawStart: unknown,
  rawEnd: unknown,
  durationSec: number,
): TrimWindow => {
  const dur =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : 0;
  let start = typeof rawStart === 'number' && Number.isFinite(rawStart) ? rawStart : 0;
  start = Math.min(Math.max(0, start), Math.max(0, dur - MIN_TRIM_GAP));

  let end: number | null =
    typeof rawEnd === 'number' && Number.isFinite(rawEnd) ? rawEnd : null;
  if (end !== null) {
    end = Math.min(end, dur);
    if (end >= dur) end = null; // full tail → store as "to the end"
    else if (end < start + MIN_TRIM_GAP) end = Math.min(dur, start + MIN_TRIM_GAP);
  }
  return { trimStart: start, trimEnd: end };
};

const VALID_DRUM_IDS = new Set<string>(DRUM_TRACKS.map((t) => t.id));

/**
 * Normalize one persisted metadata entry (url is re-created from
 * IndexedDB by the caller and therefore not part of this). Returns null
 * when the entry has no usable id.
 */
export const normalizeSampleMeta = (
  raw: unknown,
): Omit<SampleMetadata, 'url'> | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SampleMetadata>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  const durationSec =
    typeof r.durationSec === 'number' && Number.isFinite(r.durationSec) && r.durationSec > 0
      ? r.durationSec
      : 0;
  const trim = normalizeTrim(r.trimStart, r.trimEnd ?? null, durationSec);
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Sample',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
    durationSec,
    assignedTo:
      typeof r.assignedTo === 'string' && VALID_DRUM_IDS.has(r.assignedTo)
        ? (r.assignedTo as DrumTrackId)
        : null,
    gain:
      typeof r.gain === 'number' && Number.isFinite(r.gain)
        ? Math.min(1, Math.max(0, r.gain))
        : 0.8,
    pitch:
      typeof r.pitch === 'number' && Number.isFinite(r.pitch)
        ? Math.min(12, Math.max(-12, Math.round(r.pitch)))
        : 0,
    ...trim,
  };
};
