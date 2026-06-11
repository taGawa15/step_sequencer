import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  PERF_FX_RATE_LABEL,
  PERF_FX_RATE_OPTIONS,
  type FxMode,
  type RepeatRate,
} from '../audio/performanceFx';
import type { PerformanceFxState } from '../hooks/usePerformanceFx';
import styles from './PerformanceFxPanel.module.css';

interface Props {
  state: PerformanceFxState;
  beatActive: boolean;
  stutterActive: boolean;
  tapeActive: boolean;
  throwActive: boolean;
  freezeActive: boolean;
  crushActive: boolean;
  onSetBeatRate: (r: RepeatRate) => void;
  onSetBeatMode: (m: FxMode) => void;
  onToggleBeat: () => void;
  onStartBeat: () => void;
  onStopBeat: () => void;
  onSetStutterRate: (r: RepeatRate) => void;
  onSetStutterDepth: (d: number) => void;
  onSetStutterMode: (m: FxMode) => void;
  onToggleStutter: () => void;
  onStartStutter: () => void;
  onStopStutter: () => void;
  onSetTapeTime: (t: number) => void;
  onSetTapeMode: (m: 'release' | 'resume') => void;
  onTriggerTape: () => void;
  onSetThrowMode: (m: FxMode) => void;
  onToggleThrow: () => void;
  onStartThrow: () => void;
  onStopThrow: () => void;
  onSetFreezeMode: (m: FxMode) => void;
  onToggleFreeze: () => void;
  onStartFreeze: () => void;
  onStopFreeze: () => void;
  onSetCrushMode: (m: FxMode) => void;
  onToggleCrush: () => void;
  onStartCrush: () => void;
  onStopCrush: () => void;
}

const TAPE_TIMES = [0.25, 0.5, 1.0, 2.0];

export const PerformanceFxPanel = ({
  state,
  beatActive,
  stutterActive,
  tapeActive,
  throwActive,
  freezeActive,
  crushActive,
  onSetBeatRate,
  onSetBeatMode,
  onToggleBeat,
  onStartBeat,
  onStopBeat,
  onSetStutterRate,
  onSetStutterDepth,
  onSetStutterMode,
  onToggleStutter,
  onStartStutter,
  onStopStutter,
  onSetTapeTime,
  onSetTapeMode,
  onTriggerTape,
  onSetThrowMode,
  onToggleThrow,
  onStartThrow,
  onStopThrow,
  onSetFreezeMode,
  onToggleFreeze,
  onStartFreeze,
  onStopFreeze,
  onSetCrushMode,
  onToggleCrush,
  onStartCrush,
  onStopCrush,
}: Props) => {
  // Momentary buttons use Pointer Events — one unified stream for mouse,
  // touch and pen. The old mouse+touch mix double-fired on touch devices
  // (touchend is followed by a synthetic mousedown/mouseup, producing an
  // audible restart blip). Pointer capture keeps the release reliable
  // even when the finger slides off the button; pointercancel (e.g. the
  // browser steals the gesture for scrolling) also releases.
  const momentaryProps = (start: () => void, stop: () => void) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      start();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  });

  const beatBtnProps =
    state.beatRepeatMode === 'momentary'
      ? momentaryProps(onStartBeat, onStopBeat)
      : { onClick: onToggleBeat };

  const stutterBtnProps =
    state.stutterMode === 'momentary'
      ? momentaryProps(onStartStutter, onStopStutter)
      : { onClick: onToggleStutter };

  const throwBtnProps =
    state.throwMode === 'momentary'
      ? momentaryProps(onStartThrow, onStopThrow)
      : { onClick: onToggleThrow };

  const freezeBtnProps =
    state.freezeMode === 'momentary'
      ? momentaryProps(onStartFreeze, onStopFreeze)
      : { onClick: onToggleFreeze };

  const crushBtnProps =
    state.crushMode === 'momentary'
      ? momentaryProps(onStartCrush, onStopCrush)
      : { onClick: onToggleCrush };

  return (
    <section className={styles.panel} aria-label="performance fx">
      {/* ── Beat Repeat ──────────────────────────────────────────── */}
      <div className={styles.fx}>
        <div className={styles.fxHeader}>
          <span className={styles.fxName}>BEAT REPEAT</span>
          <span className={styles.kbd}>G</span>
        </div>
        <button
          type="button"
          className={`${styles.bigBtn} ${beatActive ? styles.bigBtnOn : ''}`}
          aria-pressed={beatActive}
          {...beatBtnProps}
        >
          {beatActive ? '● BEAT' : 'BEAT'}
        </button>
        <div className={styles.controls}>
          <Choices
            options={PERF_FX_RATE_OPTIONS}
            value={state.beatRepeatRate}
            label={(r) => PERF_FX_RATE_LABEL[r]}
            onChange={onSetBeatRate}
          />
          <ModeToggle
            value={state.beatRepeatMode}
            onChange={onSetBeatMode}
          />
        </div>
      </div>

      {/* ── Stutter Gate ─────────────────────────────────────────── */}
      <div className={styles.fx}>
        <div className={styles.fxHeader}>
          <span className={styles.fxName}>STUTTER</span>
          <span className={styles.kbd}>H</span>
        </div>
        <button
          type="button"
          className={`${styles.bigBtn} ${stutterActive ? styles.bigBtnOn : ''}`}
          aria-pressed={stutterActive}
          {...stutterBtnProps}
        >
          {stutterActive ? '● GATE' : 'GATE'}
        </button>
        <div className={styles.controls}>
          <Choices
            options={PERF_FX_RATE_OPTIONS}
            value={state.stutterRate}
            label={(r) => PERF_FX_RATE_LABEL[r]}
            onChange={onSetStutterRate}
          />
          <ModeToggle
            value={state.stutterMode}
            onChange={onSetStutterMode}
          />
        </div>
        <div className={styles.depthRow}>
          <span className={styles.rowLabel}>DEPTH</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.stutterDepth}
            onChange={(e) => onSetStutterDepth(Number(e.target.value))}
            className={styles.slider}
            aria-label="stutter depth"
          />
          <span className={styles.value}>
            {Math.round(state.stutterDepth * 100)}%
          </span>
        </div>
      </div>

      {/* ── Tape Stop ────────────────────────────────────────────── */}
      <div className={styles.fx}>
        <div className={styles.fxHeader}>
          <span className={styles.fxName}>TAPE STOP</span>
          <span className={styles.kbd}>J</span>
        </div>
        <button
          type="button"
          className={`${styles.bigBtn} ${tapeActive ? styles.bigBtnOn : ''}`}
          onClick={onTriggerTape}
          disabled={tapeActive}
          aria-pressed={tapeActive}
        >
          {tapeActive ? '● TAPE' : 'TAPE'}
        </button>
        <div className={styles.controls}>
          <Choices
            options={TAPE_TIMES}
            value={state.tapeStopTime}
            label={(t) => `${t}s`}
            onChange={onSetTapeTime}
          />
          <div className={styles.modeChoices}>
            <button
              type="button"
              className={`${styles.modeBtn} ${state.tapeStopMode === 'release' ? styles.modeBtnOn : ''}`}
              onClick={() => onSetTapeMode('release')}
            >
              REL
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${state.tapeStopMode === 'resume' ? styles.modeBtnOn : ''}`}
              onClick={() => onSetTapeMode('resume')}
            >
              RES
            </button>
          </div>
        </div>
      </div>

      {/* ── Delay Throw ──────────────────────────────────────────── */}
      <div className={styles.fx}>
        <div className={styles.fxHeader}>
          <span className={styles.fxName}>DELAY THROW</span>
        </div>
        <button
          type="button"
          className={`${styles.bigBtn} ${throwActive ? styles.bigBtnOn : ''}`}
          aria-pressed={throwActive}
          data-testid="fx-throw"
          {...throwBtnProps}
        >
          {throwActive ? '● THROW' : 'THROW'}
        </button>
        <div className={styles.controls}>
          <ModeToggle value={state.throwMode} onChange={onSetThrowMode} />
        </div>
      </div>

      {/* ── Reverb Freeze ────────────────────────────────────────── */}
      <div className={styles.fx}>
        <div className={styles.fxHeader}>
          <span className={styles.fxName}>REVERB FREEZE</span>
        </div>
        <button
          type="button"
          className={`${styles.bigBtn} ${freezeActive ? styles.bigBtnOn : ''}`}
          aria-pressed={freezeActive}
          data-testid="fx-freeze"
          {...freezeBtnProps}
        >
          {freezeActive ? '● FREEZE' : 'FREEZE'}
        </button>
        <div className={styles.controls}>
          <ModeToggle value={state.freezeMode} onChange={onSetFreezeMode} />
        </div>
      </div>

      {/* ── Bit Crush ────────────────────────────────────────────── */}
      <div className={styles.fx}>
        <div className={styles.fxHeader}>
          <span className={styles.fxName}>BIT CRUSH</span>
        </div>
        <button
          type="button"
          className={`${styles.bigBtn} ${crushActive ? styles.bigBtnOn : ''}`}
          aria-pressed={crushActive}
          data-testid="fx-crush"
          {...crushBtnProps}
        >
          {crushActive ? '● CRUSH' : 'CRUSH'}
        </button>
        <div className={styles.controls}>
          <ModeToggle value={state.crushMode} onChange={onSetCrushMode} />
        </div>
      </div>
    </section>
  );
};

const Choices = <T,>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (v: T) => string;
  onChange: (v: T) => void;
}) => (
  <div className={styles.choices}>
    {options.map((o, i) => (
      <button
        key={i}
        type="button"
        className={`${styles.choice} ${o === value ? styles.choiceOn : ''}`}
        onClick={() => onChange(o)}
        aria-pressed={o === value}
      >
        {label(o)}
      </button>
    ))}
  </div>
);

const ModeToggle = ({
  value,
  onChange,
}: {
  value: FxMode;
  onChange: (v: FxMode) => void;
}) => (
  <div className={styles.modeChoices}>
    <button
      type="button"
      className={`${styles.modeBtn} ${value === 'momentary' ? styles.modeBtnOn : ''}`}
      onClick={() => onChange('momentary')}
      title="hold to engage"
    >
      MOM
    </button>
    <button
      type="button"
      className={`${styles.modeBtn} ${value === 'latch' ? styles.modeBtnOn : ''}`}
      onClick={() => onChange('latch')}
      title="toggle on/off"
    >
      LAT
    </button>
  </div>
);
