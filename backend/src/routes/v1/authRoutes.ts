import { Router } from 'express';
import { AuthController } from '../../controllers/authController';
import { validate } from '../../middlewares/validateRequest';
import { requireAuth } from '../../middlewares/requireAuth';
import {
  signupSchema,
  applicantSignupSchema,
  recruiterSignupSchema,
  signinSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../validations/authValidation';
import {
  signupLimiter,
  signinLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from '../../middlewares/rateLimiter';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';

const router = Router();

/**
 * POST /api/v1/auth/signup/applicant
 * Dedicated Applicant registration flow
 */
router.post('/signup/applicant', signupLimiter, validate(applicantSignupSchema), AuthController.signupApplicant);

/**
 * POST /api/v1/auth/signup/recruiter
 * Dedicated Recruiter registration flow
 */
router.post('/signup/recruiter', signupLimiter, validate(recruiterSignupSchema), AuthController.signupRecruiter);

/**
 * POST /api/v1/auth/signup
 * Backward-compatible registration flow
 */
router.post('/signup', signupLimiter, validate(signupSchema), AuthController.signup);

/**
 * POST /api/v1/auth/signin
 * Authenticate credentials, generate secure session, and set HttpOnly cookie
 */
router.post('/signin', signinLimiter, validate(signinSchema), AuthController.signin);

/**
 * POST /api/v1/auth/signout
 * Revoke active session and clear session cookie
 */
router.post('/signout', AuthController.signout);

/**
 * GET /api/v1/auth/me
 * Retrieve authenticated user profile from verified session
 */
router.get('/me', requireAuth, AuthController.me);

/**
 * POST /api/v1/auth/verify-email
 * Validate single-use verification token and mark email as verified
 */
router.post('/verify-email', verifyEmailLimiter, validate(verifyEmailSchema), AuthController.verifyEmail);

/**
 * POST /api/v1/auth/resend-verification
 * Resend email verification link with rate limiting and safe non-enumerable response
 */
router.post('/resend-verification', verifyEmailLimiter, validate(resendVerificationSchema), AuthController.resendVerification);

/**
 * POST /api/v1/auth/forgot-password
 * Issue single-use password reset token without leaking account existence
 */
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);

/**
 * POST /api/v1/auth/reset-password
 * Reset password, hash new password, and revoke all active sessions
 */
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), AuthController.resetPassword);

export default router;

