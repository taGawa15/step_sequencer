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
  /**
   * Which rows to render. Mobile shows one group at a time so each cell
   * gets a real tap target instead of 8 rows of 16 px dots.
   */
  trackFilter?: 'all' | 'drum' | 'bass' | 'lead';
  /** Mobile sizing: tall touch cells, tighter labels. */
  mobile?: boolean;
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
  trackFilter = 'all',
  mobile = false,
  onDrumClick,
  onSynthClick,
  onToggleMute,
}: Props) => {
  // Slice window: render only the visible 16 steps of the active page.
  const start = stepPage * STEP_COUNT_PER_PAGE;
  const end = start + STEP_COUNT_PER_PAGE;
  // Steps past the current loop length are inert (rendered "outOfLoop")
  // so users can see where the loop ends.

  const drumTracks = trackFilter === 'all' || trackFilter === 'drum' ? DRUM_TRACKS : [];
  const synthTracks = SYNTH_TRACKS.filter((t) =>
    trackFilter === 'all' ? true : trackFilter === t.id,
  );
  const synthAlone = drumTracks.length === 0 && synthTracks.length > 0;

  return (
    <div className={`${styles.gridScroller} ${mobile ? styles.mobileScroller : ''}`}>
      <div className={`${styles.gridContent} ${mobile ? styles.mobileContent : ''}`}>
        {drumTracks.map((track) => {
          const muted = mutes[track.id];
          const highlighted =
            selection?.kind === 'drum' && selection.trackId === track.id;
          const slice = pattern.drums[track.id].slice(start, end);
          return (
            <div
              key={track.id}
              className={[
                styles.row,
                mobile ? styles.mobileRow : '',
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
              <div className={`${styles.steps} ${mobile ? styles.mobileSteps : ''}`}>
                {slice.map((step, i) => {
                  const globalIdx = start + i;
                  const inLoop = globalIdx < loopLength;
                  return (
                    <StepButton
                      key={globalIdx}
                      trackId={track.id}
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
                      onStepClick={onDrumClick}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {drumTracks.length > 0 && synthTracks.length > 0 && (
          <div className={styles.divider} aria-hidden />
        )}

        {synthTracks.map((track) => {
          const muted = mutes[track.id];
          const highlighted =
            selection?.kind === 'synth' && selection.trackId === track.id;
          const slice = pattern.synths[track.id].slice(start, end);
          return (
            <div
              key={track.id}
              className={[
                styles.row,
                mobile ? styles.mobileRow : '',
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
              <div
                className={[
                  styles.steps,
                  mobile ? styles.mobileSteps : '',
                  mobile && synthAlone ? styles.mobileStepsTall : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {slice.map((step, i) => {
                  const globalIdx = start + i;
                  const inLoop = globalIdx < loopLength;
                  return (
                    <SynthStepButton
                      key={globalIdx}
                      trackId={track.id}
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
                      onStepClick={onSynthClick}
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
