# known-issues.md — 既知の制限・意図的な仕様

最終更新: 2026-06-11(2.0 安定化パス+音響安全パス A1–A4 適用後)

## 仕様として確定しているもの

- **Delay は完全オプトイン**: 初期状態でマスター DELAY=OFF・全トラック DLY センド=0。LEAD の旧内蔵ディレイは撤去(A1)
- **STUTTER はリミッター前の線形 0–1 ゲート**を駆動(A4)。深さ内部上限 85%(最小フロア -16dB)、ON/OFF 15ms フェード。Destination.volume には一切触れない(旧実装は Tone の connectSignal 仕様により最大 +6dB のポンピングが発生していた)
- **BEAT REPEAT は「直近2拍以内に実際に鳴ったヒット」を連打**(A3)。現在のグリッドセル方式は疎なパターンで無音=「効いていない」ため変更
- **DELAY TIME 切替は duck+glide 方式**(A2): リターンを 25ms ダック → ディレイ長を 50ms グライド → 90ms 後に復帰。フィードバックループ内に波形不連続を作らない
- **FX のゲインステージング上限**: DELAY THROW センド 0.5 / REVERB FREEZE 再循環 0.85 / BIT CRUSH wet 0.6(いずれもループゲイン < 1+マスターリミッター -0.5dB が最終保護)

- **Timeline はサンプル割当てを保存しない**
  サンプル音声は端末ローカルの IndexedDB にあるため、Timeline スナップショット(JSON)には含めません。LOAD 後も現在の割当てが維持されます。→ README「Timeline 保存 / 読込の仕様」
- **PANIC(Esc)後は約 0.3 秒ミュート**してから音量が自動復帰します(事故音の遮断が目的)
- **Tape Stop の release モード**は完了時に transport を停止し、内部 BPM を無音で復元します(5 BPM で鳴り続けることはありません)
- **Beat Repeat のリトリガーは +1ms オフセット**で発音します(本シーケンスの予約ノートのエンベロープを食わないため)
- **Swing は奇数 16 分ステップのみ遅延**(最大 75% = 半ステップの 75%)。Draw(ステップ表示)も同じ時刻に同期します

## 既知の制限(未対応・優先度低)

1. **外部フォント(rsms.me/inter)がレンダーブロッキング**
   オフライン会場では初回表示が数秒遅れる可能性(タイムアウト後は system-ui で表示)。対策する場合は self-host へ。
2. **NUDGE ボタンは Scale Lock / オクターブ範囲を無視**
   ±1 / OCT± で範囲外・スケール外の音に到達できます(クラッシュはしません)。Scale Lock はミニ鍵盤のクリックのみ制限します。
3. **パターンは編集のたびに同期的に localStorage へ保存(約 60–100KB)**
   旧端末で連打時に微小な jank の可能性。問題が出たら debounce 化を検討。
4. **`performance.memory` は Chrome 専用**
   Debug Panel の Memory は他ブラウザで `n/a`。
5. **Reverb decay 変更時の IR 再生成は非同期**
   decay を動かした直後の約 0.5–1 秒、新しい残響特性が反映されるまでラグがあります(Tone.Reverb の仕様)。同値再設定では再生成しません(2.0 で修正済み)。
6. **サンプルの Pitch は playbackRate 方式**
   ピッチを変えると長さも変わります(タイムストレッチではありません)。
7. **E2E は Chromium のみ**
   iOS Safari 実機の発音・録音・横向き操作は手動チェックリストで担保(TESTING.md)。
8. **BPM / Swing は単体では永続化されません**
   リロードで既定値(120 / 0%)に戻ります。残したい状態は Timeline スロットに保存してください。
9. **JS バンドルが約 520KB(gzip 147KB)**
   Tone.js 本体が大半。ライブ用途では初回ロード後すべてローカル動作のため実害は小さいですが、気になる場合は manualChunks での分割を検討。

## 修正済み(音響安全パス A1–A4 — 再発時はバグ)

- **A4: STUTTER ON で大音量ノイズ**(マスターが最大 ×2/+6dB でポンピング)→ 専用線形ゲート駆動に全面再設計。増幅は構造的に不可能、ノード増殖なし(20回 ON/OFF テスト済み)
- **A3: FX PERF が「UI だけ動いて音に効かない」**→ Beat Repeat を lastFired 方式に変更、STUTTER 修正、DELAY THROW / REVERB FREEZE / BIT CRUSH を実装、Debug Panel に全 FX の active/パラメータ/最終トリガー/ルーティング接続を表示+グラフ未初期化時の警告
- **A1: LEAD に初期状態でディレイ**(音色チェーンに FeedbackDelay wet 0.18 がハードワイヤ)→ 撤去。ディレイはマスターセンド経由のオプトインのみ
- **A2: DELAY TIME 切替でクリックノイズ**→ duck+glide 方式(上記)。連打安全

## 修正済み(2.0 安定化パスで解消 — 再発時はバグ)

- 白画面(ErrorBoundary 不在/Timeline 無検証ロード/サンプル削除時 sentinel.dispose)
- Tape Stop 連打・J 長押しによる BPM 破壊、PANIC で BPM が 120 に化ける
- H キーが Help に奪われ Stutter が効かない/Help 中 Esc で PANIC
- キー長押しでショートカット連射(Space/J/Shift+A)
- FILTER SWEEP 等のドラッグで Reverb IR が毎イベント再生成(音切れ)
- スナップショット MORPH が常に約 50ms で潰れる
- 録音自動停止後に REC 表示が残る/M キー反転
- Beat Repeat が Tone.now() 基準でグリッドからズレる
- Momentary FX ボタンの touch+mouse 二重発火
- スマホ横で FX パネル下部に到達不能/サンプルリストの溢れが操作不能
- PANIC 連打でマスター音量が消失
- SamplePlayer の二重 fetch/decode
- Cmd+Shift+V が Repeat Fill ではなく Paste に吸われる
