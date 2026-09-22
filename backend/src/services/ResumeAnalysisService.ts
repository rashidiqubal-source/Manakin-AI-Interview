import crypto from 'crypto';
import {
  ResumeParser,
  ResumeAnalyzer,
  CanonicalNormalizedResume,
} from '../ai';
import { logger } from '../config/logger';

export interface EnhancedResumeAnalysisResult {
  rawContent: string;
  aiSummary: string;
  aiAnalysis: {
    candidateName?: string;
    candidateEmail?: string;
    skills: string[];
    experience: Array<{ company: string; role: string; duration?: string; highlights?: string[] }>;
    education: string[];
    strengths: string[];
    potentialGaps: string[];
  };
  normalizedResume: CanonicalNormalizedResume;
  contentHash: string;
}

export class ResumeAnalysisService {
  /**
   * Generates a SHA-256 hash of resume raw content for change detection & caching.
   */
  static computeContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Delegates PDF text extraction to ResumeParser.
   */
  static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    return await ResumeParser.extractTextFromPDF(pdfBuffer);
  }

  /**
   * Formats CanonicalNormalizedResume into backward-compatible aiAnalysis & aiSummary structures.
   */
  private static formatResult(
    rawContent: string,
    normalizedResume: CanonicalNormalizedResume
  ): EnhancedResumeAnalysisResult {
    const skillsList = normalizedResume.skills.map((s) => s.name);

    const experienceList = normalizedResume.experience.map((exp) => ({
      company: exp.company,
      role: exp.role,
      duration: exp.duration,
      highlights: exp.highlights,
    }));

    const educationList = normalizedResume.education.map(
      (edu) => `${edu.degree} - ${edu.institution} (${edu.graduationYear || 'N/A'})`
    );

    const strengths = [
      ...normalizedResume.achievements.map((a) => a.title),
      ...normalizedResume.skills.filter((s) => s.proficiency === 'ADVANCED' || s.proficiency === 'EXPERT').map((s) => `${s.name} mastery`),
    ];

    const aiSummary = normalizedResume.summary ||
      `Candidate ${normalizedResume.profile.name || ''} with expertise in ${skillsList.slice(0, 5).join(', ')}.`;

    const aiAnalysis = {
      candidateName: normalizedResume.profile.name,
      candidateEmail: normalizedResume.profile.email,
      skills: skillsList.length > 0 ? skillsList : ['General Technical Expertise'],
      experience: experienceList,
      education: educationList,
      strengths: strengths.length > 0 ? strengths : ['Technical background'],
      potentialGaps: [],
    };

    return {
      rawContent,
      aiSummary,
      aiAnalysis,
      normalizedResume,
      contentHash: this.computeContentHash(rawContent),
    };
  }

  /**
   * Extracts text from PDF or DOCX buffer.
   */
  static async extractText(buffer: Buffer, originalName?: string): Promise<string> {
    return await ResumeParser.extractText(buffer, originalName);
  }

  /**
   * Analyzes an applicant resume PDF or DOCX buffer, extracts text, cleans it, and runs AI extraction with evidence preservation.
   */
  static async analyzeResume(buffer: Buffer, originalName?: string): Promise<EnhancedResumeAnalysisResult> {
    try {
      const { rawContent, normalizedResume } = await ResumeAnalyzer.analyzeResumeBuffer(buffer, originalName);
      return this.formatResult(rawContent, normalizedResume);
    } catch (error: any) {
      logger.error(`[ResumeAnalysisService] Failed to analyze resume: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyzes raw resume text directly (useful for tests and text-based resume inputs).
   */
  static async analyzeResumeText(rawText: string): Promise<EnhancedResumeAnalysisResult> {
    try {
      const cleaned = ResumeParser.cleanExtractedText(rawText);
      const normalizedResume = await ResumeAnalyzer.analyzeResumeText(cleaned);
      return this.formatResult(cleaned, normalizedResume);
    } catch (error: any) {
      logger.error(`[ResumeAnalysisService] Failed to analyze resume text: ${error.message}`);
      throw error;
    }
  }
}
