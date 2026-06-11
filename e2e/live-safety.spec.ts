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

/**
 * Real audio-output assertions via the dev-only window.__seqDebug hook
 * (graph + Tone). A DelayNode-free feedback cycle once muted the entire
 * master bus per Web Audio spec — and every UI-level test still passed.
 * These tests LISTEN to masterOut so a silent chain can never ship again.
 */
test.describe('audio output — master chain integrity', () => {
  const measureMasterDb = async (
    page: Page,
    setup: 'dry' | 'stutter' | 'crush' | 'throwFreeze',
  ): Promise<number> =>
    page.evaluate(async (mode) => {
      interface SeqDebug {
        graph: {
          master: {
            masterOut: { connect: (n: unknown) => void };
            setBitCrush: (on: boolean) => void;
            setDelayThrow: (on: boolean) => void;
            setReverbFreeze: (on: boolean) => void;
          };
          voices: {
            drums: {
              kick: { trigger: (o: unknown) => void };
            };
          };
        };
        Tone: {
          start: () => Promise<void>;
          now: () => number;
          Meter: new (o: { smoothing: number }) => {
            getValue: () => number | number[];
            dispose: () => void;
          };
        };
      }
      const dbg = (window as unknown as { __seqDebug?: SeqDebug }).__seqDebug;
      if (!dbg) return -999;
      const { graph, Tone } = dbg;
      await Tone.start();
      if (mode === 'stutter') {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
      } else if (mode === 'crush') {
        graph.master.setBitCrush(true);
      } else if (mode === 'throwFreeze') {
        graph.master.setDelayThrow(true);
        graph.master.setReverbFreeze(true);
      }
      await new Promise((r) => setTimeout(r, 120));
      for (let i = 0; i < 5; i++) {
        graph.voices.drums.kick.trigger({
          time: Tone.now() + 0.05 + i * 0.18,
          velocity: 1,
          plocks: { filterCutoff: null, pan: null, pitchOffset: null },
        });
      }
      const meter = new Tone.Meter({ smoothing: 0 });
      graph.master.masterOut.connect(meter);
      let max = -Infinity;
      const t0 = performance.now();
      while (performance.now() - t0 < 1200) {
        await new Promise((r) => setTimeout(r, 25));
        const v = meter.getValue();
        const db = Array.isArray(v) ? v[0] : v;
        if (db > max) max = db;
      }
      meter.dispose();
      // teardown
      if (mode === 'stutter') {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
      } else if (mode === 'crush') {
        graph.master.setBitCrush(false);
      } else if (mode === 'throwFreeze') {
        graph.master.setDelayThrow(false);
        graph.master.setReverbFreeze(false);
      }
      return max;
    }, setup);

  test('the master chain actually passes audio (no muted cycle)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('transport-toggle').click(); // gesture → context
    const dryDb = await measureMasterDb(page, 'dry');
    expect(dryDb).toBeGreaterThan(-40); // silence would be ≈ -Infinity
    expect(dryDb).toBeLessThanOrEqual(0); // and the limiter holds the top
  });

  test('STUTTER never amplifies above the dry level', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('transport-toggle').click();
    const dryDb = await measureMasterDb(page, 'dry');
    const stutterDb = await measureMasterDb(page, 'stutter');
    expect(stutterDb).toBeGreaterThan(-40); // still audible
    expect(stutterDb).toBeLessThanOrEqual(dryDb + 1.5); // never louder
  });

  test('BIT CRUSH (worklet) and THROW+FREEZE stay audible and bounded', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('transport-toggle').click();
    const crushDb = await measureMasterDb(page, 'crush');
    expect(crushDb).toBeGreaterThan(-40);
    expect(crushDb).toBeLessThanOrEqual(0);
    const fxDb = await measureMasterDb(page, 'throwFreeze');
    expect(fxDb).toBeGreaterThan(-40);
    expect(fxDb).toBeLessThanOrEqual(0); // feedback paths bounded
  });
});

test.describe('sampling pipeline — restore → assign → audible', () => {
  test('a stored sample survives reload, replaces the kick voice, and GAIN works', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    // Inject a 2 kHz sine WAV straight into the app's IndexedDB +
    // metadata store — the exact restore path a real recording uses.
    await page.evaluate(async () => {
      const sr = 44100;
      const n = Math.floor(sr * 0.6);
      const buf = new ArrayBuffer(44 + n * 2);
      const v = new DataView(buf);
      const ws = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
      };
      ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
      ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, 1, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      ws(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / 200) * Math.min(1, (n - i) / 400);
        v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 2000 * i) / sr) * 0.5 * env * 32767, true);
      }
      const blob = new Blob([buf], { type: 'audio/wav' });
      await new Promise<void>((res, rej) => {
        const req = indexedDB.open('step-sequencer-samples', 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('samples')) req.result.createObjectStore('samples');
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('samples', 'readwrite');
          tx.objectStore('samples').put(blob, 's-e2e-1');
          tx.oncomplete = () => { req.result.close(); res(); };
          tx.onerror = () => rej(tx.error);
        };
        req.onerror = () => rej(req.error);
      });
      window.localStorage.setItem(
        'step-sequencer:samples:v1',
        JSON.stringify({ samples: [{
          id: 's-e2e-1', name: 'E2ESine', createdAt: new Date().toISOString(),
          durationSec: 0.6, assignedTo: null, gain: 0.8, pitch: 0,
          trimStart: 0, trimEnd: null,
        }]}),
      );
    });
    await page.reload();

    // Restore: the row is back (the old persist-wipe bug deleted it here)
    await openTab(page, /SAMPLE|SMPL/);
    const nameInput = page.locator('[aria-label="mic sampling panel"] input').first();
    await expect(nameInput).toHaveValue('E2ESine', { timeout: 5000 });

    // Assign to KICK
    await page
      .locator('[aria-label="assign to track"]')
      .first()
      .selectOption('kick');

    // Activate kick step 1 and play
    await page.locator('[aria-label="step 1"]').first().click();
    await page.getByTestId('transport-toggle').click();
    await page.waitForTimeout(400);

    // The kick lane must now play the 2 kHz SINE, not the C1 drum thump —
    // discriminate by dominant FFT frequency at masterOut.
    const dominantHz = await page.evaluate(async () => {
      interface Dbg {
        graph: { master: { masterOut: { connect: (n: unknown) => void } } };
        Tone: {
          start: () => Promise<void>;
          Analyser: new (type: string, size: number) => {
            getValue: () => Float32Array;
            dispose: () => void;
          };
          getContext: () => { sampleRate: number };
        };
      }
      const dbg = (window as unknown as { __seqDebug?: Dbg }).__seqDebug;
      if (!dbg) return -1;
      const { graph, Tone } = dbg;
      await Tone.start();
      const fftSize = 1024;
      const an = new Tone.Analyser('fft', fftSize);
      graph.master.masterOut.connect(an);
      const sr = Tone.getContext().sampleRate;
      let bestBin = 0;
      let bestDb = -Infinity;
      const t0 = performance.now();
      while (performance.now() - t0 < 2000) {
        await new Promise((r) => setTimeout(r, 40));
        const bins = an.getValue();
        for (let i = 2; i < bins.length; i++) {
          if (bins[i] > bestDb) { bestDb = bins[i]; bestBin = i; }
        }
      }
      an.dispose();
      return (bestBin * sr) / (fftSize * 2);
    });
    expect(dominantHz).toBeGreaterThan(1500);
    expect(dominantHz).toBeLessThan(2600);

    // GAIN slider to 0 → sequenced hits go near-silent (gain respected,
    // not overwritten by velocity — the old slider-does-nothing bug)
    await openTab(page, /SAMPLE|SMPL/);
    await page.evaluate(() => {
      const panel = document.querySelector('[aria-label="mic sampling panel"]');
      const gain = panel?.querySelector('input[type="range"]') as HTMLInputElement | null;
      if (!gain) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(gain, '0');
      gain.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Let any hit scheduled BEFORE the gain change (scheduler lookahead)
    // play out, then listen across a full 2 s loop.
    await page.waitForTimeout(700);
    const silentDb = await page.evaluate(async () => {
      interface Dbg {
        graph: { master: { masterOut: { connect: (n: unknown) => void } } };
        Tone: { Meter: new (o: { smoothing: number }) => { getValue: () => number | number[]; dispose: () => void } };
      }
      const dbg = (window as unknown as { __seqDebug?: Dbg }).__seqDebug;
      if (!dbg) return 0;
      const meter = new dbg.Tone.Meter({ smoothing: 0 });
      dbg.graph.master.masterOut.connect(meter);
      let max = -Infinity;
      const t0 = performance.now();
      while (performance.now() - t0 < 2400) {
        await new Promise((r) => setTimeout(r, 30));
        const v = meter.getValue();
        const db = Array.isArray(v) ? v[0] : v;
        if (db > max) max = db;
      }
      meter.dispose();
      return max;
    });
    expect(silentDb).toBeLessThan(-45);
    expect(errors).toEqual([]);
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
