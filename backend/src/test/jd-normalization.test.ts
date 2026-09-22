import { describe, it, expect } from '@jest/globals';
import {
  JDNormalizer,
  JDParser,
  JDAnalyzer,
  CanonicalNormalizedJDSchema,
} from '../ai';

describe('Recruiter Job Description Normalization & Intelligence Tests', () => {
  const sample9StepForm = {
    title: 'Senior Backend Engineer',
    department: 'Core Infrastructure',
    jobLevel: 'Senior',
    employmentType: 'Full-time',
    openings: 2,
    location: 'Bangalore',
    workMode: 'Hybrid',
    joiningDate: '2026-10-01',
    shortSummary: 'Lead backend microservices architecture',
    rawContent: 'We are expanding our high-throughput payment transaction engine.',
    positionReason: 'Business Expansion',
    responsibilities: [
      'Architect and maintain high-throughput backend APIs',
      'Optimize database queries and schema migrations',
      'Lead incident management and blameless post-mortems',
    ],
    dayToDayWork: 'Collaborate with product and infrastructure teams',
    requiredSkills: [
      { name: 'Node.js', importance: 'Must Have', proficiency: 'Advanced' },
      { name: 'PostgreSQL', importance: 'Must Have', proficiency: 'Intermediate' },
      { name: 'System Design', importance: 'Must Have', proficiency: 'Advanced' },
    ],
    minExperience: 3,
    maxExperience: 7,
    relevantExperience: '3+ years in distributed systems',
    industryExperience: 'FinTech',
    freshersAllowed: false,
    fresherRequirements: ['Projects', 'Internships'],
    minEducation: "Bachelor's",
    requiredDegree: 'Computer Science',
    cgpaRequirement: '7.0+ CGPA',
    certificationsRequired: 'AWS Certified Solutions Architect',
    preferredSkills: ['Docker', 'Redis', 'Kubernetes'],
    preferredExperience: 'Prior experience with payment gateways',
    otherPreferredSkills: 'Event-driven architecture',
    candidateQualities: 'Ownership, Problem Solving, Proactive Communication',
    languagesRequired: ['English'],
    otherRequirements: 'Willingness to participate in on-call rotations',
    isDraft: false,
  };

  describe('1. 9-Step Comprehensive Form Normalization', () => {
    it('should produce a valid Canonical Normalized JD conforming to Zod schema', () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);
      const validation = CanonicalNormalizedJDSchema.safeParse(normalized);

      expect(validation.success).toBe(true);
      expect(normalized.job.title).toBe('Senior Backend Engineer');
      expect(normalized.job.level).toBe('SENIOR');
      expect(normalized.job.workMode).toBe('HYBRID');
    });

    it('should strictly preserve recruiter-selected required skills, importance, and proficiency', () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);
      const nodeSkill = normalized.requiredSkills.find((s) => s.name === 'Node.js');

      expect(nodeSkill).toBeDefined();
      expect(nodeSkill?.importance).toBe('MUST_HAVE');
      expect(nodeSkill?.proficiency).toBe('ADVANCED');
      expect(nodeSkill?.category).toBe('BACKEND');
      expect(nodeSkill?.source.type).toBe('RECRUITER_FORM');
      expect(nodeSkill?.source.step).toBe(4);
    });

    it('should strictly preserve recruiter-selected preferred skills', () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);
      const dockerSkill = normalized.preferredSkills.find((s) => s.name === 'Docker');

      expect(dockerSkill).toBeDefined();
      expect(dockerSkill?.importance).toBe('PREFERRED');
      expect(dockerSkill?.category).toBe('DEVOPS');
      expect(dockerSkill?.source.type).toBe('RECRUITER_FORM');
      expect(dockerSkill?.source.step).toBe(7);
    });

    it('should preserve freshers requirements and experience bounds', () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);

      expect(normalized.experience.minimumYears).toBe(3);
      expect(normalized.experience.maximumYears).toBe(7);
      expect(normalized.experience.freshersAllowed).toBe(false);
      expect(normalized.experience.fresherRequirements).toContain('Projects');
      expect(normalized.experience.fresherRequirements).toContain('Internships');
      expect(normalized.experience.industryExperience).toContain('FinTech');
      expect(normalized.experience.source.step).toBe(5);
    });

    it('should preserve education requirements, degree, and certifications', () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);

      expect(normalized.education.minimumLevel).toBe('BACHELORS');
      expect(normalized.education.degrees).toContain('Computer Science');
      expect(normalized.education.minimumCGPA).toBe('7.0+ CGPA');
      expect(normalized.education.certifications).toContain('AWS Certified Solutions Architect');
      expect(normalized.education.source.step).toBe(6);
    });

    it('should preserve behavioral expectations and languages', () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);

      expect(normalized.candidateQualities.behavioral).toContain('Ownership');
      expect(normalized.candidateQualities.behavioral).toContain('Problem Solving');
      expect(normalized.candidateQualities.languages).toContain('English');
      expect(normalized.candidateQualities.source.step).toBe(8);
    });

    it('should enrich with interview blueprint dimensions via JDAnalyzer', async () => {
      const normalized = JDNormalizer.normalizeFromForm(sample9StepForm);
      const { blueprint, enrichedJD } = await JDAnalyzer.generateInterviewBlueprint(normalized);

      expect(blueprint.roleTitle).toBe('Senior Backend Engineer');
      expect(blueprint.interviewDimensions.length).toBeGreaterThan(0);

      const nodeDim = blueprint.interviewDimensions.find((d) => d.skill.toLowerCase().includes('node'));
      expect(nodeDim).toBeDefined();
      expect(nodeDim?.testAreas.length).toBeGreaterThan(0);

      expect(enrichedJD.interviewDimensions.length).toBe(blueprint.interviewDimensions.length);
    });
  });

  describe('2. Quick-Paste JD Parsing', () => {
    const rawQuickPasteText = `
Senior Backend Engineer

We are looking for a Senior Backend Engineer with 3-7 years of experience.

Requirements:
- Strong Node.js and TypeScript
- PostgreSQL
- Redis
- REST API development
- Experience designing scalable systems
- Docker is preferred
- Experience in fintech is a plus
`;

    it('should parse raw JD text into the exact same Canonical Normalized JD schema', async () => {
      const parsedJD = await JDParser.parseQuickPasteJD(rawQuickPasteText, 'Senior Backend Engineer');
      const validation = CanonicalNormalizedJDSchema.safeParse(parsedJD);

      expect(validation.success).toBe(true);
      expect(parsedJD.job.title).toBe('Senior Backend Engineer');
      expect(parsedJD.job.level).toBe('SENIOR');
    });

    it('should extract skills and distinguish required vs preferred', async () => {
      const parsedJD = await JDParser.parseQuickPasteJD(rawQuickPasteText, 'Senior Backend Engineer');

      const allSkillNames = [
        ...parsedJD.requiredSkills.map((s) => s.name.toLowerCase()),
        ...parsedJD.preferredSkills.map((s) => s.name.toLowerCase()),
      ];

      expect(allSkillNames.some((s) => s.includes('node'))).toBe(true);
      expect(allSkillNames.some((s) => s.includes('postgres'))).toBe(true);

      // Verify source evidence is recorded
      for (const skill of parsedJD.requiredSkills) {
        expect(skill.source.type).toBe('QUICK_PASTE');
        expect(skill.source.textEvidence).toBeDefined();
      }
    });

    it('should extract experience requirements from raw text', async () => {
      const parsedJD = await JDParser.parseQuickPasteJD(rawQuickPasteText, 'Senior Backend Engineer');

      expect(parsedJD.experience.minimumYears).toBe(3);
      if (parsedJD.experience.maximumYears !== null) {
        expect(parsedJD.experience.maximumYears).toBe(7);
      }
    });
  });
});
