import type { DrumTrackId } from '../types';

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
  oneShot: boolean;
}

export type SampleAssignmentMap = Partial<Record<DrumTrackId, string>>;
