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
 * Maximum stutter depth. depth 1.0 would gate to full silence; capping at
 * 0.85 keeps a -16 dB floor so the effect is dramatic but the output can
 * never read as "the sound cut out" — and (by construction, since the
 * gate is a linear 0..1 gain inside the master chain) it can NEVER get
 * louder than the dry signal.
 */
export const STUTTER_DEPTH_MAX = 0.85;
/** Fade applied when the stutter gate engages/releases (anti-click). */
const STUTTER_RELEASE_SEC = 0.015;

/** Minimal Param surface the stutter gate needs (Tone.Param<'gain'>). */
export interface StutterGateParam {
  cancelScheduledValues: (time: number) => unknown;
  linearRampTo: (value: number, rampTime: number, startTime?: number) => unknown;
}

/**
 * Bundled live performance FX:
 *   - Beat Repeat: schedules extra trigger ticks via Tone.Loop. The
 *     consumer receives the Loop's precise scheduled `time` so retriggers
 *     land on the grid (NOT Tone.now(), which would jitter by lookahead).
 *   - Stutter Gate: drives the master chain's dedicated linear stutter
 *     gate (MasterEffects.stutterGate) with a square LFO. It must NEVER
 *     touch Tone.Destination.volume: connectSignal resets a Param's
 *     intrinsic value with "0", which on the dB-typed destination volume
 *     converts to ×1 linear — the LFO then SUMS on top, pumping the
 *     master at up to ×2 (+6 dB) after the limiter. That was the
 *     "stutter = sudden loud noise" bug.
 *   - Tape Stop: ramps Tone.Transport.bpm toward 5 BPM. BPM bookkeeping
 *     is guarded so re-triggering mid-stop can never corrupt the saved
 *     tempo, and PANIC only restores BPM when a tape stop is actually
 *     in flight (no "0.9 heuristic").
 */
export interface PerformanceFx {
  startBeatRepeat: (rate: RepeatRate, onTick: (time: number) => void) => void;
  stopBeatRepeat: () => void;
  setBeatRepeatRate: (rate: RepeatRate) => void;

  /**
   * Engage the stutter gate. Returns false (no-op) when `gate` is null —
   * i.e. the audio graph isn't ready — so UI state can stay truthful.
   */
  startStutter: (
    rate: RepeatRate,
    depth: number,
    gate: StutterGateParam | null,
  ) => boolean;
  stopStutter: () => void;
  setStutterDepth: (depth: number) => void;

  /**
   * Begin a tape stop. Returns false (and does nothing) when one is
   * already in flight — callers can rely on this as the single source of
   * truth, because React state updates are async and can race a double
   * key press.
   */
  startTapeStop: (seconds: number, onComplete: () => void) => boolean;
  /** Ramp BPM back to the value saved by startTapeStop (resume mode). */
  resumeTapeStop: (seconds: number) => void;
  /**
   * End a tape stop without audible ramp-back (release mode — call after
   * the transport has been stopped). Restores the saved BPM silently so
   * the next Play starts at the right tempo.
   */
  finishTapeStop: () => void;
  isTapeStopActive: () => boolean;

  panic: () => void;
  dispose: () => void;
}

export const createPerformanceFx = (): PerformanceFx => {
  // ── Beat Repeat ───────────────────────────────────────────────
  let beatLoop: Tone.Loop | null = null;
  let lastTickFn: ((time: number) => void) | null = null;

  const buildBeatLoop = (rate: RepeatRate, onTick: (time: number) => void) => {
    if (beatLoop) {
      beatLoop.stop();
      beatLoop.dispose();
    }
    beatLoop = new Tone.Loop((time) => onTick(time), rate);
    beatLoop.start(0);
  };

  // ── Stutter Gate ──────────────────────────────────────────────
  // Square LFO → master stutterGate.gain (linear 0..1). min = gate floor
  // (1 - depth), max = 1 (unity). Amplification is impossible.
  let stutterLfo: Tone.LFO | null = null;
  let stutterGateParam: StutterGateParam | null = null;

  const gateFloor = (depth: number): number =>
    1 - Math.min(STUTTER_DEPTH_MAX, Math.max(0, depth));

  const releaseStutterGate = () => {
    if (!stutterGateParam) return;
    try {
      // connectSignal zeroed the intrinsic value; after the LFO is gone
      // the gate would sit at silence — fade it back to unity (≈15 ms,
      // doubles as the anti-click release).
      stutterGateParam.cancelScheduledValues(Tone.now());
      stutterGateParam.linearRampTo(1, STUTTER_RELEASE_SEC);
    } catch {
      /* graph may be mid-dispose */
    }
    stutterGateParam = null;
  };

  // ── Tape Stop ─────────────────────────────────────────────────
  // null = no tape stop has happened; never trust a default tempo.
  let savedBpm: number | null = null;
  let tapeActive = false;
  let tapeTimer: number | null = null;

  const clearTapeTimer = () => {
    if (tapeTimer !== null) {
      window.clearTimeout(tapeTimer);
      tapeTimer = null;
    }
  };

  const restoreSavedBpm = (rampSec: number) => {
    if (savedBpm === null) return;
    const transport = Tone.getTransport();
    transport.bpm.cancelScheduledValues(Tone.now());
    transport.bpm.rampTo(savedBpm, Math.max(0.01, rampSec));
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
    startStutter(rate, depth, gate) {
      if (!gate) return false; // audio graph not ready — refuse silently
      // One LFO at a time: a re-trigger (rate change / key mash) tears
      // the previous one down first, so nodes can never accumulate.
      if (stutterLfo) {
        stutterLfo.stop();
        stutterLfo.disconnect();
        stutterLfo.dispose();
        stutterLfo = null;
      }
      // If we were previously attached to a different gate, restore it.
      if (stutterGateParam && stutterGateParam !== gate) releaseStutterGate();
      stutterGateParam = gate;
      const hz = RATE_TO_HZ(rate, Tone.getTransport().bpm.value);
      stutterLfo = new Tone.LFO({
        type: 'square',
        frequency: hz,
        min: gateFloor(depth),
        max: 1,
        // phase 0 starts the square HIGH → the gate engages open (unity),
        // so turning the effect on never clicks.
      });
      stutterLfo.connect(gate as unknown as Tone.Param<'gain'>);
      stutterLfo.start();
      return true;
    },
    stopStutter() {
      if (stutterLfo) {
        stutterLfo.stop();
        stutterLfo.disconnect();
        stutterLfo.dispose();
        stutterLfo = null;
      }
      releaseStutterGate();
    },
    setStutterDepth(depth) {
      if (stutterLfo) {
        stutterLfo.min = gateFloor(depth);
      }
    },

    // ── Tape Stop API ─────────────────────────────────────────
    startTapeStop(seconds, onComplete) {
      if (tapeActive) return false; // re-trigger guard (synchronous)
      tapeActive = true;
      const transport = Tone.getTransport();
      savedBpm = transport.bpm.value; // only the pre-stop tempo is saved
      transport.bpm.cancelScheduledValues(Tone.now());
      transport.bpm.rampTo(5, Math.max(0.05, seconds));
      clearTapeTimer();
      tapeTimer = window.setTimeout(() => {
        tapeTimer = null;
        onComplete();
      }, Math.max(50, seconds * 1000));
      return true;
    },
    resumeTapeStop(seconds) {
      restoreSavedBpm(seconds);
      tapeActive = false;
    },
    finishTapeStop() {
      // Transport is (expected to be) stopped here, so the restore ramp
      // is inaudible — but the tempo is correct for the next Play.
      restoreSavedBpm(0.01);
      tapeActive = false;
    },
    isTapeStopActive: () => tapeActive,

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
      releaseStutterGate();
      // Restore Transport BPM only when a tape stop is actually mid-flight.
      clearTapeTimer();
      if (tapeActive && savedBpm !== null) {
        restoreSavedBpm(0.05);
      }
      tapeActive = false;
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
