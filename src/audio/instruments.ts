import * as Tone from 'tone';
import { FILTER_CUTOFF_OPEN } from '../constants';
import type { DrumTrackId, NoteDuration, SynthTrackId, TrackId } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Plock parameters passed to every voice trigger.
// `null` on any field = "no plock" (the voice falls back to its default).
// ──────────────────────────────────────────────────────────────────────────

export interface PlockParams {
  filterCutoff: number | null;
  pan: number | null;
  pitchOffset: number | null;
}

export const NEUTRAL_PLOCKS: PlockParams = {
  filterCutoff: null,
  pan: null,
  pitchOffset: null,
};

// ──────────────────────────────────────────────────────────────────────────
// Voice contracts
// ──────────────────────────────────────────────────────────────────────────

export interface DrumTriggerOpts {
  time: number;
  velocity: number;
  plocks: PlockParams;
}

export interface SynthTriggerOpts {
  note: string;
  duration: NoteDuration | number;
  time: number;
  velocity: number;
  plocks: PlockParams;
}

export interface DrumVoice {
  trigger: (opts: DrumTriggerOpts) => void;
  /** Release any held envelopes (panic / all-sound-off). */
  panic: () => void;
  dispose: () => void;
}

export interface SynthVoice {
  trigger: (opts: SynthTriggerOpts) => void;
  panic: () => void;
  dispose: () => void;
}

export interface VoicePool {
  drums: Record<DrumTrackId, DrumVoice>;
  synths: Record<SynthTrackId, SynthVoice>;
  panicAll: () => void;
  dispose: () => void;
}

// ──────────────────────────────────────────────────────────────────────────
// Plock FX chain inserted at the tail of every voice (before the track input).
// ──────────────────────────────────────────────────────────────────────────

interface PlockFx {
  inputNode: Tone.ToneAudioNode;
  apply: (p: PlockParams, time: number) => void;
  dispose: () => void;
}

const makePlockFx = (out: Tone.ToneAudioNode): PlockFx => {
  const filter = new Tone.Filter({
    frequency: FILTER_CUTOFF_OPEN,
    type: 'lowpass',
    Q: 0.7,
  });
  const panner = new Tone.Panner(0);
  filter.connect(panner);
  panner.connect(out);
  return {
    inputNode: filter,
    apply: (p, time) => {
      filter.frequency.setValueAtTime(p.filterCutoff ?? FILTER_CUTOFF_OPEN, time);
      panner.pan.setValueAtTime(p.pan ?? 0, time);
    },
    dispose: () => {
      filter.dispose();
      panner.dispose();
    },
  };
};

const transposeNote = (note: string, semitones: number | null): string => {
  if (semitones === null || semitones === 0) return note;
  return Tone.Frequency(note).transpose(semitones).toNote();
};

// ──────────────────────────────────────────────────────────────────────────
// Factory — voices are wired to per-track inputs supplied by the audio graph.
// ──────────────────────────────────────────────────────────────────────────

export const createVoices = (
  trackInputs: Record<TrackId, Tone.ToneAudioNode>,
): VoicePool => {
  // ── DRUMS ────────────────────────────────────────────────────────────

  const kickFx = makePlockFx(trackInputs.kick);
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
  }).connect(kickFx.inputNode);
  kick.volume.value = -2;

  const snareFx = makePlockFx(trackInputs.snare);
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(snareFx.inputNode);
  snareNoise.volume.value = -10;
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  }).connect(snareFx.inputNode);
  snareBody.volume.value = -16;

  const closedHatFx = makePlockFx(trackInputs.closedHat);
  const closedHat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(closedHatFx.inputNode);
  closedHat.volume.value = -24;

  const openHatFx = makePlockFx(trackInputs.openHat);
  const openHat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.4, release: 0.1 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(openHatFx.inputNode);
  openHat.volume.value = -26;

  const clapFx = makePlockFx(trackInputs.clap);
  const clapShape = new Tone.Filter(1200, 'bandpass').connect(clapFx.inputNode);
  const clap = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.22, sustain: 0 },
  }).connect(clapShape);
  clap.volume.value = -8;

  const percFx = makePlockFx(trackInputs.perc);
  const perc = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
  }).connect(percFx.inputNode);
  perc.volume.value = -10;

  // ── BASS ─────────────────────────────────────────────────────────────

  const bassFx = makePlockFx(trackInputs.bass);
  const bassFilter = new Tone.Filter({
    frequency: 1400,
    type: 'lowpass',
    Q: 3,
  }).connect(bassFx.inputNode);
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.6, release: 0.18 },
    filterEnvelope: {
      attack: 0.001,
      decay: 0.2,
      sustain: 0.4,
      release: 0.4,
      baseFrequency: 120,
      octaves: 3.6,
    },
  }).connect(bassFilter);
  bass.volume.value = -8;

  // ── LEAD ─────────────────────────────────────────────────────────────
  // NOTE: the lead voice is DRY by design. Earlier builds hard-wired a
  // FeedbackDelay (wet 0.18) here, which made LEAD echo even with every
  // user-facing delay control at zero. Delay is now exclusively opt-in
  // via the master delay send (MIXER → DLY) / DELAY THROW.
  const leadFx = makePlockFx(trackInputs.lead);
  const lead = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.3, release: 0.4 },
  }).connect(leadFx.inputNode);
  lead.volume.value = -12;

  // ── Triggers ─────────────────────────────────────────────────────────

  const drums: VoicePool['drums'] = {
    kick: {
      trigger: ({ time, velocity, plocks }) => {
        kickFx.apply(plocks, time);
        kick.detune.setValueAtTime((plocks.pitchOffset ?? 0) * 100, time);
        kick.triggerAttackRelease('C1', '8n', time, velocity);
      },
      panic: () => kick.triggerRelease(),
      dispose: () => {
        kick.dispose();
        kickFx.dispose();
      },
    },
    snare: {
      trigger: ({ time, velocity, plocks }) => {
        snareFx.apply(plocks, time);
        snareBody.detune.setValueAtTime((plocks.pitchOffset ?? 0) * 100, time);
        snareNoise.triggerAttackRelease('16n', time, velocity);
        snareBody.triggerAttackRelease('G2', '32n', time, velocity);
      },
      panic: () => {
        snareNoise.triggerRelease();
        snareBody.triggerRelease();
      },
      dispose: () => {
        snareNoise.dispose();
        snareBody.dispose();
        snareFx.dispose();
      },
    },
    closedHat: {
      trigger: ({ time, velocity, plocks }) => {
        closedHatFx.apply(plocks, time);
        closedHat.triggerAttackRelease('C5', 0.05, time, velocity);
      },
      panic: () => closedHat.triggerRelease(),
      dispose: () => {
        closedHat.dispose();
        closedHatFx.dispose();
      },
    },
    openHat: {
      trigger: ({ time, velocity, plocks }) => {
        openHatFx.apply(plocks, time);
        openHat.triggerAttackRelease('C5', 0.4, time, velocity);
      },
      panic: () => openHat.triggerRelease(),
      dispose: () => {
        openHat.dispose();
        openHatFx.dispose();
      },
    },
    clap: {
      trigger: ({ time, velocity, plocks }) => {
        clapFx.apply(plocks, time);
        clap.triggerAttackRelease('16n', time, velocity);
      },
      panic: () => clap.triggerRelease(),
      dispose: () => {
        clap.dispose();
        clapShape.dispose();
        clapFx.dispose();
      },
    },
    perc: {
      trigger: ({ time, velocity, plocks }) => {
        percFx.apply(plocks, time);
        perc.detune.setValueAtTime((plocks.pitchOffset ?? 0) * 100, time);
        perc.triggerAttackRelease('A2', '16n', time, velocity);
      },
      panic: () => perc.triggerRelease(),
      dispose: () => {
        perc.dispose();
        percFx.dispose();
      },
    },
  };

  const synths: VoicePool['synths'] = {
    bass: {
      trigger: ({ note, duration, time, velocity, plocks }) => {
        bassFx.apply(plocks, time);
        bass.triggerAttackRelease(
          transposeNote(note, plocks.pitchOffset),
          duration,
          time,
          velocity,
        );
      },
      panic: () => bass.triggerRelease(),
      dispose: () => {
        bass.dispose();
        bassFilter.dispose();
        bassFx.dispose();
      },
    },
    lead: {
      trigger: ({ note, duration, time, velocity, plocks }) => {
        leadFx.apply(plocks, time);
        lead.triggerAttackRelease(
          transposeNote(note, plocks.pitchOffset),
          duration,
          time,
          velocity,
        );
      },
      panic: () => lead.triggerRelease(),
      dispose: () => {
        lead.dispose();
        leadFx.dispose();
      },
    },
  };

  return {
    drums,
    synths,
    panicAll() {
      Object.values(this.drums).forEach((v) => v.panic());
      Object.values(this.synths).forEach((v) => v.panic());
    },
    dispose() {
      Object.values(this.drums).forEach((v) => v.dispose());
      Object.values(this.synths).forEach((v) => v.dispose());
    },
  };
};
