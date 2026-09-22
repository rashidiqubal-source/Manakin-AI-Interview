import { prisma } from '../config/prisma';
import { OpenAIService } from './OpenAIService';
import { EmailService } from './EmailService';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';
import { logger } from '../config/logger';
import { QuestionEngine, CanonicalNormalizedJD, CanonicalNormalizedResume } from '../ai';

const SYSTEM_PROMPT = `You are an AI interviewer evaluating tutor candidates for teaching children in a warm, natural spoken style.

Your primary goal is to assess the soft skills required for tutoring. This isn't about testing deep math knowledge. It's about the soft stuff:
1. communication clarity – logical, easy to follow
2. ability to simplify – child-friendly, age-appropriate language and examples
3. patience – supportive responses when a student struggles
4. warmth – empathy, encouragement, and positive tone
5. English fluency – natural, easy-to-follow English flow

--------------------------------------------------
📋 INTERVIEW STRUCTURE
--------------------------------------------------
- You MUST conduct exactly 10 conversational turns.
- Distribute your engagement systematically: Ask 6 to 7 "hardcore" foundational teaching scenario questions, and 3 to 4 deep follow-up questions challenging their previous answers.
- The system will inject context detailing which turn you are on. Guide the pacing accordingly.

--------------------------------------------------
🎭 TEACHING SIMULATION MODE
--------------------------------------------------
- You are not just an interviewer; you must act like a confused 8-year-old student interacting with a tutor.
- Interrupt occasionally, act confused, and ask "Why?" or "Can you explain that more simply?"
- Present unique behavioral challenges (e.g., "I don't understand, my parents taught me differently!" or "I'm bored, can we play a game instead?").

--------------------------------------------------
🗣️ CONVERSATION STYLE
--------------------------------------------------
- Keep the conversation strictly natural, not robotic.
- Listen, respond, and adapt to exactly what the candidate just said.
- Follow up aggressively on vague answers. Don't let them give generic platitudes; ask them "How exactly would you do that?"
- Keep it flowing dynamically. Acknowledge what they said before moving to a new topic.
- Use short spoken-style turns (1-3 sentences maximum).
- Always stay in English.

--------------------------------------------------
🔄 ADAPTIVE BEHAVIOR & RAMBLING CONTROL
--------------------------------------------------
- If the candidate gives an extremely long monlogue, interrupt them: "That's a lot of information, I'm a bit lost. Can you summarize?"
- If they use generic analogies ("I would make it fun"), push back: "That sounds good, but could you give me a specific example of how you'd make it fun?"
- If the answer is too complex or uses jargon, ask them to simplify it for a young child.

--------------------------------------------------
✨ MICRO-FEEDBACK SYSTEM
--------------------------------------------------
- Provide occasional, brief positive reinforcement when they do well (e.g., "Oh, that's a great example!", "I like how you explained that."). This tests their flow and keeps the tone warm.

--------------------------------------------------
⚠️ RULES & BIAS CONTROL
--------------------------------------------------
- Never penalize a candidate for their accent or minor grammar mistakes.
- Never switch to Urdu, Hindi, or any other language.
- Do not teach the student yourself; remain an interviewer/student.
- Do not ask purely factual questions or test raw academic knowledge.
- Do not sound robotic, scripted, or overly formal.
- Do not change the subject away from teaching practice.

Begin by greeting the candidate warmly, providing a friendly human-like intro, and asking the first creative scenario-based problem. Make sure to highly RANDOMIZE the first scenario you pick so different candidates get completely different starting experiences.
`;

export class InterviewService {
  /**
   * Starts a new interview session and generates the first question using the QuestionEngine (JD + Resume).
   */
  static async startInterview(candidateName: string, candidateEmail?: string, invitationId?: string) {
    let activePrompt = SYSTEM_PROMPT;
    let invitationRecord = null;
    let generatedPlan = null;
    let firstQuestion = "";

    if (invitationId) {
      invitationRecord = await prisma.interviewInvitation.findUnique({
        where: { id: invitationId },
        include: { jobDescription: true, applicantResume: true }
      });

      if (invitationRecord) {
        const jd = invitationRecord.jobDescription;
        const resume = invitationRecord.applicantResume;

        const normalizedJD: CanonicalNormalizedJD = (jd.normalizedJD as any) || {
          job: { title: jd.title, department: jd.department || 'Engineering', level: jd.jobLevel || 'MID_LEVEL', employmentType: 'FULL_TIME', openings: 1, workMode: jd.workMode || 'REMOTE', location: jd.location || 'Remote' },
          role: { summary: jd.aiSummary || jd.shortSummary || '', description: jd.rawContent || '', hiringReason: 'EXPANSION' },
          responsibilities: (Array.isArray(jd.responsibilities) ? jd.responsibilities : []).map((r: any) => ({ description: typeof r === 'string' ? r : r.description || '', priority: 'HIGH', source: { type: 'AI_INFERRED' } })),
          requiredSkills: (Array.isArray(jd.requiredSkills) ? jd.requiredSkills : []).map((s: any) => ({ name: typeof s === 'string' ? s : s.name || '', category: 'GENERAL', importance: 'MUST_HAVE', proficiency: 'INTERMEDIATE', source: { type: 'AI_INFERRED' } })),
          preferredSkills: (Array.isArray(jd.preferredSkills) ? jd.preferredSkills : []).map((s: any) => ({ name: typeof s === 'string' ? s : s.name || '', category: 'GENERAL', importance: 'PREFERRED', proficiency: 'INTERMEDIATE', source: { type: 'AI_INFERRED' } })),
          experience: { minimumYears: jd.minExperience || 0, maximumYears: jd.maxExperience || null, industryExperience: jd.industryExperience ? [jd.industryExperience] : [], freshersAllowed: Boolean(jd.freshersAllowed), fresherRequirements: [], source: { type: 'AI_INFERRED' } },
          education: { minimumLevel: jd.minEducation || 'BACHELORS', degrees: jd.requiredDegree ? [jd.requiredDegree] : [], minimumCGPA: jd.cgpaRequirement || null, certifications: [], source: { type: 'AI_INFERRED' } },
          candidateQualities: { behavioral: ['Ownership', 'Problem Solving', 'Communication'], languages: ['English'], source: { type: 'AI_INFERRED' } },
          logistics: { shiftRequirements: [], relocationRequired: false, workMode: 'HYBRID', location: 'Remote', source: { type: 'AI_INFERRED' } },
          interviewRequirements: { technical: true, coding: true, systemDesign: false, behavioral: true, domainKnowledge: false, source: { type: 'AI_INFERRED' } },
          interviewDimensions: [],
        };

        const normalizedResume: CanonicalNormalizedResume = (resume?.normalizedResume as any) || {
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

        try {
          generatedPlan = await QuestionEngine.generateQuestions(normalizedJD, normalizedResume, candidateName);
        } catch (err: any) {
          logger.warn(`[InterviewService] QuestionEngine synthesis failed (${err.message}). Using fallback question.`);
        }

        const planQuestionsFormatted = generatedPlan?.questions
          ? generatedPlan.questions.map((q, i) => `${i + 1}. [${q.sources.join(' + ')}] (${q.skill}): "${q.question}"`).join('\n')
          : 'Standard targeted questions';

        activePrompt = `You are an expert AI Interviewer conducting a personalized interview for the position: "${jd.title}".

--------------------------------------------------
📋 JOB DESCRIPTION INTELLIGENCE
--------------------------------------------------
Job Title: ${jd.title}
Summary: ${jd.aiSummary || 'Standard role competencies.'}

--------------------------------------------------
📄 CANDIDATE RESUME EVIDENCE
--------------------------------------------------
Candidate Name: ${candidateName}
Resume Summary: ${resume?.aiSummary || 'Resume provided.'}

--------------------------------------------------
🎯 SYNTHESIZED PERSONALIZED QUESTION BLUEPRINT (JD + RESUME)
--------------------------------------------------
${planQuestionsFormatted}

--------------------------------------------------
🗣️ CONVERSATIONAL GUIDELINES
--------------------------------------------------
- Conduct an engaging, natural interview anchored in the personalized questions blueprint.
- Each question must probe their ACTUAL stated background while testing the recruiter's MANDATORY requirements.
- Speak in concise spoken turns (1-3 sentences). Warm and professional.
- Start by greeting ${candidateName} warmly, acknowledging the ${jd.title} role, and asking the first personalized question.`;
      }
    }

    const session = await prisma.interviewSession.create({
      data: {
        candidateName,
        candidateEmail,
        status: 'IN_PROGRESS',
        questionBlueprint: generatedPlan as any,
      }
    });

    if (invitationId && invitationRecord) {
      await prisma.interviewInvitation.update({
        where: { id: invitationId },
        data: {
          interviewSessionId: session.id,
          status: 'IN_PROGRESS'
        }
      });
    }

    // Create system message
    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.system,
        content: activePrompt
      }
    });

    // Formulate opening question from plan if available
    if (generatedPlan && generatedPlan.questions && generatedPlan.questions.length > 0) {
      const topQ = generatedPlan.questions[0].question;
      firstQuestion = `Hello ${candidateName}, welcome to your interview for the ${invitationRecord?.jobDescription.title || 'position'} role! To begin, ${topQ.charAt(0).toLowerCase() + topQ.slice(1)}`;
    } else {
      // Create a uniquely seeded prompt for the first completion
      const initPrompt = `${activePrompt}\n\n[System Seed: ${Math.random()}]\nGenerate the opening warm greeting and first targeted interview question now.`;
      try {
        firstQuestion = await OpenAIService.getChatCompletion([{ role: 'system', content: initPrompt }]);
      } catch (err: any) {
        logger.error(`[InterviewService] Failed to generate first question: ${err.message}. Using fallback question.`);
        firstQuestion = `Welcome ${candidateName}! To start off our interview for the ${invitationRecord?.jobDescription.title || 'position'}, could you walk me through a recent project or experience that highlights your core technical strengths?`;
      }
    }

    // Save assistant's first question
    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.assistant,
        content: firstQuestion
      }
    });

    return {
      sessionId: session.id,
      question: firstQuestion,
      questionPlan: generatedPlan,
    };
  }

  /**
   * Process a candidate's response and fetch the AI's next reply
   */
  static async respondToInterview(sessionId: string, userText: string) {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.status === 'COMPLETED') throw new AppError('Session already completed', 400);

    // Retrieve the last AI question for context
    const lastMessage = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;
    const aiQuestion = lastMessage && lastMessage.role === 'assistant' ? lastMessage.content : 'General pedagogical scenario';

    // Micro-evaluate the user's answer
    const evalData = await OpenAIService.evaluateSingleAnswer(aiQuestion, userText);

    const toIntScore = (val: any): number | undefined => {
      if (val === undefined || val === null) return undefined;
      const num = Math.round(Number(val));
      return isNaN(num) ? undefined : Math.min(10, Math.max(1, num));
    };

    // Save user response with metrics
    await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.user,
        content: userText,
        clarity: toIntScore(evalData?.clarity),
        warmth: toIntScore(evalData?.warmth),
        simplicity: toIntScore(evalData?.simplicity),
        patience: toIntScore(evalData?.patience),
        fluency: toIntScore(evalData?.fluency),
        engagement: toIntScore(evalData?.engagement)
      }
    });

    const userMessageCount = session.messages.filter((m) => m.role === 'user').length + 1;

    // Append to array for AI context
    const aiContext = session.messages.map(m => ({ role: m.role, content: m.content }));
    aiContext.push({ role: 'user', content: userText });

    let shouldCutoff = userMessageCount >= 10;

    // Early termination for unsatisfactory/off-topic response
    if (evalData.responseQuality === "off-topic" || evalData.responseQuality === "unsatisfactory" || evalData.average < 3) {
      shouldCutoff = true;
      aiContext.push({
        role: 'system',
        content: "SYSTEM INSTRUCTION: The candidate's last answer was completely unsatisfactory or off-topic. Inform them politely but firmly that the interview is being terminated early due to this, and end the conversation immediately in one sentence."
      });
    } else {
      // Normal pacing and edge-case injection
      aiContext.push({
        role: 'system',
        content: `SYSTEM INSTRUCTION: This is turn ${userMessageCount}/10. Keep the distribution in mind (6-7 new scenarios, 3-4 follow ups).`
      });

      if (evalData.responseQuality === "vague") {
        aiContext.push({
          role: 'system',
          content: "SYSTEM INSTRUCTION: The candidate's last response was vague. Push them to be much more specific."
        });
      } else if (evalData.responseQuality === "complex") {
        aiContext.push({
          role: 'system',
          content: 'SYSTEM INSTRUCTION: The candidate is using language that is too complex. Act confused and ask them to simplify.'
        });
      }

      if (userMessageCount >= 10) {
         aiContext.push({ 
             role: 'system', 
             content: 'SYSTEM INSTRUCTION: MAX QUESTIONS REACHED. End the interview gracefully.'
         });
      }
    }

    let aiReply = "";
    try {
      aiReply = await OpenAIService.getChatCompletion(aiContext);
    } catch (err: any) {
      logger.error(`[InterviewService] Chat completion failed: ${err.message}. Using fallback reply.`);
      if (shouldCutoff) {
        aiReply = "Thank you for sharing all your tutoring strategies. We have completed all the questions for today. I will compile your feedback and wish you the best of luck!";
      } else {
        const fallbacks = [
          "That sounds like a very creative tutoring strategy. Could you elaborate on how you would implement that with an 8-year-old child who easily gets distracted?",
          "I appreciate your patience and warmth there. How would you explain that exact same point using a real-world child-friendly analogy?",
          "I understand. What is another creative method or game you could introduce to help a student who is struggling to grasp that math concept?"
        ];
        aiReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }
    }

    // Save assistant response
    const assistantMessage = await prisma.message.create({
      data: {
        interviewSessionId: session.id,
        role: Role.assistant,
        content: aiReply
      }
    });

    return {
      reply: aiReply,
      cutoff: shouldCutoff
    };
  }

  /**
   * Completes and evaluates the session
   */
  static async evaluateSession(sessionId: string, videoEngagementScore?: number, cheatFlags?: string[]) {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!session) throw new AppError('Session not found', 404);

    const apiMessages = session.messages
      .filter((m) => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const userMessageCount = apiMessages.filter(m => m.role === 'user').length;
    const evaluation = await OpenAIService.evaluateInterview(apiMessages, userMessageCount);
    
    // Inject visual score override if front-end ML processed it
    if (videoEngagementScore !== undefined && typeof videoEngagementScore === 'number' && evaluation.engagement) {
      evaluation.engagement.score = videoEngagementScore;
      evaluation.engagement.reasoning = `(Visual Override) Camera tracking detected ${videoEngagementScore * 10}% visual engagement during the session.`;
    }

    const mobileCount = cheatFlags ? cheatFlags.filter(f => f === "MOBILE_PHONE" || f === "UNAUTHORIZED_DEVICE").length : 0;
    const absentCount = cheatFlags ? cheatFlags.filter(f => f === "ABSENT_USER").length : 0;
    const computedMisconductScore = (mobileCount * 2) + absentCount;

    // Use DB cheatCount if atomic real-time tracking recorded higher, else use computed score
    const misconductScore = Math.max(session.cheatCount || 0, computedMisconductScore);

    evaluation.proctoringSummary = {
      misconductScore,
      mobilePhoneCount: mobileCount,
      absenceCount: absentCount
    };

    if (misconductScore > 0) {
      const customFlags = [];
      if (mobileCount > 0) customFlags.push(`PROCTOR VIOLATION: Unauthorized device (Mobile) detected ${mobileCount} time(s) [+${mobileCount * 2} misconduct pts].`);
      if (absentCount > 0) customFlags.push(`PROCTOR VIOLATION: Candidate out of camera frame ${absentCount} time(s) [+${absentCount} misconduct pts].`);

      evaluation.riskFlags = [...(evaluation.riskFlags || []), ...customFlags];
      evaluation.overallRecommendation = "FLAGGED";
    }

    // Update session
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        cheatCount: misconductScore,
        evaluationData: evaluation,
        overallRecommendation: evaluation.overallRecommendation || 'UNKNOWN',
        totalScore: (evaluation.clarity?.score || 0) + (evaluation.warmth?.score || 0) + (evaluation.simplicity?.score || 0) + (evaluation.patience?.score || 0) + (evaluation.fluency?.score || 0) + (evaluation.engagement?.score || 0)
      }
    });

    return evaluation;
  }

  /**
   * Submit candidate feedback for a completed session
   */
  static async submitFeedback(sessionId: string, feedback: string) {
    const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);

    return await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { feedback }
    });
  }

  /**
   * Get all sessions for a specific candidate by email
   */
  static async getSessionsByEmail(email: string) {
    return await prisma.interviewSession.findMany({
      where: { candidateEmail: email },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Update application status and send email
   */
  static async updateApplicationStatus(sessionId: string, status: 'ACCEPTED' | 'REJECTED', feedbackReason?: string) {
    const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);

    let fraudEvaluationData = undefined;
    if (feedbackReason && status === 'REJECTED') {
      fraudEvaluationData = {
        overallRecommendation: "TERMINATED",
        teachingStyle: "UNAUTHORIZED",
        keyHighlights: ["Interview was abruptly ended due to an automated proctoring violation."],
        riskFlags: [`PROCTOR VIOLATION: ${feedbackReason}`],
        clarity: {score: 0}, warmth: {score: 0}, simplicity: {score: 0}, patience: {score: 0}, fluency: {score: 0}, engagement: {score: 0}
      };
    }

    const updatedSession = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { 
        applicationStatus: status,
        ...(fraudEvaluationData ? { evaluationData: fraudEvaluationData, overallRecommendation: 'TERMINATED', totalScore: 0 } : {})
      }
    });
    
    if (session.candidateEmail) {
      // Fire-and-forget email dispatch to prevent blocking the admin UI / hanging
      EmailService.sendDecisionEmail(session.candidateEmail, status, session.candidateName).catch(err => {
        console.error(`Failed to dispatch email asynchronously for ${sessionId}:`, err);
      });
    } else {
      console.warn(`No candidate email found for session ${sessionId}. Skipping email dispatch.`);
    }

    return updatedSession;
  }
}
