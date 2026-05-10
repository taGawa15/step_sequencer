// Scale definitions live in their own file so future MVPs can add more
// (minor, dorian, …) without touching audio or UI code.

export type ScaleId = 'cMajor';

export interface ScaleDef {
  id: ScaleId;
  label: string;
  /** Pitch classes within an octave (0 = C, 1 = C#, …, 11 = B) */
  pitchClasses: readonly number[];
  /** Display names aligned 1:1 with pitchClasses */
  noteNames: readonly string[];
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  cMajor: {
    id: 'cMajor',
    label: 'C MAJOR',
    pitchClasses: [0, 2, 4, 5, 7, 9, 11],
    noteNames: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  },
};

export const DEFAULT_SCALE_ID: ScaleId = 'cMajor';

export const getScale = (id: ScaleId = DEFAULT_SCALE_ID): ScaleDef => SCALES[id];

/** Octaves available for a track (inclusive on both ends). */
export const octavesInRange = (range: readonly [number, number]): number[] => {
  const [lo, hi] = range;
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
};

/** "C2" → { name: "C", octave: 2 }. Falls back to C4 on malformed input. */
export const parseNote = (note: string): { name: string; octave: number } => {
  const m = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!m) return { name: 'C', octave: 4 };
  return { name: m[1], octave: Number.parseInt(m[2], 10) };
};

/** Build a note string ("D" + 3 → "D3"). */
export const formatNote = (name: string, octave: number): string => `${name}${octave}`;

/**
 * Snap a note to the nearest valid pitch in a scale (preserving octave).
 * If the note name is already in scale, returned unchanged. Otherwise the
 * scale's first note in that octave is returned.
 */
export const snapToScale = (note: string, scale: ScaleDef): string => {
  const { name, octave } = parseNote(note);
  if (scale.noteNames.includes(name)) return formatNote(name, octave);
  return formatNote(scale.noteNames[0], octave);
};
