import { memo } from 'react';
import {
  DRUM_TRACKS,
  STEP_COUNT_PER_PAGE,
  SYNTH_TRACKS,
  hasComponentModifications,
  type LoopLengthType,
} from '../constants';
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
  /** 0-based page index — which 16-step slice to render. */
  stepPage: number;
  loopLength: LoopLengthType;
  onDrumClick: (trackId: DrumTrackId, idx: number) => void;
  onSynthClick: (trackId: SynthTrackId, idx: number) => void;
  onToggleMute: (id: DrumTrackId | SynthTrackId) => void;
}

const StepGridImpl = ({
  pattern,
  mutes,
  currentStep,
  selection,
  stepPage,
  loopLength,
  onDrumClick,
  onSynthClick,
  onToggleMute,
}: Props) => {
  // Slice window: render only the visible 16 steps of the active page.
  const start = stepPage * STEP_COUNT_PER_PAGE;
  const end = start + STEP_COUNT_PER_PAGE;
  // Steps past the current loop length are inert (rendered "outOfLoop")
  // so users can see where the loop ends.

  return (
    <div className={styles.gridScroller}>
      <div className={styles.gridContent}>
        {DRUM_TRACKS.map((track) => {
          const muted = mutes[track.id];
          const highlighted =
            selection?.kind === 'drum' && selection.trackId === track.id;
          const slice = pattern.drums[track.id].slice(start, end);
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
                {slice.map((step, i) => {
                  const globalIdx = start + i;
                  const inLoop = globalIdx < loopLength;
                  return (
                    <StepButton
                      key={globalIdx}
                      index={globalIdx}
                      on={step.active}
                      current={currentStep === globalIdx}
                      selected={
                        selection?.kind === 'drum' &&
                        selection.trackId === track.id &&
                        selection.stepIndex === globalIdx
                      }
                      modified={hasComponentModifications(step.components)}
                      outOfLoop={!inLoop}
                      onClick={() => onDrumClick(track.id, globalIdx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className={styles.divider} aria-hidden />

        {SYNTH_TRACKS.map((track) => {
          const muted = mutes[track.id];
          const highlighted =
            selection?.kind === 'synth' && selection.trackId === track.id;
          const slice = pattern.synths[track.id].slice(start, end);
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
                {slice.map((step, i) => {
                  const globalIdx = start + i;
                  const inLoop = globalIdx < loopLength;
                  return (
                    <SynthStepButton
                      key={globalIdx}
                      index={globalIdx}
                      step={step}
                      current={currentStep === globalIdx}
                      selected={
                        selection?.kind === 'synth' &&
                        selection.trackId === track.id &&
                        selection.stepIndex === globalIdx
                      }
                      modified={hasComponentModifications(step.components)}
                      outOfLoop={!inLoop}
                      onClick={() => onSynthClick(track.id, globalIdx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const StepGrid = memo(StepGridImpl);
