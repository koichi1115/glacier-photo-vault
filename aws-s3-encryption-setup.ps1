# S3バケット暗号化設定スクリプト（PowerShell用）

# バケット名
$bucketName = "glacier-photo-vault"

# 暗号化設定JSON
$encryptionConfig = @"
{
  "Rules": [{
    "ApplyServerSideEncryptionByDefault": {
      "SSEAlgorithm": "AES256"
    },
    "BucketKeyEnabled": true
  }]
}
"@

Write-Host "Setting up S3 bucket encryption for: $bucketName"
Write-Host "Encryption: SSE-S3 (AES256)"
Write-Host ""

# 暗号化を設定
aws s3api put-bucket-encryption --bucket $bucketName --server-side-encryption-configuration $encryptionConfig

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Encryption enabled successfully!" -ForegroundColor Green
    
    # 設定を確認
    Write-Host ""
    Write-Host "Verifying encryption configuration..."
    aws s3api get-bucket-encryption --bucket $bucketName
} else {
    Write-Host "❌ Failed to enable encryption" -ForegroundColor Red
}
