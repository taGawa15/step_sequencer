import { type ReactNode } from 'react';
import {
  FILTER_CUTOFF_DEFAULT_ENGAGED,
  FILTER_CUTOFF_MAX,
  FILTER_CUTOFF_MIN,
  MICRO_TIMING_MAX,
  MICRO_TIMING_MIN,
  NOTE_DURATIONS,
  PAN_DEFAULT_ENGAGED,
  PAN_MAX,
  PAN_MIN,
  PITCH_OFFSET_DEFAULT_ENGAGED,
  PITCH_OFFSET_MAX,
  PITCH_OFFSET_MIN,
  PROBABILITY_MAX,
  PROBABILITY_MIN,
  REPEAT_OPTIONS,
  VELOCITY_MAX,
  VELOCITY_MIN,
} from '../constants';
import {
  type ScaleDef,
} from '../scales';
import {
  ROOTS,
  SCALE_DEFS,
  buildNote,
  splitNote,
  transposeNote,
  type RootId,
  type ScaleId,
} from '../utils/musicTheory';
import { MiniKeyboard } from './MiniKeyboard';
import type {
  DrumStep,
  NoteDuration,
  RepeatCount,
  ResolvedSelection,
  StepComponents,
  SynthStep,
  SynthTrackDef,
} from '../types';
import styles from './StepComponentEditor.module.css';

/** Subset of editor sections to render. Used by viewport-driven tabs. */
export type EditorMode = 'all' | 'note' | 'step';

interface Props {
  resolved: ResolvedSelection | null;
  scale: ScaleDef;
  /** Defaults to 'all'. 'note' = pitch+velocity only; 'step' = components+locks. */
  mode?: EditorMode;
  /** Note-editor scale state (root / scale / lock). */
  noteRoot: RootId;
  noteScale: ScaleId;
  noteScaleLock: boolean;
  onSetNoteRoot: (r: RootId) => void;
  onSetNoteScale: (s: ScaleId) => void;
  onToggleNoteScaleLock: () => void;
  /** Optional preview when a note changes — fed by Sequencer. */
  onPreviewNote?: (trackId: 'bass' | 'lead', note: string) => void;
  onUpdateDrumStep: (patch: Partial<DrumStep>) => void;
  onUpdateSynthStep: (patch: Partial<SynthStep>) => void;
  onUpdateComponents: (patch: Partial<StepComponents>) => void;
  onResetComponents: () => void;
  onToggleActive: () => void;
}

export const StepComponentEditor = ({
  resolved,
  scale,
  mode = 'all',
  noteRoot,
  noteScale,
  noteScaleLock,
  onSetNoteRoot,
  onSetNoteScale,
  onToggleNoteScaleLock,
  onPreviewNote,
  onUpdateDrumStep,
  onUpdateSynthStep,
  onUpdateComponents,
  onResetComponents,
  onToggleActive,
}: Props) => {
  if (!resolved) {
    return (
      <div className={`${styles.editor} ${styles.empty}`} aria-disabled>
        <span className={styles.placeholder}>
          select any step to edit components
        </span>
      </div>
    );
  }

  const { step, track, kind, stepIndex } = resolved;
  const components = step.components;

  const showPitchVel = mode === 'all' || mode === 'note';
  const showStepFx = mode === 'all' || mode === 'step';

  return (
    <section className={styles.editor} aria-label="step component editor">
      <Header
        trackLabel={track.label}
        stepIndex={stepIndex}
        scaleLabel={kind === 'synth' && showPitchVel ? scale.label : null}
        active={step.active}
        onToggleActive={onToggleActive}
      />

      {showPitchVel && kind === 'synth' && (
        <PitchSection
          step={resolved.step}
          track={resolved.track}
          root={noteRoot}
          scale={noteScale}
          scaleLock={noteScaleLock}
          onSetRoot={onSetNoteRoot}
          onSetScale={onSetNoteScale}
          onToggleLock={onToggleNoteScaleLock}
          onUpdate={(patch) => {
            onUpdateSynthStep(patch);
            if (patch.note && onPreviewNote) {
              onPreviewNote(resolved.trackId, patch.note);
            }
          }}
        />
      )}

      {showPitchVel && (
        <VelocityRow
          velocity={step.velocity}
          onChange={(v) => {
            if (kind === 'drum') onUpdateDrumStep({ velocity: v });
            else onUpdateSynthStep({ velocity: v });
          }}
        />
      )}

      {showStepFx && (
        <>
          <ComponentsBlock title="components" onReset={onResetComponents}>
            <ProbabilityRow
              value={components.probability}
              onChange={(probability) => onUpdateComponents({ probability })}
            />
            <RepeatRow
              value={components.repeat}
              onChange={(repeat) => onUpdateComponents({ repeat })}
            />
            <MicroTimingRow
              value={components.microTiming}
              onChange={(microTiming) => onUpdateComponents({ microTiming })}
            />
          </ComponentsBlock>

          <ComponentsBlock title="locks">
            <PlockRow
              label="FILTER"
              value={components.filterCutoff}
              defaultValue={FILTER_CUTOFF_DEFAULT_ENGAGED}
              min={FILTER_CUTOFF_MIN}
              max={FILTER_CUTOFF_MAX}
              step={10}
              format={(hz) =>
                hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${Math.round(hz)}Hz`
              }
              onChange={(filterCutoff) => onUpdateComponents({ filterCutoff })}
            />
            <PlockRow
              label="PAN"
              value={components.pan}
              defaultValue={PAN_DEFAULT_ENGAGED}
              min={PAN_MIN}
              max={PAN_MAX}
              step={0.05}
              format={(v) =>
                v === 0
                  ? '0.00'
                  : v > 0
                    ? `R ${v.toFixed(2)}`
                    : `L ${Math.abs(v).toFixed(2)}`
              }
              onChange={(pan) => onUpdateComponents({ pan })}
            />
            <PlockRow
              label="PITCH"
              value={components.pitchOffset}
              defaultValue={PITCH_OFFSET_DEFAULT_ENGAGED}
              min={PITCH_OFFSET_MIN}
              max={PITCH_OFFSET_MAX}
              step={1}
              format={(st) => `${st > 0 ? '+' : ''}${st} st`}
              onChange={(pitchOffset) => onUpdateComponents({ pitchOffset })}
            />
          </ComponentsBlock>
        </>
      )}
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────────────

const Header = ({
  trackLabel,
  stepIndex,
  scaleLabel,
  active,
  onToggleActive,
}: {
  trackLabel: string;
  stepIndex: number;
  scaleLabel: string | null;
  active: boolean;
  onToggleActive: () => void;
}) => (
  <header className={styles.header}>
    <div className={styles.headerLeft}>
      <span className={styles.crumb}>{trackLabel}</span>
      <span className={styles.crumbSep}>·</span>
      <span className={styles.crumb}>STEP {stepIndex + 1}</span>
      {scaleLabel && <span className={styles.scale}>{scaleLabel}</span>}
    </div>
    <button
      type="button"
      onClick={onToggleActive}
      className={`${styles.toggleActive} ${active ? styles.toggleOn : ''}`}
    >
      {active ? 'ON' : 'OFF'}
    </button>
  </header>
);

// ──────────────────────────────────────────────────────────────────────────
// Pitch section (synth only) — note / oct / len
// ──────────────────────────────────────────────────────────────────────────

const PitchSection = ({
  step,
  track,
  root,
  scale,
  scaleLock,
  onSetRoot,
  onSetScale,
  onToggleLock,
  onUpdate,
}: {
  step: SynthStep;
  track: SynthTrackDef;
  root: RootId;
  scale: ScaleId;
  scaleLock: boolean;
  onSetRoot: (r: RootId) => void;
  onSetScale: (s: ScaleId) => void;
  onToggleLock: () => void;
  onUpdate: (patch: Partial<SynthStep>) => void;
}) => {
  const { octave: currentOctave } = splitNote(step.note);
  const setOctave = (o: number) => {
    const { pc } = splitNote(step.note);
    onUpdate({ note: buildNote(pc, o) });
  };
  const nudge = (semis: number) => onUpdate({ note: transposeNote(step.note, semis) });

  return (
    <div className={styles.section}>
      <div className={styles.scaleRow}>
        <span className={styles.rowLabel}>SCALE</span>
        <select
          className={styles.miniSelect}
          value={root}
          onChange={(e) => onSetRoot(e.target.value as RootId)}
          aria-label="root"
        >
          {ROOTS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          className={styles.miniSelect}
          value={scale}
          onChange={(e) => onSetScale(e.target.value as ScaleId)}
          aria-label="scale"
        >
          {Object.entries(SCALE_DEFS).map(([id, def]) => (
            <option key={id} value={id}>{def.label}</option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.lockBtn} ${scaleLock ? styles.lockBtnOn : ''}`}
          onClick={onToggleLock}
          aria-pressed={scaleLock}
          title="Scale lock"
        >
          {scaleLock ? '🔒' : '🔓'}
        </button>
      </div>

      <MiniKeyboard
        note={step.note}
        octave={currentOctave}
        root={root}
        scale={scale}
        scaleLock={scaleLock}
        octaveRange={track.octaveRange}
        onPickNote={(n) => onUpdate({ note: n })}
        onOctaveDown={() => setOctave(Math.max(track.octaveRange[0], currentOctave - 1))}
        onOctaveUp={() => setOctave(Math.min(track.octaveRange[1], currentOctave + 1))}
      />

      <div className={styles.nudgeRow}>
        <span className={styles.rowLabel}>NUDGE</span>
        <button type="button" className={styles.nudgeBtn} onClick={() => nudge(-12)} aria-label="oct -1">OCT−</button>
        <button type="button" className={styles.nudgeBtn} onClick={() => nudge(-1)} aria-label="note -1">−1</button>
        <span className={styles.nudgeNote}>{step.note}</span>
        <button type="button" className={styles.nudgeBtn} onClick={() => nudge(1)} aria-label="note +1">+1</button>
        <button type="button" className={styles.nudgeBtn} onClick={() => nudge(12)} aria-label="oct +1">OCT+</button>
      </div>

      <Row label="LEN">
        <Choices>
          {NOTE_DURATIONS.map((d) => (
            <Choice
              key={d}
              active={d === step.duration}
              onClick={() => onUpdate({ duration: d as NoteDuration })}
              label={d.replace('n', '')}
            />
          ))}
        </Choices>
      </Row>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Velocity (both drum + synth)
// ──────────────────────────────────────────────────────────────────────────

const VelocityRow = ({
  velocity,
  onChange,
}: {
  velocity: number;
  onChange: (v: number) => void;
}) => (
  <div className={styles.section}>
    <Row label="VEL">
      <div className={styles.sliderRow}>
        <input
          type="range"
          min={VELOCITY_MIN}
          max={VELOCITY_MAX}
          step={0.05}
          value={velocity}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.slider}
          aria-label="velocity"
        />
        <span className={styles.sliderValue}>{velocity.toFixed(2)}</span>
      </div>
    </Row>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────
// Components rows
// ──────────────────────────────────────────────────────────────────────────

const ProbabilityRow = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => (
  <Row label="PROB">
    <div className={styles.sliderRow}>
      <input
        type="range"
        min={PROBABILITY_MIN}
        max={PROBABILITY_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
        aria-label="probability"
      />
      <span className={styles.sliderValue}>{value}%</span>
    </div>
  </Row>
);

const RepeatRow = ({
  value,
  onChange,
}: {
  value: RepeatCount;
  onChange: (v: RepeatCount) => void;
}) => (
  <Row label="REPEAT">
    <Choices>
      {REPEAT_OPTIONS.map((r) => (
        <Choice
          key={r}
          active={r === value}
          onClick={() => onChange(r)}
          label={String(r)}
        />
      ))}
    </Choices>
  </Row>
);

const MicroTimingRow = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => (
  <Row label="μTIME">
    <div className={styles.sliderRow}>
      <input
        type="range"
        min={MICRO_TIMING_MIN}
        max={MICRO_TIMING_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
        aria-label="micro timing"
      />
      <span className={styles.sliderValue}>
        {value > 0 ? '+' : ''}
        {value}ms
      </span>
    </div>
  </Row>
);

// ──────────────────────────────────────────────────────────────────────────
// Plock row — toggle + slider + value
// ──────────────────────────────────────────────────────────────────────────

const PlockRow = ({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number | null;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (v: number | null) => void;
}) => {
  const locked = value !== null;
  const displayValue = locked ? (value as number) : defaultValue;

  return (
    <Row label={label}>
      <div className={styles.plockRow}>
        <button
          type="button"
          className={`${styles.lockToggle} ${locked ? styles.lockOn : ''}`}
          onClick={() => (locked ? onChange(null) : onChange(defaultValue))}
          aria-pressed={locked}
          aria-label={`${label} ${locked ? 'unlock' : 'lock'}`}
        >
          {locked ? '●' : '○'}
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${styles.slider} ${locked ? '' : styles.sliderDisabled}`}
          disabled={!locked}
          aria-label={label}
        />
        <span className={`${styles.sliderValue} ${locked ? '' : styles.valueOff}`}>
          {locked ? format(displayValue) : '—'}
        </span>
      </div>
    </Row>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Local presentational helpers
// ──────────────────────────────────────────────────────────────────────────

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{label}</span>
    {children}
  </div>
);

const Choices = ({ children }: { children: ReactNode }) => (
  <div className={styles.choices}>{children}</div>
);

const Choice = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    className={`${styles.choice} ${active ? styles.choiceActive : ''}`}
    onClick={onClick}
    aria-pressed={active}
  >
    {label}
  </button>
);

const ComponentsBlock = ({
  title,
  children,
  onReset,
}: {
  title: string;
  children: ReactNode;
  onReset?: () => void;
}) => (
  <div className={styles.block}>
    <div className={styles.blockHeader}>
      <span className={styles.blockTitle}>{title}</span>
      {onReset && (
        <button type="button" className={styles.reset} onClick={onReset}>
          RESET
        </button>
      )}
    </div>
    <div className={styles.blockBody}>{children}</div>
  </div>
);
