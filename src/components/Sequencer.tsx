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
import { useTimelineClipboard } from '../hooks/useTimelineClipboard';
import { useNoteEditor } from '../hooks/useNoteEditor';
import { usePerformanceFx } from '../hooks/usePerformanceFx';
import { useKeyboardShortcuts, type ShortcutHandlerMap } from '../hooks/useKeyboardShortcuts';
import {
  createPendingSamplePlayer,
  createSamplePlayerFromUrl,
  type SamplePlayer,
} from '../audio/samplePlayer';
import { SWING_DEFAULT, clampSwing } from '../utils/swing';
import { DebugPanel } from './DebugPanel';
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
import { CopyPasteControls } from './CopyPasteControls';
import { PerformanceFxPanel } from './PerformanceFxPanel';
import { BottomEditPanel, type BottomTab } from './BottomEditPanel';
import { LOOP_LENGTHS, DRUM_TRACKS, SYNTH_TRACKS } from '../constants';
import { NEUTRAL_PLOCKS } from '../audio/instruments';
import * as Tone from 'tone';

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
  const [swing, setSwing] = useState(SWING_DEFAULT);
  const [mutes, setMutes] = useState(createEmptyMutes);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const viewport = useViewport();
  const loop = useLoopLength();
  const sampler = useMicSampler();
  const noteUI = useNoteEditor();

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

  const {
    isPlaying,
    currentStep,
    play,
    stop,
    panic,
    audioGraph,
    lastFiredRef,
  } = useSequencerEngine({
    pattern,
    bpm,
    swing,
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

    // Dispose removed. Pending placeholders implement a no-op dispose,
    // so deleting a sample mid-load is safe (used to TypeError → white
    // screen with the old `{ ready:false }` cast).
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
        // Placeholder so we don't double-create while the async load runs.
        const sentinel = createPendingSamplePlayer();
        playersRef.current.set(s.id, sentinel);
        createSamplePlayerFromUrl(s.url, dest)
          .then((player) => {
            // The sample may have been deleted while loading — then the
            // freshly created player must be torn down, not re-inserted.
            if (playersRef.current.get(s.id) !== sentinel) {
              player.dispose();
              return;
            }
            playersRef.current.set(s.id, player);
            player.setGain(s.gain);
            player.setPitch(s.pitch);
            player.setTrim(s.trimStart, s.trimEnd);
            setPlayersVersion((v) => v + 1);
          })
          .catch(() => {
            if (playersRef.current.get(s.id) === sentinel) {
              playersRef.current.delete(s.id);
            }
          });
        changed = true;
      } else {
        // Sync gain/pitch/trim on existing
        const player = playersRef.current.get(s.id);
        if (player && player.ready) {
          player.setGain(s.gain);
          player.setPitch(s.pitch);
          player.setTrim(s.trimStart, s.trimEnd);
        }
      }
    }
    if (changed) setPlayersVersion((v) => v + 1);
  }, [sampler.samples, audioGraph]);

  // Unmount: tear down every live sample player.
  useEffect(
    () => () => {
      for (const player of playersRef.current.values()) player.dispose();
      playersRef.current.clear();
    },
    [],
  );

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
      // setSynthActive no-ops when already active, so this callback needs
      // no pattern dependency — keeping it stable lets StepGrid's memoized
      // buttons skip re-rendering on every pattern/currentStep change.
      setSynthActive(trackId, idx, true);
    },
    [setSynthActive],
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
  // NOTE: mic-sample assignments are deliberately NOT captured — sample
  // blobs are device-local IndexedDB data (see types/timeline.ts).
  const getCurrentSnapshot = useCallback<() => ProjectSnapshot>(
    () => ({
      bpm,
      swing,
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
    [bpm, swing, loop.loopLength, pattern, mutes, performance],
  );

  const applySnapshot = useCallback(
    (snap: ProjectSnapshot) => {
      setBpm(snap.bpm);
      setSwing(clampSwing(snap.swing));
      loop.setLoopLength(snap.loopLength);
      replacePattern(snap.pattern);
      setMutes(snap.mutes);
      performance.replaceState(snap.performance);
      performance.replaceSnapshots(snap.snapshots);
    },
    [loop, performance, replacePattern],
  );

  const timeline = useTimelineSlots({ getCurrentSnapshot, applySnapshot });

  // ── Step clipboard (copy / paste / repeat fill / undo) ────────────
  const clipboard = useTimelineClipboard({
    getPattern: () => pattern,
    getLoopLength: () => loop.loopLength,
    replacePattern,
    setLoopLength: loop.setLoopLength,
    getSelectedTrack: () => (selection ? selection.trackId : null),
  });

  // Selected track display name for the clipboard scope toggle
  const selectedTrackName = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'drum') return findDrumTrack(selection.trackId).label;
    return findSynthTrack(selection.trackId).label;
  }, [selection]);

  // Helper to step through LOOP_LENGTHS for [/] keys
  const stepLoop = useCallback(
    (direction: -1 | 1) => {
      const idx = LOOP_LENGTHS.indexOf(loop.loopLength);
      const next = LOOP_LENGTHS[idx + direction];
      if (next !== undefined) loop.setLoopLength(next);
    },
    [loop],
  );

  // ── Performance FX (Beat Repeat / Stutter / Tape / Throw / Freeze / Crush)
  // Beat Repeat re-fires each track's LAST ACTUALLY-FIRED hit (engine's
  // lastFiredRef), windowed to the last two beats. Repeating the current
  // grid cell instead is silent on sparse patterns — the old "FX does
  // nothing" complaint. `time` is the Tone.Loop's precise scheduled time
  // so retriggers stay on the grid; +1ms keeps the retrigger's envelope
  // cancel from eating a sequencer note scheduled at exactly that time.
  const onBeatRepeatTick = useCallback(
    (time: number) => {
      if (!audioGraph) return;
      const fireTime = time + 0.001;
      const windowSec = Tone.Time('2n').toSeconds(); // last 2 beats
      const fired = lastFiredRef.current;
      for (const t of DRUM_TRACKS) {
        if (mutes[t.id]) continue;
        const hit = fired.drums[t.id];
        if (!hit || time - hit.at > windowSec) continue;
        audioGraph.voices.drums[t.id].trigger({
          time: fireTime,
          velocity: hit.velocity,
          plocks: NEUTRAL_PLOCKS,
        });
      }
      for (const t of SYNTH_TRACKS) {
        if (mutes[t.id]) continue;
        const hit = fired.synths[t.id];
        if (!hit || time - hit.at > windowSec) continue;
        audioGraph.voices.synths[t.id].trigger({
          note: hit.note,
          duration: hit.duration,
          time: fireTime,
          velocity: hit.velocity,
          plocks: NEUTRAL_PLOCKS,
        });
      }
    },
    [audioGraph, lastFiredRef, mutes],
  );

  // Tape Stop "release" completion stops the transport (then the FX layer
  // silently restores the saved BPM) — never leaves a 5 BPM crawl.
  const perfFx = usePerformanceFx({
    audioGraph,
    onBeatRepeatTick,
    onTapeRelease: stop,
  });

  // Combined panic — original engine panic + FX panic.
  const panicAll = useCallback(() => {
    perfFx.panic();
    panic();
  }, [panic, perfFx]);

  // Note preview: short non-step trigger of the synth voice on note change.
  const handlePreviewNote = useCallback(
    (trackId: 'bass' | 'lead', note: string) => {
      if (!audioGraph) return;
      try {
        audioGraph.voices.synths[trackId].trigger({
          note,
          duration: '8n',
          time: Tone.now() + 0.01,
          velocity: 0.4,
          plocks: NEUTRAL_PLOCKS,
        });
      } catch {
        /* ignore failed previews (e.g. AC suspended) */
      }
    },
    [audioGraph],
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (isPlaying) stop();
    else void play();
  }, [isPlaying, play, stop]);

  const handlers = useMemo<ShortcutHandlerMap>(
    () => ({
      'transport.toggle': togglePlay,
      'transport.panic': panicAll,
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
      // Loop nav via brackets
      'loop.shorter': () => stepLoop(-1),
      'loop.longer': () => stepLoop(1),
      // Clipboard
      'clipboard.copy': () => clipboard.copy('all'),
      'clipboard.paste': () => clipboard.paste(0, 'replace'),
      'clipboard.pasteRepeat': () => clipboard.pasteRepeatFill(),
      'clipboard.duplicate': () => clipboard.duplicateAppend(),
      'clipboard.undo': () => clipboard.undo(),
      // Performance FX
      'fx.beatRepeat': perfFx.toggleBeatRepeat,
      'fx.stutter': perfFx.toggleStutter,
      'fx.tapeStop': perfFx.triggerTapeStop,
    }),
    [
      togglePlay,
      panicAll,
      handleToggleActiveOnSelected,
      loop,
      timeline,
      performance,
      sampler.toggleRecording,
      selection?.stepIndex,
      stepLoop,
      clipboard,
      perfFx,
    ],
  );

  // Suspend every global shortcut while the Help modal is open — the
  // modal owns Esc, so closing Help can never fire PANIC (M5).
  useKeyboardShortcuts(handlers, { suspended: helpOpen });

  // ── Slot content for AppShell ─────────────────────────────────────
  const transport = (
    <Transport
      isPlaying={isPlaying}
      bpm={bpm}
      swing={swing}
      onPlay={play}
      onStop={stop}
      onBpmChange={setBpm}
      onSwingChange={(v) => setSwing(clampSwing(v))}
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
      onPanic={panicAll}
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
      noteRoot={noteUI.root}
      noteScale={noteUI.scale}
      noteScaleLock={noteUI.scaleLock}
      onSetNoteRoot={noteUI.setRoot}
      onSetNoteScale={noteUI.setScale}
      onToggleNoteScaleLock={noteUI.toggleScaleLock}
      onPreviewNote={handlePreviewNote}
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
      noteRoot={noteUI.root}
      noteScale={noteUI.scale}
      noteScaleLock={noteUI.scaleLock}
      onSetNoteRoot={noteUI.setRoot}
      onSetNoteScale={noteUI.setScale}
      onToggleNoteScaleLock={noteUI.toggleScaleLock}
      onUpdateDrumStep={handleUpdateDrumStep}
      onUpdateSynthStep={handleUpdateSynthStep}
      onUpdateComponents={handleUpdateComponents}
      onResetComponents={handleResetComponents}
      onToggleActive={handleToggleActiveOnSelected}
    />
  );

  const perfFxPanel = (
    <PerformanceFxPanel
      state={perfFx.state}
      beatActive={perfFx.beatActive}
      stutterActive={perfFx.stutterActive}
      tapeActive={perfFx.tapeActive}
      throwActive={perfFx.throwActive}
      freezeActive={perfFx.freezeActive}
      crushActive={perfFx.crushActive}
      onSetBeatRate={perfFx.setBeatRepeatRate}
      onSetBeatMode={perfFx.setBeatRepeatMode}
      onToggleBeat={perfFx.toggleBeatRepeat}
      onStartBeat={perfFx.startBeatRepeat}
      onStopBeat={perfFx.stopBeatRepeat}
      onSetStutterRate={perfFx.setStutterRate}
      onSetStutterDepth={perfFx.setStutterDepth}
      onSetStutterMode={perfFx.setStutterMode}
      onToggleStutter={perfFx.toggleStutter}
      onStartStutter={perfFx.startStutter}
      onStopStutter={perfFx.stopStutter}
      onSetTapeTime={perfFx.setTapeStopTime}
      onSetTapeMode={perfFx.setTapeStopMode}
      onTriggerTape={perfFx.triggerTapeStop}
      onSetThrowMode={perfFx.setThrowMode}
      onToggleThrow={perfFx.toggleThrow}
      onStartThrow={perfFx.startThrow}
      onStopThrow={perfFx.stopThrow}
      onSetFreezeMode={perfFx.setFreezeMode}
      onToggleFreeze={perfFx.toggleFreeze}
      onStartFreeze={perfFx.startFreeze}
      onStopFreeze={perfFx.stopFreeze}
      onSetCrushMode={perfFx.setCrushMode}
      onToggleCrush={perfFx.toggleCrush}
      onStartCrush={perfFx.startCrush}
      onStopCrush={perfFx.stopCrush}
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
      invalidSlots={timeline.invalidSlots}
      onSelect={(id: TimelineSlotId) => timeline.select(id)}
      onSave={() => timeline.save()}
      onLoad={() => timeline.load()}
      onDuplicate={timeline.duplicate}
      onClear={() => timeline.clear()}
      onSetConfirmGuard={timeline.setConfirmLoadGuard}
      clipboardSlot={
        <CopyPasteControls
          clipboard={clipboard.clipboard}
          canUndo={clipboard.canUndo}
          selectedTrackName={selectedTrackName}
          onCopy={clipboard.copy}
          onPaste={clipboard.paste}
          onUndo={clipboard.undo}
        />
      }
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

  // FX status snapshot for the Debug Panel — one row per performance FX
  // so "UI says on, audio says nothing" can be diagnosed at a glance.
  const fxStatus = [
    {
      name: 'FILTER SWEEP',
      active: performance.state.filterSweep !== 0,
      detail:
        performance.state.filterSweep === 0
          ? 'open'
          : `${performance.state.filterSweep > 0 ? 'HP' : 'LP'} ${Math.abs(performance.state.filterSweep)} / Q ${performance.state.filterResonance.toFixed(1)}`,
      last: null as number | null,
    },
    {
      name: 'BEAT REPEAT',
      active: perfFx.beatActive,
      detail: perfFx.state.beatRepeatRate,
      last: perfFx.lastTrigger.beat,
    },
    {
      name: 'STUTTER',
      active: perfFx.stutterActive,
      detail: `${perfFx.state.stutterRate} depth ${Math.round(perfFx.state.stutterDepth * 100)}%`,
      last: perfFx.lastTrigger.stutter,
    },
    {
      name: 'TAPE STOP',
      active: perfFx.tapeActive,
      detail: `${perfFx.state.tapeStopTime}s ${perfFx.state.tapeStopMode}`,
      last: perfFx.lastTrigger.tape,
    },
    {
      name: 'DELAY THROW',
      active: perfFx.throwActive,
      detail: 'send 0.5',
      last: perfFx.lastTrigger.throw,
    },
    {
      name: 'REVERB FREEZE',
      active: perfFx.freezeActive,
      detail: 'fb 0.85',
      last: perfFx.lastTrigger.freeze,
    },
    {
      name: 'BIT CRUSH',
      active: perfFx.crushActive,
      detail: 'wet 0.6 / 4bit',
      last: perfFx.lastTrigger.crush,
    },
    {
      name: 'DELAY (master)',
      active: performance.state.delay.enabled,
      detail: `wet ${performance.state.delay.wet.toFixed(2)} fb ${performance.state.delay.feedback.toFixed(2)} ${performance.state.delay.time}`,
      last: null,
    },
    {
      name: 'REVERB (master)',
      active: performance.state.reverb.enabled,
      detail: `wet ${performance.state.reverb.wet.toFixed(2)} ${performance.state.reverb.decay.toFixed(1)}s`,
      last: null,
    },
  ];

  const debugPanel = (
    <DebugPanel
      bpmState={bpm}
      swing={swing}
      isPlaying={isPlaying}
      currentStep={currentStep}
      fxStatus={fxStatus}
      fxWarning={perfFx.fxWarning}
      routingOk={audioGraph !== null}
    />
  );

  const tabContent: Record<BottomTab, React.ReactNode> = {
    mixer: mixerPanel,
    note: noteEditor,
    step: stepEditor,
    fx: performanceContent,
    perf: perfFxPanel,
    snap: snapshotsStandalone,
    timeline: timelinePanel,
    sample: samplePanel,
    debug: debugPanel,
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
