import { VerifiedClaim, EvidenceGapStatus } from './evidence-types';

export class ResumeClaimVerifier {
  /**
   * Extracts measurable claims (performance metrics, scale, architecture) from normalized resume experience & projects.
   */
  static extractClaims(normalizedResume: any): VerifiedClaim[] {
    const claims: VerifiedClaim[] = [];

    if (!normalizedResume) return claims;

    // 1. Process Experience Highlights & Measurable Achievements
    if (normalizedResume.experience && Array.isArray(normalizedResume.experience)) {
      normalizedResume.experience.forEach((exp: any, index: number) => {
        const achievements = [
          ...(exp.measurableAchievements || []),
          ...(exp.highlights || []).filter((h: string) => /\d+(%|ms|k|M|x|users|req)/i.test(h)),
        ];

        achievements.forEach((achText: string, achIndex: number) => {
          claims.push({
            id: `claim-exp-${index}-${achIndex}`,
            claimText: achText,
            category: /\d+ms|\d+%|latency|speed|optim/i.test(achText) ? 'PERFORMANCE' : 'SCALE',
            status: 'UNVERIFIED',
            resumeQuote: achText,
            verificationNotes: 'Extracted measurable claim from work history',
          });
        });
      });
    }

    // 2. Process Project Measurable Achievements
    if (normalizedResume.projects && Array.isArray(normalizedResume.projects)) {
      normalizedResume.projects.forEach((proj: any, index: number) => {
        const achievements = [
          ...(proj.measurableAchievements || []),
          ...(proj.highlights || []).filter((h: string) => /\d+(%|ms|k|M|x|users|req)/i.test(h)),
        ];

        achievements.forEach((achText: string, achIndex: number) => {
          claims.push({
            id: `claim-proj-${index}-${achIndex}`,
            claimText: achText,
            category: 'ARCHITECTURE',
            status: 'UNVERIFIED',
            resumeQuote: achText,
            githubCorroboration: proj.githubUrl || undefined,
            verificationNotes: 'Extracted measurable claim from project repository',
          });
        });
      });
    }

    return claims;
  }

  /**
   * Updates claim verification states based on candidate interview answers and GitHub cross-referencing.
   */
  static updateClaimsWithInterview(
    claims: VerifiedClaim[],
    turn: { questionText: string; answerText: string; microEval?: any }
  ): VerifiedClaim[] {
    return claims.map((claim) => {
      // Check if current question/answer relates to this claim
      const isRelevant =
        turn.questionText.toLowerCase().includes('latency') ||
        turn.questionText.toLowerCase().includes('scale') ||
        turn.questionText.toLowerCase().includes('project') ||
        turn.answerText.toLowerCase().includes(claim.claimText.slice(0, 20).toLowerCase());

      if (isRelevant && turn.microEval) {
        let newStatus: EvidenceGapStatus = claim.status;
        let notes = claim.verificationNotes;

        if ((turn.microEval.clarity || 0) >= 4 || turn.microEval.technicalDepth === 'DEEP') {
          newStatus = 'VERIFIED';
          notes = `Verified during interview turn. Candidate explained architecture and metrics clearly.`;
        } else if ((turn.microEval.clarity || 0) <= 2) {
          newStatus = 'PARTIALLY_VERIFIED';
          notes = `Probed during interview turn but candidate response lacked specific architectural details.`;
        }

        return {
          ...claim,
          status: newStatus,
          interviewEvidence: turn.answerText.slice(0, 150) + '...',
          verificationNotes: notes,
        };
      }

      return claim;
    });
  }
}
