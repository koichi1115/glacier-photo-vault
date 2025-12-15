# CloudWatch Logs統合 & MFA設定ガイド

このドキュメントは、Glacier Photo VaultのCloudWatch Logs統合とMFA（多要素認証）設定を説明します。

## 📋 目次

1. [CloudWatch Logsの統合 (Tier 3)](#1-cloudwatch-logsの統合-tier-3)
2. [MFA設定（管理者アカウント） (Tier 3)](#2-mfa設定管理者アカウント-tier-3)

---

## 1. CloudWatch Logsの統合 (Tier 3)

### 1-1. CloudWatch Logsの概要

CloudWatch Logsを使用すると、アプリケーションログを一元管理し、以下が可能になります：

- リアルタイムログ監視
- ログの検索・フィルタリング
- メトリクスの抽出
- アラーム設定（異常検知）
- 長期保存と分析

### 1-2. IAMポリシーの設定

アプリケーションがCloudWatch Logsにアクセスできるよう、IAMユーザーに権限を付与します。

**IAMポリシー（JSON）:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/glacier-photo-vault:*"
    }
  ]
}
```

### 1-3. winston-cloudwatchの統合（オプション）

アプリケーションログをCloudWatchに送信するには、`winston-cloudwatch`パッケージを使用します。

**インストール:**

```bash
npm install winston-cloudwatch
```

**AuditLogger.tsへの統合:**

`backend/src/services/AuditLogger.ts` の以下のコメント部分を有効化：

```typescript
// CloudWatch Logsへの送信（本番環境）
if (process.env.NODE_ENV === 'production' && process.env.AWS_CLOUDWATCH_ENABLED === 'true') {
  const CloudWatchTransport = require('winston-cloudwatch');
  this.logger.add(new CloudWatchTransport({
    logGroupName: '/aws/glacier-photo-vault',
    logStreamName: `audit-${new Date().toISOString().split('T')[0]}`,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  }));
}
```

### 1-4. 環境変数の追加

`.env`ファイルに以下を追加：

```bash
# CloudWatch Logs設定
AWS_CLOUDWATCH_ENABLED=true  # 本番環境でtrue
```

### 1-5. CloudWatch Logsの確認

**AWS Management Consoleでの確認:**

1. CloudWatch コンソールを開く: https://console.aws.amazon.com/cloudwatch/
2. 左メニューから「ログ」→「ロググループ」を選択
3. `/aws/glacier-photo-vault` ロググループを確認
4. ログストリームをクリックしてログを表示

**AWS CLIでの確認:**

```bash
# ロググループ一覧を表示
aws logs describe-log-groups --log-group-name-prefix /aws/glacier-photo-vault

# ログストリーム一覧を表示
aws logs describe-log-streams \
  --log-group-name /aws/glacier-photo-vault \
  --order-by LastEventTime \
  --descending

# ログイベントを表示
aws logs tail /aws/glacier-photo-vault --follow
```

### 1-6. CloudWatch Logsのアラーム設定

セキュリティイベントに対してアラームを設定します。

**例: 不正アクセス試行の検知**

1. CloudWatch コンソールで「アラーム」→「アラームの作成」を選択
2. 「ログのメトリクスフィルター」を作成：

```json
{
  "$.event": "SECURITY_UNAUTHORIZED_ACCESS"
}
```

3. メトリクス名: `UnauthorizedAccessAttempts`
4. しきい値: 5分間に5回以上
5. アクション: SNSトピックにメール通知

### 1-7. ログの保持期間設定

コスト削減のため、ログの保持期間を設定します。

```bash
# ログの保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/glacier-photo-vault \
  --retention-in-days 30
```

**推奨保持期間:**
- セキュリティログ: 90日以上
- アクセスログ: 30日
- エラーログ: 60日

---

## 2. MFA設定（管理者アカウント） (Tier 3)

### 2-1. MFAの概要

MFA（多要素認証）は、パスワードに加えて第2の認証要素（通常はワンタイムパスワード）を要求することで、アカウントのセキュリティを大幅に向上させます。

### 2-2. AWSルートアカウントのMFA設定

**手順:**

1. AWS Management Consoleにルートユーザーでログイン
2. 右上のアカウント名をクリック→「セキュリティ認証情報」を選択
3. 「多要素認証 (MFA)」セクションで「MFAを有効化」をクリック
4. 「仮想MFAデバイス」を選択
5. スマートフォンにGoogle Authenticator、Authy、または1Passwordをインストール
6. QRコードをスキャン
7. 連続する2つのMFAコードを入力して設定完了

### 2-3. IAMユーザーのMFA設定

各IAMユーザーにもMFAを設定することを強く推奨します。

**手順:**

1. IAMコンソールを開く: https://console.aws.amazon.com/iam/
2. 「ユーザー」から対象ユーザーを選択
3. 「セキュリティ認証情報」タブを開く
4. 「MFAデバイスの割り当て」をクリック
5. 「仮想MFAデバイス」を選択
6. QRコードをスキャンして設定

### 2-4. MFA必須ポリシーの適用

IAMユーザーに対して、MFA認証済みでないと特定の操作ができないようにするポリシーを設定します。

**IAMポリシー（JSON）:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAllExceptListedIfNoMFA",
      "Effect": "Deny",
      "NotAction": [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
        "iam:ResyncMFADevice",
        "sts:GetSessionToken"
      ],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    }
  ]
}
```

### 2-5. S3バケット削除時のMFA要求

本番環境のS3バケットに対して、削除操作にMFAを要求します。

```bash
# バケットバージョニングとMFA Deleteを有効化
# 注意: ルートアカウントのMFAデバイスが必要
aws s3api put-bucket-versioning \
  --bucket glacier-photo-vault \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::YOUR_ACCOUNT_ID:mfa/root-account-mfa-device 123456"
```

**⚠️ 注意**:
- `YOUR_ACCOUNT_ID` を実際のAWSアカウントIDに置き換え
- `123456` を現在のMFAコードに置き換え

### 2-6. Google OAuthとLINE OAuthのMFA

ユーザー認証にGoogle OAuthとLINE OAuthを使用しているため、各プロバイダー側でのMFA設定を推奨します。

**Google アカウント:**
- Googleアカウントの2段階認証を有効化: https://myaccount.google.com/security
- セキュリティキー、Google Authenticator、SMSなどを設定可能

**LINE アカウント:**
- LINE公式アカウントの2段階認証を有効化
- LINE Developers Consoleのアクセス制御設定を確認

### 2-7. MFA設定の確認チェックリスト

- [ ] AWSルートアカウントにMFAを設定
- [ ] 管理者IAMユーザーにMFAを設定
- [ ] アプリケーション用IAMユーザーのアクセスキーを定期的にローテーション
- [ ] S3バケットのMFA Deleteを有効化（本番環境）
- [ ] Google/LINEアカウントの2段階認証を推奨（ユーザー向けドキュメント）

---

## 3. ログとMFAのベストプラクティス

### 3-1. ログ監視の自動化

**CloudWatch Insights クエリ例:**

```sql
-- 過去24時間の不正アクセス試行を検索
fields @timestamp, userId, event, action, ipAddress
| filter event = "SECURITY_UNAUTHORIZED_ACCESS"
| sort @timestamp desc
| limit 100
```

```sql
-- ユーザー別のログイン成功回数
fields @timestamp, userId, event
| filter event = "AUTH_LOGIN_SUCCESS"
| stats count() by userId
| sort count desc
```

### 3-2. セキュリティアラートの設定

1. **不正アクセス試行**: 5分間に5回以上
2. **認証失敗**: 10分間に10回以上
3. **大量ダウンロード**: 1時間に100ファイル以上
4. **レート制限超過**: 5分間に3回以上

### 3-3. 定期的なセキュリティ監査

**月次レビュー:**
- CloudWatch Logsのセキュリティイベントを確認
- IAMユーザーのアクセス権限を見直し
- S3アクセスログを分析
- MFAデバイスの状態を確認

**年次レビュー:**
- すべてのセキュリティポリシーを見直し
- パスワードとアクセスキーをローテーション
- 使用していないIAMユーザーを削除

---

## 参考リンク

- [AWS CloudWatch Logs ドキュメント](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html)
- [AWS MFA設定ガイド](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html)
- [winston-cloudwatch GitHub](https://github.com/lazywithclass/winston-cloudwatch)
- [Google 2段階認証](https://www.google.com/landing/2step/)
