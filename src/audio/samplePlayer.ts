import * as Tone from 'tone';

/**
 * Lightweight sample player wrapped around Tone.Player. Designed to be
 * created from a Blob (e.g. from MediaRecorder) and connected to a node
 * in the master graph.
 */
export interface SamplePlayer {
  ready: boolean;
  trigger: (time: number, velocity?: number) => void;
  setGain: (gain: number) => void;
  /** semitones; applied via playbackRate (rough but cheap). */
  setPitch: (semitones: number) => void;
  dispose: () => void;
}

export const createSamplePlayerFromUrl = async (
  url: string,
  out: Tone.ToneAudioNode,
): Promise<SamplePlayer> => {
  const player = new Tone.Player({ url, autostart: false }).connect(out);
  // Wait for the buffer to load before allowing triggers.
  await player.load(url).catch(() => undefined);
  let pitchSemis = 0;

  const apply = () => {
    player.playbackRate = Math.pow(2, pitchSemis / 12);
  };
  apply();

  return {
    get ready() {
      return player.loaded;
    },
    trigger: (time, velocity = 1) => {
      if (!player.loaded) return;
      try {
        player.volume.value = Tone.gainToDb(Math.max(0.0001, velocity));
        player.start(time);
      } catch {
        /* iOS sometimes rejects start() if AC is not running */
      }
    },
    setGain: (gain) => {
      player.volume.value = Tone.gainToDb(Math.max(0.0001, gain));
    },
    setPitch: (semis) => {
      pitchSemis = semis;
      apply();
    },
    dispose: () => {
      player.stop();
      player.dispose();
    },
  };
};
