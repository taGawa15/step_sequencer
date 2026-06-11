import { describe, expect, it, vi } from 'vitest';

// createPendingSamplePlayer never touches Tone — an empty mock keeps the
// module import (and thus jsdom) away from real WebAudio.
vi.mock('tone', () => ({}));

import { createPendingSamplePlayer } from './samplePlayer';

describe('createPendingSamplePlayer (loading sentinel)', () => {
  it('is not ready', () => {
    expect(createPendingSamplePlayer().ready).toBe(false);
  });

  it('every method is a safe no-op — deleting a sample mid-load cannot throw', () => {
    const sentinel = createPendingSamplePlayer();
    expect(() => {
      sentinel.trigger(0, 1);
      sentinel.setGain(0.5);
      sentinel.setPitch(3);
      sentinel.setTrim(0.1, 0.5);
      sentinel.dispose(); // ← the old cast-based sentinel crashed here
      sentinel.dispose(); // double-dispose is fine too
    }).not.toThrow();
  });
});
