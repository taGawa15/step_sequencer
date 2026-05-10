import { useEffect, useRef, useState } from 'react';
import { DRUM_TRACKS } from '../constants';
import type { DrumTrackId } from '../types';
import type { SampleMetadata } from '../types/sample';
import styles from './MicSamplingPanel.module.css';

interface Props {
  permission: 'unknown' | 'granted' | 'denied' | 'unsupported';
  recording: boolean;
  maxRecordSec: number;
  samples: SampleMetadata[];
  error: string | null;
  onSetMaxRecordSec: (sec: number) => void;
  onToggleRecord: () => void;
  onRename: (id: string, name: string) => void;
  onUpdate: (id: string, patch: Partial<SampleMetadata>) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, trackId: DrumTrackId | null) => void;
}

const MAX_OPTIONS = [3, 5, 10, 30];

export const MicSamplingPanel = ({
  permission,
  recording,
  maxRecordSec,
  samples,
  error,
  onSetMaxRecordSec,
  onToggleRecord,
  onRename,
  onUpdate,
  onDelete,
  onAssign,
}: Props) => {
  return (
    <section className={styles.panel} aria-label="mic sampling panel">
      <header className={styles.header}>
        <span className={styles.title}>sample</span>
        <span className={styles.permState}>
          {permission === 'unsupported' ? 'NOT SUPPORTED' : `MIC: ${permission}`}
        </span>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.recordRow}>
        <button
          type="button"
          className={`${styles.recordBtn} ${recording ? styles.recording : ''}`}
          onClick={onToggleRecord}
          disabled={permission === 'unsupported'}
        >
          {recording ? '■ STOP' : '● REC'}
        </button>
        <div className={styles.maxSec}>
          <span className={styles.maxLabel}>MAX</span>
          {MAX_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.maxChoice} ${
                maxRecordSec === s ? styles.maxChoiceOn : ''
              }`}
              onClick={() => onSetMaxRecordSec(s)}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {samples.length === 0 && (
          <div className={styles.empty}>
            録音したサンプルはここに並びます
          </div>
        )}
        {samples.map((s) => (
          <SampleRow
            key={s.id}
            sample={s}
            onRename={(name) => onRename(s.id, name)}
            onUpdate={(p) => onUpdate(s.id, p)}
            onDelete={() => onDelete(s.id)}
            onAssign={(t) => onAssign(s.id, t)}
          />
        ))}
      </div>
    </section>
  );
};

const SampleRow = ({
  sample,
  onRename,
  onUpdate,
  onDelete,
  onAssign,
}: {
  sample: SampleMetadata;
  onRename: (name: string) => void;
  onUpdate: (patch: Partial<SampleMetadata>) => void;
  onDelete: () => void;
  onAssign: (trackId: DrumTrackId | null) => void;
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [name, setName] = useState(sample.name);

  useEffect(() => setName(sample.name), [sample.name]);

  const preview = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  };

  return (
    <div className={styles.row}>
      <input
        className={styles.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onRename(name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
      />
      <span className={styles.duration}>{sample.durationSec.toFixed(1)}s</span>

      <button type="button" className={styles.smallBtn} onClick={preview}>
        ▶
      </button>

      <select
        className={styles.assign}
        value={sample.assignedTo ?? ''}
        onChange={(e) =>
          onAssign(
            e.target.value === '' ? null : (e.target.value as DrumTrackId),
          )
        }
        aria-label="assign to track"
      >
        <option value="">— assign —</option>
        {DRUM_TRACKS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>GAIN</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sample.gain}
          onChange={(e) => onUpdate({ gain: Number(e.target.value) })}
        />
        <span className={styles.knobVal}>{sample.gain.toFixed(2)}</span>
      </div>
      <div className={styles.knob}>
        <span className={styles.knobLabel}>PITCH</span>
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={sample.pitch}
          onChange={(e) => onUpdate({ pitch: Number(e.target.value) })}
        />
        <span className={styles.knobVal}>
          {sample.pitch > 0 ? `+${sample.pitch}` : sample.pitch}
        </span>
      </div>

      <button
        type="button"
        className={`${styles.smallBtn} ${styles.danger}`}
        onClick={onDelete}
      >
        ×
      </button>

      <audio ref={audioRef} src={sample.url} preload="auto" />
    </div>
  );
};
