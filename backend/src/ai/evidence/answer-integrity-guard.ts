/**
 * Answer Integrity Guard
 *
 * Deterministic, local, rule-based filter that inspects candidate interview answers
 * for prompt injection, score manipulation, evaluation overrides, and system prompt leaks.
 *
 * ZERO EXTERNAL APIS, ZERO LLM CALLS, ZERO NETWORK REQUESTS.
 */

export type IntegritySignal =
  | 'INSTRUCTION_OVERRIDE'
  | 'SCORE_MANIPULATION'
  | 'EVALUATION_MANIPULATION'
  | 'SYSTEM_PROMPT_MANIPULATION'
  | 'ROLE_PERSONA_MANIPULATION';

export interface AnswerIntegrityResult {
  decision: 'PASS' | 'BLOCK';
  riskScore: number;
  signals: IntegritySignal[];
  matchedPatterns: string[];
}

export interface AnswerIntegrityOptions {
  threshold?: number;
  weights?: Partial<Record<IntegritySignal, number>>;
  multiplePatternBonus?: number;
}

export const DEFAULT_RISK_THRESHOLD = 5;

export const DEFAULT_SIGNAL_WEIGHTS: Record<IntegritySignal, number> = {
  INSTRUCTION_OVERRIDE: 4,
  SCORE_MANIPULATION: 4,
  EVALUATION_MANIPULATION: 3,
  SYSTEM_PROMPT_MANIPULATION: 3,
  ROLE_PERSONA_MANIPULATION: 3,
};

export const DEFAULT_MULTIPLE_PATTERN_BONUS = 1;

interface IntegrityRule {
  signal: IntegritySignal;
  regex: RegExp;
  label: string;
}

const INTEGRITY_RULES: IntegrityRule[] = [
  // -------------------------------------------------------------
  // 1. INSTRUCTION OVERRIDE
  // -------------------------------------------------------------
  {
    signal: 'INSTRUCTION_OVERRIDE',
    regex: /(?:ignore|forget|disregard|override|drop|bypass)\s+(?:all\s+)?(?:previous|prior|above|your|the|any)\s+(?:instructions?|rules?|directives?|commands?|guidelines?|prompts?)/i,
    label: 'ignore previous instructions',
  },
  {
    signal: 'INSTRUCTION_OVERRIDE',
    regex: /(?:ignore|forget|disregard|override|drop|bypass)\s+(?:your\s+)?(?:evaluation\s+rules?|grading\s+rules?|scoring\s+rules?)/i,
    label: 'ignore evaluation rules',
  },
  {
    signal: 'INSTRUCTION_OVERRIDE',
    regex: /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:instructions?|rules?|directives?)\s+(?:above|previously|given)/i,
    label: 'disregard previous instructions',
  },
  {
    signal: 'INSTRUCTION_OVERRIDE',
    regex: /(?:override|bypass)\s+(?:your\s+|the\s+)?(?:instructions?|safety\s+guidelines?)/i,
    label: 'override instructions',
  },
  {
    signal: 'INSTRUCTION_OVERRIDE',
    regex: /(?:new\s+instructions?|system\s+override)\s*[:.]/i,
    label: 'system override instruction',
  },

  // -------------------------------------------------------------
  // 2. SCORE MANIPULATION
  // -------------------------------------------------------------
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:give|grant|award|assign)s?\s+me\s+(?:a\s+)?(?:10\s*\/\s*10|10\s+out\s+of\s+10|full\s+marks?|maximum\s+marks?|max\s+marks?|the\s+highest\s+score|a\s+perfect\s+score|full\s+score|100%)/i,
    label: 'give me maximum score / marks',
  },
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:mark|grade|rate|consider|evaluate)s?\s+(?:this|my)\s+(?:answer|response|submission)?\s*(?:as\s+)?(?:completely\s+correct|fully\s+correct|perfect|correct|10\s*\/\s*10)/i,
    label: 'mark my answer correct / perfect',
  },
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:give|award|assign)s?\s+(?:me\s+)?(?:a\s+)?perfect\s+score/i,
    label: 'give me a perfect score',
  },
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:rate|evaluate)s?\s+(?:this|my\s+answer)\s+as\s+perfect/i,
    label: 'rate this as perfect',
  },
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:mark\s+my\s+answer\s+correct|consider\s+this\s+answer\s+correct)/i,
    label: 'consider this answer correct',
  },
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:give|grant)s?\s+me\s+(?:maximum|full)\s+marks?/i,
    label: 'give me full marks',
  },
  {
    signal: 'SCORE_MANIPULATION',
    regex: /(?:give|grant|award)s?\s+me\s+the\s+highest\s+score/i,
    label: 'give me the highest score',
  },

  // -------------------------------------------------------------
  // 3. EVALUATION MANIPULATION
  // -------------------------------------------------------------
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /(?:you\s+(?:must|should|have\s+to|are\s+required\s+to))\s+(?:rate|mark|evaluate|score|grade)\s+(?:this|me|my\s+answer)/i,
    label: 'you must rate/mark this',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /(?:do\s+not|don't)\s+evaluate\s+(?:this|me|my\s+answer)/i,
    label: 'do not evaluate this',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /(?:change|alter|modify|adjust)\s+your\s+evaluation/i,
    label: 'change your evaluation',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /evaluate\s+me\s+as\s+(?:a\s+)?(?:senior|lead|perfect|expert|passed|10)/i,
    label: 'evaluate me as...',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /the\s+correct\s+score\s+is\s+(?:10|maximum|perfect|full)/i,
    label: 'the correct score is...',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /you\s+are\s+required\s+to\s+give\s+me/i,
    label: 'you are required to give me...',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /(?:mark|consider|rate)\s+(?:this|my)\s+answer\s+(?:as\s+)?(?:completely\s+correct|fully\s+correct|correct)/i,
    label: 'force answer evaluation correct',
  },
  {
    signal: 'EVALUATION_MANIPULATION',
    regex: /you\s+are\s+(?:now\s+)?instructed\s+to/i,
    label: 'you are now instructed to',
  },

  // -------------------------------------------------------------
  // 4. SYSTEM PROMPT MANIPULATION
  // -------------------------------------------------------------
  {
    signal: 'SYSTEM_PROMPT_MANIPULATION',
    regex: /(?:reveal|show|print|output|display|repeat|leak|tell\s+me)\s+(?:your\s+)?(?:system\s+prompt|developer\s+message|initial\s+prompt|hidden\s+instructions?|system\s+instructions?)/i,
    label: 'reveal system prompt',
  },
  {
    signal: 'SYSTEM_PROMPT_MANIPULATION',
    regex: /(?:what\s+(?:is|are)\s+your)\s+(?:system\s+prompt|hidden\s+instructions?|system\s+instructions?|developer\s+message)/i,
    label: 'what is your system prompt',
  },
  {
    signal: 'SYSTEM_PROMPT_MANIPULATION',
    regex: /your\s+hidden\s+instructions/i,
    label: 'references to hidden instructions',
  },
  {
    signal: 'SYSTEM_PROMPT_MANIPULATION',
    regex: /(?:references?\s+to\s+)?(?:system\s+prompt|developer\s+message|system\s+instructions)\s*[:=]/i,
    label: 'system instructions override',
  },
  {
    signal: 'SYSTEM_PROMPT_MANIPULATION',
    regex: /override\s+the\s+evaluator/i,
    label: 'override the evaluator',
  },
  {
    signal: 'SYSTEM_PROMPT_MANIPULATION',
    regex: /(?:ignore|forget|override)\s+(?:previous|your|the)\s+instructions?/i,
    label: 'prompt override indicator',
  },

  // -------------------------------------------------------------
  // 5. ROLE / PERSONA MANIPULATION
  // -------------------------------------------------------------
  {
    signal: 'ROLE_PERSONA_MANIPULATION',
    regex: /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:a\s+different|an\s+unrestricted|a\s+helpful\s+assistant\s+that\s+always|an\s+evaluator\s+who\s+gives|dan|jailbroken|a\s+recruiter\s+who\s+approves)/i,
    label: 'role persona override',
  },
  {
    signal: 'ROLE_PERSONA_MANIPULATION',
    regex: /you\s+are\s+(?:now\s+)?instructed\s+to/i,
    label: 'persona instruction directive',
  },
  {
    signal: 'ROLE_PERSONA_MANIPULATION',
    regex: /(?:from\s+now\s+on\s+you\s+(?:will|must)|you\s+are\s+now\s+freed\s+from)/i,
    label: 'jailbreak directive phrasing',
  },
];

export class AnswerIntegrityGuard {
  /**
   * Normalizes raw candidate input:
   * - Unicode NFKC normalization (recomposes homoglyphs, standardizes fullwidth ASCII)
   * - Strips zero-width characters and invisible control codes
   * - Converts to lowercase
   * - Normalizes single/double quotation variations
   * - Collapses multi-whitespace into a single space
   */
  static normalizeText(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, '')
      .toLowerCase()
      .replace(/[‘’`]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Inspects candidate answer text for prompt injection, score manipulation,
   * or evaluator override patterns.
   *
   * Completely local and deterministic (zero LLM / network calls).
   */
  static check(rawText: string, options?: AnswerIntegrityOptions): AnswerIntegrityResult {
    const threshold = options?.threshold ?? DEFAULT_RISK_THRESHOLD;
    const weights = { ...DEFAULT_SIGNAL_WEIGHTS, ...(options?.weights || {}) };
    const multiplePatternBonus = options?.multiplePatternBonus ?? DEFAULT_MULTIPLE_PATTERN_BONUS;

    const normalized = this.normalizeText(rawText);

    if (!normalized || normalized.length === 0) {
      return {
        decision: 'PASS',
        riskScore: 0,
        signals: [],
        matchedPatterns: [],
      };
    }

    const matchedPatterns: string[] = [];
    const signalsSet = new Set<IntegritySignal>();

    for (const rule of INTEGRITY_RULES) {
      const match = normalized.match(rule.regex);
      if (match) {
        matchedPatterns.push(match[0].trim());
        signalsSet.add(rule.signal);
      }
    }

    const uniquePatterns = Array.from(new Set(matchedPatterns));
    const signals = Array.from(signalsSet);

    let riskScore = 0;
    for (const sig of signals) {
      riskScore += weights[sig] ?? 0;
    }

    // Add multiple suspicious patterns bonus if >= 2 patterns or >= 2 signals
    if (uniquePatterns.length > 1 || signals.length > 1) {
      riskScore += multiplePatternBonus;
    }

    const decision: 'PASS' | 'BLOCK' = riskScore >= threshold ? 'BLOCK' : 'PASS';

    return {
      decision,
      riskScore,
      signals,
      matchedPatterns: uniquePatterns,
    };
  }
}
