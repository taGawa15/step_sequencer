import type { TrackId } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Performance state — everything users tweak live.
// ──────────────────────────────────────────────────────────────────────────

export type DelayTime = '16n' | '8n' | '8n.' | '4n' | '4n.';

export interface DelayState {
  enabled: boolean;
  wet: number; // 0..1
  feedback: number; // 0..0.85 (capped)
  time: DelayTime;
}

export interface ReverbState {
  enabled: boolean;
  wet: number; // 0..1
  decay: number; // seconds, 0.4..10
}

export interface CompressorState {
  enabled: boolean;
  threshold: number; // -60..0 dB
  ratio: number; // 1..20
}

export interface KillState {
  low: boolean;
  mid: boolean;
  high: boolean;
}

export interface TrackSend {
  delay: number; // 0..1
  reverb: number; // 0..1
}
export type TrackSends = Record<TrackId, TrackSend>;

export interface PerformanceState {
  masterVolume: number; // -60..0 dB
  filterSweep: number; // -100..100
  filterResonance: number; // 0.1..10
  delay: DelayState;
  reverb: ReverbState;
  compressor: CompressorState;
  kill: KillState;
  trackSends: TrackSends;
}

// ──────────────────────────────────────────────────────────────────────────
// Snapshot scenes
// ──────────────────────────────────────────────────────────────────────────

export type SnapshotSlot = 'A' | 'B' | 'C' | 'D';

export interface Snapshot {
  empty: boolean;
  state: PerformanceState;
}

export type SnapshotMap = Record<SnapshotSlot, Snapshot>;

// ──────────────────────────────────────────────────────────────────────────
// Param descriptor (for MIDI mapping in MVP4 and validation)
// ──────────────────────────────────────────────────────────────────────────

export interface NumberParamDescriptor {
  id: string;
  label: string;
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface BooleanParamDescriptor {
  id: string;
  label: string;
  type: 'boolean';
}

export interface EnumParamDescriptor {
  id: string;
  label: string;
  type: 'enum';
  values: readonly string[];
}

export type ParamDescriptor =
  | NumberParamDescriptor
  | BooleanParamDescriptor
  | EnumParamDescriptor;

export type ParamValue = number | boolean | string;
