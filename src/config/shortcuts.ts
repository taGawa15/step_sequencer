import type { ShortcutDescriptor } from '../types/shortcuts';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const cmdLabel = isMac ? '⌘' : 'Ctrl';

export const SHORTCUTS: readonly ShortcutDescriptor[] = [
  // ── Transport ──
  { id: 'transport.toggle', label: 'Play / Stop', hint: 'Space', codes: ['Space'], action: 'transport.toggle', group: 'transport' },
  { id: 'transport.panic', label: 'Panic', hint: 'Esc', codes: ['Escape'], action: 'transport.panic', group: 'transport' },
  { id: 'transport.toggleSelected', label: 'Selected step ON/OFF', hint: 'Enter', codes: ['Enter'], action: 'transport.toggleSelected', group: 'transport' },

  // ── BPM ──
  { id: 'bpm.up', label: 'BPM +1', hint: '↑', codes: ['ArrowUp'], action: 'bpm.up', group: 'bpm' },
  { id: 'bpm.down', label: 'BPM -1', hint: '↓', codes: ['ArrowDown'], action: 'bpm.down', group: 'bpm' },
  { id: 'bpm.up5', label: 'BPM +5', hint: '⇧↑', codes: ['ArrowUp'], modifiers: { shift: true }, action: 'bpm.up5', group: 'bpm' },
  { id: 'bpm.down5', label: 'BPM -5', hint: '⇧↓', codes: ['ArrowDown'], modifiers: { shift: true }, action: 'bpm.down5', group: 'bpm' },

  // ── Page ──
  { id: 'page.prev', label: 'Prev step page', hint: '⇧←', codes: ['ArrowLeft'], modifiers: { shift: true }, action: 'page.prev', group: 'page' },
  { id: 'page.next', label: 'Next step page', hint: '⇧→', codes: ['ArrowRight'], modifiers: { shift: true }, action: 'page.next', group: 'page' },

  // ── Loop ──
  // Action IDs kept for back-compat. Display labels show the new naming.
  { id: 'loop.x2', label: 'Loop ×0.5', hint: 'Q', codes: ['KeyQ'], action: 'loop.x2', group: 'loop' },
  { id: 'loop.x4', label: 'Loop ×1', hint: 'W', codes: ['KeyW'], action: 'loop.x4', group: 'loop' },
  { id: 'loop.x8', label: 'Loop ×2', hint: 'E', codes: ['KeyE'], action: 'loop.x8', group: 'loop' },
  { id: 'loop.x16', label: 'Loop ×4', hint: 'R', codes: ['KeyR'], action: 'loop.x16', group: 'loop' },
  { id: 'loop.x32', label: 'Loop ×8', hint: 'T', codes: ['KeyT'], action: 'loop.x32', group: 'loop' },
  { id: 'loop.x64', label: 'Loop ×16', hint: 'Y', codes: ['KeyY'], action: 'loop.x64', group: 'loop' },
  { id: 'loop.shorter', label: 'Loop shorter', hint: '[', codes: ['BracketLeft'], action: 'loop.shorter', group: 'loop' },
  { id: 'loop.longer', label: 'Loop longer', hint: ']', codes: ['BracketRight'], action: 'loop.longer', group: 'loop' },

  // ── Tracks ──
  { id: 'track.1', label: 'Track Kick', hint: '1', codes: ['Digit1'], action: 'track.1', group: 'track' },
  { id: 'track.2', label: 'Track Snare', hint: '2', codes: ['Digit2'], action: 'track.2', group: 'track' },
  { id: 'track.3', label: 'Track CH', hint: '3', codes: ['Digit3'], action: 'track.3', group: 'track' },
  { id: 'track.4', label: 'Track OH', hint: '4', codes: ['Digit4'], action: 'track.4', group: 'track' },
  { id: 'track.5', label: 'Track Clap', hint: '5', codes: ['Digit5'], action: 'track.5', group: 'track' },
  { id: 'track.6', label: 'Track Perc', hint: '6', codes: ['Digit6'], action: 'track.6', group: 'track' },
  { id: 'track.7', label: 'Track Bass', hint: '7', codes: ['Digit7'], action: 'track.7', group: 'track' },
  { id: 'track.8', label: 'Track Lead', hint: '8', codes: ['Digit8'], action: 'track.8', group: 'track' },

  // ── Timeline ──
  { id: 'timeline.select1', label: 'Timeline 1', hint: 'A', codes: ['KeyA'], action: 'timeline.select1', group: 'timeline' },
  { id: 'timeline.select2', label: 'Timeline 2', hint: 'S', codes: ['KeyS'], action: 'timeline.select2', group: 'timeline' },
  { id: 'timeline.select3', label: 'Timeline 3', hint: 'D', codes: ['KeyD'], action: 'timeline.select3', group: 'timeline' },
  { id: 'timeline.select4', label: 'Timeline 4', hint: 'F', codes: ['KeyF'], action: 'timeline.select4', group: 'timeline' },
  { id: 'timeline.load1', label: 'Load Timeline 1', hint: '⇧A', codes: ['KeyA'], modifiers: { shift: true }, action: 'timeline.load1', group: 'timeline' },
  { id: 'timeline.load2', label: 'Load Timeline 2', hint: '⇧S', codes: ['KeyS'], modifiers: { shift: true }, action: 'timeline.load2', group: 'timeline' },
  { id: 'timeline.load3', label: 'Load Timeline 3', hint: '⇧D', codes: ['KeyD'], modifiers: { shift: true }, action: 'timeline.load3', group: 'timeline' },
  { id: 'timeline.load4', label: 'Load Timeline 4', hint: '⇧F', codes: ['KeyF'], modifiers: { shift: true }, action: 'timeline.load4', group: 'timeline' },
  { id: 'timeline.save', label: 'Save current timeline', hint: `${cmdLabel}S`, codes: ['KeyS'], modifiers: { meta: !isMac ? false : true, ctrl: !isMac }, action: 'timeline.save', group: 'timeline' },

  // ── Performance ──
  { id: 'kill.low', label: 'Kill Low', hint: 'Z', codes: ['KeyZ'], action: 'kill.low', group: 'performance' },
  { id: 'kill.mid', label: 'Kill Mid', hint: 'X', codes: ['KeyX'], action: 'kill.mid', group: 'performance' },
  { id: 'kill.high', label: 'Kill High', hint: 'C', codes: ['KeyC'], action: 'kill.high', group: 'performance' },
  { id: 'fx.filterReset', label: 'Filter Sweep → 0', hint: 'V', codes: ['KeyV'], action: 'fx.filterReset', group: 'performance' },
  { id: 'fx.delayToggle', label: 'Delay On/Off', hint: 'B', codes: ['KeyB'], action: 'fx.delayToggle', group: 'performance' },
  { id: 'fx.reverbToggle', label: 'Reverb On/Off', hint: 'N', codes: ['KeyN'], action: 'fx.reverbToggle', group: 'performance' },

  // ── Sample ──
  { id: 'sample.recordToggle', label: 'Record start/stop', hint: 'M', codes: ['KeyM'], action: 'sample.recordToggle', group: 'sample' },

  // ── Performance FX ──
  { id: 'fx.beatRepeat', label: 'Beat Repeat', hint: 'G', codes: ['KeyG'], action: 'fx.beatRepeat', group: 'performance' },
  { id: 'fx.stutter', label: 'Stutter Gate', hint: 'H', codes: ['KeyH'], action: 'fx.stutter', group: 'performance' },
  { id: 'fx.tapeStop', label: 'Tape Stop', hint: 'J', codes: ['KeyJ'], action: 'fx.tapeStop', group: 'performance' },

  // ── Clipboard ──
  { id: 'clipboard.copy', label: 'Copy current loop', hint: `${cmdLabel}C`, codes: ['KeyC'], modifiers: { meta: isMac, ctrl: !isMac }, action: 'clipboard.copy', group: 'clipboard' },
  { id: 'clipboard.paste', label: 'Paste at cursor', hint: `${cmdLabel}V`, codes: ['KeyV'], modifiers: { meta: isMac, ctrl: !isMac }, action: 'clipboard.paste', group: 'clipboard' },
  { id: 'clipboard.pasteRepeat', label: 'Paste Repeat Fill', hint: `⇧${cmdLabel}V`, codes: ['KeyV'], modifiers: { meta: isMac, ctrl: !isMac, shift: true }, action: 'clipboard.pasteRepeat', group: 'clipboard' },
  { id: 'clipboard.duplicate', label: 'Duplicate (append)', hint: `${cmdLabel}D`, codes: ['KeyD'], modifiers: { meta: isMac, ctrl: !isMac }, action: 'clipboard.duplicate', group: 'clipboard' },
  { id: 'clipboard.undo', label: 'Undo last paste', hint: `${cmdLabel}Z`, codes: ['KeyZ'], modifiers: { meta: isMac, ctrl: !isMac }, action: 'clipboard.undo', group: 'clipboard' },

  // ── Help ──
  { id: 'help.toggle', label: 'Show shortcuts', hint: '?', codes: ['Slash', 'KeyH'], modifiers: { shift: false }, action: 'help.toggle', group: 'help' },
];
