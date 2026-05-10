import { TRACKS } from '../constants';
import type { MuteMap, TrackId } from '../types';
import type { TrackSends } from '../types/audio';
import styles from './MixerPanel.module.css';

interface Props {
  sends: TrackSends;
  mutes: MuteMap;
  onSetSend: (trackId: TrackId, kind: 'delay' | 'reverb', value: number) => void;
  onToggleMute: (id: TrackId) => void;
}

export const MixerPanel = ({ sends, mutes, onSetSend, onToggleMute }: Props) => (
  <section className={styles.panel} aria-label="track mixer">
    <header className={styles.header}>
      <span className={styles.title}>mixer</span>
      <span className={styles.legend}>M · DLY · REV</span>
    </header>
    <div className={styles.list}>
      {TRACKS.map((t) => {
        const muted = mutes[t.id];
        const send = sends[t.id];
        return (
          <div key={t.id} className={styles.row}>
            <span className={styles.trackName}>{t.label}</span>
            <button
              type="button"
              className={`${styles.mute} ${muted ? styles.muteOn : ''}`}
              onClick={() => onToggleMute(t.id)}
              aria-pressed={muted}
              aria-label={`mute ${t.label}`}
            >
              M
            </button>
            <SendSlider
              kind="DLY"
              value={send.delay}
              onChange={(v) => onSetSend(t.id, 'delay', v)}
            />
            <SendSlider
              kind="REV"
              value={send.reverb}
              onChange={(v) => onSetSend(t.id, 'reverb', v)}
            />
          </div>
        );
      })}
    </div>
  </section>
);

const SendSlider = ({
  kind,
  value,
  onChange,
}: {
  kind: 'DLY' | 'REV';
  value: number;
  onChange: (v: number) => void;
}) => (
  <div className={styles.send}>
    <span className={styles.sendLabel}>{kind}</span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={styles.slider}
      aria-label={`${kind} send`}
    />
    <span className={styles.sendValue}>{value.toFixed(2)}</span>
  </div>
);
