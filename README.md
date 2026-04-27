# SAOCalendar

## 目的
- `serverfix.py` が Google Calendar から「今日の予定」を取得して `http://127.0.0.1:5000/events` で返します。
- `src/index.html` + `src/renderer.js` がそれを表示/カウントダウンします。

## まずやること（カレンダーID）
- `cal_ids.txt`：通常の取得対象カレンダーID（1行1ID）
- `califx_ids.txt`：固定枠扱いのカレンダーID（1行1ID）

## 認証方式（おすすめ順）

### B. サービスアカウント（ログイン不要・推奨）
前提：対象カレンダーをサービスアカウントのメールアドレスに「共有」する必要があります。

1. サービスアカウント鍵JSONを `cred.json` としてリポジトリ直下に置く（このファイルは `.gitignore` で除外）
2. 対象カレンダー側で、サービスアカウントのメールに共有権限（閲覧）を付与
3. `SAO.bat` を実行

別名・別場所に置きたい場合（任意）：
- `SAO_CAL_SERVICE_ACCOUNT`：鍵JSONのパス

### A. OAuth（参考：ブラウザ認証が必要）
1. Google Cloud Console で OAuth クライアント（Desktop app）を作成
2. ダウンロードした JSON を `.secrets/credentials.json` に置く
3. `SAO.bat` を実行
4. 初回だけブラウザ認証 → `.secrets/token.json` が作られ、次回以降は自動更新

環境変数で場所を変えたい場合：
- `SAO_CAL_OAUTH_CLIENT`：OAuth クライアントJSONのパス
- `SAO_CAL_TOKEN`：トークン保存先



## 実行
- サーバ起動：`SAO.bat`
- フロント：`src/index.html` を開く（または簡易サーバで配信）

## 備考
- ログ：`log.txt`（`SAO_LOG_FILE` で変更可）
