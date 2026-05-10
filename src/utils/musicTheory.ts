/**
 * Tiny music theory helpers used by the BASS / LEAD note editor —
 * scale membership tests, root rotation, and pitch-class names.
 */

export type ScaleId = 'major' | 'minor' | 'pentatonic' | 'chromatic';

export const SCALE_DEFS: Record<ScaleId, { label: string; pcs: readonly number[] }> = {
  major:      { label: 'Major',      pcs: [0, 2, 4, 5, 7, 9, 11] },
  minor:      { label: 'Minor',      pcs: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { label: 'Pentatonic', pcs: [0, 2, 4, 7, 9] },
  chromatic:  { label: 'Chromatic',  pcs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

export const ROOTS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;
export type RootId = (typeof ROOTS)[number];

export const NOTE_NAMES_SHARPS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

/** Indices in a 12-tone octave that correspond to black keys. */
export const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

const ROOT_TO_PC: Record<RootId, number> = ROOTS.reduce(
  (acc, name, i) => {
    acc[name] = i;
    return acc;
  },
  {} as Record<RootId, number>,
);

export const rootToPitchClass = (root: RootId): number => ROOT_TO_PC[root];

/** Returns the absolute pitch classes belonging to a scale rooted at `root`. */
export const scalePitchClasses = (root: RootId, scale: ScaleId): Set<number> => {
  const offset = rootToPitchClass(root);
  const set = new Set<number>();
  for (const pc of SCALE_DEFS[scale].pcs) set.add((pc + offset) % 12);
  return set;
};

export const isInScale = (
  pitchClass: number,
  root: RootId,
  scale: ScaleId,
): boolean => scalePitchClasses(root, scale).has(((pitchClass % 12) + 12) % 12);

/**
 * Build a "C2", "D#3" string from pitch class + octave.
 */
export const buildNote = (pc: number, octave: number): string => {
  const name = NOTE_NAMES_SHARPS[((pc % 12) + 12) % 12];
  return `${name}${octave}`;
};

/** Inverse of buildNote: "C#3" → { pc: 1, octave: 3 } */
export const splitNote = (note: string): { pc: number; octave: number } => {
  const m = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!m) return { pc: 0, octave: 4 };
  const name = m[1];
  const octave = Number.parseInt(m[2], 10);
  let pc = NOTE_NAMES_SHARPS.indexOf(name as (typeof NOTE_NAMES_SHARPS)[number]);
  if (pc === -1) {
    // very rough flat normalization
    const flatToSharp: Record<string, string> = {
      Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
    };
    const sharp = flatToSharp[name] ?? 'C';
    pc = NOTE_NAMES_SHARPS.indexOf(sharp as (typeof NOTE_NAMES_SHARPS)[number]);
    if (pc === -1) pc = 0;
  }
  return { pc, octave };
};

/** Move a note up/down by `semis` semitones, preserving octave wrap. */
export const transposeNote = (note: string, semis: number): string => {
  const { pc, octave } = splitNote(note);
  const total = pc + octave * 12 + semis;
  const newPc = ((total % 12) + 12) % 12;
  const newOct = Math.floor(total / 12);
  return buildNote(newPc, newOct);
};
