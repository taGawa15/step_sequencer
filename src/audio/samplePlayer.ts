import * as Tone from 'tone';

/**
 * Lightweight sample player wrapped around Tone.Player. Designed to be
 * created from a Blob URL (e.g. from MediaRecorder) and connected to a
 * node in the master graph. Supports gain, semitone pitch (playbackRate)
 * and a trim window (start/end seconds within the buffer).
 */
export interface SamplePlayer {
  ready: boolean;
  trigger: (time: number, velocity?: number) => void;
  setGain: (gain: number) => void;
  /** semitones; applied via playbackRate (rough but cheap). */
  setPitch: (semitones: number) => void;
  /** Playback window in buffer-seconds. end=null plays to the end. */
  setTrim: (startSec: number, endSec: number | null) => void;
  dispose: () => void;
}

/**
 * Inert placeholder used while the real player is loading asynchronously.
 * Every method is a safe no-op, so a sample deleted mid-load can be
 * disposed without a TypeError (the old `{ ready:false } as SamplePlayer`
 * sentinel crashed exactly there).
 */
export const createPendingSamplePlayer = (): SamplePlayer => ({
  ready: false,
  trigger: () => {},
  setGain: () => {},
  setPitch: () => {},
  setTrim: () => {},
  dispose: () => {},
});

const MIN_TRIM_LENGTH = 0.01; // seconds

export const createSamplePlayerFromUrl = async (
  url: string,
  out: Tone.ToneAudioNode,
): Promise<SamplePlayer> => {
  // Single load: construct WITHOUT a url (constructing with one already
  // starts a fetch+decode, and the old code then load()ed it again).
  const player = new Tone.Player({ autostart: false }).connect(out);
  await player.load(url).catch(() => undefined);

  let pitchSemis = 0;
  let trimStart = 0;
  let trimEnd: number | null = null;

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
        const bufferDur = player.buffer.duration;
        const offset = Math.min(Math.max(0, trimStart), Math.max(0, bufferDur - MIN_TRIM_LENGTH));
        const end = trimEnd === null ? bufferDur : Math.min(trimEnd, bufferDur);
        const playDur = end - offset;
        if (playDur >= MIN_TRIM_LENGTH) {
          player.start(time, offset, playDur);
        } else {
          player.start(time, offset);
        }
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
    setTrim: (startSec, endSec) => {
      trimStart = Number.isFinite(startSec) ? Math.max(0, startSec) : 0;
      trimEnd =
        endSec !== null && Number.isFinite(endSec) && endSec > trimStart
          ? endSec
          : null;
    },
    dispose: () => {
      try {
        player.stop();
      } catch {
        /* already stopped */
      }
      player.dispose();
    },
  };
};
