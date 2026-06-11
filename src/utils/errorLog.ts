/**
 * Persistent in-app error log. Errors are kept in a localStorage-backed
 * ring buffer so they survive a crash + reload and can be copied out of
 * the Debug Panel (or the ErrorBoundary fallback) for bug reports.
 */

const STORAGE_KEY = 'step-sequencer:errorlog:v1';
const MAX_ENTRIES = 50;

export interface AppErrorEntry {
  /** ISO timestamp of when the error was recorded. */
  time: string;
  /** Origin bucket: 'react' | 'window.error' | 'unhandledrejection' | 'manual'. */
  type: string;
  message: string;
  stack?: string;
}

export const getErrors = (): AppErrorEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is AppErrorEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as AppErrorEntry).message === 'string' &&
        typeof (e as AppErrorEntry).time === 'string',
    );
  } catch {
    return [];
  }
};

export const addError = (entry: Omit<AppErrorEntry, 'time'>): void => {
  const full: AppErrorEntry = { ...entry, time: new Date().toISOString() };
  // Always echo to console so DevTools users see it too.
  console.warn(`[step-sequencer:${full.type}]`, full.message, full.stack ?? '');
  try {
    const next = [full, ...getErrors()].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — console echo above is the fallback */
  }
};

export const clearErrors = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/** Rough byte estimate of everything this app keeps in localStorage. */
export const estimateLocalStorageBytes = (): number => {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key) ?? '';
      // UTF-16: 2 bytes per code unit is a reasonable upper-bound estimate.
      total += (key.length + value.length) * 2;
    }
    return total;
  } catch {
    return 0;
  }
};

export interface CodexReportExtras {
  [label: string]: string;
}

/**
 * Build a markdown report that can be pasted straight into a code-review
 * request (Codex / Claude / GitHub issue). Contains environment info and
 * the recorded error ring buffer. No personal data beyond the UA string.
 */
export const formatErrorsForCodex = (extras: CodexReportExtras = {}): string => {
  const errors = getErrors();
  const lines: string[] = [
    '# Step Sequencer 2.0 — error report',
    '',
    `- generated: ${new Date().toISOString()}`,
    `- userAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
    `- viewport: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a'}`,
    `- localStorage: ~${Math.round(estimateLocalStorageBytes() / 1024)} KB`,
  ];
  for (const [label, value] of Object.entries(extras)) {
    lines.push(`- ${label}: ${value}`);
  }
  lines.push('', `## Errors (${errors.length})`, '');
  if (errors.length === 0) {
    lines.push('(none recorded)');
  }
  for (const e of errors) {
    lines.push(`### [${e.time}] ${e.type}`, '', '```', e.message);
    if (e.stack) lines.push(e.stack);
    lines.push('```', '');
  }
  return lines.join('\n');
};

/** Install window-level handlers exactly once. Returns an uninstaller. */
export const installGlobalErrorHandlers = (): (() => void) => {
  const onError = (event: ErrorEvent) => {
    addError({
      type: 'window.error',
      message: event.message || String(event.error ?? 'unknown error'),
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    addError({
      type: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
};

/**
 * Copy text to the clipboard with a fallback for non-secure contexts /
 * older Safari. Returns true when the copy most likely succeeded.
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};
