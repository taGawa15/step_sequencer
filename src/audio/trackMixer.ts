import * as Tone from 'tone';

export interface TrackMixerDestinations {
  dry: Tone.ToneAudioNode;
  delay: Tone.ToneAudioNode;
  reverb: Tone.ToneAudioNode;
}

export interface TrackMixer {
  /** Voices for this track connect to this node. */
  input: Tone.ToneAudioNode;
  setGain: (v: number, ramp?: number) => void;
  setDelaySend: (v: number, ramp?: number) => void;
  setReverbSend: (v: number, ramp?: number) => void;
  dispose: () => void;
}

export const createTrackMixer = (
  dests: TrackMixerDestinations,
  initial: { delaySend?: number; reverbSend?: number } = {},
): TrackMixer => {
  const input = new Tone.Gain(1); // track gain stage (currently fixed at 1)
  const dryGain = new Tone.Gain(1);
  const delayGain = new Tone.Gain(initial.delaySend ?? 0);
  const reverbGain = new Tone.Gain(initial.reverbSend ?? 0.1);

  // Fan out
  input.connect(dryGain);
  input.connect(delayGain);
  input.connect(reverbGain);

  dryGain.connect(dests.dry);
  delayGain.connect(dests.delay);
  reverbGain.connect(dests.reverb);

  const ramp = (param: Tone.Param<'gain'>, value: number, t: number) => {
    param.cancelScheduledValues(Tone.now());
    param.rampTo(value, Math.max(0, t));
  };

  return {
    input,
    setGain: (v, t = 0.02) => ramp(input.gain, v, t),
    setDelaySend: (v, t = 0.02) => ramp(delayGain.gain, v, t),
    setReverbSend: (v, t = 0.02) => ramp(reverbGain.gain, v, t),
    dispose: () => {
      input.dispose();
      dryGain.dispose();
      delayGain.dispose();
      reverbGain.dispose();
    },
  };
};
