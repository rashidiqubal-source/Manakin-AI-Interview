import crypto from 'crypto';
import {
  JDParser,
  JDNormalizer,
  JDAnalyzer,
  CanonicalNormalizedJD,
  InterviewBlueprint,
} from '../ai';
import { logger } from '../config/logger';

export interface EnhancedJDAnalysisResult {
  aiSummary: string;
  aiAnalysis: {
    title: string;
    roleSummary: string;
    keySkills: string[];
    experienceLevel: string;
    interviewFocus: string[];
    coreResponsibilities: string[];
    blueprint?: InterviewBlueprint;
  };
  normalizedJD: CanonicalNormalizedJD;
  interviewBlueprint: InterviewBlueprint;
  contentHash: string;
}

export class JDAnalysisService {
  /**
   * Generates a SHA-256 hash of JD content for change detection & caching.
   */
  static computeContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Builds backward-compatible aiAnalysis and aiSummary objects from CanonicalNormalizedJD & InterviewBlueprint.
   */
  private static formatResult(
    normalizedJD: CanonicalNormalizedJD,
    blueprint: InterviewBlueprint,
    rawContent: string
  ): EnhancedJDAnalysisResult {
    const keySkills = [
      ...normalizedJD.requiredSkills.map((s) => s.name),
      ...normalizedJD.preferredSkills.map((s) => s.name),
    ];

    const interviewFocus = blueprint.interviewDimensions.map(
      (d) => `${d.skill}: ${d.testAreas.slice(0, 2).join(', ')}`
    );

    const coreResponsibilities = normalizedJD.responsibilities.map((r) => r.description);

    const aiSummary = normalizedJD.role.summary ||
      `${normalizedJD.job.title} position in ${normalizedJD.job.department} department (${normalizedJD.job.workMode}, ${normalizedJD.job.location}). Requires ${normalizedJD.experience.minimumYears}+ years experience.`;

    const aiAnalysis = {
      title: normalizedJD.job.title,
      roleSummary: normalizedJD.role.summary,
      keySkills: keySkills.length > 0 ? keySkills : ['Communication', 'Technical Proficiency'],
      experienceLevel: normalizedJD.job.level,
      interviewFocus: interviewFocus.length > 0 ? interviewFocus : ['Core competencies', 'System architecture'],
      coreResponsibilities: coreResponsibilities.length > 0 ? coreResponsibilities : ['Fulfill role objectives'],
      blueprint,
    };

    return {
      aiSummary,
      aiAnalysis,
      normalizedJD,
      interviewBlueprint: blueprint,
      contentHash: this.computeContentHash(rawContent),
    };
  }

  /**
   * Flow 1: 9-Step Comprehensive Recruiter Form -> Canonical Normalized JD -> Interview Blueprint
   * Preserves explicit recruiter selections with zero loss or LLM re-interpretation.
   */
  static async normalizeAndAnalyzeFormJD(
    formData: Record<string, any>
  ): Promise<EnhancedJDAnalysisResult> {
    try {
      // 1. Deterministic normalization preserving explicit recruiter choices
      const normalizedJD = JDNormalizer.normalizeFromForm(formData);

      // 2. Derive Interview Blueprint
      const { blueprint, enrichedJD } = await JDAnalyzer.generateInterviewBlueprint(normalizedJD);

      const contentToHash = JSON.stringify({
        title: formData.title,
        reqSkills: formData.requiredSkills,
        prefSkills: formData.preferredSkills,
        exp: formData.minExperience,
        edu: formData.minEducation,
        resp: formData.responsibilities,
      });

      return this.formatResult(enrichedJD, blueprint, contentToHash);
    } catch (error: any) {
      logger.error(`[JDAnalysisService] Error normalizing form JD: ${error.message}`);
      throw error;
    }
  }

  /**
   * Flow 2: Quick-Paste Raw JD -> AI JD Parser -> Canonical Normalized JD -> Interview Blueprint
   * Produces the exact same Canonical Normalized JD schema as the 9-Step form.
   */
  static async analyzeQuickPasteJD(
    rawContent: string,
    jobTitle?: string
  ): Promise<EnhancedJDAnalysisResult> {
    try {
      // 1. AI Parser transforms raw text to Canonical Normalized JD
      const parsedJD = await JDParser.parseQuickPasteJD(rawContent, jobTitle);

      // 2. Derive Interview Blueprint
      const { blueprint, enrichedJD } = await JDAnalyzer.generateInterviewBlueprint(parsedJD);

      return this.formatResult(enrichedJD, blueprint, rawContent);
    } catch (error: any) {
      logger.error(`[JDAnalysisService] Error analyzing quick-paste JD: ${error.message}`);
      throw error;
    }
  }

  /**
   * Backward-compatible alias for existing callers
   */
  static async analyzeJD(rawContent: string, jobTitle?: string): Promise<any> {
    return await this.analyzeQuickPasteJD(rawContent, jobTitle);
  }
}
