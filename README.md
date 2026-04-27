# sao-calendar-ui

Google Calendar の「今日の予定」を取得し、SAO 風 UI で表示するローカル用ダッシュボードです。

## 概要

- `main.py` が Google Calendar API から予定を取得し、`http://127.0.0.1:5000/events` を提供します。
- `src/index.html` と `src/renderer.js` が予定一覧・現在イベント・残り時間をリアルタイム表示します。

### 主な機能

- **当日イベント取得**: 複数カレンダーから当日分をまとめて取得。
- **キャッシュ**: サーバ側で一定時間キャッシュし、API 負荷を抑制。
- **リアルタイム表示**: 現在時刻、進行中イベント、次イベント、一覧を自動更新。
- **フィルター**: Current / Upcoming / Past をチェックボックスで切り替え。
- **ローカル演出**: 背景画像・フォント・音声を使ったローカル UI カスタマイズ。

## ファイル構成

```text
.
├── main.py               # Google Calendar API を叩くローカルサーバ
├── requirements.txt      # Python 依存ライブラリ
├── .secrets/             # 認証情報（Git 除外）
│   ├── Google_calendar_service_key.json
│   └── cal_ids.txt
└── src/
    ├── index.html
    ├── renderer.js
    ├── styles.css
    ├── icons/
    └── fonts/
```

## セットアップ

### 1. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 2. Google Calendar 認証情報を配置

1. サービスアカウント鍵 JSON を `.secrets/Google_calendar_service_key.json` に配置
2. 取得対象のカレンダー ID を `.secrets/cal_ids.txt` に 1 行 1 ID で記載
3. 対象カレンダー側でサービスアカウントに閲覧権限を付与

### 3. ローカル素材を配置

以下のファイルをローカルに配置してください。

- SAO フォント: `src/fonts/sao.otf`
- 背景画像: `src/background.jpg`
- アイコン: `src/icons/icon.png`
- 任意の通知音: `src/s.mp3`, `src/s1.mp3`

注意:

- フォントは CSS 側で `SwordArtOnline` として利用しています（`src/styles.css`）。
- ファイル名を変える場合は `src/styles.css`（背景・フォント）と `src/index.html`（アイコン参照）を合わせて修正してください。

## 使い方

### 1. API サーバ起動

```bash
python main.py
```

### 2. フロント表示

- `src/index.html` をブラウザで開く

## 画面の見方

- **中央タイマー**: 進行中イベントの終了、または次イベント開始までの残り時間
- **Today リスト**: 当日の予定を時系列で表示
- **Current / Upcoming / Past**: 表示対象を切り替えるフィルター
- **Status**: 取得成功件数と最終更新時刻、失敗時の stale 状態

## 注意事項

- **ローカル利用前提**: 本ツールは個人利用を想定したローカルダッシュボードです。
- **認証情報管理**: `.secrets/` 配下や鍵ファイルは絶対に公開しないでください。
- **可用性**: Google API 制限や通信状況により取得失敗する場合があります。
- **素材の著作権**: 背景画像・フォント・音声は、自作または利用許諾が明確なもののみ使用してください。
