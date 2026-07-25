/**
 * STSスコープ付き一時クレデンシャル発行
 *
 * AssumeRole + セッションポリシーで「自分のプレフィックス配下のみ」に
 * IAMレベルで制限された一時認証情報を発行する。アプリ層の認可バグが
 * あっても他ユーザーのデータに到達できない多層防御の要。
 *
 * 必要な環境変数:
 *   AWS_UPLOAD_ROLE_ARN — AssumeRole対象のロールARN
 *     （S3フルアクセス相当のポリシーを持ち、バックエンドのIAMユーザーから
 *       sts:AssumeRole可能であること。実効権限はセッションポリシーで絞られる）
 * 未設定の場合は501を返す（プリサインドURL方式は引き続き利用可能）。
 */

import express, { Request, Response } from 'express';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { authenticateJWT } from '../middleware/auth';
import { requireSubscription } from '../middleware/requireSubscription';

const router = express.Router();

const stsClient = new STSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

router.post(
  '/',
  authenticateJWT,
  requireSubscription,
  async (req: Request, res: Response) => {
    try {
      const roleArn = process.env.AWS_UPLOAD_ROLE_ARN;
      if (!roleArn) {
        return res.status(501).json({
          error: 'NotConfigured',
          message: 'Scoped credentials are not configured (AWS_UPLOAD_ROLE_ARN missing)',
        });
      }

      const userId = req.user!.userId;
      const bucket = process.env.S3_BUCKET_NAME || 'glacier-photo-vault';

      // このセッションポリシーが実効権限の上限になる（ロール本体の権限との積）
      const sessionPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'UserPrefixObjectAccess',
            Effect: 'Allow',
            Action: ['s3:PutObject', 's3:GetObject', 's3:AbortMultipartUpload'],
            Resource: [`arn:aws:s3:::${bucket}/${userId}/*`],
          },
          {
            Sid: 'UserPrefixList',
            Effect: 'Allow',
            Action: ['s3:ListBucket'],
            Resource: [`arn:aws:s3:::${bucket}`],
            Condition: { StringLike: { 's3:prefix': [`${userId}/*`] } },
          },
        ],
      };

      const result = await stsClient.send(
        new AssumeRoleCommand({
          RoleArn: roleArn,
          RoleSessionName: `vault-${userId}`.slice(0, 64).replace(/[^a-zA-Z0-9+=,.@_-]/g, '_'),
          Policy: JSON.stringify(sessionPolicy),
          DurationSeconds: 3600, // 1時間
        })
      );

      const creds = result.Credentials;
      if (!creds) {
        throw new Error('AssumeRole returned no credentials');
      }

      res.json({
        success: true,
        credentials: {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.SessionToken,
          expiration: creds.Expiration,
        },
        bucket,
        region: process.env.AWS_REGION || 'us-east-1',
        prefix: `${userId}/`,
      });
    } catch (error: any) {
      console.error('Credential issue error:', error);
      res.status(500).json({ error: error.message || 'Failed to issue credentials' });
    }
  }
);

export default router;
