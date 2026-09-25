import { z } from 'zod';

export const normalizeSource = (val: unknown): string => {
  if (typeof val !== 'string') return 'JD_REQUIREMENT';
  const u = val.toUpperCase().trim();
  if (u.includes('GITHUB') && u.includes('PROJECT')) return 'GITHUB_PROJECT_ARCHITECTURE';
  if (u.includes('GITHUB') || u.includes('REPO')) return 'GITHUB_PROJECT_ARCHITECTURE';
  if (u.includes('RESUME_GITHUB') || (u.includes('RESUME') && u.includes('GITHUB'))) return 'RESUME_GITHUB_OVERLAP';
  if (u.includes('OVERLAP')) return 'JD_RESUME_OVERLAP';
  if (u.includes('GAP')) return 'JD_GAP';
  if (u.includes('FOLLOW')) return 'FOLLOW_UP';
  if (u.includes('BEHAVIOR')) return 'BEHAVIORAL';
  if (u.includes('PROJECT')) return 'RESUME_PROJECT';
  if (u.includes('EXPERIENCE')) return 'RESUME_EXPERIENCE';
  if (u.includes('RESUME') && u.includes('SKILL')) return 'RESUME_SKILL';
  if (u.includes('RESUME')) return 'RESUME_PROJECT';
  if (u.includes('RESPONSIBIL')) return 'JD_RESPONSIBILITY';
  if (u.includes('DOMAIN')) return 'JD_DOMAIN';
  if (u.includes('JD') || u.includes('REQUIRE')) return 'JD_REQUIREMENT';
  return 'JD_REQUIREMENT';
};

export const QuestionSourceEnum = z.preprocess(
  normalizeSource,
  z.enum([
    'JD_REQUIREMENT',
    'JD_RESPONSIBILITY',
    'JD_DOMAIN',
    'RESUME_SKILL',
    'RESUME_PROJECT',
    'RESUME_EXPERIENCE',
    'JD_RESUME_OVERLAP',
    'JD_GAP',
    'GITHUB_PROJECT_ARCHITECTURE',
    'RESUME_GITHUB_OVERLAP',
    'FOLLOW_UP',
    'BEHAVIORAL',
  ])
);

export type QuestionSource = z.infer<typeof QuestionSourceEnum>;

export const normalizeDifficulty = (val: unknown): 'EASY' | 'MEDIUM' | 'HARD' => {
  if (typeof val !== 'string') return 'MEDIUM';
  const u = val.toUpperCase().trim();
  if (u.includes('HARD') || u.includes('ADVANCED') || u.includes('DIFFICULT')) return 'HARD';
  if (u.includes('EASY') || u.includes('BASIC') || u.includes('SIMPLE')) return 'EASY';
  return 'MEDIUM';
};

export const QuestionDifficultyEnum = z.preprocess(
  normalizeDifficulty,
  z.enum(['EASY', 'MEDIUM', 'HARD'])
);

export type QuestionDifficulty = z.infer<typeof QuestionDifficultyEnum>;

export const PersonalizedQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  skill: z.string(),
  difficulty: QuestionDifficultyEnum.default('MEDIUM'),
  sources: z.array(QuestionSourceEnum),
  rationale: z.string(),
  suggestedEvaluationCriteria: z.array(z.string()).default([]),
  followUpProbes: z.array(z.string()).default([]),
  githubProject: z.string().optional(),
  targetArchitecture: z.string().optional(),
});

export type PersonalizedQuestion = z.infer<typeof PersonalizedQuestionSchema>;

export const QuestionGenerationPlanSchema = z.object({
  roleTitle: z.string(),
  candidateName: z.string(),
  summaryRationale: z.string().default(''),
  overlapSummary: z.array(z.string()).default([]),
  gapSummary: z.array(z.string()).default([]),
  githubProjectSummary: z.array(z.string()).default([]),
  questions: z.array(PersonalizedQuestionSchema),
});

export type QuestionGenerationPlan = z.infer<typeof QuestionGenerationPlanSchema>;
