import { describe, expect, it, vi } from 'vitest';
import {
  routeShortcutEvent,
  type ShortcutHandlerMap,
  type ShortcutKeyEvent,
} from './useKeyboardShortcuts';

const ev = (over: Partial<ShortcutKeyEvent>): ShortcutKeyEvent => ({
  code: '',
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  repeat: false,
  target: null,
  preventDefault: () => {},
  ...over,
});

describe('routeShortcutEvent', () => {
  it('ignores key-repeat events entirely (hold-to-spam guard)', () => {
    const toggle = vi.fn();
    const handlers: ShortcutHandlerMap = { 'transport.toggle': toggle };
    expect(
      routeShortcutEvent(ev({ code: 'Space', repeat: true }), handlers),
    ).toBeNull();
    expect(toggle).not.toHaveBeenCalled();
    // Same key without repeat fires normally.
    expect(routeShortcutEvent(ev({ code: 'Space' }), handlers)).toBe(
      'transport.toggle',
    );
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('J repeat cannot machine-gun tape stop', () => {
    const tape = vi.fn();
    const handlers: ShortcutHandlerMap = { 'fx.tapeStop': tape };
    routeShortcutEvent(ev({ code: 'KeyJ' }), handlers);
    routeShortcutEvent(ev({ code: 'KeyJ', repeat: true }), handlers);
    routeShortcutEvent(ev({ code: 'KeyJ', repeat: true }), handlers);
    expect(tape).toHaveBeenCalledTimes(1);
  });

  it('H fires Stutter — NOT the help modal', () => {
    const stutter = vi.fn();
    const help = vi.fn();
    const handlers: ShortcutHandlerMap = {
      'fx.stutter': stutter,
      'help.toggle': help,
    };
    expect(routeShortcutEvent(ev({ code: 'KeyH' }), handlers)).toBe('fx.stutter');
    expect(stutter).toHaveBeenCalledTimes(1);
    expect(help).not.toHaveBeenCalled();
  });

  it('Shift+/ ("?") opens help; bare Slash does nothing', () => {
    const help = vi.fn();
    const handlers: ShortcutHandlerMap = { 'help.toggle': help };
    expect(
      routeShortcutEvent(ev({ code: 'Slash', shiftKey: true }), handlers),
    ).toBe('help.toggle');
    expect(routeShortcutEvent(ev({ code: 'Slash' }), handlers)).toBeNull();
    expect(help).toHaveBeenCalledTimes(1);
  });

  it('suspended mode (help modal open) swallows everything incl. Esc/PANIC', () => {
    const panic = vi.fn();
    const handlers: ShortcutHandlerMap = { 'transport.panic': panic };
    expect(
      routeShortcutEvent(ev({ code: 'Escape' }), handlers, { suspended: true }),
    ).toBeNull();
    expect(panic).not.toHaveBeenCalled();
    expect(routeShortcutEvent(ev({ code: 'Escape' }), handlers)).toBe(
      'transport.panic',
    );
  });

  it('inputs — text fields AND sliders — swallow shortcuts', () => {
    const toggle = vi.fn();
    const handlers: ShortcutHandlerMap = { 'transport.toggle': toggle };
    const text = document.createElement('input');
    text.type = 'text';
    expect(
      routeShortcutEvent(ev({ code: 'Space', target: text }), handlers),
    ).toBeNull();
    // Arrow keys on a focused slider must move the slider, not the BPM.
    const range = document.createElement('input');
    range.type = 'range';
    expect(
      routeShortcutEvent(ev({ code: 'Space', target: range }), handlers),
    ).toBeNull();
    expect(toggle).not.toHaveBeenCalled();
    // A plain button target does NOT swallow (Space toggles play).
    const button = document.createElement('button');
    expect(
      routeShortcutEvent(ev({ code: 'Space', target: button }), handlers),
    ).toBe('transport.toggle');
  });

  it('Cmd+Shift+V routes to Repeat Fill, not plain paste', () => {
    const paste = vi.fn();
    const repeat = vi.fn();
    const handlers: ShortcutHandlerMap = {
      'clipboard.paste': paste,
      'clipboard.pasteRepeat': repeat,
    };
    expect(
      routeShortcutEvent(
        ev({ code: 'KeyV', metaKey: true, shiftKey: true }),
        handlers,
      ),
    ).toBe('clipboard.pasteRepeat');
    expect(paste).not.toHaveBeenCalled();
    expect(
      routeShortcutEvent(ev({ code: 'KeyV', metaKey: true }), handlers),
    ).toBe('clipboard.paste');
  });
});
