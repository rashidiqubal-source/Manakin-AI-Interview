import { CompetencyGap, EvidenceGapStatus, ProvenanceRecord } from './evidence-types';

export class EvidenceGapEngine {
  /**
   * Calculates the current evidence gap state for all competencies in the JD, Resume, and GitHub analysis.
   * Strictly enforces JD-first priority ordering: MANDATORY > HIGH > PREFERRED.
   */
  static calculateGaps(params: {
    normalizedJD: any;
    normalizedResume?: any;
    githubAnalysis?: any;
    evidenceGraph?: any;
    askedTurnCount?: number;
  }): CompetencyGap[] {
    const { normalizedJD, normalizedResume, githubAnalysis, evidenceGraph } = params;
    const gaps: CompetencyGap[] = [];

    if (!normalizedJD) return gaps;

    // 1. Gather all required skills from JD
    const jdSkills = normalizedJD.requiredSkills || [];
    const preferredSkills = normalizedJD.preferredSkills || [];

    const allJdCompetencies = [
      ...jdSkills.map((s: any) => ({
        name: typeof s === 'string' ? s : s.name,
        importance: typeof s === 'object' ? s.importance || 'MUST_HAVE' : 'MUST_HAVE',
      })),
      ...preferredSkills.map((s: any) => ({
        name: typeof s === 'string' ? s : s.name,
        importance: typeof s === 'object' ? s.importance || 'PREFERRED' : 'PREFERRED',
      })),
    ];

    allJdCompetencies.forEach((comp) => {
      const compName = comp.name;
      const importance = comp.importance === 'MUST_HAVE' ? 'MANDATORY' : comp.importance;

      // Check evidence sources
      const hasResumeClaim = normalizedResume?.skills?.some(
        (rs: any) => (rs.name || rs.canonicalName)?.toLowerCase() === compName.toLowerCase()
      );

      const hasGitHubCode = githubAnalysis?.analyzedRepos?.some((repo: any) =>
        repo.relevantTechnologies?.some((tech: string) => tech.toLowerCase() === compName.toLowerCase())
      );

      // Check interview turn evaluations in graph
      const evalNodes = evidenceGraph?.nodes?.filter(
        (n: any) =>
          n.type === 'EVALUATION' &&
          n.metadata?.competency?.toLowerCase() === compName.toLowerCase()
      ) || [];

      let status: EvidenceGapStatus = 'NO_EVIDENCE';
      let reasoning = 'No explicit evidence found in resume, GitHub, or interview turns.';
      const sources: ('JD' | 'RESUME' | 'GITHUB' | 'INTERVIEW' | 'ANSWER')[] = ['JD'];

      if (hasResumeClaim) sources.push('RESUME');
      if (hasGitHubCode) sources.push('GITHUB');
      if (evalNodes.length > 0) sources.push('INTERVIEW');

      // Determine verification status
      if (evalNodes.length > 0) {
        const strongEvals = evalNodes.filter(
          (e: any) => e.metadata?.technicalDepth === 'DEEP' || (e.metadata?.clarity || 0) >= 4
        );
        const weakEvals = evalNodes.filter(
          (e: any) => e.metadata?.technicalDepth === 'WEAK' || (e.metadata?.clarity || 0) <= 2
        );

        if (strongEvals.length >= 1) {
          status = 'VERIFIED';
          reasoning = `Sufficient interview evidence collected demonstrating hands-on competency in ${compName}.`;
        } else if (evalNodes.length >= 2) {
          // Cap questioning at 2 turns max per skill if evidence is already conclusive or limit reached
          status = weakEvals.length > 0 ? 'UNVERIFIED' : 'PARTIALLY_VERIFIED';
          reasoning = `Probed ${evalNodes.length} times in interview. Evidence resolution capped to avoid redundant questioning.`;
        } else {
          status = 'PARTIALLY_VERIFIED';
          reasoning = `Probed in interview turn(s), additional depth verification needed.`;
        }
      } else {
        // Pre-interview state
        if (hasResumeClaim && hasGitHubCode) {
          status = 'UNVERIFIED';
          reasoning = `Present in Resume and corroborated in GitHub repository code. Requires deeper cross-verification.`;
        } else if (hasResumeClaim || hasGitHubCode) {
          status = 'UNVERIFIED';
          reasoning = `Documented in candidate sources but not yet probed during interview.`;
        } else {
          status = 'NO_EVIDENCE';
          reasoning = `No candidate resume or GitHub evidence provided for this JD requirement. Must be probed directly.`;
        }
      }

      // Provenance records
      const provenance: ProvenanceRecord[] = [
        {
          id: `prov-gap-${compName.toLowerCase()}`,
          sourceType: 'JD',
          sourceId: normalizedJD.job?.title || 'JD',
          referenceExcerpt: `Requirement: ${compName} (${importance})`,
          competency: compName,
          conclusion: reasoning,
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        },
      ];

      gaps.push({
        competency: compName,
        importance: importance as any,
        status,
        evidenceSources: sources,
        provenance,
        verificationDepthNeeded: status === 'VERIFIED' || evalNodes.length >= 2 ? 'NONE' : status === 'PARTIALLY_VERIFIED' ? 'DEEP' : 'BASIC',
        reasoning,
      });
    });

    // 2. Sort gaps by strict JD Priority: MANDATORY > HIGH > PREFERRED
    const priorityWeight: Record<string, number> = {
      MANDATORY: 4,
      MUST_HAVE: 4,
      HIGH: 3,
      PREFERRED: 2,
      GOOD_TO_HAVE: 2,
      OPTIONAL: 1,
    };

    gaps.sort((a, b) => {
      const wA = priorityWeight[a.importance] || 1;
      const wB = priorityWeight[b.importance] || 1;
      if (wA !== wB) return wB - wA; // Higher priority first

      // Unresolved status comes before VERIFIED
      const statusWeight: Record<EvidenceGapStatus, number> = {
        NO_EVIDENCE: 4,
        UNVERIFIED: 4,
        POTENTIAL_CONTRADICTION: 4,
        PARTIALLY_VERIFIED: 2,
        VERIFIED: 1,
      };
      return (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
    });

    return gaps;
  }
}
