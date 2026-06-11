import { memo } from 'react';
import type { DrumTrackId } from '../types';
import styles from './StepButton.module.css';

interface Props {
  trackId: DrumTrackId;
  index: number;
  on: boolean;
  current: boolean;
  selected: boolean;
  /** True when this step has any non-default step component / plock. */
  modified: boolean;
  /** Step is past the current loopLength — visually muted. */
  outOfLoop?: boolean;
  /**
   * Stable callback shared by every button — (trackId, index) are passed
   * back so the parent never has to allocate per-step closures (which
   * would defeat memo() and re-render all 128 buttons on every tick).
   */
  onStepClick: (trackId: DrumTrackId, index: number) => void;
}

const StepButtonImpl = ({
  trackId,
  index,
  on,
  current,
  selected,
  modified,
  outOfLoop,
  onStepClick,
}: Props) => {
  const isDownbeat = index % 4 === 0;
  const className = [
    styles.step,
    isDownbeat ? styles.downbeat : '',
    on ? styles.on : '',
    current ? styles.current : '',
    selected ? styles.selected : '',
    modified ? styles.modified : '',
    outOfLoop ? styles.outOfLoop : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={() => onStepClick(trackId, index)}
      aria-pressed={on}
      aria-label={`step ${index + 1}`}
    />
  );
};

export const StepButton = memo(StepButtonImpl);
