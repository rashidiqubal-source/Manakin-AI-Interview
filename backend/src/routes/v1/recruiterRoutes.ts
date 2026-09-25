import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { JDAnalysisService } from '../../services/JDAnalysisService';
import { ResumeParser } from '../../ai/resume/resume-parser';
import { JDStageAnalyzer } from '../../ai/jd/jd-stage-analyzer';
import { InvitationService } from '../../services/InvitationService';
import { InterviewService } from '../../services/InterviewService';
import { optionalAuth } from '../../middlewares/requireAuth';

const router = Router();
router.use(optionalAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Helper to resolve recruiter user from session context or provided ID
 */
async function resolveRecruiter(req: any, fallbackId?: string) {
  const userId = fallbackId || req.user?.id;
  if (!userId) {
    throw new AppError('Recruiter authentication or ID is required', 400);
  }

  let recruiter = await prisma.user.findUnique({ where: { id: userId } });
  if (!recruiter) {
    throw new AppError('Recruiter account not found', 404);
  }

  // Ensure user has RECRUITER permissions
  if (recruiter.role !== 'RECRUITER') {
    recruiter = await prisma.user.update({
      where: { id: recruiter.id },
      data: { role: 'RECRUITER' }
    });
  }

  return recruiter;
}


/**
 * POST /api/v1/recruiter/jd/create
 * Recruiter creates a structured Job Description (Draft or Published)
 */
router.post('/jd/create', async (req, res, next) => {
  try {
    const {
      recruiterId,
      userId,
      title,
      department,
      jobLevel,
      employmentType,
      openings,
      location,
      workMode,
      joiningDate,
      shortSummary,
      rawContent,
      positionReason,
      responsibilities,
      dayToDayWork,
      requiredSkills,
      minExperience,
      maxExperience,
      relevantExperience,
      industryExperience,
      freshersAllowed,
      fresherRequirements,
      minEducation,
      requiredDegree,
      cgpaRequirement,
      certificationsRequired,
      preferredSkills,
      preferredExperience,
      otherPreferredSkills,
      candidateQualities,
      languagesRequired,
      otherRequirements,
      isDraft
    } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!title && !isDraft) {
      throw new AppError('Job Title is required', 400);
    }

    // Compile readable full text if rawContent is not directly provided
    const compiledContent = rawContent || `
Job Title: ${title || 'Untitled'}
Department: ${department || 'N/A'} | Level: ${jobLevel || 'N/A'} | Type: ${employmentType || 'N/A'} | Work Mode: ${workMode || 'N/A'} | Location: ${location || 'N/A'}
Openings: ${openings || 1} | Expected Joining: ${joiningDate || 'ASAP'}

SUMMARY:
${shortSummary || 'N/A'}

PRIMARY RESPONSIBILITIES:
${Array.isArray(responsibilities) ? responsibilities.map((r: any) => `• ${r}`).join('\n') : 'N/A'}

DAY-TO-DAY WORK:
${dayToDayWork || 'N/A'}

REQUIRED TECHNICAL SKILLS:
${Array.isArray(requiredSkills) ? requiredSkills.map((s: any) => `• ${s.name || s} (${s.importance || 'Must Have'}, ${s.proficiency || 'Intermediate'})`).join('\n') : 'N/A'}

EXPERIENCE & EDUCATION:
• Experience: ${minExperience || 0} to ${maxExperience ? maxExperience + ' yrs' : 'open'} | Industry: ${industryExperience || 'Relevant'}
• Freshers Allowed: ${freshersAllowed ? 'Yes' : 'No'} ${fresherRequirements ? `(Requires: ${Array.isArray(fresherRequirements) ? fresherRequirements.join(', ') : fresherRequirements})` : ''}
• Minimum Education: ${minEducation || 'N/A'} | Degree: ${requiredDegree || 'N/A'} | CGPA: ${cgpaRequirement || 'N/A'}

PREFERRED SKILLS & QUALIFICATIONS:
• Preferred Skills: ${Array.isArray(preferredSkills) ? preferredSkills.join(', ') : preferredSkills || 'N/A'}
• Preferred Experience: ${preferredExperience || 'N/A'}
• Other Preferred: ${otherPreferredSkills || 'N/A'}

CANDIDATE QUALITIES & REQUIREMENTS:
• Key Qualities: ${candidateQualities || 'N/A'}
• Languages: ${Array.isArray(languagesRequired) ? languagesRequired.join(', ') : languagesRequired || 'N/A'}
• Additional Requirements: ${otherRequirements || 'N/A'}
    `.trim();

    const compiledSummary = shortSummary || `${title || 'Job Opening'} position in ${department || 'General'} department (${workMode || 'Hybrid'}, ${location || 'Remote'}). Requirements: ${minExperience || 0}+ years exp, ${minEducation || "Bachelor's"}.`;

    // Perform Canonical Normalization & Interview Blueprint Analysis (Preserves explicit recruiter inputs)
    const analysis = await JDAnalysisService.normalizeAndAnalyzeFormJD(req.body);

    const jd = await prisma.jobDescription.create({
      data: {
        recruiterId: recruiter.id,
        title: title || 'Untitled Job Draft',
        rawContent: compiledContent,
        aiSummary: analysis.aiSummary || compiledSummary,
        aiAnalysis: analysis.aiAnalysis as any,
        normalizedJD: analysis.normalizedJD as any,
        interviewBlueprint: analysis.interviewBlueprint as any,
        contentHash: analysis.contentHash,
        analysisVersion: 'v2',
        department,
        jobLevel,
        employmentType,
        openings: openings ? parseInt(String(openings), 10) : 1,
        location,
        workMode,
        joiningDate,
        shortSummary,
        positionReason,
        responsibilities,
        dayToDayWork,
        requiredSkills,
        minExperience: minExperience ? parseFloat(String(minExperience)) : 0,
        maxExperience: maxExperience ? parseFloat(String(maxExperience)) : null,
        relevantExperience,
        industryExperience,
        freshersAllowed: Boolean(freshersAllowed),
        fresherRequirements,
        minEducation,
        requiredDegree,
        cgpaRequirement,
        certificationsRequired,
        preferredSkills,
        preferredExperience,
        otherPreferredSkills,
        candidateQualities,
        languagesRequired,
        otherRequirements,
        isDraft: Boolean(isDraft)
      }
    });

    return res.status(201).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/jd/upload
 * Recruiter uploads Quick-Paste Job Description -> AI JD Parser -> Canonical Normalized JD -> Interview Blueprint -> stored in DB
 */
router.post('/jd/upload', async (req, res, next) => {
  try {
    const { recruiterId, userId, title, content } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!title || !content) {
      throw new AppError('Job title and content are required', 400);
    }

    // AI Analysis producing identical Canonical Normalized JD and Blueprint
    const analysis = await JDAnalysisService.analyzeQuickPasteJD(content, title);
    const norm = analysis.normalizedJD;

    // Save in DB with both normalized schemas and individual fields
    const jd = await prisma.jobDescription.create({
      data: {
        recruiterId: recruiter.id,
        title: title || norm.job.title,
        rawContent: content,
        aiSummary: analysis.aiSummary,
        aiAnalysis: analysis.aiAnalysis as any,
        normalizedJD: norm as any,
        interviewBlueprint: analysis.interviewBlueprint as any,
        contentHash: analysis.contentHash,
        analysisVersion: 'v2',
        department: norm.job.department,
        jobLevel: norm.job.level,
        employmentType: norm.job.employmentType,
        openings: norm.job.openings,
        location: norm.job.location,
        workMode: norm.job.workMode,
        shortSummary: norm.role.summary,
        responsibilities: norm.responsibilities.map((r) => r.description),
        requiredSkills: norm.requiredSkills as any,
        preferredSkills: norm.preferredSkills.map((s) => s.name) as any,
        minExperience: norm.experience.minimumYears,
        maxExperience: norm.experience.maximumYears,
        freshersAllowed: norm.experience.freshersAllowed,
        minEducation: norm.education.minimumLevel,
        candidateQualities: norm.candidateQualities.behavioral.join(', '),
        languagesRequired: norm.candidateQualities.languages as any,
        isDraft: false,
      }
    });

    return res.status(201).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/jd/upload-file
 * Upload JD file (PDF, DOCX, TXT) -> Extract text via ResumeParser -> AI JD Analysis -> DB
 */
router.post('/jd/upload-file', upload.single('file'), async (req, res, next) => {
  try {
    const { recruiterId, userId, title } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError('Job description file (PDF/DOCX/TXT) is required', 400);
    }

    const recruiter = await resolveRecruiter(req, recruiterId || userId);
    const extractedContent = await ResumeParser.extractText(file.buffer, file.originalname);
    const jdTitle = title || file.originalname.replace(/\.[^/.]+$/, '');

    const analysis = await JDAnalysisService.analyzeQuickPasteJD(extractedContent, jdTitle);
    const norm = analysis.normalizedJD;

    const jd = await prisma.jobDescription.create({
      data: {
        recruiterId: recruiter.id,
        title: jdTitle || norm.job.title,
        rawContent: extractedContent,
        aiSummary: analysis.aiSummary,
        aiAnalysis: analysis.aiAnalysis as any,
        normalizedJD: norm as any,
        interviewBlueprint: analysis.interviewBlueprint as any,
        contentHash: analysis.contentHash,
        analysisVersion: 'v2',
        department: norm.job.department,
        jobLevel: norm.job.level,
        employmentType: norm.job.employmentType,
        openings: norm.job.openings,
        location: norm.job.location,
        workMode: norm.job.workMode,
        shortSummary: norm.role.summary,
        responsibilities: norm.responsibilities.map((r) => r.description),
        requiredSkills: norm.requiredSkills as any,
        preferredSkills: norm.preferredSkills.map((s) => s.name) as any,
        minExperience: norm.experience.minimumYears,
        maxExperience: norm.experience.maximumYears,
        freshersAllowed: norm.experience.freshersAllowed,
        minEducation: norm.education.minimumLevel,
        candidateQualities: norm.candidateQualities.behavioral.join(', '),
        languagesRequired: norm.candidateQualities.languages as any,
        isDraft: false,
      },
    });

    return res.status(201).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/jd/:id/blueprint
 * Get Interview Blueprint & Normalized JD for a specific job opening
 */
router.get('/jd/:id/blueprint', async (req, res, next) => {
  try {
    const { id } = req.params;
    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        normalizedJD: true,
        interviewBlueprint: true,
        aiSummary: true,
        aiAnalysis: true,
      },
    });

    if (!jd) {
      throw new AppError('Job Description not found', 404);
    }

    return res.status(200).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/jds/:recruiterId
 * List all JDs uploaded by a recruiter
 */
router.get('/jds/:recruiterId', async (req, res, next) => {
  try {
    const { recruiterId } = req.params;
    const recruiter = await resolveRecruiter(req, recruiterId);

    const jds = await prisma.jobDescription.findMany({
      where: { recruiterId: recruiter.id },
      orderBy: { createdAt: 'desc' },
      include: {
        invitations: {
          select: { id: true, applicantEmail: true, status: true, createdAt: true }
        }
      }
    });

    return res.status(200).json({ status: 'success', data: jds });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/invite
 * Recruiter sends an invitation link to an applicant email
 */
router.post('/invite', async (req, res, next) => {
  try {
    const { recruiterId, userId, jobDescriptionId, applicantEmail } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!jobDescriptionId || !applicantEmail) {
      throw new AppError('jobDescriptionId and applicantEmail are required', 400);
    }

    const invitation = await InvitationService.createInvitation(recruiter.id, jobDescriptionId, applicantEmail);
    return res.status(201).json({ status: 'success', data: invitation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/invitations/:recruiterId
 * List all invitations sent by recruiter with statuses and applicant details
 */
router.get('/invitations/:recruiterId', async (req, res, next) => {
  try {
    const { recruiterId } = req.params;
    const recruiter = await resolveRecruiter(req, recruiterId);

    const invitations = await prisma.interviewInvitation.findMany({
      where: { recruiterId: recruiter.id },
      orderBy: { createdAt: 'desc' },
      include: {
        jobDescription: { select: { id: true, title: true, aiSummary: true } },
        applicant: { select: { id: true, name: true, email: true } },
        applicantResume: { select: { id: true, fileName: true, aiSummary: true, aiAnalysis: true } },
        interviewSession: {
          select: {
            id: true,
            status: true,
            applicationStatus: true,
            totalScore: true,
            overallRecommendation: true,
            evaluationData: true
          }
        }
      }
    });

    return res.status(200).json({ status: 'success', data: invitations });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/jd/upload-stage1
 * Stage 1: Upload JD file/text -> olmOCR 2 -> Markdown -> OpenAI Stage 1 Analysis + Clarification Questions
 */
router.post('/jd/upload-stage1', upload.single('file'), async (req, res, next) => {
  try {
    const { recruiterId, userId, title, content } = req.body;
    const file = req.file;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    let extractedMarkdown = '';
    let jdTitle = title || '';

    if (file) {
      extractedMarkdown = await ResumeParser.extractText(file.buffer, file.originalname);
      if (!jdTitle) jdTitle = file.originalname.replace(/\.[^/.]+$/, '');
    } else if (content) {
      extractedMarkdown = content;
    } else {
      throw new AppError('Job description file or content is required', 400);
    }

    if (!jdTitle) jdTitle = 'Untitled Job Opening';

    // Call 1: Analyze Markdown and generate questions if ambiguous
    const stage1Result = await JDStageAnalyzer.analyzeMarkdownJD(extractedMarkdown);

    const processingStatus = stage1Result.needsClarification ? 'NEEDS_CLARIFICATION' : 'COMPLETED';

    const jd = await prisma.jobDescription.create({
      data: {
        recruiterId: recruiter.id,
        title: jdTitle,
        rawContent: extractedMarkdown,
        extractedMarkdown,
        initialStructuredJD: stage1Result.structuredJD as any,
        clarificationQuestions: stage1Result.questions as any,
        finalStructuredJD: stage1Result.needsClarification ? null : (stage1Result.structuredJD as any),
        processingStatus,
        isDraft: false,
      },
    });

    return res.status(201).json({
      status: 'success',
      data: {
        id: jd.id,
        title: jd.title,
        processingStatus,
        questionCount: stage1Result.questionCount,
        questions: stage1Result.questions,
        initialStructuredJD: stage1Result.structuredJD,
        extractedMarkdown,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/jd/stage2-finalize
 * Stage 2: Submit ALL recruiter clarification answers in ONE step -> OpenAI Final Structured JD -> DB Persistence
 */
router.post('/jd/stage2-finalize', async (req, res, next) => {
  try {
    const { recruiterId, userId, jobDescriptionId, answers } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!jobDescriptionId || !Array.isArray(answers)) {
      throw new AppError('jobDescriptionId and answers array are required', 400);
    }

    const jd = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId },
    });

    if (!jd || jd.recruiterId !== recruiter.id) {
      throw new AppError('Job Description not found or unauthorized', 404);
    }

    const initialJD = (jd.initialStructuredJD as any) || {};
    const questions = (jd.clarificationQuestions as any) || [];

    // Call 2: OpenAI finalization using answers
    const finalStructuredJD = await JDStageAnalyzer.finalizeStructuredJD(initialJD, questions, answers);

    const updatedJD = await prisma.jobDescription.update({
      where: { id: jd.id },
      data: {
        recruiterAnswers: answers as any,
        finalStructuredJD: finalStructuredJD as any,
        processingStatus: 'COMPLETED',
      },
    });

    return res.status(200).json({
      status: 'success',
      data: updatedJD,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/interview/:id/evidence-report
 * Get complete Explainable Candidate Report (Candidate Evidence Profile, Q&A Transcript with silence latency, Eye Movement Gaze Stability, YOLO phone/out-of-screen counts, Evidence Graph)
 */
router.get('/interview/:id/evidence-report', async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
    if (!id) throw new AppError('Session ID required', 400);
    const report = await InterviewService.getExplainableReport(id as string);

    const session = await prisma.interviewSession.findUnique({
      where: { id: id as string },
      include: {
        invitation: {
          include: {
            jobDescription: true,
            applicantResume: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        ...report,
        evidenceGraph: session?.evidenceGraph,
        evidenceGaps: session?.evidenceGaps,
        verifiedClaims: session?.verifiedClaims,
        contradictions: session?.contradictions,
        githubEvidence: session?.githubEvidence,
        aiFluency: session?.aiFluency,
        evidenceReport: session?.evidenceReport,
        evaluationData: session?.evaluationData,
        jobTitle: session?.invitation?.jobDescription?.title || report.jobTitle,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
