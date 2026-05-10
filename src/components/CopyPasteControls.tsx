import { useState } from 'react';
import {
  PASTE_TARGETS,
  type CopyScope,
  type PasteMode,
  type StepClipboard,
} from '../utils/stepClipboard';
import styles from './CopyPasteControls.module.css';

interface Props {
  clipboard: StepClipboard | null;
  canUndo: boolean;
  selectedTrackName: string | null;
  onCopy: (scope: CopyScope) => void;
  onPaste: (destStart: number, mode: PasteMode) => void;
  onUndo: () => void;
}

const PASTE_MODES: { value: PasteMode; label: string }[] = [
  { value: 'replace', label: 'Replace' },
  { value: 'merge', label: 'Merge' },
  { value: 'append', label: 'Append' },
  { value: 'repeatFill', label: 'Repeat Fill' },
];

export const CopyPasteControls = ({
  clipboard,
  canUndo,
  selectedTrackName,
  onCopy,
  onPaste,
  onUndo,
}: Props) => {
  const [scope, setScope] = useState<CopyScope>('all');
  const [target, setTarget] = useState<number>(0);
  const [mode, setMode] = useState<PasteMode>('replace');

  const clipDesc = clipboard
    ? `${clipboard.length}step · ${clipboard.scope === 'all' ? 'ALL' : 'SEL'}`
    : 'empty';

  return (
    <div className={styles.panel} aria-label="copy paste">
      <header className={styles.header}>
        <span className={styles.title}>clipboard</span>
        <span className={styles.clipState}>{clipDesc}</span>
      </header>

      <div className={styles.row}>
        <span className={styles.rowLabel}>SCOPE</span>
        <div className={styles.choices}>
          <button
            type="button"
            className={`${styles.choice} ${scope === 'all' ? styles.choiceOn : ''}`}
            onClick={() => setScope('all')}
            aria-pressed={scope === 'all'}
          >
            ALL
          </button>
          <button
            type="button"
            className={`${styles.choice} ${scope === 'selectedTrack' ? styles.choiceOn : ''}`}
            onClick={() => setScope('selectedTrack')}
            aria-pressed={scope === 'selectedTrack'}
            disabled={!selectedTrackName}
            title={selectedTrackName ?? 'select a step first'}
          >
            {selectedTrackName ? `SEL · ${selectedTrackName}` : 'SEL'}
          </button>
        </div>
        <button
          type="button"
          className={`${styles.action} ${styles.actionPrimary}`}
          onClick={() => onCopy(scope)}
        >
          COPY
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>TARGET</span>
        <select
          className={styles.select}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          aria-label="paste target"
        >
          {PASTE_TARGETS.map((s) => (
            <option key={s} value={s}>
              Step {s + 1}
            </option>
          ))}
        </select>
        <span className={styles.rowLabel}>MODE</span>
        <select
          className={styles.select}
          value={mode}
          onChange={(e) => setMode(e.target.value as PasteMode)}
          aria-label="paste mode"
        >
          {PASTE_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.action} ${styles.actionPrimary}`}
          disabled={!clipboard}
          onClick={() => onPaste(target, mode)}
        >
          PASTE
        </button>
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={styles.action}
          disabled={!clipboard}
          onClick={() => onPaste(0, 'repeatFill')}
        >
          REPEAT FILL
        </button>
        <button
          type="button"
          className={styles.action}
          disabled={!canUndo}
          onClick={onUndo}
        >
          UNDO
        </button>
      </div>
    </div>
  );
};
