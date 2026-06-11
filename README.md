# Step Sequencer 2.0

ブラウザで動作するライブパフォーマンス用ステップシーケンサー。
React + TypeScript + Vite + Tone.js (Web Audio)。PC / タブレット / スマホ対応、Vercel にそのままデプロイ可能です。

## 起動方法

```bash
npm install
npm run dev        # http://localhost:5173
```

## ビルド方法

```bash
npm run build      # 型チェック (tsc --noEmit) + vite build → dist/
npm run preview    # ビルド結果をローカル確認
```

Vercel には追加設定不要(Build Command: `npm run build` / Output: `dist`)。
マイク録音は HTTPS が必須です(Vercel は標準で HTTPS)。

## テスト方法

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest 単体テスト
npm run test:e2e   # Playwright E2E(初回: npx playwright install chromium)
```

詳細は [TESTING.md](TESTING.md) を参照。

## 基本操作

- **PLAY / STOP**: 左上ボタンまたは Space。初回 PLAY はブラウザの自動再生制限解除を兼ねます(必ずタップ/クリックで開始)
- **ステップ入力**: グリッドのセルをタップで ON/OFF。選択中ステップは NOTE / STEP FX タブで編集
- **トラック**: KICK / SNARE / CH / OH / CLAP / PERC(ドラム)、BASS / LEAD(シンセ)
- **LOOP**: ×0.25〜×16(1〜64 ステップ)。PAGE ボタンで 16 ステップずつ表示切替
- **MIXER**: トラックごとの Mute / Delay send / Reverb send
- **FX MAIN**: Filter Sweep / Q、Master、KILL EQ、Delay / Reverb / Comp
- **FX PERF**: Beat Repeat / Stutter Gate / Tape Stop / Delay Throw / Reverb Freeze / Bit Crush(MOM=押している間、LAT=トグル)
- **SNAP (SCENES)**: FX 設定の A–D スナップショット。MORPH 秒数をかけて滑らかに遷移
- **TIMELINE**: プロジェクト全体(下記参照)を 4 スロットに保存 / 読込
- **SAMPLE**: マイク録音 → ドラムトラックへ割当て(そのトラックの音が置き換わる)
- **DEBUG**: エンジン状態・エラーログ(下記参照)

## ショートカット一覧

アプリ内では `?`(Shift+/)でいつでも一覧を表示できます。

| キー | 動作 |
|---|---|
| Space | Play / Stop |
| Esc | PANIC(全停止+音量カット→自動復帰) |
| Enter | 選択ステップの ON/OFF |
| ↑ / ↓(⇧で±5) | BPM ±1 / ±5 |
| ⇧← / ⇧→ | ステップページ移動 |
| Q W E R T Y | Loop ×0.5 / ×1 / ×2 / ×4 / ×8 / ×16 |
| [ / ] | Loop を短く / 長く |
| 1–8 | トラック選択 |
| A S D F(⇧で読込) | Timeline 1–4 選択 / 読込 |
| ⌘S (Ctrl+S) | Timeline 保存 |
| Z X C | Kill Low / Mid / High |
| V | Filter Sweep → 0 |
| B / N | Delay / Reverb On-Off |
| M | 録音開始 / 停止 |
| G / H / J | Beat Repeat / Stutter / Tape Stop |
| ⌘C ⌘V ⌘D ⌘Z | ループの Copy / Paste / 複製 / 取り消し |
| ? (Shift+/) | ヘルプ |

※ **H は Stutter 専用**です(旧版では Help と衝突していました)。
※ キー長押しによる連射(`e.repeat`)は全ショートカットで無効です。
※ ヘルプ表示中はグローバルショートカットが全て無効になり、Esc はヘルプを閉じるだけです(PANIC しません)。

## スマホでの使い方(2.1 モバイル再設計)

スマホ(幅 767px 以下/横向きで高さ 500px 未満)では PC の3カラムを縮小せず、**専用レイアウト**になります。

- **縦向き**: コンパクト Transport(PLAY/BPM/AUDIO 状態/PANIC + SWING/VOL)→ **Step Grid が画面の 65〜75%** → DRUM/BASS/LEAD/SMPL トラックタブ → クイックバー(LOOP/MEMORY 1–4/SAVE/FOCUS)。グリッドは選択中グループのみ表示し、セルは縦長(高さ 55〜96px)でタップしやすく
- **横向き = Performance Mode**: 左レール(PLAY/BPM/トラック/LOOP/MEM)+ **グリッド最大表示** + 右レールの Quick FX(FILTER/REPEAT/STUTTER/TAPE/THROW/FREEZE + PANIC)
- **メニュー(≡ FAB)**: 右下の FAB でドロワーをスライド表示。FX/SAMPLE/MEMORY/NOTE/MIXER/SCENES/DEBUG は**ボトムシート**(初期 62%・▴で 90%・下スワイプ/背景タップ/Esc/CLOSE で閉じる)。シート内部のみスクロール可
- **Mini Map**: ループが 17 ステップ以上のとき表示。現在ページ(枠)と再生中ページ(●)を示し、タップでページ移動
- **Focus Mode**: クイックバー等を隠してグリッドに集中(EXIT FOCUS で復帰)
- **Quick Memory**: タップ= LOAD(確認ガード設定に従う)。SAVE は「SAVE → スロット選択 → 上書き時は確認」の誤爆防止式
- **ノート編集**: BASS/LEAD のステップを**もう一度タップ**すると NOTE シートが開きます
- ドロワー/シート表示中も再生は継続し、Esc は PANIC ではなく「閉じる」になります

## Delay について(重要)

**Delay はユーザーが操作した場合のみ音に反映されます。** 初期状態では

- マスター DELAY: OFF
- 全トラックの DLY センド: 0
- LEAD / BASS / ドラム / サンプルすべて**ドライ**で発音します
  (旧版で LEAD に常時かかっていた内蔵ディレイは撤去済み)

Delay を鳴らす方法は3つ: ① FX MAIN の DELAY を ON+MIXER の DLY センドを上げる、② FX PERF の **DELAY THROW**(押している間だけバス全体をディレイへスロー、離すと残響だけ残る)、③ ショートカット `B` で ON/OFF。MEMORY / Timeline をロードしても、保存時に自分で ON にしていない限り Delay が勝手に復活することはありません。

TIME の切り替えは内部で「リターンを 25ms ダック → ディレイ長をグライド → 復帰」する方式のため、再生中に連打してもクリックノイズや破裂音は出ません。

## FX PERF の使い方

| FX | 内容 | 安全設計 |
|---|---|---|
| BEAT REPEAT | 直近2拍以内に実際に鳴った各トラックのヒットをグリッドに同期して連打 | Loop の正確な time でスケジュール |
| STUTTER | マスターをゲートで刻む(H キー) | **リミッター前の線形 0–1 ゲート駆動。増幅は構造的に不可能**。深さは内部上限 85%(最小 -16dB フロア)、ON/OFF に 15ms フェード |
| TAPE STOP | テープ停止(J キー) | BPM 復元保証・多重発火遮断 |
| DELAY THROW | 押している間、バス全体をディレイへ送る | センド上限 0.5、ループゲイン < 1 |
| REVERB FREEZE | リバーブ残響を持続(擬似フリーズ) | 再循環 0.85 上限、IR 再生成なし、離すと自然減衰 |
| BIT CRUSH | 4bit クラッシャーをクロスフェード挿入 | wet 上限 0.6、リミッターが最終保護 |

全 FX の現在状態(active / パラメータ / 最終トリガー時刻 / ルーティング接続)は **DEBUG タブ**で確認できます。

## Swing の使い方

トランスポートバーの **SWING** スライダー(0–75%)。
16 分音符基準で **偶数拍裏(奇数番ステップ)を最大「半ステップ × 75%」遅らせます**。
再生中にリアルタイムで変更でき、BPM に追従します。Timeline 保存 / 読込の対象です。

## Sample Trim の使い方

SAMPLE タブの各サンプル行下段にある **TRIM** スライダー(START / END)。

- 再生範囲を秒単位で指定。END を末尾まで動かすと「最後まで再生」
- START < END が常に保証されます(不正値は自動補正、最小幅 0.05 秒)
- 設定は localStorage に保存され、リロード後も維持されます

## Timeline 保存 / 読込の仕様

**保存対象**: BPM / Swing / Loop 長 / 全ステップパターン / Mute / FX 設定(Performance)/ SCENES(A–D スナップショット)

**保存対象外(仕様)**: マイクサンプルの実体と割当て。サンプルは端末ローカルの IndexedDB に保存されるため、Timeline には含めません。**Timeline を読み込んでも現在のサンプル割当てはそのまま維持されます**(意図しない音色変化を避けるため)。

- 保存データはロード時に検証・正規化されます。旧形式は可能な範囲で自動修復、修復不能なスロットは「破損」と表示され無視されます(白画面にはなりません)
- 「確認」チェックを外すと LOAD 時の確認ダイアログを省略できます(ライブ向け)

## Debug Panel の使い方

下部タブの **DEBUG** を開くと以下が確認できます。

- AudioContext / Transport の状態、BPM 実値(UI 値と別に表示)、Swing、現在ステップ
- FPS / メモリ使用量目安(Chrome のみ)/ localStorage 使用量目安
- 記録されたエラー一覧(直近 50 件、リロード後も保持)
- **COPY LOG**: 環境情報+エラーログを markdown 形式でクリップボードへ。そのまま Codex / Claude などのレビューに貼り付けられます

クラッシュ時はフォールバック画面(ErrorBoundary)からも同じログをコピーできます。

## DevTools の Self-XSS 警告について

ブラウザの DevTools コンソールを開くと「**コードを貼り付けないでください**」等の大きな警告が表示されることがあります。これは **ブラウザ標準のセキュリティ注意書きであり、本アプリのエラーやクラッシュではありません**。アプリ自身のエラーは DEBUG タブのエラー一覧で確認してください。

## ライブ前チェックリスト

1. [ ] 本番と同じ端末・ブラウザで `npm run build` 済みの URL を開く(または Vercel 本番 URL)
2. [ ] 画面タップで PLAY → 音が出る(iOS は必ずタップで開始)
3. [ ] 端末のサイレントスイッチ OFF / 音量確認 / 画面自動ロック OFF
4. [ ] DEBUG タブ: AudioContext = `running`、エラー 0 件
5. [ ] 使用する Timeline 1–4 を読込テスト(破損表示がないこと)
6. [ ] マイクを使う場合: 録音許可を事前に一度許可しておく
7. [ ] Tape Stop / Beat Repeat / Stutter を一通り発動 → PANIC(Esc)で復帰確認
8. [ ] BPM を本番値に設定し、Tape Stop 後も BPM が戻ることを確認
9. [ ] 「確認」ガードを好みに設定(ライブ中ダイアログを出したくなければ OFF)
10. [ ] 通信不要で動くことを確認(機内モードで一度リロード — フォント以外は完全ローカル)
11. [ ] LEAD を単発で鳴らし**ディレイがかかっていない**こと(かかっていたら DLY センドを確認)
12. [ ] STUTTER(H)を ON/OFF し、**音量が元と変わらない**こと
13. [ ] DELAY TIME を再生中に連続切替してノイズが出ないこと
14. [ ] FX PERF 全6種(BEAT/GATE/TAPE/THROW/FREEZE/CRUSH)を耳で確認

## デプロイ(Vercel)

- Build Command `npm run build` / Output `dist` / 環境変数 **不要** / Node 20+(`engines` 指定済み)
- マイク録音は HTTPS 必須 → Vercel 標準 HTTPS で動作
- localStorage / IndexedDB はドメイン単位 — **本番 URL とプレビュー URL では保存データが別**になります
- **PWA 化はしていません**(オフラインキャッシュなし)。ライブ前に一度本番 URL を開いてフルロードしておくこと

## 既知の制限

[known-issues.md](known-issues.md) を参照。
