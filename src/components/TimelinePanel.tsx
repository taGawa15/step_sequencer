import { type ReactNode } from 'react';
import type { TimelineSlot, TimelineSlotId } from '../types/timeline';
import { TIMELINE_SLOT_IDS } from '../types/timeline';
import styles from './TimelinePanel.module.css';

interface Props {
  timelines: Record<TimelineSlotId, TimelineSlot | null>;
  activeId: TimelineSlotId;
  confirmLoadGuard: boolean;
  onSelect: (id: TimelineSlotId) => void;
  onSave: () => void;
  onLoad: () => void;
  onDuplicate: () => void;
  onClear: () => void;
  onSetConfirmGuard: (on: boolean) => void;
  /** Slot for the CopyPasteControls panel; rendered below the slot grid. */
  clipboardSlot?: ReactNode;
}

export const TimelinePanel = ({
  timelines,
  activeId,
  confirmLoadGuard,
  onSelect,
  onSave,
  onLoad,
  onDuplicate,
  onClear,
  onSetConfirmGuard,
  clipboardSlot,
}: Props) => (
  <section className={styles.panel} aria-label="timeline panel">
    <header className={styles.header}>
      <span className={styles.title}>timeline</span>
      <label className={styles.guard}>
        <input
          type="checkbox"
          checked={confirmLoadGuard}
          onChange={(e) => onSetConfirmGuard(e.target.checked)}
        />
        <span>確認</span>
      </label>
    </header>

    <div className={styles.slots}>
      {TIMELINE_SLOT_IDS.map((id) => {
        const slot = timelines[id];
        const empty = !slot;
        return (
          <button
            key={id}
            type="button"
            className={[
              styles.slot,
              id === activeId ? styles.slotActive : '',
              empty ? styles.slotEmpty : styles.slotFull,
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(id)}
            aria-pressed={id === activeId}
          >
            <span className={styles.slotId}>{id}</span>
            <span className={styles.slotMeta}>
              {empty ? 'empty' : new Date(slot.savedAt).toLocaleTimeString()}
            </span>
          </button>
        );
      })}
    </div>

    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={onSave}>
        SAVE
      </button>
      <button
        type="button"
        className={styles.action}
        onClick={onLoad}
        disabled={!timelines[activeId]}
      >
        LOAD
      </button>
      <button
        type="button"
        className={styles.action}
        onClick={onDuplicate}
        disabled={!timelines[activeId]}
      >
        DUP
      </button>
      <button
        type="button"
        className={`${styles.action} ${styles.actionDanger}`}
        onClick={onClear}
        disabled={!timelines[activeId]}
      >
        CLEAR
      </button>
    </div>

    {clipboardSlot && <div className={styles.clipboardSlot}>{clipboardSlot}</div>}
  </section>
);
