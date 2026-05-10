import { useEffect } from 'react';
import { SHORTCUTS } from '../config/shortcuts';
import type { ShortcutDescriptor } from '../types/shortcuts';
import styles from './KeyboardHelpModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

const GROUP_LABEL: Record<ShortcutDescriptor['group'], string> = {
  transport: 'Transport',
  bpm: 'BPM',
  page: 'Step Page',
  loop: 'Loop',
  track: 'Track',
  timeline: 'Timeline',
  performance: 'Performance',
  sample: 'Sample',
  clipboard: 'Clipboard',
  help: 'Help',
};

export const KeyboardHelpModal = ({ open, onClose }: Props) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const grouped = SHORTCUTS.reduce<Record<string, ShortcutDescriptor[]>>(
    (acc, s) => {
      (acc[s.group] = acc[s.group] ?? []).push(s);
      return acc;
    },
    {},
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="keyboard shortcuts"
      >
        <header className={styles.header}>
          <span className={styles.title}>keyboard shortcuts</span>
          <button type="button" className={styles.close} onClick={onClose}>
            CLOSE
          </button>
        </header>
        <div className={styles.body}>
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group} className={styles.group}>
              <h3 className={styles.groupTitle}>
                {GROUP_LABEL[group as ShortcutDescriptor['group']]}
              </h3>
              <ul className={styles.list}>
                {items.map((s) => (
                  <li key={s.id} className={styles.item}>
                    <span className={styles.label}>{s.label}</span>
                    <kbd className={styles.kbd}>{s.hint}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
