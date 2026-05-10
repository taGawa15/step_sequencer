import * as Tone from 'tone';

export type RepeatRate = '4n' | '8n' | '16n' | '32n';
export type FxMode = 'momentary' | 'latch';

const RATE_TO_HZ = (rate: RepeatRate, bpm: number): number => {
  // Beat = 60/BPM seconds. 4n = 1 per beat, 8n = 2/beat, etc.
  const beatHz = bpm / 60;
  switch (rate) {
    case '4n': return beatHz;
    case '8n': return beatHz * 2;
    case '16n': return beatHz * 4;
    case '32n': return beatHz * 8;
  }
};

/**
 * Bundled live performance FX:
 *   - Beat Repeat: schedules extra trigger ticks via Tone.Loop. The
 *     consumer supplies the actual trigger work.
 *   - Stutter Gate: modulates Tone.Destination.volume with a square LFO.
 *     We use the global destination so we don't have to splice new
 *     nodes into the existing master chain.
 *   - Tape Stop: ramps Tone.Transport.bpm toward 5 BPM over the
 *     configured time, then either stays released or rampBacks.
 */
export interface PerformanceFx {
  startBeatRepeat: (rate: RepeatRate, onTick: () => void) => void;
  stopBeatRepeat: () => void;
  setBeatRepeatRate: (rate: RepeatRate) => void;

  startStutter: (rate: RepeatRate, depth: number) => void;
  stopStutter: () => void;
  setStutterDepth: (depth: number) => void;

  /** Returns the saved BPM so the caller can also restore manually. */
  startTapeStop: (seconds: number, onComplete: () => void) => number;
  resumeTapeStop: (seconds: number) => void;

  panic: () => void;
  dispose: () => void;
}

export const createPerformanceFx = (): PerformanceFx => {
  // ── Beat Repeat ───────────────────────────────────────────────
  let beatLoop: Tone.Loop | null = null;
  let lastTickFn: (() => void) | null = null;

  const buildBeatLoop = (rate: RepeatRate, onTick: () => void) => {
    if (beatLoop) {
      beatLoop.stop();
      beatLoop.dispose();
    }
    beatLoop = new Tone.Loop((_time) => onTick(), rate);
    beatLoop.start(0);
  };

  // ── Stutter Gate ──────────────────────────────────────────────
  // Modulate Tone.Destination's master volume with an LFO. Min/max are
  // dB values: 0 dB = open, -60 dB ≈ silent.
  let stutterLfo: Tone.LFO | null = null;

  // ── Tape Stop ─────────────────────────────────────────────────
  let savedBpm = 120;

  const restoreDestVolume = (rampSec = 0.05) => {
    const dest = Tone.getDestination();
    dest.volume.cancelScheduledValues(Tone.now());
    dest.volume.rampTo(0, rampSec);
  };

  return {
    // ── Beat Repeat API ───────────────────────────────────────
    startBeatRepeat(rate, onTick) {
      lastTickFn = onTick;
      buildBeatLoop(rate, onTick);
    },
    stopBeatRepeat() {
      if (beatLoop) {
        beatLoop.stop();
        beatLoop.dispose();
        beatLoop = null;
      }
      lastTickFn = null;
    },
    setBeatRepeatRate(rate) {
      if (beatLoop && lastTickFn) buildBeatLoop(rate, lastTickFn);
    },

    // ── Stutter Gate API ──────────────────────────────────────
    startStutter(rate, depth) {
      if (stutterLfo) {
        stutterLfo.stop();
        stutterLfo.dispose();
      }
      const hz = RATE_TO_HZ(rate, Tone.getTransport().bpm.value);
      // depth 0..1 → min dB 0 (no gate) .. -60 (full gate)
      const minDb = -60 * Math.max(0, Math.min(1, depth));
      stutterLfo = new Tone.LFO({
        type: 'square',
        frequency: hz,
        min: minDb,
        max: 0,
      });
      stutterLfo.connect(Tone.getDestination().volume);
      stutterLfo.start();
    },
    stopStutter() {
      if (stutterLfo) {
        stutterLfo.stop();
        stutterLfo.disconnect();
        stutterLfo.dispose();
        stutterLfo = null;
      }
      restoreDestVolume();
    },
    setStutterDepth(depth) {
      if (stutterLfo) {
        const minDb = -60 * Math.max(0, Math.min(1, depth));
        stutterLfo.min = minDb;
      }
    },

    // ── Tape Stop API ─────────────────────────────────────────
    startTapeStop(seconds, onComplete) {
      const transport = Tone.getTransport();
      savedBpm = transport.bpm.value;
      transport.bpm.cancelScheduledValues(Tone.now());
      transport.bpm.rampTo(5, Math.max(0.05, seconds));
      window.setTimeout(() => onComplete(), Math.max(50, seconds * 1000));
      return savedBpm;
    },
    resumeTapeStop(seconds) {
      const transport = Tone.getTransport();
      transport.bpm.cancelScheduledValues(Tone.now());
      transport.bpm.rampTo(savedBpm, Math.max(0.05, seconds));
    },

    panic() {
      if (beatLoop) {
        beatLoop.stop();
        beatLoop.dispose();
        beatLoop = null;
      }
      lastTickFn = null;
      if (stutterLfo) {
        stutterLfo.stop();
        stutterLfo.disconnect();
        stutterLfo.dispose();
        stutterLfo = null;
      }
      restoreDestVolume(0.03);
      // Restore Transport BPM if mid-tape-stop
      const transport = Tone.getTransport();
      if (transport.bpm.value < savedBpm * 0.9) {
        transport.bpm.cancelScheduledValues(Tone.now());
        transport.bpm.rampTo(savedBpm, 0.05);
      }
    },
    dispose() {
      this.panic();
    },
  };
};

export const PERF_FX_RATE_OPTIONS: readonly RepeatRate[] = ['4n', '8n', '16n', '32n'];
export const PERF_FX_RATE_LABEL: Record<RepeatRate, string> = {
  '4n': '1/4',
  '8n': '1/8',
  '16n': '1/16',
  '32n': '1/32',
};
