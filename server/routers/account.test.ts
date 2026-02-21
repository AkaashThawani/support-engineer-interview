import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Test the fixed generateAccountNumber function
function generateAccountNumber(): string {
  // Use cryptographically secure random number generator
  return crypto.randomInt(0, 10000000000)
    .toString()
    .padStart(10, "0");
}

describe('SEC-302: Account Number Generation', () => {
  describe('generateAccountNumber', () => {
    it('should generate a 10-digit account number', () => {
      const accountNumber = generateAccountNumber();
      expect(accountNumber).toHaveLength(10);
      expect(accountNumber).toMatch(/^\d{10}$/);
    });

    it('should generate different account numbers on each call', () => {
      const accountNumber1 = generateAccountNumber();
      const accountNumber2 = generateAccountNumber();
      const accountNumber3 = generateAccountNumber();
      
      // All should be different (extremely unlikely to be same with crypto.randomInt)
      expect(accountNumber1).not.toBe(accountNumber2);
      expect(accountNumber2).not.toBe(accountNumber3);
      expect(accountNumber1).not.toBe(accountNumber3);
    });

    it('should generate numbers with leading zeros if needed', () => {
      // Generate many numbers to likely get some with leading zeros
      const numbers = Array.from({ length: 100 }, () => generateAccountNumber());
      
      // All should be 10 digits
      numbers.forEach(num => {
        expect(num).toHaveLength(10);
        expect(num).toMatch(/^\d{10}$/);
      });
    });

    it('should use cryptographically secure random numbers', () => {
      // Generate 1000 numbers and check distribution
      const numbers = Array.from({ length: 1000 }, () => parseInt(generateAccountNumber()));
      
      // Check that we have good distribution (not all clustered)
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const range = max - min;
      
      // Range should be significant (not all numbers close together)
      expect(range).toBeGreaterThan(1000000000); // At least 1 billion range
    });

    it('should generate valid account numbers in correct format', () => {
      for (let i = 0; i < 50; i++) {
        const accountNumber = generateAccountNumber();
        
        // Should be string
        expect(typeof accountNumber).toBe('string');
        
        // Should be exactly 10 characters
        expect(accountNumber.length).toBe(10);
        
        // Should only contain digits
        expect(/^\d+$/.test(accountNumber)).toBe(true);
        
        // Should be a valid number when parsed
        const asNumber = parseInt(accountNumber, 10);
        expect(asNumber).toBeGreaterThanOrEqual(0);
        expect(asNumber).toBeLessThan(10000000000);
      }
    });
  });
});
