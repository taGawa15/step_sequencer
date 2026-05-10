import * as Tone from 'tone';
import {
  COMPRESSOR_RATIO_MAX,
  COMPRESSOR_RATIO_MIN,
  DELAY_FEEDBACK_MAX,
  MASTER_VOLUME_MAX,
  REVERB_DECAY_MAX,
  REVERB_DECAY_MIN,
} from '../constants';
import type { DelayTime } from '../types/audio';

// ──────────────────────────────────────────────────────────────────────────
// Filter sweep math: bipolar -100..+100 → LP cutoff (when negative) and HP
// cutoff (when positive). Both filters always exist in the chain; at v=0
// they're transparent.
// ──────────────────────────────────────────────────────────────────────────

const FS_LP_CLOSED = 150;
const FS_LP_OPEN = 20000;
const FS_HP_CLOSED = 20;
const FS_HP_OPEN = 6000;

const sweepToLPFreq = (v: number): number => {
  if (v >= 0) return FS_LP_OPEN;
  const t = Math.min(1, Math.abs(v) / 100);
  return FS_LP_OPEN * Math.pow(FS_LP_CLOSED / FS_LP_OPEN, t);
};

const sweepToHPFreq = (v: number): number => {
  if (v <= 0) return FS_HP_CLOSED;
  const t = Math.min(1, v / 100);
  return FS_HP_CLOSED * Math.pow(FS_HP_OPEN / FS_HP_CLOSED, t);
};

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

export interface MasterEffects {
  /** Sum bus where every track's dry output meets — also where aux returns merge. */
  masterInput: Tone.ToneAudioNode;
  /** Sum bus for per-track delay sends. */
  delaySendInput: Tone.ToneAudioNode;
  /** Sum bus for per-track reverb sends. */
  reverbSendInput: Tone.ToneAudioNode;

  // ── Master controls ────────────────────────────────────────────────
  setMasterVolume: (db: number, ramp?: number) => void;
  setFilterSweep: (v: number, ramp?: number) => void;
  setFilterResonance: (q: number, ramp?: number) => void;

  setKill: (band: 'low' | 'mid' | 'high', killed: boolean) => void;

  setDelayEnabled: (on: boolean, ramp?: number) => void;
  setDelayWet: (v: number, ramp?: number) => void;
  setDelayFeedback: (v: number, ramp?: number) => void;
  setDelayTime: (time: DelayTime) => void;

  setReverbEnabled: (on: boolean, ramp?: number) => void;
  setReverbWet: (v: number, ramp?: number) => void;
  setReverbDecay: (s: number) => void;

  setCompressorEnabled: (on: boolean, ramp?: number) => void;
  setCompressorThreshold: (db: number, ramp?: number) => void;
  setCompressorRatio: (r: number, ramp?: number) => void;

  /** Cut master bus immediately, drop aux wets, then auto-restore volume. */
  panic: () => void;

  dispose: () => void;
}

const RAMP_DEFAULT = 0.03;

interface RampableParam {
  cancelScheduledValues: (time: number) => unknown;
  // Tone's per-unit rampTo signatures vary (Frequency/Decibels/etc), so
  // accept any args here — we always pass a plain number.
  rampTo: (...args: never[]) => unknown;
}

const safeRamp = (param: RampableParam, value: number, time: number) => {
  param.cancelScheduledValues(Tone.now());
  (param.rampTo as (v: number, t: number) => unknown)(value, Math.max(0, time));
};

export const createMasterEffects = (): MasterEffects => {
  // Sum bus: every track's dry output goes here. Aux returns rejoin here too.
  const masterInput = new Tone.Gain(1);

  // 3-band kill EQ
  const killEQ = new Tone.EQ3({
    low: 0,
    mid: 0,
    high: 0,
    lowFrequency: 200,
    highFrequency: 2500,
  });

  // Bipolar filter sweep (LP + HP in series)
  const filterSweepLP = new Tone.Filter({
    frequency: FS_LP_OPEN,
    type: 'lowpass',
    Q: 0.7,
  });
  const filterSweepHP = new Tone.Filter({
    frequency: FS_HP_CLOSED,
    type: 'highpass',
    Q: 0.7,
  });

  // Compressor (bypassed via ratio = 1)
  const compressor = new Tone.Compressor({
    threshold: -18,
    ratio: 1, // start bypassed
    attack: 0.005,
    release: 0.1,
    knee: 6,
  });
  // Last-saved user values, used when toggling enabled back on
  let savedCompRatio = 3;

  // Limiter — always on, last brick before volume
  const limiter = new Tone.Limiter(-0.5);

  // Final volume stage
  const masterVolume = new Tone.Volume(0);

  // Wire main chain
  masterInput.chain(
    killEQ,
    filterSweepHP,
    filterSweepLP,
    compressor,
    limiter,
    masterVolume,
    Tone.getDestination(),
  );

  // ── Delay aux ──────────────────────────────────────────────────────
  // delaySendInput = master delay enable gate. When disabled, no signal
  // enters the delay; existing tail decays naturally.
  const delaySendInput = new Tone.Gain(1);
  const delayFx = new Tone.FeedbackDelay({
    delayTime: '8n',
    feedback: 0.4,
    wet: 1,
  });
  const delayWetGain = new Tone.Gain(0.3);
  delaySendInput.connect(delayFx);
  delayFx.connect(delayWetGain);
  delayWetGain.connect(masterInput);

  // ── Reverb aux ─────────────────────────────────────────────────────
  const reverbSendInput = new Tone.Gain(1);
  const reverbFx = new Tone.Reverb({ decay: 2.5, wet: 1 });
  const reverbWetGain = new Tone.Gain(0.3);
  reverbSendInput.connect(reverbFx);
  reverbFx.connect(reverbWetGain);
  reverbWetGain.connect(masterInput);
  // Generate the impulse response once now; subsequent decay changes will
  // regenerate. (Not awaited; first ~1s may have no reverb.)
  reverbFx.generate();

  // ── Saved user values for toggles ──────────────────────────────────
  let savedDelayWet = 0.3;
  let savedReverbWet = 0.3;

  return {
    masterInput,
    delaySendInput,
    reverbSendInput,

    setMasterVolume: (db, ramp = 0.05) =>
      safeRamp(
        masterVolume.volume,
        Math.min(MASTER_VOLUME_MAX, db),
        ramp,
      ),

    setFilterSweep: (v, ramp = 0.05) => {
      safeRamp(filterSweepLP.frequency, sweepToLPFreq(v), ramp);
      safeRamp(filterSweepHP.frequency, sweepToHPFreq(v), ramp);
    },

    setFilterResonance: (q, ramp = 0.05) => {
      safeRamp(filterSweepLP.Q, q, ramp);
      safeRamp(filterSweepHP.Q, q, ramp);
    },

    setKill: (band, killed) => {
      const target = killed ? -60 : 0;
      const param =
        band === 'low' ? killEQ.low : band === 'mid' ? killEQ.mid : killEQ.high;
      safeRamp(param, target, RAMP_DEFAULT);
    },

    setDelayEnabled: (on, ramp = 0.05) =>
      safeRamp(delaySendInput.gain, on ? 1 : 0, ramp),
    setDelayWet: (v, ramp = 0.05) => {
      savedDelayWet = v;
      safeRamp(delayWetGain.gain, v, ramp);
    },
    setDelayFeedback: (v, ramp = 0.05) =>
      safeRamp(delayFx.feedback, Math.min(DELAY_FEEDBACK_MAX, v), ramp),
    setDelayTime: (time) => {
      delayFx.delayTime.value = time;
    },

    setReverbEnabled: (on, ramp = 0.05) =>
      safeRamp(reverbSendInput.gain, on ? 1 : 0, ramp),
    setReverbWet: (v, ramp = 0.05) => {
      savedReverbWet = v;
      safeRamp(reverbWetGain.gain, v, ramp);
    },
    setReverbDecay: (s) => {
      reverbFx.decay = Math.min(REVERB_DECAY_MAX, Math.max(REVERB_DECAY_MIN, s));
      // Tone.Reverb auto-generates impulse on next play after `decay` change.
    },

    setCompressorEnabled: (on, ramp = 0.05) => {
      safeRamp(
        compressor.ratio,
        on ? savedCompRatio : 1,
        ramp,
      );
    },
    setCompressorThreshold: (db, ramp = 0.05) =>
      safeRamp(compressor.threshold, db, ramp),
    setCompressorRatio: (r, ramp = 0.05) => {
      const clamped = Math.max(
        COMPRESSOR_RATIO_MIN,
        Math.min(COMPRESSOR_RATIO_MAX, r),
      );
      savedCompRatio = clamped;
      safeRamp(compressor.ratio, clamped, ramp);
    },

    panic: () => {
      const wasVolume = masterVolume.volume.value;
      // Cut master immediately
      safeRamp(masterVolume.volume, -Infinity, 0.02);
      // Drop aux wets so existing tails are silenced too
      safeRamp(delayWetGain.gain, 0, 0.05);
      safeRamp(reverbWetGain.gain, 0, 0.05);
      // After a beat of silence, restore volume; user can re-engage wets.
      window.setTimeout(() => {
        safeRamp(
          masterVolume.volume,
          Math.min(MASTER_VOLUME_MAX, wasVolume),
          0.2,
        );
        // Restore wets to last user-set values
        safeRamp(delayWetGain.gain, savedDelayWet, 0.2);
        safeRamp(reverbWetGain.gain, savedReverbWet, 0.2);
      }, 280);
    },

    dispose: () => {
      masterInput.dispose();
      killEQ.dispose();
      filterSweepHP.dispose();
      filterSweepLP.dispose();
      compressor.dispose();
      limiter.dispose();
      masterVolume.dispose();
      delaySendInput.dispose();
      delayFx.dispose();
      delayWetGain.dispose();
      reverbSendInput.dispose();
      reverbFx.dispose();
      reverbWetGain.dispose();
    },
  };
};
