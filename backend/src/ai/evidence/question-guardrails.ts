import { QuestionGuardrailResult } from './evidence-types';

export class QuestionGuardrailValidator {
  /**
   * Deterministic 8-Point Validation Filter for generated interview questions.
   * LLMs generate wording, but deterministic code validates whether the question is permitted.
   */
  static validateQuestion(params: {
    questionText: string;
    targetCompetency: string;
    purpose: string;
    sourceContext: string;
    previousQuestions: string[];
    jobLevel?: string;
    timeRemainingMinutes?: number;
  }): QuestionGuardrailResult {
    const {
      questionText,
      targetCompetency,
      purpose,
      sourceContext,
      previousQuestions,
      jobLevel = 'MID_LEVEL',
      timeRemainingMinutes = 30,
    } = params;

    const qLower = questionText.toLowerCase().trim();

    // 1. Known Competency Check
    if (!targetCompetency || targetCompetency.trim() === '') {
      return { isValid: false, rejectionReason: 'Target competency is missing', competency: '', purpose, sourceContext };
    }

    // 2. Clear Purpose Check
    if (!purpose || purpose.trim() === '') {
      return { isValid: false, rejectionReason: 'Question purpose is unspecified', competency: targetCompetency, purpose: '', sourceContext };
    }

    // 3. Valid Evidence Source or JD Requirement Check
    if (!sourceContext || sourceContext.trim() === '') {
      return { isValid: false, rejectionReason: 'Question source context is missing', competency: targetCompetency, purpose, sourceContext: '' };
    }

    // 4. Relevance Check (Must not be trivial or empty text)
    if (questionText.length < 15) {
      return { isValid: false, rejectionReason: 'Question text is too short or trivial', competency: targetCompetency, purpose, sourceContext };
    }

    // 5. Duplicate Coverage Check (Prevent asking similar questions repeatedly)
    const isDuplicate = previousQuestions.some((prev) => {
      const pLower = prev.toLowerCase();
      // Match exact text or significant keyword overlap
      if (pLower === qLower) return true;

      // Extract major words (length > 4)
      const qWords = qLower.split(/\W+/).filter((w) => w.length > 4);
      const pWords = pLower.split(/\W+/).filter((w) => w.length > 4);
      const overlap = qWords.filter((w) => pWords.includes(w));

      return qWords.length > 0 && overlap.length / qWords.length >= 0.75;
    });

    if (isDuplicate) {
      return { isValid: false, rejectionReason: `Duplicate or high overlap with previously asked question`, competency: targetCompetency, purpose, sourceContext };
    }

    // 6. Seniority / Depth Appropriateness
    if (jobLevel === 'SENIOR' || jobLevel === 'LEAD') {
      if (qLower.startsWith('what is ') || qLower.startsWith('define ')) {
        return { isValid: false, rejectionReason: 'Definitional "What is X" questions are rejected for Senior/Lead roles in favor of architectural trade-off probes', competency: targetCompetency, purpose, sourceContext };
      }
    }

    // 7. Time Constraint Check
    if (timeRemainingMinutes <= 2 && (purpose.includes('SYSTEM_DESIGN') || purpose.includes('ARCHITECTURE'))) {
      return { isValid: false, rejectionReason: 'Insufficient time remaining for a lengthy system design exploration', competency: targetCompetency, purpose, sourceContext };
    }

    // 8. Supported Assumptions Check (Must not assume candidate lied)
    if (qLower.includes('why did you lie') || qLower.includes('you lied') || qLower.includes('fake experience')) {
      return { isValid: false, rejectionReason: 'Accusatory or non-neutral language is strictly forbidden', competency: targetCompetency, purpose, sourceContext };
    }

    return {
      isValid: true,
      competency: targetCompetency,
      purpose,
      sourceContext,
    };
  }
}
