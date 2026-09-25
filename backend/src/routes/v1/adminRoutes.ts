import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { InterviewService } from '../../services/InterviewService';
import { S3Service } from '../../services/S3Service';
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
      whereClause.OR = [
        {
          invitation: {
            OR: [
              { recruiterId: recruiterId },
              { jobDescription: { recruiterId: recruiterId } }
            ]
          }
        },
        {
          invitation: null
        }
      ];
    }

    const sessions = await prisma.interviewSession.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        questionBlueprint: true,
        status: true,
        applicationStatus: true,
        overallRecommendation: true,
        totalScore: true,
        cheatCount: true,
        evaluationData: true,
        feedback: true,
        eyeTrackingData: true,
        responseLatencies: true,
        proctoringSummary: true,
        proctoringTimeline: true,
        createdAt: true,
        updatedAt: true,
        invitation: {
          select: {
            id: true,
            jobDescription: { select: { id: true, title: true } },
            applicantResume: { select: { id: true, fileName: true, aiSummary: true } }
          }
        },
        messages: {
          where: { role: { not: 'system' } },
          select: { role: true, content: true, technicalAccuracy: true, technicalDepth: true, clarity: true, problemSolving: true, silenceLatency: true, ttsDuration: true, createdAt: true },
          orderBy: { createdAt: 'asc' }
        },
        detectionEvents: {
          select: {
            id: true,
            eventType: true,
            objectClass: true,
            confidence: true,
            riskLevel: true,
            source: true,
            timestamp: true,
            metadata: true,
          },
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    // Resolve S3 presigned URLs for detection event snapshots
    const enhancedSessions = await Promise.all(
      sessions.map(async (session) => {
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
                snapshotUrl: presignedSnapshotUrl,
                snapshot: presignedSnapshotUrl,
              },
            };
          })
        );

        return {
          ...session,
          invitationId: session.invitation?.id || null,
          detectionEvents: enhancedEvents,
        };
      })
    );

    return res.status(200).json({ status: 'success', data: enhancedSessions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/interviews/:sessionId/screenshot-url
 * Returns a short-lived presigned GET URL for a specific S3 screenshot key after authorization check.
 */
router.get('/interviews/:sessionId/screenshot-url', async (req: any, res, next) => {
  try {
    const { sessionId } = req.params;
    const key = req.query.key as string;

    if (!sessionId || !key) {
      throw new AppError('sessionId and key query parameter are required', 400);
    }

    // Verify requesting user is authorized for this interview session
    const isAuthorized = await S3Service.isUserAuthorizedForInterview(req.user?.id, req.user?.role, sessionId);
    if (!isAuthorized) {
      throw new AppError('Unauthorized: You do not have access to this interview session', 403);
    }

    const presignedUrl = await S3Service.getPresignedUrl(key);
    return res.status(200).json({ status: 'success', data: { url: presignedUrl, key } });
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
