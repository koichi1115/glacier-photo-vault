/**
 * RSA鍵ペア生成スクリプト
 * JWT署名用のRS256鍵を生成します
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 鍵ペアを生成
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// keys ディレクトリを作成
const keysDir = path.join(__dirname, '..', 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

// 鍵をファイルに保存
fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

console.log('✅ RSA鍵ペアを生成しました:');
console.log('  - keys/private.pem (秘密鍵 - 厳重に管理してください)');
console.log('  - keys/public.pem (公開鍵)');
console.log('');
console.log('⚠️  keys/ ディレクトリを .gitignore に追加してください');
