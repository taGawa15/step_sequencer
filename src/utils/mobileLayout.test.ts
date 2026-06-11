import { describe, expect, it, vi } from 'vitest';
import {
  buildMiniMap,
  computeLayoutMode,
  confirmQuickSave,
  isMobileLike,
} from './mobileLayout';

describe('computeLayoutMode (breakpoints + orientation detection)', () => {
  it('classifies the required verification sizes', () => {
    expect(computeLayoutMode(375, 667)).toBe('mobile'); // iPhone SE 縦
    expect(computeLayoutMode(390, 844)).toBe('mobile'); // iPhone 14 縦
    expect(computeLayoutMode(844, 390)).toBe('mobileLandscape'); // iPhone 14 横
    expect(computeLayoutMode(412, 915)).toBe('mobile'); // Android 縦
    expect(computeLayoutMode(915, 412)).toBe('mobileLandscape'); // Android 横
    expect(computeLayoutMode(768, 1024)).toBe('tablet'); // iPad 縦
    expect(computeLayoutMode(1024, 768)).toBe('desktop'); // iPad 横
  });

  it('phone landscape beats the tablet width band', () => {
    // 844 wide would be "tablet" by width alone — but it's a sideways phone
    expect(computeLayoutMode(844, 390)).toBe('mobileLandscape');
    expect(computeLayoutMode(667, 375)).toBe('mobileLandscape'); // SE 横
  });

  it('landscape mode requires landscape AND short AND sub-desktop', () => {
    expect(computeLayoutMode(1300, 450)).toBe('desktop'); // wide monitor, short window
    expect(computeLayoutMode(900, 600)).toBe('tablet'); // landscape but not short
    expect(computeLayoutMode(390, 300)).toBe('mobileLandscape'); // tiny landscape window
    expect(computeLayoutMode(390, 500)).toBe('mobile'); // portrait stays mobile
  });

  it('isMobileLike covers both phone modes only', () => {
    expect(isMobileLike('mobile')).toBe(true);
    expect(isMobileLike('mobileLandscape')).toBe(true);
    expect(isMobileLike('tablet')).toBe(false);
    expect(isMobileLike('desktop')).toBe(false);
  });
});

describe('buildMiniMap (step page mini map)', () => {
  it('one segment per 16-step page with active + playing flags', () => {
    const map = buildMiniMap(64, 1, 35); // viewing page 2, playhead on page 3
    expect(map).toHaveLength(4);
    expect(map[1].isActive).toBe(true);
    expect(map[2].isPlaying).toBe(true);
    expect(map[0].firstStep).toBe(1);
    expect(map[0].lastStep).toBe(16);
    expect(map[3].firstStep).toBe(49);
    expect(map[3].lastStep).toBe(64);
  });

  it('stopped playhead (-1) marks no page as playing', () => {
    expect(buildMiniMap(32, 0, -1).every((i) => !i.isPlaying)).toBe(true);
  });

  it('short loops collapse to a single full segment', () => {
    const map = buildMiniMap(4, 0, 2);
    expect(map).toHaveLength(1);
    expect(map[0].lastStep).toBe(4);
    expect(map[0].isActive).toBe(true);
    expect(map[0].isPlaying).toBe(true);
  });

  it('garbage loop length falls back to one page', () => {
    expect(buildMiniMap(Number.NaN, 0, -1)).toHaveLength(1);
  });
});

describe('confirmQuickSave (quick memory action guard)', () => {
  it('empty slot saves without confirmation', () => {
    const confirm = vi.fn(() => false);
    expect(confirmQuickSave('1', false, confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('occupied slot requires explicit confirmation', () => {
    const yes = vi.fn(() => true);
    const no = vi.fn(() => false);
    expect(confirmQuickSave('2', true, yes)).toBe(true);
    expect(yes).toHaveBeenCalledWith('MEMORY 2 を上書き保存しますか？');
    expect(confirmQuickSave('2', true, no)).toBe(false);
  });
});
