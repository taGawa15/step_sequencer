import { describe, expect, it } from 'vitest';
import {
  diffPerformanceParams,
  normalizePerformance,
} from './usePerformanceControls';

describe('diffPerformanceParams (reverb decay same-value guard)', () => {
  const base = normalizePerformance({});

  it('moving the filter sweep never touches reverb decay or delay time', () => {
    const next = { ...base, filterSweep: 60 };
    const touched = diffPerformanceParams(base, next);
    expect(touched).toEqual(['filterSweep']);
    expect(touched).not.toContain('reverb.decay');
    expect(touched).not.toContain('delay.time');
  });

  it('identical states touch nothing at all', () => {
    expect(diffPerformanceParams(base, { ...base })).toEqual([]);
  });

  it('an actual decay change touches exactly reverb.decay', () => {
    const next = { ...base, reverb: { ...base.reverb, decay: 5.5 } };
    expect(diffPerformanceParams(base, next)).toEqual(['reverb.decay']);
  });

  it('a single track send change touches only that send', () => {
    const next = {
      ...base,
      trackSends: {
        ...base.trackSends,
        kick: { ...base.trackSends.kick, delay: 0.4 },
      },
    };
    expect(diffPerformanceParams(base, next)).toEqual(['track.kick.delay']);
  });
});

describe('normalizePerformance (broken storage)', () => {
  it('fills defaults from garbage', () => {
    const s = normalizePerformance({ delay: { feedback: 9 }, masterVolume: 'x' });
    expect(s.delay.feedback).toBeLessThanOrEqual(0.85);
    expect(s.masterVolume).toBe(-6);
    expect(s.reverb.decay).toBeGreaterThan(0);
  });
});

describe('delay defaults (LEAD must be dry out of the box)', () => {
  it('fresh state: master delay disabled and every delay SEND at 0', () => {
    const s = normalizePerformance({});
    expect(s.delay.enabled).toBe(false);
    expect(s.trackSends.lead.delay).toBe(0);
    expect(s.trackSends.bass.delay).toBe(0);
    expect(s.trackSends.kick.delay).toBe(0);
    expect(s.trackSends.snare.delay).toBe(0);
    expect(s.trackSends.closedHat.delay).toBe(0);
    expect(s.trackSends.openHat.delay).toBe(0);
    expect(s.trackSends.clap.delay).toBe(0);
    expect(s.trackSends.perc.delay).toBe(0);
  });

  it('old storage cannot resurrect a delay the user never enabled', () => {
    // delay.enabled missing → false; send garbage → 0
    const s = normalizePerformance({
      delay: { wet: 0.5 },
      trackSends: { lead: { delay: 'x' } },
    });
    expect(s.delay.enabled).toBe(false);
    expect(s.trackSends.lead.delay).toBe(0);
  });
});
