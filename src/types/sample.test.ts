import { describe, expect, it } from 'vitest';
import { MIN_TRIM_GAP, normalizeSampleMeta, normalizeTrim } from './sample';

describe('normalizeTrim', () => {
  it('passes a valid window through', () => {
    expect(normalizeTrim(0.5, 2.0, 4)).toEqual({ trimStart: 0.5, trimEnd: 2.0 });
  });

  it('treats end at (or past) the duration as "play to end"', () => {
    expect(normalizeTrim(0, 4, 4)).toEqual({ trimStart: 0, trimEnd: null });
    expect(normalizeTrim(0, 99, 4)).toEqual({ trimStart: 0, trimEnd: null });
  });

  it('clamps start into the recording', () => {
    expect(normalizeTrim(-3, null, 4).trimStart).toBe(0);
    expect(normalizeTrim(99, null, 4).trimStart).toBeCloseTo(4 - MIN_TRIM_GAP, 6);
  });

  it('forces end after start by at least the minimum gap', () => {
    const w = normalizeTrim(2, 1, 4); // end before start
    expect(w.trimStart).toBe(2);
    expect(w.trimEnd).toBeCloseTo(2 + MIN_TRIM_GAP, 6);
  });

  it('survives garbage input', () => {
    expect(normalizeTrim('a', {}, 4)).toEqual({ trimStart: 0, trimEnd: null });
    expect(normalizeTrim(Number.NaN, Number.NaN, 4)).toEqual({
      trimStart: 0,
      trimEnd: null,
    });
    expect(normalizeTrim(1, 2, Number.NaN)).toEqual({ trimStart: 0, trimEnd: null });
  });
});

describe('normalizeSampleMeta', () => {
  it('repairs an old-schema entry (no trim, no gain)', () => {
    const m = normalizeSampleMeta({ id: 's-1', name: 'kick', durationSec: 2 });
    expect(m).not.toBeNull();
    expect(m?.trimStart).toBe(0);
    expect(m?.trimEnd).toBeNull();
    expect(m?.gain).toBe(0.8);
    expect(m?.pitch).toBe(0);
    expect(m?.assignedTo).toBeNull();
  });

  it('drops entries without a usable id', () => {
    expect(normalizeSampleMeta({})).toBeNull();
    expect(normalizeSampleMeta(null)).toBeNull();
    expect(normalizeSampleMeta('x')).toBeNull();
  });

  it('rejects an invalid assignedTo track', () => {
    const m = normalizeSampleMeta({ id: 's-1', assignedTo: 'nonsense' });
    expect(m?.assignedTo).toBeNull();
  });

  it('keeps a valid assignedTo track', () => {
    const m = normalizeSampleMeta({ id: 's-1', assignedTo: 'kick' });
    expect(m?.assignedTo).toBe('kick');
  });
});
