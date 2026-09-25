import OpenAI from 'openai';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../config/logger';

const OPENAI_API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  timeout: 20000,
  maxRetries: 1,
});

export class OpenAIService {
  /**
   * Transcribes an audio file using Whisper STT
   */
  static async transcribeAudio(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        return '';
      }
      const stats = fs.statSync(filePath);
      if (stats.size < 500) {
        logger.warn(`Audio file is too small (${stats.size} bytes), skipping Whisper call`);
        return '';
      }

      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });
      return (typeof response === 'string' ? response : (response as any).text || '').trim();
    } catch (error: any) {
      logger.error(`OpenAI Transcription Error: ${error.message || error}`);
      return '';
    }
  }

  /**
   * Chat completion handler using OpenAI gpt-4o-mini
   */
  static async getChatCompletion(messages: any[], systemPrompt?: string): Promise<string> {
    const apiMessages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: apiMessages,
        temperature: 0.7,
      });
      return response.choices[0].message.content || '';
    } catch (error: any) {
      logger.error(`OpenAI Chat Error: ${error.message || error}`);
      throw new Error('Failed to get chat completion.');
    }
  }

  /**
   * Quick Micro-Evaluation of a Single Answer for Adaptive Cutoff and Technical Substance
   */
  static async evaluateSingleAnswer(questionText: string, userText: string): Promise<any> {
    const prompt = `
      You are a Principal Software Engineering Evaluator. Score the candidate's single response (1-10) against the technical question asked.
      Do NOT evaluate on superficial confidence, generic warmth, or child-appropriate tutoring traits. Focus strictly on technical depth and accuracy.

      Question: "${questionText}"
      Candidate Answer: "${userText}"

      Technical Rubric (1=Poor/Incompetent, 10=Exceptional Mastery):
      - technicalAccuracy: exactness of technical facts, correct algorithmic concepts, correct API/framework/protocol usage.
      - depth: architectural depth, understanding of underlying mechanics, trade-offs, concurrency, failure modes, edge cases.
      - problemSolving: structured engineering logic, concrete troubleshooting steps, practical system trade-offs.
      - technicalCommunication: clear, structured, precise technical articulation without hand-waving or fluff.
      - claimVerification: if the question probed a claimed GitHub repository, project, or resume claim, did the candidate demonstrate genuine hands-on authorship and command? If unable to answer, evasive, or admitting unfamiliarity with their own claimed project, score 1-3.

      Also determine responseQuality: "clear", "vague", "evasive", "off-topic", or "unsatisfactory".
      CRITICAL RULE: If the user provides an answer that is completely different from what was asked, dodges the technical core, or is unable to explain their claimed project/technology, label it strictly as "unsatisfactory", "evasive", or "off-topic".
      If the response is extremely short (one-word) or silent, label it "vague" or "off-topic" accordingly.

      Return ONLY a raw JSON object matching this exact schema (no markdown, no extra text):
      {
        "technicalAccuracy": 8,
        "depth": 8,
        "problemSolving": 7,
        "technicalCommunication": 8,
        "claimVerification": 8,
        "clarity": 8,
        "warmth": 8,
        "simplicity": 7,
        "patience": 8,
        "fluency": 8,
        "engagement": 8,
        "average": 7.8,
        "responseQuality": "clear"
      }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.1,
      });

      const content = response.choices[0].message.content || '{}';
      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      
      // Ensure backward-compatible aliases
      parsed.clarity = parsed.technicalAccuracy ?? parsed.clarity ?? 5;
      parsed.warmth = parsed.depth ?? parsed.warmth ?? 5;
      parsed.simplicity = parsed.problemSolving ?? parsed.simplicity ?? 5;
      parsed.patience = parsed.claimVerification ?? parsed.patience ?? 5;
      parsed.fluency = parsed.technicalCommunication ?? parsed.fluency ?? 5;
      parsed.engagement = parsed.claimVerification ?? parsed.engagement ?? 5;

      return parsed;
    } catch (error) {
      logger.error(`Single Answer Eval Error: ${error}`);
      return {
        technicalAccuracy: 5,
        depth: 5,
        problemSolving: 5,
        technicalCommunication: 5,
        claimVerification: 5,
        clarity: 5,
        warmth: 5,
        simplicity: 5,
        patience: 5,
        fluency: 5,
        engagement: 5,
        average: 5.0,
        responseQuality: "clear"
      };
    }
  }

  /**
   * Evaluates Candidate Live Code Submission against Problem Statement & Claimed Repository Architecture
   */
  static async evaluateCodeSubmission(
    challenge: any,
    code: string,
    language: string = 'typescript',
    repoName: string = 'claimed repository'
  ): Promise<any> {
    const prompt = `
      You are a Principal Software Engineer and Technical Hiring Evaluator.
      Evaluate the candidate's code submission for the challenge: "${challenge.title || challenge.functionName || 'Code Implementation'}".
      Repository Context: Candidate claims ownership of repository "${repoName}".
      Problem Description: "${challenge.description || ''}"
      Expected Behavior: "${challenge.expectedBehavior || ''}"

      Candidate Code (${language}):
      \`\`\`${language}
      ${code}
      \`\`\`

      Technical Rubric (1=Poor/Broken, 10=Production-Grade Mastery):
      - technicalAccuracy: functional correctness, syntax correctness, meets expected function signature and return type.
      - depth: algorithmic efficiency (O(N) or O(1)), proper cryptographic/hashing libraries or string manipulation.
      - problemSolving: edge-case resilience (handles empty strings, null/undefined, boundaries).
      - codeQuality: clean code, idiomatic syntax, formatting, naming conventions, absence of anti-patterns.
      - claimVerification: does this code corroborate genuine, authentic authorship and familiarity with the domain claimed in repository "${repoName}"?

      Also determine:
      - correctness: "CORRECT" | "PARTIALLY_CORRECT" | "INCORRECT"
      - feedback: 1-2 sentence engineering feedback summarizing quality and edge cases.
      - followUpPoints: Array of 2 technical observations to probe in oral follow-ups (e.g., salt entropy, collisions, null handling, integration).

      Return ONLY a raw JSON object matching this exact schema (no markdown, no extra text):
      {
        "technicalAccuracy": 8,
        "depth": 8,
        "problemSolving": 7,
        "codeQuality": 8,
        "claimVerification": 8,
        "clarity": 8,
        "warmth": 8,
        "simplicity": 7,
        "patience": 8,
        "fluency": 8,
        "engagement": 8,
        "average": 7.8,
        "correctness": "CORRECT",
        "feedback": "Clean implementation with solid salt concatenation.",
        "followUpPoints": ["Algorithmic trade-offs and collision resistance", "Edge cases with empty salt"]
      }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.1,
      });

      const content = response.choices[0].message.content || '{}';
      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanContent);

      parsed.clarity = parsed.technicalAccuracy ?? parsed.clarity ?? 5;
      parsed.warmth = parsed.depth ?? parsed.warmth ?? 5;
      parsed.simplicity = parsed.problemSolving ?? parsed.simplicity ?? 5;
      parsed.patience = parsed.claimVerification ?? parsed.patience ?? 5;
      parsed.fluency = parsed.codeQuality ?? parsed.fluency ?? 5;
      parsed.engagement = parsed.claimVerification ?? parsed.engagement ?? 5;

      return parsed;
    } catch (error) {
      logger.error(`Code Submission Eval Error: ${error}`);
      return {
        technicalAccuracy: 5,
        depth: 5,
        problemSolving: 5,
        codeQuality: 5,
        claimVerification: 5,
        clarity: 5,
        warmth: 5,
        simplicity: 5,
        patience: 5,
        fluency: 5,
        engagement: 5,
        average: 5.0,
        correctness: "PARTIALLY_CORRECT",
        feedback: "Code submitted and recorded.",
        followUpPoints: ["Input validation edge cases", "Production integration in repository"]
      };
    }
  }

  /**
   * JSON Structure Evaluator (Final Output) - Technical Engineering Rigor & GitHub Verification
   */
  static async evaluateInterview(
    messages: any[],
    userMessageCount?: number,
    context?: { githubEvidence?: any; contradictions?: any[]; jobTitle?: string }
  ): Promise<any> {
    const githubContextStr = context?.githubEvidence ? JSON.stringify(context.githubEvidence, null, 2) : 'No public GitHub profile analyzed.';
    const contradictionsStr = context?.contradictions && context.contradictions.length > 0
      ? JSON.stringify(context.contradictions, null, 2)
      : 'No automatic discrepancies flagged yet.';

    const evaluationPrompt = `
      You are a Principal Software Engineering Evaluator. Conduct an objective, evidence-driven technical evaluation of the candidate based on the interview transcript.
      Do NOT evaluate on superficial confidence, generic warmth, or child-appropriate tutoring traits. Focus exclusively on technical competence, architectural depth, algorithmic correctness, hands-on implementation reality, and project ownership.

      --------------------------------------------------
      CONTEXT & EVIDENCE
      --------------------------------------------------
      Candidate GitHub Intelligence & Repositories:
      ${githubContextStr}

      Detected Contradictions / Evidence Gaps:
      ${contradictionsStr}

      --------------------------------------------------
      📊 EVALUATION CRITERIA (1-10 Scale)
      --------------------------------------------------
      Provide a structured JSON output evaluating the candidate strictly on:
      - technicalDepth (1-10 scale rating, plus detailed reasoning): understanding of internal mechanics, systems architecture, concurrency, memory/CPU scaling, failure modes, trade-offs, and design boundaries.
      - systemArchitecture (1-10): ability to design scalable, distributed, resilient architectures, APIs, and data layers with clear trade-offs.
      - problemSolving (1-10): structured problem decomposition, practical debugging approaches, edge-case consideration, algorithmic execution.
      - codeQuality (1-10): best practices, clean code conventions, testability, security awareness, and engineering discipline.
      - technicalCommunication (1-10): clear, precise, structured technical articulation without evasiveness, fluff, or buzzword soup.
      - claimVerification (1-10): consistency between claimed resume/GitHub experience and actual demonstrated knowledge.

      --------------------------------------------------
      CRITICAL GITHUB VERIFICATION & CLAIM OWNERSHIP RULES
      --------------------------------------------------
      1. Inspect any questions where the interviewer probed the candidate's GitHub repositories, public projects, or claimed skills.
      2. If any repository or project claimed in GitHub or Resume is unverified, OR if the candidate:
         - Was unable to clearly explain how their claimed project was designed or implemented,
         - Admitted unfamiliarity ("I didn't write that part", "I don't remember", "someone else built it"),
         - Gave vague, generic, or evasive answers about their own code/architecture,
         - Dodged the question entirely:
         => YOU MUST:
            a) Heavily penalize 'claimVerification' (score 1-3) and reduce 'technicalDepth'.
            b) Add an explicit risk flag: "GITHUB DISCREPANCY: Unable to verify ownership or implementation details of claimed repository/project".
            c) Mark 'githubVerificationSummary.verified' as false and list unverified items.
            d) If the unverified project/skill is core to the position, set overallRecommendation to "FAIL" or "FLAGGED".

      --------------------------------------------------
      📏 SCORING GUIDELINES
      --------------------------------------------------
      10 = Principal / Staff Engineer (deep architectural mastery, exact trade-offs, verified ownership)
      8 = Senior Engineer (solid hands-on execution, clear reasoning, verified project claims)
      6 = Mid-level Engineer (functional knowledge, but shallow on internals or scaling)
      4 = Junior / Inconsistent (struggles with architectural depth, vague explanations)
      1-2 = Incompetent / Unverified (unable to answer questions, severe claim discrepancies)

      IMPORTANT RULES ABOUT INTERVIEW COMPLETION:
      - Candidate provided ${userMessageCount ?? 'an unknown number of'} responses in this transcript.
      - EARLY TERMINATION: If candidate answered 5 or fewer questions, heavily penalize all scores (max 4) and set overallRecommendation to "FAIL".
      - If 6-9 questions, note "Incomplete Interview" in riskFlags.

      Return ONLY valid JSON in exactly this schema shape:
      {
        "technicalDepth": { "score": 8, "reasoning": "..." },
        "systemArchitecture": { "score": 7, "reasoning": "..." },
        "problemSolving": { "score": 8, "reasoning": "..." },
        "codeQuality": { "score": 8, "reasoning": "..." },
        "technicalCommunication": { "score": 8, "reasoning": "..." },
        "claimVerification": { "score": 8, "reasoning": "..." },
        "overallRecommendation": "PASS",
        "evidenceQuotes": ["Verbatim quote 1", "Verbatim quote 2", "Verbatim quote 3"],
        "technicalHighlights": ["Demonstrated deep understanding of PostgreSQL query planning and indexing"],
        "riskFlags": ["none"],
        "consistencyAnalysis": "Candidate demonstrated consistent technical depth across all probed competencies...",
        "githubVerificationSummary": {
          "hasGitHubClaim": true,
          "verified": true,
          "unverifiedItems": [],
          "details": "Candidate accurately walked through repository architecture and trade-offs."
        },
        "teachingStyle": "systems-architect",
        "clarity": { "score": 8, "reasoning": "..." },
        "simplicity": { "score": 8, "reasoning": "..." },
        "patience": { "score": 8, "reasoning": "..." },
        "warmth": { "score": 7, "reasoning": "..." },
        "fluency": { "score": 8, "reasoning": "..." },
        "engagement": { "score": 8, "reasoning": "..." }
      }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: evaluationPrompt },
          ...messages
        ],
        temperature: 0.2,
      });

      const content = response.choices[0].message.content || '{}';
      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanContent);

      // Guarantee backward compatibility mappings
      parsed.clarity = parsed.clarity || parsed.technicalDepth || { score: 6, reasoning: "Evaluated" };
      parsed.simplicity = parsed.simplicity || parsed.problemSolving || { score: 6, reasoning: "Evaluated" };
      parsed.patience = parsed.patience || parsed.codeQuality || { score: 6, reasoning: "Evaluated" };
      parsed.warmth = parsed.warmth || parsed.systemArchitecture || { score: 6, reasoning: "Evaluated" };
      parsed.fluency = parsed.fluency || parsed.technicalCommunication || { score: 6, reasoning: "Evaluated" };
      parsed.engagement = parsed.engagement || parsed.claimVerification || { score: 6, reasoning: "Evaluated" };
      parsed.keyHighlights = parsed.keyHighlights || parsed.technicalHighlights || [];

      return parsed;
    } catch (error) {
      logger.error(`OpenAI Technical Eval Error: ${error}`);
      return {
        technicalDepth: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        systemArchitecture: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        problemSolving: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        codeQuality: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        technicalCommunication: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        claimVerification: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        clarity: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        simplicity: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        patience: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        warmth: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        fluency: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        engagement: { score: 5, reasoning: "Evaluation generation encountered a system error." },
        overallRecommendation: "FLAGGED",
        evidenceQuotes: [],
        teachingStyle: "technical-evaluator",
        riskFlags: ["System evaluation failure"],
        keyHighlights: [],
        consistencyAnalysis: "Could not evaluate transcript due to a system error.",
        githubVerificationSummary: {
          hasGitHubClaim: false,
          verified: false,
          unverifiedItems: [],
          details: "Could not perform automated verification due to an evaluation fault."
        }
      };
    }
  }
}

