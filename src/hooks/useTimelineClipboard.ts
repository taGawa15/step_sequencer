import { useCallback, useRef, useState } from 'react';
import type { LoopLengthType } from '../constants';
import type { Pattern, TrackId } from '../types';
import {
  applySteps,
  copySteps,
  type CopyScope,
  type PasteMode,
  type StepClipboard,
} from '../utils/stepClipboard';

interface Args {
  /** Live pattern getter — passed each call so we always copy fresh data. */
  getPattern: () => Pattern;
  /** Live loop length getter. */
  getLoopLength: () => LoopLengthType;
  /** Replaces the live pattern (timeline applySnapshot uses the same). */
  replacePattern: (next: Pattern) => void;
  /** Updates the loop length when Append extends it. */
  setLoopLength: (steps: LoopLengthType) => void;
  /** Currently selected track for `selectedTrack` scope. */
  getSelectedTrack: () => TrackId | null;
}

/**
 * In-session clipboard for step ranges, with a single-level paste undo.
 * Clipboard data is intentionally NOT persisted — its lifetime is the
 * current tab session. The previous pattern is snapshotted just before
 * a paste so Undo can revert exactly the last operation.
 */
export const useTimelineClipboard = ({
  getPattern,
  getLoopLength,
  replacePattern,
  setLoopLength,
  getSelectedTrack,
}: Args) => {
  const [clipboard, setClipboard] = useState<StepClipboard | null>(null);
  const undoSnapshotRef = useRef<{
    pattern: Pattern;
    loopLength: LoopLengthType;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const copy = useCallback(
    (scope: CopyScope = 'all') => {
      const loopLength = getLoopLength();
      const clip = copySteps({
        pattern: getPattern(),
        startStep: 0,
        length: loopLength,
        loopLength,
        scope,
        selectedTrackId: getSelectedTrack(),
      });
      setClipboard(clip);
    },
    [getLoopLength, getPattern, getSelectedTrack],
  );

  const captureUndo = useCallback(() => {
    undoSnapshotRef.current = {
      pattern: JSON.parse(JSON.stringify(getPattern())) as Pattern,
      loopLength: getLoopLength(),
    };
    setCanUndo(true);
  }, [getPattern, getLoopLength]);

  const paste = useCallback(
    (destStart: number, mode: PasteMode) => {
      if (!clipboard) return;
      captureUndo();
      const result = applySteps({
        pattern: getPattern(),
        clip: clipboard,
        destStart,
        mode,
        loopLength: getLoopLength(),
      });
      replacePattern(result.pattern);
      if (result.loopLength !== getLoopLength()) {
        setLoopLength(result.loopLength as LoopLengthType);
      }
    },
    [
      clipboard,
      captureUndo,
      getPattern,
      getLoopLength,
      replacePattern,
      setLoopLength,
    ],
  );

  /** Common shortcut: paste the clip tiled across the whole loop. */
  const pasteRepeatFill = useCallback(() => {
    paste(0, 'repeatFill');
  }, [paste]);

  /** Append the current loop after itself, doubling the structure. */
  const duplicateAppend = useCallback(() => {
    // Capture-then-copy ensures we copy the LIVE state at this moment,
    // not whatever was previously copied.
    const loopLength = getLoopLength();
    const clip = copySteps({
      pattern: getPattern(),
      startStep: 0,
      length: loopLength,
      loopLength,
      scope: 'all',
      selectedTrackId: null,
    });
    setClipboard(clip);
    captureUndo();
    const result = applySteps({
      pattern: getPattern(),
      clip,
      destStart: loopLength,
      mode: 'append',
      loopLength,
    });
    replacePattern(result.pattern);
    if (result.loopLength !== loopLength) {
      setLoopLength(result.loopLength as LoopLengthType);
    }
  }, [
    captureUndo,
    getLoopLength,
    getPattern,
    replacePattern,
    setLoopLength,
  ]);

  const undo = useCallback(() => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    replacePattern(snap.pattern);
    setLoopLength(snap.loopLength);
    undoSnapshotRef.current = null;
    setCanUndo(false);
  }, [replacePattern, setLoopLength]);

  return {
    clipboard,
    canUndo,
    copy,
    paste,
    pasteRepeatFill,
    duplicateAppend,
    undo,
  };
};
