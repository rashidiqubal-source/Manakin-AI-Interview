import { Router } from 'express';
import { InvitationService } from '../../services/InvitationService';
import { AppError } from '../../utils/AppError';
import { optionalAuth } from '../../middlewares/requireAuth';

const router = Router();
router.use(optionalAuth);

/**
 * GET /api/v1/invitation/:token
 * Public endpoint to resolve invitation details for the landing page
 */
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const invitation = await InvitationService.resolveInvitation(token);
    return res.status(200).json({ status: 'success', data: invitation });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/invitation/:token/claim
 * Claim an invitation when applicant logs in / registers via unique link
 */
router.post('/:token/claim', async (req, res, next) => {
  try {
    const { token } = req.params;
    const applicantId = req.user?.id || req.body.applicantId || req.body.userId;

    if (!applicantId) {
      throw new AppError('Authentication or applicantId is required to claim an invitation', 400);
    }

    const invitation = await InvitationService.claimInvitation(token, applicantId);
    return res.status(200).json({ status: 'success', data: invitation });
  } catch (error) {
    next(error);
  }
});

export default router;
