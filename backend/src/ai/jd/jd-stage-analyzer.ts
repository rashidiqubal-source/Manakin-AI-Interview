import { AIClient } from '../core/ai-client';
import { parseClarificationQuestions, ClarificationQuestion } from './jd-question-parser';
import { logger } from '../../config/logger';

export interface StructuredJD {
  role: string;
  seniority: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
  technical_competencies: string[];
  experience_requirements: {
    minimumYears?: number;
    description?: string;
  };
  domain_knowledge: string[];
  evaluation_criteria: string[];
  critical_requirements: string[];
}

export interface Stage1AnalysisResult {
  structuredJD: StructuredJD;
  questions: ClarificationQuestion[];
  questionCount: number;
  needsClarification: boolean;
  rawClarificationText: string;
}

export class JDStageAnalyzer {
  /**
   * CALL 1: Analyzes extracted Markdown JD and determines whether clarification questions are needed.
   */
  static async analyzeMarkdownJD(markdownContent: string): Promise<Stage1AnalysisResult> {
    const prompt = `You are a senior talent acquisition engineer. Analyze the following Job Description (Markdown).

Task:
1. Extract a structured JSON representation of the Job Description with these exact keys:
   - role (string)
   - seniority (string: e.g., Junior, Mid, Senior, Lead)
   - must_have_skills (array of strings, ONLY mandatory required skills)
   - nice_to_have_skills (array of strings, optional/preferred skills)
   - responsibilities (array of strings)
   - technical_competencies (array of strings)
   - experience_requirements (object with optional minimumYears number and description string)
   - domain_knowledge (array of strings)
   - evaluation_criteria (array of strings)
   - critical_requirements (array of strings)

2. Clarification Questions Assessment:
   Determine if important information in the JD is ambiguous or missing (e.g. mandatory vs preferred tech, minimum experience, key role responsibilities).
   - If sufficiently clear: return NO clarification questions.
   - If ambiguous: generate ALL necessary clarification questions.
   - Questions MUST be returned in the "clarification_questions" property as a single string where each question is on a separate line formatted exactly as:
     1. Question text
     2. Question text
     3. Question text

JOB DESCRIPTION MARKDOWN:
"""
${markdownContent}
"""

Return valid JSON with keys "structured_jd" and "clarification_questions" (string or empty string).`;

    const responseText = await AIClient.getCompletion([
      { role: 'system', content: 'You extract structured JDs and identify ambiguity.' },
      { role: 'user', content: prompt },
    ]);

    const cleaned = AIClient.cleanJsonText(responseText);
    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      logger.error(`[JDStageAnalyzer] Failed to parse Stage 1 JSON: ${e.message}`);
    }

    const structuredJD: StructuredJD = {
      role: parsed.structured_jd?.role || 'Software Engineer',
      seniority: parsed.structured_jd?.seniority || 'Mid Level',
      must_have_skills: Array.isArray(parsed.structured_jd?.must_have_skills) ? parsed.structured_jd.must_have_skills : [],
      nice_to_have_skills: Array.isArray(parsed.structured_jd?.nice_to_have_skills) ? parsed.structured_jd.nice_to_have_skills : [],
      responsibilities: Array.isArray(parsed.structured_jd?.responsibilities) ? parsed.structured_jd.responsibilities : [],
      technical_competencies: Array.isArray(parsed.structured_jd?.technical_competencies) ? parsed.structured_jd.technical_competencies : [],
      experience_requirements: parsed.structured_jd?.experience_requirements || { minimumYears: 0 },
      domain_knowledge: Array.isArray(parsed.structured_jd?.domain_knowledge) ? parsed.structured_jd.domain_knowledge : [],
      evaluation_criteria: Array.isArray(parsed.structured_jd?.evaluation_criteria) ? parsed.structured_jd.evaluation_criteria : [],
      critical_requirements: Array.isArray(parsed.structured_jd?.critical_requirements) ? parsed.structured_jd.critical_requirements : [],
    };

    const rawClarificationText = parsed.clarification_questions || '';
    const parsedQuestionsResult = parseClarificationQuestions(rawClarificationText);

    return {
      structuredJD,
      questions: parsedQuestionsResult.questions,
      questionCount: parsedQuestionsResult.questionCount,
      needsClarification: parsedQuestionsResult.questionCount > 0,
      rawClarificationText,
    };
  }

  /**
   * CALL 2: Finalizes Structured JD by applying Recruiter's clarification answers in ONE step.
   */
  static async finalizeStructuredJD(
    initialJD: StructuredJD,
    questions: ClarificationQuestion[],
    answers: Array<{ number: number; answer: string }>
  ): Promise<StructuredJD> {
    const formattedQA = questions.map((q) => {
      const ansObj = answers.find((a) => a.number === q.number);
      return `Q${q.number}: ${q.text}\nAnswer: ${ansObj ? ansObj.answer : 'No answer provided'}`;
    }).join('\n\n');

    const prompt = `You are a senior talent acquisition engineer. Update and finalize the Structured Job Description based on the recruiter's explicit clarification answers.

INITIAL STRUCTURED JD:
${JSON.stringify(initialJD, null, 2)}

RECRUITER CLARIFICATION ANSWERS:
"""
${formattedQA}
"""

Task:
Produce the FINAL structured JD JSON matching this schema:
{
  "role": string,
  "seniority": string,
  "must_have_skills": string[],
  "nice_to_have_skills": string[],
  "responsibilities": string[],
  "technical_competencies": string[],
  "experience_requirements": { "minimumYears": number, "description": string },
  "domain_knowledge": string[],
  "evaluation_criteria": string[],
  "critical_requirements": string[]
}

Rules:
1. The recruiter's answers override or clarify any previous ambiguity.
2. Do not invent information not stated in the JD or recruiter answers.
3. Return raw JSON only.`;

    const responseText = await AIClient.getCompletion([
      { role: 'system', content: 'You finalize structured JDs based on recruiter clarifications.' },
      { role: 'user', content: prompt },
    ]);

    const cleaned = AIClient.cleanJsonText(responseText);
    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      logger.error(`[JDStageAnalyzer] Failed to parse Stage 2 Final JSON: ${e.message}`);
    }

    return {
      role: parsed.role || initialJD.role,
      seniority: parsed.seniority || initialJD.seniority,
      must_have_skills: Array.isArray(parsed.must_have_skills) ? parsed.must_have_skills : initialJD.must_have_skills,
      nice_to_have_skills: Array.isArray(parsed.nice_to_have_skills) ? parsed.nice_to_have_skills : initialJD.nice_to_have_skills,
      responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : initialJD.responsibilities,
      technical_competencies: Array.isArray(parsed.technical_competencies) ? parsed.technical_competencies : initialJD.technical_competencies,
      experience_requirements: parsed.experience_requirements || initialJD.experience_requirements,
      domain_knowledge: Array.isArray(parsed.domain_knowledge) ? parsed.domain_knowledge : initialJD.domain_knowledge,
      evaluation_criteria: Array.isArray(parsed.evaluation_criteria) ? parsed.evaluation_criteria : initialJD.evaluation_criteria,
      critical_requirements: Array.isArray(parsed.critical_requirements) ? parsed.critical_requirements : initialJD.critical_requirements,
    };
  }
}
