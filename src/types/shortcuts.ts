export type ShortcutAction =
  | 'transport.toggle'
  | 'transport.panic'
  | 'transport.toggleSelected'
  | 'bpm.up'
  | 'bpm.down'
  | 'bpm.up5'
  | 'bpm.down5'
  | 'page.prev'
  | 'page.next'
  | 'loop.x2'
  | 'loop.x4'
  | 'loop.x8'
  | 'loop.x16'
  | 'loop.x32'
  | 'loop.x64'
  | 'loop.shorter'
  | 'loop.longer'
  | 'clipboard.copy'
  | 'clipboard.paste'
  | 'clipboard.pasteRepeat'
  | 'clipboard.duplicate'
  | 'clipboard.undo'
  | 'track.1'
  | 'track.2'
  | 'track.3'
  | 'track.4'
  | 'track.5'
  | 'track.6'
  | 'track.7'
  | 'track.8'
  | 'timeline.select1'
  | 'timeline.select2'
  | 'timeline.select3'
  | 'timeline.select4'
  | 'timeline.load1'
  | 'timeline.load2'
  | 'timeline.load3'
  | 'timeline.load4'
  | 'timeline.save'
  | 'kill.low'
  | 'kill.mid'
  | 'kill.high'
  | 'fx.filterReset'
  | 'fx.delayToggle'
  | 'fx.reverbToggle'
  | 'sample.recordToggle'
  | 'help.toggle';

export interface ShortcutDescriptor {
  id: string;
  label: string;
  /** Human-readable hint shown in UI, e.g. "Space" or "⇧A". */
  hint: string;
  /** event.code values that trigger this shortcut. */
  codes: readonly string[];
  modifiers?: {
    shift?: boolean;
    meta?: boolean; // Cmd on mac / Win key
    ctrl?: boolean;
  };
  action: ShortcutAction;
  group:
    | 'transport'
    | 'bpm'
    | 'page'
    | 'loop'
    | 'track'
    | 'timeline'
    | 'performance'
    | 'sample'
    | 'clipboard'
    | 'help';
}
