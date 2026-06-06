import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Encryption key must be 32 bytes (256 bits).
const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || '12345678901234567890123456789012',
  'utf8'
);

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function generateSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

/**
 * Standard TOTP Generator (15-second rotation by default)
 */
export function getTOTP(secret: string, step = 15): string {
  // Ensure secret is a hex string, or fall back to hashing it into bytes
  let key: Buffer;
  try {
    key = Buffer.from(secret, 'hex');
    if (key.length === 0) key = Buffer.from(secret, 'utf8');
  } catch {
    key = Buffer.from(secret, 'utf8');
  }
  
  const counter = Math.floor(Date.now() / 1000 / step);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter), 0);
  
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hmacResult = hmac.digest();
  
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);
  
  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Verify TOTP Token with +/- 1 window drift tolerance
 */
export function checkTOTP(token: string, secret: string, step = 15): boolean {
  let key: Buffer;
  try {
    key = Buffer.from(secret, 'hex');
    if (key.length === 0) key = Buffer.from(secret, 'utf8');
  } catch {
    key = Buffer.from(secret, 'utf8');
  }

  for (let i = -1; i <= 1; i++) {
    const counter = Math.floor(Date.now() / 1000 / step) + i;
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter), 0);
    
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();
    
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);
    
    const expected = (code % 1000000).toString().padStart(6, '0');
    if (expected === token) {
      return true;
    }
  }
  return false;
}
