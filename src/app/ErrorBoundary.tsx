import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  addError,
  clearErrors,
  copyTextToClipboard,
  formatErrorsForCodex,
  getErrors,
} from '../utils/errorLog';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
  showDetail: boolean;
}

const wrapStyle: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
  background: 'var(--bg, #f4f3ee)',
  color: 'var(--fg, #1a1a1a)',
  fontFamily: 'Inter, system-ui, sans-serif',
  textAlign: 'center',
};

const btnStyle: CSSProperties = {
  font: 'inherit',
  fontSize: 12,
  letterSpacing: '0.16em',
  padding: '10px 22px',
  border: '1px solid currentColor',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  borderRadius: 2,
};

const detailStyle: CSSProperties = {
  maxWidth: 720,
  maxHeight: '40dvh',
  overflow: 'auto',
  textAlign: 'left',
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  border: '1px dashed currentColor',
  borderRadius: 4,
  padding: 12,
  opacity: 0.85,
};

/**
 * Last line of defense: keeps a render-phase crash from becoming a blank
 * white page. Records the error to the persistent log, then offers
 * reload / copy-report / inline debug detail.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false, showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    addError({
      type: 'react',
      message: error.message,
      stack: `${error.stack ?? ''}\n--- component stack ---${info.componentStack ?? ''}`,
    });
  }

  private handleCopy = async () => {
    const ok = await copyTextToClipboard(
      formatErrorsForCodex({ origin: 'ErrorBoundary fallback' }),
    );
    this.setState({ copied: ok });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    // Recovery of last resort: wipe app storage in case persisted state
    // itself is what keeps crashing the render, then reload.
    if (
      window.confirm(
        '保存データ（パターン / タイムライン / 設定）をすべて削除してリロードします。よろしいですか？',
      )
    ) {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('step-sequencer:')) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
        clearErrors();
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
  };

  render() {
    const { error, copied, showDetail } = this.state;
    if (!error) return this.props.children;

    const recent = getErrors().slice(0, 5);
    return (
      <div style={wrapStyle} role="alert">
        <div style={{ fontSize: 14, letterSpacing: '0.22em' }}>
          エラーが発生しました
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, maxWidth: 560 }}>
          アプリの描画中に問題が起きたため、安全のため停止しました。
          RELOAD で復帰できます。再発する場合は下のボタンでエラーログを
          コピーしてレビュー（Codex / Claude）に貼り付けてください。
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" style={btnStyle} onClick={this.handleReload}>
            RELOAD
          </button>
          <button
            type="button"
            style={btnStyle}
            onClick={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
          >
            {showDetail ? 'HIDE DEBUG' : 'DEBUG PANEL'}
          </button>
          <button type="button" style={btnStyle} onClick={this.handleCopy}>
            {copied ? 'COPIED ✓' : 'COPY ERROR LOG'}
          </button>
          <button type="button" style={btnStyle} onClick={this.handleReset}>
            RESET DATA
          </button>
        </div>
        {showDetail && (
          <div style={detailStyle} data-testid="error-detail">
            <strong>last error</strong>
            {'\n'}
            {error.message}
            {'\n'}
            {error.stack ?? '(no stack)'}
            {'\n\n'}
            <strong>recent log ({recent.length})</strong>
            {'\n'}
            {recent
              .map((e) => `[${e.time}] ${e.type}: ${e.message}`)
              .join('\n') || '(empty)'}
          </div>
        )}
        <div style={{ fontSize: 10, opacity: 0.5, maxWidth: 560 }}>
          ※ DevTools コンソールの「Self-XSS」警告（コードを貼り付けないで…）は
          ブラウザ標準の注意書きであり、このアプリのクラッシュとは無関係です。
        </div>
      </div>
    );
  }
}
