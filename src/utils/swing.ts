/**
 * Swing math, kept pure so it can be unit-tested without Tone.js.
 *
 * Model: 16th-note swing. Odd (off-beat) 16th steps are delayed by up to
 * half a step. 0% = straight, 75% (max) = 37.5% of a step late — a hard
 * MPC-style shuffle while still leaving headroom inside the scheduler
 * lookahead together with negative micro-timing (−50 ms).
 */

export const SWING_MIN = 0;
export const SWING_MAX = 75;
export const SWING_DEFAULT = 0;

/** Clamp arbitrary input (storage, MIDI, UI) into the valid swing range. */
export const clampSwing = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return SWING_DEFAULT;
  return Math.min(SWING_MAX, Math.max(SWING_MIN, value));
};

/**
 * Delay in seconds to add to a step's scheduled time.
 * Even steps (0, 2, 4, …) are never delayed; odd steps are delayed by
 * (swing% / 100) × stepLength / 2.
 */
export const swingDelaySeconds = (
  stepIndex: number,
  stepLengthSeconds: number,
  swingPercent: number,
): number => {
  if (stepIndex % 2 === 0) return 0;
  if (!Number.isFinite(stepLengthSeconds) || stepLengthSeconds <= 0) return 0;
  return (clampSwing(swingPercent) / 100) * stepLengthSeconds * 0.5;
};
