import {
  FILTER_RESONANCE_MAX,
  FILTER_RESONANCE_MIN,
  FILTER_SWEEP_MAX,
  FILTER_SWEEP_MIN,
} from '../constants';
import styles from './FilterSweepControl.module.css';

interface Props {
  sweep: number;
  resonance: number;
  onSetSweep: (v: number) => void;
  onSetResonance: (q: number) => void;
}

/**
 * Self-contained filter sweep + resonance knob. Designed to live in a
 * narrow column without spilling — the row uses a fixed 3-column grid
 * (label / slider / readout) so the slider always shrinks to fit the
 * parent. The bipolar centre mark sits inside the slider track.
 */
export const FilterSweepControl = ({
  sweep,
  resonance,
  onSetSweep,
  onSetResonance,
}: Props) => {
  const sweepLabel =
    sweep === 0 ? 'open' : sweep < 0 ? `LP ${Math.abs(sweep)}` : `HP ${sweep}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>SWEEP</span>
        <div className={styles.sliderWrap}>
          <span className={styles.bipolarMark} aria-hidden />
          <input
            type="range"
            className={styles.slider}
            min={FILTER_SWEEP_MIN}
            max={FILTER_SWEEP_MAX}
            step={1}
            value={sweep}
            onChange={(e) => onSetSweep(Number(e.target.value))}
            aria-label="filter sweep"
          />
        </div>
        <span className={styles.value}>{sweepLabel}</span>
        <button
          type="button"
          className={styles.reset}
          onClick={() => onSetSweep(0)}
          aria-label="reset sweep"
          title="Reset to 0"
        >
          ↺
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Q</span>
        <div className={styles.sliderWrap}>
          <input
            type="range"
            className={styles.slider}
            min={FILTER_RESONANCE_MIN}
            max={FILTER_RESONANCE_MAX}
            step={0.1}
            value={resonance}
            onChange={(e) => onSetResonance(Number(e.target.value))}
            aria-label="resonance"
          />
        </div>
        <span className={styles.value}>{resonance.toFixed(1)}</span>
        <span className={styles.resetSpacer} />
      </div>
    </div>
  );
};
