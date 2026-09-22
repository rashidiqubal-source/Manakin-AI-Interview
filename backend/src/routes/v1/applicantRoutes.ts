import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { ResumeAnalysisService } from '../../services/ResumeAnalysisService';
import { InterviewService } from '../../services/InterviewService';
import { optionalAuth } from '../../middlewares/requireAuth';

const router = Router();
router.use(optionalAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Helper to resolve applicant user from session context or provided ID
 */
async function resolveApplicant(req: any, fallbackId?: string) {
  const userId = fallbackId || req.user?.id;
  if (!userId) {
    throw new AppError('Applicant authentication or ID is required', 400);
  }


  const applicant = await prisma.user.findUnique({ where: { id: userId } });
  if (!applicant) {
    throw new AppError('Applicant profile not found', 404);
  }

  return applicant;
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

    const applicant = await resolveApplicant(req, applicantId || userId);

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
 * Start a customized AI interview linked to an invitation (JD + Resume)
 */
router.post('/interview/start', async (req, res, next) => {
  try {
    const { invitationId, candidateName, candidateEmail } = req.body;

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

    const name = candidateName || invitation.applicant?.name || invitation.applicantEmail.split('@')[0];
    const email = candidateEmail || invitation.applicantEmail;

    const result = await InterviewService.startInterview(name, email, invitationId);
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
