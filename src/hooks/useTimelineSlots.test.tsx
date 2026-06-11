import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_TIMELINES, createEmptyMutes, createEmptyPattern } from '../constants';
import type { ProjectSnapshot } from '../types/timeline';
import {
  normalizePerformance,
  normalizeSnapshots,
} from './usePerformanceControls';
import { useTimelineSlots } from './useTimelineSlots';

const validSnapshot = (): ProjectSnapshot => ({
  bpm: 120,
  swing: 0,
  loopLength: 16,
  pattern: createEmptyPattern(),
  mutes: createEmptyMutes(),
  performance: normalizePerformance({}),
  snapshots: normalizeSnapshots({}),
});

const renderSlots = (applySnapshot = vi.fn()) =>
  renderHook(() =>
    useTimelineSlots({ getCurrentSnapshot: validSnapshot, applySnapshot }),
  );

describe('useTimelineSlots — broken localStorage data', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('drops a slot whose data is an empty object (no crash, no load)', () => {
    localStorage.setItem(
      STORAGE_KEY_TIMELINES,
      JSON.stringify({
        timelines: { '1': { name: 'x', savedAt: 'x', data: {} } },
        activeTimelineId: '1',
        confirmLoadGuard: false,
      }),
    );
    const applySnapshot = vi.fn();
    const { result } = renderSlots(applySnapshot);

    expect(result.current.timelines['1']).toBeNull();
    expect(result.current.invalidSlots).toContain('1');

    let loaded = true;
    act(() => {
      loaded = result.current.load('1');
    });
    expect(loaded).toBe(false);
    expect(applySnapshot).not.toHaveBeenCalled();
  });

  it('repairs an old-schema slot (pattern only) and loads it normalized', () => {
    localStorage.setItem(
      STORAGE_KEY_TIMELINES,
      JSON.stringify({
        timelines: {
          '2': { name: 'old', savedAt: 'x', data: { pattern: createEmptyPattern() } },
        },
        activeTimelineId: '2',
        confirmLoadGuard: false,
      }),
    );
    const applySnapshot = vi.fn();
    const { result } = renderSlots(applySnapshot);

    expect(result.current.timelines['2']).not.toBeNull();
    expect(result.current.invalidSlots).toHaveLength(0);

    act(() => {
      result.current.load('2');
    });
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    const snap = applySnapshot.mock.calls[0][0] as ProjectSnapshot;
    expect(snap.bpm).toBe(120);
    expect(snap.swing).toBe(0);
    expect(snap.pattern.drums.kick).toHaveLength(64);
  });

  it('completely unparsable storage falls back to empty state', () => {
    localStorage.setItem(STORAGE_KEY_TIMELINES, '{{{not json');
    const { result } = renderSlots();
    expect(result.current.timelines['1']).toBeNull();
    expect(result.current.activeId).toBe('1');
  });

  it('SAVE over an invalid slot heals the warning', () => {
    localStorage.setItem(
      STORAGE_KEY_TIMELINES,
      JSON.stringify({
        timelines: { '1': { name: 'x', savedAt: 'x', data: { broken: true } } },
        activeTimelineId: '1',
        confirmLoadGuard: false,
      }),
    );
    const { result } = renderSlots();
    expect(result.current.invalidSlots).toContain('1');
    act(() => {
      result.current.save('1');
    });
    expect(result.current.invalidSlots).not.toContain('1');
    expect(result.current.timelines['1']).not.toBeNull();
  });
});
