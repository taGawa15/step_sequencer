import { describe, expect, it } from 'vitest';
import { createEmptyPattern, DEFAULT_BPM, DEFAULT_LOOP_LENGTH, MAX_BPM } from '../constants';
import { normalizeProjectSnapshot, normalizeTimelineSlot } from './projectSnapshot';

describe('normalizeProjectSnapshot', () => {
  it('rejects non-objects and empty objects (the white-screen vector)', () => {
    expect(normalizeProjectSnapshot(null)).toBeNull();
    expect(normalizeProjectSnapshot(undefined)).toBeNull();
    expect(normalizeProjectSnapshot('x')).toBeNull();
    expect(normalizeProjectSnapshot({})).toBeNull();
    expect(normalizeProjectSnapshot({ bpm: 120 })).toBeNull(); // no pattern
  });

  it('repairs a minimal old-schema snapshot (pattern only)', () => {
    const snap = normalizeProjectSnapshot({ pattern: createEmptyPattern() });
    expect(snap).not.toBeNull();
    expect(snap?.bpm).toBe(DEFAULT_BPM);
    expect(snap?.swing).toBe(0);
    expect(snap?.loopLength).toBe(DEFAULT_LOOP_LENGTH);
    expect(snap?.mutes.kick).toBe(false);
    expect(snap?.performance.delay.feedback).toBeLessThanOrEqual(0.85);
    expect(snap?.snapshots.A.empty).toBe(true);
  });

  it('clamps out-of-range scalar fields instead of failing', () => {
    const snap = normalizeProjectSnapshot({
      pattern: createEmptyPattern(),
      bpm: 9999,
      swing: 400,
      loopLength: 7,
    });
    expect(snap?.bpm).toBe(MAX_BPM);
    expect(snap?.swing).toBe(75);
    expect(snap?.loopLength).toBe(DEFAULT_LOOP_LENGTH);
  });

  it('repairs a 16-step (v3-era) pattern by padding to 64', () => {
    const old = createEmptyPattern();
    const shortened = {
      drums: Object.fromEntries(
        Object.entries(old.drums).map(([k, v]) => [k, v.slice(0, 16)]),
      ),
      synths: Object.fromEntries(
        Object.entries(old.synths).map(([k, v]) => [k, v.slice(0, 16)]),
      ),
    };
    const snap = normalizeProjectSnapshot({ pattern: shortened });
    expect(snap?.pattern.drums.kick).toHaveLength(64);
    expect(snap?.pattern.synths.lead).toHaveLength(64);
  });
});

describe('normalizeTimelineSlot', () => {
  it('rejects a slot whose data is empty', () => {
    expect(normalizeTimelineSlot({ name: 'x', savedAt: 'x', data: {} })).toBeNull();
    expect(normalizeTimelineSlot({})).toBeNull();
    expect(normalizeTimelineSlot(null)).toBeNull();
  });

  it('normalizes a valid slot and fills missing metadata', () => {
    const slot = normalizeTimelineSlot({
      data: { pattern: createEmptyPattern() },
    });
    expect(slot).not.toBeNull();
    expect(slot?.name).toBe('Timeline');
    expect(typeof slot?.savedAt).toBe('string');
    expect(slot?.data.bpm).toBe(DEFAULT_BPM);
  });
});
