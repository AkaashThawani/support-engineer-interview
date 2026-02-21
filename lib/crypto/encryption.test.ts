import { describe, it, expect } from 'vitest';
import { encryptSSN, decryptSSN, maskSSN, validateEncryptedSSN } from './encryption';

describe('SSN Encryption', () => {
  const validSSN = '123456789';
  const anotherValidSSN = '987654321';

  describe('encryptSSN', () => {
    it('should encrypt a valid SSN', () => {
      const encrypted = encryptSSN(validSSN);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(validSSN);
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should produce different encrypted values each time (random IV)', () => {
      const encrypted1 = encryptSSN(validSSN);
      const encrypted2 = encryptSSN(validSSN);
      
      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to the same value
      expect(decryptSSN(encrypted1)).toBe(validSSN);
      expect(decryptSSN(encrypted2)).toBe(validSSN);
    });

    it('should return encrypted string in correct format (iv:encrypted:authTag)', () => {
      const encrypted = encryptSSN(validSSN);
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/); // IV in hex
      expect(parts[1]).toMatch(/^[0-9a-f]+$/); // Encrypted data in hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/); // Auth tag in hex
    });

    it('should throw error for invalid SSN format - too short', () => {
      expect(() => encryptSSN('12345678')).toThrow('Invalid SSN format');
    });

    it('should throw error for invalid SSN format - too long', () => {
      expect(() => encryptSSN('1234567890')).toThrow('Invalid SSN format');
    });

    it('should throw error for invalid SSN format - contains letters', () => {
      expect(() => encryptSSN('12345678a')).toThrow('Invalid SSN format');
    });

    it('should throw error for invalid SSN format - contains spaces', () => {
      expect(() => encryptSSN('123 45 6789')).toThrow('Invalid SSN format');
    });

    it('should throw error for invalid SSN format - contains dashes', () => {
      expect(() => encryptSSN('123-45-6789')).toThrow('Invalid SSN format');
    });
  });

  describe('decryptSSN', () => {
    it('should decrypt an encrypted SSN back to original', () => {
      const encrypted = encryptSSN(validSSN);
      const decrypted = decryptSSN(encrypted);
      
      expect(decrypted).toBe(validSSN);
    });

    it('should decrypt different SSNs correctly', () => {
      const encrypted1 = encryptSSN(validSSN);
      const encrypted2 = encryptSSN(anotherValidSSN);
      
      expect(decryptSSN(encrypted1)).toBe(validSSN);
      expect(decryptSSN(encrypted2)).toBe(anotherValidSSN);
    });

    it('should throw error for invalid encrypted format - missing parts', () => {
      expect(() => decryptSSN('invalidformat')).toThrow('Invalid encrypted SSN format');
    });

    it('should throw error for invalid encrypted format - only two parts', () => {
      expect(() => decryptSSN('part1:part2')).toThrow('Invalid encrypted SSN format');
    });

    it('should throw error for invalid encrypted format - corrupted data', () => {
      expect(() => decryptSSN('abc:def:ghi')).toThrow('Failed to decrypt SSN');
    });

    it('should throw error when auth tag is tampered', () => {
      const encrypted = encryptSSN(validSSN);
      const parts = encrypted.split(':');
      const tamperedAuthTag = 'ff'.repeat(16); // Wrong auth tag
      const tampered = `${parts[0]}:${parts[1]}:${tamperedAuthTag}`;
      
      expect(() => decryptSSN(tampered)).toThrow('Failed to decrypt SSN');
    });

    it('should throw error when encrypted data is tampered', () => {
      const encrypted = encryptSSN(validSSN);
      const parts = encrypted.split(':');
      const tamperedData = parts[1] + 'ff'; // Add extra bytes
      const tampered = `${parts[0]}:${tamperedData}:${parts[2]}`;
      
      expect(() => decryptSSN(tampered)).toThrow('Failed to decrypt SSN');
    });
  });

  describe('maskSSN', () => {
    it('should return masked SSN showing only last 4 digits', () => {
      const encrypted = encryptSSN(validSSN);
      const masked = maskSSN(encrypted);
      
      expect(masked).toBe('***-**-6789');
    });

    it('should mask different SSNs correctly', () => {
      const encrypted1 = encryptSSN('111111111');
      const encrypted2 = encryptSSN('999999999');
      
      expect(maskSSN(encrypted1)).toBe('***-**-1111');
      expect(maskSSN(encrypted2)).toBe('***-**-9999');
    });

    it('should return generic mask for invalid encrypted SSN', () => {
      const masked = maskSSN('invalid:encrypted:ssn');
      
      expect(masked).toBe('***-**-****');
    });

    it('should handle decryption errors gracefully', () => {
      expect(() => maskSSN('corrupted')).not.toThrow();
      expect(maskSSN('corrupted')).toBe('***-**-****');
    });
  });

  describe('validateEncryptedSSN', () => {
    it('should return true for valid encrypted SSN', () => {
      const encrypted = encryptSSN(validSSN);
      
      expect(validateEncryptedSSN(encrypted)).toBe(true);
    });

    it('should return false for invalid encrypted format', () => {
      expect(validateEncryptedSSN('invalid')).toBe(false);
    });

    it('should return false for corrupted encrypted data', () => {
      expect(validateEncryptedSSN('abc:def:ghi')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validateEncryptedSSN('')).toBe(false);
    });

    it('should return false for tampered data', () => {
      const encrypted = encryptSSN(validSSN);
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}ff:${parts[2]}`;
      
      expect(validateEncryptedSSN(tampered)).toBe(false);
    });
  });

  describe('End-to-end encryption workflow', () => {
    it('should handle complete encrypt -> decrypt -> mask workflow', () => {
      // 1. Encrypt
      const encrypted = encryptSSN(validSSN);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(validSSN);
      
      // 2. Validate
      expect(validateEncryptedSSN(encrypted)).toBe(true);
      
      // 3. Decrypt
      const decrypted = decryptSSN(encrypted);
      expect(decrypted).toBe(validSSN);
      
      // 4. Mask
      const masked = maskSSN(encrypted);
      expect(masked).toBe('***-**-6789');
    });

    it('should maintain data integrity across multiple operations', () => {
      const testSSNs = [
        '000000000',
        '111111111',
        '999999999',
        '123456789',
        '987654321',
      ];

      testSSNs.forEach(ssn => {
        const encrypted = encryptSSN(ssn);
        expect(decryptSSN(encrypted)).toBe(ssn);
        expect(validateEncryptedSSN(encrypted)).toBe(true);
        expect(maskSSN(encrypted)).toBe(`***-**-${ssn.slice(-4)}`);
      });
    });
  });

  describe('Security properties', () => {
    it('should not leak original SSN in encrypted format', () => {
      const encrypted = encryptSSN(validSSN);
      
      expect(encrypted.toLowerCase()).not.toContain(validSSN);
    });

    it('should produce ciphertext that does not reveal SSN length patterns', () => {
      // All SSNs are 9 digits, so all encrypted lengths should be similar
      const encrypted1 = encryptSSN('111111111');
      const encrypted2 = encryptSSN('999999999');
      
      expect(Math.abs(encrypted1.length - encrypted2.length)).toBeLessThan(5);
    });

    it('should use authenticated encryption (GCM mode)', () => {
      // GCM provides both confidentiality and authenticity
      const encrypted = encryptSSN(validSSN);
      const parts = encrypted.split(':');
      
      // Auth tag should be present (16 bytes = 32 hex chars)
      expect(parts[2].length).toBe(32);
    });
  });
});
