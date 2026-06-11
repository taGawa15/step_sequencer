import * as Tone from 'tone';

/**
 * iOS Safari audio unlock.
 *
 * iOS starts every AudioContext suspended and only lets a USER GESTURE
 * resume it — and the resume must be kicked off synchronously inside that
 * gesture, before any `await`. iOS also "interrupts" the context after a
 * phone call / Siri / route change, dropping it back to suspended; it has
 * to be resumed again on the next touch.
 *
 * `unlockAudio()` is the canonical sequence (Tone.start first, raw resume
 * as backup) and is safe to call repeatedly. `installAudioUnlock()` wires
 * it to the first interaction and to interruption recovery.
 */
export const unlockAudio = async (): Promise<string> => {
  // Tone.start() resumes Tone's context; calling it FIRST keeps the
  // resume inside the gesture frame on iOS.
  try {
    await Tone.start();
  } catch {
    /* may reject if called outside a gesture — the listeners retry */
  }
  try {
    const raw = Tone.getContext().rawContext as AudioContext;
    if (raw && raw.state !== 'running') {
      await raw.resume();
    }
    return raw?.state ?? 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * Attach first-gesture unlock + interruption recovery. Returns an
 * uninstaller. Idempotent listeners self-remove once the context is
 * running; the statechange watcher stays for interruption recovery.
 */
export const installAudioUnlock = (): (() => void) => {
  let unlocked = false;

  const tryUnlock = () => {
    // Fire-and-forget — the gesture's synchronous Tone.start() is what
    // matters; the await only settles the post-state.
    void unlockAudio().then((state) => {
      if (state === 'running') unlocked = true;
    });
  };

  // capture:true so we unlock even if an inner handler stops propagation.
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  const events: Array<keyof DocumentEventMap> = [
    'pointerdown',
    'touchend',
    'mousedown',
    'keydown',
  ];
  events.forEach((evt) => document.addEventListener(evt, tryUnlock, opts));

  // Interruption recovery: when iOS suspends mid-session, the next touch
  // resumes — but also try proactively on visibility regain.
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && unlocked) void unlockAudio();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    events.forEach((evt) => document.removeEventListener(evt, tryUnlock, opts));
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
