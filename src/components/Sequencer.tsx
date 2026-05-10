import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BPM,
  MAX_BPM,
  MIN_BPM,
  clamp,
  createEmptyMutes,
  findDrumTrack,
  findSynthTrack,
  type LoopLengthType,
} from '../constants';
import { DEFAULT_SCALE_ID, getScale } from '../scales';
import type {
  DrumStep,
  DrumTrackId,
  ResolvedSelection,
  Selection,
  StepComponents,
  SynthStep,
  SynthTrackId,
  TrackId,
} from '../types';
import { usePersistedPattern } from '../hooks/usePersistedPattern';
import {
  useSequencerEngine,
  type SampleAssignmentMap,
} from '../hooks/useSequencerEngine';
import { usePerformanceControls } from '../hooks/usePerformanceControls';
import { useViewport } from '../hooks/useViewport';
import { useLoopLength } from '../hooks/useLoopLength';
import { useTimelineSlots } from '../hooks/useTimelineSlots';
import { useMicSampler } from '../hooks/useMicSampler';
import { useKeyboardShortcuts, type ShortcutHandlerMap } from '../hooks/useKeyboardShortcuts';
import {
  createSamplePlayerFromUrl,
  type SamplePlayer,
} from '../audio/samplePlayer';
import type { ProjectSnapshot, TimelineSlotId } from '../types/timeline';
import { AppShell } from './AppShell';
import { Transport } from './Transport';
import { StepGrid } from './StepGrid';
import { StepComponentEditor } from './StepComponentEditor';
import { PerformancePanel } from './PerformancePanel';
import { SnapshotControls } from './SnapshotControls';
import { MixerPanel } from './MixerPanel';
import { LoopControls } from './LoopControls';
import { TimelinePanel } from './TimelinePanel';
import { MicSamplingPanel } from './MicSamplingPanel';
import { KeyboardHelpModal } from './KeyboardHelpModal';
import { BottomEditPanel, type BottomTab } from './BottomEditPanel';

export const Sequencer = () => {
  const {
    pattern,
    toggleDrumStep,
    updateDrumStep,
    toggleSynthStep,
    updateSynthStep,
    setSynthActive,
    updateStepComponents,
    resetStepComponents,
    clearPattern,
    replacePattern,
  } = usePersistedPattern();

  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [mutes, setMutes] = useState(createEmptyMutes);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const viewport = useViewport();
  const loop = useLoopLength();
  const sampler = useMicSampler();

  // ── Sample players ─────────────────────────────────────────────────
  // SamplePlayers are created once per recorded sample and connected to
  // the master input. The engine uses the assignment map to choose
  // sample vs built-in voice on each step.
  const playersRef = useRef<Map<string, SamplePlayer>>(new Map());
  const [playersVersion, setPlayersVersion] = useState(0);

  // Need audioGraph from the engine — declared before using.
  // We pass sampleAssignments below; resolve graph first via a placeholder.
  const sampleAssignments = useMemo<SampleAssignmentMap>(() => {
    void playersVersion; // re-run when players load
    const map: SampleAssignmentMap = {};
    for (const s of sampler.samples) {
      if (s.assignedTo) {
        const player = playersRef.current.get(s.id);
        if (player && player.ready) {
          map[s.assignedTo] = player;
        }
      }
    }
    return map;
  }, [sampler.samples, playersVersion]);

  const { isPlaying, currentStep, play, stop, panic, audioGraph } = useSequencerEngine({
    pattern,
    bpm,
    mutes,
    loopLength: loop.loopLength,
    sampleAssignments,
  });

  const performance = usePerformanceControls(audioGraph);

  // ── Sync sample players with audioGraph + sample list ─────────────
  useEffect(() => {
    if (!audioGraph) return;
    const dest = audioGraph.master.masterInput;
    const validIds = new Set(sampler.samples.map((s) => s.id));
    let changed = false;

    // Dispose removed
    for (const [id, player] of Array.from(playersRef.current.entries())) {
      if (!validIds.has(id)) {
        player.dispose();
        playersRef.current.delete(id);
        changed = true;
      }
    }

    // Create newly added
    for (const s of sampler.samples) {
      if (!playersRef.current.has(s.id)) {
        // Mark a placeholder so we don't double-create while async load runs
        const sentinel = { ready: false } as SamplePlayer;
        playersRef.current.set(s.id, sentinel);
        createSamplePlayerFromUrl(s.url, dest)
          .then((player) => {
            playersRef.current.set(s.id, player);
            player.setGain(s.gain);
            player.setPitch(s.pitch);
            setPlayersVersion((v) => v + 1);
          })
          .catch(() => {
            playersRef.current.delete(s.id);
          });
        changed = true;
      } else {
        // Sync gain/pitch on existing
        const player = playersRef.current.get(s.id);
        if (player && player.ready) {
          player.setGain(s.gain);
          player.setPitch(s.pitch);
        }
      }
    }
    if (changed) setPlayersVersion((v) => v + 1);
  }, [sampler.samples, audioGraph]);

  // ── Selection / step handlers (existing) ──────────────────────────
  const handleToggleMute = useCallback((id: TrackId) => {
    setMutes((m) => ({ ...m, [id]: !m[id] }));
  }, []);

  const handleDrumClick = useCallback(
    (trackId: DrumTrackId, idx: number) => {
      toggleDrumStep(trackId, idx);
      setSelection({ kind: 'drum', trackId, stepIndex: idx });
    },
    [toggleDrumStep],
  );

  const handleSynthClick = useCallback(
    (trackId: SynthTrackId, idx: number) => {
      setSelection({ kind: 'synth', trackId, stepIndex: idx });
      if (!pattern.synths[trackId][idx].active) {
        setSynthActive(trackId, idx, true);
      }
    },
    [pattern.synths, setSynthActive],
  );

  const handleUpdateDrumStep = useCallback(
    (patch: Partial<DrumStep>) => {
      if (selection?.kind !== 'drum') return;
      updateDrumStep(selection.trackId, selection.stepIndex, patch);
    },
    [selection, updateDrumStep],
  );

  const handleUpdateSynthStep = useCallback(
    (patch: Partial<SynthStep>) => {
      if (selection?.kind !== 'synth') return;
      updateSynthStep(selection.trackId, selection.stepIndex, patch);
    },
    [selection, updateSynthStep],
  );

  const handleUpdateComponents = useCallback(
    (patch: Partial<StepComponents>) => {
      if (!selection) return;
      updateStepComponents(selection, patch);
    },
    [selection, updateStepComponents],
  );

  const handleResetComponents = useCallback(() => {
    if (!selection) return;
    resetStepComponents(selection);
  }, [selection, resetStepComponents]);

  const handleToggleActiveOnSelected = useCallback(() => {
    if (!selection) return;
    if (selection.kind === 'drum') {
      toggleDrumStep(selection.trackId, selection.stepIndex);
    } else {
      toggleSynthStep(selection.trackId, selection.stepIndex);
    }
  }, [selection, toggleDrumStep, toggleSynthStep]);

  const resolved = useMemo<ResolvedSelection | null>(() => {
    if (!selection) return null;
    if (selection.kind === 'drum') {
      return {
        kind: 'drum',
        trackId: selection.trackId,
        stepIndex: selection.stepIndex,
        step: pattern.drums[selection.trackId][selection.stepIndex],
        track: findDrumTrack(selection.trackId),
      };
    }
    return {
      kind: 'synth',
      trackId: selection.trackId,
      stepIndex: selection.stepIndex,
      step: pattern.synths[selection.trackId][selection.stepIndex],
      track: findSynthTrack(selection.trackId),
    };
  }, [selection, pattern]);

  // ── Timeline integration ──────────────────────────────────────────
  const getCurrentSnapshot = useCallback<() => ProjectSnapshot>(
    () => ({
      bpm,
      loopLength: loop.loopLength,
      pattern: JSON.parse(JSON.stringify(pattern)) as typeof pattern,
      mutes: { ...mutes },
      performance: JSON.parse(
        JSON.stringify(performance.state),
      ) as typeof performance.state,
      snapshots: JSON.parse(
        JSON.stringify(performance.snapshots),
      ) as typeof performance.snapshots,
    }),
    [bpm, loop.loopLength, pattern, mutes, performance.state, performance.snapshots],
  );

  const applySnapshot = useCallback(
    (snap: ProjectSnapshot) => {
      setBpm(snap.bpm);
      loop.setLoopLength(snap.loopLength);
      replacePattern(snap.pattern);
      setMutes(snap.mutes);
      performance.replaceState(snap.performance);
      performance.replaceSnapshots(snap.snapshots);
    },
    [loop, performance, replacePattern],
  );

  const timeline = useTimelineSlots({ getCurrentSnapshot, applySnapshot });

  // ── Keyboard shortcuts ────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (isPlaying) stop();
    else void play();
  }, [isPlaying, play, stop]);

  const handlers = useMemo<ShortcutHandlerMap>(
    () => ({
      'transport.toggle': togglePlay,
      'transport.panic': panic,
      'transport.toggleSelected': handleToggleActiveOnSelected,
      'bpm.up': () => setBpm((b) => clamp(b + 1, MIN_BPM, MAX_BPM)),
      'bpm.down': () => setBpm((b) => clamp(b - 1, MIN_BPM, MAX_BPM)),
      'bpm.up5': () => setBpm((b) => clamp(b + 5, MIN_BPM, MAX_BPM)),
      'bpm.down5': () => setBpm((b) => clamp(b - 5, MIN_BPM, MAX_BPM)),
      'page.prev': () => loop.setStepPage(Math.max(0, loop.stepPage - 1)),
      'page.next': () =>
        loop.setStepPage(Math.min(loop.totalPages - 1, loop.stepPage + 1)),
      'loop.x2': () => loop.setLoopLength(2),
      'loop.x4': () => loop.setLoopLength(4),
      'loop.x8': () => loop.setLoopLength(8),
      'loop.x16': () => loop.setLoopLength(16),
      'loop.x32': () => loop.setLoopLength(32),
      'loop.x64': () => loop.setLoopLength(64),
      'track.1': () => setSelection({ kind: 'drum', trackId: 'kick', stepIndex: selection?.stepIndex ?? 0 }),
      'track.2': () => setSelection({ kind: 'drum', trackId: 'snare', stepIndex: selection?.stepIndex ?? 0 }),
      'track.3': () => setSelection({ kind: 'drum', trackId: 'closedHat', stepIndex: selection?.stepIndex ?? 0 }),
      'track.4': () => setSelection({ kind: 'drum', trackId: 'openHat', stepIndex: selection?.stepIndex ?? 0 }),
      'track.5': () => setSelection({ kind: 'drum', trackId: 'clap', stepIndex: selection?.stepIndex ?? 0 }),
      'track.6': () => setSelection({ kind: 'drum', trackId: 'perc', stepIndex: selection?.stepIndex ?? 0 }),
      'track.7': () => setSelection({ kind: 'synth', trackId: 'bass', stepIndex: selection?.stepIndex ?? 0 }),
      'track.8': () => setSelection({ kind: 'synth', trackId: 'lead', stepIndex: selection?.stepIndex ?? 0 }),
      'timeline.select1': () => timeline.select('1'),
      'timeline.select2': () => timeline.select('2'),
      'timeline.select3': () => timeline.select('3'),
      'timeline.select4': () => timeline.select('4'),
      'timeline.load1': () => timeline.load('1'),
      'timeline.load2': () => timeline.load('2'),
      'timeline.load3': () => timeline.load('3'),
      'timeline.load4': () => timeline.load('4'),
      'timeline.save': () => timeline.save(),
      'kill.low': () => performance.setKill('low', !performance.state.kill.low),
      'kill.mid': () => performance.setKill('mid', !performance.state.kill.mid),
      'kill.high': () => performance.setKill('high', !performance.state.kill.high),
      'fx.filterReset': () => performance.setFilterSweep(0),
      'fx.delayToggle': () =>
        performance.setDelay({ enabled: !performance.state.delay.enabled }),
      'fx.reverbToggle': () =>
        performance.setReverb({ enabled: !performance.state.reverb.enabled }),
      'sample.recordToggle': sampler.toggleRecording,
      'help.toggle': () => setHelpOpen((v) => !v),
    }),
    [
      togglePlay,
      panic,
      handleToggleActiveOnSelected,
      loop,
      timeline,
      performance,
      sampler.toggleRecording,
      selection?.stepIndex,
    ],
  );

  useKeyboardShortcuts(handlers);

  // ── Slot content for AppShell ─────────────────────────────────────
  const transport = (
    <Transport
      isPlaying={isPlaying}
      bpm={bpm}
      onPlay={play}
      onStop={stop}
      onBpmChange={setBpm}
      onClear={clearPattern}
      onOpenHelp={() => setHelpOpen(true)}
      recording={sampler.recording}
    />
  );

  const mixerPanel = (
    <MixerPanel
      sends={performance.state.trackSends}
      mutes={mutes}
      onSetSend={performance.setTrackSend}
      onToggleMute={handleToggleMute}
    />
  );

  const performanceContent = (
    <PerformancePanel
      state={performance.state}
      onSetMasterVolume={performance.setMasterVolume}
      onSetFilterSweep={performance.setFilterSweep}
      onSetFilterResonance={performance.setFilterResonance}
      onSetKill={performance.setKill}
      onSetDelay={performance.setDelay}
      onSetReverb={performance.setReverb}
      onSetCompressor={performance.setCompressor}
      onPanic={panic}
    >
      {viewport !== 'mobile' && (
        <SnapshotControls
          snapshots={performance.snapshots}
          morphTime={performance.morphTime}
          onSetMorphTime={performance.setMorphTime}
          onRecall={performance.recallSnapshot}
          onSave={performance.saveSnapshot}
          onClear={performance.clearSnapshot}
        />
      )}
    </PerformancePanel>
  );

  const noteEditor = (
    <StepComponentEditor
      resolved={resolved}
      mode="note"
      scale={getScale(DEFAULT_SCALE_ID)}
      onUpdateDrumStep={handleUpdateDrumStep}
      onUpdateSynthStep={handleUpdateSynthStep}
      onUpdateComponents={handleUpdateComponents}
      onResetComponents={handleResetComponents}
      onToggleActive={handleToggleActiveOnSelected}
    />
  );

  const stepEditor = (
    <StepComponentEditor
      resolved={resolved}
      mode="step"
      scale={getScale(DEFAULT_SCALE_ID)}
      onUpdateDrumStep={handleUpdateDrumStep}
      onUpdateSynthStep={handleUpdateSynthStep}
      onUpdateComponents={handleUpdateComponents}
      onResetComponents={handleResetComponents}
      onToggleActive={handleToggleActiveOnSelected}
    />
  );

  const snapshotsStandalone = (
    <div style={{ padding: '16px' }}>
      <SnapshotControls
        snapshots={performance.snapshots}
        morphTime={performance.morphTime}
        onSetMorphTime={performance.setMorphTime}
        onRecall={performance.recallSnapshot}
        onSave={performance.saveSnapshot}
        onClear={performance.clearSnapshot}
      />
    </div>
  );

  const timelinePanel = (
    <TimelinePanel
      timelines={timeline.timelines}
      activeId={timeline.activeId}
      confirmLoadGuard={timeline.confirmLoadGuard}
      onSelect={(id: TimelineSlotId) => timeline.select(id)}
      onSave={() => timeline.save()}
      onLoad={() => timeline.load()}
      onDuplicate={timeline.duplicate}
      onClear={() => timeline.clear()}
      onSetConfirmGuard={timeline.setConfirmLoadGuard}
    />
  );

  const samplePanel = (
    <MicSamplingPanel
      permission={sampler.permission}
      recording={sampler.recording}
      maxRecordSec={sampler.maxRecordSec}
      samples={sampler.samples}
      error={sampler.error}
      onSetMaxRecordSec={sampler.setMaxRecordSec}
      onToggleRecord={sampler.toggleRecording}
      onRename={sampler.renameSample}
      onUpdate={sampler.updateSample}
      onDelete={sampler.deleteSample}
      onAssign={sampler.assignToTrack}
    />
  );

  const tabContent: Record<BottomTab, React.ReactNode> = {
    mixer: mixerPanel,
    note: noteEditor,
    step: stepEditor,
    fx: performanceContent,
    snap: snapshotsStandalone,
    timeline: timelinePanel,
    sample: samplePanel,
  };

  const noteTabEnabled = resolved?.kind === 'synth';

  return (
    <>
      <AppShell
        transport={transport}
        leftCol={viewport === 'desktop' ? mixerPanel : undefined}
        rightCol={viewport !== 'mobile' ? performanceContent : undefined}
        centerCol={
          <>
            <LoopControls
              loopLength={loop.loopLength}
              stepPage={loop.stepPage}
              totalPages={loop.totalPages}
              currentStep={currentStep}
              onSetLoopLength={(l: LoopLengthType) => loop.setLoopLength(l)}
              onSetStepPage={loop.setStepPage}
            />
            <StepGrid
              pattern={pattern}
              mutes={mutes}
              currentStep={currentStep}
              selection={selection}
              stepPage={loop.stepPage}
              loopLength={loop.loopLength}
              onDrumClick={handleDrumClick}
              onSynthClick={handleSynthClick}
              onToggleMute={handleToggleMute}
            />
          </>
        }
        bottom={
          <BottomEditPanel
            viewport={viewport}
            noteTabEnabled={noteTabEnabled || !selection}
            tabContent={tabContent}
          />
        }
      />
      <KeyboardHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {/* Always-visible REC indicator overlay */}
      {sampler.recording && (
        <div
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: 'var(--bg)',
            padding: '6px 18px',
            fontSize: 11,
            letterSpacing: '0.32em',
            zIndex: 50,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            pointerEvents: 'none',
          }}
        >
          ● REC
        </div>
      )}
    </>
  );
};
