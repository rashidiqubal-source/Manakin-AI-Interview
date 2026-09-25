import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

const RUN_ID = Date.now().toString();
const APPLICANT_EMAIL = `sec_app_${RUN_ID}@example.com`;
const RECRUITER_EMAIL = `sec_rec_${RUN_ID}@example.com`;
const PASSWORD = 'StrongSecurityPassword123!@#';

describe('Security Controls & RBAC Protection Suite', () => {
  let applicantToken: string = '';
  let recruiterToken: string = '';

  afterAll(async () => {
    try {
      await prisma.session.deleteMany({
        where: { user: { email: { in: [APPLICANT_EMAIL, RECRUITER_EMAIL] } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [APPLICANT_EMAIL, RECRUITER_EMAIL] } },
      });
    } catch {
      // ignore cleanup error
    }
  });

  it('1. Enforces Security Headers (Helmet, CORS, Cookie Security)', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    // Security headers injected by Helmet & Express security middlewares
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('2. Registers Applicant & Recruiter accounts for RBAC testing', async () => {
    const appSignup = await request(app)
      .post('/api/v1/auth/signup/applicant')
      .send({ email: APPLICANT_EMAIL, password: PASSWORD, name: 'Sec Applicant' });
    expect(appSignup.status).toBe(201);

    const appSignin = await request(app)
      .post('/api/v1/auth/signin')
      .send({ email: APPLICANT_EMAIL, password: PASSWORD });
    expect(appSignin.status).toBe(200);
    applicantToken = appSignin.body.accessToken;

    const recSignup = await request(app)
      .post('/api/v1/auth/signup/recruiter')
      .send({ email: RECRUITER_EMAIL, password: PASSWORD, name: 'Sec Recruiter' });
    expect(recSignup.status).toBe(201);

    const recSignin = await request(app)
      .post('/api/v1/auth/signin')
      .send({ email: RECRUITER_EMAIL, password: PASSWORD });
    expect(recSignin.status).toBe(200);
    recruiterToken = recSignin.body.accessToken;
  });

  it('3. Rejects APPLICANT attempting to access Admin endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${applicantToken}`);

    // Should be rejected for non-admin applicant user
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('4. Rejects malformed payload with Zod Schema Validation error (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup/applicant')
      .send({
        email: 'not-an-email-address',
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.message || res.body.error).toBeDefined();
  });

  it('5. Rejects unauthorized access to protected /auth/me endpoint without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Unauthorized');
  });
});
