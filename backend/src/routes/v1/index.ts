import { Router } from 'express';
import voiceRoutes from './voiceRoutes';
import interviewRoutes from './interviewRoutes';
import adminRoutes from './adminRoutes';
import authRoutes from './authRoutes';
import recruiterRoutes from './recruiterRoutes';
import applicantRoutes from './applicantRoutes';
import invitationRoutes from './invitationRoutes';

const router = Router();

router.use('/voice', voiceRoutes);
router.use('/interview', interviewRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/recruiter', recruiterRoutes);
router.use('/applicant', applicantRoutes);
router.use('/invitation', invitationRoutes);

export default router;
