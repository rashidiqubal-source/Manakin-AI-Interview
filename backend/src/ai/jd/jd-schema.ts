import { z } from 'zod';

export const RequirementSourceSchema = z.object({
  type: z.enum(['RECRUITER_FORM', 'QUICK_PASTE', 'AI_INFERRED']),
  step: z.number().optional(),
  textEvidence: z.string().optional(),
});

export type RequirementSource = z.infer<typeof RequirementSourceSchema>;

export const SemanticImportanceEnum = z.enum([
  'MANDATORY',
  'MUST_HAVE',
  'PREFERRED',
  'GOOD_TO_HAVE',
  'OPTIONAL',
  'INFORMATIONAL',
  'LOGISTICAL',
]);

export type SemanticImportance = z.infer<typeof SemanticImportanceEnum>;

export const SkillProficiencyEnum = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'EXPERT',
  'UNKNOWN',
]);

export type SkillProficiency = z.infer<typeof SkillProficiencyEnum>;

export const JobIdentitySchema = z.object({
  title: z.string(),
  department: z.string().nullable().optional().transform((v) => v || 'Engineering'),
  level: z.string().nullable().optional().transform((v) => (v ? v.toUpperCase() : 'MID_LEVEL')),
  employmentType: z.string().nullable().optional().transform((v) => (v ? v.toUpperCase() : 'FULL_TIME')),
  openings: z.number().nullable().optional().transform((v) => v ?? 1),
  workMode: z.string().nullable().optional().transform((v) => (v ? v.toUpperCase() : 'HYBRID')),
  location: z.string().nullable().optional().transform((v) => v || 'Remote'),
  joiningDate: z.string().nullable().optional(),
});

export const RoleScopeSchema = z.object({
  summary: z.string().nullable().optional().transform((v) => v || ''),
  description: z.string().nullable().optional().transform((v) => v || ''),
  hiringReason: z.string().nullable().optional().transform((v) => (v ? v.toUpperCase() : 'NEW_POSITION')),
});

export const ResponsibilityItemSchema = z.object({
  description: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW', 'MANDATORY']).default('HIGH'),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const RequiredSkillSchema = z.object({
  name: z.string(),
  category: z.string().default('GENERAL'),
  importance: z.enum(['MUST_HAVE', 'MANDATORY']).default('MUST_HAVE'),
  proficiency: SkillProficiencyEnum.default('INTERMEDIATE'),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const PreferredSkillSchema = z.object({
  name: z.string(),
  category: z.string().default('GENERAL'),
  importance: z.enum(['PREFERRED', 'GOOD_TO_HAVE', 'OPTIONAL']).default('PREFERRED'),
  proficiency: SkillProficiencyEnum.default('INTERMEDIATE'),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const ExperienceRequirementsSchema = z.object({
  minimumYears: z.number().default(0),
  maximumYears: z.number().nullable().optional(),
  industryExperience: z.array(z.string()).default([]),
  freshersAllowed: z.boolean().default(false),
  fresherRequirements: z.array(z.string()).default([]),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const EducationRequirementsSchema = z.object({
  minimumLevel: z.string().default('BACHELORS'),
  degrees: z.array(z.string()).default([]),
  minimumCGPA: z.string().nullable().optional(),
  certifications: z.array(z.string()).default([]),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const CandidateQualitiesSchema = z.object({
  behavioral: z.array(z.string()).default([]),
  languages: z.array(z.string()).default(['English']),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const LogisticsRequirementsSchema = z.object({
  shiftRequirements: z.array(z.string()).default([]),
  relocationRequired: z.boolean().default(false),
  workMode: z.string().default('HYBRID'),
  location: z.string().default('Remote'),
  joiningDate: z.string().nullable().optional(),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const InterviewRequirementsSchema = z.object({
  technical: z.boolean().default(true),
  coding: z.boolean().default(true),
  systemDesign: z.boolean().default(false),
  behavioral: z.boolean().default(true),
  domainKnowledge: z.boolean().default(false),
  source: RequirementSourceSchema.default({ type: 'AI_INFERRED' }),
});

export const InterviewDimensionSchema = z.object({
  skill: z.string(),
  category: z.string().default('TECHNICAL'),
  importance: z.string().default('MUST_HAVE'),
  testAreas: z.array(z.string()).default([]),
  sampleProbes: z.array(z.string()).default([]),
});

export type InterviewDimension = z.infer<typeof InterviewDimensionSchema>;

export const CanonicalNormalizedJDSchema = z.object({
  job: JobIdentitySchema,
  role: RoleScopeSchema,
  responsibilities: z.array(ResponsibilityItemSchema).default([]),
  requiredSkills: z.array(RequiredSkillSchema).default([]),
  preferredSkills: z.array(PreferredSkillSchema).default([]),
  experience: ExperienceRequirementsSchema,
  education: EducationRequirementsSchema,
  candidateQualities: CandidateQualitiesSchema,
  logistics: LogisticsRequirementsSchema,
  interviewRequirements: InterviewRequirementsSchema,
  interviewDimensions: z.array(InterviewDimensionSchema).default([]),
});

export type CanonicalNormalizedJD = z.infer<typeof CanonicalNormalizedJDSchema>;

export const InterviewBlueprintSchema = z.object({
  roleTitle: z.string(),
  roleOverview: z.string().default(''),
  interviewDimensions: z.array(InterviewDimensionSchema),
  recommendedFocusAreas: z.array(z.string()).default([]),
  codingRequired: z.boolean().default(true),
  systemDesignRequired: z.boolean().default(false),
  behavioralRequired: z.boolean().default(true),
  domainFocus: z.array(z.string()).default([]),
});

export type InterviewBlueprint = z.infer<typeof InterviewBlueprintSchema>;
