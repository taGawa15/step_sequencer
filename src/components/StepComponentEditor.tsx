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
  formatNote,
  octavesInRange,
  parseNote,
} from '../scales';
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
          scale={scale}
          onUpdate={onUpdateSynthStep}
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
  scale,
  onUpdate,
}: {
  step: SynthStep;
  track: SynthTrackDef;
  scale: ScaleDef;
  onUpdate: (patch: Partial<SynthStep>) => void;
}) => {
  const { name: currentName, octave: currentOctave } = parseNote(step.note);
  const octaves = octavesInRange(track.octaveRange);

  return (
    <div className={styles.section}>
      <Row label="NOTE">
        <Choices>
          {scale.noteNames.map((n) => (
            <Choice
              key={n}
              active={n === currentName}
              onClick={() => onUpdate({ note: formatNote(n, currentOctave) })}
              label={n}
            />
          ))}
        </Choices>
      </Row>
      <Row label="OCT">
        <Choices>
          {octaves.map((o) => (
            <Choice
              key={o}
              active={o === currentOctave}
              onClick={() => onUpdate({ note: formatNote(currentName, o) })}
              label={String(o)}
            />
          ))}
        </Choices>
      </Row>
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
