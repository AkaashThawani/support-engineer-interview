import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const KEY_LENGTH = 32; // 256 bits

const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // For development only - in production this should throw an error
    console.warn('WARNING: ENCRYPTION_KEY not set, using insecure default key for development');
    return crypto.scryptSync('dev-fallback-key-not-secure', 'salt', KEY_LENGTH);
  }
  
  // Convert hex string to buffer
  if (key.length === KEY_LENGTH * 2) {
    return Buffer.from(key, 'hex');
  }
  
  // Derive key from password using scrypt
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
};

/**
 * Encrypts an SSN using AES-256-GCM
 * @param ssn - The SSN to encrypt (9 digits)
 * @returns Encrypted string in format: iv:encrypted:authTag (hex encoded)
 */
export function encryptSSN(ssn: string): string {
  // Validate SSN format
  if (!/^\d{9}$/.test(ssn)) {
    throw new Error('Invalid SSN format. Must be 9 digits.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(ssn, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();

  // Return format: iv:encrypted:authTag (all hex encoded)
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypts an encrypted SSN
 * @param encryptedSSN - Encrypted SSN in format: iv:encrypted:authTag
 * @returns Decrypted SSN (9 digits)
 */
export function decryptSSN(encryptedSSN: string): string {
  try {
    const parts = encryptedSSN.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted SSN format');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Failed to decrypt SSN: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Returns a masked version of the SSN showing only the last 4 digits
 * @param encryptedSSN - Encrypted SSN
 * @returns Masked SSN in format: ***-**-1234
 */
export function maskSSN(encryptedSSN: string): string {
  try {
    const decrypted = decryptSSN(encryptedSSN);
    const lastFour = decrypted.slice(-4);
    return `***-**-${lastFour}`;
  } catch {
    // If decryption fails, return generic mask
    return '***-**-****';
  }
}

/**
 * Validates that an encrypted SSN can be successfully decrypted
 * @param encryptedSSN - Encrypted SSN to validate
 * @returns true if valid and can be decrypted, false otherwise
 */
export function validateEncryptedSSN(encryptedSSN: string): boolean {
  try {
    const decrypted = decryptSSN(encryptedSSN);
    return /^\d{9}$/.test(decrypted);
  } catch {
    return false;
  }
}
