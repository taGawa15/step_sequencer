import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../storage/sampleDb', () => ({
  sampleDb: {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    keys: vi.fn(async () => []),
  },
}));

import { useMicSampler } from './useMicSampler';

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;
  constructor(public stream: { getTracks: () => Array<{ stop: () => void }> }) {
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    void this.onstop?.();
  }
}

describe('useMicSampler — auto-stop state sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    FakeMediaRecorder.instances.length = 0;
    (globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: () => {} }],
        })),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('maxRecordSec auto-stop also resets the recording flag (REC overlay)', async () => {
    const { result } = renderHook(() => useMicSampler());

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.recording).toBe(true);
    expect(FakeMediaRecorder.instances.at(-1)?.state).toBe('recording');

    // default maxRecordSec = 10s → advance past it
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(FakeMediaRecorder.instances.at(-1)?.state).toBe('inactive');
    // The old bug: recorder stopped but recording stayed true.
    expect(result.current.recording).toBe(false);
  });

  it('toggle works in the right direction after an auto-stop', async () => {
    const { result } = renderHook(() => useMicSampler());
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.recording).toBe(false);

    // M key (toggle) should START a new recording now — not "stop".
    await act(async () => {
      result.current.toggleRecording();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.recording).toBe(true);
  });

  it('manual stop clears the auto-stop timer (no late double-stop)', async () => {
    const { result } = renderHook(() => useMicSampler());
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.recording).toBe(false);
    // Advancing past maxRecordSec must not throw or flip state.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.recording).toBe(false);
  });
});
