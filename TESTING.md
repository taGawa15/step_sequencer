# TESTING.md

## コマンド

```bash
npm install                      # 依存導入(devDeps 含む)
npm run lint                     # ESLint (src/ + e2e/)
npm run typecheck                # tsc --noEmit
npm run test                     # Vitest 単体テスト(jsdom)
npm run test:watch               # Vitest watch モード
npx playwright install chromium  # 初回のみ: ブラウザ取得
npm run test:e2e                 # Playwright E2E(dev サーバー自動起動)
npm run build                    # typecheck + 本番ビルド
```

## 単体テスト(Vitest)

場所: `src/**/*.test.ts(x)` / 設定: `vite.config.ts` の `test` ブロック / セットアップ: `src/test/setup.ts`

| ファイル | 検証内容 |
|---|---|
| utils/swing.test.ts | Swing 計算(偶数ステップ無遅延、75% 上限、クランプ、不正入力) |
| types/sample.test.ts | Trim 正規化(start<end 保証、自動補正)、旧メタデータ修復 |
| utils/projectSnapshot.test.ts | Timeline スナップショット検証(空 data 拒否、旧スキーマ修復、クランプ) |
| hooks/useTimelineSlots.test.tsx | 壊れた localStorage の読込(クラッシュなし・破損フラグ・SAVE で回復) |
| hooks/useKeyboardShortcuts.test.ts | e.repeat ガード、H=Stutter / ?=Help 衝突解消、suspended、⌘⇧V ルーティング |
| audio/performanceFx.test.ts | Tape Stop BPM 復元(連打・release・PANIC、0.9 ヒューリスティック廃止)、Beat Repeat の time 引数 |
| hooks/usePerformanceControls.test.ts | 差分適用(SWEEP 操作で reverb.decay を触らない = IR 再生成ガード) |
| audio/samplePlayer.test.ts | ロード中 sentinel の全メソッド no-op(削除クラッシュ防止) |
| hooks/useMicSampler.test.tsx | 録音自動停止の状態同期(REC 表示・M キー方向・タイマー解除) |

方針: Tone.js は各テストで `vi.mock('tone')` し、**Web Audio をエミュレートせず契約(BPM 帳簿・スケジューリング引数)だけを検証**します。

## E2E テスト(Playwright)

場所: `e2e/live-safety.spec.ts` / 設定: `playwright.config.ts`

Chromium をフェイクメディアデバイス(`--use-fake-device-for-media-stream`)+自動再生許可で起動するため、実マイク不要・CI 可。

| シナリオ | 対応要件 |
|---|---|
| 起動時に pageerror ゼロ | 白画面防止 |
| Play / Stop トグル | transport |
| Space 長押し(repeat 合成イベント)で連打されない | H7 |
| H で Stutter / Help は開かない | H4 |
| Shift+/ で Help → Esc で閉じても再生継続 | H4 / M5 |
| J 連打後 BPM が 100 に戻る(DEBUG タブの実値で検証) | H3 |
| 壊れた Timeline を注入 → 白画面なし・破損表示・LOAD 無効 | H2 |
| 録音直後に削除してもクラッシュなし | H6 |
| FILTER SWEEP 60 連打でクラッシュなし | H5 |
| 844×390(スマホ横)で COMP までスクロール到達 | M6 |
| DEBUG タブから COPY LOG 成功 | Debug Panel |

## 手動テスト(自動化対象外)

1. **30 分連続再生**: PLAY したまま放置 → DEBUG の Memory が単調増加しない / AudioContext が `running` のまま
2. **MORPH**: SCENES A/B に異なる Filter Sweep を保存 → MORPH 4.0s で recall → 4 秒かけて滑らかに変化
3. **実機 iOS Safari**: タップで PLAY → 発音 / 録音許可 / 横向きで FX パネル最下部まで操作
4. **Beat Repeat 聴感**: 再生中 G 長押し → リトリガーがグリッドに乗っている(旧版は約 100ms 後ろにジッタ)
5. **PANIC 連打**: Esc を 5 連打 → 1 秒後に音量復帰

## 実機確認チェックリスト(本番公開前)

自動テストでは担保できない項目。**音はヘッドホンを少し離して**確認すること。

| # | 確認項目 | 環境 |
|---|---|---|
| 1 | 起動 → タップで PLAY → 発音 | iOS Safari 実機 |
| 2 | 同上 | Android Chrome 実機 |
| 3 | 同上 | PC Chrome |
| 4 | 同上 | PC Safari |
| 5 | 30 分連続再生(DEBUG: Memory 単調増加なし / Context=running) | 任意1台 |
| 6 | マイク録音許可 → 録音 → 再生 | 実機 |
| 7 | 録音直後 1 秒以内に削除 → クラッシュなし | 実機 |
| 8 | H キーで Stutter 作動(Help が開かない) | PC |
| 9 | H キー連打(20回)→ 破綻なし | PC |
| 10 | H キー長押し → 再トリガされない | PC |
| 11 | Shift+/ で Help → Esc で閉じて再生継続 | PC |
| 12 | Tape Stop(J)連打 → BPM が元に戻る | PC |
| 13 | FILTER SWEEP を10秒連続操作 → 音切れなし | 全環境 |
| 14 | DELAY TIME 連続切替 → クリック/破裂音なし | 全環境 |
| 15 | **LEAD 単発でディレイがかからない**(初期状態) | 全環境 |
| 16 | FX PERF 全6種の音響確認(BEAT=直近ヒット連打 / GATE=刻み / TAPE=減速 / THROW=残響スロー / FREEZE=残響持続 / CRUSH=質感変化) | 全環境 |
| 17 | **STUTTER ON で音量が暴走しない**(元の音量±0、刻まれるだけ) | 全環境 |
| 18 | スマホ横向きで右パネル最下部(COMP / SCENES)まで操作 | 実機 |
| 19 | DEBUG タブ → COPY LOG → 貼り付け確認 | 任意 |
| 20 | **Vercel 本番 URL** で 1–19 のスモーク再確認 | 本番 |

## 既知のテスト制約

- E2E の音声検証は「クラッシュしない・状態が正しい」まで。音質・ズレの聴感は手動確認
- `performance.memory` は Chrome のみ(他ブラウザは n/a 表示)
