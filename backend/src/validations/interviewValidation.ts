import { z } from 'zod';

export const startInterviewSchema = z.object({
  body: z.object({
    candidateName: z.string().min(2, 'Name must be at least 2 characters'),
    candidateEmail: z.string().email('Invalid email').optional(),
    isDemo: z.boolean().optional(),
  }),
});

export const respondInterviewSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid('Invalid Session ID'),
    text: z.string().min(1, 'Response text cannot be empty'),
    codeSubmission: z
      .object({
        code: z.string(),
        language: z.string().optional(),
        challengeId: z.string().optional(),
        repoName: z.string().optional(),
      })
      .optional(),
    silenceDurationSec: z.number().optional(),
    ttsDurationSec: z.number().optional(),
  }),
});

export const evaluateInterviewSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid('Invalid Session ID'),
  }),
});

export const submitFeedbackSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid('Invalid Session ID'),
    feedback: z.string().min(1, 'Feedback text cannot be empty'),
  }),
});

export const proctorFrameSchema = z.object({
  body: z.object({
    sessionId: z.string().optional(),
    image: z.string().min(10, 'Invalid image data'), // base64 image
  }),
});
