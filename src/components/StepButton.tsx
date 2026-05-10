import { memo } from 'react';
import styles from './StepButton.module.css';

interface Props {
  index: number;
  on: boolean;
  current: boolean;
  selected: boolean;
  /** True when this step has any non-default step component / plock. */
  modified: boolean;
  /** Step is past the current loopLength — visually muted. */
  outOfLoop?: boolean;
  onClick: () => void;
}

const StepButtonImpl = ({
  index,
  on,
  current,
  selected,
  modified,
  outOfLoop,
  onClick,
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
      onClick={onClick}
      aria-pressed={on}
      aria-label={`step ${index + 1}`}
    />
  );
};

export const StepButton = memo(StepButtonImpl);
