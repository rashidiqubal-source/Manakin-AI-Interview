import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { InterviewService } from '../../services/InterviewService';
import { optionalAuth } from '../../middlewares/requireAuth';

const router = Router();
router.use(optionalAuth);

/**
 * GET /api/v1/admin/candidates
 * Fetches candidates. Automatically scopes to recruiter's job openings when requested by a recruiter.
 */
router.get('/candidates', async (req: any, res, next) => {
  try {
    const recruiterId = (req.query.recruiterId as string) || (req.user?.role === 'RECRUITER' ? req.user.id : undefined);

    const whereClause: any = {};
    if (recruiterId) {
      whereClause.invitation = {
        OR: [
          { recruiterId: recruiterId },
          { jobDescription: { recruiterId: recruiterId } }
        ]
      };
    }

    const sessions = await prisma.interviewSession.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        status: true,
        applicationStatus: true,
        overallRecommendation: true,
        totalScore: true,
        cheatCount: true,
        evaluationData: true,
        feedback: true,
        createdAt: true,
        invitation: {
          select: {
            id: true,
            jobDescription: { select: { id: true, title: true } },
            applicantResume: { select: { id: true, fileName: true, aiSummary: true } }
          }
        },
        messages: {
          where: { role: { not: 'system' } },
          select: { role: true, content: true, clarity: true, warmth: true, simplicity: true, patience: true, fluency: true, createdAt: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return res.status(200).json({ status: 'success', data: sessions });
  } catch (error) {
    next(error);
  }
});

router.post('/status', async (req, res, next) => {
  try {
    const { sessionId, status, feedbackReason } = req.body;
    const updatedSession = await InterviewService.updateApplicationStatus(sessionId, status, feedbackReason);
    
    return res.status(200).json({ status: 'success', data: updatedSession });
  } catch (error) {
    next(error);
  }
});

export default router;
