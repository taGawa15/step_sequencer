import { memo } from 'react';
import { DRUM_TRACKS, SYNTH_TRACKS, hasComponentModifications } from '../constants';
import type {
  DrumTrackId,
  Pattern,
  Selection,
  SynthTrackId,
  MuteMap,
} from '../types';
import { StepButton } from './StepButton';
import { SynthStepButton } from './SynthStepButton';
import styles from './StepGrid.module.css';

interface Props {
  pattern: Pattern;
  mutes: MuteMap;
  currentStep: number;
  selection: Selection | null;
  onDrumClick: (trackId: DrumTrackId, idx: number) => void;
  onSynthClick: (trackId: SynthTrackId, idx: number) => void;
  onToggleMute: (id: DrumTrackId | SynthTrackId) => void;
}

const StepGridImpl = ({
  pattern,
  mutes,
  currentStep,
  selection,
  onDrumClick,
  onSynthClick,
  onToggleMute,
}: Props) => {
  return (
    <div className={styles.gridScroller}>
      <div className={styles.gridContent}>
        {DRUM_TRACKS.map((track) => {
          const muted = mutes[track.id];
          const highlighted =
            selection?.kind === 'drum' && selection.trackId === track.id;
          return (
            <div
              key={track.id}
              className={[
                styles.row,
                muted ? styles.muted : '',
                highlighted ? styles.highlighted : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.label}>
                <span className={styles.labelFull}>{track.label}</span>
                <span className={styles.labelShort}>{track.shortLabel}</span>
                <button
                  type="button"
                  className={`${styles.mute} ${muted ? styles.muteOn : ''}`}
                  onClick={() => onToggleMute(track.id)}
                  aria-pressed={muted}
                  aria-label={`mute ${track.label}`}
                >
                  M
                </button>
              </div>
              <div className={styles.steps}>
                {pattern.drums[track.id].map((step, i) => (
                  <StepButton
                    key={i}
                    index={i}
                    on={step.active}
                    current={currentStep === i}
                    selected={
                      selection?.kind === 'drum' &&
                      selection.trackId === track.id &&
                      selection.stepIndex === i
                    }
                    modified={hasComponentModifications(step.components)}
                    onClick={() => onDrumClick(track.id, i)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className={styles.divider} aria-hidden />

        {SYNTH_TRACKS.map((track) => {
          const muted = mutes[track.id];
          const highlighted =
            selection?.kind === 'synth' && selection.trackId === track.id;
          return (
            <div
              key={track.id}
              className={[
                styles.row,
                muted ? styles.muted : '',
                highlighted ? styles.highlighted : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.label}>
                <span className={styles.labelFull}>{track.label}</span>
                <span className={styles.labelShort}>{track.shortLabel}</span>
                <button
                  type="button"
                  className={`${styles.mute} ${muted ? styles.muteOn : ''}`}
                  onClick={() => onToggleMute(track.id)}
                  aria-pressed={muted}
                  aria-label={`mute ${track.label}`}
                >
                  M
                </button>
              </div>
              <div className={styles.steps}>
                {pattern.synths[track.id].map((step, i) => (
                  <SynthStepButton
                    key={i}
                    index={i}
                    step={step}
                    current={currentStep === i}
                    selected={
                      selection?.kind === 'synth' &&
                      selection.trackId === track.id &&
                      selection.stepIndex === i
                    }
                    modified={hasComponentModifications(step.components)}
                    onClick={() => onSynthClick(track.id, i)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const StepGrid = memo(StepGridImpl);
