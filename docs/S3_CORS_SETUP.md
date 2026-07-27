# S3 CORS設定（プリサインドURL直接アップロードに必須）

`/api/uploads/*` によるブラウザ/iOSからのS3直接PUTには、バケットにCORS設定が必要です。
特に `ETag` の公開（ExposeHeaders）がないとマルチパートアップロードが完了できません。

> **本番バケットは `glacier-photo-vault-ko1115`（ap-northeast-1）**（RenderのS3_BUCKET_NAME参照）。
> 同アカウントの `glacier-photo-vault`（us-east-1）は旧バケットで本番未使用。
> 2026-07-28 適用済み: オリジン = glacier-photo-vault-frontend.vercel.app / localhost:5173

## 設定コマンド

```powershell
$cors = @'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://<YOUR-FRONTEND-DOMAIN>", "http://localhost:5173"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
'@
$cors | Out-File -Encoding utf8 cors.json
aws s3api put-bucket-cors --bucket glacier-photo-vault --cors-configuration file://cors.json
```

- `<YOUR-FRONTEND-DOMAIN>` はVercelのドメインに置き換える
- iOSネイティブアプリのURLSessionはCORSの制約を受けないため、この設定はWebフロントエンド用
- 適用確認: `aws s3api get-bucket-cors --bucket glacier-photo-vault`
