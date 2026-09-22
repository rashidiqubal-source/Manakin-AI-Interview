import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

const RUN_ID = Date.now().toString();
const APPLICANT_EMAIL = `app_${RUN_ID}@example.com`;
const RECRUITER_EMAIL = `rec_${RUN_ID}@example.com`;
const PASSWORD = 'StrongAuthPassword123!@#';

describe('Unified Authentication Specification Tests (Dual Signup, Single Signin)', () => {
  afterAll(async () => {
    try {
      await prisma.session.deleteMany({
        where: { user: { email: { in: [APPLICANT_EMAIL, RECRUITER_EMAIL] } } },
      });
      await prisma.emailVerificationToken.deleteMany({
        where: { user: { email: { in: [APPLICANT_EMAIL, RECRUITER_EMAIL] } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [APPLICANT_EMAIL, RECRUITER_EMAIL] } },
      });
    } catch {
      // ignore cleanup errors
    }
  });

  it('POST /api/v1/auth/signup/applicant should register an APPLICANT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup/applicant')
      .send({
        email: APPLICANT_EMAIL,
        password: PASSWORD,
        name: 'Applicant User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('APPLICANT');
    expect(res.body.user.email).toBe(APPLICANT_EMAIL);
  });

  it('POST /api/v1/auth/signup/recruiter should register a RECRUITER', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup/recruiter')
      .send({
        email: RECRUITER_EMAIL,
        password: PASSWORD,
        name: 'Recruiter User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('RECRUITER');
    expect(res.body.user.email).toBe(RECRUITER_EMAIL);
  });

  it('POST /api/v1/auth/signin should authenticate APPLICANT and return user + accessToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: APPLICANT_EMAIL,
        password: PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('APPLICANT');
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/v1/auth/signin should authenticate RECRUITER through the exact same endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: RECRUITER_EMAIL,
        password: PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('RECRUITER');
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
