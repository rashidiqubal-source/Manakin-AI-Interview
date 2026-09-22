import { z } from 'zod';

export const CandidateAnswerEvaluationSchema = z.object({
  questionId: z.string().optional(),
  questionText: z.string(),
  candidateAnswer: z.string(),
  technicalAccuracyScore: z.number().min(1).max(10),
  depthScore: z.number().min(1).max(10),
  clarityScore: z.number().min(1).max(10),
  responseQuality: z.enum(['clear', 'vague', 'complex', 'off-topic', 'unsatisfactory']),
  strengthsIdentified: z.array(z.string()).default([]),
  weakAreasIdentified: z.array(z.string()).default([]),
  evidenceQuotes: z.array(z.string()).default([]),
  suggestedFollowUpProbe: z.string().nullable().optional(),
});

export type CandidateAnswerEvaluation = z.infer<typeof CandidateAnswerEvaluationSchema>;
