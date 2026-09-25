import { z } from 'zod';

export const EvidenceSourceTypeEnum = z.enum([
  'JD',
  'RESUME',
  'GITHUB',
  'INTERVIEW',
  'ANSWER',
]);

export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeEnum>;

export const EvidenceGapStatusEnum = z.enum([
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'UNVERIFIED',
  'NO_EVIDENCE',
  'POTENTIAL_CONTRADICTION',
]);

export type EvidenceGapStatus = z.infer<typeof EvidenceGapStatusEnum>;

export const ContradictionSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type ContradictionSeverity = z.infer<typeof ContradictionSeverityEnum>;

export const ContradictionTypeEnum = z.enum([
  'POTENTIAL_SCOPE_MISMATCH',
  'POTENTIAL_DATE_MISMATCH',
  'POTENTIAL_TECHNOLOGY_MISMATCH',
  'POTENTIAL_OWNERSHIP_MISMATCH',
]);

export type ContradictionType = z.infer<typeof ContradictionTypeEnum>;

export const ProvenanceRecordSchema = z.object({
  id: z.string(),
  sourceType: EvidenceSourceTypeEnum,
  sourceId: z.string().optional(),
  referenceExcerpt: z.string(),
  competency: z.string(),
  conclusion: z.string(),
  confidence: z.number().min(0).max(1).default(0.8),
  createdAt: z.string(),
});

export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

export const EvidenceNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['JD_REQUIREMENT', 'CANDIDATE_SKILL', 'RESUME_CLAIM', 'GITHUB_EVIDENCE', 'INTERVIEW_QUESTION', 'CANDIDATE_ANSWER', 'EVALUATION']),
  sourceType: EvidenceSourceTypeEnum,
  metadata: z.record(z.string(), z.any()).optional(),
  provenance: ProvenanceRecordSchema.optional(),
});

export type EvidenceNode = z.infer<typeof EvidenceNodeSchema>;

export const EvidenceEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relationship: z.string(), // e.g. "CORROBORATES", "VERIFIES", "PROBES", "CONTRADICTS"
});

export type EvidenceEdge = z.infer<typeof EvidenceEdgeSchema>;

export const EvidenceGraphSchema = z.object({
  nodes: z.array(EvidenceNodeSchema).default([]),
  edges: z.array(EvidenceEdgeSchema).default([]),
});

export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>;

export const CompetencyGapSchema = z.object({
  competency: z.string(),
  importance: z.enum(['MANDATORY', 'MUST_HAVE', 'HIGH', 'PREFERRED', 'GOOD_TO_HAVE', 'OPTIONAL']),
  status: EvidenceGapStatusEnum,
  evidenceSources: z.array(EvidenceSourceTypeEnum).default([]),
  provenance: z.array(ProvenanceRecordSchema).default([]),
  verificationDepthNeeded: z.enum(['BASIC', 'DEEP', 'NONE']).default('BASIC'),
  reasoning: z.string().default(''),
});

export type CompetencyGap = z.infer<typeof CompetencyGapSchema>;

export const VerifiedClaimSchema = z.object({
  id: z.string(),
  claimText: z.string(),
  category: z.string(), // "PERFORMANCE", "SCALE", "OWNERSHIP", "ARCHITECTURE"
  status: EvidenceGapStatusEnum,
  resumeQuote: z.string(),
  githubCorroboration: z.string().optional(),
  interviewEvidence: z.string().optional(),
  verificationNotes: z.string().default(''),
});

export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;

export const ContradictionRecordSchema = z.object({
  id: z.string(),
  type: ContradictionTypeEnum,
  severity: ContradictionSeverityEnum,
  sources: z.array(EvidenceSourceTypeEnum),
  sourceReferences: z.array(z.string()),
  explanation: z.string(),
  requiresHumanReview: z.boolean().default(false),
});

export type ContradictionRecord = z.infer<typeof ContradictionRecordSchema>;

export const FlagshipProjectArchitectureSchema = z.object({
  repoName: z.string(),
  url: z.string(),
  primaryLanguage: z.string(),
  architectureType: z.string(),
  primaryPurpose: z.string(),
  endToEndArchitecture: z.string(),
  keyTechnologies: z.array(z.string()).default([]),
  designPatterns: z.array(z.string()).default([]),
  hasTests: z.boolean().default(false),
  hasDocker: z.boolean().default(false),
  hasCiCd: z.boolean().default(false),
  codeMaturity: z.enum(['PROTOTYPE', 'SOLID_INDIVIDUAL_PROJECT', 'PRODUCTION_GRADE', 'LIBRARY_FRAMEWORK']).default('SOLID_INDIVIDUAL_PROJECT'),
  verifiedArchitecturalDecisions: z.array(z.string()).default([]),
});

export type FlagshipProjectArchitecture = z.infer<typeof FlagshipProjectArchitectureSchema>;

export const ArchitecturalProbeSchema = z.object({
  repoName: z.string(),
  question: z.string(),
  rationale: z.string(),
  targetedSkill: z.string(),
});

export type ArchitecturalProbe = z.infer<typeof ArchitecturalProbeSchema>;

export const VerifiedTechnologySchema = z.object({
  technology: z.string(),
  repos: z.array(z.string()).default([]),
  depth: z.enum(['CORE_DEPENDENCY', 'UTILITY', 'INFRASTRUCTURE']).default('CORE_DEPENDENCY'),
});

export type VerifiedTechnology = z.infer<typeof VerifiedTechnologySchema>;

export const CanonicalGitHubSummarySchema = z.object({
  username: z.string(),
  profileUrl: z.string(),
  totalPublicRepos: z.number().default(0),
  analyzedRepoCount: z.number().default(0),
  primaryArchetype: z.string(),
  executiveSummary: z.string(),
  flagshipProjects: z.array(FlagshipProjectArchitectureSchema).default([]),
  verifiedTechnologies: z.array(VerifiedTechnologySchema).default([]),
  architecturalStrengths: z.array(z.string()).default([]),
  engineeringGaps: z.array(z.string()).default([]),
  suggestedArchitectureProbes: z.array(ArchitecturalProbeSchema).default([]),
  generatedAt: z.string().default(() => new Date().toISOString()),
});

export type CanonicalGitHubSummary = z.infer<typeof CanonicalGitHubSummarySchema>;

export const GitHubRepoAnalysisSchema = z.object({
  repoName: z.string(),
  description: z.string().default(''),
  language: z.string().default(''),
  stars: z.number().default(0),
  relevantTechnologies: z.array(z.string()).default([]),
  readmeSummary: z.string().default(''),
  keySourceFiles: z.array(z.string()).default([]),
  relevanceScore: z.number().default(0),
  hasPromptInjectionAttempt: z.boolean().default(false),
  architectureType: z.string().optional(),
  detectedDependencies: z.array(z.string()).default([]),
  hasTests: z.boolean().default(false),
  hasDocker: z.boolean().default(false),
  hasCiCd: z.boolean().default(false),
  structureHighlights: z.array(z.string()).default([]),
});

export type GitHubRepoAnalysis = z.infer<typeof GitHubRepoAnalysisSchema>;

export const GitHubProfileAnalysisSchema = z.object({
  username: z.string(),
  profileUrl: z.string(),
  publicRepoCount: z.number().default(0),
  analyzedRepos: z.array(GitHubRepoAnalysisSchema).default([]),
  topTechnologies: z.array(z.string()).default([]),
  analysisTimestamp: z.string(),
  canonicalSummary: CanonicalGitHubSummarySchema.optional(),
});

export type GitHubProfileAnalysis = z.infer<typeof GitHubProfileAnalysisSchema>;

export const AIFluencyEvaluationSchema = z.object({
  aiUsageAwareness: z.string().default('Not evaluated'),
  verificationDiscipline: z.string().default('Not evaluated'), // Identifying hallucinated APIs / insecure code
  aiDebuggingScore: z.number().min(0).max(10).default(5),
  evidenceQuotes: z.array(z.string()).default([]),
  confidence: z.number().default(0.8),
  reasoning: z.string().default(''),
});

export type AIFluencyEvaluation = z.infer<typeof AIFluencyEvaluationSchema>;

export const QuestionGuardrailResultSchema = z.object({
  isValid: z.boolean(),
  rejectionReason: z.string().optional(),
  competency: z.string(),
  purpose: z.string(),
  sourceContext: z.string(),
});

export type QuestionGuardrailResult = z.infer<typeof QuestionGuardrailResultSchema>;
