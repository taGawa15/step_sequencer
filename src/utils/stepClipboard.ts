import {
  DRUM_TRACKS,
  MAX_STEP_COUNT,
  SYNTH_TRACKS,
  createDrumStep,
  createSynthStep,
} from '../constants';
import type {
  DrumStep,
  DrumTrackId,
  Pattern,
  SynthStep,
  SynthTrackId,
  TrackId,
} from '../types';

export type CopyScope = 'all' | 'selectedTrack';

export type PasteMode = 'replace' | 'merge' | 'append' | 'repeatFill';

/**
 * Deep-copied snapshot of a step range, decoupled from the live pattern.
 * Tracks omitted from `tracks` are simply not pasted (used to limit a
 * paste to the selected track only).
 */
export interface StepClipboard {
  type: 'steps';
  copiedAt: string;
  /** Number of steps captured (the slice length). */
  length: number;
  /** Step index in the source pattern where the slice starts. */
  startStep: number;
  /** Loop length of the source at copy time (helpful for Append). */
  sourceLoopLength: number;
  scope: CopyScope;
  /** Track that was selected when scope = 'selectedTrack'; null otherwise. */
  selectedTrackId: TrackId | null;
  drums: Partial<Record<DrumTrackId, DrumStep[]>>;
  synths: Partial<Record<SynthTrackId, SynthStep[]>>;
}

const cloneStep = <T,>(s: T): T => JSON.parse(JSON.stringify(s)) as T;

const sliceTrackArray = <T,>(
  arr: readonly T[],
  start: number,
  length: number,
): T[] => {
  const out: T[] = [];
  for (let i = 0; i < length; i++) out.push(cloneStep(arr[start + i]));
  return out;
};

// ──────────────────────────────────────────────────────────────────────────
// Copy
// ──────────────────────────────────────────────────────────────────────────

interface CopyArgs {
  pattern: Pattern;
  startStep: number;
  length: number;
  loopLength: number;
  scope: CopyScope;
  /** Required when scope === 'selectedTrack'. */
  selectedTrackId: TrackId | null;
}

export const copySteps = ({
  pattern,
  startStep,
  length,
  loopLength,
  scope,
  selectedTrackId,
}: CopyArgs): StepClipboard => {
  const safeStart = Math.max(0, Math.min(MAX_STEP_COUNT - 1, startStep));
  const safeLen = Math.max(1, Math.min(MAX_STEP_COUNT - safeStart, length));

  const drums: StepClipboard['drums'] = {};
  const synths: StepClipboard['synths'] = {};

  const trackInScope = (trackId: TrackId): boolean => {
    if (scope === 'all') return true;
    return trackId === selectedTrackId;
  };

  for (const t of DRUM_TRACKS) {
    if (!trackInScope(t.id)) continue;
    drums[t.id] = sliceTrackArray(pattern.drums[t.id], safeStart, safeLen);
  }
  for (const t of SYNTH_TRACKS) {
    if (!trackInScope(t.id)) continue;
    synths[t.id] = sliceTrackArray(pattern.synths[t.id], safeStart, safeLen);
  }

  return {
    type: 'steps',
    copiedAt: new Date().toISOString(),
    length: safeLen,
    startStep: safeStart,
    sourceLoopLength: loopLength,
    scope,
    selectedTrackId: scope === 'selectedTrack' ? selectedTrackId : null,
    drums,
    synths,
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Paste
// ──────────────────────────────────────────────────────────────────────────

interface PasteArgs {
  pattern: Pattern;
  clip: StepClipboard;
  /** Step index where the paste begins. Ignored for `repeatFill`. */
  destStart: number;
  mode: PasteMode;
  /** Current engine loop length, used by repeatFill / append. */
  loopLength: number;
}

export interface PasteResult {
  pattern: Pattern;
  /** The new loop length, in case Append extended it. */
  loopLength: number;
}

const writeStepInto = <T extends { active: boolean }>(
  arr: T[],
  index: number,
  step: T,
  mode: PasteMode,
) => {
  if (index < 0 || index >= MAX_STEP_COUNT) return;
  if (mode === 'merge') {
    if (step.active) arr[index] = cloneStep(step);
    return;
  }
  arr[index] = cloneStep(step);
};

export const applySteps = ({
  pattern,
  clip,
  destStart,
  mode,
  loopLength,
}: PasteArgs): PasteResult => {
  // Always start from a deep clone so callers can keep the previous pattern
  // for undo without sharing references.
  const next: Pattern = JSON.parse(JSON.stringify(pattern)) as Pattern;
  let nextLoopLength = loopLength;

  // ── Resolve the dest indices we'll write to ────────────────────────
  const indices: number[] = [];

  if (mode === 'append') {
    // Append after the current loop. If that overflows MAX_STEP_COUNT we
    // truncate; if it overflows the current loopLength we extend.
    const start = loopLength;
    const len = Math.min(clip.length, MAX_STEP_COUNT - start);
    if (len <= 0) {
      return { pattern: next, loopLength: nextLoopLength };
    }
    for (let i = 0; i < len; i++) indices.push(start + i);
    // Snap to a valid loopLength bucket — at minimum cover what we wrote.
    const required = start + len;
    nextLoopLength = ([1, 2, 4, 8, 16, 32, 64].find(
      (v) => v >= required,
    ) ?? 64) as number;
  } else if (mode === 'repeatFill') {
    // Tile clip across [0, loopLength), repeating clip.length per tile.
    for (let i = 0; i < loopLength; i++) indices.push(i);
  } else {
    // Replace / Merge: write clip.length steps starting at destStart.
    for (let i = 0; i < clip.length; i++) {
      const idx = destStart + i;
      if (idx >= MAX_STEP_COUNT) break;
      indices.push(idx);
    }
  }

  // ── Helper to read a clip step for a given dest position ──────────
  const sourceIndex = (destOffset: number): number => {
    if (mode === 'repeatFill') return destOffset % clip.length;
    return destOffset; // replace / merge / append are 1-to-1
  };

  // ── Apply per track ────────────────────────────────────────────────
  for (const t of DRUM_TRACKS) {
    const clipSteps = clip.drums[t.id];
    if (!clipSteps) continue;
    for (let i = 0; i < indices.length; i++) {
      const destIdx = indices[i];
      const srcIdx = sourceIndex(i);
      const step = clipSteps[srcIdx];
      if (!step) continue;
      writeStepInto(next.drums[t.id], destIdx, step, mode);
    }
  }
  for (const t of SYNTH_TRACKS) {
    const clipSteps = clip.synths[t.id];
    if (!clipSteps) continue;
    for (let i = 0; i < indices.length; i++) {
      const destIdx = indices[i];
      const srcIdx = sourceIndex(i);
      const step = clipSteps[srcIdx];
      if (!step) continue;
      writeStepInto(next.synths[t.id], destIdx, step, mode);
    }
  }

  return { pattern: next, loopLength: nextLoopLength };
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers used by UI for paste-target dropdown
// ──────────────────────────────────────────────────────────────────────────

/** Return the standard 8 paste-start positions (1, 9, 17, …, 57). */
export const PASTE_TARGETS = [0, 8, 16, 24, 32, 40, 48, 56] as const;

/** Detect whether a clip is empty (no track has any steps). */
export const isClipEmpty = (clip: StepClipboard | null): boolean => {
  if (!clip) return true;
  return (
    Object.values(clip.drums).every((arr) => !arr || arr.length === 0) &&
    Object.values(clip.synths).every((arr) => !arr || arr.length === 0)
  );
};

/** Touch the unused createDrumStep / createSynthStep import for type safety. */
export const _typeAnchor = (): [DrumStep, SynthStep] => [
  createDrumStep(),
  createSynthStep(SYNTH_TRACKS[0]),
];
