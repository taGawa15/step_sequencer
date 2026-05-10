import { type ReactNode } from 'react';
import {
  COMPRESSOR_RATIO_MAX,
  COMPRESSOR_RATIO_MIN,
  COMPRESSOR_THRESHOLD_MAX,
  COMPRESSOR_THRESHOLD_MIN,
  DELAY_FEEDBACK_MAX,
  DELAY_TIMES,
  MASTER_VOLUME_MAX,
  MASTER_VOLUME_MIN,
  REVERB_DECAY_MAX,
  REVERB_DECAY_MIN,
} from '../constants';
import type { PerformanceState } from '../types/audio';
import { FilterSweepControl } from './FilterSweepControl';
import styles from './PerformancePanel.module.css';

interface Props {
  state: PerformanceState;
  onSetMasterVolume: (v: number) => void;
  onSetFilterSweep: (v: number) => void;
  onSetFilterResonance: (v: number) => void;
  onSetKill: (band: 'low' | 'mid' | 'high', killed: boolean) => void;
  onSetDelay: (patch: Partial<PerformanceState['delay']>) => void;
  onSetReverb: (patch: Partial<PerformanceState['reverb']>) => void;
  onSetCompressor: (patch: Partial<PerformanceState['compressor']>) => void;
  onPanic: () => void;
  children?: ReactNode; // Snapshot controls injected here
}

export const PerformancePanel = ({
  state,
  onSetMasterVolume,
  onSetFilterSweep,
  onSetFilterResonance,
  onSetKill,
  onSetDelay,
  onSetReverb,
  onSetCompressor,
  onPanic,
  children,
}: Props) => {
  return (
    <section className={styles.panel} aria-label="performance panel">
      <div className={styles.panelHeader}>
        <span className={styles.title}>performance</span>
        <button type="button" className={styles.panic} onClick={onPanic}>
          PANIC
        </button>
      </div>

      {/* FILTER SWEEP + Q live in their own contained component so the
          slider always shrinks to fit and never overflows the panel. */}
      <FilterSweepControl
        sweep={state.filterSweep}
        resonance={state.filterResonance}
        onSetSweep={onSetFilterSweep}
        onSetResonance={onSetFilterResonance}
      />

      <div className={styles.mainRow}>
        <SmallKnob
          label="MASTER"
          value={state.masterVolume}
          min={MASTER_VOLUME_MIN}
          max={MASTER_VOLUME_MAX}
          step={0.5}
          display={`${state.masterVolume.toFixed(1)} dB`}
          onChange={onSetMasterVolume}
        />
      </div>

      <div className={styles.killRow}>
        <span className={styles.groupLabel}>KILL</span>
        <KillButton
          label="LOW"
          on={state.kill.low}
          onToggle={() => onSetKill('low', !state.kill.low)}
        />
        <KillButton
          label="MID"
          on={state.kill.mid}
          onToggle={() => onSetKill('mid', !state.kill.mid)}
        />
        <KillButton
          label="HIGH"
          on={state.kill.high}
          onToggle={() => onSetKill('high', !state.kill.high)}
        />
      </div>

      <div className={styles.fxGrid}>
        <FxBlock
          name="DELAY"
          enabled={state.delay.enabled}
          onToggle={() => onSetDelay({ enabled: !state.delay.enabled })}
        >
          <Slider
            label="WET"
            value={state.delay.wet}
            min={0}
            max={1}
            step={0.01}
            display={state.delay.wet.toFixed(2)}
            onChange={(v) => onSetDelay({ wet: v })}
          />
          <Slider
            label="FB"
            value={state.delay.feedback}
            min={0}
            max={DELAY_FEEDBACK_MAX}
            step={0.01}
            display={state.delay.feedback.toFixed(2)}
            onChange={(v) => onSetDelay({ feedback: v })}
          />
          <EnumChoice
            label="TIME"
            value={state.delay.time}
            options={DELAY_TIMES}
            formatOption={(v) => v.replace('n', '')}
            onChange={(v) => onSetDelay({ time: v as PerformanceState['delay']['time'] })}
          />
        </FxBlock>

        <FxBlock
          name="REVERB"
          enabled={state.reverb.enabled}
          onToggle={() => onSetReverb({ enabled: !state.reverb.enabled })}
        >
          <Slider
            label="WET"
            value={state.reverb.wet}
            min={0}
            max={1}
            step={0.01}
            display={state.reverb.wet.toFixed(2)}
            onChange={(v) => onSetReverb({ wet: v })}
          />
          <Slider
            label="DECAY"
            value={state.reverb.decay}
            min={REVERB_DECAY_MIN}
            max={REVERB_DECAY_MAX}
            step={0.1}
            display={`${state.reverb.decay.toFixed(1)}s`}
            onChange={(v) => onSetReverb({ decay: v })}
          />
        </FxBlock>

        <FxBlock
          name="COMP"
          enabled={state.compressor.enabled}
          onToggle={() => onSetCompressor({ enabled: !state.compressor.enabled })}
        >
          <Slider
            label="THR"
            value={state.compressor.threshold}
            min={COMPRESSOR_THRESHOLD_MIN}
            max={COMPRESSOR_THRESHOLD_MAX}
            step={1}
            display={`${state.compressor.threshold.toFixed(0)}dB`}
            onChange={(v) => onSetCompressor({ threshold: v })}
          />
          <Slider
            label="RATIO"
            value={state.compressor.ratio}
            min={COMPRESSOR_RATIO_MIN}
            max={COMPRESSOR_RATIO_MAX}
            step={0.5}
            display={`${state.compressor.ratio.toFixed(1)}:1`}
            onChange={(v) => onSetCompressor({ ratio: v })}
          />
        </FxBlock>
      </div>

      {children && <div className={styles.snapshotsRow}>{children}</div>}
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Local presentational helpers
// ──────────────────────────────────────────────────────────────────────────

const SmallKnob = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) => (
  <div className={styles.smallKnob}>
    <div className={styles.knobLabel}>{label}</div>
    <input
      type="range"
      className={styles.smallSlider}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
    />
    <div className={styles.knobValue}>{display}</div>
  </div>
);

const KillButton = ({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className={`${styles.killButton} ${on ? styles.killOn : ''}`}
    onClick={onToggle}
    aria-pressed={on}
    aria-label={`kill ${label}`}
  >
    {label}
  </button>
);

const FxBlock = ({
  name,
  enabled,
  onToggle,
  children,
}: {
  name: string;
  enabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <div className={`${styles.fxBlock} ${enabled ? styles.fxOn : ''}`}>
    <div className={styles.fxHeader}>
      <span className={styles.fxName}>{name}</span>
      <button
        type="button"
        className={`${styles.fxToggle} ${enabled ? styles.fxToggleOn : ''}`}
        onClick={onToggle}
        aria-pressed={enabled}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
    <div className={styles.fxControls}>{children}</div>
  </div>
);

const Slider = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) => (
  <div className={styles.fxRow}>
    <span className={styles.fxRowLabel}>{label}</span>
    <input
      type="range"
      className={styles.fxSlider}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
    />
    <span className={styles.fxRowValue}>{display}</span>
  </div>
);

const EnumChoice = <T extends string>({
  label,
  value,
  options,
  formatOption,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  formatOption: (v: T) => string;
  onChange: (v: T) => void;
}) => (
  <div className={styles.fxRow}>
    <span className={styles.fxRowLabel}>{label}</span>
    <div className={styles.fxChoices}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`${styles.fxChoice} ${o === value ? styles.fxChoiceOn : ''}`}
          onClick={() => onChange(o)}
          aria-pressed={o === value}
        >
          {formatOption(o)}
        </button>
      ))}
    </div>
  </div>
);
