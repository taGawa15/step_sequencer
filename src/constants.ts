import type {
  DrumPattern,
  DrumStep,
  DrumTrackDef,
  DrumTrackId,
  MuteMap,
  NoteDuration,
  Pattern,
  RepeatCount,
  StepComponents,
  SynthPattern,
  SynthStep,
  SynthTrackDef,
  SynthTrackId,
  TrackDef,
  TrackId,
} from './types';

// ──────────────────────────────────────────────────────────────────────────
// Sequencer config
// ──────────────────────────────────────────────────────────────────────────

export const STEP_COUNT = 16;
export const DEFAULT_BPM = 120;
export const MIN_BPM = 40;
export const MAX_BPM = 240;

export const NOTE_DURATIONS: readonly NoteDuration[] = ['16n', '8n', '4n'];
export const DEFAULT_VELOCITY = 0.8;

// ──────────────────────────────────────────────────────────────────────────
// Step component ranges & defaults
// ──────────────────────────────────────────────────────────────────────────

export const REPEAT_OPTIONS: readonly RepeatCount[] = [1, 2, 3, 4];

export const PROBABILITY_DEFAULT = 100;
export const PROBABILITY_MIN = 0;
export const PROBABILITY_MAX = 100;

export const REPEAT_DEFAULT: RepeatCount = 1;

export const MICRO_TIMING_DEFAULT = 0;
export const MICRO_TIMING_MIN = -50;
export const MICRO_TIMING_MAX = 50;

export const VELOCITY_MIN = 0.1;
export const VELOCITY_MAX = 1;

export const FILTER_CUTOFF_MIN = 80;
export const FILTER_CUTOFF_MAX = 12000;
/** Default value used when a user first engages the filter plock. */
export const FILTER_CUTOFF_DEFAULT_ENGAGED = 2000;
/** Effectively "open" cutoff used when no plock is set. */
export const FILTER_CUTOFF_OPEN = 20000;

export const PAN_MIN = -1;
export const PAN_MAX = 1;
export const PAN_DEFAULT_ENGAGED = 0;

export const PITCH_OFFSET_MIN = -12;
export const PITCH_OFFSET_MAX = 12;
export const PITCH_OFFSET_DEFAULT_ENGAGED = 0;

// ──────────────────────────────────────────────────────────────────────────
// Track definitions
// ──────────────────────────────────────────────────────────────────────────

export const DRUM_TRACKS: readonly DrumTrackDef[] = [
  { id: 'kick', label: 'KICK', shortLabel: 'KIK', kind: 'drum' },
  { id: 'snare', label: 'SNARE', shortLabel: 'SNR', kind: 'drum' },
  { id: 'closedHat', label: 'CH', shortLabel: 'CH', kind: 'drum' },
  { id: 'openHat', label: 'OH', shortLabel: 'OH', kind: 'drum' },
  { id: 'clap', label: 'CLAP', shortLabel: 'CLP', kind: 'drum' },
  { id: 'perc', label: 'PERC', shortLabel: 'PRC', kind: 'drum' },
];

export const SYNTH_TRACKS: readonly SynthTrackDef[] = [
  {
    id: 'bass',
    label: 'BASS',
    shortLabel: 'BAS',
    kind: 'synth',
    defaultNote: 'C2',
    defaultDuration: '16n',
    octaveRange: [1, 3],
  },
  {
    id: 'lead',
    label: 'LEAD',
    shortLabel: 'LED',
    kind: 'synth',
    defaultNote: 'C4',
    defaultDuration: '16n',
    octaveRange: [3, 5],
  },
];

export const TRACKS: readonly TrackDef[] = [...DRUM_TRACKS, ...SYNTH_TRACKS];
export const TRACK_IDS: readonly TrackId[] = TRACKS.map((t) => t.id);

export const findDrumTrack = (id: DrumTrackId): DrumTrackDef =>
  DRUM_TRACKS.find((t) => t.id === id) ?? DRUM_TRACKS[0];

export const findSynthTrack = (id: SynthTrackId): SynthTrackDef =>
  SYNTH_TRACKS.find((t) => t.id === id) ?? SYNTH_TRACKS[0];

// ──────────────────────────────────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────────────────────────────────

export const STORAGE_KEY_V3 = 'step-sequencer:pattern:v3';
export const STORAGE_KEY_V2 = 'step-sequencer:pattern:v2';
export const STORAGE_KEY_V1 = 'step-sequencer:pattern:v1';

export const STORAGE_KEY_PERFORMANCE = 'step-sequencer:performance:v1';
export const STORAGE_KEY_SNAPSHOTS = 'step-sequencer:snapshots:v1';

// ──────────────────────────────────────────────────────────────────────────
// Performance / master FX caps (audio safety)
// ──────────────────────────────────────────────────────────────────────────

export const MASTER_VOLUME_MIN = -60;
export const MASTER_VOLUME_MAX = 0;

export const FILTER_SWEEP_MIN = -100;
export const FILTER_SWEEP_MAX = 100;

export const FILTER_RESONANCE_MIN = 0.1;
export const FILTER_RESONANCE_MAX = 10;

export const DELAY_FEEDBACK_MAX = 0.85;
export const DELAY_TIMES = ['16n', '8n', '8n.', '4n', '4n.'] as const;

export const REVERB_DECAY_MIN = 0.4;
export const REVERB_DECAY_MAX = 10;

export const COMPRESSOR_THRESHOLD_MIN = -60;
export const COMPRESSOR_THRESHOLD_MAX = 0;
export const COMPRESSOR_RATIO_MIN = 1;
export const COMPRESSOR_RATIO_MAX = 20;

export const TRACK_SEND_MIN = 0;
export const TRACK_SEND_MAX = 1;

export const SNAPSHOT_SLOTS = ['A', 'B', 'C', 'D'] as const;
export const MORPH_TIME_MIN = 0;
export const MORPH_TIME_MAX = 4;
export const MORPH_TIME_DEFAULT = 1;

// UI state persistence
export const STORAGE_KEY_UI = 'step-sequencer:ui:v1';

// ──────────────────────────────────────────────────────────────────────────
// Factories
// ──────────────────────────────────────────────────────────────────────────

const blankSteps = <T,>(make: () => T): T[] =>
  Array.from({ length: STEP_COUNT }, make);

export const createStepComponents = (): StepComponents => ({
  probability: PROBABILITY_DEFAULT,
  repeat: REPEAT_DEFAULT,
  microTiming: MICRO_TIMING_DEFAULT,
  filterCutoff: null,
  pan: null,
  pitchOffset: null,
});

export const createDrumStep = (): DrumStep => ({
  active: false,
  velocity: DEFAULT_VELOCITY,
  components: createStepComponents(),
});

export const createSynthStep = (track: SynthTrackDef): SynthStep => ({
  active: false,
  note: track.defaultNote,
  duration: track.defaultDuration,
  velocity: DEFAULT_VELOCITY,
  components: createStepComponents(),
});

export const createDrumPattern = (): DrumPattern =>
  DRUM_TRACKS.reduce((acc, t) => {
    acc[t.id] = blankSteps(createDrumStep);
    return acc;
  }, {} as DrumPattern);

export const createSynthPattern = (): SynthPattern =>
  SYNTH_TRACKS.reduce((acc, t) => {
    acc[t.id] = blankSteps(() => createSynthStep(t));
    return acc;
  }, {} as SynthPattern);

export const createEmptyPattern = (): Pattern => ({
  drums: createDrumPattern(),
  synths: createSynthPattern(),
});

export const createEmptyMutes = (): MuteMap =>
  TRACKS.reduce((acc, t) => {
    acc[t.id] = false;
    return acc;
  }, {} as MuteMap);

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

export const hasComponentModifications = (c: StepComponents): boolean =>
  c.probability !== PROBABILITY_DEFAULT ||
  c.repeat !== REPEAT_DEFAULT ||
  c.microTiming !== MICRO_TIMING_DEFAULT ||
  c.filterCutoff !== null ||
  c.pan !== null ||
  c.pitchOffset !== null;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export type { DrumTrackId, SynthTrackId };
