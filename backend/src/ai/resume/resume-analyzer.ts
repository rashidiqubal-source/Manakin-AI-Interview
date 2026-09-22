import {
  CanonicalNormalizedResume,
  CanonicalNormalizedResumeSchema,
} from './resume-schema';
import { ResumeParser } from './resume-parser';
import { ResumeNormalizer } from './resume-normalizer';
import { PromptRunner } from '../core/prompt-runner';
import {
  RESUME_ANALYZER_SYSTEM_PROMPT,
  RESUME_ANALYZER_RULES,
  RESUME_SCHEMA_DESCRIPTION,
} from './resume-prompts';

interface ResumeAnalysisInput {
  cleanedText: string;
  detectedEmail: string | null;
  detectedPhone: string | null;
  detectedLinks: string[];
}

export class ResumeAnalyzer {
  /**
   * Deterministic fallback generator if AI inference fails or is offline.
   */
  private static generateFallback(input: ResumeAnalysisInput): CanonicalNormalizedResume {
    const lines = input.cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
    const candidateName = lines[0] ? lines[0].substring(0, 50).replace(/[^a-zA-Z\s]/g, '').trim() : 'Candidate';

    const techKeywords = [
      'JavaScript', 'TypeScript', 'Node.js', 'Python', 'Java', 'React', 'Next.js',
      'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'REST API',
      'GraphQL', 'SQL', 'Git', 'Linux', 'Tailwind CSS', 'Express.js', 'C++', 'Go'
    ];

    const detectedSkills = techKeywords
      .filter((tech) => {
        const safePattern = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^a-zA-Z0-9_])${safePattern}(?:$|[^a-zA-Z0-9_])`, 'i').test(input.cleanedText);
      })
      .map((name) => {
        const safePattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`(?:^|[^a-zA-Z0-9_])${safePattern}(?:$|[^a-zA-Z0-9_])`, 'i');
        const evidenceLine = lines.find((l) => reg.test(l)) || `Mentioned ${name} in resume`;
        return {
          name,
          category: 'GENERAL',
          proficiency: 'UNKNOWN' as const,
          evidence: [evidenceLine],
          source: 'SKILLS_SECTION' as const,
          confidence: 0.85,
        };
      });

    const eduLine = lines.find((l) => /bachelor|master|b\.s|b\.tech|degree|university|kiit|college/i.test(l)) || 'Higher Education listed';
    const rawScoreLine = lines.find((l) => /cgpa|gpa|percentage|%|marks|grade/i.test(l)) || null;

    const rawFacts = {
      profile: {
        name: candidateName,
        email: input.detectedEmail || '',
        phone: input.detectedPhone,
        location: null,
        links: input.detectedLinks,
      },
      summary: lines.slice(1, 4).join(' ') || `Professional software engineering profile for ${candidateName}`,
      education: [
        {
          degree: eduLine.includes('B.Tech') ? 'B.Tech' : eduLine.includes('B.S') ? 'B.S.' : 'Bachelor of Science',
          major: eduLine.includes('Computer Science') ? 'Computer Science' : 'Computer Science or related IT',
          institution: eduLine,
          graduationYear: null,
          gpa: rawScoreLine,
          academicScore: rawScoreLine ? ResumeNormalizer.normalizeAcademicScore(rawScoreLine) : undefined,
          honors: [],
          evidence: eduLine,
        },
      ],
      experience: [
        {
          company: 'Software Engineering Experience',
          role: 'Software Engineer',
          location: '',
          duration: 'Experience Listed',
          current: false,
          highlights: lines.slice(4, 8),
          technologies: detectedSkills.map((s) => s.name),
          measurableAchievements: [],
          evidence: lines.slice(4, 8),
        },
      ],
      skills: detectedSkills,
      projects: [],
      certifications: [],
      achievements: [],
      technologies: detectedSkills.map((s) => s.name),
      domains: [],
    };

    return ResumeNormalizer.normalize(rawFacts, input.cleanedText);
  }

  /**
   * Executes ONE single structured LLM extraction call, followed by deterministic code normalization.
   * PARSER = extracts text
   * LLM = understands meaning
   * CODE = normalizes + validates + deduplicates
   */
  static async analyzeResumeText(rawText: string): Promise<CanonicalNormalizedResume> {
    const cleanedText = ResumeParser.cleanExtractedText(rawText);
    const ruleFields = ResumeParser.extractRuleBasedFields(cleanedText);
    const detectedSections = ResumeParser.detectSections(cleanedText);

    const input: ResumeAnalysisInput = {
      cleanedText,
      detectedEmail: ruleFields.detectedEmail,
      detectedPhone: ruleFields.detectedPhone,
      detectedLinks: ruleFields.detectedLinks,
    };

    // Format section summary to give LLM high-level layout guidance without multiple calls
    const sectionOverview = detectedSections
      .map((s) => `- ${s.type} (${s.heading}): ${s.content.substring(0, 150).replace(/\n/g, ' ')}...`)
      .join('\n');

    // Truncate to 12,000 characters to ensure fast, predictable LLM latency
    const truncatedText = cleanedText.substring(0, 12000);

    // ONE PRIMARY STRUCTURED LLM CALL
    const rawFacts = await PromptRunner.execute(
      {
        name: 'ResumeAnalyzerSingleCall',
        systemInstruction: RESUME_ANALYZER_SYSTEM_PROMPT,
        rules: RESUME_ANALYZER_RULES,
        outputSchema: CanonicalNormalizedResumeSchema,
        schemaDescription: RESUME_SCHEMA_DESCRIPTION,
        fallbackGenerator: this.generateFallback,
      },
      input,
      (inp) => `
Extracted Resume Text:
"""
${truncatedText}
"""

Detected Section Headings:
${sectionOverview}

Pre-detected Email: ${inp.detectedEmail || 'None detected'}
Pre-detected Phone: ${inp.detectedPhone || 'None detected'}
Pre-detected Professional Links: ${inp.detectedLinks.join(', ') || 'None detected'}

Analyze the resume in this single pass. Extract all facts, preserving verbatim evidence quotes and exact academic scores.
`
    );

    // CODE = normalizes + validates + deduplicates
    const normalized = ResumeNormalizer.normalize(rawFacts, cleanedText);

    // Final validation against canonical schema
    return CanonicalNormalizedResumeSchema.parse(normalized);
  }

  /**
   * Convenience wrapper that accepts a PDF or DOCX buffer, extracts text, and returns normalized resume.
   */
  static async analyzeResumeBuffer(
    buffer: Buffer,
    originalName?: string
  ): Promise<{
    rawContent: string;
    normalizedResume: CanonicalNormalizedResume;
  }> {
    const rawContent = await ResumeParser.extractText(buffer, originalName);
    const cleanedText = ResumeParser.cleanExtractedText(rawContent);
    const normalizedResume = await this.analyzeResumeText(cleanedText);

    return {
      rawContent: cleanedText,
      normalizedResume,
    };
  }
}
