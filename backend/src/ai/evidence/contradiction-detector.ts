import { ContradictionRecord, ContradictionType, ContradictionSeverity } from './evidence-types';

export class ContradictionDetector {
  /**
   * Analyzes evidence across Resume, GitHub, and Interview responses to identify potential scope/technology mismatches.
   * Strictly uses neutral non-accusatory terminology (POTENTIAL_SCOPE_MISMATCH, etc.) and flags requiresHumanReview for high severity.
   */
  static detectContradictions(params: {
    normalizedResume?: any;
    githubAnalysis?: any;
    interviewTurns?: Array<{ questionText: string; answerText: string; microEval?: any }>;
  }): ContradictionRecord[] {
    const contradictions: ContradictionRecord[] = [];
    const { normalizedResume, githubAnalysis, interviewTurns } = params;

    if (!interviewTurns || interviewTurns.length === 0) return contradictions;

    // 1. Check Ownership / Scope Mismatches
    // Example: Resume claims "Designed distributed architecture", candidate states "I implemented API endpoints under lead's design"
    interviewTurns.forEach((turn, index) => {
      const ansLower = turn.answerText.toLowerCase();

      if (
        (ansLower.includes('my lead') || ansLower.includes('senior architect') || ansLower.includes('team lead designed')) &&
        ansLower.includes('i just implemented')
      ) {
        // Check if resume claimed sole architecture ownership
        const hasArchitectClaim = normalizedResume?.experience?.some((exp: any) =>
          exp.highlights?.some((h: string) => /architected|designed/i.test(h))
        );

        if (hasArchitectClaim) {
          contradictions.push({
            id: `contra-scope-${index}`,
            type: 'POTENTIAL_SCOPE_MISMATCH',
            severity: 'MEDIUM',
            sources: ['RESUME', 'ANSWER'],
            sourceReferences: ['Resume highlight: Architected backend system', `Interview Answer turn ${index + 1}`],
            explanation: `Resume documents overall system architectural design, whereas candidate clarified during interview that team lead designed the core architecture.`,
            requiresHumanReview: true,
          });
        }
      }

      // 2. Check Technology Proficiency Discrepancies
      // Candidate claims expert level, but in interview expresses unfamiliarity with fundamental primitives
      if (
        ansLower.includes('never used') ||
        ansLower.includes('not familiar with') ||
        ansLower.includes("don't know how")
      ) {
        normalizedResume?.skills?.forEach((skill: any) => {
          const sName = (skill.name || skill.canonicalName || '').toLowerCase();
          if (sName && turn.questionText.toLowerCase().includes(sName) && skill.proficiency === 'ADVANCED') {
            contradictions.push({
              id: `contra-tech-${index}-${sName}`,
              type: 'POTENTIAL_TECHNOLOGY_MISMATCH',
              severity: 'HIGH',
              sources: ['RESUME', 'ANSWER'],
              sourceReferences: [`Resume skill: ${skill.name} (ADVANCED)`, `Interview Answer turn ${index + 1}`],
              explanation: `Resume lists ${skill.name} at ADVANCED proficiency, but candidate indicated limited hands-on familiarity during interview probe.`,
              requiresHumanReview: true,
            });
          }
        });
      }

      // 3. Check GitHub Repository & Project Ownership Discrepancies
      // If a question probed a GitHub repository or public project claimed by the candidate,
      // and the candidate was unable to explain the code, gave evasive answers, or admitted unfamiliarity.
      if (githubAnalysis?.analyzedRepos && Array.isArray(githubAnalysis.analyzedRepos)) {
        githubAnalysis.analyzedRepos.forEach((repo: any) => {
          const repoNameLower = (repo.repoName || '').toLowerCase();
          const qLower = turn.questionText.toLowerCase();

          const isProbingRepo =
            (repoNameLower && qLower.includes(repoNameLower)) ||
            (repo.relevantTechnologies && repo.relevantTechnologies.some((t: string) => qLower.includes(t.toLowerCase()) && qLower.includes('github')));

          if (isProbingRepo) {
            const unableToAnswer =
              ansLower.includes("don't know") ||
              ansLower.includes('not sure') ||
              ansLower.includes("didn't build") ||
              ansLower.includes("didn't write") ||
              ansLower.includes('not familiar') ||
              ansLower.includes("don't remember") ||
              ansLower.includes('someone else built') ||
              ansLower.includes('copied from') ||
              turn.microEval?.responseQuality === 'unsatisfactory' ||
              turn.microEval?.responseQuality === 'off-topic' ||
              turn.microEval?.responseQuality === 'evasive' ||
              (turn.microEval?.claimVerification !== undefined && turn.microEval.claimVerification <= 3) ||
              (turn.microEval?.depth !== undefined && turn.microEval.depth <= 2 && ansLower.length < 50);

            if (unableToAnswer) {
              contradictions.push({
                id: `contra-github-${index}-${repo.repoName}`,
                type: 'POTENTIAL_OWNERSHIP_MISMATCH',
                severity: 'HIGH',
                sources: ['GITHUB', 'ANSWER'],
                sourceReferences: [`GitHub Repository: ${repo.repoName}`, `Interview Answer turn ${index + 1}`],
                explanation: `Candidate was probed on their claimed GitHub repository '${repo.repoName}' but was unable to satisfactorily explain the architecture, design choices, or implementation details.`,
                requiresHumanReview: true,
              });
            }
          }
        });
      }
    });

    return contradictions;
  }
}
