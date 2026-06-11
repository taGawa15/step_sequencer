import { useEffect, useState, type ReactNode } from 'react';
import { STORAGE_KEY_UI } from '../constants';
import type { Viewport } from '../hooks/useViewport';
import styles from './BottomEditPanel.module.css';

export type BottomTab =
  | 'mixer'
  | 'note'
  | 'step'
  | 'fx'
  | 'perf'
  | 'snap'
  | 'timeline'
  | 'sample'
  | 'debug';

const TAB_LABEL: Record<BottomTab, string> = {
  mixer: 'MIXER',
  note: 'NOTE',
  step: 'STEP FX',
  fx: 'FX MAIN',
  perf: 'FX PERF',
  snap: 'SNAP',
  timeline: 'TIMELINE',
  sample: 'SAMPLE',
  debug: 'DEBUG',
};

/** Compact labels used on mobile so 9 tabs fit without overflow. */
const TAB_LABEL_MOBILE: Record<BottomTab, string> = {
  mixer: 'MIX',
  note: 'NOTE',
  step: 'STEP',
  fx: 'FX',
  perf: 'PERF',
  snap: 'SNAP',
  timeline: 'TL',
  sample: 'SMPL',
  debug: 'DBG',
};

const TABS_BY_VIEWPORT: Record<Viewport, BottomTab[]> = {
  // Desktop side columns already host mixer (left) and fx (right) so
  // the bottom panel carries step-edit + clipboard + perf-FX tabs.
  desktop: ['note', 'step', 'timeline', 'perf', 'sample', 'debug'],
  tablet: ['mixer', 'note', 'step', 'timeline', 'perf', 'sample', 'debug'],
  // Mobile has no side columns — split FX into MAIN / PERF tabs to keep
  // each tab content compact (panels scroll internally when needed).
  mobile: ['mixer', 'note', 'step', 'fx', 'perf', 'snap', 'timeline', 'sample', 'debug'],
};

const ALL_TABS: readonly BottomTab[] = [
  'mixer', 'note', 'step', 'fx', 'perf', 'snap', 'timeline', 'sample', 'debug',
];

interface UIState {
  bottomTab: BottomTab;
}

const loadUIState = (): UIState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UI);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UIState>;
      if (
        typeof parsed.bottomTab === 'string' &&
        (ALL_TABS as readonly string[]).includes(parsed.bottomTab)
      ) {
        return { bottomTab: parsed.bottomTab as BottomTab };
      }
    }
  } catch {
    /* ignore */
  }
  return { bottomTab: 'note' };
};

interface Props {
  viewport: Viewport;
  /** Whether the synth-only NOTE tab makes sense (drum step has no pitch). */
  noteTabEnabled: boolean;
  /** Per-tab content. The panel renders only the active tab's slot. */
  tabContent: Record<BottomTab, ReactNode>;
}

/**
 * Bottom-fixed panel with viewport-aware tabs. Tab state is persisted to
 * localStorage. When a viewport change drops the current tab from the
 * available set, we fall back to the first tab.
 */
export const BottomEditPanel = ({ viewport, noteTabEnabled, tabContent }: Props) => {
  const [tab, setTab] = useState<BottomTab>(() => loadUIState().bottomTab);
  const availableTabs = TABS_BY_VIEWPORT[viewport].filter(
    (t) => t !== 'note' || noteTabEnabled,
  );

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_UI, JSON.stringify({ bottomTab: tab }));
    } catch {
      /* ignore */
    }
  }, [tab]);

  // Fall back if current tab not in viewport's available set
  useEffect(() => {
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0] ?? 'note');
    }
  }, [availableTabs, tab]);

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar} role="tablist">
        {availableTabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tab}
            className={`${styles.tab} ${t === tab ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            <span className={styles.labelFull}>{TAB_LABEL[t]}</span>
            <span className={styles.labelShort}>{TAB_LABEL_MOBILE[t]}</span>
          </button>
        ))}
      </div>
      <div className={styles.body}>{tabContent[tab]}</div>
    </div>
  );
};
