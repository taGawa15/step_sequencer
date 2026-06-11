import type { DrumTrackId, NoteDuration, SynthTrackId } from '../types';
import type { LastFiredMap } from '../hooks/useSequencerEngine';

/**
 * The slice Beat Repeat plays while engaged: captured ONCE at engage time
 * from the tracks' most recent audible hits, then re-fired every tick.
 *
 * Capturing once (instead of re-reading lastFired per tick) is what makes
 * a long hold stable: while engaged the sequencer's own triggers are
 * suppressed, so lastFired would stop updating and a per-tick recency
 * window would run dry mid-hold — and before suppression existed, the
 * sequencer kept playing UNDER the repeat, colliding with 1/32 ticks a
 * millisecond apart on the same mono voices (the "1/32 long-press
 * breaks" zipper/flam wall).
 */
export interface BeatRepeatSnapshot {
  drums: Array<{ trackId: DrumTrackId; velocity: number }>;
  synths: Array<{
    trackId: SynthTrackId;
    note: string;
    duration: NoteDuration | number;
    velocity: number;
  }>;
}

export const EMPTY_BEAT_SNAPSHOT: BeatRepeatSnapshot = { drums: [], synths: [] };

/**
 * Filter lastFired down to hits within `windowSec` of `nowSec`. Hits
 * scheduled slightly in the future (lookahead) count as "now".
 */
export const captureRecentHits = (
  fired: LastFiredMap,
  nowSec: number,
  windowSec: number,
): BeatRepeatSnapshot => {
  const snapshot: BeatRepeatSnapshot = { drums: [], synths: [] };
  for (const [trackId, hit] of Object.entries(fired.drums)) {
    if (!hit) continue;
    if (nowSec - hit.at <= windowSec) {
      snapshot.drums.push({
        trackId: trackId as DrumTrackId,
        velocity: hit.velocity,
      });
    }
  }
  for (const [trackId, hit] of Object.entries(fired.synths)) {
    if (!hit) continue;
    if (nowSec - hit.at <= windowSec) {
      snapshot.synths.push({
        trackId: trackId as SynthTrackId,
        note: hit.note,
        duration: hit.duration,
        velocity: hit.velocity,
      });
    }
  }
  return snapshot;
};
