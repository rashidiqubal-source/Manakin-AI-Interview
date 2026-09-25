import { CompetencyGap, VerifiedClaim, EvidenceSourceType } from './evidence-types';
import { QuestionGuardrailValidator } from './question-guardrails';
import { CodeChallenge, CodingChallengeGenerator } from './coding-challenge-generator';

export type InterviewActionType =
  | 'VERIFY_RESUME_CLAIM'
  | 'CLOSE_EVIDENCE_GAP'
  | 'CROSS_VERIFY_RESUME_GITHUB'
  | 'REPOSITORY_QUESTION'
  | 'TECHNICAL_QUESTION'
  | 'SYSTEM_DESIGN'
  | 'BEHAVIORAL'
  | 'AI_FLUENCY'
  | 'LIVE_CODE_CHALLENGE'
  | 'CODE_FOLLOW_UP_1'
  | 'CODE_FOLLOW_UP_2'
  | 'FINISH';

export interface CodeChallengeState {
  status: 'PENDING' | 'CHALLENGE_ISSUED' | 'CODE_SUBMITTED' | 'FOLLOW_UP_1_DONE' | 'FOLLOW_UP_2_DONE';
  challenge?: CodeChallenge;
  submittedCode?: string;
  codeEval?: any;
}

export interface NextQuestionPlan {
  action: InterviewActionType;
  targetCompetency: string;
  purpose: string;
  sourceType: EvidenceSourceType;
  sourceContext: string;
  promptInstructions: string;
  shouldStop: boolean;
  codeChallenge?: CodeChallenge;
}

export class AdaptiveInterviewEngine {
  /**
   * Deterministically selects the next interview action and target evidence based on JD priority, evidence gaps, time budget, and completion criteria.
   * Integrates mid-interview live coding challenge anchored to public repository code, followed by 2 code probe questions.
   */
  static selectNextAction(params: {
    gaps: CompetencyGap[];
    claims: VerifiedClaim[];
    githubAnalysis?: any;
    previousQuestions: string[];
    turnIndex: number;
    timeRemainingMinutes: number;
    jobLevel?: string;
    codeChallengeState?: CodeChallengeState;
    jdSkills?: string[];
    candidateName?: string;
  }): NextQuestionPlan {
    const {
      gaps,
      claims,
      githubAnalysis,
      previousQuestions,
      turnIndex,
      timeRemainingMinutes,
      jobLevel = 'MID_LEVEL',
      codeChallengeState,
      jdSkills = [],
      candidateName,
    } = params;

    // 1. Check Stopping Criteria
    // The interview is designed to run for 30 minutes, conducting a deep back-and-forth technical assessment.
    const mandatoryGaps = gaps.filter((g) => g.importance === 'MANDATORY');
    const unresolvedMandatoryGaps = mandatoryGaps.filter(
      (g) => g.verificationDepthNeeded !== 'NONE' && (g.status === 'UNVERIFIED' || g.status === 'NO_EVIDENCE' || g.status === 'PARTIALLY_VERIFIED')
    );

    // Conclude only when 30-minute time budget is exhausted (<= 1 min remaining)
    if (timeRemainingMinutes <= 1) {
      return {
        action: 'FINISH',
        targetCompetency: 'NONE',
        purpose: '30-minute interview time budget completed',
        sourceType: 'JD',
        sourceContext: 'Time budget limit reached',
        promptInstructions: 'Gracefully conclude the 30-minute technical interview. Thank the candidate warmly for their in-depth technical discussion and explain that their comprehensive evaluation is being compiled.',
        shouldStop: true,
      };
    }

    // High turn threshold: Only consider early conclusion if candidate has completed at least 14 rich technical turns,
    // coding challenge and both follow-ups are finished, and all mandatory JD competencies are verified.
    if (turnIndex >= 14 && unresolvedMandatoryGaps.length === 0 && codeChallengeState?.status === 'FOLLOW_UP_2_DONE') {
      const anyUnresolvedGaps = gaps.some((g) => g.status === 'UNVERIFIED' || g.status === 'NO_EVIDENCE');
      if (!anyUnresolvedGaps || timeRemainingMinutes <= 3) {
        return {
          action: 'FINISH',
          targetCompetency: 'ALL_EVIDENCE_VERIFIED',
          purpose: 'Comprehensive 30-minute technical assessment across JD, GitHub, and Resume complete',
          sourceType: 'JD',
          sourceContext: 'Complete multi-dimensional evaluation',
          promptInstructions: 'All mandatory JD competencies, coding lifecycle, GitHub architecture, and resume claims have been thoroughly evaluated. Thank the candidate and conclude the interview session professionally.',
          shouldStop: true,
        };
      }
    }

    // 2. Active Coding Challenge Lifecycle (Follow-Up Probes)
    if (codeChallengeState?.status === 'CODE_SUBMITTED') {
      // Candidate submitted code -> Follow-Up Probe 1 (Algorithmic complexity, trade-offs, edge cases)
      const challenge = codeChallengeState.challenge;
      const fnName = challenge?.functionName || 'function';
      const repoName = challenge?.repoName || 'claimed repository';

      return {
        action: 'CODE_FOLLOW_UP_1',
        targetCompetency: 'Code Quality, Algorithmic Complexity & Edge Cases',
        purpose: `Follow-up probe 1 on candidate's submitted code for ${fnName}`,
        sourceType: 'GITHUB',
        sourceContext: `Submitted code for ${fnName} in ${repoName}`,
        promptInstructions: `Engage in authentic two-and-fro conversation. The candidate submitted their implementation for '${fnName}'. First, briefly acknowledge their code implementation. Then ask a tricky conceptual follow-up: probe their algorithmic time and space complexity (Big-O), and ask how their code would behave under tricky edge cases (e.g. empty or null values, unexpected input types, or concurrent calls). Do not ask trick riddles; test genuine understanding of how their code executes under the hood.`,
        shouldStop: false,
      };
    } else if (codeChallengeState?.status === 'FOLLOW_UP_1_DONE') {
      // Candidate answered Follow-Up 1 -> Follow-Up Probe 2 (Repo architecture, integration, testing)
      const challenge = codeChallengeState.challenge;
      const fnName = challenge?.functionName || 'function';
      const repoName = challenge?.repoName || 'claimed repository';

      return {
        action: 'CODE_FOLLOW_UP_2',
        targetCompetency: 'System Architecture, Concurrency & Production Testing',
        purpose: `Follow-up probe 2 on repository integration and production testing for ${repoName}`,
        sourceType: 'GITHUB',
        sourceContext: `Repository integration in ${repoName}`,
        promptInstructions: `Acknowledge the candidate's explanation of complexity and edge cases. Now ask a tricky production-level follow-up: how would '${fnName}' integrate into repository '${repoName}' in a production backend? How would they write unit/integration tests to verify it under high concurrent load, and what failure mode (e.g. timeout, memory leak, lock contention) would they watch for in production?`,
        shouldStop: false,
      };
    }

    // 3. PRIORITY 1: Job Description (JD) Core Competencies & Mandatory Requirements
    // First and foremost, verify the candidate against the core job requirements.
    if (unresolvedMandatoryGaps.length > 0) {
      const targetGap = unresolvedMandatoryGaps[0];
      const comp = targetGap.competency;

      const hasResume = targetGap.evidenceSources.includes('RESUME');
      const hasGitHub = targetGap.evidenceSources.includes('GITHUB');

      if (hasResume && hasGitHub) {
        return {
          action: 'CROSS_VERIFY_RESUME_GITHUB',
          targetCompetency: comp,
          purpose: `Priority 1 (JD): Deep cross-verification of mandatory skill ${comp} combining Resume claim and GitHub implementation`,
          sourceType: 'GITHUB',
          sourceContext: `Mandatory JD Requirement & Corroborated in Resume & GitHub`,
          promptInstructions: `Engage in a two-and-fro dialogue. Briefly comment on their previous answer, then probe mandatory JD competency '${comp}'. Ground the question in their GitHub project and resume. Ask a tricky conceptual question testing authentic mastery: why did they choose their particular architecture or library over standard alternatives? What trade-offs or performance bottlenecks did they face under the hood, and how does it handle failure or race conditions?`,
          shouldStop: false,
        };
      }

      if (hasGitHub) {
        const repo = githubAnalysis?.analyzedRepos?.find((r: any) =>
          r.relevantTechnologies?.some((t: string) => t.toLowerCase() === comp.toLowerCase())
        );

        return {
          action: 'REPOSITORY_QUESTION',
          targetCompetency: comp,
          purpose: `Priority 1 (JD): Probe mandatory requirement ${comp} grounded in public repository code`,
          sourceType: 'GITHUB',
          sourceContext: repo ? `GitHub Repository: ${repo.repoName}` : `GitHub Public Code`,
          promptInstructions: `Engage in back-and-forth conversation. Briefly acknowledge their last response. Reference the candidate's public repository work with mandatory JD skill '${comp}'. Ask a tricky, deep question about their implementation: why did they design it this way, what happens under the hood when traffic surges or connections drop, and what were the key trade-offs?`,
          shouldStop: false,
        };
      }

      if (hasResume) {
        const matchingClaim = claims.find((c) => c.claimText.toLowerCase().includes(comp.toLowerCase()));
        return {
          action: 'VERIFY_RESUME_CLAIM',
          targetCompetency: comp,
          purpose: `Priority 1 (JD): Verify mandatory requirement ${comp} claimed on candidate's resume`,
          sourceType: 'RESUME',
          sourceContext: matchingClaim ? `Resume claim: "${matchingClaim.claimText}"` : `Resume skill: ${comp}`,
          promptInstructions: `Engage in back-and-forth technical dialogue. Briefly reference what they just said. The candidate claims mandatory JD skill '${comp}' on their resume. Ask a tricky conceptual question: walk through the underlying mechanics of how they implemented it, the hardest technical roadblock or edge-case bug they solved, and how they measured success or handled concurrency under load.`,
          shouldStop: false,
        };
      }

      // No candidate evidence exists -> Directly probe JD requirement through a practical scenario
      return {
        action: 'CLOSE_EVIDENCE_GAP',
        targetCompetency: comp,
        purpose: `Priority 1 (JD): Gather missing evidence for mandatory JD requirement ${comp}`,
        sourceType: 'JD',
        sourceContext: `Mandatory JD requirement: ${comp}`,
        promptInstructions: `Engage in natural two-and-fro discussion. Briefly acknowledge their last answer. The candidate has no prior evidence for mandatory JD requirement '${comp}'. Present a realistic, tricky production scenario testing their genuine hands-on depth in '${comp}'. Ask how they would design it, handling edge cases, state management, or failure recovery under the hood. Avoid textbook definitions ('what is X').`,
        shouldStop: false,
      };
    }

    // 4. Mid-Interview Live Coding Challenge Checkpoint (Trigger at turnIndex >= 3 if not yet issued)
    if ((!codeChallengeState || codeChallengeState.status === 'PENDING') && turnIndex >= 3) {
      const challenge = CodingChallengeGenerator.generateChallenge({
        githubAnalysis,
        jdSkills,
        candidateName,
      });

      return {
        action: 'LIVE_CODE_CHALLENGE',
        targetCompetency: 'Hands-on Code Ownership & Implementation',
        purpose: `Live coding verification anchored to candidate's repository work in ${challenge.repoName}`,
        sourceType: 'GITHUB',
        sourceContext: `GitHub Repository: ${challenge.repoName}`,
        promptInstructions: `Instruct the candidate to complete the small function '${challenge.functionName}' on the live code editor on their screen, anchored to their work in repository '${challenge.repoName}'. Spoken instruction must be concise (1-2 sentences).`,
        shouldStop: false,
        codeChallenge: challenge,
      };
    }

    // 5. PRIORITY 2: Deep GitHub Repository Projects Probes
    // Probe public repositories analyzed by the GitHub analyzer that haven't been deeply probed yet.
    const analyzedRepos = githubAnalysis?.analyzedRepos || [];
    const unprobedRepo = analyzedRepos.find((r: any) =>
      !previousQuestions.some((q) => q.toLowerCase().includes(r.repoName.toLowerCase()))
    );

    if (unprobedRepo) {
      const techList = unprobedRepo.relevantTechnologies?.slice(0, 3).join(', ') || unprobedRepo.language || 'architecture';
      return {
        action: 'REPOSITORY_QUESTION',
        targetCompetency: 'GitHub Project Architecture & Code Ownership',
        purpose: `Priority 2 (GitHub): Deep conceptual probe into candidate's public repo ${unprobedRepo.repoName}`,
        sourceType: 'GITHUB',
        sourceContext: `GitHub Repository: ${unprobedRepo.repoName}`,
        promptInstructions: `Engage in natural two-and-fro technical dialogue. Acknowledge what was just discussed, then transition to candidate's public GitHub repository '${unprobedRepo.repoName}'. Ask a tricky conceptual question about how '${techList}' was architected: probe the data flow, why they chose this specific library/pattern over alternatives, how errors or network retries are handled, or how they avoid race conditions and bottlenecks. Test if they truly wrote and understand the code.`,
        shouldStop: false,
      };
    }

    // 6. PRIORITY 3: Deep Resume Claims & Project Probes
    // Probe specific metrics, architectures, and claims from the resume.
    const unprobedClaim = claims.find((c) =>
      (c.status === 'UNVERIFIED' || c.status === 'NO_EVIDENCE') &&
      !previousQuestions.some((q) => q.toLowerCase().includes(c.claimText.slice(0, 25).toLowerCase()))
    );

    if (unprobedClaim) {
      return {
        action: 'VERIFY_RESUME_CLAIM',
        targetCompetency: 'Resume Project Depth & Performance Claims',
        purpose: `Priority 3 (Resume): Verify authentic authorship and depth of claim: "${unprobedClaim.claimText}"`,
        sourceType: 'RESUME',
        sourceContext: `Resume claim: "${unprobedClaim.claimText}"`,
        promptInstructions: `Engage in back-and-forth technical conversation. Briefly acknowledge the previous response. The candidate claims on their resume: '${unprobedClaim.claimText}'. Ask a tricky conceptual probe to verify authentic depth: what was the root technical bottleneck, what were the exact architectural decisions they implemented under the hood, and how did they handle edge cases or trade-offs? Ensure they aren't just reciting resume buzzwords.`,
        shouldStop: false,
      };
    }

    // 7. AI Engineering Fluency Probe (if not yet probed and turnIndex >= 5)
    const hasProbedAIFluency = previousQuestions.some(
      (q) => q.toLowerCase().includes('ai-generated') || q.toLowerCase().includes('copilot') || q.toLowerCase().includes('ai assistant')
    );
    if (!hasProbedAIFluency && turnIndex >= 5) {
      return {
        action: 'AI_FLUENCY',
        targetCompetency: 'AI Engineering Fluency & Verification Discipline',
        purpose: 'Evaluate AI verification discipline and debugging of AI-generated code',
        sourceType: 'INTERVIEW',
        sourceContext: 'AI Engineering Fluency Assessment',
        promptInstructions: `Engage in two-and-fro technical dialogue. Ask the candidate how they critically evaluate, audit, and debug code generated by AI coding assistants or LLMs. Give a realistic scenario: an AI assistant generates code that looks clean and passes basic tests, but contains a subtle concurrency bug, memory leak, or security vulnerability. How do they catch and fix this before production?`,
        shouldStop: false,
      };
    }

    // 8. High-Scale System Design, Distributed Systems & Concurrency Resilience
    if (turnIndex >= 8 && !previousQuestions.some((q) => q.toLowerCase().includes('system design') || q.toLowerCase().includes('rate-limit') || q.toLowerCase().includes('cache stampede'))) {
      return {
        action: 'SYSTEM_DESIGN',
        targetCompetency: 'Distributed Systems, Scalability & Concurrency',
        purpose: 'Probe candidate on high-scale distributed systems, concurrency, and failure recovery',
        sourceType: 'JD',
        sourceContext: 'High-Scale Distributed Architecture',
        promptInstructions: `Engage in conversational back-and-forth dialogue. Give the candidate a realistic, tricky system design problem relevant to the JD: e.g. handling race conditions, distributed caching with Redis (preventing cache stampedes), idempotency keys in payment/order workflows, or deadlocks in high-throughput transactions. Ask how they ensure consistency, partition tolerance, and failure recovery under pressure.`,
        shouldStop: false,
      };
    }

    // 9. Production Database Internals, Concurrency Control & Resilience
    if (turnIndex >= 10 && !previousQuestions.some((q) => q.toLowerCase().includes('database') || q.toLowerCase().includes('indexing') || q.toLowerCase().includes('isolation level'))) {
      return {
        action: 'TECHNICAL_QUESTION',
        targetCompetency: 'Production Database Internals & Concurrency Control',
        purpose: 'Probe candidate on database indexing, connection pooling, and isolation levels',
        sourceType: 'INTERVIEW',
        sourceContext: 'Production Database & Concurrency Resilience',
        promptInstructions: `Engage in a two-and-fro discussion. Ask a tricky conceptual question on production database and backend internals: e.g. database indexing strategies (B-tree vs Hash, compound indexes, explain analyze), connection pool exhaustion, transaction isolation levels (phantom reads, serializable vs read committed), or zero-downtime schema migrations under high traffic.`,
        shouldStop: false,
      };
    }

    // 10. Preferred JD Competencies
    const unresolvedPreferredGaps = gaps.filter(
      (g) => g.importance === 'PREFERRED' && (g.status === 'UNVERIFIED' || g.status === 'NO_EVIDENCE')
    );

    if (unresolvedPreferredGaps.length > 0) {
      const targetGap = unresolvedPreferredGaps[0];
      const comp = targetGap.competency;
      return {
        action: 'CLOSE_EVIDENCE_GAP',
        targetCompetency: comp,
        purpose: `Gather evidence for preferred JD requirement ${comp}`,
        sourceType: 'JD',
        sourceContext: `Preferred JD requirement: ${comp}`,
        promptInstructions: `Engage in two-and-fro conversation. Ask a tricky conceptual question probing their experience with preferred JD skill '${comp}'. Test whether they understand common failure modes or trade-offs when applying it.`,
        shouldStop: false,
      };
    }

    // Default: Continue probing technical trade-offs and edge cases until the 30-minute time budget expires
    return {
      action: 'TECHNICAL_QUESTION',
      targetCompetency: 'Production Engineering & Fault Tolerance',
      purpose: 'Deep technical inquiry into production resilience and edge cases',
      sourceType: 'INTERVIEW',
      sourceContext: 'Continuous 30-Minute Technical Exploration',
      promptInstructions: 'Engage in natural two-and-fro dialogue. Acknowledge what the candidate just explained, then present a tricky scenario involving network partitions, graceful degradation, circuit breakers, or handling partial data corruption.',
      shouldStop: false,
    };
  }
}
