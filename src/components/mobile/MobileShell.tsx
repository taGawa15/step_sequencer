import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import * as Tone from 'tone';
import {
  LOOP_LENGTH_OPTIONS,
  MASTER_VOLUME_MAX,
  MASTER_VOLUME_MIN,
  MAX_BPM,
  MIN_BPM,
  labelForLoopLength,
  type LoopLengthType,
} from '../../constants';
import { SWING_MAX, SWING_MIN } from '../../utils/swing';
import {
  TRACK_GROUPS,
  buildMiniMap,
  confirmQuickSave,
  type TrackGroup,
} from '../../utils/mobileLayout';
import type {
  DrumTrackId,
  MuteMap,
  Pattern,
  Selection,
  SynthTrackId,
  TrackId,
} from '../../types';
import type { TimelineSlot, TimelineSlotId } from '../../types/timeline';
import { TIMELINE_SLOT_IDS } from '../../types/timeline';
import { StepGrid } from '../StepGrid';
import { TAB_LABEL, type BottomTab } from '../BottomEditPanel';
import type { useMobileUI } from '../../hooks/useMobileUI';
import styles from './MobileShell.module.css';

export interface MobileQuickFx {
  beatActive: boolean;
  stutterActive: boolean;
  tapeActive: boolean;
  throwActive: boolean;
  freezeActive: boolean;
  toggleBeatRepeat: () => void;
  toggleStutter: () => void;
  triggerTapeStop: () => void;
  toggleThrow: () => void;
  toggleFreeze: () => void;
}

interface Props {
  mode: 'mobile' | 'mobileLandscape';
  ui: ReturnType<typeof useMobileUI>;
  // transport
  isPlaying: boolean;
  bpm: number;
  swing: number;
  masterVolume: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onSwingChange: (swing: number) => void;
  onMasterVolumeChange: (db: number) => void;
  onPanic: () => void;
  // grid
  pattern: Pattern;
  mutes: MuteMap;
  currentStep: number;
  selection: Selection | null;
  stepPage: number;
  loopLength: LoopLengthType;
  onDrumClick: (trackId: DrumTrackId, idx: number) => void;
  onSynthClick: (trackId: SynthTrackId, idx: number) => void;
  onToggleMute: (id: TrackId) => void;
  onSetStepPage: (page: number) => void;
  onSetLoopLength: (l: LoopLengthType) => void;
  // quick memory
  timelines: Record<TimelineSlotId, TimelineSlot | null>;
  activeMemoryId: TimelineSlotId;
  onMemoryLoad: (id: TimelineSlotId) => void;
  onMemorySave: (id: TimelineSlotId) => void;
  // quick FX (landscape rail)
  fx: MobileQuickFx;
  // sheets
  tabContent: Record<BottomTab, ReactNode>;
  onClearPattern: () => void;
}

const DRAWER_ITEMS: Array<{ tab: BottomTab; label: string }> = [
  { tab: 'perf', label: 'FX PERF' },
  { tab: 'fx', label: 'FX MAIN' },
  { tab: 'sample', label: 'SAMPLE' },
  { tab: 'timeline', label: 'MEMORY / TIMELINE' },
  { tab: 'note', label: 'NOTE EDITOR' },
  { tab: 'step', label: 'STEP FX' },
  { tab: 'mixer', label: 'MIXER' },
  { tab: 'snap', label: 'SCENES' },
  { tab: 'debug', label: 'DEBUG' },
];

/** AudioContext state, polled — the "is sound even possible" indicator. */
const useAudioStatus = (): string => {
  const [state, setState] = useState('unknown');
  useEffect(() => {
    const read = () => {
      try {
        setState(Tone.getContext().state);
      } catch {
        setState('unknown');
      }
    };
    read();
    const id = window.setInterval(read, 1000);
    return () => window.clearInterval(id);
  }, []);
  return state;
};

export const MobileShell = ({
  mode,
  ui,
  isPlaying,
  bpm,
  swing,
  masterVolume,
  onPlay,
  onStop,
  onBpmChange,
  onSwingChange,
  onMasterVolumeChange,
  onPanic,
  pattern,
  mutes,
  currentStep,
  selection,
  stepPage,
  loopLength,
  onDrumClick,
  onSynthClick,
  onToggleMute,
  onSetStepPage,
  onSetLoopLength,
  timelines,
  activeMemoryId,
  onMemoryLoad,
  onMemorySave,
  fx,
  tabContent,
  onClearPattern,
}: Props) => {
  const landscape = mode === 'mobileLandscape';
  const ctxState = useAudioStatus();
  const [loopOpen, setLoopOpen] = useState(false);
  const [memArmed, setMemArmed] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStart = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

  // ── Esc closes the topmost surface (sheet → drawer) ──────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (ui.sheetTab !== null) {
        e.preventDefault();
        ui.closeSheet();
      } else if (ui.drawerOpen) {
        e.preventDefault();
        ui.closeDrawer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  // ── Drawer focus management + light focus trap ───────────────────
  useEffect(() => {
    if (!ui.drawerOpen) return;
    drawerCloseRef.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, [ui.drawerOpen, ui]);

  // Reset transient sheet state whenever the sheet target changes.
  useEffect(() => {
    setSheetExpanded(false);
    setSheetDragY(0);
    sheetDragStart.current = null;
  }, [ui.sheetTab]);

  // ── BPM commit-on-blur (same pattern as desktop Transport) ───────
  const [bpmInput, setBpmInput] = useState(String(bpm));
  useEffect(() => setBpmInput(String(bpm)), [bpm]);
  const commitBpm = () => {
    const parsed = Number(bpmInput);
    if (Number.isFinite(parsed)) {
      onBpmChange(Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed))));
    } else {
      setBpmInput(String(bpm));
    }
  };

  const handleMemorySlot = useCallback(
    (id: TimelineSlotId) => {
      if (memArmed) {
        const hasData = timelines[id] !== null;
        if (confirmQuickSave(id, hasData, (m) => window.confirm(m))) {
          onMemorySave(id);
        }
        setMemArmed(false);
      } else {
        onMemoryLoad(id);
      }
    },
    [memArmed, timelines, onMemoryLoad, onMemorySave],
  );

  const handleTrackTab = useCallback(
    (group: TrackGroup) => ui.setTrackGroup(group),
    [ui],
  );

  // ── Sheet swipe-down dismiss (header drag) ───────────────────────
  const onSheetPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Buttons in the header (expand / CLOSE) must keep their own clicks —
    // capturing here would re-target pointerup and swallow them.
    if ((e.target as HTMLElement).closest('button')) return;
    sheetDragStart.current = e.clientY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* best-effort */
    }
  };
  const onSheetPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (sheetDragStart.current === null) return;
    setSheetDragY(Math.max(0, e.clientY - sheetDragStart.current));
  };
  const onSheetPointerEnd = () => {
    if (sheetDragStart.current === null) return;
    const dy = sheetDragY;
    sheetDragStart.current = null;
    setSheetDragY(0);
    if (dy > 80) ui.closeSheet();
  };

  const miniMap = buildMiniMap(loopLength, stepPage, currentStep);

  // ── Building blocks ──────────────────────────────────────────────

  const statusDot = (
    <span className={styles.status} data-testid="audio-status">
      <span className={styles.statusDot} data-ok={String(ctxState === 'running')} />
      {ctxState === 'running' ? 'AUDIO' : 'TAP PLAY'}
    </span>
  );

  const playButton = (extraClass = '') => (
    <button
      type="button"
      className={`${styles.play} ${isPlaying ? styles.playOn : ''} ${extraClass}`}
      onClick={isPlaying ? onStop : onPlay}
      data-testid="transport-toggle"
    >
      {isPlaying ? 'STOP' : 'PLAY'}
    </button>
  );

  const bpmField = (extraClass = '') => (
    <label className={styles.bpmWrap}>
      <span className={styles.bpmLabel}>BPM</span>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpmInput}
        onChange={(e) => setBpmInput(e.target.value)}
        onBlur={commitBpm}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`${styles.bpmInput} ${extraClass}`}
        data-testid="bpm-input"
      />
    </label>
  );

  const trackTabs = (vertical = false) => (
    <div
      className={styles.trackTabs}
      style={vertical ? { flexDirection: 'column', padding: 0 } : undefined}
      role="tablist"
      aria-label="track group"
    >
      {TRACK_GROUPS.map((g) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={ui.trackGroup === g.id}
          className={[
            styles.trackTab,
            vertical ? styles.railTrackTab : '',
            ui.trackGroup === g.id ? styles.trackTabOn : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => handleTrackTab(g.id)}
        >
          {vertical ? g.label.slice(0, 1) : g.label}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.trackTab} ${vertical ? styles.railTrackTab : ''}`}
        onClick={() => ui.openSheet('sample')}
        aria-label="open sample panel"
      >
        {vertical ? 'S' : 'SMPL'}
      </button>
    </div>
  );

  const memorySlots = (compact = false) => (
    <div className={compact ? styles.railMem : styles.memGroup} data-testid="quick-memory">
      {TIMELINE_SLOT_IDS.map((id) => {
        const slot = timelines[id];
        return (
          <button
            key={id}
            type="button"
            className={[
              styles.memSlot,
              slot ? styles.memSlotFull : '',
              id === activeMemoryId ? styles.memSlotActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleMemorySlot(id)}
            aria-label={`memory ${id} ${memArmed ? 'save' : 'load'}`}
          >
            {id}
          </button>
        );
      })}
    </div>
  );

  const miniMapBar = miniMap.length > 1 && (
    <div className={styles.miniMap} data-testid="mini-map" aria-label="step pages">
      {miniMap.map((item) => (
        <button
          key={item.page}
          type="button"
          className={[
            styles.miniMapSeg,
            item.isActive ? styles.miniMapSegActive : '',
            item.isPlaying ? styles.miniMapSegPlaying : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSetStepPage(item.page)}
          aria-pressed={item.isActive}
          aria-label={`steps ${item.firstStep}–${item.lastStep}`}
        >
          {item.firstStep}–{item.lastStep}
        </button>
      ))}
    </div>
  );

  const grid = (
    <div className={styles.gridArea} data-testid="mobile-grid">
      <StepGrid
        pattern={pattern}
        mutes={mutes}
        currentStep={currentStep}
        selection={selection}
        stepPage={stepPage}
        loopLength={loopLength}
        trackFilter={ui.trackGroup}
        mobile
        onDrumClick={onDrumClick}
        onSynthClick={onSynthClick}
        onToggleMute={onToggleMute}
      />
    </div>
  );

  const loopControl = (
    <>
      <button
        type="button"
        className={styles.loopBtn}
        onClick={() => setLoopOpen((v) => !v)}
        aria-expanded={loopOpen}
        aria-label="loop length"
        data-testid="quick-loop"
      >
        {labelForLoopLength(loopLength)}
      </button>
      {loopOpen && (
        <div className={styles.loopPopover} role="menu" aria-label="loop options">
          {LOOP_LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.steps}
              type="button"
              className={`${styles.loopChip} ${opt.steps === loopLength ? styles.loopChipOn : ''}`}
              onClick={() => {
                onSetLoopLength(opt.steps);
                setLoopOpen(false);
              }}
              aria-pressed={opt.steps === loopLength}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </>
  );

  const fab = (
    <button
      type="button"
      className={styles.fab}
      onClick={ui.toggleDrawer}
      aria-label="メニュー"
      aria-expanded={ui.drawerOpen}
      data-testid="menu-fab"
    >
      ≡
    </button>
  );

  const drawer = (
    <>
      {ui.drawerOpen && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={ui.closeDrawer}
          aria-label="メニューを閉じる"
          data-testid="drawer-backdrop"
        />
      )}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${ui.drawerOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="メニュー"
        aria-hidden={!ui.drawerOpen}
        data-testid="mobile-drawer"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>menu</span>
          <button
            ref={drawerCloseRef}
            type="button"
            className={styles.drawerClose}
            onClick={ui.closeDrawer}
            data-testid="drawer-close"
          >
            CLOSE
          </button>
        </div>
        <div className={styles.drawerBody}>
          {DRAWER_ITEMS.map((item) => (
            <button
              key={item.tab}
              type="button"
              className={styles.drawerItem}
              onClick={() => ui.openSheet(item.tab)}
              data-testid={`drawer-item-${item.tab}`}
            >
              {item.label}
              <span className={styles.drawerItemHint}>›</span>
            </button>
          ))}
          <p className={styles.drawerSection}>view</p>
          <button
            type="button"
            className={styles.drawerItem}
            onClick={() => {
              ui.toggleFocusMode();
            }}
            aria-pressed={ui.focusMode}
          >
            FOCUS MODE
            <span className={styles.drawerItemHint}>{ui.focusMode ? 'ON' : 'OFF'}</span>
          </button>
          <p className={styles.drawerSection}>danger</p>
          <button
            type="button"
            className={`${styles.drawerItem} ${styles.drawerDanger}`}
            onClick={() => {
              if (window.confirm('パターンの全ステップを OFF にしますか？')) {
                onClearPattern();
                ui.closeDrawer();
              }
            }}
          >
            CLEAR PATTERN
          </button>
        </div>
      </div>
    </>
  );

  const sheet = ui.sheetTab !== null && (
    <>
      <button
        type="button"
        className={styles.backdrop}
        onClick={ui.closeSheet}
        aria-label="パネルを閉じる"
        data-testid="sheet-backdrop"
      />
      <div
        className={`${styles.sheet} ${sheetExpanded ? styles.sheetExpanded : ''}`}
        style={sheetDragY > 0 ? { transform: `translateY(${sheetDragY}px)`, transition: 'none' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={TAB_LABEL[ui.sheetTab]}
        data-testid="bottom-sheet"
      >
        <div
          className={styles.sheetHeader}
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerEnd}
          onPointerCancel={onSheetPointerEnd}
        >
          <span className={styles.sheetGrip} aria-hidden />
          <span className={styles.sheetTitle}>{TAB_LABEL[ui.sheetTab]}</span>
          <div className={styles.sheetActions}>
            <button
              type="button"
              className={styles.sheetBtn}
              onClick={() => setSheetExpanded((v) => !v)}
              aria-label={sheetExpanded ? 'シートを縮小' : 'シートを拡大'}
            >
              {sheetExpanded ? '▾' : '▴'}
            </button>
            <button
              type="button"
              className={styles.sheetBtn}
              onClick={ui.closeSheet}
              data-testid="sheet-close"
            >
              CLOSE
            </button>
          </div>
        </div>
        <div className={styles.sheetBody} data-testid="sheet-body">
          {tabContent[ui.sheetTab]}
        </div>
      </div>
    </>
  );

  // ── Landscape (Mobile Performance Mode) ──────────────────────────
  if (landscape) {
    return (
      <div
        className={`${styles.shell} ${styles.shellLandscape}`}
        data-testid="mobile-shell"
        data-mode="mobileLandscape"
      >
        <div className={styles.railLeft}>
          {playButton(styles.railPlay)}
          {bpmField(styles.railBpm)}
          {statusDot}
          {trackTabs(true)}
          <div style={{ position: 'relative' }}>{loopControl}</div>
          {memorySlots(true)}
        </div>

        <div className={styles.landscapeMain}>
          {miniMapBar}
          {grid}
        </div>

        <div className={styles.railRight} data-testid="quick-fx">
          <button
            type="button"
            className={styles.railFx}
            onClick={() => ui.openSheet('fx')}
            aria-label="filter / fx main"
          >
            FILTER
          </button>
          <button
            type="button"
            className={`${styles.railFx} ${fx.beatActive ? styles.railFxOn : ''}`}
            onClick={fx.toggleBeatRepeat}
            aria-pressed={fx.beatActive}
          >
            REPEAT
          </button>
          <button
            type="button"
            className={`${styles.railFx} ${fx.stutterActive ? styles.railFxOn : ''}`}
            onClick={fx.toggleStutter}
            aria-pressed={fx.stutterActive}
          >
            STUTTER
          </button>
          <button
            type="button"
            className={`${styles.railFx} ${fx.tapeActive ? styles.railFxOn : ''}`}
            onClick={fx.triggerTapeStop}
            disabled={fx.tapeActive}
            aria-pressed={fx.tapeActive}
          >
            TAPE
          </button>
          <button
            type="button"
            className={`${styles.railFx} ${fx.throwActive ? styles.railFxOn : ''}`}
            onClick={fx.toggleThrow}
            aria-pressed={fx.throwActive}
          >
            THROW
          </button>
          <button
            type="button"
            className={`${styles.railFx} ${fx.freezeActive ? styles.railFxOn : ''}`}
            onClick={fx.toggleFreeze}
            aria-pressed={fx.freezeActive}
          >
            FREEZE
          </button>
          <button type="button" className={styles.panic} onClick={onPanic}>
            PANIC
          </button>
        </div>

        {fab}
        {drawer}
        {sheet}
      </div>
    );
  }

  // ── Portrait ─────────────────────────────────────────────────────
  return (
    <div className={styles.shell} data-testid="mobile-shell" data-mode="mobile">
      <div className={styles.transport}>
        {playButton()}
        {bpmField()}
        {statusDot}
        <button type="button" className={styles.panic} onClick={onPanic} aria-label="panic">
          PANIC
        </button>
      </div>

      {!ui.focusMode && (
        <div className={styles.transportRow2}>
          <label className={styles.miniSlider}>
            <span className={styles.miniSliderLabel}>SWING</span>
            <input
              type="range"
              min={SWING_MIN}
              max={SWING_MAX}
              step={1}
              value={swing}
              onChange={(e) => onSwingChange(Number(e.target.value))}
              aria-label="swing"
            />
            <span className={styles.miniSliderValue}>{swing}%</span>
          </label>
          <label className={styles.miniSlider}>
            <span className={styles.miniSliderLabel}>VOL</span>
            <input
              type="range"
              min={MASTER_VOLUME_MIN}
              max={MASTER_VOLUME_MAX}
              step={0.5}
              value={masterVolume}
              onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
              aria-label="master volume"
            />
            <span className={styles.miniSliderValue}>{masterVolume.toFixed(1)}</span>
          </label>
        </div>
      )}

      {miniMapBar}
      {grid}
      {trackTabs()}

      {!ui.focusMode && (
        <div className={styles.quickBar} data-testid="quick-bar">
          <div style={{ position: 'relative' }}>{loopControl}</div>
          {memorySlots()}
          <button
            type="button"
            className={`${styles.memArm} ${memArmed ? styles.memArmOn : ''}`}
            onClick={() => setMemArmed((v) => !v)}
            aria-pressed={memArmed}
            aria-label="memory save mode"
          >
            {memArmed ? 'SLOT…' : 'SAVE'}
          </button>
          <button
            type="button"
            className={styles.focusBtn}
            onClick={ui.toggleFocusMode}
            aria-pressed={ui.focusMode}
            aria-label="focus mode"
          >
            FOCUS
          </button>
        </div>
      )}

      {ui.focusMode && (
        <button
          type="button"
          className={styles.focusExit}
          onClick={ui.toggleFocusMode}
          data-testid="focus-exit"
        >
          EXIT FOCUS
        </button>
      )}

      {fab}
      {drawer}
      {sheet}
    </div>
  );
};
