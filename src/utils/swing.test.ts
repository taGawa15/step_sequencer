import { describe, expect, it } from 'vitest';
import { SWING_MAX, clampSwing, swingDelaySeconds } from './swing';

describe('swing', () => {
  it('never delays even steps', () => {
    expect(swingDelaySeconds(0, 0.125, 75)).toBe(0);
    expect(swingDelaySeconds(2, 0.125, 75)).toBe(0);
    expect(swingDelaySeconds(62, 0.125, 75)).toBe(0);
  });

  it('delays odd steps by swing% of half a step', () => {
    // 50% of half a 125ms step = 31.25ms
    expect(swingDelaySeconds(1, 0.125, 50)).toBeCloseTo(0.03125, 6);
    // 75% (max) = 37.5% of the step
    expect(swingDelaySeconds(3, 0.125, 75)).toBeCloseTo(0.046875, 6);
  });

  it('0% swing is straight', () => {
    expect(swingDelaySeconds(1, 0.125, 0)).toBe(0);
  });

  it('clamps out-of-range and garbage input', () => {
    expect(clampSwing(-10)).toBe(0);
    expect(clampSwing(200)).toBe(SWING_MAX);
    expect(clampSwing(Number.NaN)).toBe(0);
    expect(clampSwing('33' as unknown)).toBe(0);
    expect(clampSwing(undefined)).toBe(0);
    expect(clampSwing(33)).toBe(33);
  });

  it('guards against broken step lengths', () => {
    expect(swingDelaySeconds(1, 0, 50)).toBe(0);
    expect(swingDelaySeconds(1, Number.NaN, 50)).toBe(0);
    expect(swingDelaySeconds(1, -1, 50)).toBe(0);
  });
});
