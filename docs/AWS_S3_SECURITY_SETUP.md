# AWS S3セキュリティ設定ガイド

このドキュメントは、Glacier Photo VaultのS3バケットに必要なセキュリティ設定を説明します。

## 📋 目次

1. [S3暗号化の有効化 (Tier 1)](#1-s3暗号化の有効化-tier-1)
2. [バケットポリシーの厳格化 (Tier 1)](#2-バケットポリシーの厳格化-tier-1)
3. [S3アクセスログの有効化 (Tier 3)](#3-s3アクセスログの有効化-tier-3)
4. [パブリックアクセスブロック設定](#4-パブリックアクセスブロック設定)

---

## 1. S3暗号化の有効化 (Tier 1)

### 1-1. デフォルト暗号化の有効化（推奨: SSE-S3）

**AWS Management Consoleでの設定:**

1. S3コンソールを開く: https://console.aws.amazon.com/s3/
2. バケット `glacier-photo-vault` を選択
3. 「プロパティ」タブを開く
4. 「デフォルトの暗号化」セクションで「編集」をクリック
5. 以下を選択：
   - **暗号化タイプ**: `Amazon S3 マネージド キー (SSE-S3)`
   - **バケットキー**: `有効` （コスト削減のため）
6. 「変更を保存」をクリック

**AWS CLIでの設定:**

```bash
aws s3api put-bucket-encryption \
  --bucket glacier-photo-vault \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

### 1-2. SSE-KMSを使用する場合（より高度な暗号化）

**AWS CLIでの設定:**

```bash
# KMSキーを作成（未作成の場合）
aws kms create-key \
  --description "Glacier Photo Vault S3 Encryption Key" \
  --key-usage ENCRYPT_DECRYPT

# KMS Key IDを取得（出力のKeyIdをメモ）

# S3バケットにSSE-KMS暗号化を設定
aws s3api put-bucket-encryption \
  --bucket glacier-photo-vault \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:us-east-1:123456789012:key/YOUR_KEY_ID"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

**コスト比較:**
- **SSE-S3**: 無料
- **SSE-KMS**: KMSリクエスト毎に課金（月間10,000リクエストまで無料、以降$0.03/10,000リクエスト）

**推奨**: コスト重視の場合は **SSE-S3** を使用

---

## 2. バケットポリシーの厳格化 (Tier 1)

### 2-1. HTTPS必須のバケットポリシー

**AWS Management Consoleでの設定:**

1. S3コンソールでバケット `glacier-photo-vault` を選択
2. 「アクセス許可」タブを開く
3. 「バケットポリシー」セクションで「編集」をクリック
4. 以下のJSONを貼り付け：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::glacier-photo-vault",
        "arn:aws:s3:::glacier-photo-vault/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "AllowAuthenticatedAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:root"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:RestoreObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::glacier-photo-vault",
        "arn:aws:s3:::glacier-photo-vault/*"
      ]
    }
  ]
}
```

**⚠️ 注意**: `YOUR_ACCOUNT_ID` を実際のAWSアカウントIDに置き換えてください。

### 2-2. ユーザー毎のアクセス制御（IAMポリシー）

アプリケーションが使用するIAMユーザーに、最小限の権限を付与します。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:RestoreObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::glacier-photo-vault",
        "arn:aws:s3:::glacier-photo-vault/*"
      ]
    }
  ]
}
```

---

## 3. S3アクセスログの有効化 (Tier 3)

### 3-1. ログ保存用バケットの作成

```bash
# ログ保存用バケットを作成
aws s3 mb s3://glacier-photo-vault-logs --region us-east-1

# ログバケットにパブリックアクセスブロックを設定
aws s3api put-public-access-block \
  --bucket glacier-photo-vault-logs \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 3-2. アクセスログの有効化

```bash
aws s3api put-bucket-logging \
  --bucket glacier-photo-vault \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "glacier-photo-vault-logs",
      "TargetPrefix": "access-logs/"
    }
  }'
```

**ログの確認:**

```bash
aws s3 ls s3://glacier-photo-vault-logs/access-logs/
```

---

## 4. パブリックアクセスブロック設定

### 4-1. すべてのパブリックアクセスをブロック

**AWS Management Consoleでの設定:**

1. S3コンソールでバケット `glacier-photo-vault` を選択
2. 「アクセス許可」タブを開く
3. 「パブリックアクセスをブロック (バケット設定)」セクションで「編集」をクリック
4. すべてのチェックボックスをONにする：
   - ✅ 新しいアクセスコントロールリスト (ACL) を介して付与されたバケットとオブジェクトへのパブリックアクセスをブロックする
   - ✅ 任意のアクセスコントロールリスト (ACL) を介して付与されたバケットとオブジェクトへのパブリックアクセスをブロックする
   - ✅ 新しいパブリックバケットポリシーまたはアクセスポイントポリシーを介して付与されたバケットとオブジェクトへのパブリックアクセスをブロックする
   - ✅ 任意のパブリックバケットポリシーまたはアクセスポイントポリシーを介したバケットとオブジェクトへのパブリックおよびクロスアカウントアクセスをブロックする
5. 「変更を保存」をクリック

**AWS CLIでの設定:**

```bash
aws s3api put-public-access-block \
  --bucket glacier-photo-vault \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

## 5. バケットバージョニングの有効化（推奨）

誤削除からの保護のため、バージョニングを有効にすることを推奨します。

```bash
aws s3api put-bucket-versioning \
  --bucket glacier-photo-vault \
  --versioning-configuration Status=Enabled
```

---

## 6. 設定確認チェックリスト

すべての設定が完了したら、以下を確認してください：

- [ ] デフォルト暗号化が有効（SSE-S3またはSSE-KMS）
- [ ] HTTPS必須のバケットポリシーが設定済み
- [ ] パブリックアクセスブロックがすべて有効
- [ ] アクセスログが有効（Tier 3）
- [ ] バケットバージョニングが有効（推奨）
- [ ] IAMユーザーに最小権限が付与されている

---

## 7. セキュリティベストプラクティス

1. **定期的なアクセスログの監査**: 不正アクセスがないか定期的に確認
2. **MFA Deleteの有効化**: 本番環境では、削除操作にMFAを要求
3. **CloudTrailの有効化**: S3 API呼び出しをすべて記録
4. **ライフサイクルポリシー**: ログの自動削除（90日後など）

```bash
# MFA Deleteの有効化（ルートアカウントのMFAデバイスが必要）
aws s3api put-bucket-versioning \
  --bucket glacier-photo-vault \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::YOUR_ACCOUNT_ID:mfa/root-account-mfa-device XXXXXX"
```

---

## 8. トラブルシューティング

### 問題: 「Access Denied」エラーが発生する

**解決策:**
1. IAMユーザーの権限を確認
2. バケットポリシーでHTTPS接続を使用しているか確認
3. パブリックアクセスブロック設定を確認

### 問題: 暗号化が機能しない

**解決策:**
1. デフォルト暗号化が有効か確認
2. アップロード時にサーバー側暗号化が指定されているか確認（コードで`ServerSideEncryption`パラメータ）

---

## 参考リンク

- [AWS S3 暗号化ドキュメント](https://docs.aws.amazon.com/AmazonS3/latest/userguide/serv-side-encryption.html)
- [AWS S3 バケットポリシー例](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html)
- [AWS S3 セキュリティベストプラクティス](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
