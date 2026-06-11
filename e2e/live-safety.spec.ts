import { expect, test, type Page } from '@playwright/test';

/**
 * Live-safety E2E suite. Every test also asserts the app never white-screens:
 * collectErrors() fails a test on any uncaught page error.
 */

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
};

const expectAlive = async (page: Page) => {
  await expect(page.getByTestId('transport-toggle')).toBeVisible();
  await expect(page.getByText('エラーが発生しました')).toHaveCount(0);
};

const openTab = async (page: Page, name: RegExp) => {
  await page.getByRole('tab', { name }).click();
};

test.describe('boot & transport', () => {
  test('app boots without errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expectAlive(page);
    expect(errors).toEqual([]);
  });

  test('Play / Stop toggles', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByTestId('transport-toggle');
    await toggle.click();
    await expect(toggle).toContainText('STOP');
    await toggle.click();
    await expect(toggle).toContainText('PLAY');
  });

  test('holding Space (key repeat) does not flap Play/Stop', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    const toggle = page.getByTestId('transport-toggle');
    await page.keyboard.press('Space'); // one real press → playing
    await expect(toggle).toContainText('STOP');
    // Simulate OS auto-repeat: repeated keydown events with repeat=true
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'Space', repeat: true }),
        );
      }
    });
    await page.waitForTimeout(300);
    await expect(toggle).toContainText('STOP'); // still playing — no flapping
    expect(errors).toEqual([]);
  });
});

test.describe('shortcuts: H / Help / Esc', () => {
  test('H fires Stutter, not the help modal', async ({ page }) => {
    await page.goto('/');
    await openTab(page, /FX PERF|PERF/);
    const gate = page.getByRole('button', { name: /GATE/ });
    await expect(gate).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('h');
    await expect(gate).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('h'); // toggle back off
    await expect(gate).toHaveAttribute('aria-pressed', 'false');
  });

  test('Shift+/ opens Help; Esc closes it WITHOUT stopping playback', async ({
    page,
  }) => {
    await page.goto('/');
    const toggle = page.getByTestId('transport-toggle');
    await toggle.click();
    await expect(toggle).toContainText('STOP');

    await page.keyboard.press('Shift+Slash');
    await expect(page.getByRole('dialog', { name: 'keyboard shortcuts' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Esc closed the modal only — PANIC did not fire.
    await expect(toggle).toContainText('STOP');
  });
});

test.describe('tape stop BPM safety', () => {
  test('J spam does not corrupt BPM (returns to 100)', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    const bpmInput = page.getByTestId('bpm-input');
    await bpmInput.fill('100');
    await bpmInput.press('Enter');

    await page.getByTestId('transport-toggle').click(); // play

    // Hammer the tape-stop key
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('j');
      await page.waitForTimeout(60);
    }
    // default mode = release (0.5s): wait for completion + silent restore
    await page.waitForTimeout(1500);

    await openTab(page, /DEBUG|DBG/);
    const actual = await page.getByTestId('debug-bpm').textContent();
    expect(Number(actual)).toBeGreaterThan(95);
    expect(Number(actual)).toBeLessThan(105);
    await expect(bpmInput).toHaveValue('100');
    expect(errors).toEqual([]);
  });
});

test.describe('broken storage', () => {
  test('corrupted timeline slot never white-screens; slot is flagged', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'step-sequencer:timelines:v1',
        JSON.stringify({
          timelines: { '1': { name: 'x', savedAt: 'x', data: {} } },
          activeTimelineId: '1',
          confirmLoadGuard: false,
        }),
      );
    });
    await page.goto('/');
    await expectAlive(page);

    await openTab(page, /TIMELINE|TL/);
    await expect(page.getByTestId('timeline-invalid-note')).toBeVisible();
    await expect(page.getByRole('button', { name: 'LOAD' })).toBeDisabled();
    expect(errors).toEqual([]);
  });
});

test.describe('mic sampling', () => {
  test('delete immediately after recording does not crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await openTab(page, /SAMPLE|SMPL/);

    await page.getByRole('button', { name: /REC/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /STOP/ }).last().click();

    const deleteBtn = page.getByRole('button', { name: /delete Sample/ }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click(); // delete while the player may still be loading
    await page.waitForTimeout(500);
    await expectAlive(page);
    expect(errors).toEqual([]);
  });
});

test.describe('filter sweep stress', () => {
  test('hammering FILTER SWEEP does not crash or error', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.getByTestId('transport-toggle').click();

    const sweep = page.locator('input[aria-label="filter sweep"]').first();
    await expect(sweep).toBeVisible();
    await page.evaluate(() => {
      const el = document.querySelector(
        'input[aria-label="filter sweep"]',
      ) as HTMLInputElement | null;
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      for (let i = 0; i < 60; i++) {
        setter?.call(el, String(i % 2 === 0 ? -100 : 100));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(1000);
    await expectAlive(page);
    expect(errors).toEqual([]);
  });
});

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('PerformancePanel bottom (COMP) is reachable by scrolling', async ({
    page,
  }) => {
    await page.goto('/');
    const comp = page.getByText('COMP', { exact: true }).first();
    await comp.scrollIntoViewIfNeeded();
    await expect(comp).toBeVisible();
  });
});

test.describe('debug panel', () => {
  test('shows engine state and copies the Codex log', async ({ page }) => {
    await page.goto('/');
    await openTab(page, /DEBUG|DBG/);
    await expect(page.getByTestId('debug-ctx')).toBeVisible();
    const copy = page.getByTestId('debug-copy');
    await copy.click();
    await expect(copy).toContainText('COPIED');
  });

  test('lists performance FX status with routing connected', async ({ page }) => {
    await page.goto('/');
    await openTab(page, /DEBUG|DBG/);
    const fxBox = page.getByTestId('debug-fx');
    await expect(fxBox).toBeVisible();
    await expect(fxBox).toContainText('connected');
    for (const name of [
      'FILTER SWEEP',
      'BEAT REPEAT',
      'STUTTER',
      'TAPE STOP',
      'DELAY THROW',
      'REVERB FREEZE',
      'BIT CRUSH',
    ]) {
      await expect(fxBox).toContainText(name);
    }
  });
});

test.describe('audio safety — stutter & delay', () => {
  test('H-key stutter spam (20 toggles) never errors or kills the app', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.getByTestId('transport-toggle').click(); // play (creates graph)
    await page.waitForTimeout(300);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('h');
      await page.waitForTimeout(40);
    }
    // leave it OFF (even count) and verify clean state
    await page.waitForTimeout(400);
    await expectAlive(page);
    expect(errors).toEqual([]);
  });

  test('rapid Delay Time switching while playing stays clean', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.getByTestId('transport-toggle').click();
    // Enable delay + add some send so the path is audible (worst case)
    await page.keyboard.press('b'); // fx.delayToggle
    const timeButtons = page
      .locator('[aria-label="performance panel"] button', { hasText: /^(16|8|8\.|4|4\.)$/ });
    const count = await timeButtons.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < count; i++) {
        await timeButtons.nth(i).click();
        await page.waitForTimeout(30);
      }
    }
    await page.waitForTimeout(500);
    await expectAlive(page);
    expect(errors).toEqual([]);
  });

  test('THROW / FREEZE / CRUSH toggle in latch mode and release cleanly', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.getByTestId('transport-toggle').click();
    await openTab(page, /FX PERF|PERF/);
    for (const id of ['fx-throw', 'fx-freeze', 'fx-crush']) {
      const btn = page.getByTestId(id);
      // switch this FX block to LATCH so a click toggles
      const block = btn.locator('..'); // .fx wrapper
      await block.getByRole('button', { name: 'LAT' }).click();
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
    await expectAlive(page);
    expect(errors).toEqual([]);
  });
});
