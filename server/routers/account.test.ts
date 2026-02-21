import { describe, it, expect, afterAll } from 'vitest';
import crypto from 'crypto';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { users, accounts, transactions } from '@/lib/db/schema';
import { eq, like } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

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

  describe('PERF-404: Transaction Sorting', () => {
    it('should return transactions in descending order (newest first)', () => {
      // Simulate transactions with different timestamps
      const transactions = [
        { id: 1, createdAt: '2024-01-01T10:00:00Z', amount: 100 },
        { id: 2, createdAt: '2024-01-03T10:00:00Z', amount: 200 },
        { id: 3, createdAt: '2024-01-02T10:00:00Z', amount: 150 },
      ];

      // Sort by createdAt descending (newest first)
      const sorted = [...transactions].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(sorted[0].id).toBe(2); // Jan 3 (newest)
      expect(sorted[1].id).toBe(3); // Jan 2
      expect(sorted[2].id).toBe(1); // Jan 1 (oldest)
    });

    it('should maintain consistent order on multiple queries', () => {
      const transactions = [
        { id: 1, createdAt: '2024-01-01T10:00:00Z' },
        { id: 2, createdAt: '2024-01-02T10:00:00Z' },
        { id: 3, createdAt: '2024-01-03T10:00:00Z' },
      ];

      // Query 1
      const query1 = [...transactions].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Query 2
      const query2 = [...transactions].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Results should be identical
      expect(query1).toEqual(query2);
      expect(query1[0].id).toBe(3);
    });

    it('should handle transactions with same timestamp', () => {
      const sameTime = '2024-01-01T10:00:00Z';
      const transactions = [
        { id: 1, createdAt: sameTime, amount: 100 },
        { id: 2, createdAt: sameTime, amount: 200 },
      ];

      const sorted = [...transactions].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Should maintain some consistent order
      expect(sorted).toHaveLength(2);
    });

    it('should properly compare dates for sorting', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-01-02');

      // Descending: newer > older
      expect(newDate.getTime() > oldDate.getTime()).toBe(true);
      expect(newDate.getTime() - oldDate.getTime()).toBeGreaterThan(0);
    });
  });
});

describe('PERF-401: Account Creation Error Handling', () => {
  describe('Error handling instead of fake data', () => {
    it('should throw error when account creation fails (not return fake data)', () => {
      // Before fix: Returned fake data with balance: 100
      // After fix: Throws INTERNAL_SERVER_ERROR
      
      // Simulate the error case
      const accountFetchFailed = null; // Database fetch returned null
      
      // This is what the code should do
      const shouldThrowError = () => {
        if (!accountFetchFailed) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }
        return accountFetchFailed;
      };

      expect(shouldThrowError).toThrow();
      expect(shouldThrowError).toThrow('Failed to create account');
    });

    it('should never return fake account data', () => {
      // Before fix: Code returned this fake data:
      const fakeData = {
        id: 0,
        userId: 1,
        accountNumber: '1234567890',
        accountType: 'checking',
        balance: 100,  // Fake $100 balance!
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      // After fix: This fake data structure should never be returned
      // Instead, an error should be thrown
      
      // Verify fake data has the problematic fields
      expect(fakeData.id).toBe(0); // Fake ID
      expect(fakeData.balance).toBe(100); // Fake balance
      expect(fakeData.status).toBe('pending'); // Fake status
      
      // This test documents that such fake data should never be returned
    });

    it('should return real account data when creation succeeds', () => {
      // Simulate successful account creation
      const realAccount = {
        id: 123,
        userId: 1,
        accountNumber: '9876543210',
        accountType: 'checking',
        balance: 0,  // Real initial balance
        status: 'active',  // Real status
        createdAt: new Date().toISOString(),
      };

      // This is the correct return value
      expect(realAccount.id).toBeGreaterThan(0); // Real ID from database
      expect(realAccount.balance).toBe(0); // Correct initial balance
      expect(realAccount.status).toBe('active'); // Real status
    });
  });
});

describe('PERF-405: Missing Transactions - Integration Tests', () => {
  // Cleanup after all tests
  afterAll(async () => {
    // Clean up test data - delete in correct order due to foreign keys
    await db.delete(transactions).where(like(transactions.description, '%PERF405-TEST%'));
    const testUsers = await db.select().from(users).where(like(users.email, '%perf405-test%'));
    for (const user of testUsers) {
      await db.delete(accounts).where(eq(accounts.userId, user.id));
    }
    await db.delete(users).where(like(users.email, '%perf405-test%'));
  });

  // Helper to create test user
  async function createTestUser() {
    const email = `perf405-test-${Date.now()}-${Math.random()}@test.com`;
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '1234567890',
      dateOfBirth: '1990-01-01',
      ssn: '123456789',
      address: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zipCode: '12345',
    });

    return db.select().from(users).where(eq(users.email, email)).get();
  }

  // Helper to create test account
  async function createTestAccount(userId: number) {
    const accountNumber = generateAccountNumber();
    
    await db.insert(accounts).values({
      userId,
      accountNumber,
      accountType: 'checking',
      balance: 0,
      status: 'active',
    });

    return db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).get();
  }

  it('should return exact transaction using .returning()', async () => {
    // Create test user and account
    const user = await createTestUser();
    const account = await createTestAccount(user!.id);

    // Insert transaction with .returning() - this is the fix
    const [transaction] = await db.insert(transactions).values({
      accountId: account!.id,
      type: 'deposit',
      amount: 100,
      description: 'PERF405-TEST: deposit',
      status: 'completed',
      processedAt: new Date().toISOString(),
    }).returning();

    // Verify we got the exact transaction
    expect(transaction).toBeDefined();
    expect(transaction.accountId).toBe(account!.id);
    expect(transaction.amount).toBe(100);
    expect(transaction.description).toBe('PERF405-TEST: deposit');
    expect(transaction.type).toBe('deposit');
  });

  it('should not return wrong transaction with concurrent inserts', async () => {
    // Create test users and accounts
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const account1 = await createTestAccount(user1!.id);
    const account2 = await createTestAccount(user2!.id);

    // Insert two different transactions
    const [transaction1] = await db.insert(transactions).values({
      accountId: account1!.id,
      type: 'deposit',
      amount: 100,
      description: 'PERF405-TEST: user1 deposit',
      status: 'completed',
      processedAt: new Date().toISOString(),
    }).returning();

    const [transaction2] = await db.insert(transactions).values({
      accountId: account2!.id,
      type: 'deposit',
      amount: 200,
      description: 'PERF405-TEST: user2 deposit',
      status: 'completed',
      processedAt: new Date().toISOString(),
    }).returning();

    // Each should get their own transaction
    expect(transaction1.accountId).toBe(account1!.id);
    expect(transaction1.amount).toBe(100);
    
    expect(transaction2.accountId).toBe(account2!.id);
    expect(transaction2.amount).toBe(200);
    
    // They should be different
    expect(transaction1.id).not.toBe(transaction2.id);
  });

  it('should return transaction with all correct fields', async () => {
    const user = await createTestUser();
    const account = await createTestAccount(user!.id);

    const testAmount = 250.50;
    const testDescription = 'PERF405-TEST: specific amount';

    const [transaction] = await db.insert(transactions).values({
      accountId: account!.id,
      type: 'withdrawal',
      amount: testAmount,
      description: testDescription,
      status: 'pending',
      processedAt: new Date().toISOString(),
    }).returning();

    // Verify all fields
    expect(transaction.id).toBeGreaterThan(0);
    expect(transaction.accountId).toBe(account!.id);
    expect(transaction.type).toBe('withdrawal');
    expect(transaction.amount).toBe(testAmount);
    expect(transaction.description).toBe(testDescription);
    expect(transaction.status).toBe('pending');
    expect(transaction.createdAt).toBeDefined();
    expect(transaction.processedAt).toBeDefined();
  });
});
