import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { SecurityLogger } from '../config/securityLogger';

const createCustomLimiter = (windowMinutes: number, maxRequests: number, endpointName: string) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      SecurityLogger.warn('RATE_LIMIT_TRIGGERED', {
        endpoint: endpointName,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        success: false,
        message: `Too many requests for ${endpointName}. Please try again after ${windowMinutes} minutes.`,
      });
    },
  });
};

export const signinLimiter = createCustomLimiter(
  env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  env.AUTH_RATE_LIMIT_MAX_SIGNIN,
  'Sign-in'
);

export const signupLimiter = createCustomLimiter(
  env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  env.AUTH_RATE_LIMIT_MAX_SIGNUP,
  'Sign-up'
);

export const forgotPasswordLimiter = createCustomLimiter(
  env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  env.AUTH_RATE_LIMIT_MAX_FORGOT_PW,
  'Forgot Password'
);

export const resetPasswordLimiter = createCustomLimiter(
  env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  5,
  'Reset Password'
);

export const verifyEmailLimiter = createCustomLimiter(
  env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  10,
  'Email Verification'
);
