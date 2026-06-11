import { describe, expect, it } from 'vitest';
import { captureRecentHits, EMPTY_BEAT_SNAPSHOT } from './beatRepeat';
import type { LastFiredMap } from '../hooks/useSequencerEngine';

describe('captureRecentHits (Beat Repeat slice)', () => {
  const fired: LastFiredMap = {
    drums: {
      kick: { velocity: 0.9, at: 10.0 },
      snare: { velocity: 0.7, at: 8.0 }, // stale
    },
    synths: {
      bass: { note: 'C2', duration: '16n', velocity: 0.8, at: 9.9 },
    },
  };

  it('keeps hits inside the window, drops stale ones', () => {
    const snap = captureRecentHits(fired, 10.2, 1.0);
    expect(snap.drums).toEqual([{ trackId: 'kick', velocity: 0.9 }]);
    expect(snap.synths).toEqual([
      { trackId: 'bass', note: 'C2', duration: '16n', velocity: 0.8 },
    ]);
  });

  it('hits scheduled slightly in the future (lookahead) count as now', () => {
    const snap = captureRecentHits(
      { drums: { kick: { velocity: 1, at: 10.1 } }, synths: {} },
      10.0,
      0.5,
    );
    expect(snap.drums).toHaveLength(1);
  });

  it('empty history → empty slice (repeat stays silent, never throws)', () => {
    const snap = captureRecentHits({ drums: {}, synths: {} }, 10, 1);
    expect(snap.drums).toHaveLength(0);
    expect(snap.synths).toHaveLength(0);
    expect(EMPTY_BEAT_SNAPSHOT.drums).toHaveLength(0);
  });

  it('the slice is a stable copy — later lastFired mutation cannot leak in', () => {
    const live: LastFiredMap = {
      drums: { kick: { velocity: 0.5, at: 10 } },
      synths: {},
    };
    const snap = captureRecentHits(live, 10, 1);
    live.drums.kick = { velocity: 0.1, at: 11 };
    expect(snap.drums[0].velocity).toBe(0.5);
  });
});
