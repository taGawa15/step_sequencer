// ──────────────────────────────────────────────────────────────────────────
// Track identity
// ──────────────────────────────────────────────────────────────────────────

export type DrumTrackId =
  | 'kick'
  | 'snare'
  | 'closedHat'
  | 'openHat'
  | 'clap'
  | 'perc';

export type SynthTrackId = 'bass' | 'lead';

export type TrackId = DrumTrackId | SynthTrackId;

export type TrackKind = 'drum' | 'synth';

// ──────────────────────────────────────────────────────────────────────────
// Step components (per-step modulators)
// ──────────────────────────────────────────────────────────────────────────

export type RepeatCount = 1 | 2 | 3 | 4;
export type NoteDuration = '16n' | '8n' | '4n';

export interface StepComponents {
  /** Probability of firing this step. 0..100 (%) */
  probability: number;
  /** Number of retriggers within one step. 1 = no retrig. */
  repeat: RepeatCount;
  /** Timing offset in milliseconds. -50..50. */
  microTiming: number;
  /** Parameter lock: filter cutoff (Hz). null = no plock. */
  filterCutoff: number | null;
  /** Parameter lock: pan -1..1. null = no plock. */
  pan: number | null;
  /** Parameter lock: pitch offset in semitones. null = no plock. */
  pitchOffset: number | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Step shapes
// ──────────────────────────────────────────────────────────────────────────

export interface DrumStep {
  active: boolean;
  velocity: number; // 0..1
  components: StepComponents;
}

export interface SynthStep {
  active: boolean;
  note: string; // e.g. "C2"
  duration: NoteDuration;
  velocity: number; // 0..1
  components: StepComponents;
}

export type Step = DrumStep | SynthStep;

// ──────────────────────────────────────────────────────────────────────────
// Track definitions (discriminated by kind)
// ──────────────────────────────────────────────────────────────────────────

interface BaseTrackDef {
  label: string;
  /** Short 3-char label for narrow viewports (mobile / tight columns). */
  shortLabel: string;
}

export interface DrumTrackDef extends BaseTrackDef {
  id: DrumTrackId;
  kind: 'drum';
}

export interface SynthTrackDef extends BaseTrackDef {
  id: SynthTrackId;
  kind: 'synth';
  defaultNote: string;
  defaultDuration: NoteDuration;
  /** Inclusive octave range, e.g. [1, 3] → C1..B3 */
  octaveRange: readonly [number, number];
}

export type TrackDef = DrumTrackDef | SynthTrackDef;

// ──────────────────────────────────────────────────────────────────────────
// Pattern (two-layered by kind)
// ──────────────────────────────────────────────────────────────────────────

export type DrumPattern = Record<DrumTrackId, DrumStep[]>;
export type SynthPattern = Record<SynthTrackId, SynthStep[]>;

export interface Pattern {
  drums: DrumPattern;
  synths: SynthPattern;
}

export type MuteMap = Record<TrackId, boolean>;

// ──────────────────────────────────────────────────────────────────────────
// UI selection (unified for drum + synth)
// ──────────────────────────────────────────────────────────────────────────

export type Selection =
  | { kind: 'drum'; trackId: DrumTrackId; stepIndex: number }
  | { kind: 'synth'; trackId: SynthTrackId; stepIndex: number };

// Resolved selection bundles the live step + track metadata so the editor
// doesn't have to look them up itself.
export type ResolvedSelection =
  | {
      kind: 'drum';
      trackId: DrumTrackId;
      stepIndex: number;
      step: DrumStep;
      track: DrumTrackDef;
    }
  | {
      kind: 'synth';
      trackId: SynthTrackId;
      stepIndex: number;
      step: SynthStep;
      track: SynthTrackDef;
    };
