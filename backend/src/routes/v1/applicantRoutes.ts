import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { ResumeAnalysisService } from '../../services/ResumeAnalysisService';
import { InterviewService } from '../../services/InterviewService';
import { optionalAuth } from '../../middlewares/requireAuth';
import { logger } from '../../config/logger';

const router = Router();
router.use(optionalAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Helper to resolve applicant user from session context, provided ID, or invitation token
 */
async function resolveApplicant(req: any, fallbackId?: string, invitationToken?: string) {
  const userId = fallbackId || req.user?.id;
  if (userId) {
    const applicant = await prisma.user.findUnique({ where: { id: userId } });
    if (applicant) return applicant;
  }

  if (invitationToken) {
    const invitation = await prisma.interviewInvitation.findUnique({
      where: { token: invitationToken },
      include: { applicant: true },
    });

    if (invitation) {
      if (invitation.applicant) return invitation.applicant;
      let user = await prisma.user.findUnique({
        where: { email: invitation.applicantEmail.toLowerCase().trim() },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: invitation.applicantEmail.toLowerCase().trim(),
            name: invitation.applicantEmail.split('@')[0],
            role: 'APPLICANT',
            emailVerified: true,
          },
        });
      }
      await prisma.interviewInvitation.update({
        where: { id: invitation.id },
        data: { applicantId: user.id },
      });
      return user;
    }
  }

  throw new AppError('Applicant authentication or valid invitation token is required', 400);
}

/**
 * POST /api/v1/applicant/resume/upload
 * Applicant uploads resume PDF -> Extracted -> Rule-based + AI analyzed -> Stored in DB & linked to invitation
 */
router.post('/resume/upload', upload.single('resume'), async (req, res, next) => {
  try {
    const { applicantId, userId, invitationToken } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError('Resume PDF file is required', 400);
    }

    const applicant = await resolveApplicant(req, applicantId || userId, invitationToken);

    // Extract text and compute SHA-256 content hash
    const rawContent = await ResumeAnalysisService.extractText(file.buffer, file.originalname);
    const contentHash = ResumeAnalysisService.computeContentHash(rawContent);

    // Caching check: If exact same resume content exists for this user with analysisVersion v3, reuse immediately (0 LLM calls)
    const cachedResume = await prisma.applicantResume.findFirst({
      where: {
        applicantId: applicant.id,
        contentHash,
        analysisVersion: 'v3',
      },
    });

    let resume;

    if (cachedResume && cachedResume.normalizedResume) {
      resume = cachedResume;
    } else {
      // Process buffer (PDF/DOCX extract -> clean -> ONE structured LLM call -> deterministic normalization)
      const analyzed = await ResumeAnalysisService.analyzeResume(file.buffer, file.originalname);

      resume = await prisma.applicantResume.create({
        data: {
          applicantId: applicant.id,
          fileName: file.originalname || 'resume.pdf',
          rawContent,
          extractedMarkdown: rawContent,
          aiSummary: analyzed.aiSummary,
          aiAnalysis: analyzed.aiAnalysis as any,
          normalizedResume: analyzed.normalizedResume as any,
          contentHash,
          analysisVersion: 'v3',
        },
      });
    }

    // If an invitationToken was provided, link this resume directly to the invitation
    if (invitationToken) {
      const invitation = await prisma.interviewInvitation.findUnique({ where: { token: invitationToken } });
      if (invitation) {
        await prisma.interviewInvitation.update({
          where: { id: invitation.id },
          data: {
            applicantId: applicant.id,
            applicantResumeId: resume.id,
            githubUrl: req.body.githubUrl || invitation.githubUrl || undefined,
            status: invitation.status === 'PENDING' ? 'ACCEPTED' : invitation.status
          }
        });
      }
    }

    return res.status(201).json({ status: 'success', data: resume });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/applicant/invitations/:applicantId
 * List all invitations received by applicant with JD summaries and sessions
 */
router.get('/invitations/:applicantId', async (req, res, next) => {
  try {
    const { applicantId } = req.params;
    const applicant = await resolveApplicant(req, applicantId);

    // Also match invitations by email if user email matches
    const invitations = await prisma.interviewInvitation.findMany({
      where: {
        OR: [
          { applicantId: applicant.id },
          { applicantEmail: applicant.email }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        jobDescription: true,
        applicantResume: true,
        interviewSession: true,
        recruiter: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(200).json({ status: 'success', data: invitations });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/applicant/interview/start
 * Start a customized AI interview linked to an invitation (JD + Resume + GitHub)
 */
router.post('/interview/start', async (req, res, next) => {
  try {
    const { invitationId, candidateName, candidateEmail, githubUrl } = req.body;

    if (!invitationId) {
      throw new AppError('invitationId is required', 400);
    }

    const invitation = await prisma.interviewInvitation.findUnique({
      where: { id: invitationId },
      include: { applicant: true, jobDescription: true }
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    // Feature 3: No retake once interview is completed
    if (invitation.completedAt) {
      throw new AppError('This interview has already been completed and cannot be retaken. Please contact your recruiter.', 403);
    }

    // Feature 2: Block if candidate has exited mid-interview 3 or more times
    if (invitation.exitCount >= 3) {
      throw new AppError('You have exited this interview 3 times. Please contact your recruiter to get a new invitation.', 403);
    }

    const name = candidateName || invitation.applicant?.name || invitation.applicantEmail.split('@')[0];
    const email = candidateEmail || invitation.applicantEmail;
    const github = githubUrl || invitation.githubUrl || undefined;

    const result = await InterviewService.startInterview(name, email, invitationId, github);
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/applicant/interview/exit
 * Called when a candidate exits mid-interview.
 * Increments exitCount, triggers partial evaluation if sessionId provided.
 * After 3 exits: blocks and instructs candidate to contact recruiter.
 */
router.post('/interview/exit', async (req, res, next) => {
  try {
    const { invitationId, sessionId } = req.body;

    if (!invitationId) {
      throw new AppError('invitationId is required', 400);
    }

    const invitation = await prisma.interviewInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    // Don't increment if already completed
    if (invitation.completedAt) {
      return res.status(200).json({ status: 'success', message: 'Interview already completed.' });
    }

    const newExitCount = invitation.exitCount + 1;

    await prisma.interviewInvitation.update({
      where: { id: invitationId },
      data: { exitCount: newExitCount },
    });

    // If max exits reached, conclude early and reject without calling LLM evaluation API
    if (newExitCount >= 3) {
      if (sessionId) {
        InterviewService.concludeEarlyAndReject(sessionId, 'Candidate exceeded maximum exit attempts (3 exits).').catch((err: any) =>
          logger.warn(`[Exit] Early rejection failed for session ${sessionId}: ${err.message}`)
        );
      }
      return res.status(200).json({
        status: 'blocked',
        exitCount: newExitCount,
        message: 'You have exited this interview 3 times. Please contact your recruiter to continue.',
      });
    }

    return res.status(200).json({
      status: 'success',
      exitCount: newExitCount,
      remainingExits: 3 - newExitCount,
      message: `Interview paused. You have ${3 - newExitCount} attempt(s) remaining before this link is locked.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
