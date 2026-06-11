import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Minimal 'tone' mock — just enough surface for performanceFx. The real
 * audio behavior is out of scope; what we verify here is the BPM
 * bookkeeping and scheduling contracts.
 */
vi.mock('tone', () => {
  const bpm = {
    value: 120,
    cancelScheduledValues: () => {},
    rampTo(target: number, _ramp?: number) {
      this.value = target;
    },
  };
  const transport = { bpm };
  const destVolume = {
    value: 0,
    cancelScheduledValues: () => {},
    rampTo: () => {},
  };
  class Loop {
    static instances: Loop[] = [];
    cb: (time: number) => void;
    constructor(cb: (time: number) => void, _rate?: string) {
      this.cb = cb;
      Loop.instances.push(this);
    }
    start() {
      return this;
    }
    stop() {
      return this;
    }
    dispose() {}
  }
  class LFO {
    static instances: LFO[] = [];
    min: number;
    max: number;
    disposed = false;
    connectedTo: unknown = null;
    constructor(opts?: { min?: number; max?: number }) {
      this.min = opts?.min ?? 0;
      this.max = opts?.max ?? 1;
      LFO.instances.push(this);
    }
    connect(target: unknown) {
      this.connectedTo = target;
      return this;
    }
    disconnect() {
      this.connectedTo = null;
    }
    start() {}
    stop() {}
    dispose() {
      this.disposed = true;
    }
  }
  return {
    getTransport: () => transport,
    getDestination: () => ({ volume: destVolume }),
    now: () => 0,
    Loop,
    LFO,
    __test: { transport, Loop, LFO },
  };
});

import * as Tone from 'tone';
import {
  STUTTER_DEPTH_MAX,
  createPerformanceFx,
  type StutterGateParam,
} from './performanceFx';

interface FakeLfo {
  min: number;
  max: number;
  disposed: boolean;
  connectedTo: unknown;
}

interface ToneTestHandles {
  __test: {
    transport: { bpm: { value: number } };
    Loop: { instances: Array<{ cb: (t: number) => void }> };
    LFO: { instances: FakeLfo[] };
  };
}
const T = Tone as unknown as ToneTestHandles;

/** Recording fake of MasterEffects.stutterGate.gain. */
const makeGate = () => {
  const calls: Array<{ target: number; ramp: number }> = [];
  const gate: StutterGateParam = {
    cancelScheduledValues: () => {},
    linearRampTo: (target, ramp) => calls.push({ target, ramp }),
  };
  return { gate, calls };
};

describe('performanceFx — tape stop BPM bookkeeping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    T.__test.transport.bpm.value = 100;
    T.__test.Loop.instances.length = 0;
  });

  it('restores the ORIGINAL bpm even when re-triggered mid-stop', () => {
    const fx = createPerformanceFx();
    const first = fx.startTapeStop(0.5, () => {});
    expect(first).toBe(true);
    // ramping toward 5 (mock applies instantly)
    expect(T.__test.transport.bpm.value).toBe(5);
    // long-press / double-tap: second start is refused, savedBpm untouched
    expect(fx.startTapeStop(0.5, () => {})).toBe(false);
    expect(fx.startTapeStop(0.5, () => {})).toBe(false);

    fx.resumeTapeStop(0.1);
    expect(T.__test.transport.bpm.value).toBe(100);
    expect(fx.isTapeStopActive()).toBe(false);
  });

  it('release flow: finishTapeStop restores bpm silently', () => {
    const fx = createPerformanceFx();
    fx.startTapeStop(0.25, () => {});
    vi.advanceTimersByTime(300); // onComplete fired
    fx.finishTapeStop();
    expect(T.__test.transport.bpm.value).toBe(100);
    expect(fx.isTapeStopActive()).toBe(false);
    // a follow-up tape stop works again
    expect(fx.startTapeStop(0.25, () => {})).toBe(true);
  });

  it('PANIC without any tape stop never touches bpm (no 120 heuristic)', () => {
    const fx = createPerformanceFx();
    T.__test.transport.bpm.value = 90;
    fx.panic();
    expect(T.__test.transport.bpm.value).toBe(90);
  });

  it('PANIC during a tape stop restores the saved bpm', () => {
    const fx = createPerformanceFx();
    fx.startTapeStop(0.5, () => {});
    expect(T.__test.transport.bpm.value).toBe(5);
    fx.panic();
    expect(T.__test.transport.bpm.value).toBe(100);
    expect(fx.isTapeStopActive()).toBe(false);
  });

  it('onComplete fires once per accepted trigger', () => {
    const fx = createPerformanceFx();
    const done = vi.fn();
    fx.startTapeStop(0.5, done);
    fx.startTapeStop(0.5, done); // refused
    vi.advanceTimersByTime(2000);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('performanceFx — beat repeat scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    T.__test.Loop.instances.length = 0;
  });

  it("passes the Loop's precise time through to onTick", () => {
    const fx = createPerformanceFx();
    const tick = vi.fn();
    fx.startBeatRepeat('16n', tick);
    const loop = T.__test.Loop.instances.at(-1);
    expect(loop).toBeDefined();
    loop?.cb(1.2345);
    expect(tick).toHaveBeenCalledWith(1.2345);
  });
});

describe('performanceFx — stutter gate safety', () => {
  beforeEach(() => {
    T.__test.LFO.instances.length = 0;
  });

  it('refuses to start without an audio-graph gate (no node created)', () => {
    const fx = createPerformanceFx();
    expect(fx.startStutter('16n', 1, null)).toBe(false);
    expect(T.__test.LFO.instances).toHaveLength(0);
  });

  it('drives a LINEAR 0..1 window — amplification is impossible', () => {
    const fx = createPerformanceFx();
    const { gate } = makeGate();
    expect(fx.startStutter('16n', 1, gate)).toBe(true);
    const lfo = T.__test.LFO.instances.at(-1);
    expect(lfo?.max).toBe(1); // never above unity
    // depth 1 is clamped to STUTTER_DEPTH_MAX → floor stays above silence
    expect(lfo?.min).toBeCloseTo(1 - STUTTER_DEPTH_MAX, 6);
    expect(lfo?.min).toBeGreaterThan(0);
    expect(lfo?.connectedTo).toBe(gate);
  });

  it('partial depth maps to the right gate floor', () => {
    const fx = createPerformanceFx();
    const { gate } = makeGate();
    fx.startStutter('16n', 0.3, gate);
    expect(T.__test.LFO.instances.at(-1)?.min).toBeCloseTo(0.7, 6);
  });

  it('stop releases the gate back to unity with a short fade', () => {
    const fx = createPerformanceFx();
    const { gate, calls } = makeGate();
    fx.startStutter('16n', 1, gate);
    fx.stopStutter();
    const last = calls.at(-1);
    expect(last?.target).toBe(1);
    expect(last?.ramp).toBeGreaterThan(0); // fade, not a click
    expect(last?.ramp).toBeLessThanOrEqual(0.05);
  });

  it('20× on/off cycles never accumulate live LFO nodes', () => {
    const fx = createPerformanceFx();
    const { gate } = makeGate();
    for (let i = 0; i < 20; i++) {
      fx.startStutter('16n', 1, gate);
      fx.stopStutter();
    }
    const live = T.__test.LFO.instances.filter((l) => !l.disposed);
    expect(T.__test.LFO.instances).toHaveLength(20);
    expect(live).toHaveLength(0);
  });

  it('re-trigger while active replaces the previous LFO (max 1 live)', () => {
    const fx = createPerformanceFx();
    const { gate } = makeGate();
    for (let i = 0; i < 5; i++) fx.startStutter('16n', 1, gate);
    const live = T.__test.LFO.instances.filter((l) => !l.disposed);
    expect(live).toHaveLength(1);
    fx.panic();
    expect(T.__test.LFO.instances.filter((l) => !l.disposed)).toHaveLength(0);
  });
});
