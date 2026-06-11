import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startMock = vi.fn(async () => {});
const resumeMock = vi.fn(async () => {});
const ctx = { state: 'suspended' as string, resume: resumeMock };

vi.mock('tone', () => ({
  start: () => startMock(),
  getContext: () => ({ rawContext: ctx }),
}));

import { installAudioUnlock, unlockAudio } from './audioUnlock';

describe('unlockAudio (iOS gesture unlock)', () => {
  beforeEach(() => {
    startMock.mockClear();
    resumeMock.mockClear();
    ctx.state = 'suspended';
  });

  it('calls Tone.start() FIRST, then resumes a suspended raw context', async () => {
    const order: string[] = [];
    startMock.mockImplementationOnce(async () => {
      order.push('start');
    });
    resumeMock.mockImplementationOnce(async () => {
      order.push('resume');
    });
    await unlockAudio();
    expect(order).toEqual(['start', 'resume']);
  });

  it('does not resume a context that is already running', async () => {
    ctx.state = 'running';
    await unlockAudio();
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(resumeMock).not.toHaveBeenCalled();
  });

  it('swallows a rejected Tone.start (called outside a gesture)', async () => {
    startMock.mockRejectedValueOnce(new Error('not allowed'));
    await expect(unlockAudio()).resolves.toBeDefined();
  });
});

describe('installAudioUnlock (first-gesture wiring)', () => {
  afterEach(() => {
    startMock.mockClear();
    resumeMock.mockClear();
  });

  it('unlocks on the first pointerdown and the uninstaller detaches listeners', async () => {
    const uninstall = installAudioUnlock();
    document.dispatchEvent(new Event('pointerdown'));
    // microtask flush for the async unlock
    await Promise.resolve();
    await Promise.resolve();
    expect(startMock).toHaveBeenCalled();
    uninstall();
    startMock.mockClear();
    document.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(startMock).not.toHaveBeenCalled();
  });
});
