import { AIFluencyEvaluation } from './evidence-types';

export class AIFluencyEvaluator {
  /**
   * Evaluates AI engineering fluency, verification discipline, and AI architecture reasoning.
   * Does NOT treat AI usage as inherently positive or negative. Evaluates critical verification ability.
   */
  static evaluateAIFluency(
    interviewTurns: Array<{ questionText: string; answerText: string; microEval?: any }>
  ): AIFluencyEvaluation {
    const evidenceQuotes: string[] = [];
    let verificationDiscipline = 'Standard Code Review';
    let aiUsageAwareness = 'Integrated AI Copilot / Assistant';
    let totalScore = 5;

    if (!interviewTurns || interviewTurns.length === 0) {
      return {
        aiUsageAwareness: 'Not evaluated',
        verificationDiscipline: 'Not evaluated',
        aiDebuggingScore: 5,
        evidenceQuotes: [],
        confidence: 0.7,
        reasoning: 'AI Fluency dimension was not explicitly probed during this session.',
      };
    }

    interviewTurns.forEach((turn) => {
      const qLower = turn.questionText.toLowerCase();
      const aLower = turn.answerText.toLowerCase();

      if (qLower.includes('ai') || qLower.includes('copilot') || qLower.includes('generated code') || qLower.includes('hallucin')) {
        evidenceQuotes.push(turn.answerText.slice(0, 150));

        if (aLower.includes('verify') || aLower.includes('edge case') || aLower.includes('security') || aLower.includes('test')) {
          verificationDiscipline = 'High Rigor: Candidate actively tests and verifies AI-generated code against edge cases and security vulnerabilities.';
          totalScore += 2;
        }

        if (aLower.includes('hallucinat') || aLower.includes('deprecated') || aLower.includes('incorrect assumption')) {
          verificationDiscipline = 'Expert Verification: Demonstrated ability to spot hallucinated APIs and flawed AI architecture choices.';
          totalScore += 2;
        }

        if (aLower.includes('prompt') || aLower.includes('refactor') || aLower.includes('workflow')) {
          aiUsageAwareness = 'Structured AI Workflow: Leverages AI assistants for boilerplate generation while retaining technical oversight.';
        }
      }
    });

    const finalScore = Math.min(10, Math.max(1, totalScore));

    return {
      aiUsageAwareness,
      verificationDiscipline,
      aiDebuggingScore: finalScore,
      evidenceQuotes,
      confidence: 0.85,
      reasoning: `Candidate demonstrated ${verificationDiscipline.toLowerCase()} when working with AI-generated software components.`,
    };
  }
}
