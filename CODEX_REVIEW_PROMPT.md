# CODEX_REVIEW_PROMPT.md

AI レビュー(Codex / Claude 等)に再レビューを依頼するときのプロンプト雛形です。
Debug Panel の **COPY LOG** 出力を末尾に貼り付けて使ってください。

---

あなたはシニアフロントエンドエンジニア、Web Audio API エンジニア、ライブパフォーマンス用音楽ツールの QA エンジニアです。

ブラウザで動作するライブ用ステップシーケンサー「Step Sequencer 2.0」(React + TypeScript + Vite + Tone.js v15)をレビューしてください。

## 前提(2.0 で対策済みの設計)

- ErrorBoundary + window.onerror + unhandledrejection → localStorage リングバッファ(`src/utils/errorLog.ts`)
- Timeline スナップショットはロード時に検証・正規化(`src/utils/projectSnapshot.ts`)。pattern 復元不能のみ拒否
- Tape Stop: エンジン内 `tapeActive` フラグで同期的に多重発火遮断、`savedBpm: number | null`、PANIC は tape 進行中のみ BPM 復元(`src/audio/performanceFx.ts`)
- ショートカット: `e.repeat` 全面ガード、H=Stutter / Shift+/=Help、ヘルプ表示中は suspended(`src/hooks/useKeyboardShortcuts.ts`)
- FX 状態は差分適用(`applyState(graph, next, opts, prev)`)+ masterEffects 側で Reverb decay / delayTime の同値ガード
- サンプルのロード中 sentinel は全メソッド no-op(`createPendingSamplePlayer`)
- Swing は奇数 16 分ステップ遅延(`src/utils/swing.ts`)、Sample Trim は `player.start(time, offset, duration)`
- レイアウトはページ no-scroll 維持+パネル内部のみ overflow-y:auto

## 重点レビュー観点

1. クラッシュ要因(白画面 / 未捕捉例外 / null 参照 / 再生中 setState / メモリリーク)
2. Web Audio(AudioContext のユーザー操作起点 / dispose 漏れ / lookahead / BPM・Swing のズレ / FX 連打 / ノード残留)
3. レイアウト(PC / タブレット / スマホ縦横 / 16-32-64 step / 各パネル / はみ出し)
4. 状態管理(再レンダリング / 保存データ型安全 / TIMELINE・COPY/PASTE の破壊的変更 / Undo)
5. 機能バグ(Play/Stop / BPM / Swing / Scale Lock / Loop / MEMORY / Mic / Trim / FILTER SWEEP / BEAT REPEAT / TAPE STOP / Debug Panel)
6. セキュリティ(マイクの勝手な起動 / innerHTML / eval / localStorage 肥大 / ログの個人情報)

## 実行してほしいコマンド

npm install / npm run lint / npm run typecheck / npm run test / npm run test:e2e / npm run build

## 出力形式

- 総合評価(重大度 High/Medium/Low、ライブ使用可否、最優先修正箇所)
- High / Medium / Low Priority の問題列挙
- レイアウト崩れチェック(画面幅ごと)
- Web Audio チェック(音ズレ / クラッシュ / メモリリーク)
- 修正パッチ案(具体的な差分)
- 再テスト手順

---

## 環境ログ(Debug Panel の COPY LOG をここに貼り付け)

```
(ここに貼り付け)
```
