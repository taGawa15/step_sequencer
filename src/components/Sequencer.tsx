import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_BPM,
  createEmptyMutes,
  findDrumTrack,
  findSynthTrack,
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
import { useSequencerEngine } from '../hooks/useSequencerEngine';
import { usePerformanceControls } from '../hooks/usePerformanceControls';
import { useViewport } from '../hooks/useViewport';
import { AppShell } from './AppShell';
import { Transport } from './Transport';
import { StepGrid } from './StepGrid';
import { StepComponentEditor } from './StepComponentEditor';
import { PerformancePanel } from './PerformancePanel';
import { SnapshotControls } from './SnapshotControls';
import { MixerPanel } from './MixerPanel';
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
  } = usePersistedPattern();

  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [mutes, setMutes] = useState(createEmptyMutes);
  const [selection, setSelection] = useState<Selection | null>(null);

  const viewport = useViewport();

  const { isPlaying, currentStep, play, stop, panic, audioGraph } = useSequencerEngine({
    pattern,
    bpm,
    mutes,
  });

  const performance = usePerformanceControls(audioGraph);

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

  // ── Slot content ────────────────────────────────────────────────────

  const transport = (
    <Transport
      isPlaying={isPlaying}
      bpm={bpm}
      onPlay={play}
      onStop={stop}
      onBpmChange={setBpm}
      onClear={clearPattern}
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
      {/* Snapshots only embedded inside performance panel on mobile FX-tab
          and tablet/desktop right column; snapshots are also rendered alone
          on mobile SNAP tab below. */}
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

  const tabContent: Record<BottomTab, React.ReactNode> = {
    mixer: mixerPanel,
    note: noteEditor,
    step: stepEditor,
    fx: performanceContent,
    snap: snapshotsStandalone,
  };

  const noteTabEnabled = resolved?.kind === 'synth';

  return (
    <AppShell
      transport={transport}
      leftCol={viewport === 'desktop' ? mixerPanel : undefined}
      rightCol={viewport !== 'mobile' ? performanceContent : undefined}
      centerCol={
        <StepGrid
          pattern={pattern}
          mutes={mutes}
          currentStep={currentStep}
          selection={selection}
          onDrumClick={handleDrumClick}
          onSynthClick={handleSynthClick}
          onToggleMute={handleToggleMute}
        />
      }
      bottom={
        <BottomEditPanel
          viewport={viewport}
          noteTabEnabled={noteTabEnabled || !selection}
          tabContent={tabContent}
        />
      }
    />
  );
};
