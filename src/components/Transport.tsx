import { useState, useEffect } from 'react';
import { MAX_BPM, MIN_BPM } from '../constants';
import styles from './Transport.module.css';

interface Props {
  isPlaying: boolean;
  bpm: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onClear: () => void;
}

export const Transport = ({
  isPlaying,
  bpm,
  onPlay,
  onStop,
  onBpmChange,
  onClear,
}: Props) => {
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
        >
          {isPlaying ? 'STOP' : 'PLAY'}
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
        />
      </label>
    </div>
  );
};
