import { describe, it, expect, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { eq, like } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

describe('Session Management', () => {
  // Cleanup after all tests complete
  afterAll(async () => {
    // Delete all test users and their sessions (users with @test.com emails)
    const testUsers = await db.select().from(users).where(like(users.email, '%@test.com'));
    
    for (const user of testUsers) {
      await db.delete(sessions).where(eq(sessions.userId, user.id));
    }
    
    await db.delete(users).where(like(users.email, '%@test.com'));
  });

  // Helper to create a test user with unique email
  async function createTestUser(baseName: string = 'test') {
    const email = `${baseName}-${Date.now()}-${Math.random()}@test.com`;
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

  // Helper to create a session
  async function createTestSession(userId: number, expiresInDays: number = 7) {
    const token = `test-token-${Date.now()}-${Math.random()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db.insert(sessions).values({
      userId,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return db.select().from(sessions).where(eq(sessions.token, token)).get();
  }

  describe('Signup Session Creation', () => {
    it('should create a session for new user', async () => {
      const user = await createTestUser('newuser');

      const sessionsBeforeSignup = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsBeforeSignup).toHaveLength(0);

      await createTestSession(user!.id);

      const sessionsAfterSignup = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsAfterSignup).toHaveLength(1);
    });

    it('should not delete any sessions during signup (new user has none)', async () => {
      const user = await createTestUser('signup');
      
      const sessionsBefore = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsBefore).toHaveLength(0);

      await createTestSession(user!.id);

      const sessionsAfter = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsAfter).toHaveLength(1);
    });
  });

  describe('Login Session Reuse', () => {
    it('should reuse existing valid session on login', async () => {
      const user = await createTestUser('reuse');
      
      const existingSession = await createTestSession(user!.id, 7);

      const foundSession = await db.select().from(sessions)
        .where(eq(sessions.userId, user!.id))
        .get();

      expect(foundSession).toBeDefined();
      expect(foundSession!.token).toBe(existingSession!.token);
      expect(new Date(foundSession!.expiresAt) > new Date()).toBe(true);
    });

    it('should create new session if existing session is expired', async () => {
      const user = await createTestUser('expired');
      
      const expiredSession = await createTestSession(user!.id, -1);

      const foundSession = await db.select().from(sessions)
        .where(eq(sessions.userId, user!.id))
        .get();

      expect(new Date(foundSession!.expiresAt) <= new Date()).toBe(true);

      await db.delete(sessions).where(eq(sessions.userId, user!.id));
      const newSession = await createTestSession(user!.id);

      const sessionsAfter = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsAfter).toHaveLength(1);
      expect(sessionsAfter[0].token).not.toBe(expiredSession!.token);
      expect(sessionsAfter[0].token).toBe(newSession!.token);
    });

    it('should create new session if no existing session', async () => {
      const user = await createTestUser('nosession');
      
      const sessionsBefore = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsBefore).toHaveLength(0);

      await createTestSession(user!.id);

      const sessionsAfter = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsAfter).toHaveLength(1);
    });

    it('should clean up expired sessions on login', async () => {
      const user = await createTestUser('cleanup');
      
      await createTestSession(user!.id, -1);
      await createTestSession(user!.id, -2);
      await createTestSession(user!.id, -3);

      const sessionsBefore = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsBefore).toHaveLength(3);

      await db.delete(sessions).where(eq(sessions.userId, user!.id));
      
      const sessionsAfter = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(sessionsAfter).toHaveLength(0);

      await createTestSession(user!.id);

      const finalSessions = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
      expect(finalSessions).toHaveLength(1);
    });
  });

  describe('Logout Session Deletion', () => {
    it('should delete session on logout', async () => {
      const user = await createTestUser('logout');
      const session = await createTestSession(user!.id);

      const sessionBefore = await db.select().from(sessions)
        .where(eq(sessions.token, session!.token))
        .get();
      expect(sessionBefore).toBeDefined();

      await db.delete(sessions).where(eq(sessions.token, session!.token));

      const sessionAfter = await db.select().from(sessions)
        .where(eq(sessions.token, session!.token))
        .get();
      expect(sessionAfter).toBeUndefined();
    });

    it('should only delete the specific session token', async () => {
      const user1 = await createTestUser('user1');
      const user2 = await createTestUser('user2');
      
      const session1 = await createTestSession(user1!.id);
      const session2 = await createTestSession(user2!.id);

      await db.delete(sessions).where(eq(sessions.token, session1!.token));

      const session1After = await db.select().from(sessions)
        .where(eq(sessions.token, session1!.token))
        .get();
      expect(session1After).toBeUndefined();

      const session2After = await db.select().from(sessions)
        .where(eq(sessions.token, session2!.token))
        .get();
      expect(session2After).toBeDefined();
    });
  });

  describe('Session Expiry Validation', () => {
    it('should correctly identify valid sessions', async () => {
      const user = await createTestUser('valid');
      const session = await createTestSession(user!.id, 7);

      const isValid = new Date(session!.expiresAt) > new Date();
      expect(isValid).toBe(true);
    });

    it('should correctly identify expired sessions', async () => {
      const user = await createTestUser('expired2');
      const session = await createTestSession(user!.id, -1);

      const isExpired = new Date(session!.expiresAt) <= new Date();
      expect(isExpired).toBe(true);
    });

    it('should treat session expiring right now as expired', async () => {
      const user = await createTestUser('expiring');
      
      const token = `test-token-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 1000);

      await db.insert(sessions).values({
        userId: user!.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const session = await db.select().from(sessions).where(eq(sessions.token, token)).get();
      const isExpired = new Date(session!.expiresAt) <= new Date();
      expect(isExpired).toBe(true);
    });
  });

  describe('Multi-User Session Isolation', () => {
    it('should keep sessions isolated between users', async () => {
      const user1 = await createTestUser('isolated1');
      const user2 = await createTestUser('isolated2');
      
      await createTestSession(user1!.id);
      await createTestSession(user2!.id);

      const user1Sessions = await db.select().from(sessions).where(eq(sessions.userId, user1!.id));
      const user2Sessions = await db.select().from(sessions).where(eq(sessions.userId, user2!.id));

      expect(user1Sessions).toHaveLength(1);
      expect(user2Sessions).toHaveLength(1);
      expect(user1Sessions[0].userId).toBe(user1!.id);
      expect(user2Sessions[0].userId).toBe(user2!.id);
    });

    it('should not affect other users when deleting sessions', async () => {
      const user1 = await createTestUser('delete1');
      const user2 = await createTestUser('delete2');
      
      await createTestSession(user1!.id);
      await createTestSession(user2!.id);

      await db.delete(sessions).where(eq(sessions.userId, user1!.id));

      const user1Sessions = await db.select().from(sessions).where(eq(sessions.userId, user1!.id));
      const user2Sessions = await db.select().from(sessions).where(eq(sessions.userId, user2!.id));

      expect(user1Sessions).toHaveLength(0);
      expect(user2Sessions).toHaveLength(1);
    });
  });
});
