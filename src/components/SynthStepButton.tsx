import { memo } from 'react';
import { parseNote } from '../scales';
import type { SynthStep, SynthTrackId } from '../types';
import styles from './SynthStepButton.module.css';

interface Props {
  trackId: SynthTrackId;
  index: number;
  step: SynthStep;
  current: boolean;
  selected: boolean;
  modified: boolean;
  outOfLoop?: boolean;
  /** Stable callback — see StepButton for the memo() rationale. */
  onStepClick: (trackId: SynthTrackId, index: number) => void;
}

const SynthStepButtonImpl = ({
  trackId,
  index,
  step,
  current,
  selected,
  modified,
  outOfLoop,
  onStepClick,
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
    outOfLoop ? styles.outOfLoop : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={() => onStepClick(trackId, index)}
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
