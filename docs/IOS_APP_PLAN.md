# iOSアプリ化 実装プラン（確定版）

作成日: 2026-07-24
ステータス: 承認済み方針に基づく確定版（実装状況は末尾参照）

## 決定事項

| 論点 | 決定 |
|---|---|
| ストレージ | AWS S3 Glacier Deep Archive 継続（$1/TB/月、代替調査の結果、優位な乗り換え先なし） |
| ユーザー分離 | AWSアカウント分離は行わない。STSスコープ付き一時クレデンシャルでIAMレベルのプレフィックス分離を強制 |
| 課金 | 従量制（¥10/GB）を廃止し**ティア制**に再設計。iOS=IAP（StoreKit 2）、Web=Stripe の併用 |
| 自動バックアップ | **iOS 26.1の PhotoKit Background Resource Upload extension を主軸**。26.1未満はフォアグラウンド同期のみの簡易フォールバック |

---

## 1. 料金ティア設計

### 原価（1TBあたり月額、¥150/$換算）

| 項目 | 原価 |
|---|---|
| 保管（Deep Archive） | 約¥150/TB/月 |
| 復元 Bulk（48h） | 約¥375/TB/回 |
| 復元 Standard（12h） | 約¥3,000/TB/回 |
| **データ転送（ダウンロード egress）** | **約¥13,500/TB** ← 最大のコストリスク |

### ティア（案）

| ティア | 容量 | 月額 | 参考: iCloud | 保管原価 | 粗利率 |
|---|---|---|---|---|---|
| Mini | 200GB | ¥150 | ¥450 | ¥30 | 80% |
| Standard | 1TB | ¥400 | — | ¥150 | 62% |
| Plus | 2TB | ¥700 | ¥1,500 | ¥300 | 57% |
| Max | 5TB | ¥1,500 | ¥3,000(6TB) | ¥750 | 50% |

- 30日無料トライアル継続（IAPのIntroductory Offer / Stripeのtrialで実現）
- 年額プラン（月額×10ヶ月分）も用意するとLTV向上

### 復元・ダウンロードの扱い（egress対策）

egress ¥13,500/TB のため「ダウンロード無料」は維持不可能（2TBフル復元1回でPlusティア19ヶ月分の収益が消える）。

- **無料枠**: 月間 契約容量の5%まで Bulk復元＋ダウンロード無料（例: 2TBプランなら100GB/月）
- **超過分**: 従量課金
  - Web: Stripeで ¥20/GB（Bulk、原価≒¥14/GB）
  - iOS: 消耗型IAP「復元パック」（100GB=¥320 等）※IAP手数料を織り込み
- Standard復元（12h）は常に有料オプション
- 将来: CloudFront経由や転送量割引で原価低減を検討

### 実装

- `subscriptions` テーブルに `platform`('stripe'|'apple')、`tier`、`storage_limit_bytes` カラム追加
- Stripe: 従量invoice item方式を廃止し、ティアごとの固定Price作成
- Apple: App Store Server Notifications V2 受信エンドポイント `POST /api/webhook/apple` 新設、JWS検証、`subscriptions` 同期
- `requireSubscription` を「Stripe or Apple どちらかで有効」に拡張＋容量超過チェック（アップロードinit時に使用量と `storage_limit_bytes` を比較）

---

## 2. アーキテクチャ変更（バックエンド）

### 2-1. アップロード経路: プリサインドマルチパート直接アップロード

現行のバックエンドプロキシ（100MB上限）を廃止し:

```
POST /api/uploads/init      … ファイルメタ+サイズ → uploadId + パート毎プリサインドURL
PUT  (S3へ直接)             … background URLSession uploadTask(fromFile:)
POST /api/uploads/complete  … ETag一覧 → CompleteMultipartUpload + DB記録
POST /api/uploads/abort     … 中断時のクリーンアップ
```

- ストレージクラス DEEP_ARCHIVE / SSE はプリサインド生成時に指定
- 5MB以上はマルチパート、動画等の大容量に対応（上限撤廃、ティア残容量でガード）
- Web側も順次この経路に移行（Render帯域の節約）

### 2-2. ユーザー分離の強化

- バックエンドに `POST /api/credentials` 追加: `AssumeRole` + セッションポリシーで
  `arn:aws:s3:::bucket/${userId}/*` のみ許可の一時クレデンシャル（15分）を発行
- プリサインドURL生成もこのスコープ付きクレデンシャルで行い、署名ミスでも他ユーザーに届かない構造に
- SSE-KMS化とCloudTrailデータイベント有効化（監査）

### 2-3. 認証

- **Sign in with Apple 追加**（審査ガイドライン4.8対応、必須）
- OAuth callbackのトークンURLクエリ渡しを廃止 → 認可コード+PKCE。iOSは `ASWebAuthenticationSession` でGoogle/LINE、ネイティブでApple
- `POST /api/auth/apple` … identityToken検証 → JWT発行

### 2-4. 既知バグ・未稼働機能の修正（Phase 0）

- [ ] `getUserStats` のstatus大文字小文字不一致（'ARCHIVED' vs 'archived'）修正
- [ ] `scheduleCleanupJob` / 月次課金バッチの稼働（ティア制移行後は課金バッチ不要になるが、クリーンアップは必要）
- [ ] JWT/SESSIONシークレットのdevフォールバック削除（未設定なら起動失敗に）
- [ ] migration 004 の適用整理（ティア制で不要になるテーブルの棚卸し）
- [ ] ブレインストーミング残骸削除（SessionManager, AIAgentService, socket/, 未使用フロントコンポーネント, shared/types.tsの旧型）

### 2-5. プッシュ通知（復元完了）

- S3イベント（RestoreCompleted）→ EventBridge/Lambda → バックエンド → APNs
- `device_tokens` テーブル追加、`POST /api/devices` でトークン登録

---

## 3. iOSアプリ設計

### 3-1. 方針

- **新規SwiftUIプロジェクトとして再構築**（既存 `ios/` は認証なし・localhost直結のプロトタイプ。`DesignSystem.swift` のみ流用）
- **最低ターゲット: iOS 17**、自動バックアップ機能は **iOS 26.1+ 限定**（`#available` ゲート）
  - iOS 26.1未満: 手動バックアップ＋アプリ起動時の差分同期のみ（BGProcessingTaskの複雑なフォールバックは作らない — 主軸決定に伴う割り切り）
- ATS準拠（`NSAllowsArbitraryLoads` 削除）、プライバシーマニフェスト対応

### 3-2. モジュール構成

```
GlacierVault/
├── App/                    … エントリ、DI、ルーティング
├── Auth/                   … Apple/Google/LINE サインイン、Keychainトークン管理
├── Sync/
│   ├── LedgerStore         … SwiftData: PHAsset localIdentifier → 状態/ハッシュ/S3キー
│   ├── DiffEngine          … PHPhotoLibrary全列挙と台帳の差分検出
│   ├── UploadCoordinator   … init→S3直PUT→complete のオーケストレーション
│   └── BackgroundUploadExt … PHBackgroundResourceUploadExtension ターゲット（26.1+）
├── FilesBackup/            … フォルダピッカー + security-scoped bookmark + ツリー走査
├── Restore/                … 復元リクエスト/状態/ダウンロード
├── Billing/                … StoreKit 2、ティア表示、復元パック（消耗型）
└── UI/                     … 写真グリッド、設定（WiFiのみ/対象選択）、使用量
```

### 3-3. バックグラウンドバックアップ（主軸: iOS 26.1）

- Extension target: `com.apple.photos.background-upload`
- システムがジョブを供給 → extension内で init API 呼び出し → プリサインドURLへアップロード → complete → acknowledge
- **検証必須のリスク（Phase 2冒頭でスパイク実施）**: iCloud写真が有効な端末でextensionがスケジュールされない報告あり（Apple Forums thread 822256）。実機で確認し、動かない場合はアプリ内で「iCloud写真との併用時はアプリを開いた時に同期」の案内UXに切替
- WiFi限定: extensionはシステム管理。手動/フォアグラウンド経路は `allowsCellularAccess = false`（設定でユーザー変更可）

### 3-4. 「ファイル」バックアップ

- iOSサンドボックス制約により「全ファイル自動」は不可能（OSの仕様上の上限）
- UX: 「バックアップ対象フォルダを追加」→ `UIDocumentPickerViewController`（フォルダモード）→ security-scoped bookmark 永続化 → アプリ起動時/手動で差分アップロード

### 3-5. 復元UX

- Bulk(48h)を標準、Standard(12h)を有料オプションとして提示
- 無料枠の残量表示（今月あとXX GB復元可能）
- 復元完了時プッシュ通知 → アプリ内から期限（7日）内にダウンロード

---

## 4. ロードマップ

| Phase | 内容 | 期間目安 |
|---|---|---|
| 0 | バックエンド修正（バグ・cron・シークレット・残骸削除）＋ Sign in with Apple ＋ PKCE化 | 1–2週 |
| 1 | プリサインドマルチパートAPI ＋ STS分離 ＋ ティア制移行（Stripe再設計・DBスキーマ） | 2–3週 |
| 2 | iOSアプリ本体（認証/同期エンジン/手動アップロード/復元/IAP）※冒頭で26.1 extensionスパイク | 4–6週 |
| 3 | 26.1バックグラウンドextension本実装 ＋ ファイルフォルダバックアップ ＋ プッシュ通知 | 2–4週 |
| 4 | リリース準備（プライバシーマニフェスト、App Privacy、TestFlight、審査対応） | 2週 |

審査上の注意: 写真フルアクセス＋バックグラウンド動作＋ストレージ課金は審査で説明を求められやすい。App Review向けメモ（用途説明・デモアカウント）を用意する。

## 実装状況（2026-07-24 自律作業分）

### 完了（feature/ios-plan-phase0 ブランチ）
- **Phase 0 全項目**: 統計バグ修正 / cleanupJob稼働 / 本番シークレット必須化 /
  ブレインストーミング残骸削除 / 認可コード+PKCE化（トークンURL渡し廃止）
- **Phase 1 全項目**: プリサインドマルチパートAPI（/api/uploads/init|complete|abort、
  100MB上限撤廃、容量クォータ強制）/ ティア制（config/tiers.ts、DBカラム、Stripe固定Price、
  プラン選択UI、GET /api/billing/tiers）/ 復元無料枠（月間5%・Bulk）+ Stripe超過課金 + restore_logs
- **Sign in with Apple**: バックエンドJWKS検証（POST /api/auth/apple、要 APPLE_BUNDLE_ID）+ iOSボタン
- **iOS（Phase 2の一部）**: PKCE認証（ASWebAuthenticationSession+Keychain）/
  認証付きAPIClient（自動リフレッシュ）/ プリサインドアップロード / ログイン画面 /
  BackupManager（台帳+差分スキャン+WiFi限定+オリジナル品質アップロード）/
  BackupView / FilesBackupManager+View（フォルダ選択バックアップ）/
  ATS修正・URLスキーム追加 / pbxproj整備（DesignSystem.swift未登録バグも修正）
- バックエンド・フロントエンドのビルド検証済み（Swiftはmac環境がないため未コンパイル）

### 未実装・ユーザー対応が必要
- **Apple Developer設定**: バンドルID確定、Sign in with Apple entitlement、
  IAP商品登録（com.glacierphotovault.tier.*）、APNs鍵
- **StoreKit 2クライアント + App Store Server Notifications**（Apple課金）
- **iOS 26.1 PHBackgroundResourceUploadExtension** のextensionターゲット追加とスパイク
  （Xcode/実機必要。iCloud写真ON端末で動かない報告の検証が最優先）
- **S3バケットCORS適用**（docs/S3_CORS_SETUP.md）
- **Render環境変数**: JWT_SECRET/SESSION_SECRET必須化に伴う設定確認、APPLE_BUNDLE_ID追加
- **既存Stripeサブスクの移行**: 既存ユーザーの従量制サブスクをティアPriceへ移行するバッチ
- 復元超過分のiOS側支払い（消耗型IAP「復元パック」）— 現状iOSは無料枠内のみ復元可
- プッシュ通知（復元完了）、STSスコープ付きクレデンシャル分離

## 5. 保留・将来検討

- 小ファイルのtarバンドル化（40KB最小オブジェクト対策・復元リクエスト費削減）
- 年額プラン、ファミリープラン
- 復元egress原価の低減（CloudFront、AWS転送割引）
- Android版（同じAPI基盤で展開可能）
