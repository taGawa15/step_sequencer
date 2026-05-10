import { useCallback, useEffect, useState } from 'react';
import type { RootId, ScaleId } from '../utils/musicTheory';

const STORAGE_KEY = 'step-sequencer:note-editor:v1';

export interface NoteEditorState {
  root: RootId;
  scale: ScaleId;
  scaleLock: boolean;
}

const DEFAULT: NoteEditorState = {
  root: 'C',
  scale: 'major',
  scaleLock: false,
};

const VALID_ROOTS = new Set([
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]);
const VALID_SCALES = new Set(['major', 'minor', 'pentatonic', 'chromatic']);

const load = (): NoteEditorState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NoteEditorState>;
      return {
        root: VALID_ROOTS.has(parsed.root as string) ? (parsed.root as RootId) : DEFAULT.root,
        scale: VALID_SCALES.has(parsed.scale as string) ? (parsed.scale as ScaleId) : DEFAULT.scale,
        scaleLock: typeof parsed.scaleLock === 'boolean' ? parsed.scaleLock : DEFAULT.scaleLock,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT;
};

export const useNoteEditor = () => {
  const [state, setState] = useState<NoteEditorState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setRoot = useCallback((root: RootId) => {
    setState((prev) => ({ ...prev, root }));
  }, []);
  const setScale = useCallback((scale: ScaleId) => {
    setState((prev) => ({ ...prev, scale }));
  }, []);
  const toggleScaleLock = useCallback(() => {
    setState((prev) => ({ ...prev, scaleLock: !prev.scaleLock }));
  }, []);

  return {
    ...state,
    setRoot,
    setScale,
    toggleScaleLock,
  };
};
