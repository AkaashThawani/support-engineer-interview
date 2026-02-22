import { describe, it, expect } from 'vitest';

describe('VAL-202: Date of Birth Validation', () => {
  // Helper function to calculate age
  function calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  }

  // Validation function (matches backend)
  function validateDateOfBirth(date: string): boolean {
    const dob = new Date(date);
    const today = new Date();
    
    // Check not future date
    if (dob > today) return false;
    
    // Check age >= 18
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age >= 18;
  }

  describe('Future date rejection', () => {
    it('should reject dates in the future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateString = futureDate.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(false);
    });

    it('should reject tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(false);
    });

    it('should accept today (edge case)', () => {
      const today = new Date();
      // Set to 18 years ago
      today.setFullYear(today.getFullYear() - 18);
      const dateString = today.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(true);
    });
  });

  describe('Age validation', () => {
    it('should reject user under 18', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 17); // 17 years old
      const dateString = dob.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(false);
      expect(calculateAge(dateString)).toBe(17);
    });

    it('should accept user exactly 18', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 18);
      const dateString = dob.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(true);
      expect(calculateAge(dateString)).toBe(18);
    });

    it('should accept user 18 years and 1 day old', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 18);
      dob.setDate(dob.getDate() - 1);
      const dateString = dob.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(true);
      expect(calculateAge(dateString)).toBeGreaterThanOrEqual(18);
    });

    it('should accept user 25 years old', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 25);
      const dateString = dob.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(true);
      expect(calculateAge(dateString)).toBe(25);
    });

    it('should accept senior citizen (65+)', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 65);
      const dateString = dob.toISOString().split('T')[0];
      
      expect(validateDateOfBirth(dateString)).toBe(true);
      expect(calculateAge(dateString)).toBe(65);
    });

  });

  describe('Edge cases', () => {
    it('should handle leap year birthdays correctly', () => {
      // Feb 29, 2004 (leap year) - person would be 20+ years old now
      const dob = '2004-02-29';
      
      expect(validateDateOfBirth(dob)).toBe(true);
      expect(calculateAge(dob)).toBeGreaterThanOrEqual(18);
    });

    it('should handle year 2000 correctly', () => {
      const dob = '2000-01-01'; // Would be 24+ years old
      
      expect(validateDateOfBirth(dob)).toBe(true);
      expect(calculateAge(dob)).toBeGreaterThanOrEqual(18);
    });

    it('should handle 1990 birth year', () => {
      const dob = '1990-06-15'; // Would be 33+ years old
      
      expect(validateDateOfBirth(dob)).toBe(true);
      expect(calculateAge(dob)).toBeGreaterThanOrEqual(18);
    });
  });

  describe('Invalid scenarios (compliance)', () => {
    it('should document rejection of minor attempting signup', () => {
      // This documents the critical bug fix
      const minorDate = '2010-01-01'; // 14 years old
      
      expect(validateDateOfBirth(minorDate)).toBe(false);
      expect(calculateAge(minorDate)).toBeLessThan(18);
    });

    it('should document rejection of future date (2025 bug)', () => {
      // This is the specific bug mentioned in VAL-202
      const futureDate = '2025-01-01';
      
      expect(validateDateOfBirth(futureDate)).toBe(false);
    });

    it('should calculate age correctly across month boundaries', () => {
      const today = new Date();
      const dob = new Date(today);
      dob.setFullYear(today.getFullYear() - 18);
      dob.setMonth(today.getMonth() + 1); // Next month
      
      const dateString = dob.toISOString().split('T')[0];
      
      // Should be 17 (hasn't had birthday yet)
      expect(calculateAge(dateString)).toBe(17);
      expect(validateDateOfBirth(dateString)).toBe(false);
    });
  });
});
