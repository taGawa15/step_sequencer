import { useEffect } from 'react';
import { SHORTCUTS } from '../config/shortcuts';
import type { ShortcutAction, ShortcutDescriptor } from '../types/shortcuts';

export type ShortcutHandlerMap = Partial<Record<ShortcutAction, () => void>>;

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const matches = (e: KeyboardEvent, s: ShortcutDescriptor): boolean => {
  if (!s.codes.includes(e.code)) return false;
  const want = s.modifiers ?? {};
  // Treat undefined as "don't care", false as "must be off", true as "must be on"
  if (want.shift !== undefined && e.shiftKey !== want.shift) return false;
  // For meta/ctrl we OR them by default (any platform's "command")
  if (want.meta || want.ctrl) {
    const wantsModifier = !!(want.meta || want.ctrl);
    const hasModifier = e.metaKey || e.ctrlKey;
    if (wantsModifier !== hasModifier) return false;
  } else {
    // No modifier expected → reject if cmd/ctrl is held
    if (e.metaKey || e.ctrlKey) return false;
  }
  return true;
};

/**
 * Binds the global keydown listener and routes matched shortcuts to the
 * caller's handler map. Inputs/textareas/selects/contenteditable elements
 * are treated as text fields and bypassed.
 */
export const useKeyboardShortcuts = (handlers: ShortcutHandlerMap) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      // `?` is Shift+Slash on US layout — handle specially so users can hit it
      // without thinking about modifiers.
      const isHelpKey =
        (e.code === 'Slash' && e.shiftKey) ||
        (e.code === 'KeyH' && !e.shiftKey && !e.metaKey && !e.ctrlKey);
      if (isHelpKey) {
        const h = handlers['help.toggle'];
        if (h) {
          e.preventDefault();
          h();
          return;
        }
      }
      for (const s of SHORTCUTS) {
        if (s.id === 'help.toggle') continue; // handled above
        if (matches(e, s)) {
          const h = handlers[s.action];
          if (h) {
            e.preventDefault();
            h();
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
};
