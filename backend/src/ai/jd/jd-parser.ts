import {
  CanonicalNormalizedJD,
  CanonicalNormalizedJDSchema,
} from './jd-schema';
import { PromptRunner } from '../core/prompt-runner';
import {
  QUICK_PASTE_PARSER_SYSTEM_PROMPT,
  QUICK_PASTE_RULES,
  QUICK_PASTE_SCHEMA_DESCRIPTION,
} from './jd-prompts';
import { categorizeSkill } from './jd-normalizer';

interface QuickPasteInput {
  title: string;
  rawContent: string;
}

export class JDParser {
  /**
   * Rule-based fallback parser if AI inference fails or is offline
   */
  private static generateFallback(input: QuickPasteInput): CanonicalNormalizedJD {
    const lines = input.rawContent.split('\n').map((l) => l.trim()).filter(Boolean);
    const title = input.title || (lines[0] ? lines[0].substring(0, 60) : 'Job Position');

    // Simple regex extraction for experience
    const expMatch = input.rawContent.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:\+)?\s*years?/i);
    const minYears = expMatch ? parseInt(expMatch[1], 10) : 0;
    const maxYears = expMatch && expMatch[2] ? parseInt(expMatch[2], 10) : null;

    // Common skill keywords scan
    const techKeywords = [
      'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'C#',
      'React', 'Next.js', 'Vue', 'Angular', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
      'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'REST API', 'GraphQL', 'System Design'
    ];

    const detectedSkills = techKeywords.filter((tech) =>
      new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i').test(input.rawContent)
    );

    const requiredSkills = detectedSkills.slice(0, 6).map((name) => ({
      name,
      category: categorizeSkill(name),
      importance: 'MUST_HAVE' as const,
      proficiency: 'INTERMEDIATE' as const,
      source: { type: 'QUICK_PASTE' as const, textEvidence: `Matched ${name} in text` },
    }));

    const preferredSkills = detectedSkills.slice(6).map((name) => ({
      name,
      category: categorizeSkill(name),
      importance: 'PREFERRED' as const,
      proficiency: 'INTERMEDIATE' as const,
      source: { type: 'QUICK_PASTE' as const, textEvidence: `Matched ${name} in text` },
    }));

    const responsibilities = lines
      .filter((l) => /^[•\-\*]/.test(l) || /responsible|develop|build|design|maintain/i.test(l))
      .slice(0, 5)
      .map((desc) => ({
        description: desc.replace(/^[•\-\*]\s*/, ''),
        priority: 'HIGH' as const,
        source: { type: 'QUICK_PASTE' as const, textEvidence: desc },
      }));

    return CanonicalNormalizedJDSchema.parse({
      job: {
        title,
        department: 'Engineering',
        level: title.toLowerCase().includes('senior') ? 'SENIOR' : title.toLowerCase().includes('lead') ? 'LEAD' : 'MID_LEVEL',
        employmentType: 'FULL_TIME',
        openings: 1,
        workMode: input.rawContent.toLowerCase().includes('remote') ? 'REMOTE' : input.rawContent.toLowerCase().includes('hybrid') ? 'HYBRID' : 'ON_SITE',
        location: 'Remote',
        joiningDate: null,
      },
      role: {
        summary: lines.slice(0, 3).join(' '),
        description: input.rawContent,
        hiringReason: 'NEW_POSITION',
      },
      responsibilities: responsibilities.length > 0 ? responsibilities : [
        {
          description: `Core responsibilities for ${title}`,
          priority: 'HIGH' as const,
          source: { type: 'QUICK_PASTE' as const, textEvidence: title },
        },
      ],
      requiredSkills: requiredSkills.length > 0 ? requiredSkills : [
        {
          name: 'Problem Solving',
          category: 'GENERAL',
          importance: 'MUST_HAVE' as const,
          proficiency: 'INTERMEDIATE' as const,
          source: { type: 'QUICK_PASTE' as const, textEvidence: 'Standard competency' },
        },
      ],
      preferredSkills,
      experience: {
        minimumYears: minYears,
        maximumYears: maxYears,
        industryExperience: [],
        freshersAllowed: minYears === 0,
        fresherRequirements: [],
        source: { type: 'QUICK_PASTE' as const, textEvidence: expMatch ? expMatch[0] : 'Experience mentioned' },
      },
      education: {
        minimumLevel: input.rawContent.toLowerCase().includes('bachelor') ? 'BACHELORS' : input.rawContent.toLowerCase().includes('master') ? 'MASTERS' : 'BACHELORS',
        degrees: ['Computer Science or related'],
        minimumCGPA: null,
        certifications: [],
        source: { type: 'QUICK_PASTE' as const, textEvidence: 'Standard education' },
      },
      candidateQualities: {
        behavioral: ['Problem Solving', 'Ownership', 'Communication'],
        languages: ['English'],
        source: { type: 'QUICK_PASTE' as const, textEvidence: 'General qualities' },
      },
      logistics: {
        shiftRequirements: [],
        relocationRequired: false,
        workMode: 'HYBRID',
        location: 'Remote',
        joiningDate: null,
        source: { type: 'QUICK_PASTE' as const },
      },
      interviewRequirements: {
        technical: true,
        coding: true,
        systemDesign: title.toLowerCase().includes('senior') || title.toLowerCase().includes('lead'),
        behavioral: true,
        domainKnowledge: false,
        source: { type: 'QUICK_PASTE' as const },
      },
      interviewDimensions: [],
    });
  }

  /**
   * Parses Quick-Paste raw JD text using AI into the Canonical Normalized JD Schema.
   */
  static async parseQuickPasteJD(rawContent: string, jobTitle?: string): Promise<CanonicalNormalizedJD> {
    const input: QuickPasteInput = {
      title: (jobTitle || '').trim(),
      rawContent: (rawContent || '').trim(),
    };

    return await PromptRunner.execute(
      {
        name: 'QuickPasteJDParser',
        systemInstruction: QUICK_PASTE_PARSER_SYSTEM_PROMPT,
        rules: QUICK_PASTE_RULES,
        outputSchema: CanonicalNormalizedJDSchema,
        schemaDescription: QUICK_PASTE_SCHEMA_DESCRIPTION,
        fallbackGenerator: this.generateFallback,
      },
      input,
      (inp) => `
Job Title (if provided by recruiter): "${inp.title || 'Not specified'}"

Raw Job Description Text:
"""
${inp.rawContent}
"""

Extract and return the canonical normalized JD JSON strictly conforming to the schema.
`
    );
  }
}
