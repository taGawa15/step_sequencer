import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMobileUI } from './useMobileUI';

describe('useMobileUI (mobile layout state)', () => {
  it('boots with everything closed and DRUM selected', () => {
    const { result } = renderHook(() => useMobileUI());
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.sheetTab).toBeNull();
    expect(result.current.focusMode).toBe(false);
    expect(result.current.trackGroup).toBe('drum');
  });

  it('drawer opens and closes', () => {
    const { result } = renderHook(() => useMobileUI());
    act(() => result.current.openDrawer());
    expect(result.current.drawerOpen).toBe(true);
    act(() => result.current.closeDrawer());
    expect(result.current.drawerOpen).toBe(false);
    act(() => result.current.toggleDrawer());
    expect(result.current.drawerOpen).toBe(true);
  });

  it('bottom sheet opens per tab and closes', () => {
    const { result } = renderHook(() => useMobileUI());
    act(() => result.current.openSheet('sample'));
    expect(result.current.sheetTab).toBe('sample');
    act(() => result.current.closeSheet());
    expect(result.current.sheetTab).toBeNull();
  });

  it('drawer and sheet are mutually exclusive (grid never double-occluded)', () => {
    const { result } = renderHook(() => useMobileUI());
    act(() => result.current.openDrawer());
    act(() => result.current.openSheet('fx'));
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.sheetTab).toBe('fx');
    act(() => result.current.openDrawer());
    expect(result.current.sheetTab).toBeNull();
    expect(result.current.drawerOpen).toBe(true);
  });

  it('focus mode clears every overlay', () => {
    const { result } = renderHook(() => useMobileUI());
    act(() => result.current.openSheet('debug'));
    act(() => result.current.toggleFocusMode());
    expect(result.current.focusMode).toBe(true);
    expect(result.current.sheetTab).toBeNull();
    expect(result.current.drawerOpen).toBe(false);
    act(() => result.current.toggleFocusMode());
    expect(result.current.focusMode).toBe(false);
  });

  it('active track group switches', () => {
    const { result } = renderHook(() => useMobileUI());
    act(() => result.current.setTrackGroup('bass'));
    expect(result.current.trackGroup).toBe('bass');
    act(() => result.current.setTrackGroup('lead'));
    expect(result.current.trackGroup).toBe('lead');
  });
});
