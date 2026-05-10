import { useState } from 'react';
import { MORPH_TIME_MAX, MORPH_TIME_MIN, SNAPSHOT_SLOTS } from '../constants';
import type { SnapshotMap, SnapshotSlot } from '../types/audio';
import styles from './SnapshotControls.module.css';

interface Props {
  snapshots: SnapshotMap;
  morphTime: number;
  onSetMorphTime: (v: number) => void;
  onRecall: (slot: SnapshotSlot) => void;
  onSave: (slot: SnapshotSlot) => void;
  onClear: (slot: SnapshotSlot) => void;
}

export const SnapshotControls = ({
  snapshots,
  morphTime,
  onSetMorphTime,
  onRecall,
  onSave,
  onClear,
}: Props) => {
  // Save mode: when ON, clicking a slot saves into it instead of recalling.
  const [saveMode, setSaveMode] = useState(false);

  const handleSlot = (slot: SnapshotSlot) => {
    if (saveMode) {
      onSave(slot);
      setSaveMode(false);
    } else {
      onRecall(slot);
    }
  };

  return (
    <div className={styles.row}>
      <span className={styles.label}>SCENES</span>
      <div className={styles.slots}>
        {SNAPSHOT_SLOTS.map((slot) => {
          const empty = snapshots[slot].empty;
          return (
            <button
              key={slot}
              type="button"
              className={[
                styles.slot,
                empty ? styles.slotEmpty : styles.slotFull,
                saveMode ? styles.slotArmed : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSlot(slot)}
              onContextMenu={(e) => {
                e.preventDefault();
                onClear(slot);
              }}
              aria-label={`scene ${slot} ${empty ? 'empty' : 'recall'}`}
            >
              {slot}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`${styles.saveBtn} ${saveMode ? styles.saveBtnArmed : ''}`}
        onClick={() => setSaveMode((v) => !v)}
        aria-pressed={saveMode}
      >
        {saveMode ? 'PICK SLOT…' : 'SAVE'}
      </button>

      <div className={styles.morph}>
        <span className={styles.morphLabel}>MORPH</span>
        <input
          type="range"
          min={MORPH_TIME_MIN}
          max={MORPH_TIME_MAX}
          step={0.1}
          value={morphTime}
          onChange={(e) => onSetMorphTime(Number(e.target.value))}
          className={styles.morphSlider}
          aria-label="morph time"
        />
        <span className={styles.morphValue}>
          {morphTime === 0 ? 'instant' : `${morphTime.toFixed(1)}s`}
        </span>
      </div>
    </div>
  );
};
