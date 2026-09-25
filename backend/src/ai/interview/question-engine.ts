import { CanonicalNormalizedJD } from '../jd/jd-schema';
import { CanonicalNormalizedResume } from '../resume/resume-schema';
import { GitHubProfileAnalysis } from '../evidence/evidence-types';
import {
  PersonalizedQuestion,
  QuestionGenerationPlan,
  QuestionGenerationPlanSchema,
  QuestionSource,
} from './question-schema';
import { PromptRunner } from '../core/prompt-runner';
import {
  QUESTION_ENGINE_SYSTEM_PROMPT,
  QUESTION_ENGINE_RULES,
  QUESTION_PLAN_SCHEMA_DESCRIPTION,
} from './question-prompts';
import { AIClient } from '../core/ai-client';

interface QuestionEngineInput {
  jd: CanonicalNormalizedJD;
  resume: CanonicalNormalizedResume;
  candidateName: string;
  githubAnalysis?: GitHubProfileAnalysis;
}

export class QuestionEngine {
  /**
   * Deterministic overlap and gap analyzer
   */
  static analyzeOverlapAndGaps(jd: CanonicalNormalizedJD, resume: CanonicalNormalizedResume) {
    const resumeSkillNames = new Set(
      resume.skills.map((s) => s.name.toLowerCase().trim())
    );
    const resumeTechNames = new Set(
      resume.technologies.map((t) => t.toLowerCase().trim())
    );

    const isMatch = (tech: string) => {
      const clean = tech.toLowerCase().trim();
      return resumeSkillNames.has(clean) || resumeTechNames.has(clean);
    };

    const overlapSkills: string[] = [];
    const gapSkills: string[] = [];

    for (const req of jd.requiredSkills) {
      if (isMatch(req.name)) {
        overlapSkills.push(req.name);
      } else {
        gapSkills.push(req.name);
      }
    }

    const preferredOverlap: string[] = [];
    for (const pref of jd.preferredSkills) {
      if (isMatch(pref.name)) {
        preferredOverlap.push(pref.name);
      }
    }

    return {
      overlapSkills,
      gapSkills,
      preferredOverlap,
    };
  }

  /**
   * Rule-based fallback question plan generator
   */
  private static generateFallbackPlan(input: QuestionEngineInput): QuestionGenerationPlan {
    const { jd, resume, candidateName, githubAnalysis } = input;
    const { overlapSkills, gapSkills } = this.analyzeOverlapAndGaps(jd, resume);
    const questions: PersonalizedQuestion[] = [];
    const githubProjectSummary: string[] = [];

    let qIndex = 1;

    // 1. GitHub Project Architecture questions (probe what the candidate actually built)
    const flagshipProjects = githubAnalysis?.canonicalSummary?.flagshipProjects || [];
    const suggestedProbes = githubAnalysis?.canonicalSummary?.suggestedArchitectureProbes || [];

    if (suggestedProbes.length > 0) {
      for (const probe of suggestedProbes.slice(0, 2)) {
        githubProjectSummary.push(`Grounded in repository '${probe.repoName}': ${probe.targetedSkill}`);
        questions.push({
          id: `q${qIndex++}`,
          question: probe.question,
          skill: probe.targetedSkill || 'System Architecture',
          difficulty: 'HARD',
          sources: ['JD_REQUIREMENT', 'GITHUB_PROJECT_ARCHITECTURE', 'RESUME_GITHUB_OVERLAP'],
          rationale: probe.rationale || `Probes real production architecture from candidate repository '${probe.repoName}'.`,
          suggestedEvaluationCriteria: [
            'Articulates architectural trade-offs and design constraints',
            'Explains concurrency, caching, or data persistence choices',
            'Demonstrates deep code authorship and ownership',
          ],
          followUpProbes: [
            'How would you refactor this architecture to handle a 10x surge in write traffic?',
          ],
          githubProject: probe.repoName,
        });
      }
    } else if (flagshipProjects.length > 0) {
      for (const proj of flagshipProjects.slice(0, 2)) {
        githubProjectSummary.push(`Grounded in repository '${proj.repoName}': ${proj.endToEndArchitecture}`);
        questions.push({
          id: `q${qIndex++}`,
          question: `In your repository '${proj.repoName}', you built an architecture featuring ${proj.endToEndArchitecture || proj.keyTechnologies.join(', ')}. How did you structure your component boundaries, data persistence, and error recovery in that project?`,
          skill: proj.keyTechnologies[0] || proj.primaryLanguage,
          difficulty: 'HARD',
          sources: ['JD_REQUIREMENT', 'GITHUB_PROJECT_ARCHITECTURE'],
          rationale: `Probes candidate's actual architecture and code decisions built in repository '${proj.repoName}'.`,
          suggestedEvaluationCriteria: [
            'Explains component interactions and failure modes',
            'Demonstrates practical mastery of the chosen tech stack',
          ],
          followUpProbes: [
            'What was the most challenging production bug or race condition you debugged in this repo?',
          ],
          githubProject: proj.repoName,
          targetArchitecture: proj.endToEndArchitecture,
        });
      }
    } else if (githubAnalysis?.analyzedRepos && githubAnalysis.analyzedRepos.length > 0) {
      const topRepo = githubAnalysis.analyzedRepos[0];
      githubProjectSummary.push(`Grounded in repository '${topRepo.repoName}' (${topRepo.language})`);
      questions.push({
        id: `q${qIndex++}`,
        question: `In your GitHub repository '${topRepo.repoName}', you used ${topRepo.relevantTechnologies.join(', ') || topRepo.language}. Could you walk me through the end-to-end design and key trade-offs you made when building it?`,
        skill: topRepo.language || 'Architecture',
        difficulty: 'MEDIUM',
        sources: ['JD_REQUIREMENT', 'GITHUB_PROJECT_ARCHITECTURE'],
        rationale: `Directly examines code authored in public repo '${topRepo.repoName}'.`,
        suggestedEvaluationCriteria: [
          'Understands architecture and component roles',
          'Discusses real trade-offs and code structure',
        ],
        followUpProbes: ['What would you improve if rebuilding this from scratch today?'],
        githubProject: topRepo.repoName,
      });
    }

    // 2. Overlap questions (anchor to actual resume project/experience)
    for (const skill of overlapSkills.slice(0, 3)) {
      const matchingResumeSkill = resume.skills.find((s) => s.name.toLowerCase() === skill.toLowerCase());
      const evidenceSnippet = matchingResumeSkill?.evidence?.[0] || 'your past work';
      const projectRef = resume.projects[0]?.name ? `in your project "${resume.projects[0].name}"` : 'in your recent experience';

      questions.push({
        id: `q${qIndex++}`,
        question: `You noted using ${skill} (${evidenceSnippet}) ${projectRef}. Can you walk me through the key architectural decisions you made with ${skill} and how you handled data consistency and error handling?`,
        skill,
        difficulty: 'MEDIUM',
        sources: ['JD_REQUIREMENT', 'RESUME_PROJECT', 'JD_RESUME_OVERLAP'],
        rationale: `Generated because ${skill} is required by the ${jd.job.title} role and substantiated in the candidate's resume evidence.`,
        suggestedEvaluationCriteria: [
          `Articulates technical trade-offs of ${skill}`,
          'Explains production challenges and error recovery',
          'Demonstrates hands-on mastery beyond superficial usage',
        ],
        followUpProbes: [
          `What was the biggest performance bottleneck you encountered when scaling ${skill}?`,
        ],
      });
    }

    // 3. Gap questions (test required skill candidate has not directly evidenced)
    for (const skill of gapSkills.slice(0, 2)) {
      questions.push({
        id: `q${qIndex++}`,
        question: `This role heavily requires ${skill}, which is critical for our team's upcoming deliverables. While your background showcases strong foundational skills, how would you approach adopting and delivering production-grade solutions using ${skill}?`,
        skill,
        difficulty: 'HARD',
        sources: ['JD_REQUIREMENT', 'JD_GAP'],
        rationale: `Generated because ${skill} is mandatory in the JD, but no explicit project evidence was found in the candidate's resume.`,
        suggestedEvaluationCriteria: [
          `Demonstrates strong problem-solving fundamentals transferable to ${skill}`,
          'Understands the core concepts and modern ecosystem surrounding the technology',
        ],
        followUpProbes: [
          `Have you worked on analogous technologies or related paradigms?`,
        ],
      });
    }

    // 4. System Design / Responsibility question
    if (jd.responsibilities[0]) {
      const resp = jd.responsibilities[0].description;
      questions.push({
        id: `q${qIndex++}`,
        question: `A key responsibility in this role is: "${resp}". Reflecting on your background, how would you design and lead the implementation of this responsibility from day one?`,
        skill: 'Architecture & Responsibilities',
        difficulty: 'MEDIUM',
        sources: ['JD_RESPONSIBILITY', 'RESUME_EXPERIENCE'],
        rationale: `Connects the primary job responsibility to the applicant's experience history.`,
        suggestedEvaluationCriteria: [
          'Logical breakdown of milestones and technical execution',
          'Identifies potential pitfalls and mitigation strategies',
        ],
        followUpProbes: [
          'How would you align cross-functional stakeholders on this architecture?',
        ],
      });
    }

    // 5. Behavioral question
    const behavioralTrait = jd.candidateQualities.behavioral[0] || 'Problem Solving';
    questions.push({
      id: `q${qIndex++}`,
      question: `Can you share a specific situation from your career where you demonstrated exceptional ${behavioralTrait} during a high-stakes technical challenge?`,
      skill: behavioralTrait,
      difficulty: 'MEDIUM',
      sources: ['BEHAVIORAL', 'RESUME_EXPERIENCE'],
      rationale: `Assesses the recruiter's explicit behavioral expectation (${behavioralTrait}).`,
      suggestedEvaluationCriteria: [
        'Uses STAR format (Situation, Task, Action, Result)',
        'Demonstrates personal ownership and constructive collaboration',
      ],
      followUpProbes: [
        'What would you do differently in retrospect?',
      ],
    });

    return {
      roleTitle: jd.job.title,
      candidateName,
      summaryRationale: `Synthesized question plan balancing ${questions.filter(q => q.sources.includes('GITHUB_PROJECT_ARCHITECTURE')).length} GitHub architecture probes, ${overlapSkills.length} overlap skills, and ${gapSkills.length} identified gap areas.`,
      overlapSummary: overlapSkills.map((s) => `Direct overlap in ${s}`),
      gapSummary: gapSkills.map((s) => `Gap in stated evidence for ${s}`),
      githubProjectSummary,
      questions,
    };
  }

  /**
   * Generates a fully personalized interview question plan synthesized from JD, Resume, and GitHub Ground Truth.
   */
  static async generateQuestions(
    jd: CanonicalNormalizedJD,
    resume: CanonicalNormalizedResume,
    candidateName?: string,
    githubAnalysis?: GitHubProfileAnalysis
  ): Promise<QuestionGenerationPlan> {
    const resolvedName = candidateName || resume.profile.name || 'Candidate';
    const { overlapSkills, gapSkills } = this.analyzeOverlapAndGaps(jd, resume);

    const input: QuestionEngineInput = {
      jd,
      resume,
      candidateName: resolvedName,
      githubAnalysis,
    };

    const gh = input.githubAnalysis;
    const ghSummary = gh?.canonicalSummary;

    const githubContextText = gh
      ? `
========================
3. CANDIDATE GITHUB ARCHITECTURE & GROUND TRUTH (WHAT CANDIDATE ACTUALLY BUILT)
========================
Username: @${gh.username} (${gh.analyzedRepos.length} public repos analyzed)
Archetype: ${ghSummary?.primaryArchetype || 'Software Engineer'}
Executive Architecture Summary: ${ghSummary?.executiveSummary || 'Repositories analyzed.'}

Flagship Projects & Architectures Actually Built:
${(ghSummary?.flagshipProjects || []).map((p) => `• Repository "${p.repoName}" (${p.primaryLanguage}, Maturity: ${p.codeMaturity}):
   Architecture Pipeline: ${p.endToEndArchitecture}
   Key Technologies: ${p.keyTechnologies.join(', ')}
   Design Patterns: ${p.designPatterns.join(', ') || 'Standard MVC'}
   Testing Discipline: ${p.hasTests ? 'Unit/Integration Tests Present' : 'No tests found'} | Docker: ${p.hasDocker} | CI/CD: ${p.hasCiCd}
   Key Architectural Decisions: ${p.verifiedArchitecturalDecisions.join('; ') || 'Standard implementation'}`).join('\n\n') || gh.analyzedRepos.map(r => `• Repo "${r.repoName}" (${r.language}): ${r.description} [Techs: ${r.relevantTechnologies.join(', ')}]`).join('\n')}

Verified Technologies in Code:
${(ghSummary?.verifiedTechnologies || []).map((v) => `• ${v.technology} (${v.depth}) in repos: ${v.repos.join(', ')}`).join('\n') || gh.topTechnologies.join(', ')}

Suggested Architectural Probe Questions from Ground Truth Code:
${(ghSummary?.suggestedArchitectureProbes || []).map((p) => `• [Target Repo: "${p.repoName}", Skill: ${p.targetedSkill}] Question: "${p.question}" (Rationale: ${p.rationale})`).join('\n') || 'None pre-computed'}
`
      : `
========================
3. CANDIDATE GITHUB EVIDENCE
========================
No public GitHub profile provided. Focus on JD requirements and Resume project claims.
`;

    return await PromptRunner.execute(
      {
        name: 'InterviewQuestionEngine',
        systemInstruction: QUESTION_ENGINE_SYSTEM_PROMPT,
        rules: QUESTION_ENGINE_RULES,
        outputSchema: QuestionGenerationPlanSchema,
        schemaDescription: QUESTION_PLAN_SCHEMA_DESCRIPTION,
        fallbackGenerator: (inp) => this.generateFallbackPlan(inp),
      },
      input,
      (inp) => `
Analyze the Recruiter JD, Candidate Resume, and GitHub Ground Truth to generate personalized interview questions:

========================
1. RECRUITER JOB REQUIREMENTS (WHAT TO TEST)
========================
Title: ${inp.jd.job.title} (Level: ${inp.jd.job.level}, Dept: ${inp.jd.job.department})
Required Skills: ${inp.jd.requiredSkills.map((s) => `${s.name} [${s.category}, ${s.proficiency}]`).join(', ')}
Preferred Skills: ${inp.jd.preferredSkills.map((s) => s.name).join(', ') || 'None'}
Responsibilities:
${inp.jd.responsibilities.map((r) => `• ${r.description}`).join('\n')}
Experience: ${inp.jd.experience.minimumYears}+ years
Behavioral Expectations: ${inp.jd.candidateQualities.behavioral.join(', ')}

========================
2. CANDIDATE RESUME EVIDENCE (HOW TO PERSONALIZE)
========================
Candidate Name: ${inp.candidateName}
Summary: ${inp.resume.summary}

Stated Skills with Evidence:
${inp.resume.skills.map((s) => `• ${s.name}: ${s.evidence.join('; ') || 'Mentioned in skills section'}`).join('\n')}

Projects:
${inp.resume.projects.map((p) => `• Project "${p.name}" (${p.technologies.join(', ')}): ${p.description} | Evidence: ${p.evidence.join('; ')}`).join('\n') || 'None explicitly listed'}

Experience History:
${inp.resume.experience.map((e) => `• ${e.role} at ${e.company} (${e.duration}): ${e.highlights.join('; ')}`).join('\n')}

${githubContextText}

========================
PRE-COMPUTED OVERLAP & GAPS
========================
Overlap Skills: ${overlapSkills.join(', ') || 'None direct'}
Gap Skills: ${gapSkills.join(', ') || 'None direct'}

CRITICAL INSTRUCTION:
Generate at least 5 to 7 personalized questions. If GitHub evidence was provided, at least 2 questions MUST directly probe what the candidate actually built in their GitHub repositories (citing repo name, architecture, trade-offs, and technical choices). Tag those questions with 'GITHUB_PROJECT_ARCHITECTURE' or 'RESUME_GITHUB_OVERLAP'.
`
    );
  }

  /**
   * Adaptive foundation: Generates a targeted follow-up question based on candidate's answer and evaluation.
   */
  static async generateFollowUpQuestion(
    previousQuestion: string,
    applicantAnswer: string,
    evaluation: { responseQuality?: string; weakAreas?: string[]; averageScore?: number }
  ): Promise<{ followUpQuestion: string; source: QuestionSource }> {
    const prompt = `You are an adaptive technical interviewer.
Previous Question: "${previousQuestion}"
Candidate Answer: "${applicantAnswer}"
Evaluation Assessment: Quality=${evaluation.responseQuality || 'vague'}, Weak areas=${(evaluation.weakAreas || []).join(', ')}

Generate a single, direct, natural spoken-style follow-up probe (1-2 sentences) that challenges the candidate's answer or asks for concrete implementation details.
Respond with ONLY raw text of the question.`;

    try {
      const reply = await AIClient.getCompletion([
        { role: 'system', content: 'You are an adaptive technical interviewer.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.2 });

      return {
        followUpQuestion: reply.trim().replace(/^"|"$/g, ''),
        source: 'FOLLOW_UP',
      };
    } catch {
      return {
        followUpQuestion: 'Could you elaborate on how you implemented that in production and what specific trade-offs you considered?',
        source: 'FOLLOW_UP',
      };
    }
  }
}
