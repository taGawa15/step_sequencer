import { memo } from 'react';
import { parseNote } from '../scales';
import type { SynthStep } from '../types';
import styles from './SynthStepButton.module.css';

interface Props {
  index: number;
  step: SynthStep;
  current: boolean;
  selected: boolean;
  modified: boolean;
  onClick: () => void;
}

const SynthStepButtonImpl = ({
  index,
  step,
  current,
  selected,
  modified,
  onClick,
}: Props) => {
  const isDownbeat = index % 4 === 0;
  const { name, octave } = parseNote(step.note);

  const className = [
    styles.step,
    isDownbeat ? styles.downbeat : '',
    step.active ? styles.on : '',
    current ? styles.current : '',
    selected ? styles.selected : '',
    modified ? styles.modified : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-pressed={step.active}
      aria-label={`step ${index + 1}${step.active ? ` ${step.note}` : ''}`}
    >
      {step.active ? (
        <span className={styles.note}>
          <span className={styles.noteName}>{name}</span>
          <span className={styles.noteOctave}>{octave}</span>
        </span>
      ) : null}
    </button>
  );
};

export const SynthStepButton = memo(SynthStepButtonImpl);
