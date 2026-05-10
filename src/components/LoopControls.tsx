import { LOOP_LENGTHS, type LoopLengthType } from '../constants';
import styles from './LoopControls.module.css';

interface Props {
  loopLength: LoopLengthType;
  stepPage: number;
  totalPages: number;
  /** Step that's currently firing in the engine (0..63 or -1 if stopped). */
  currentStep: number;
  onSetLoopLength: (l: LoopLengthType) => void;
  onSetStepPage: (p: number) => void;
}

/**
 * Loop length selector + step-page selector. Shows page buttons only for
 * lengths that span more than one 16-step page.
 */
export const LoopControls = ({
  loopLength,
  stepPage,
  totalPages,
  currentStep,
  onSetLoopLength,
  onSetStepPage,
}: Props) => {
  const currentPage =
    currentStep < 0 ? -1 : Math.floor(currentStep / 16);

  return (
    <div className={styles.row}>
      <div className={styles.group}>
        <span className={styles.label}>LOOP</span>
        <div className={styles.choices}>
          {LOOP_LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              className={`${styles.choice} ${l === loopLength ? styles.choiceOn : ''}`}
              onClick={() => onSetLoopLength(l)}
              aria-pressed={l === loopLength}
            >
              ×{l}
            </button>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className={styles.group}>
          <span className={styles.label}>PAGE</span>
          <div className={styles.choices}>
            {Array.from({ length: totalPages }, (_, p) => {
              const start = p * 16 + 1;
              const end = (p + 1) * 16;
              return (
                <button
                  key={p}
                  type="button"
                  className={[
                    styles.choice,
                    p === stepPage ? styles.choiceOn : '',
                    p === currentPage ? styles.choicePlaying : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSetStepPage(p)}
                  aria-pressed={p === stepPage}
                >
                  {start}–{end}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
