import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../config/shortcuts';
import type { ShortcutAction, ShortcutDescriptor } from '../types/shortcuts';

export type ShortcutHandlerMap = Partial<Record<ShortcutAction, () => void>>;

export interface ShortcutOptions {
  /**
   * When true (e.g. while the Help modal is open) every global shortcut
   * is ignored. The modal handles its own Escape, so closing Help can
   * never fire PANIC.
   */
  suspended?: boolean;
}

/**
 * Structural subset of KeyboardEvent — lets unit tests drive the router
 * with plain objects instead of real DOM events.
 */
export interface ShortcutKeyEvent {
  code: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  repeat: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
}

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  // EVERY input swallows shortcuts — including range sliders, where the
  // arrow keys must adjust the slider, not the BPM.
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const matchesShortcut = (
  e: ShortcutKeyEvent,
  s: ShortcutDescriptor,
): boolean => {
  if (!s.codes.includes(e.code)) return false;
  const want = s.modifiers ?? {};
  // Treat undefined as "don't care", false as "must be off", true as "must be on"
  if (want.shift !== undefined && e.shiftKey !== want.shift) return false;
  // For meta/ctrl we OR them by default (any platform's "command")
  if (want.meta || want.ctrl) {
    const hasModifier = e.metaKey || e.ctrlKey;
    if (!hasModifier) return false;
  } else {
    // No modifier expected → reject if cmd/ctrl is held
    if (e.metaKey || e.ctrlKey) return false;
  }
  return true;
};

/**
 * Pure shortcut router (exported for unit tests). Returns the action id
 * that was dispatched, or null when nothing matched.
 */
export const routeShortcutEvent = (
  e: ShortcutKeyEvent,
  handlers: ShortcutHandlerMap,
  options: ShortcutOptions = {},
): ShortcutAction | null => {
  if (options.suspended) return null;
  // Holding a key must never machine-gun an action (Space → Play/Stop
  // flapping, J → tape-stop BPM corruption, Shift+A → confirm spam).
  if (e.repeat) return null;
  if (isEditableTarget(e.target)) return null;
  for (const s of SHORTCUTS) {
    if (matchesShortcut(e, s)) {
      const h = handlers[s.action];
      if (h) {
        e.preventDefault();
        h();
        return s.action;
      }
    }
  }
  return null;
};

/**
 * Binds ONE stable window keydown listener and routes matched shortcuts
 * to the caller's handler map. Handlers/options are read through refs so
 * re-renders never re-register the listener.
 */
export const useKeyboardShortcuts = (
  handlers: ShortcutHandlerMap,
  options: ShortcutOptions = {},
) => {
  const handlersRef = useRef(handlers);
  const optionsRef = useRef(options);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      routeShortcutEvent(e, handlersRef.current, optionsRef.current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};
