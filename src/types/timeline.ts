import type { LoopLengthType } from '../constants';
import type { MuteMap, Pattern } from '../types';
import type { PerformanceState, SnapshotMap } from './audio';

/**
 * One full snapshot of the project's playable state. Captured by Save and
 * applied by Load. We deliberately exclude UI-only state (selection, tab)
 * so loading a slot doesn't move the user's caret around mid-performance.
 */
export interface ProjectSnapshot {
  bpm: number;
  loopLength: LoopLengthType;
  pattern: Pattern;
  mutes: MuteMap;
  performance: PerformanceState;
  snapshots: SnapshotMap;
}

export type TimelineSlotId = '1' | '2' | '3' | '4';
export const TIMELINE_SLOT_IDS: readonly TimelineSlotId[] = ['1', '2', '3', '4'];

export interface TimelineSlot {
  name: string;
  savedAt: string;
  data: ProjectSnapshot;
}

export interface TimelineState {
  timelines: Record<TimelineSlotId, TimelineSlot | null>;
  activeTimelineId: TimelineSlotId;
  /** When false, Load skips the "discard unsaved changes?" confirm. */
  confirmLoadGuard: boolean;
}
