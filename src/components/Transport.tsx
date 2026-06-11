import { useState, useEffect } from 'react';
import { MAX_BPM, MIN_BPM } from '../constants';
import { SWING_MAX, SWING_MIN } from '../utils/swing';
import { ShortcutHint } from './ShortcutHint';
import styles from './Transport.module.css';

interface Props {
  isPlaying: boolean;
  bpm: number;
  swing: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onSwingChange: (swing: number) => void;
  onClear: () => void;
  onOpenHelp?: () => void;
  recording?: boolean;
}

export const Transport = ({
  isPlaying,
  bpm,
  swing,
  onPlay,
  onStop,
  onBpmChange,
  onSwingChange,
  onClear,
  onOpenHelp,
  recording: _recording,
}: Props) => {
  void _recording;
  // Local string state allows the user to clear the field while typing.
  const [bpmInput, setBpmInput] = useState(String(bpm));

  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  const commitBpm = () => {
    const parsed = Number(bpmInput);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)));
      onBpmChange(clamped);
      setBpmInput(String(clamped));
    } else {
      setBpmInput(String(bpm));
    }
  };

  return (
    <div className={styles.transport}>
      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary} ${isPlaying ? styles.active : ''}`}
          onClick={isPlaying ? onStop : onPlay}
          data-testid="transport-toggle"
        >
          {isPlaying ? 'STOP' : 'PLAY'}
          <ShortcutHint hint="Space" />
        </button>
        <button type="button" className={styles.button} onClick={onClear}>
          CLEAR
        </button>
      </div>

      <label className={styles.bpm}>
        <span className={styles.bpmLabel}>BPM</span>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpmInput}
          onChange={(e) => setBpmInput(e.target.value)}
          onBlur={commitBpm}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className={styles.bpmInput}
          data-testid="bpm-input"
        />
      </label>

      <label className={styles.swing}>
        <span className={styles.swingLabel}>SWING</span>
        <input
          type="range"
          min={SWING_MIN}
          max={SWING_MAX}
          step={1}
          value={swing}
          onChange={(e) => onSwingChange(Number(e.target.value))}
          className={styles.swingSlider}
          aria-label="swing"
        />
        <span className={styles.swingValue}>{swing}%</span>
      </label>

      {onOpenHelp && (
        <button
          type="button"
          className={styles.helpBtn}
          onClick={onOpenHelp}
          aria-label="keyboard shortcuts"
        >
          ?
        </button>
      )}
    </div>
  );
};
