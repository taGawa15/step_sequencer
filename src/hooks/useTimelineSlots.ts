import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY_TIMELINES } from '../constants';
import type {
  ProjectSnapshot,
  TimelineSlot,
  TimelineSlotId,
  TimelineState,
} from '../types/timeline';
import { TIMELINE_SLOT_IDS } from '../types/timeline';
import { normalizeTimelineSlot } from '../utils/projectSnapshot';
import { addError } from '../utils/errorLog';

const emptyState = (): TimelineState => ({
  timelines: { '1': null, '2': null, '3': null, '4': null },
  activeTimelineId: '1',
  confirmLoadGuard: true,
});

interface LoadResult {
  state: TimelineState;
  /** Slots whose stored data existed but could not be repaired. */
  invalidSlots: TimelineSlotId[];
}

const loadState = (): LoadResult => {
  const invalidSlots: TimelineSlotId[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINES);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TimelineState>;
      const result = emptyState();
      if (parsed.timelines && typeof parsed.timelines === 'object') {
        for (const id of TIMELINE_SLOT_IDS) {
          const v = (parsed.timelines as Record<string, unknown>)[id];
          if (v === null || v === undefined) continue;
          // Validate + normalize instead of blind-casting. Old schemas are
          // repaired where possible; irreparable data is dropped so a LOAD
          // can never push undefined into the live app state.
          const slot = normalizeTimelineSlot(v);
          if (slot) {
            result.timelines[id] = slot;
          } else {
            invalidSlots.push(id);
            addError({
              type: 'manual',
              message: `Timeline slot ${id} was dropped: stored data is an old or broken format`,
            });
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
      return { state: result, invalidSlots };
    }
  } catch {
    /* fall through to empty */
  }
  return { state: emptyState(), invalidSlots };
};

interface Args {
  /** Returns a snapshot of everything we want to persist into a slot. */
  getCurrentSnapshot: () => ProjectSnapshot;
  /** Pushes a snapshot back into all the live state hooks. */
  applySnapshot: (snap: ProjectSnapshot) => void;
}

export const useTimelineSlots = ({ getCurrentSnapshot, applySnapshot }: Args) => {
  const [initial] = useState(loadState);
  const [state, setState] = useState<TimelineState>(initial.state);
  /** Non-empty when stored slots had to be discarded at startup. */
  const [invalidSlots, setInvalidSlots] = useState<TimelineSlotId[]>(
    initial.invalidSlots,
  );

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
      const slotId = id ?? state.activeTimelineId;
      const slot: TimelineSlot = {
        name: state.timelines[slotId]?.name ?? `Timeline ${slotId}`,
        savedAt: new Date().toISOString(),
        data: getCurrentSnapshot(),
      };
      setState((prev) => ({
        ...prev,
        timelines: { ...prev.timelines, [slotId]: slot },
        activeTimelineId: slotId,
      }));
      // Saving over a previously-invalid slot heals it.
      setInvalidSlots((prev) => prev.filter((s) => s !== slotId));
    },
    [getCurrentSnapshot, state.activeTimelineId, state.timelines],
  );

  const load = useCallback(
    (id?: TimelineSlotId): boolean => {
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
    invalidSlots,
    select,
    save,
    load,
    duplicate,
    clear,
    setConfirmLoadGuard,
  };
};
