# Firebase Util Scripts

本ディレクトリは、過去の Firestore マイグレーションおよびメンテナンス用のワンショットスクリプト群です。
本番の Cloud Functions 実行環境からは直接参照されません。

## ファイル一覧

- `171104_migration_disclosure.js`: Realtime Database から Firestore への移行スクリプト（2017年実施）
- `addTag.js`: 過去の開示情報ドキュメントにタグを一括付与するメンテナンススクリプト
- `companies.js`: EDINET/企業コード関連の一括処理スクリプト
- `registerDisclosureMissed.js`: 欠落した開示情報の復旧スクリプト
- `test.js`: ローカル疎通確認用テストスクリプト
- `config/admin.js`: Firebase Admin 初期化設定
