/**
 * Crypto Utilities — AES-256-GCM encryption for API keys stored in AppConfig
 * Uses Node.js built-in crypto module (no external dependencies)
 *
 * In production: Set APP_ENCRYPTION_KEY env var (32-byte hex string)
 * In development: Falls back to a deterministic dev key (NOT secure — dev only)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';

/**
 * Get encryption key from environment or use dev fallback
 * @returns {Buffer} 32-byte key
 */
function _getKey() {
  const envKey = process.env.APP_ENCRYPTION_KEY;
  if (envKey) {
    // Expect 64-char hex string (32 bytes)
    if (envKey.length === 64) return Buffer.from(envKey, 'hex');
    // Or use as passphrase → derive key
    return crypto.scryptSync(envKey, 'sap-pm-salt', 32);
  }
  // Dev fallback — deterministic but not secure
  return crypto.scryptSync('sap-project-mgmt-dev-key', 'sap-pm-salt', 32);
}

/**
 * Encrypt a plaintext string (e.g., API key)
 * @param {string} plaintext - The value to encrypt
 * @returns {string} Encrypted string with "enc:" prefix (base64 encoded)
 */
function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext; // Already encrypted

  const key = _getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Format: enc:<iv>:<authTag>:<ciphertext>  (all base64)
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} ciphertext - The encrypted value (with "enc:" prefix)
 * @returns {string} Decrypted plaintext
 */
function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext; // Not encrypted, return as-is

  const parts = ciphertext.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');

  const [ivB64, authTagB64, encryptedB64] = parts;
  const key = _getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedB64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Mask a key for display (show first 8 and last 4 chars)
 * @param {string} key - The raw or encrypted key
 * @returns {string} Masked version like "sk-or-v1-...95ad"
 */
function maskKey(key) {
  if (!key) return '';
  // Decrypt first if encrypted
  const plain = key.startsWith(ENCRYPTED_PREFIX) ? decrypt(key) : key;
  if (plain.length <= 12) return '****';
  return `${plain.substring(0, 8)}...${plain.substring(plain.length - 4)}`;
}

module.exports = { encrypt, decrypt, maskKey, ENCRYPTED_PREFIX };
