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
  /**
   * Dry sum bus: every track's dry output (and sample players) connect
   * HERE, one hop before masterInput. DELAY THROW taps this bus — tapping
   * masterInput instead would route the delay's own return back into the
   * delay (an instability, and via the FeedbackDelay crossfade's dry leg
   * a DelayNode-free cycle, which the Web Audio spec answers by MUTING
   * every node in the cycle — i.e. the whole master bus).
   */
  dryInput: Tone.ToneAudioNode;
  /**
   * Stutter gate stage inside the master chain (pre-limiter). The Stutter
   * LFO drives THIS linear 0..1 gain — never Destination.volume. A linear
   * 'gain' Param is structurally amplification-proof: when Tone's
   * connectSignal resets the intrinsic value to 0, "0" means silence, and
   * the summed LFO signal (0..1) is the whole gain. (With the old
   * Destination.volume approach "0" meant 0 dB = ×1, and the LFO ADDED
   * 0..1 on top → ×2 / +6 dB pumping — the live-killing noise bug.)
   */
  stutterGate: Tone.Gain;
  /** Final pre-destination stage — exposed for diagnostics / metering. */
  masterOut: Tone.ToneAudioNode;

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

  // ── Performance FX (master-bus, momentary/latch) ───────────────────
  /** Throw the summed bus into the delay line while on; tail rings out. */
  setDelayThrow: (on: boolean) => void;
  /** Recirculate the reverb output for a pseudo-freeze while on. */
  setReverbFreeze: (on: boolean) => void;
  /** Crossfade a fixed-depth bit crusher in/out of the master chain. */
  setBitCrush: (on: boolean) => void;

  setCompressorEnabled: (on: boolean, ramp?: number) => void;
  setCompressorThreshold: (db: number, ramp?: number) => void;
  setCompressorRatio: (r: number, ramp?: number) => void;

  /** Cut master bus immediately, drop aux wets, then auto-restore volume. */
  panic: () => void;

  dispose: () => void;
}

const RAMP_DEFAULT = 0.03;

// Performance-FX gain staging. All three are deliberately conservative —
// every path stays loop-gain < 1 and the master Limiter (-0.5 dB) sits
// after them as the final backstop.
const DELAY_THROW_LEVEL = 0.5; // bus → delay send while thrown
const REVERB_FREEZE_FEEDBACK = 0.85; // reverb out → reverb in recirculation
const BIT_CRUSH_WET = 0.6;
const BIT_CRUSH_BITS = 4;

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
  // Sum bus: aux returns merge here, one hop after the dry bus.
  const masterInput = new Tone.Gain(1);
  // Dry bus: tracks/samples come in here; DELAY THROW taps here (pre-
  // return, so the throw can never re-feed the delay's own output).
  const dryInput = new Tone.Gain(1);
  dryInput.connect(masterInput);

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

  // Bit crush — NATIVE (WaveShaper amplitude quantizer + CrossFade), NOT
  // Tone.BitCrusher. BitCrusher is an AudioWorklet: on iOS Safari (and
  // any non-secure context) `audioWorklet.addModule` rejects, and Tone
  // attaches no .catch → an unhandled rejection our global handler logs
  // as an error. Worse, a permanently-inserted worklet in the master
  // path is an iOS liability. A WaveShaper is pure native WebAudio:
  // synchronous, worklet-free, works on every browser.
  const crushLevels = Math.pow(2, BIT_CRUSH_BITS); // 16 levels @ 4 bits
  const bitCrushShaper = new Tone.WaveShaper((x: number) => {
    // x ∈ [-1,1] → quantize to `crushLevels` steps → back to [-1,1]
    const norm = (x + 1) / 2;
    const q = Math.round(norm * (crushLevels - 1)) / (crushLevels - 1);
    return Math.max(-1, Math.min(1, q * 2 - 1));
  }, 4096);
  // fade 0 = dry only, 1 = crushed only. Engaged FX rides at BIT_CRUSH_WET.
  const bitCrushFade = new Tone.CrossFade(0);

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

  // Stutter gate — linear 0..1 gain, pre-limiter (see interface docs).
  const stutterGate = new Tone.Gain(1);

  // Limiter — always on, last brick before volume
  const limiter = new Tone.Limiter(-0.5);

  // Final volume stage
  const masterVolume = new Tone.Volume(0);

  // Wire main chain. The bit-crush stage is a CrossFade (a=dry, b=wet),
  // so it can't be a single .chain() link — split around it.
  masterInput.chain(killEQ, filterSweepHP, filterSweepLP);
  filterSweepLP.connect(bitCrushFade.a); // dry leg
  filterSweepLP.connect(bitCrushShaper);
  bitCrushShaper.connect(bitCrushFade.b); // wet (quantized) leg
  bitCrushFade.chain(
    compressor,
    stutterGate,
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

  // ── Performance FX wiring ──────────────────────────────────────────
  // DELAY THROW: a gated tap from the DRY bus into the delay line.
  // Tapping the dry bus (NOT masterInput) keeps the graph acyclic — the
  // delay return merges at masterInput, downstream of the tap. It also
  // bounds the path: internal feedback (≤0.85) is the only recirculation.
  const delayThrowGain = new Tone.Gain(0);
  dryInput.connect(delayThrowGain);
  delayThrowGain.connect(delayFx);

  // REVERB FREEZE: recirculate reverb output back into its input. At
  // 0.85 the tail sustains near-indefinitely while on, then decays
  // naturally on release. No decay-parameter change → no IR regeneration.
  // The explicit Delay is LOAD-BEARING, not cosmetic: Tone effects route
  // input → crossfade-dry-leg → output without a DelayNode, and the Web
  // Audio spec MUTES every node in a DelayNode-free cycle (this exact
  // loop silenced the whole app once). 50 ms also adds diffusion.
  const reverbFreezeGain = new Tone.Gain(0);
  const reverbFreezeDelay = new Tone.Delay(0.05);
  reverbFx.connect(reverbFreezeGain);
  reverbFreezeGain.connect(reverbFreezeDelay);
  reverbFreezeDelay.connect(reverbFx);

  // ── Saved user values for toggles ──────────────────────────────────
  let savedDelayWet = 0.3;
  let savedReverbWet = 0.3;

  // ── Same-value guards ──────────────────────────────────────────────
  // Tone.Reverb's `decay` setter re-generates the impulse response on an
  // OfflineContext EVERY time it is assigned — even with an unchanged
  // value. Guarding here makes redundant re-applies (and slider drags on
  // unrelated params) free. Same idea for delayTime, where a redundant
  // assignment is cheap but a jump is clicky — we ramp instead.
  let lastReverbDecay = 2.5;
  let lastDelayTime: DelayTime = '8n';

  // ── Panic bookkeeping ──────────────────────────────────────────────
  // The user's intended master volume, tracked explicitly so a second
  // PANIC during the cut-ramp can never capture a mid-ramp (-∞) value
  // and "restore" silence.
  let userVolumeDb = 0;
  let panicTimer: number | null = null;

  return {
    masterInput,
    dryInput,
    delaySendInput,
    reverbSendInput,
    stutterGate,
    masterOut: masterVolume,

    setMasterVolume: (db, ramp = 0.05) => {
      userVolumeDb = Math.min(MASTER_VOLUME_MAX, db);
      safeRamp(masterVolume.volume, userVolumeDb, ramp);
    },

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
      if (time === lastDelayTime) return;
      lastDelayTime = time;
      // Duck & glide: (1) dip the delay RETURN, (2) glide the delay-line
      // length while inaudible, (3) restore the return. The glide (ramp,
      // never a value jump) means no waveform discontinuity inside the
      // feedback loop — only a pitch sweep — and the duck hides that
      // sweep. Safe to mash: every step re-ramps from the current value.
      const now = Tone.now();
      const wet = delayWetGain.gain;
      wet.cancelScheduledValues(now);
      wet.linearRampTo(0, 0.025, now);
      delayFx.delayTime.cancelScheduledValues(now);
      delayFx.delayTime.linearRampTo(time, 0.05, now + 0.03);
      wet.linearRampTo(savedDelayWet, 0.08, now + 0.09);
    },

    setReverbEnabled: (on, ramp = 0.05) =>
      safeRamp(reverbSendInput.gain, on ? 1 : 0, ramp),
    setReverbWet: (v, ramp = 0.05) => {
      savedReverbWet = v;
      safeRamp(reverbWetGain.gain, v, ramp);
    },
    setReverbDecay: (s) => {
      const clamped = Math.min(REVERB_DECAY_MAX, Math.max(REVERB_DECAY_MIN, s));
      if (clamped === lastReverbDecay) return; // skip redundant generate()
      lastReverbDecay = clamped;
      reverbFx.decay = clamped; // triggers ONE async IR generate
    },

    setDelayThrow: (on) => {
      const g = delayThrowGain.gain;
      g.cancelScheduledValues(Tone.now());
      g.linearRampTo(on ? DELAY_THROW_LEVEL : 0, 0.04);
    },
    setReverbFreeze: (on) => {
      const g = reverbFreezeGain.gain;
      g.cancelScheduledValues(Tone.now());
      // Slightly slower release so the frozen tail hands back gracefully.
      g.linearRampTo(on ? REVERB_FREEZE_FEEDBACK : 0, on ? 0.05 : 0.25);
    },
    setBitCrush: (on) => {
      bitCrushFade.fade.cancelScheduledValues(Tone.now());
      bitCrushFade.fade.linearRampTo(on ? BIT_CRUSH_WET : 0, 0.03);
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
      // Re-entrant safe: restore always targets the explicit user volume
      // (never a mid-ramp reading) and only one timer is ever pending.
      if (panicTimer !== null) window.clearTimeout(panicTimer);
      // Cut master immediately
      safeRamp(masterVolume.volume, -Infinity, 0.02);
      // Drop aux wets so existing tails are silenced too
      safeRamp(delayWetGain.gain, 0, 0.05);
      safeRamp(reverbWetGain.gain, 0, 0.05);
      // Kill performance-FX feedback paths and the crusher outright.
      delayThrowGain.gain.cancelScheduledValues(Tone.now());
      delayThrowGain.gain.linearRampTo(0, 0.03);
      reverbFreezeGain.gain.cancelScheduledValues(Tone.now());
      reverbFreezeGain.gain.linearRampTo(0, 0.03);
      bitCrushFade.fade.cancelScheduledValues(Tone.now());
      bitCrushFade.fade.linearRampTo(0, 0.03);
      // After a beat of silence, restore volume; user can re-engage wets.
      panicTimer = window.setTimeout(() => {
        panicTimer = null;
        safeRamp(
          masterVolume.volume,
          Math.min(MASTER_VOLUME_MAX, userVolumeDb),
          0.2,
        );
        // Restore wets to last user-set values
        safeRamp(delayWetGain.gain, savedDelayWet, 0.2);
        safeRamp(reverbWetGain.gain, savedReverbWet, 0.2);
      }, 280);
    },

    dispose: () => {
      // A pending restore must not touch disposed nodes.
      if (panicTimer !== null) {
        window.clearTimeout(panicTimer);
        panicTimer = null;
      }
      masterInput.dispose();
      dryInput.dispose();
      killEQ.dispose();
      filterSweepHP.dispose();
      filterSweepLP.dispose();
      bitCrushShaper.dispose();
      bitCrushFade.dispose();
      compressor.dispose();
      stutterGate.dispose();
      limiter.dispose();
      masterVolume.dispose();
      delaySendInput.dispose();
      delayFx.dispose();
      delayWetGain.dispose();
      delayThrowGain.dispose();
      reverbSendInput.dispose();
      reverbFx.dispose();
      reverbWetGain.dispose();
      reverbFreezeGain.dispose();
      reverbFreezeDelay.dispose();
    },
  };
};
