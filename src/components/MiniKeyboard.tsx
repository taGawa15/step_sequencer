import {
  NOTE_NAMES_SHARPS,
  buildNote,
  isInScale,
  splitNote,
  type RootId,
  type ScaleId,
} from '../utils/musicTheory';
import styles from './MiniKeyboard.module.css';

interface Props {
  /** Currently selected note string, e.g. "C2". */
  note: string;
  /** Octave the keyboard is "tuned" to. The 12 keys span [octave..octave+1). */
  octave: number;
  root: RootId;
  scale: ScaleId;
  /** When true, keys outside the scale are disabled. */
  scaleLock: boolean;
  /** Inclusive range of allowed octaves for this track. */
  octaveRange: readonly [number, number];
  onPickNote: (note: string) => void;
  onOctaveDown: () => void;
  onOctaveUp: () => void;
}

/**
 * One-octave piano view. White keys form the row, black keys overlay
 * between them. In-scale keys are bright; out-of-scale keys dim. With
 * scaleLock on, out-of-scale keys are non-clickable.
 */
export const MiniKeyboard = ({
  note,
  octave,
  root,
  scale,
  scaleLock,
  octaveRange,
  onPickNote,
  onOctaveDown,
  onOctaveUp,
}: Props) => {
  const selected = splitNote(note);
  const whitePcs = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const [octMin, octMax] = octaveRange;

  // For each black key, anchor it onto the right edge of a white key.
  // Layout key: which white-key index does each black sit between?
  //   C# between C(0) and D(1)
  //   D# between D(1) and E(2)
  //   F# between F(3) and G(4)
  //   G# between G(4) and A(5)
  //   A# between A(5) and B(6)
  const blackKeyDefs: { pc: number; afterWhite: number }[] = [
    { pc: 1, afterWhite: 0 },
    { pc: 3, afterWhite: 1 },
    { pc: 6, afterWhite: 3 },
    { pc: 8, afterWhite: 4 },
    { pc: 10, afterWhite: 5 },
  ];

  const handlePick = (pc: number) => {
    if (scaleLock && !isInScale(pc, root, scale)) return;
    onPickNote(buildNote(pc, octave));
  };

  const isSelected = (pc: number) =>
    selected.octave === octave && selected.pc === pc;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.octBtn}
        onClick={onOctaveDown}
        disabled={octave <= octMin}
        aria-label="octave down"
      >
        −
      </button>

      <div className={styles.octReadout}>OCT {octave}</div>

      <div className={styles.kbd} role="group" aria-label="mini keyboard">
        {/* White keys */}
        <div className={styles.whiteRow}>
          {whitePcs.map((pc) => {
            const inScale = isInScale(pc, root, scale);
            const disabled = scaleLock && !inScale;
            return (
              <button
                key={pc}
                type="button"
                className={[
                  styles.whiteKey,
                  isSelected(pc) ? styles.whiteSelected : '',
                  inScale ? styles.inScale : styles.outScale,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handlePick(pc)}
                disabled={disabled}
                aria-pressed={isSelected(pc)}
                aria-label={`${NOTE_NAMES_SHARPS[pc]}${octave}`}
              >
                <span className={styles.keyLabel}>{NOTE_NAMES_SHARPS[pc]}</span>
              </button>
            );
          })}
        </div>

        {/* Black key overlay */}
        <div className={styles.blackRow} aria-hidden>
          {blackKeyDefs.map(({ pc, afterWhite }) => {
            const inScale = isInScale(pc, root, scale);
            const disabled = scaleLock && !inScale;
            // Each white key is 1/7th of the row. Black sits at the right
            // edge of `afterWhite`, centered on the gap.
            const left = `calc((${afterWhite + 1} / 7) * 100% - (var(--bk-w) / 2))`;
            return (
              <button
                key={pc}
                type="button"
                style={{ left }}
                className={[
                  styles.blackKey,
                  isSelected(pc) ? styles.blackSelected : '',
                  inScale ? styles.inScale : styles.outScale,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handlePick(pc)}
                disabled={disabled}
                aria-pressed={isSelected(pc)}
                aria-label={`${NOTE_NAMES_SHARPS[pc]}${octave}`}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className={styles.octBtn}
        onClick={onOctaveUp}
        disabled={octave >= octMax}
        aria-label="octave up"
      >
        ＋
      </button>
    </div>
  );
};
