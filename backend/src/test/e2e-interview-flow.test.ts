import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

const RUN_ID = Date.now().toString();
const RECRUITER_EMAIL = `recruiter_e2e_${RUN_ID}@example.com`;
const APPLICANT_EMAIL = `applicant_e2e_${RUN_ID}@example.com`;
const PASSWORD = 'StrongE2EPassword123!@#';

describe('End-to-End Interview Pipeline Integration Suite', () => {
  let recruiterToken: string = '';
  let recruiterId: string = '';
  let applicantToken: string = '';
  let applicantId: string = '';
  let jobDescriptionId: string = '';
  let invitationToken: string = '';
  let invitationId: string = '';
  let interviewSessionId: string = '';

  afterAll(async () => {
    try {
      if (interviewSessionId) {
        await prisma.detectionEvent.deleteMany({ where: { interviewSessionId } });
        await prisma.message.deleteMany({ where: { interviewSessionId } });
        await prisma.interviewSession.deleteMany({ where: { id: interviewSessionId } });
      }
      await prisma.interviewInvitation.deleteMany({
        where: { recruiter: { email: RECRUITER_EMAIL } },
      });
      await prisma.jobDescription.deleteMany({
        where: { recruiter: { email: RECRUITER_EMAIL } },
      });
      await prisma.session.deleteMany({
        where: { user: { email: { in: [RECRUITER_EMAIL, APPLICANT_EMAIL] } } },
      });
      await prisma.emailVerificationToken.deleteMany({
        where: { user: { email: { in: [RECRUITER_EMAIL, APPLICANT_EMAIL] } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [RECRUITER_EMAIL, APPLICANT_EMAIL] } },
      });
    } catch (err) {
      // Ignore cleanup error
    }
  });

  it('1. Recruiter Registration & Signin Flow', async () => {
    const signupRes = await request(app)
      .post('/api/v1/auth/signup/recruiter')
      .send({
        email: RECRUITER_EMAIL,
        password: PASSWORD,
        name: 'Lead Technical Recruiter',
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.user.role).toBe('RECRUITER');
    recruiterId = signupRes.body.user.id;

    const signinRes = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: RECRUITER_EMAIL,
        password: PASSWORD,
      });

    expect(signinRes.status).toBe(200);
    expect(signinRes.body.success).toBe(true);
    expect(signinRes.body.accessToken).toBeDefined();
    recruiterToken = signinRes.body.accessToken;
  });

  it('2. Recruiter Job Description Creation', async () => {
    const jdRes = await request(app)
      .post('/api/v1/recruiter/jd/create')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        recruiterId,
        title: 'Senior Backend Architect',
        department: 'Engineering',
        jobLevel: 'SENIOR',
        employmentType: 'Full-time',
        shortSummary: 'Looking for a Senior Backend Architect proficient in Node.js, PostgreSQL, and Redis.',
        rawContent: 'Senior Backend Architect. Minimum 5 years experience with Node.js, Express, PostgreSQL, and distributed caching with Redis.',
        requiredSkills: [
          { name: 'Node.js', category: 'BACKEND', importance: 'MUST_HAVE', proficiency: 'ADVANCED' },
          { name: 'PostgreSQL', category: 'DATABASE', importance: 'MUST_HAVE', proficiency: 'ADVANCED' },
        ],
        preferredSkills: ['Redis', 'Docker'],
      });

    expect(jdRes.status).toBe(201);
    expect(jdRes.body.status).toBe('success');
    expect(jdRes.body.data.id).toBeDefined();
    jobDescriptionId = jdRes.body.data.id;
  });

  it('3. Candidate Signup Flow', async () => {
    const signupRes = await request(app)
      .post('/api/v1/auth/signup/applicant')
      .send({
        email: APPLICANT_EMAIL,
        password: PASSWORD,
        name: 'Alice Candidate',
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.role).toBe('APPLICANT');
    applicantId = signupRes.body.user.id;

    const signinRes = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: APPLICANT_EMAIL,
        password: PASSWORD,
      });

    expect(signinRes.status).toBe(200);
    applicantToken = signinRes.body.accessToken;
  });

  it('4. Recruiter Sends Candidate Invitation', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/recruiter/invite')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        recruiterId,
        jobDescriptionId,
        applicantEmail: APPLICANT_EMAIL,
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.status).toBe('success');
    expect(inviteRes.body.data.token).toBeDefined();

    invitationToken = inviteRes.body.data.token;
    invitationId = inviteRes.body.data.id;
  });

  it('5. Candidate Resolves Invitation Details via Link Token', async () => {
    const resolveRes = await request(app).get(`/api/v1/invitation/${invitationToken}`);

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.status).toBe('success');
    expect(resolveRes.body.data.applicantEmail).toBe(APPLICANT_EMAIL);
    expect(resolveRes.body.data.jobDescription.title).toBe('Senior Backend Architect');
  });

  it('6. Candidate Starts Interview Session', async () => {
    const startRes = await request(app)
      .post('/api/v1/interview/start')
      .send({
        candidateName: 'Alice Candidate',
        candidateEmail: APPLICANT_EMAIL,
        invitationId,
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.success).toBe(true);
    expect(startRes.body.data.sessionId).toBeDefined();
    expect(startRes.body.data.question).toBeDefined();

    interviewSessionId = startRes.body.data.sessionId;
  });

  it('7. Candidate Submits Turn Answer', async () => {
    const turnRes = await request(app)
      .post('/api/v1/interview/respond')
      .send({
        sessionId: interviewSessionId,
        text: 'I have extensive experience designing Node.js microservices with PostgreSQL connection pooling using node-postgres.',
      });

    expect(turnRes.status).toBe(200);
    expect(turnRes.body.success).toBe(true);
    expect(turnRes.body.data.reply).toBeDefined();
  });

  it('8. Proctoring Engine Records Sensor Frame Event', async () => {
    const proctorRes = await request(app)
      .post('/api/v1/interview/proctor/frame')
      .send({
        sessionId: interviewSessionId,
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      });

    expect(proctorRes.status).toBe(200);
    expect(proctorRes.body.success).toBe(true);
  });

  it('9. Candidate Submits Session Feedback & Concludes Interview', async () => {
    const feedbackRes = await request(app)
      .post('/api/v1/interview/feedback')
      .send({
        sessionId: interviewSessionId,
        feedback: 'Great interactive interview experience!',
      });

    expect(feedbackRes.status).toBe(200);
    expect(feedbackRes.body.success).toBe(true);
  });

  it('10. Recruiter Fetches Candidate Explainable Evidence Report', async () => {
    const reportRes = await request(app)
      .get(`/api/v1/interview/session/${interviewSessionId}/explainable-report`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.success).toBe(true);
    expect(reportRes.body.data.sessionId).toBe(interviewSessionId);
    expect(reportRes.body.data.candidateName).toBe('Alice Candidate');
    expect(reportRes.body.data.candidateEvidenceProfile).toBeDefined();
    expect(reportRes.body.data.proctoringTimeline).toBeDefined();
  });
});
