import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { DRUM_TRACKS, STEP_COUNT, SYNTH_TRACKS } from '../constants';
import type {
  DrumStep,
  MuteMap,
  Pattern,
  StepComponents,
  SynthStep,
  TrackId,
} from '../types';
import {
  type PlockParams,
} from '../audio/instruments';
import { createAudioGraph, type AudioGraph } from '../audio/createAudioGraph';

// ──────────────────────────────────────────────────────────────────────────
// Public step event — emitted whenever a voice fires.
// MVP4 (video sync / MIDI) can subscribe via `onStepEvent`.
// ──────────────────────────────────────────────────────────────────────────

export interface StepEvent {
  trackId: TrackId;
  stepIndex: number;
  time: number;
  repeatIndex: number;
  repeat: number;
  velocity: number;
  note: string | null;
}

interface Args {
  pattern: Pattern;
  bpm: number;
  mutes: MuteMap;
  onStepEvent?: (event: StepEvent) => void;
}

const componentsToPlocks = (c: StepComponents): PlockParams => ({
  filterCutoff: c.filterCutoff,
  pan: c.pan,
  pitchOffset: c.pitchOffset,
});

const passesProbability = (probability: number): boolean => {
  if (probability >= 100) return true;
  if (probability <= 0) return false;
  return Math.random() < probability / 100;
};

interface FireRepeatsArgs {
  stepLen: number;
  baseAudioTime: number;
  repeat: number;
  onFire: (time: number, repeatIndex: number) => void;
}

const fireRepeats = ({ stepLen, baseAudioTime, repeat, onFire }: FireRepeatsArgs) => {
  if (repeat <= 1) {
    onFire(baseAudioTime, 0);
    return;
  }
  const interval = stepLen / repeat;
  for (let r = 0; r < repeat; r++) onFire(baseAudioTime + r * interval, r);
};

// ──────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────

export const useSequencerEngine = ({ pattern, bpm, mutes, onStepEvent }: Args) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  // Exposed as state so consumers re-render once the audio graph is ready
  // and they can hand it to usePerformanceControls / TrackSendControls / etc.
  const [audioGraph, setAudioGraph] = useState<AudioGraph | null>(null);

  const sequenceRef = useRef<Tone.Sequence<number> | null>(null);
  const patternRef = useRef(pattern);
  const mutesRef = useRef(mutes);
  const onStepEventRef = useRef(onStepEvent);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);
  useEffect(() => {
    mutesRef.current = mutes;
  }, [mutes]);
  useEffect(() => {
    onStepEventRef.current = onStepEvent;
  }, [onStepEvent]);

  // Build the audio graph + sequence once.
  useEffect(() => {
    const graph = createAudioGraph();
    setAudioGraph(graph);

    const seq = new Tone.Sequence<number>(
      (time, stepIndex) => {
        const p = patternRef.current;
        const m = mutesRef.current;
        const stepLen = Tone.Time('16n').toSeconds();

        for (const t of DRUM_TRACKS) {
          if (m[t.id]) continue;
          const step: DrumStep = p.drums[t.id][stepIndex];
          if (!step.active) continue;
          if (!passesProbability(step.components.probability)) continue;

          fireRepeats({
            stepLen,
            baseAudioTime: time + step.components.microTiming / 1000,
            repeat: step.components.repeat,
            onFire: (fireTime, repeatIndex) => {
              graph.voices.drums[t.id].trigger({
                time: fireTime,
                velocity: step.velocity,
                plocks: componentsToPlocks(step.components),
              });
              onStepEventRef.current?.({
                trackId: t.id,
                stepIndex,
                time: fireTime,
                repeatIndex,
                repeat: step.components.repeat,
                velocity: step.velocity,
                note: null,
              });
            },
          });
        }

        for (const t of SYNTH_TRACKS) {
          if (m[t.id]) continue;
          const step: SynthStep = p.synths[t.id][stepIndex];
          if (!step.active) continue;
          if (!passesProbability(step.components.probability)) continue;

          fireRepeats({
            stepLen,
            baseAudioTime: time + step.components.microTiming / 1000,
            repeat: step.components.repeat,
            onFire: (fireTime, repeatIndex) => {
              graph.voices.synths[t.id].trigger({
                note: step.note,
                duration: step.duration,
                time: fireTime,
                velocity: step.velocity,
                plocks: componentsToPlocks(step.components),
              });
              onStepEventRef.current?.({
                trackId: t.id,
                stepIndex,
                time: fireTime,
                repeatIndex,
                repeat: step.components.repeat,
                velocity: step.velocity,
                note: step.note,
              });
            },
          });
        }

        Tone.getDraw().schedule(() => setCurrentStep(stepIndex), time);
      },
      Array.from({ length: STEP_COUNT }, (_, i) => i),
      '16n',
    );
    seq.start(0);
    sequenceRef.current = seq;

    return () => {
      seq.stop();
      seq.dispose();
      graph.dispose();
      sequenceRef.current = null;
      setAudioGraph(null);
    };
  }, []);

  // Keep transport BPM in sync with state.
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  const play = useCallback(async () => {
    // iOS Safari hardening — the AudioContext must be resumed during the
    // user gesture frame. Tone.start() does this internally, but on some
    // iOS versions we also need to call resume() on the raw context. Doing
    // both is harmless on other browsers.
    try {
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (rawCtx && rawCtx.state !== 'running') {
        await rawCtx.resume();
      }
    } catch {
      /* ignore */
    }
    await Tone.start();

    // Warm up the output: schedule a silent gain change to make iOS commit
    // the audio graph before the first real trigger fires.
    try {
      const dest = Tone.getDestination();
      const now = Tone.now();
      dest.volume.setValueAtTime(dest.volume.value, now);
    } catch {
      /* ignore */
    }

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
    transport.start();
    setIsPlaying(true);
  }, [bpm]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    setCurrentStep(-1);
    setIsPlaying(false);
  }, []);

  /** Stop everything immediately — transport, voices, aux tails. */
  const panic = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    setCurrentStep(-1);
    setIsPlaying(false);
    audioGraph?.voices.panicAll();
    audioGraph?.master.panic();
  }, [audioGraph]);

  return { isPlaying, currentStep, play, stop, panic, audioGraph };
};
