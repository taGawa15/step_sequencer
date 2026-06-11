import { expect, test, type Page } from '@playwright/test';

/**
 * Mobile usability suite — the spec's required device matrix. The page
 * must never scroll; only drawer/sheet interiors may. The grid is the
 * star: ≥40% of the viewport on phones, with real tap targets.
 */

const noPageScroll = async (page: Page) => {
  const m = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(m.x).toBeLessThanOrEqual(1);
  expect(m.y).toBeLessThanOrEqual(1);
};

const gridHeightRatio = async (page: Page): Promise<number> =>
  page.evaluate(() => {
    const grid = document.querySelector('[data-testid="mobile-grid"]');
    if (!grid) return 0;
    return grid.getBoundingClientRect().height / window.innerHeight;
  });

test.describe('iPhone 14 portrait (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('grid is the main area (≥40%), FAB present, drawer closed at boot', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('mobile-shell')).toHaveAttribute('data-mode', 'mobile');
    expect(await gridHeightRatio(page)).toBeGreaterThanOrEqual(0.4);
    await expect(page.getByTestId('menu-fab')).toBeVisible();
    // drawer exists but is hidden (slid out + visibility:hidden)
    const vis = await page
      .getByTestId('mobile-drawer')
      .evaluate((el) => getComputedStyle(el).visibility);
    expect(vis).toBe('hidden');
    await noPageScroll(page);
  });

  test('primary controls meet the 44px touch target', async ({ page }) => {
    await page.goto('/');
    for (const id of ['transport-toggle', 'menu-fab', 'quick-loop']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(44);
    }
    // step cells: tall mobile cells (≥28px minimum)
    const step = await page.locator('[aria-label="step 1"]').first().boundingBox();
    expect(step!.height).toBeGreaterThanOrEqual(28);
  });

  test('FAB opens the drawer; backdrop and CLOSE both dismiss it', async ({
    page,
  }) => {
    await page.goto('/');
    const drawer = page.getByTestId('mobile-drawer');
    const visibility = () =>
      drawer.evaluate((el) => getComputedStyle(el).visibility);
    await page.getByTestId('menu-fab').click();
    await expect.poll(visibility).toBe('visible');
    // width ≤ 85vw on portrait phones
    const w = (await drawer.boundingBox())!.width;
    expect(w).toBeLessThanOrEqual(390 * 0.85 + 1);
    // tap the VISIBLE backdrop strip left of the drawer (its center sits
    // under the drawer itself, which Playwright rightly refuses to click)
    await page
      .getByTestId('drawer-backdrop')
      .click({ position: { x: 20, y: 300 } });
    await expect.poll(visibility).toBe('hidden');
    await page.getByTestId('menu-fab').click();
    await expect.poll(visibility).toBe('visible');
    await page.getByTestId('drawer-close').click();
    await expect.poll(visibility).toBe('hidden');
  });

  test('track tabs switch the visible group; steps remain tappable', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByLabel('mute KICK')).toBeVisible();
    await page.getByRole('tab', { name: 'BASS' }).click();
    await expect(page.getByLabel('mute KICK')).toHaveCount(0);
    await expect(page.getByLabel('mute BASS')).toBeVisible();
    // NB: an ACTIVE synth step's label grows to "step 3 C2" — match by prefix
    const step = page.locator('[aria-label^="step 3"]').first();
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: 'DRUM' }).click();
    await expect(page.getByLabel('mute KICK')).toBeVisible();
  });

  test('drawer item opens a bottom sheet; sheet interior is the only scroller', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('menu-fab').click();
    await page.getByTestId('drawer-item-sample').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('SAMPLE');
    await noPageScroll(page);
    const scroll = await page.getByTestId('sheet-body').evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(scroll.overflowY).toBe('auto');
    await page.getByTestId('sheet-close').click();
    await expect(sheet).toHaveCount(0);
    // grid is wide again
    expect(await gridHeightRatio(page)).toBeGreaterThanOrEqual(0.4);
  });

  test('mini map appears for >16-step loops and switches pages', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('quick-loop').click();
    await page.getByRole('button', { name: '×16' }).click(); // 64 steps
    const map = page.getByTestId('mini-map');
    await expect(map).toBeVisible();
    await expect(map.getByRole('button')).toHaveCount(4);
    await map.getByRole('button', { name: 'steps 17–32' }).click();
    await expect(map.getByRole('button', { name: 'steps 17–32' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('focus mode hides quick controls and exits cleanly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('quick-bar')).toBeVisible();
    await page.getByRole('button', { name: 'focus mode' }).click();
    await expect(page.getByTestId('quick-bar')).toHaveCount(0);
    expect(await gridHeightRatio(page)).toBeGreaterThanOrEqual(0.45);
    await page.getByTestId('focus-exit').click();
    await expect(page.getByTestId('quick-bar')).toBeVisible();
  });

  test('quick memory: SAVE is armed + confirmed, LOAD restores', async ({
    page,
  }) => {
    await page.goto('/');
    page.on('dialog', (d) => d.accept());
    // activate a kick step, then arm-save into slot 1
    await page.locator('[aria-label="step 1"]').first().click();
    await page.getByRole('button', { name: 'memory save mode' }).click();
    await page.getByRole('button', { name: 'memory 1 save' }).click();
    // change the pattern, then one-tap LOAD slot 1 (confirm guard auto-accepted)
    await page.locator('[aria-label="step 2"]').first().click();
    await page.getByRole('button', { name: 'memory 1 load' }).click();
    await expect(page.locator('[aria-label="step 1"]').first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('[aria-label="step 2"]').first()).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

test.describe('iPhone SE portrait (375×667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('smallest phone still gives the grid ≥40% and a 44px PLAY', async ({
    page,
  }) => {
    await page.goto('/');
    expect(await gridHeightRatio(page)).toBeGreaterThanOrEqual(0.4);
    const play = await page.getByTestId('transport-toggle').boundingBox();
    expect(play!.height).toBeGreaterThanOrEqual(44);
    await noPageScroll(page);
  });
});

test.describe('iPhone 14 landscape (844×390) — performance mode', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('grid centered + quick FX rail + drawer from the right, nothing clipped', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('mobile-shell')).toHaveAttribute(
      'data-mode',
      'mobileLandscape',
    );
    const fxRail = page.getByTestId('quick-fx');
    await expect(fxRail).toBeVisible();
    for (const name of ['REPEAT', 'STUTTER', 'TAPE', 'THROW', 'FREEZE']) {
      await expect(fxRail.getByRole('button', { name })).toBeVisible();
    }
    // grid occupies the center, between the rails
    const grid = (await page.getByTestId('mobile-grid').boundingBox())!;
    expect(grid.x).toBeGreaterThan(90);
    expect(grid.x + grid.width).toBeLessThan(844 - 80);
    expect(grid.height / 390).toBeGreaterThanOrEqual(0.6);
    // memory slots are NOT cut off at the bottom
    const mem = (await page.getByTestId('quick-memory').boundingBox())!;
    expect(mem.y + mem.height).toBeLessThanOrEqual(390 + 1);
    await noPageScroll(page);
    // drawer slides in from the right edge
    await page.getByTestId('menu-fab').click();
    const drawer = (await page.getByTestId('mobile-drawer').boundingBox())!;
    expect(drawer.x + drawer.width).toBeGreaterThan(840);
    expect(drawer.width).toBeLessThanOrEqual(320 + 1);
  });

  test('quick FX latch toggles report state', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('transport-toggle').click();
    const stutter = page.getByTestId('quick-fx').getByRole('button', { name: 'STUTTER' });
    await stutter.click();
    await expect(stutter).toHaveAttribute('aria-pressed', 'true');
    await stutter.click();
    await expect(stutter).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Android portrait (412×915)', () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test('timeline visible, big buttons, sheet-only scrolling', async ({ page }) => {
    await page.goto('/');
    expect(await gridHeightRatio(page)).toBeGreaterThanOrEqual(0.4);
    const fab = (await page.getByTestId('menu-fab').boundingBox())!;
    expect(Math.min(fab.width, fab.height)).toBeGreaterThanOrEqual(56);
    await noPageScroll(page);
    await page.getByTestId('menu-fab').click();
    await page.getByTestId('drawer-item-debug').click();
    await expect(page.getByTestId('bottom-sheet')).toBeVisible();
    await noPageScroll(page);
  });
});

test.describe('Android landscape (915×412)', () => {
  test.use({ viewport: { width: 915, height: 412 } });

  test('performance mode engages and nothing overflows', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('mobile-shell')).toHaveAttribute(
      'data-mode',
      'mobileLandscape',
    );
    await noPageScroll(page);
  });
});

test.describe('iPad (768×1024 / 1024×768)', () => {
  test('portrait keeps the tablet layout intact', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await page.goto('/');
    // tablet = classic shell: right column visible, no mobile FAB
    await expect(page.getByTestId('menu-fab')).toHaveCount(0);
    await expect(page.getByLabel('performance panel')).toBeVisible(); // right col
    await noPageScroll(page);
    await page.close();
  });

  test('landscape resolves to the desktop layout without breakage', async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    await page.goto('/');
    await expect(page.getByTestId('menu-fab')).toHaveCount(0);
    await expect(page.getByLabel('track mixer')).toBeVisible(); // left col
    await noPageScroll(page);
    await page.close();
  });
});
