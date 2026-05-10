import type * as Tone from 'tone';
import { TRACKS } from '../constants';
import type { TrackId } from '../types';
import { createMasterEffects, type MasterEffects } from './masterEffects';
import { createTrackMixer, type TrackMixer } from './trackMixer';
import { createVoices, type VoicePool } from './instruments';

/**
 * Top-level audio assembly. Owns the master FX, per-track mixers, and the
 * voice pool — wired together so each voice plays into its own track mixer
 * which fans out (dry / delay-send / reverb-send) into the master chain.
 *
 *   voice → plockFx → trackMixer.input
 *                       ├─ dryGain    → master.masterInput
 *                       ├─ delayGain  → master.delaySendInput
 *                       └─ reverbGain → master.reverbSendInput
 *   master.{aux returns} → master.masterInput → killEQ → filterSweep
 *     → compressor → limiter → masterVolume → destination
 */
export interface AudioGraph {
  voices: VoicePool;
  master: MasterEffects;
  tracks: Record<TrackId, TrackMixer>;
  dispose: () => void;
}

export const createAudioGraph = (): AudioGraph => {
  const master = createMasterEffects();

  const tracks = {} as Record<TrackId, TrackMixer>;
  const trackInputs = {} as Record<TrackId, Tone.ToneAudioNode>;
  for (const t of TRACKS) {
    const mixer = createTrackMixer({
      dry: master.masterInput,
      delay: master.delaySendInput,
      reverb: master.reverbSendInput,
    });
    tracks[t.id] = mixer;
    trackInputs[t.id] = mixer.input;
  }

  const voices = createVoices(trackInputs);

  return {
    voices,
    master,
    tracks,
    dispose() {
      // Tear down in reverse order: voices → tracks → master
      voices.dispose();
      for (const t of Object.values(tracks)) t.dispose();
      master.dispose();
    },
  };
};
