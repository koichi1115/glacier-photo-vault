# Glacier Photo Vault - S3バケット完全セットアップスクリプト

$bucketName = "glacier-photo-vault"
$region = "us-east-1"
$logBucketName = "glacier-photo-vault-logs"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Glacier Photo Vault - S3 Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ステップ1: 既存のバケットを確認
Write-Host "Step 1: Checking existing buckets..." -ForegroundColor Yellow
aws s3 ls | Select-String -Pattern $bucketName

# ステップ2: メインバケットを作成
Write-Host ""
Write-Host "Step 2: Creating main bucket: $bucketName" -ForegroundColor Yellow

# us-east-1の場合はLocationConstraintを指定しない
aws s3 mb s3://$bucketName --region $region

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bucket created successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Bucket may already exist or creation failed" -ForegroundColor Yellow
}

# ステップ3: パブリックアクセスブロック設定
Write-Host ""
Write-Host "Step 3: Blocking public access..." -ForegroundColor Yellow
aws s3api put-public-access-block `
  --bucket $bucketName `
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Public access blocked!" -ForegroundColor Green
}

# ステップ4: バケット暗号化設定
Write-Host ""
Write-Host "Step 4: Enabling SSE-S3 encryption..." -ForegroundColor Yellow

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

aws s3api put-bucket-encryption --bucket $bucketName --server-side-encryption-configuration $encryptionConfig

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Encryption enabled (SSE-S3 with Bucket Key)!" -ForegroundColor Green
}

# ステップ5: バケットバージョニング設定
Write-Host ""
Write-Host "Step 5: Enabling versioning..." -ForegroundColor Yellow
aws s3api put-bucket-versioning --bucket $bucketName --versioning-configuration Status=Enabled

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Versioning enabled!" -ForegroundColor Green
}

# ステップ6: ログ保存用バケットを作成
Write-Host ""
Write-Host "Step 6: Creating log bucket: $logBucketName" -ForegroundColor Yellow
aws s3 mb s3://$logBucketName --region $region

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Log bucket created!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Log bucket may already exist" -ForegroundColor Yellow
}

# ログバケットのパブリックアクセスブロック
aws s3api put-public-access-block `
  --bucket $logBucketName `
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# ステップ7: アクセスログ設定
Write-Host ""
Write-Host "Step 7: Enabling access logging..." -ForegroundColor Yellow

$loggingConfig = @"
{
  "LoggingEnabled": {
    "TargetBucket": "$logBucketName",
    "TargetPrefix": "access-logs/"
  }
}
"@

aws s3api put-bucket-logging --bucket $bucketName --bucket-logging-status $loggingConfig

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Access logging enabled!" -ForegroundColor Green
}

# ステップ8: 設定確認
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Encryption Configuration:" -ForegroundColor Yellow
aws s3api get-bucket-encryption --bucket $bucketName

Write-Host ""
Write-Host "Versioning Configuration:" -ForegroundColor Yellow
aws s3api get-bucket-versioning --bucket $bucketName

Write-Host ""
Write-Host "Public Access Block:" -ForegroundColor Yellow
aws s3api get-public-access-block --bucket $bucketName

Write-Host ""
Write-Host "Logging Configuration:" -ForegroundColor Yellow
aws s3api get-bucket-logging --bucket $bucketName

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your .env file with AWS credentials"
Write-Host "2. Run: npm install (in backend directory)"
Write-Host "3. Run: node scripts/generate-keys.js (to generate JWT keys)"
Write-Host "4. Configure Google OAuth and LINE OAuth credentials"
Write-Host ""
