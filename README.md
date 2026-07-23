# 📦 Glacier Photo Vault

AWS Glacier Deep Archiveを使った、取り出し時のみ課金されるデジタル貸金庫サービス

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![iOS](https://img.shields.io/badge/iOS-16.0%2B-blue)

## 🎯 概要

**Glacier Photo Vault**は、AWS S3 Glacier Deep Archiveを活用した超低コストの写真長期保管サービスです。

### 主な特徴

- 💰 **超低コスト**: S3標準ストレージの約1/4のコスト
- 📤 **アップロード無料**: 保管時の課金なし
- 💸 **取り出し時のみ課金**: 必要な時だけコストが発生
- 🔒 **高い耐久性**: 99.999999999%（イレブンナイン）の耐久性
- 🎨 **デジタル庁デザインシステム準拠**: アクセシビリティとユーザビリティを重視
- 📱 **マルチプラットフォーム**: Web + iOS ネイティブアプリ

## 🚀 クイックスタート

### 必要要件

- Node.js 18.0.0以上
- AWS アカウント
- iOS 16.0以上（iOSアプリの場合）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/YOUR_USERNAME/glacier-photo-vault.git
cd glacier-photo-vault

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAWS認証情報を設定
```

### 起動

```bash
# 開発サーバーの起動（バックエンド + フロントエンド）
npm run dev

# バックエンドのみ
npm run dev:backend

# フロントエンドのみ
npm run dev:frontend
```

ブラウザで `http://localhost:5173` にアクセス

## 📁 プロジェクト構造

```
glacier-photo-vault/
├── backend/                 # Node.js + Express バックエンド
│   ├── src/
│   │   ├── services/        # ビジネスロジック
│   │   │   ├── GlacierPhotoService.ts
│   │   │   └── AIAgentService.ts
│   │   ├── routes/          # APIルート
│   │   │   └── photoRoutes.ts
│   │   └── index.ts         # エントリーポイント
│   └── package.json
├── frontend/                # React + TypeScript フロントエンド
│   ├── src/
│   │   ├── components/      # Reactコンポーネント
│   │   │   └── PhotoVault.tsx
│   │   ├── design-system/   # DADSデザイントークン
│   │   │   ├── tokens.ts
│   │   │   └── global.css
│   │   └── main.tsx
│   └── package.json
├── ios/                     # iOS ネイティブアプリ
│   └── GlacierPhotoVault/
│       ├── GlacierPhotoVault/
│       │   ├── DesignSystem.swift
│       │   ├── Models.swift
│       │   ├── APIClient.swift
│       │   ├── ContentView.swift
│       │   └── PhotoCardView.swift
│       └── GlacierPhotoVault.xcodeproj/
├── shared/                  # 共有型定義
│   └── src/
│       └── types.ts
└── README.md
```

## 🎨 デザインシステム

デジタル庁デザインシステム（DADS）に完全準拠

- ✅ カラーパレット: プライマリ `#0066CC`
- ✅ タイポグラフィ: 明確な階層構造
- ✅ 8pxグリッドシステム
- ✅ アクセシビリティ: WCAG 2.1 AA準拠、コントラスト比4.5:1以上
- ✅ タップ領域: 44px以上

参考: [デジタル庁デザインシステム](https://design.digital.go.jp/dads/)

## 💡 機能

### 実装済み

- ✅ 写真アップロード（Glacier Deep Archiveへ自動保存）
- ✅ メタデータ管理（タイトル、説明、タグ）
- ✅ サムネイル表示（即時表示）
- ✅ 復元リクエスト（Standard 12時間 / Bulk 48時間）
- ✅ 復元状態確認
- ✅ プレサインドURLによるダウンロード
- ✅ 統計情報ダッシュボード
- ✅ ユーザー毎の写真管理

### 計画中

- 🔲 AWS Cognito認証統合
- 🔲 DynamoDB でのメタデータ管理
- 🔲 Lambda によるサムネイル自動生成
- 🔲 復元コストシミュレーター
- 🔲 AI自動タグ付け（Rekognition）
- 🔲 共有リンク機能
- 🔲 プッシュ通知（復元完了時）

## 🔧 AWS設定

### 1. S3バケットの作成

```bash
aws s3 mb s3://glacier-photo-vault --region ap-northeast-1
```

### 2. ライフサイクルポリシーの設定

```json
{
  "Rules": [
    {
      "Id": "MoveToGlacierDeepArchive",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 0,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ]
    }
  ]
}
```

### 3. IAM権限の設定

必要な権限:
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:ListBucket`
- `s3:RestoreObject`
- `s3:HeadObject`

詳細は [README_GLACIER.md](./README_GLACIER.md) を参照

## 📱 iOSアプリ

### セットアップ

```bash
cd ios/GlacierPhotoVault
open GlacierPhotoVault.xcodeproj
```

Xcodeでビルド＆実行

詳細は [ios/README.md](./ios/README.md) を参照

## 🌐 API エンドポイント

### 写真管理

```
POST   /api/photos/upload              # 写真アップロード
GET    /api/photos/user/:userId        # ユーザーの写真一覧
GET    /api/photos/:photoId            # 写真詳細
PUT    /api/photos/:photoId            # メタデータ更新
DELETE /api/photos/:photoId            # 写真削除
```

### 復元管理

```
POST   /api/photos/:photoId/restore           # 復元リクエスト
GET    /api/photos/:photoId/restore/status    # 復元状態確認
GET    /api/photos/:photoId/download          # ダウンロードURL取得
```

### 統計

```
GET    /api/photos/user/:userId/stats         # 統計情報
```

### 直接アップロード（プリサインドURL・大容量対応）

```
POST   /api/uploads/init                      # アップロードURL発行（単一/マルチパート）
POST   /api/uploads/complete                  # 完了・メタデータ記録
POST   /api/uploads/abort                     # マルチパート中断
```

### 認証・課金

```
GET    /api/auth/google | /api/auth/line      # OAuth開始（PKCE対応）
POST   /api/auth/apple                        # Sign in with Apple
POST   /api/auth/token                        # 認可コード→トークン交換
GET    /api/billing/tiers                     # 料金ティア一覧
```

## 💰 料金プラン（ティア制）

| ティア | 容量 | 月額 |
|---|---|---|
| Mini | 200GB | ¥150 |
| Standard | 1TB | ¥400 |
| Plus | 2TB | ¥700 |
| Max | 5TB | ¥1,500 |

- 30日間無料トライアル
- データ復元（Bulk 48h）: 月間 契約容量の5%まで無料、超過 ¥20/GB
- データ復元（Standard 12h）: ¥30/GB

### 原価参考（AWS）

- 保管: 約 $0.00099 / GB / 月（Glacier Deep Archive）
- 復元: Standard 約 $0.02 / GB、Bulk 約 $0.0025 / GB
- データ転送（ダウンロード）: 約 $0.09 / GB

## 🛡️ セキュリティ

- AWS認証情報は環境変数で管理
- S3オブジェクトの自動暗号化
- プレサインドURLによる安全なダウンロード
- HTTPSによる通信の暗号化
- 最小権限の原則に基づくIAM設定

## 🧪 テスト

```bash
# ユニットテスト
npm test

# E2Eテスト
npm run test:e2e

# カバレッジ
npm run test:coverage
```

## 📊 モニタリング

- AWS CloudWatch メトリクス
- S3アクセスログ
- AWS CloudTrail による操作ログ
- コストアラート設定

## 🤝 コントリビューション

コントリビューションを歓迎します！

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 👥 作者

- 開発: Claude (Anthropic)
- デザインシステム: デジタル庁デザインシステム（DADS）準拠

## 🔗 関連リンク

- [デジタル庁デザインシステム（DADS）](https://design.digital.go.jp/dads/)
- [AWS Glacier Deep Archive](https://aws.amazon.com/glacier/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## 📮 サポート

問題が発生した場合は、[Issues](https://github.com/YOUR_USERNAME/glacier-photo-vault/issues) で報告してください。

---

Made with ❤️ using AWS Glacier Deep Archive & DADS Design System
