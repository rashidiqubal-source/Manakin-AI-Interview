import { z } from 'zod';
import { SkillProficiencyEnum } from '../jd/jd-schema';

export const normalizeResumeSource = (val: unknown): string => {
  if (typeof val !== 'string') return 'SKILLS_SECTION';
  const u = val.toUpperCase().trim();
  if (u.includes('PROJ')) return 'PROJECT';
  if (u.includes('EXP') || u.includes('WORK') || u.includes('JOB') || u.includes('EMPLOY')) return 'EXPERIENCE';
  if (u.includes('EDU') || u.includes('DEGREE') || u.includes('UNIV')) return 'EDUCATION';
  if (u.includes('CERT')) return 'CERTIFICATION';
  if (u.includes('SKILL')) return 'SKILLS_SECTION';
  if (u.includes('INFER')) return 'INFERRED';
  return 'SKILLS_SECTION';
};

export const ResumeSkillSourceEnum = z.preprocess(
  normalizeResumeSource,
  z.enum([
    'PROJECT',
    'EXPERIENCE',
    'EDUCATION',
    'CERTIFICATION',
    'SKILLS_SECTION',
    'INFERRED',
  ])
);

export type ResumeSkillSource = z.infer<typeof ResumeSkillSourceEnum>;

export const EvidenceTypeEnum = z.enum([
  'EXPLICIT',
  'INFERRED',
  'CALCULATED',
  'UNKNOWN',
]);

export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const ProjectTypeEnum = z.enum([
  'PERSONAL',
  'ACADEMIC',
  'PROFESSIONAL',
  'OPEN_SOURCE',
  'RESEARCH',
  'FREELANCE',
  'HACKATHON',
  'UNKNOWN',
]);

export type ProjectType = z.infer<typeof ProjectTypeEnum>;

export const AcademicScoreTypeEnum = z.enum([
  'GPA',
  'CGPA',
  'PERCENTAGE',
  'MARKS',
  'GRADE',
  'UNKNOWN',
]);

export type AcademicScoreType = z.infer<typeof AcademicScoreTypeEnum>;

export const AcademicScoreSchema = z.object({
  value: z.preprocess((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return val;
  }, z.number().nullable().optional()),
  scale: z.preprocess((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return val;
  }, z.number().nullable().optional()),
  type: AcademicScoreTypeEnum.default('UNKNOWN'),
  grade: z.string().nullable().optional(),
  raw: z.string().default(''),
  evidence: z.string().default(''),
});

export type AcademicScore = z.infer<typeof AcademicScoreSchema>;

export const DateRangeSchema = z.object({
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().default(false),
  raw: z.string().default(''),
});

export type DateRange = z.infer<typeof DateRangeSchema>;

export const ResumeSkillSchema = z.object({
  name: z.string(),
  canonicalName: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  category: z.string().default('GENERAL'),
  proficiency: SkillProficiencyEnum.default('UNKNOWN'),
  yearsOfExperience: z.number().nullable().optional(),
  evidence: z.array(z.string()).default([]),
  evidenceType: EvidenceTypeEnum.optional(),
  source: ResumeSkillSourceEnum.default('SKILLS_SECTION'),
  confidence: z.number().min(0).max(1).default(0.8),
  rawText: z.string().optional(),
});

export type ResumeSkill = z.infer<typeof ResumeSkillSchema>;

export const ResumeEducationSchema = z.object({
  degree: z.string(),
  major: z.string().nullish().transform((v) => v || ''),
  institution: z.string().nullish().transform((v) => v || ''),
  graduationYear: z.string().nullable().optional(),
  gpa: z.string().nullable().optional(),
  academicScore: AcademicScoreSchema.optional(),
  honors: z.array(z.string()).default([]),
  evidence: z.string().default(''),
});

export type ResumeEducation = z.infer<typeof ResumeEducationSchema>;

export const ResumeExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string().nullish().transform((v) => v || ''),
  duration: z.string().default(''),
  dateRange: DateRangeSchema.optional(),
  current: z.boolean().default(false),
  highlights: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  measurableAchievements: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
});

export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>;

export const ResumeProjectSchema = z.object({
  name: z.string(),
  description: z.string().nullish().transform((v) => v || ''),
  role: z.string().nullish().transform((v) => v || ''),
  projectType: ProjectTypeEnum.optional(),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
  measurableAchievements: z.array(z.string()).default([]),
  liveUrl: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  evidence: z.array(z.string()).default([]),
});

export type ResumeProject = z.infer<typeof ResumeProjectSchema>;

export const ResumeCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().default(''),
  year: z.string().nullable().optional(),
  credentialId: z.string().nullable().optional(),
});

export const ResumeAchievementSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  measurableImpact: z.string().nullable().optional(),
});

export const ResumeDomainSchema = z.object({
  name: z.string(),
  evidence: z.string().default(''),
});

export const CanonicalNormalizedResumeSchema = z.object({
  profile: z.object({
    name: z.string().default(''),
    email: z.string().default(''),
    phone: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    links: z.array(z.string()).default([]),
  }),
  summary: z.string().default(''),
  education: z.array(ResumeEducationSchema).default([]),
  experience: z.array(ResumeExperienceSchema).default([]),
  skills: z.array(ResumeSkillSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  certifications: z.array(ResumeCertificationSchema).default([]),
  achievements: z.array(ResumeAchievementSchema).default([]),
  technologies: z.array(z.string()).default([]),
  domains: z.array(ResumeDomainSchema).default([]),
});

export type CanonicalNormalizedResume = z.infer<typeof CanonicalNormalizedResumeSchema>;
