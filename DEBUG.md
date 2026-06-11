# DEBUG.md — トラブルシューティングガイド

## Debug Panel(アプリ内)

下部タブ **DEBUG** で確認できるもの:

| 項目 | 意味 / 正常値 |
|---|---|
| AudioContext | `running` が正常。`suspended` なら PLAY をタップして解除 |
| Transport | 再生中 `started` / 停止中 `stopped` |
| BPM (actual) | Tone.Transport の実テンポ。**BPM (UI) と乖離していたら異常**(Tape Stop 系のバグの兆候) |
| Swing | 現在のスウィング % |
| Step | オーディオ側の現在ステップ |
| FPS | 50–60 が目安。30 を切るなら描画負荷を疑う |
| Memory | Chrome のみ。30 分再生で単調増加し続けるならリーク |
| localStorage | 使用量目安。5MB が上限の目安 |
| errors | 直近 50 件のエラーログ(リロード後も保持) |

**COPY LOG** ボタンで環境情報+エラー一覧を markdown でコピーし、そのまま AI レビュー(Codex / Claude)や Issue に貼り付けられます。

## クラッシュ時(ErrorBoundary 画面)

白画面の代わりに「エラーが発生しました」画面が出ます。

- **RELOAD**: その場で復帰(まず試す)
- **DEBUG PANEL**: エラー詳細とスタックをその場で表示
- **COPY ERROR LOG**: レビュー用ログをコピー
- **RESET DATA**: `step-sequencer:*` の保存データを全削除してリロード。**保存データ自体が壊れて起動できない場合の最終手段**(Timeline / パターン / サンプルメタデータが消えます)

## よくある症状と対処

### 音が出ない
1. PLAY を**タップ/クリック**で押したか(自動再生制限)。初回タッチ + PLAY の両方で AudioContext を unlock します
2. DEBUG → AudioContext が `running` か(`suspended` のままなら一度画面をタップ)
3. iOS: サイレントスイッチ / Bluetooth 出力先 / 着信や Siri 後は画面タップで自動復帰
4. PANIC(Esc)直後は約 0.3 秒ミュートされます(仕様)
5. **http:// で開いていないか**(スマホからローカル IP に http アクセスすると非セキュアコンテキスト。本番は必ず HTTPS / Vercel を使用)。AudioWorklet は排除済みなので http でも無音にはなりませんが、マイク録音は HTTPS 必須
5. MASTER スライダー / KILL 3バンド / DEPTH=100% の STUTTER LAT 残留を確認
6. 開発者向け: dev 環境ではコンソールで実測可能 —
   `const {graph,Tone}=window.__seqDebug; const m=new Tone.Meter({smoothing:0}); graph.master.masterOut.connect(m); graph.voices.drums.kick.trigger({time:Tone.now()+0.1,velocity:1,plocks:{filterCutoff:null,pan:null,pitchOffset:null}}); setTimeout(()=>console.log('dB:',m.getValue()),400)`
   −∞ のままなら音声グラフの問題(過去事例: DelayNode 無しフィードバックサイクルによる仕様上の無音化 → known-issues.md 参照)。`npm run test:e2e` の「audio output」3テストが同件の回帰検知です

### テンポがおかしい
- DEBUG → **BPM (actual)** と **BPM (UI)** を比較
- Tape Stop 直後は release/resume の完了を待つ(最大 設定秒+0.5s)
- それでも乖離する場合は BPM を ↑↓ で 1 動かすと再同期します(エラーログを COPY して報告してください)

### REC 表示が消えない
- 修正済み(自動停止が状態を同期します)。再発したら M キーで一度トグルし、エラーログを確認

### Timeline が「破損」と表示される
- 旧バージョンの保存形式か、データ破損です。そのスロットに **SAVE で上書き**すれば再利用できます。読み込まれないだけで他の動作には影響しません

### マイクが使えない
- HTTPS で開いているか(http:// では `unsupported` になります)
- ブラウザのサイト設定でマイクが「許可」か
- 拒否してもアプリは落ちません(エラーメッセージ表示のみ)

## DevTools の Self-XSS 警告

コンソールを開くと出る「コードを貼り付けないでください」という大きな警告は **ブラウザの標準メッセージ**です。アプリのクラッシュ・エラーとは無関係です。アプリのエラーは DEBUG タブ(または `step-sequencer:errorlog:v1` キー)に記録されたものだけを見てください。

## エラーログの仕組み

- `window.onerror` / `unhandledrejection` / React ErrorBoundary の3経路を捕捉
- localStorage `step-sequencer:errorlog:v1` にリングバッファ(最大 50 件)で保存
- 個人情報は UA 文字列以外含まれません

## localStorage キー一覧

| キー | 内容 |
|---|---|
| step-sequencer:pattern:v4 | ステップパターン(64 step) |
| step-sequencer:timelines:v1 | Timeline 4 スロット |
| step-sequencer:performance:v1 | FX 設定 |
| step-sequencer:snapshots:v1 | SCENES A–D |
| step-sequencer:loop:v1 | Loop 長・ページ |
| step-sequencer:samples:v1 | サンプルのメタデータ(音声本体は IndexedDB `step-sequencer-samples`) |
| step-sequencer:perfFx:v1 | Beat Repeat / Stutter / Tape の設定 |
| step-sequencer:note-editor:v1 | Scale / Root / Lock |
| step-sequencer:ui:v1 | 選択中タブ |
| step-sequencer:errorlog:v1 | エラーログ |

全消去(完全リセット): DevTools コンソールで
`Object.keys(localStorage).filter(k=>k.startsWith('step-sequencer:')).forEach(k=>localStorage.removeItem(k))`
→ リロード。IndexedDB は Application タブから `step-sequencer-samples` を削除。
