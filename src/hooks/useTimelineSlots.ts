import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY_TIMELINES } from '../constants';
import type {
  ProjectSnapshot,
  TimelineSlot,
  TimelineSlotId,
  TimelineState,
} from '../types/timeline';
import { TIMELINE_SLOT_IDS } from '../types/timeline';

const emptyState = (): TimelineState => ({
  timelines: { '1': null, '2': null, '3': null, '4': null },
  activeTimelineId: '1',
  confirmLoadGuard: true,
});

const loadState = (): TimelineState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINES);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TimelineState>;
      const result = emptyState();
      if (parsed.timelines && typeof parsed.timelines === 'object') {
        for (const id of TIMELINE_SLOT_IDS) {
          const v = (parsed.timelines as Record<string, unknown>)[id];
          if (v && typeof v === 'object') {
            result.timelines[id] = v as TimelineSlot;
          }
        }
      }
      if (
        typeof parsed.activeTimelineId === 'string' &&
        TIMELINE_SLOT_IDS.includes(parsed.activeTimelineId as TimelineSlotId)
      ) {
        result.activeTimelineId = parsed.activeTimelineId as TimelineSlotId;
      }
      if (typeof parsed.confirmLoadGuard === 'boolean') {
        result.confirmLoadGuard = parsed.confirmLoadGuard;
      }
      return result;
    }
  } catch {
    /* ignore */
  }
  return emptyState();
};

interface Args {
  /** Returns a snapshot of everything we want to persist into a slot. */
  getCurrentSnapshot: () => ProjectSnapshot;
  /** Pushes a snapshot back into all the live state hooks. */
  applySnapshot: (snap: ProjectSnapshot) => void;
}

export const useTimelineSlots = ({ getCurrentSnapshot, applySnapshot }: Args) => {
  const [state, setState] = useState<TimelineState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TIMELINES, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const select = useCallback((id: TimelineSlotId) => {
    setState((prev) => ({ ...prev, activeTimelineId: id }));
  }, []);

  const save = useCallback(
    (id?: TimelineSlotId) => {
      setState((prev) => {
        const slotId = id ?? prev.activeTimelineId;
        const slot: TimelineSlot = {
          name: prev.timelines[slotId]?.name ?? `Timeline ${slotId}`,
          savedAt: new Date().toISOString(),
          data: getCurrentSnapshot(),
        };
        return {
          ...prev,
          timelines: { ...prev.timelines, [slotId]: slot },
          activeTimelineId: slotId,
        };
      });
    },
    [getCurrentSnapshot],
  );

  const load = useCallback(
    (id?: TimelineSlotId) => {
      const slotId = id ?? state.activeTimelineId;
      const slot = state.timelines[slotId];
      if (!slot) return false;
      if (state.confirmLoadGuard) {
        const ok = window.confirm(
          `Load Timeline ${slotId}?\n現在の編集内容は失われます。`,
        );
        if (!ok) return false;
      }
      applySnapshot(slot.data);
      setState((prev) => ({ ...prev, activeTimelineId: slotId }));
      return true;
    },
    [applySnapshot, state.activeTimelineId, state.confirmLoadGuard, state.timelines],
  );

  const duplicate = useCallback(() => {
    setState((prev) => {
      const sourceSlot = prev.timelines[prev.activeTimelineId];
      if (!sourceSlot) return prev;
      // Pick the next empty slot, wrapping around.
      const idx = TIMELINE_SLOT_IDS.indexOf(prev.activeTimelineId);
      for (let off = 1; off <= TIMELINE_SLOT_IDS.length; off++) {
        const target =
          TIMELINE_SLOT_IDS[(idx + off) % TIMELINE_SLOT_IDS.length];
        if (!prev.timelines[target]) {
          return {
            ...prev,
            timelines: {
              ...prev.timelines,
              [target]: {
                ...sourceSlot,
                name: `Timeline ${target}`,
                savedAt: new Date().toISOString(),
                data: JSON.parse(
                  JSON.stringify(sourceSlot.data),
                ) as ProjectSnapshot,
              },
            },
            activeTimelineId: target,
          };
        }
      }
      return prev; // all slots full
    });
  }, []);

  const clear = useCallback((id?: TimelineSlotId) => {
    setState((prev) => {
      const slotId = id ?? prev.activeTimelineId;
      return {
        ...prev,
        timelines: { ...prev.timelines, [slotId]: null },
      };
    });
  }, []);

  const setConfirmLoadGuard = useCallback((on: boolean) => {
    setState((prev) => ({ ...prev, confirmLoadGuard: on }));
  }, []);

  return {
    timelines: state.timelines,
    activeId: state.activeTimelineId,
    confirmLoadGuard: state.confirmLoadGuard,
    select,
    save,
    load,
    duplicate,
    clear,
    setConfirmLoadGuard,
  };
};
