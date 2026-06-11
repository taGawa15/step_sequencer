import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import {
  clearErrors,
  copyTextToClipboard,
  estimateLocalStorageBytes,
  formatErrorsForCodex,
  getErrors,
  type AppErrorEntry,
} from '../utils/errorLog';
import styles from './DebugPanel.module.css';

export interface FxStatusRow {
  name: string;
  active: boolean;
  detail: string;
  /** Wall-clock ms of the last engage, or null if never triggered. */
  last: number | null;
}

interface Props {
  /** UI-side BPM state (what the BPM input shows). */
  bpmState: number;
  swing: number;
  isPlaying: boolean;
  currentStep: number;
  /** Per-FX live status (active / params / last trigger). */
  fxStatus: FxStatusRow[];
  /** Set when an FX was engaged but couldn't reach the audio graph. */
  fxWarning: string | null;
  /** False until the master audio graph exists. */
  routingOk: boolean;
}

interface DebugSnapshot {
  contextState: string;
  transportState: string;
  bpmActual: string;
  memoryMb: string;
  storageKb: number;
  errors: AppErrorEntry[];
}

const readDebugSnapshot = (): DebugSnapshot => {
  let contextState = 'unknown';
  let transportState = 'unknown';
  let bpmActual = '-';
  try {
    contextState = Tone.getContext().state;
    transportState = Tone.getTransport().state;
    bpmActual = Tone.getTransport().bpm.value.toFixed(1);
  } catch {
    /* Tone not ready */
  }
  // Chrome-only heap estimate; absent elsewhere.
  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize: number } }
  ).memory;
  return {
    contextState,
    transportState,
    bpmActual,
    memoryMb: memory ? (memory.usedJSHeapSize / (1024 * 1024)).toFixed(1) : 'n/a',
    storageKb: Math.round(estimateLocalStorageBytes() / 1024),
    errors: getErrors(),
  };
};

/**
 * Live diagnostics: audio engine state, perf gauges and the persistent
 * error log, with one-click copy in a review-friendly markdown format.
 */
export const DebugPanel = ({
  bpmState,
  swing,
  isPlaying,
  currentStep,
  fxStatus,
  fxWarning,
  routingOk,
}: Props) => {
  const [snap, setSnap] = useState<DebugSnapshot>(readDebugSnapshot);
  const [fps, setFps] = useState(0);
  const [copied, setCopied] = useState(false);

  // Refresh engine/storage info on a slow tick while the panel is open.
  useEffect(() => {
    const id = window.setInterval(() => setSnap(readDebugSnapshot()), 500);
    return () => window.clearInterval(id);
  }, []);

  // FPS estimate: count rAF callbacks per second while mounted.
  const frameRef = useRef({ count: 0, last: performance.now() });
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const f = frameRef.current;
      f.count += 1;
      const now = performance.now();
      if (now - f.last >= 1000) {
        setFps(Math.round((f.count * 1000) / (now - f.last)));
        f.count = 0;
        f.last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCopy = useCallback(async () => {
    const report = formatErrorsForCodex({
      audioContext: snap.contextState,
      transport: snap.transportState,
      'bpm(actual)': snap.bpmActual,
      'bpm(ui)': String(bpmState),
      swing: `${swing}%`,
      playing: String(isPlaying),
      currentStep: String(currentStep),
      fps: String(fps),
      memory: `${snap.memoryMb} MB`,
      routing: routingOk ? 'connected' : 'NOT CONNECTED',
      fx: fxStatus
        .map((f) => `${f.name}=${f.active ? 'ON' : 'off'}(${f.detail})`)
        .join(' | '),
    });
    const ok = await copyTextToClipboard(report);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2000);
  }, [snap, bpmState, swing, isPlaying, currentStep, fps, routingOk, fxStatus]);

  const handleClear = useCallback(() => {
    clearErrors();
    setSnap(readDebugSnapshot());
  }, []);

  const lastError = snap.errors[0] ?? null;

  return (
    <section className={styles.panel} aria-label="debug panel">
      <header className={styles.header}>
        <span className={styles.title}>debug</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleCopy}
            data-testid="debug-copy"
          >
            {copied ? 'COPIED ✓' : 'COPY LOG'}
          </button>
          <button type="button" className={styles.btn} onClick={handleClear}>
            CLEAR
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        <Stat label="AudioContext" value={snap.contextState} testId="debug-ctx" />
        <Stat label="Transport" value={snap.transportState} />
        <Stat label="BPM (actual)" value={snap.bpmActual} testId="debug-bpm" />
        <Stat label="BPM (UI)" value={String(bpmState)} />
        <Stat label="Swing" value={`${swing}%`} />
        <Stat label="Playing" value={isPlaying ? 'yes' : 'no'} />
        <Stat label="Step" value={currentStep < 0 ? '-' : String(currentStep + 1)} />
        <Stat label="FPS" value={String(fps)} />
        <Stat label="Memory" value={`${snap.memoryMb} MB`} />
        <Stat label="localStorage" value={`~${snap.storageKb} KB`} />
      </div>

      {/* ── Performance FX live status ─────────────────────────────── */}
      <div className={styles.errorBox} data-testid="debug-fx">
        <div className={styles.errorTitle}>
          performance fx — routing:{' '}
          <span className={routingOk ? styles.fxOk : styles.fxBad}>
            {routingOk ? 'connected' : 'NOT CONNECTED'}
          </span>
        </div>
        {fxWarning && (
          <div className={styles.fxWarning} data-testid="debug-fx-warning">
            ⚠ {fxWarning}
          </div>
        )}
        <div className={styles.fxList}>
          {fxStatus.map((f) => (
            <div key={f.name} className={styles.fxRow}>
              <span
                className={`${styles.fxDot} ${f.active ? styles.fxDotOn : ''}`}
                aria-hidden
              />
              <span className={styles.fxName}>{f.name}</span>
              <span className={styles.fxDetail}>{f.detail}</span>
              <span className={styles.fxLast}>
                {f.last === null
                  ? '—'
                  : `${Math.max(0, Math.round((Date.now() - f.last) / 1000))}s前`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.errorBox}>
        <div className={styles.errorTitle}>
          errors ({snap.errors.length})
          {lastError && (
            <span className={styles.errorLast}> — last: {lastError.type}</span>
          )}
        </div>
        <div className={styles.errorList} data-testid="debug-errors">
          {snap.errors.length === 0 && (
            <div className={styles.errorEmpty}>記録されたエラーはありません</div>
          )}
          {snap.errors.slice(0, 10).map((e, i) => (
            <div key={`${e.time}-${i}`} className={styles.errorItem}>
              <span className={styles.errorMeta}>
                [{e.time.slice(11, 19)}] {e.type}
              </span>
              <span className={styles.errorMsg}>{e.message}</span>
            </div>
          ))}
        </div>
      </div>

      <p className={styles.note}>
        ※ DevTools コンソールに表示される「Self-XSS」警告（“コードを貼り付けないで…”）
        はブラウザ標準の注意書きで、このアプリのクラッシュではありません。
        COPY LOG の内容をそのままレビュー（Codex / Claude）に貼り付けできます。
      </p>
    </section>
  );
};

const Stat = ({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) => (
  <div className={styles.stat}>
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue} data-testid={testId}>
      {value}
    </span>
  </div>
);
