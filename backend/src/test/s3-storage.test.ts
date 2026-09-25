import { S3Service, S3ServiceClass } from '../services/S3Service';
import { env } from '../config/env';

describe('AWS S3 Screenshot Storage & Prefix Isolation Suite', () => {
  let s3Service: S3ServiceClass;

  beforeEach(() => {
    s3Service = new S3ServiceClass();
  });

  describe('1. S3 Key Formatting & Zero-Padding Specification', () => {
    it('formats key strictly as interviews/{interviewId}/screenshot_{sequenceNumber}.png with 3-digit padding', () => {
      const key1 = s3Service.formatS3Key('interview_abc123', 1);
      expect(key1).toBe('interviews/interview_abc123/screenshot_001.png');

      const key2 = s3Service.formatS3Key('interview_abc123', 2);
      expect(key2).toBe('interviews/interview_abc123/screenshot_002.png');

      const key3 = s3Service.formatS3Key('interview_abc123', 3);
      expect(key3).toBe('interviews/interview_abc123/screenshot_003.png');
    });

    it('pads sequence numbers correctly for multi-digit values', () => {
      expect(s3Service.formatS3Key('interview_xyz789', 9)).toBe('interviews/interview_xyz789/screenshot_009.png');
      expect(s3Service.formatS3Key('interview_xyz789', 10)).toBe('interviews/interview_xyz789/screenshot_010.png');
      expect(s3Service.formatS3Key('interview_xyz789', 99)).toBe('interviews/interview_xyz789/screenshot_099.png');
      expect(s3Service.formatS3Key('interview_xyz789', 100)).toBe('interviews/interview_xyz789/screenshot_100.png');
    });

    it('sanitizes unsafe characters in interviewId to prevent path traversal', () => {
      const key = s3Service.formatS3Key('../../../bad/interview_test', 1);
      expect(key).not.toContain('..');
      expect(key).toBe('interviews/badinterview_test/screenshot_001.png');
    });
  });

  describe('2. Prefix Isolation Between Interviews', () => {
    it('isolates different interview sessions into distinct prefixes', () => {
      const keyA = s3Service.formatS3Key('interview_abc123', 1);
      const keyB = s3Service.formatS3Key('interview_xyz789', 1);
      const keyC = s3Service.formatS3Key('interview_pqr456', 1);

      expect(keyA).toBe('interviews/interview_abc123/screenshot_001.png');
      expect(keyB).toBe('interviews/interview_xyz789/screenshot_001.png');
      expect(keyC).toBe('interviews/interview_pqr456/screenshot_001.png');

      expect(keyA.startsWith('interviews/interview_abc123/')).toBe(true);
      expect(keyB.startsWith('interviews/interview_xyz789/')).toBe(true);
      expect(keyC.startsWith('interviews/interview_pqr456/')).toBe(true);
    });
  });

  describe('3. Atomic Sequence Number Generation', () => {
    it('increments sequence numbers sequentially for a session', async () => {
      const sessionId = 'test-session-' + Date.now();
      const seq1 = await s3Service.getNextSequenceNumber(sessionId);
      const seq2 = await s3Service.getNextSequenceNumber(sessionId);
      const seq3 = await s3Service.getNextSequenceNumber(sessionId);

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seq3).toBe(3);
    });

    it('maintains independent sequence counters across concurrent sessions', async () => {
      const sessionAlpha = 'session-alpha-' + Date.now();
      const sessionBeta = 'session-beta-' + Date.now();

      const alpha1 = await s3Service.getNextSequenceNumber(sessionAlpha);
      const beta1 = await s3Service.getNextSequenceNumber(sessionBeta);
      const alpha2 = await s3Service.getNextSequenceNumber(sessionAlpha);
      const beta2 = await s3Service.getNextSequenceNumber(sessionBeta);

      expect(alpha1).toBe(1);
      expect(alpha2).toBe(2);
      expect(beta1).toBe(1);
      expect(beta2).toBe(2);
    });
  });

  describe('4. Upload Parameter Validation & Data Sanitization', () => {
    const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    it('rejects uploads without an interviewId', async () => {
      await expect(
        s3Service.uploadScreenshot({ interviewId: '', imageBase64: dummyBase64 })
      ).rejects.toThrow('interviewId is required');
    });

    it('rejects uploads without valid base64 data', async () => {
      await expect(
        s3Service.uploadScreenshot({ interviewId: 'interview_abc123', imageBase64: '' })
      ).rejects.toThrow('Valid base64 image data is required');
    });

    it('accepts data URI prefix and generates correct result with image/png ContentType', async () => {
      const dataUri = `data:image/png;base64,${dummyBase64}`;
      const res = await s3Service.uploadScreenshot({
        interviewId: 'interview_abc123',
        imageBase64: dataUri,
        sequenceNumber: 1,
      });

      expect(res.key).toBe('interviews/interview_abc123/screenshot_001.png');
      expect(res.sequenceNumber).toBe(1);
      expect(res.bucket).toBe(env.AWS_S3_BUCKET);
      expect(res.contentType).toBe('image/png');
    });
  });

  describe('5. Access Authorization Boundary', () => {
    it('allows ADMIN role to access any interview session', async () => {
      const authorized = await s3Service.isUserAuthorizedForInterview('user-1', 'ADMIN', 'session-123');
      expect(authorized).toBe(true);
    });

    it('denies access if interviewSessionId is missing', async () => {
      const authorized = await s3Service.isUserAuthorizedForInterview('user-1', 'RECRUITER', '');
      expect(authorized).toBe(false);
    });
  });
});
