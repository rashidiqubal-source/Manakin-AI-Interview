import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { hashPassword, verifyPassword, validatePassword } from '../utils/password';
import { generateSecureToken, hashToken } from '../utils/token';
import { SessionService } from '../services/SessionService';
import { env } from '../config/env';


// Unique test run prefix to prevent test collision
const TEST_RUN_ID = Date.now().toString();
const TEST_EMAIL_APPLICANT = `applicant_${TEST_RUN_ID}@example.com`;
const TEST_EMAIL_RECRUITER = `recruiter_${TEST_RUN_ID}@example.com`;
const STRONG_PASSWORD = 'SuperSecurePassword123!@#';
const NEW_STRONG_PASSWORD = 'EvenStrongerPassword456$%^';

describe('Production-Grade Authentication System Integration Tests', () => {
  let applicantUserId: string;
  let applicantSessionToken: string;
  let applicantCookieHeader: string;
  let verificationTokenHex: string;
  let passwordResetTokenHex: string;

  afterAll(async () => {
    // Cleanup created test records
    try {
      await prisma.session.deleteMany({
        where: { user: { email: { in: [TEST_EMAIL_APPLICANT, TEST_EMAIL_RECRUITER] } } },
      });
      await prisma.emailVerificationToken.deleteMany({
        where: { user: { email: { in: [TEST_EMAIL_APPLICANT, TEST_EMAIL_RECRUITER] } } },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { user: { email: { in: [TEST_EMAIL_APPLICANT, TEST_EMAIL_RECRUITER] } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [TEST_EMAIL_APPLICANT, TEST_EMAIL_RECRUITER] } },
      });
      await prisma.$disconnect();
    } catch (e) {
      // ignore cleanup errors
    }
  });

  describe('1. Password Hashing & Cryptographic Security', () => {
    it('should validate password complexity rules correctly', () => {
      expect(validatePassword('short').isValid).toBe(false);
      expect(validatePassword('nouppercase123!').isValid).toBe(false);
      expect(validatePassword('NOLOWERCASE123!').isValid).toBe(false);
      expect(validatePassword('NoSpecialDigitsHere').isValid).toBe(false);
      expect(validatePassword('ValidPass123!').isValid).toBe(true);
    });

    it('should hash password with Argon2id and verify correctly', async () => {
      const hash = await hashPassword(STRONG_PASSWORD);
      expect(hash).toMatch(/^\$argon2id\$/);

      const isValid = await verifyPassword(STRONG_PASSWORD, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('WrongPassword123!', hash);
      expect(isInvalid).toBe(false);
    });

    it('should generate high-entropy tokens and compute deterministic SHA-256 hashes', () => {
      const token1 = generateSecureToken(32);
      const token2 = generateSecureToken(32);
      expect(token1).toHaveLength(64); // 32 bytes in hex = 64 chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toEqual(token2);

      const hash1 = hashToken(token1);
      const hash2 = hashToken(token1);
      expect(hash1).toEqual(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('2. User Signup Flow (/auth/signup)', () => {
    it('should reject signup with invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: STRONG_PASSWORD,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject signup with weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: `weak_${TEST_RUN_ID}@example.com`,
          password: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should successfully register a new user without returning sensitive hashes', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: STRONG_PASSWORD,
          name: 'Jane Applicant',
          role: 'APPLICANT',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(TEST_EMAIL_APPLICANT);
      expect(res.body.data.user.role).toBe('APPLICANT');
      expect(res.body.data.user.emailVerified).toBe(false);

      // Verify no sensitive tokens or password hashes in response
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.token).toBeUndefined();

      applicantUserId = res.body.data.user.id;

      // Verify database record has Argon2id hash and email verification token record
      const dbUser = await prisma.user.findUnique({
        where: { email: TEST_EMAIL_APPLICANT },
        include: { emailVerifications: true },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(dbUser?.emailVerifications.length).toBeGreaterThan(0);
    });

    it('should reject duplicate signup with 409 conflict', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: STRONG_PASSWORD,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. User Signin & Session Flow (/auth/signin)', () => {
    it('should fail with 401 when given incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: 'IncorrectPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should fail with 401 when given nonexistent email without user enumeration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          email: `nonexistent_${TEST_RUN_ID}@example.com`,
          password: STRONG_PASSWORD,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should sign in successfully and return Set-Cookie with secure HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: STRONG_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(TEST_EMAIL_APPLICANT);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Check cookie
      const cookies = res.headers['set-cookie'] as unknown as string[] | string | undefined;
      expect(cookies).toBeDefined();


      const cookieList = Array.isArray(cookies) ? cookies : [cookies as unknown as string];
      const sessionCookie = cookieList.find((c: string) => c && c.startsWith(`${env.SESSION_COOKIE_NAME}=`));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Path=/');

      applicantCookieHeader = (sessionCookie || '').split(';')[0];
      applicantSessionToken = applicantCookieHeader.split('=')[1];

    });
  });

  describe('4. Protected Endpoint & Authentication Middleware (/auth/me)', () => {
    it('should reject unauthenticated request to /auth/me with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with tampered/invalid session cookie', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${env.SESSION_COOKIE_NAME}=invalid_tampered_token_value_here`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow access to /auth/me with valid session cookie and return sanitized profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', applicantCookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(applicantUserId);
      expect(res.body.data.user.email).toBe(TEST_EMAIL_APPLICANT);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should also accept Bearer session token header for API clients', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${applicantSessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(TEST_EMAIL_APPLICANT);
    });
  });

  describe('5. Email Verification Flow (/auth/verify-email & /auth/resend-verification)', () => {
    it('should reject invalid or expired verification tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid_token_which_does_not_exist_in_db' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should verify email with valid single-use token and update user status', async () => {
      // Create a fresh verification token directly
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);

      await prisma.emailVerificationToken.create({
        data: {
          userId: applicantUserId,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify user in DB is now verified
      const dbUser = await prisma.user.findUnique({ where: { id: applicantUserId } });
      expect(dbUser?.emailVerified).toBe(true);

      // Verify reusing the token fails
      const reuseRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: rawToken });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.success).toBe(false);
    });

    it('should provide safe response for resend-verification without account enumeration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: TEST_EMAIL_APPLICANT });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verification link');
    });
  });

  describe('6. Password Reset Flow (/auth/forgot-password & /auth/reset-password)', () => {
    it('should return safe generic message for forgot-password for any email', async () => {
      const res1 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: TEST_EMAIL_APPLICANT });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.message).toContain('password reset link');

      const res2 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: `unregistered_${TEST_RUN_ID}@example.com` });

      expect(res2.status).toBe(200);
      expect(res2.body.message).toBe(res1.body.message); // Exact same safe message
    });

    it('should reset password with valid token, update hash, and revoke all active sessions', async () => {
      // 1. Generate active reset token
      const rawResetToken = generateSecureToken(32);
      const tokenHash = hashToken(rawResetToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: applicantUserId,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // 2. Perform password reset
      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawResetToken,
          newPassword: NEW_STRONG_PASSWORD,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 3. Verify previous session was revoked
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', applicantCookieHeader);

      expect(meRes.status).toBe(401);

      // 4. Verify signin with old password fails
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: STRONG_PASSWORD,
        });

      expect(oldLoginRes.status).toBe(401);

      // 5. Verify signin with new password succeeds
      const newLoginRes = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: NEW_STRONG_PASSWORD,
        });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);

      // 6. Verify reset token cannot be reused
      const reuseRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawResetToken,
          newPassword: 'AnotherPassword999!',
        });

      expect(reuseRes.status).toBe(400);
    });
  });

  describe('7. Signout & Session Revocation (/auth/signout)', () => {
    it('should revoke session on signout and clear cookie', async () => {
      // Sign in first to get a session
      const loginRes = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          email: TEST_EMAIL_APPLICANT,
          password: NEW_STRONG_PASSWORD,
        });

      const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

      // Sign out
      const logoutRes = await request(app)
        .post('/api/v1/auth/signout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Check cookie cleared in header
      const clearedCookies = logoutRes.headers['set-cookie'];
      expect(clearedCookies).toBeDefined();

      // Subsequent call to /auth/me with that cookie must be rejected with 401
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(401);
    });
  });
});
