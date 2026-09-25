import { prisma } from '../config/prisma';
import { OpenAIService } from './OpenAIService';
import { EmailService } from './EmailService';
import { S3Service } from './S3Service';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';
import { logger } from '../config/logger';
import {
  QuestionEngine,
  CanonicalNormalizedJD,
  CanonicalNormalizedResume,
  EvidenceGraphBuilder,
  EvidenceGapEngine,
  PublicGitHubAnalyzer,
  ResumeClaimVerifier,
  ContradictionDetector,
  AIFluencyEvaluator,
  QuestionGuardrailValidator,
  AdaptiveInterviewEngine,
  EvidenceProfileBuilder,
  ProctoringCorrelationEngine,
  AnswerIntegrityGuard,
} from '../ai';

const SYSTEM_PROMPT = `You are a Principal Software Engineering Evaluator conducting a comprehensive 30-minute technical interview.

CORE EVALUATION DIRECTIVES & PRIORITY HIERARCHY:
1. PRIORITY 1 — JOB DESCRIPTION (JD) REQUIREMENTS:
   - Your primary duty is to test the core skills, architecture, and responsibilities demanded by the Job Description.
   - Verify whether the candidate can successfully execute the actual day-to-day engineering requirements of this role.

2. PRIORITY 2 — GITHUB REPOSITORY GROUND-TRUTH:
   - Deeply probe what the candidate actually built and committed in their public GitHub repositories.
   - Challenge their architectural decisions, chosen libraries/frameworks, database schemas, component boundaries, and testing patterns.

3. PRIORITY 3 — RESUME CLAIMS & PROJECT VERIFICATION:
   - Drill into specific claims, metrics, and technologies cited on their resume.
   - Cross-examine how they implemented solutions to distinguish genuine code authors from candidates who copy-pasted or only have surface-level exposure.

INTERVIEW STYLE & QUESTION DESIGN:
- Conduct an engaging, back-and-forth ("to and fro") technical conversation over the 30-minute session.
- Ask TRICKY, CONCEPTUAL PROBES that test real depth of understanding:
  * "Why did you choose X over Y in this project, and what were the performance trade-offs?"
  * "What happens under high concurrent write load or network failure in this flow?"
  * "How does this ORM/library work under the hood in your implementation?"
  * "How did you structure error recovery, transactions, and state rollback?"
- Do NOT ask artificial brainteasers or trivia puzzles. Focus strictly on whether they possess genuine, deep architectural and code understanding.
- Keep turns concise (1-3 sentences), professional, direct, and technical. Always stay in English.
`;

/**
 * Strips null bytes (\u0000) and problematic control characters recursively
 * to prevent PostgreSQL 22P05 ("unsupported Unicode escape sequence") errors.
 */
function sanitizeForPostgres<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val.replace(/[\u0000\uFEFF\uFFFD]/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') as any;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeForPostgres) as any;
  }
  if (typeof val === 'object') {
    const res: any = {};
    for (const key of Object.keys(val)) {
      res[key] = sanitizeForPostgres((val as any)[key]);
    }
    return res;
  }
  return val;
}

export const DEMO_STATIC_QUESTIONS = [
  "Welcome to your demo interview! To start off, could you introduce yourself and tell me what got you interested in Computer Science?",
  "Can you explain what a variable is in programming, and give a couple of examples of basic data types like integers or strings?",
  "What is an 'if-else' statement in code, and can you share a simple everyday example of how it helps a program make decisions?",
  "What is a loop in programming, and why would you use a loop instead of writing the same line of code over and over?",
  "What is a function, and why do programmers write functions instead of repeating the same code multiple times?",
  "What is an array, and how do you access a specific element inside an array using its index?",
  "In Object-Oriented Programming, what is the difference between a class and an object? Can you share a simple example, like a blueprint and a house?",
  "Can you explain the difference between a Stack and a Queue using everyday examples, like a stack of plates or waiting in a line?",
  "In simple terms, what is an algorithm? Can you explain how a simple search, like looking through a list of items, works?",
  "Finally, what is a database, and what is the difference between a table, a row, and a column?"
];

export class InterviewService {
  /**
   * Starts a new evidence-driven interview session and generates the opening question.
   */
  static async startInterview(
    candidateName: string,
    candidateEmail?: string,
    invitationId?: string,
    providedGithubUrl?: string,
    isDemo?: boolean
  ) {
    if (isDemo) {
      const firstQuestion = DEMO_STATIC_QUESTIONS[0];
      const session = await prisma.interviewSession.create({
        data: {
          candidateName: sanitizeForPostgres(candidateName || 'Demo Candidate'),
          candidateEmail: candidateEmail ? sanitizeForPostgres(candidateEmail) : null,
          githubUrl: providedGithubUrl || null,
          status: 'IN_PROGRESS',
          questionBlueprint: {
            isDemo: true,
            currentQuestionIndex: 0,
            totalQuestions: DEMO_STATIC_QUESTIONS.length,
          } as any,
          evidenceGraph: { nodes: [], edges: [] } as any,
          evidenceGaps: [] as any,
          verifiedClaims: [] as any,
          contradictions: [] as any,
          overallRecommendation: 'REVIEW_NOTES',
        },
      });

      // Save initial opening question message
      await prisma.message.create({
        data: {
          interviewSessionId: session.id,
          role: Role.assistant,
          content: firstQuestion,
        },
      });

      logger.info(`[DemoInterview] Started 10-question demo session ${session.id} for "${candidateName}". Zero OpenAI calls.`);

      return {
        sessionId: session.id,
        question: firstQuestion,
        isDemo: true,
        questionNumber: 1,
        totalQuestions: DEMO_STATIC_QUESTIONS.length,
      };
    }

    let activePrompt = SYSTEM_PROMPT;
    let invitationRecord: any = null;
    let generatedPlan: any = null;
    let firstQuestion = "";

    let normalizedJD: CanonicalNormalizedJD | null = null;
    let normalizedResume: CanonicalNormalizedResume | null = null;
    let githubAnalysis: any = null;

    if (invitationId) {
      invitationRecord = await prisma.interviewInvitation.findUnique({
        where: { id: invitationId },
        include: { jobDescription: true, applicantResume: true },
      });

      if (invitationRecord) {
        const jd = invitationRecord.jobDescription;
        const resume = invitationRecord.applicantResume;
        const candidateGithubUrl = providedGithubUrl || invitationRecord.githubUrl;

        normalizedJD = (jd.normalizedJD as any) || {
          job: { title: jd.title, department: jd.department || 'Engineering', level: jd.jobLevel || 'MID_LEVEL', employmentType: 'FULL_TIME', openings: 1, workMode: jd.workMode || 'REMOTE', location: jd.location || 'Remote' },
          role: { summary: jd.aiSummary || jd.shortSummary || '', description: jd.rawContent || '', hiringReason: 'EXPANSION' },
          responsibilities: (Array.isArray(jd.responsibilities) ? jd.responsibilities : []).map((r: any) => ({ description: typeof r === 'string' ? r : r.description || '', priority: 'HIGH', source: { type: 'AI_INFERRED' } })),
          requiredSkills: (
            Array.isArray(jd.requiredSkills) && jd.requiredSkills.length > 0
              ? jd.requiredSkills
              : ['Backend Architecture & APIs', 'Database Optimization & Queries', 'Frontend Systems & State Management', 'Concurrency & Caching', 'System Design & Edge Cases']
          ).map((s: any) => ({ name: typeof s === 'string' ? s : s.name || '', category: 'GENERAL', importance: 'MUST_HAVE', proficiency: 'INTERMEDIATE', source: { type: 'AI_INFERRED' } })),
          preferredSkills: (
            Array.isArray(jd.preferredSkills) && jd.preferredSkills.length > 0
              ? jd.preferredSkills
              : ['Docker & Cloud Deployment', 'CI/CD & Testing Automation']
          ).map((s: any) => ({ name: typeof s === 'string' ? s : s.name || '', category: 'GENERAL', importance: 'PREFERRED', proficiency: 'INTERMEDIATE', source: { type: 'AI_INFERRED' } })),
          experience: { minimumYears: jd.minExperience || 0, maximumYears: jd.maxExperience || null, industryExperience: jd.industryExperience ? [jd.industryExperience] : [], freshersAllowed: Boolean(jd.freshersAllowed), fresherRequirements: [], source: { type: 'AI_INFERRED' } },
          education: { minimumLevel: jd.minEducation || 'BACHELORS', degrees: jd.requiredDegree ? [jd.requiredDegree] : [], minimumCGPA: jd.cgpaRequirement || null, certifications: [], source: { type: 'AI_INFERRED' } },
          candidateQualities: { behavioral: ['Ownership', 'Problem Solving', 'Communication'], languages: ['English'], source: { type: 'AI_INFERRED' } },
          logistics: { shiftRequirements: [], relocationRequired: false, workMode: 'HYBRID', location: 'Remote', source: { type: 'AI_INFERRED' } },
          interviewRequirements: { technical: true, coding: true, systemDesign: false, behavioral: true, domainKnowledge: false, source: { type: 'AI_INFERRED' } },
          interviewDimensions: [],
        };

        normalizedResume = (resume?.normalizedResume as any) || {
          profile: { name: candidateName, email: candidateEmail || '', phone: null, location: null, links: [] },
          summary: resume?.aiSummary || 'Applicant resume',
          education: [],
          experience: [],
          skills: (resume?.aiAnalysis as any)?.skills ? (resume?.aiAnalysis as any).skills.map((s: string) => ({ name: s, category: 'GENERAL', proficiency: 'UNKNOWN', evidence: [s], source: 'SKILLS_SECTION', confidence: 0.8 })) : [],
          projects: [],
          certifications: [],
          achievements: [],
          technologies: (resume?.aiAnalysis as any)?.skills || [],
          domains: [],
        };

        // Auto-extract GitHub URL directly from candidate's resume if not explicitly passed
        let targetGithubUrl = providedGithubUrl || invitationRecord.githubUrl;

        if (!targetGithubUrl && normalizedResume) {
          const profileGithub = normalizedResume.profile?.links?.find(
            (link: string) => typeof link === 'string' && link.toLowerCase().includes('github.com')
          );
          if (profileGithub) {
            targetGithubUrl = profileGithub;
          } else {
            const projectGithub = normalizedResume.projects?.find(
              (proj: any) => proj.githubUrl && typeof proj.githubUrl === 'string' && proj.githubUrl.toLowerCase().includes('github.com')
            )?.githubUrl;
            if (projectGithub) {
              targetGithubUrl = projectGithub;
            }
          }
        }

        // Static GitHub Inspection if profile URL provided or extracted from resume
        if (targetGithubUrl && normalizedJD) {
          try {
            const jdSkillNames = (normalizedJD.requiredSkills || []).map((s: any) => typeof s === 'string' ? s : s.name);
            githubAnalysis = await Promise.race([
              PublicGitHubAnalyzer.analyzePublicProfile(targetGithubUrl, jdSkillNames),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
            ]);
          } catch (err: any) {
            logger.warn(`[InterviewService] GitHub analysis failed (${err.message}). Proceeding without GitHub context.`);
          }
        }

        if (normalizedJD) {
          try {
            generatedPlan = await QuestionEngine.generateQuestions(
              normalizedJD,
              (normalizedResume || undefined) as any,
              candidateName,
              githubAnalysis || undefined
            );
          } catch (err: any) {
            logger.warn(`[InterviewService] QuestionEngine synthesis failed (${err.message}). Using fallback question.`);
          }
        }

        const ghSummary = githubAnalysis?.canonicalSummary;

        activePrompt = `You are an expert AI Interviewer conducting a personalized, evidence-grounded interview for: "${jd.title}".

--------------------------------------------------
📋 JOB DESCRIPTION INTELLIGENCE (WHAT TO TEST)
--------------------------------------------------
Job Title: ${jd.title}
Summary: ${jd.aiSummary || 'Standard role requirements.'}

--------------------------------------------------
📄 CANDIDATE RESUME EVIDENCE (CANDIDATE CLAIMS)
--------------------------------------------------
Candidate Name: ${candidateName}
Resume Summary: ${resume?.aiSummary || 'Resume provided.'}

--------------------------------------------------
🐙 CANONICAL GITHUB GROUND-TRUTH (WHAT CANDIDATE ACTUALLY BUILT)
--------------------------------------------------
${githubAnalysis ? `GitHub Profile: @${githubAnalysis.username} (${githubAnalysis.analyzedRepos.length} public repos analyzed)
Archetype: ${ghSummary?.primaryArchetype || 'Software Engineer'}
Executive Architecture Summary: ${ghSummary?.executiveSummary || 'Public repos statically evaluated.'}

Flagship Projects Actually Built:
${(ghSummary?.flagshipProjects || []).map((p: any) => `• [${p.repoName}] (${p.primaryLanguage}, ${p.codeMaturity}):
   Architecture Pipeline: ${p.endToEndArchitecture}
   Key Technologies: ${p.keyTechnologies.join(', ')}
   Design Patterns: ${p.designPatterns.join(', ')} | Tests: ${p.hasTests} | Docker: ${p.hasDocker}
   Key Decisions: ${p.verifiedArchitecturalDecisions.join('; ')}`).join('\n\n') || 'None'}

Targeted Architectural Probes Grounded in Code:
${(ghSummary?.suggestedArchitectureProbes || []).map((p: any) => `• [${p.repoName}]: "${p.question}"`).join('\n') || 'None'}

INSTRUCTION & PRIORITY ORDER:
1. PRIORITY 1 — JD Competencies: Ensure candidate has real depth in the core skills and responsibilities demanded by "${jd.title}".
2. PRIORITY 2 — GitHub Code: Probe their actual architecture, libraries, data layers, and design decisions from the repositories above.
3. PRIORITY 3 — Resume Claims: Challenge claims and metrics to confirm authentic authorship and deep understanding.
Conduct a thorough back-and-forth technical inquiry over this 30-minute session. Ask conceptual, tricky depth questions (concurrency, trade-offs, failure modes, under-the-hood behavior) to verify whether they have genuine mastery or surface familiarity. Never ask trivia puzzles.` : 'No public GitHub profile provided. Focus on JD requirements as Priority 1 and Resume project claims as Priority 2.'}
`;
      }
    }

    // Initialize Evidence Graph, Gaps, and Claims
    const initialGraph = EvidenceGraphBuilder.buildInitialGraph({
      normalizedJD,
      normalizedResume,
      githubAnalysis,
    });

    const initialGaps = EvidenceGapEngine.calculateGaps({
      normalizedJD,
      normalizedResume,
      githubAnalysis,
      evidenceGraph: initialGraph,
    });

    const initialClaims = ResumeClaimVerifier.extractClaims(normalizedResume);

    // Select opening question strategy via Adaptive Engine
    const firstPlan = AdaptiveInterviewEngine.selectNextAction({
      gaps: initialGaps,
      claims: initialClaims,
      githubAnalysis,
      previousQuestions: [],
      turnIndex: 0,
      timeRemainingMinutes: 30,
    });

    if (generatedPlan && generatedPlan.questions && generatedPlan.questions.length > 0) {
      const topQ = generatedPlan.questions[0].question;
      firstQuestion = `Hello ${candidateName}, welcome to your interview for the ${invitationRecord?.jobDescription?.title || 'position'} role! To begin, ${topQ.charAt(0).toLowerCase() + topQ.slice(1)}`;
    } else {
      firstQuestion = `Welcome ${candidateName}! To start off our interview for the ${invitationRecord?.jobDescription?.title || 'position'}, could you walk me through a recent project that highlights your core technical strengths?`;
    }

    // Deterministic Question Guardrail Validation
    const guardrailCheck = QuestionGuardrailValidator.validateQuestion({
      questionText: firstQuestion,
      targetCompetency: firstPlan.targetCompetency,
      purpose: firstPlan.purpose,
      sourceContext: firstPlan.sourceContext,
      previousQuestions: [],
    });

    if (!guardrailCheck.isValid) {
      logger.warn(`[QuestionGuardrail] Opening question rejected (${guardrailCheck.rejectionReason}). Using standard fallback.`);
      firstQuestion = `Welcome ${candidateName}! To start off our interview for the ${invitationRecord?.jobDescription?.title || 'position'}, could you walk me through a recent project that highlights your technical strengths?`;
    }

    const session = await prisma.interviewSession.create({
      data: {
        candidateName: sanitizeForPostgres(candidateName),
        candidateEmail: candidateEmail ? sanitizeForPostgres(candidateEmail) : null,
        githubUrl: providedGithubUrl || invitationRecord?.githubUrl || null,
        status: 'IN_PROGRESS',
        questionBlueprint: sanitizeForPostgres(generatedPlan) as any,
        evidenceGraph: sanitizeForPostgres(initialGraph) as any,
        evidenceGaps: sanitizeForPostgres(initialGaps) as any,
        verifiedClaims: sanitizeForPostgres(initialClaims) as any,
        githubEvidence: sanitizeForPostgres(githubAnalysis) as any,
      },
    });

    if (invitationId && invitationRecord) {
      await prisma.interviewInvitation.update({
        where: { id: invitationId },
        data: {
          interviewSessionId: session.id,
          status: 'IN_PROGRESS',
        },
      });
    }

    // Save System Message & Assistant Opening Question
    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.system,
        content: sanitizeForPostgres(activePrompt),
      },
    });

    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.assistant,
        content: sanitizeForPostgres(firstQuestion),
      },
    });

    return {
      sessionId: session.id,
      question: firstQuestion,
      questionPlan: generatedPlan,
      evidenceGaps: initialGaps,
    };
  }

  /**
   * Processes candidate spoken response or live code submission, updates Evidence Graph & Evidence Gaps, checks contradictions, and selects adaptive reply.
   */
  static async respondToInterview(
    sessionId: string,
    userText: string,
    latencyMetrics?: { silenceDurationSec?: number; ttsDurationSec?: number },
    codeSubmission?: { code: string; language?: string; challengeId?: string; repoName?: string }
  ) {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.status === 'COMPLETED') throw new AppError('Session already completed', 400);

    const lastMessage = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;
    const aiQuestion = lastMessage && lastMessage.role === 'assistant' ? lastMessage.content : 'Targeted technical scenario';

    // Retrieve active blueprint & coding challenge state
    let blueprint: any = (session.questionBlueprint as any) || {};
    let codeChallengeState: any = blueprint.codeChallengeState || { status: 'PENDING' };

    let evalData: any;
    let effectiveUserText = userText;

    // --- RULE-BASED ANSWER INTEGRITY GUARD ---
    // Deterministic inspection for prompt injection, score manipulation, and evaluator overrides.
    // Zero external APIs, zero LLM calls, zero network requests.
    const integrityCheck = AnswerIntegrityGuard.check(effectiveUserText);
    const isIntegrityViolation = integrityCheck.decision === 'BLOCK';

    if (isIntegrityViolation) {
      logger.warn(
        `[AnswerIntegrityGuard] Candidate answer BLOCKED in session ${sessionId}. Signals: [${integrityCheck.signals.join(
          ', '
        )}], Patterns: [${integrityCheck.matchedPatterns.join(', ')}], Risk Score: ${integrityCheck.riskScore}`
      );

      // Deterministic fallback evaluation - DO NOT SEND TO OPENAI EVALUATOR
      evalData = {
        technicalAccuracy: 1,
        technicalDepth: 1,
        clarity: 1,
        problemSolving: 1,
        feedback: `Candidate answer flagged by Answer Integrity Guard for attempted evaluation manipulation: ${integrityCheck.matchedPatterns.join(', ')}`,
      };

      // Flag session integrity violation in database
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          cheatCount: { increment: 1 },
        },
      });
    } else if (blueprint.isDemo) {
      // Demo interview: ZERO OpenAI calls for answer evaluation
      evalData = {
        technicalAccuracy: 8,
        technicalDepth: 8,
        clarity: 8,
        problemSolving: 8,
        feedback: 'Candidate technical response provided in demo interview.',
      };
    } else if (codeSubmission && codeSubmission.code) {
      // Evaluate Candidate's Typed Code Implementation against Senior Rubric
      evalData = await OpenAIService.evaluateCodeSubmission(
        codeChallengeState.challenge || { title: 'Code Challenge', functionName: 'hashToken' },
        codeSubmission.code,
        codeSubmission.language || 'typescript',
        codeSubmission.repoName || codeChallengeState.challenge?.repoName || 'claimed repository'
      );

      codeChallengeState = {
        ...codeChallengeState,
        status: 'CODE_SUBMITTED',
        submittedCode: codeSubmission.code,
        codeEval: evalData,
      };

      if (!effectiveUserText.includes('```')) {
        effectiveUserText = `[Submitted Code Implementation for ${codeChallengeState.challenge?.functionName || 'function'}]:\n\`\`\`${codeSubmission.language || 'typescript'}\n${codeSubmission.code}\n\`\`\``;
      }
    } else {
      // Transition follow-up state if candidate is answering code follow-ups
      if (codeChallengeState.status === 'CODE_SUBMITTED') {
        codeChallengeState.status = 'FOLLOW_UP_1_DONE';
      } else if (codeChallengeState.status === 'FOLLOW_UP_1_DONE') {
        codeChallengeState.status = 'FOLLOW_UP_2_DONE';
      }

      // Micro-evaluate candidate's technical spoken answer
      evalData = await OpenAIService.evaluateSingleAnswer(aiQuestion, effectiveUserText);
    }

    const toIntScore = (val: any): number | undefined => {
      if (val === undefined || val === null) return undefined;
      const num = Math.round(Number(val));
      return isNaN(num) ? undefined : Math.min(10, Math.max(1, num));
    };

    // Save user response with technical micro-evaluation scores and response latency
    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.user,
        content: effectiveUserText,
        technicalAccuracy: toIntScore(evalData?.technicalAccuracy ?? evalData?.accuracy ?? evalData?.clarity),
        technicalDepth: toIntScore(evalData?.technicalDepth ?? evalData?.depth ?? evalData?.warmth),
        clarity: toIntScore(evalData?.clarity ?? evalData?.simplicity),
        problemSolving: toIntScore(evalData?.problemSolving ?? evalData?.fluency ?? evalData?.engagement),
        silenceLatency: latencyMetrics?.silenceDurationSec !== undefined ? Number(latencyMetrics.silenceDurationSec) : null,
        ttsDuration: latencyMetrics?.ttsDurationSec !== undefined ? Number(latencyMetrics.ttsDurationSec) : null,
      },
    });

    const userMessages = session.messages.filter((m) => m.role === 'user');
    const userMessageCount = userMessages.length + 1;

    // Fast-path for 10-Question Demo Interview: ZERO OpenAI calls
    if (blueprint.isDemo) {
      let aiReply = '';
      let shouldCutoff = false;

      if (userMessageCount < DEMO_STATIC_QUESTIONS.length) {
        const nextQuestion = DEMO_STATIC_QUESTIONS[userMessageCount];
        aiReply = `Great! Let's move on to the next question: ${nextQuestion}`;
        shouldCutoff = false;
        blueprint.currentQuestionIndex = userMessageCount;
      } else {
        aiReply = "Great! Thank you for completing all 10 questions of this demo interview. Your responses and all proctoring signals have been fully recorded.";
        shouldCutoff = true;
        blueprint.currentQuestionIndex = DEMO_STATIC_QUESTIONS.length;
      }

      // Save assistant message in DB
      await prisma.message.create({
        data: {
          interviewSessionId: session.id,
          role: Role.assistant,
          content: aiReply,
        },
      });

      // Update blueprint and session status in DB
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: {
          questionBlueprint: blueprint,
          status: shouldCutoff ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });

      // If Turn 10 cutoff reached, immediately compute and save full evaluation report in DB
      if (shouldCutoff) {
        try {
          await InterviewService.evaluateSession(session.id);
        } catch (evalErr) {
          logger.error(`[DemoInterview] Auto-evaluation on Turn 10 completion error for session ${session.id}:`, evalErr);
        }
      }

      logger.info(`[DemoInterview] Session ${session.id} Turn ${userMessageCount}/${DEMO_STATIC_QUESTIONS.length}. Cutoff: ${shouldCutoff}. Evaluation Saved: ${shouldCutoff}. Zero OpenAI calls.`);

      return {
        reply: aiReply,
        cutoff: shouldCutoff,
        shouldCutoff,
        isDemo: true,
        questionNumber: Math.min(userMessageCount + 1, DEMO_STATIC_QUESTIONS.length),
        totalQuestions: DEMO_STATIC_QUESTIONS.length,
      };
    }

    // Calculate wall-clock elapsed minutes since the candidate began their first response
    const firstUserMsg = session.messages.find((m) => m.role === 'user');
    const interviewStartTime = firstUserMsg ? new Date(firstUserMsg.createdAt).getTime() : new Date(session.createdAt).getTime();
    const elapsedMinutes = (Date.now() - interviewStartTime) / 60000;
    const timeRemainingMinutes = Math.max(1, Math.round(30 - elapsedMinutes));

    // Retrieve active Evidence State
    let currentGraph: any = session.evidenceGraph || { nodes: [], edges: [] };
    let currentGaps: any = session.evidenceGaps || [];
    let currentClaims: any = session.verifiedClaims || [];
    const githubAnalysis: any = session.githubEvidence || null;

    // 1. Update Evidence Graph with candidate response turn
    currentGraph = EvidenceGraphBuilder.addInterviewTurn(currentGraph, {
      questionId: `turn-${userMessageCount}`,
      questionText: aiQuestion,
      competency: codeSubmission ? 'Code Quality & Implementation' : 'Technical Requirement',
      sourceType: codeSubmission ? 'GITHUB' : 'INTERVIEW',
      answerText: effectiveUserText,
      microEval: {
        clarity: evalData?.clarity,
        warmth: evalData?.warmth,
        simplicity: evalData?.simplicity,
        patience: evalData?.patience,
        fluency: evalData?.fluency,
        engagement: evalData?.engagement,
        technicalDepth: (evalData?.clarity || 0) >= 4 ? 'DEEP' : 'BASIC',
        reasoning: evalData?.feedback || 'Evaluated answer',
      },
    });

    // 2. Update Claims & Detect Contradictions
    currentClaims = ResumeClaimVerifier.updateClaimsWithInterview(currentClaims, {
      questionText: aiQuestion,
      answerText: effectiveUserText,
      microEval: evalData,
    });

    const allTurns = [
      ...userMessages.map((m) => ({ questionText: 'Previous probe', answerText: m.content })),
      { questionText: aiQuestion, answerText: effectiveUserText, microEval: evalData },
    ];

    const detectedContradictions = ContradictionDetector.detectContradictions({
      normalizedResume: undefined,
      githubAnalysis,
      interviewTurns: allTurns,
    });

    const aiFluencyEval = AIFluencyEvaluator.evaluateAIFluency(allTurns);

    // 3. Select Next Adaptive Action (integrates live code challenge + 2 follow-ups)
    const nextPlan = AdaptiveInterviewEngine.selectNextAction({
      gaps: currentGaps,
      claims: currentClaims,
      githubAnalysis,
      previousQuestions: session.messages.filter((m) => m.role === 'assistant').map((m) => m.content),
      turnIndex: userMessageCount,
      timeRemainingMinutes,
      codeChallengeState,
      candidateName: session.candidateName,
    });

    if (nextPlan.action === 'LIVE_CODE_CHALLENGE' && nextPlan.codeChallenge) {
      codeChallengeState = {
        status: 'CHALLENGE_ISSUED',
        challenge: nextPlan.codeChallenge,
      };
    }

    blueprint.codeChallengeState = codeChallengeState;

    let shouldCutoff = nextPlan.shouldStop;

    // Build LLM Chat Context
    const aiContext = session.messages.map((m) => ({ role: m.role, content: m.content }));
    aiContext.push({ role: 'user', content: effectiveUserText });

    if (shouldCutoff) {
      aiContext.push({
        role: 'system',
        content: `SYSTEM INSTRUCTION: ${nextPlan.promptInstructions} Conclude the 30-minute technical interview professionally in one concise, gracious sentence.`,
      });
    } else {
      aiContext.push({
        role: 'system',
        content: `SYSTEM INSTRUCTION: Target competency: "${nextPlan.targetCompetency}". Action: "${nextPlan.action}".
Conversational Tone ("To and Fro"): Engage in a natural back-and-forth dialogue. Briefly acknowledge or challenge the candidate's last answer (e.g. 'You mentioned using X for Y...'), then seamlessly transition into your next question.
Question Depth: Ask a conceptually tricky, realistic probe testing how things work under the hood, edge cases, race conditions, or architecture trade-offs. Avoid generic definitions ("what is X") and avoid artificial trick brainteasers.
Directives: ${nextPlan.promptInstructions}
Keep spoken response concise and natural (2-3 sentences max).`,
      });
    }

    let aiReply = '';
    if (isIntegrityViolation) {
      // SKIP sending candidate answer to LLM and move immediately to the next question
      if (nextPlan.action === 'LIVE_CODE_CHALLENGE' && nextPlan.codeChallenge) {
        aiReply = `Let's proceed directly to the technical challenge. In repository "${nextPlan.codeChallenge.repoName}", please implement "${nextPlan.codeChallenge.functionName}" using the live code editor on your screen.`;
      } else {
        aiReply = `Let's move on to our next technical topic. Regarding ${nextPlan.targetCompetency}, could you walk me through your engineering design, trade-offs, and how you handle failure modes in production?`;
      }
    } else {
      try {
        if (nextPlan.action === 'LIVE_CODE_CHALLENGE' && nextPlan.codeChallenge) {
          aiReply = `In your repository "${nextPlan.codeChallenge.repoName}", you implemented authentication and service logic. I'd like you to write a clean implementation of the "${nextPlan.codeChallenge.functionName}" function using the live code editor on your screen. Submit when ready.`;
        } else {
          aiReply = await OpenAIService.getChatCompletion(aiContext);
        }
      } catch (err: any) {
        logger.error(`[InterviewService] Chat completion failed: ${err.message}. Using fallback reply.`);
        if (shouldCutoff) {
          aiReply = 'Thank you for sharing your experience. We have gathered sufficient technical evidence for today.';
        } else if (nextPlan.action === 'LIVE_CODE_CHALLENGE' && nextPlan.codeChallenge) {
          aiReply = `In your repository "${nextPlan.codeChallenge.repoName}", please implement "${nextPlan.codeChallenge.functionName}" in the live code editor on your screen.`;
        } else if (nextPlan.action === 'CODE_FOLLOW_UP_1') {
          aiReply = `Thanks for submitting that implementation. Looking at your code, what is the algorithmic time complexity, and how does it handle edge cases like null or empty inputs?`;
        } else if (nextPlan.action === 'CODE_FOLLOW_UP_2') {
          aiReply = `In your claimed repository, how did you integrate this function into your production pipeline, and what unit tests did you write to verify edge cases?`;
        } else {
          aiReply = `Regarding ${nextPlan.targetCompetency}, walk me through how you handled system trade-offs or edge-case failures in production?`;
        }
      }
    }

    // Validate generated question via Question Guardrails
    if (!shouldCutoff && nextPlan.action !== 'LIVE_CODE_CHALLENGE') {
      const guardrailCheck = QuestionGuardrailValidator.validateQuestion({
        questionText: aiReply,
        targetCompetency: nextPlan.targetCompetency,
        purpose: nextPlan.purpose,
        sourceContext: nextPlan.sourceContext,
        previousQuestions: session.messages.filter((m) => m.role === 'assistant').map((m) => m.content),
        timeRemainingMinutes,
      });

      if (!guardrailCheck.isValid) {
        logger.warn(`[QuestionGuardrail] Question rejected (${guardrailCheck.rejectionReason}). Regenerating fallback probe.`);
        aiReply = `Could you give me a specific technical example of how you implemented ${nextPlan.targetCompetency} in your past work?`;
      }
    }

    // Save Assistant Response
    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.assistant,
        content: aiReply,
      },
    });

    // Append per-question response latency
    const prevLatencies = Array.isArray(session.responseLatencies) ? (session.responseLatencies as any[]) : [];
    const updatedLatencies = [
      ...prevLatencies,
      {
        turn: userMessageCount,
        question: aiQuestion,
        silenceDurationSec: latencyMetrics?.silenceDurationSec || 0,
        ttsDurationSec: latencyMetrics?.ttsDurationSec || 0,
        timestamp: new Date().toISOString(),
      },
    ];

    // Update Session Evidence State & Blueprint in DB
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        questionBlueprint: blueprint as any,
        evidenceGraph: currentGraph as any,
        evidenceGaps: currentGaps as any,
        verifiedClaims: currentClaims as any,
        contradictions: detectedContradictions as any,
        aiFluency: aiFluencyEval as any,
        responseLatencies: updatedLatencies as any,
      },
    });

    const isCodingQuestion =
      !!nextPlan.codeChallenge ||
      nextPlan.action === 'LIVE_CODE_CHALLENGE' ||
      /\b(write|implement|code|code challenge|coding challenge|write a function|solve in code|create a function|implement a function|typescript function|javascript function)\b/i.test(aiReply);

    let effectiveCodeChallenge = nextPlan.codeChallenge || null;
    if (isCodingQuestion && !effectiveCodeChallenge) {
      effectiveCodeChallenge = {
        id: `challenge-${Date.now()}`,
        title: 'Technical Implementation Challenge',
        repoName: 'technical-assessment',
        functionName: 'solveChallenge',
        language: 'typescript',
        description: aiReply,
        expectedBehavior: 'Clean, production-ready solution handling edge cases.',
        starterCode: `// Write your implementation below\nfunction solveChallenge() {\n  // TODO\n}\n`,
      };
    }

    return {
      reply: aiReply,
      cutoff: shouldCutoff,
      evidenceGaps: currentGaps,
      codeChallenge: effectiveCodeChallenge,
      coding: isCodingQuestion,
    };
  }

  /**
   * Completes session and computes comprehensive Evidence Report.
   */
  static async evaluateSession(
    sessionId: string,
    videoEngagementScore?: number,
    cheatFlags?: string[],
    eyeTrackingTelemetry?: any
  ) {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        invitation: { include: { jobDescription: true } },
      },
    });

    if (!session) throw new AppError('Session not found', 404);

    const apiMessages = session.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
    const userMessageCount = apiMessages.filter((m) => m.role === 'user').length;

    const blueprint: any = (session.questionBlueprint as any) || {};
    const isDemo = Boolean(blueprint.isDemo);

    let evaluation: any;
    if (isDemo) {
      evaluation = {
        clarity: { score: 8, reasoning: 'Candidate answered foundational Computer Science questions with clarity.' },
        warmth: { score: 8, reasoning: 'Approachable and conversational tone exhibited.' },
        simplicity: { score: 8, reasoning: 'Simplified core programming concepts effectively.' },
        patience: { score: 9, reasoning: 'Answered all 10 questions methodically and patiently.' },
        fluency: { score: 8, reasoning: 'Fluent articulation of technical thoughts and terms.' },
        engagement: { score: 8, reasoning: 'Engaged throughout the 10 static CS questions.' },
        technicalDepth: { score: 8, reasoning: 'Demonstrated solid grasp of core Computer Science fundamentals (variables, data types, loops, OOP, data structures).' },
        systemArchitecture: { score: 8, reasoning: 'Understands programmatic structures, functions, and database organization.' },
        problemSolving: { score: 8, reasoning: 'Structured and logical problem-solving approach.' },
        codeQuality: { score: 8, reasoning: 'Clean conceptual answers adhering to best practices like DRY.' },
        technicalCommunication: { score: 8, reasoning: 'Clear communication of technical concepts using everyday analogies.' },
        claimVerification: { score: 8, reasoning: 'Demo interview verification complete.' },
        overallFeedback: 'Demo interview completed successfully with all 10 foundational Computer Science questions answered.',
        summary: 'Demo interview completed successfully with all 10 foundational Computer Science questions answered. Candidate demonstrated consistent articulation and systematic communication.',
        feedback: 'Demo interview completed successfully with all 10 foundational Computer Science questions answered.',
        overallScore: 48,
        overallRecommendation: 'PASS',
        keyHighlights: [
          'Completed all 10 foundational Computer Science questions',
          'Demonstrated clear understanding of variables, loops, functions, and OOP',
          'Methodical communication with zero latency'
        ],
        evidenceQuotes: [
          'Candidate demonstrated clear articulation of core CS concepts across all 10 prompts.'
        ],
        isDemo: true,
      };
    } else if (userMessageCount === 0) {
      // Short-circuit: Candidate answered zero questions. Deterministic rejection without OpenAI API call.
      evaluation = {
        technicalAccuracy: { score: 0, reasoning: 'No candidate answers recorded.' },
        technicalDepth: { score: 0, reasoning: 'No candidate answers recorded.' },
        clarity: { score: 0, reasoning: 'No candidate answers recorded.' },
        problemSolving: { score: 0, reasoning: 'No candidate answers recorded.' },
        systemArchitecture: { score: 0, reasoning: 'No candidate answers recorded.' },
        codeQuality: { score: 0, reasoning: 'No candidate answers recorded.' },
        technicalCommunication: { score: 0, reasoning: 'No candidate answers recorded.' },
        claimVerification: { score: 0, reasoning: 'No candidate answers recorded.' },
        overallFeedback: 'Candidate concluded or exited session before answering any interview questions.',
        summary: 'Session was closed prematurely with zero recorded responses.',
        overallScore: 0,
        overallRecommendation: 'REJECTED',
        keyHighlights: ['Session ended prematurely with no answers provided.'],
        riskFlags: ['Zero candidate responses recorded during the interview session.'],
      };
    } else {
      evaluation = await OpenAIService.evaluateInterview(apiMessages, userMessageCount, {
        githubEvidence: session.githubEvidence,
        contradictions: (session.contradictions as any[]) || [],
      });
    }

    if (videoEngagementScore !== undefined && typeof videoEngagementScore === 'number' && evaluation.engagement) {
      evaluation.engagement.score = videoEngagementScore;
      evaluation.engagement.reasoning = `(Visual Override) Camera tracking detected ${videoEngagementScore * 10}% visual engagement during the session.`;
    }

    const mobileCount = cheatFlags ? cheatFlags.filter((f) => f === 'MOBILE_PHONE' || f === 'UNAUTHORIZED_DEVICE').length : 0;
    const absentCount = cheatFlags ? cheatFlags.filter((f) => f === 'ABSENT_USER' || f === 'FACE_MISSING' || f === 'FACE_ABSENCE').length : 0;
    const concealedPhoneCount = cheatFlags ? cheatFlags.filter((f) => f === 'CONCEALED_PHONE_GAZE').length : 0;
    const readingPatternCount = cheatFlags ? cheatFlags.filter((f) => f === 'OFF_SCREEN_READING').length : 0;
    const cornerGlancesCount = cheatFlags ? cheatFlags.filter((f) => f === 'SUSPICIOUS_CORNER_GLANCES').length : 0;

    const computedMisconductScore =
      mobileCount * 2 +
      concealedPhoneCount * 2 +
      absentCount * 1 +
      readingPatternCount * 1 +
      cornerGlancesCount * 1;

    const misconductScore = Math.max(session.cheatCount || 0, computedMisconductScore);

    // Correlate multi-signal proctoring events from session and resolve S3 presigned URLs
    const detectionEvents = await prisma.detectionEvent.findMany({
      where: { interviewSessionId: sessionId },
      orderBy: { timestamp: 'asc' },
    });

    const enhancedEvents = await Promise.all(
      detectionEvents.map(async (evt) => {
        const meta = typeof evt.metadata === 'string'
          ? (() => { try { return JSON.parse(evt.metadata); } catch { return {}; } })()
          : (evt.metadata || {});

        let presignedSnapshotUrl = meta.snapshot || null;
        if (meta.snapshotKey && typeof meta.snapshotKey === 'string') {
          try {
            const signed = await S3Service.getPresignedUrl(meta.snapshotKey);
            if (signed) {
              presignedSnapshotUrl = signed;
            }
          } catch (err: any) {
            // Keep existing fallback
          }
        }

        return {
          ...evt,
          metadata: {
            ...meta,
            snapshot: presignedSnapshotUrl,
            snapshotUrl: presignedSnapshotUrl,
          },
        };
      })
    );

    const sessionStartTime = session.messages.length > 0
      ? new Date(session.messages[0].createdAt).getTime()
      : new Date(session.createdAt).getTime();

    const proctoringAnalysis = ProctoringCorrelationEngine.processSessionEvents({
      sessionId: session.id,
      events: enhancedEvents.map((evt) => ({
        id: evt.id,
        sessionId: evt.interviewSessionId,
        type: evt.eventType as any,
        timestamp: new Date(evt.timestamp).getTime(),
        durationMs: evt.durationMs || undefined,
        confidence: evt.confidence !== null ? evt.confidence : undefined,
        source: evt.source || 'SYSTEM_MONITOR',
        questionId: evt.questionId || undefined,
        answerId: evt.answerId || undefined,
        metadata: evt.metadata ? (typeof evt.metadata === 'string' ? (()=>{ try { return JSON.parse(evt.metadata); } catch { return {}; } })() : evt.metadata) : undefined,
      })),
      messages: session.messages,
      sessionStartTime,
    });

    // Count pattern events from actual database detection events if cheatFlags array was empty
    const dbConcealedPhone = detectionEvents.filter((e) => e.eventType === 'CONCEALED_PHONE_GAZE').length;
    const dbReadingPattern = detectionEvents.filter((e) => e.eventType === 'OFF_SCREEN_READING').length;
    const dbCornerGlances = detectionEvents.filter((e) => e.eventType === 'SUSPICIOUS_CORNER_GLANCES').length;
    const dbMobileCount = detectionEvents.filter((e) => e.eventType === 'UNAUTHORIZED_DEVICE').length;
    const dbAbsentCount = detectionEvents.filter((e) => e.eventType === 'FACE_MISSING' || e.eventType === 'FACE_ABSENCE').length;

    const totalMobile = Math.max(mobileCount, dbMobileCount);
    const totalAbsent = Math.max(absentCount, dbAbsentCount);
    const totalConcealed = Math.max(concealedPhoneCount, dbConcealedPhone);
    const totalReading = Math.max(readingPatternCount, dbReadingPattern);
    const totalGlances = Math.max(cornerGlancesCount, dbCornerGlances);

    evaluation.proctoringSummary = {
      misconductScore,
      mobilePhoneCount: totalMobile,
      absenceCount: totalAbsent,
      concealedPhoneCount: totalConcealed,
      readingPatternCount: totalReading,
      cornerGlancesCount: totalGlances,
      factualSummary: proctoringAnalysis.summary,
    };

    if (misconductScore > 0 || totalMobile > 0 || totalConcealed > 0 || totalAbsent > 0 || totalReading > 0) {
      const customFlags = [];
      if (totalMobile > 0) customFlags.push(`Observation: Unauthorized device detected ${totalMobile} time(s).`);
      if (totalConcealed > 0) customFlags.push(`Observation: Concealed downward phone gaze posture observed ${totalConcealed} time(s).`);
      if (totalReading > 0) customFlags.push(`Observation: Off-screen reading pattern observed ${totalReading} time(s).`);
      if (totalGlances > 0) customFlags.push(`Observation: Off-camera glances observed ${totalGlances} time(s).`);
      if (totalAbsent > 0) customFlags.push(`Observation: Candidate briefly out of camera frame ${totalAbsent} time(s).`);

      evaluation.riskFlags = [...(evaluation.riskFlags || []), ...customFlags];
      evaluation.overallRecommendation = 'FLAGGED';
    }

    // Check for unverified GitHub claims or contradictions
    const sessionContradictions = (session.contradictions as any[]) || [];
    const githubDiscrepancies = sessionContradictions.filter(
      (c: any) => c.type === 'POTENTIAL_OWNERSHIP_MISMATCH' || (c.sources && c.sources.includes('GITHUB'))
    );

    if (githubDiscrepancies.length > 0 || evaluation.githubVerificationSummary?.verified === false) {
      const githubFlags = githubDiscrepancies.map(
        (g: any) => `⚠️ GITHUB DISCREPANCY: ${g.explanation || 'Claimed repository ownership could not be verified'}`
      );
      if (githubFlags.length === 0 && evaluation.githubVerificationSummary?.details) {
        githubFlags.push(`⚠️ GITHUB DISCREPANCY: ${evaluation.githubVerificationSummary.details}`);
      }

      evaluation.riskFlags = [...(evaluation.riskFlags || []), ...githubFlags];
      
      // Heavily penalize claim verification and set overall recommendation if unverified
      if (evaluation.claimVerification) {
        evaluation.claimVerification.score = Math.min(evaluation.claimVerification.score, 3);
        evaluation.claimVerification.reasoning += ' Penalized due to inability to verify claimed GitHub repository/code.';
      }
      if (evaluation.technicalDepth && evaluation.technicalDepth.score > 5) {
        evaluation.technicalDepth.score = Math.max(3, evaluation.technicalDepth.score - 2);
      }

      if (evaluation.overallRecommendation === 'PASS') {
        evaluation.overallRecommendation = 'FLAGGED';
      }
    }

    // Build Final Evidence Report
    const evidenceReport = {
      evidenceGraph: session.evidenceGraph,
      evidenceGaps: session.evidenceGaps,
      verifiedClaims: session.verifiedClaims,
      contradictions: session.contradictions,
      githubEvidence: session.githubEvidence,
      githubVerificationSummary: evaluation.githubVerificationSummary || null,
      aiFluency: session.aiFluency,
      eyeTrackingData: eyeTrackingTelemetry || session.eyeTrackingData,
      responseLatencies: session.responseLatencies,
      proctoringSummary: proctoringAnalysis.summary,
      proctoringTimeline: proctoringAnalysis.timeline,
      correlatedObservations: proctoringAnalysis.observations,
      detectionEvents: enhancedEvents,
      interviewCoverage: {
        totalTurns: userMessageCount,
        mandatoryVerified: Array.isArray(session.evidenceGaps)
          ? session.evidenceGaps.filter((g: any) => g.importance === 'MANDATORY' && g.status === 'VERIFIED').length
          : 0,
        unresolvedGaps: Array.isArray(session.evidenceGaps)
          ? session.evidenceGaps.filter((g: any) => g.status === 'UNVERIFIED' || g.status === 'NO_EVIDENCE').length
          : 0,
      },
    };

    const computedTotalScore =
      (evaluation.technicalDepth?.score || evaluation.clarity?.score || 0) +
      (evaluation.systemArchitecture?.score || evaluation.warmth?.score || 0) +
      (evaluation.problemSolving?.score || evaluation.simplicity?.score || 0) +
      (evaluation.codeQuality?.score || evaluation.patience?.score || 0) +
      (evaluation.technicalCommunication?.score || evaluation.fluency?.score || 0) +
      (evaluation.claimVerification?.score || evaluation.engagement?.score || 0);

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        cheatCount: misconductScore,
        evaluationData: evaluation,
        evidenceReport: evidenceReport as any,
        eyeTrackingData: (eyeTrackingTelemetry || session.eyeTrackingData) as any,
        proctoringSummary: proctoringAnalysis.summary as any,
        proctoringTimeline: proctoringAnalysis.timeline as any,
        overallRecommendation: evaluation.overallRecommendation || (isDemo ? 'PASS' : 'UNKNOWN'),
        totalScore: computedTotalScore,
      },
    });

    // Mark linked invitation as COMPLETED and set completedAt to lock retakes
    await prisma.interviewInvitation.updateMany({
      where: {
        OR: [
          { interviewSessionId: sessionId },
          ...(session.invitation?.id ? [{ id: session.invitation.id }] : [])
        ]
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Dispatch "test done" confirmation email to candidate (recruiter alone sees the full report)
    if (!isDemo) {
      const recipientEmail = session.candidateEmail || session.invitation?.applicantEmail;
      if (recipientEmail) {
        EmailService.sendTestCompletedEmail(
          recipientEmail,
          session.candidateName,
          session.invitation?.jobDescription?.title
        ).catch((err: any) => {
          logger.warn(`Failed to dispatch test completion email for ${sessionId}: ${err.message}`);
        });
      }
    }

    return {
      ...evaluation,
      isDemo,
      evidenceReport,
      detectionEvents: enhancedEvents,
      eyeTrackingData: eyeTrackingTelemetry || session.eyeTrackingData,
    };
  }

  static async concludeEarlyAndReject(sessionId: string, reason: string = 'Candidate concluded interview early before completing all questions.') {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        invitation: {
          include: {
            jobDescription: { select: { title: true } }
          }
        },
        messages: { orderBy: { createdAt: 'asc' } },
      }
    });

    if (!session) throw new AppError('Session not found', 404);

    const deterministicEval = {
      overallRecommendation: 'REJECTED',
      overallScore: 0,
      totalScore: 0,
      summary: `Interview concluded early by candidate. ${reason}`,
      feedback: `Candidate concluded the interview session prematurely. Application marked as REJECTED.`,
      keyHighlights: ['Interview terminated prematurely by candidate prior to completing all questions.'],
      riskFlags: ['Session concluded early by candidate.'],
      technicalAccuracy: { score: 0, reasoning: 'Interview concluded early.' },
      technicalDepth: { score: 0, reasoning: 'Interview concluded early.' },
      clarity: { score: 0, reasoning: 'Interview concluded early.' },
      problemSolving: { score: 0, reasoning: 'Interview concluded early.' },
      systemArchitecture: { score: 0, reasoning: 'Interview concluded early.' },
      codeQuality: { score: 0, reasoning: 'Interview concluded early.' },
      technicalCommunication: { score: 0, reasoning: 'Interview concluded early.' },
      claimVerification: { score: 0, reasoning: 'Interview concluded early.' },
    };

    const updatedSession = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        applicationStatus: 'REJECTED',
        overallRecommendation: 'REJECTED',
        totalScore: 0,
        evaluationData: deterministicEval,
        feedback: reason,
      },
    });

    // Mark linked invitation as COMPLETED and set completedAt to prevent retakes
    await prisma.interviewInvitation.updateMany({
      where: {
        OR: [
          { interviewSessionId: sessionId },
          ...(session.invitation?.id ? [{ id: session.invitation.id }] : [])
        ]
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Dispatch test completion confirmation email to candidate
    const recipientEmail = session.candidateEmail || session.invitation?.applicantEmail;
    const jobTitle = session.invitation?.jobDescription?.title;
    if (recipientEmail) {
      EmailService.sendTestCompletedEmail(
        recipientEmail,
        session.candidateName,
        jobTitle
      ).catch((err: any) => {
        logger.warn(`[ConcludeEarly] Failed to dispatch email for ${sessionId}: ${err.message}`);
      });
    }

    return updatedSession;
  }

  static async submitFeedback(sessionId: string, feedback: string) {
    const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);

    return await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { feedback },
    });
  }

  static async getSessionsByEmail(email: string) {
    return await prisma.interviewSession.findMany({
      where: { candidateEmail: email },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateApplicationStatus(sessionId: string, status: 'ACCEPTED' | 'REJECTED', feedbackReason?: string) {
    const session = await prisma.interviewSession.findUnique({ 
      where: { id: sessionId },
      include: {
        invitation: {
          include: {
            jobDescription: { select: { title: true } }
          }
        }
      }
    });
    if (!session) throw new AppError('Session not found', 404);

    let fraudEvaluationData = undefined;
    if (feedbackReason && status === 'REJECTED') {
      fraudEvaluationData = {
        overallRecommendation: 'TERMINATED',
        teachingStyle: 'UNAUTHORIZED',
        keyHighlights: ['Interview was concluded following candidate application review.'],
        riskFlags: [`Review Note: ${feedbackReason}`],
        clarity: { score: 0 }, warmth: { score: 0 }, simplicity: { score: 0 }, patience: { score: 0 }, fluency: { score: 0 }, engagement: { score: 0 },
      };
    }

    const updatedSession = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        applicationStatus: status,
        ...(fraudEvaluationData ? { evaluationData: fraudEvaluationData, overallRecommendation: 'TERMINATED', totalScore: 0 } : {}),
      },
    });

    const recipientEmail = session.candidateEmail || session.invitation?.applicantEmail;
    const jobTitle = session.invitation?.jobDescription?.title;

    if (recipientEmail) {
      EmailService.sendDecisionEmail(recipientEmail, status, session.candidateName, jobTitle).catch((err) => {
        console.error(`Failed to dispatch email asynchronously for ${sessionId}:`, err);
      });
    }

    return updatedSession;
  }

  static async getExplainableReport(sessionId: string) {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        detectionEvents: {
          orderBy: { timestamp: 'asc' },
        },
        invitation: {
          include: {
            jobDescription: true,
            applicantResume: true,
          },
        },
      },
    });

    if (!session) throw new AppError('Interview session not found', 404);

    // Query cohort sessions for this job role (strictly actual applicants, no synthetic data)
    let cohortScores: Array<{ totalScore: number | null; id?: string }> = [];
    if (session.invitation?.jobDescriptionId) {
      cohortScores = await prisma.interviewSession.findMany({
        where: {
          invitation: {
            jobDescriptionId: session.invitation.jobDescriptionId,
          },
        },
        select: {
          id: true,
          totalScore: true,
        },
      });
    } else {
      cohortScores = [{ id: session.id, totalScore: session.totalScore }];
    }

    // Resolve S3 presigned URLs for detection events with snapshotKey
    const enhancedEvents = await Promise.all(
      (session.detectionEvents || []).map(async (evt) => {
        const meta = typeof evt.metadata === 'string'
          ? (() => { try { return JSON.parse(evt.metadata); } catch { return {}; } })()
          : (evt.metadata || {});

        let key = meta.snapshotKey;
        if (!key && meta.snapshot && typeof meta.snapshot === 'string') {
          const match = meta.snapshot.match(/(interviews\/[^\/\?]+\/screenshot_\d+\.png)/);
          if (match) key = match[1];
        }

        let presignedSnapshotUrl = meta.snapshot || null;
        if (key && typeof key === 'string') {
          try {
            const signed = await S3Service.getPresignedUrl(key);
            if (signed) {
              presignedSnapshotUrl = signed;
            }
          } catch (err: any) {
            // Keep existing snapshot fallback
          }
        }

        return {
          ...evt,
          metadata: {
            ...meta,
            snapshot: presignedSnapshotUrl,
            snapshotUrl: presignedSnapshotUrl,
          },
        };
      })
    );

    // Also resolve S3 presigned URLs for timeline items if present
    const enhancedTimeline = await Promise.all(
      ((session.proctoringTimeline as any[]) || []).map(async (item: any) => {
        const meta = typeof item.metadata === 'string'
          ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })()
          : (item.metadata || {});

        let key = meta.snapshotKey;
        if (!key && (meta.snapshot || meta.snapshotUrl) && typeof (meta.snapshot || meta.snapshotUrl) === 'string') {
          const match = (meta.snapshot || meta.snapshotUrl).match(/(interviews\/[^\/\?]+\/screenshot_\d+\.png)/);
          if (match) key = match[1];
        }

        let presigned = meta.snapshot || meta.snapshotUrl || null;
        if (key && typeof key === 'string') {
          try {
            const signed = await S3Service.getPresignedUrl(key);
            if (signed) presigned = signed;
          } catch {}
        }

        return {
          ...item,
          metadata: {
            ...meta,
            snapshot: presigned,
            snapshotUrl: presigned,
          }
        };
      })
    );

    const blueprint: any = (session.questionBlueprint as any) || {};
    const isDemo = Boolean(blueprint.isDemo);

    const report = EvidenceProfileBuilder.buildReport({
      sessionId: session.id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      jobTitle: session.invitation?.jobDescription?.title || (isDemo ? 'Demo Technical Interview (10 CS Questions)' : 'Engineering Role'),
      overallRecommendation: session.overallRecommendation,
      totalScore: session.totalScore,
      messages: session.messages,
      detectionEvents: enhancedEvents,
      evidenceGraph: session.evidenceGraph,
      evidenceGaps: (session.evidenceGaps as any[]) || [],
      verifiedClaims: (session.verifiedClaims as any[]) || [],
      contradictions: (session.contradictions as any[]) || [],
      githubEvidence: session.githubEvidence,
      aiFluency: session.aiFluency,
      evaluationData: session.evaluationData,
      eyeTrackingData: session.eyeTrackingData,
      responseLatencies: (session.responseLatencies as any[]) || [],
      cohortScores,
    });

    return {
      ...report,
      detectionEvents: enhancedEvents,
      proctoringTimeline: enhancedTimeline,
      evaluationData: session.evaluationData,
      evidenceReport: session.evidenceReport,
      isDemo,
      jobTitle: session.invitation?.jobDescription?.title || (isDemo ? 'Demo Technical Interview (10 CS Questions)' : 'Engineering Role'),
    };
  }
}
