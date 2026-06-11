/**
 * Vitest setup: jsdom is missing a few browser APIs the app touches.
 * Everything here is a minimal stand-in — audio behavior itself is
 * covered by mocking 'tone' per test file, not by emulating WebAudio.
 */

// React 18 act() environment for @testing-library renderHook.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Blob object URLs (used by the mic sampler).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:vitest-${Math.random().toString(36).slice(2)}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

// matchMedia (useViewport) — non-matching stub is fine for unit tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
