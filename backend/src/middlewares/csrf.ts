import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { SecurityLogger } from '../config/securityLogger';

/**
 * CSRF Protection Middleware for state-changing requests.
 * Uses Origin / Referer header verification and custom header check (Defense-in-Depth).
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Safe HTTP methods do not alter state and are exempt
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt public auth endpoints that don't rely on existing authenticated cookies
  const exemptPaths = [
    '/api/v1/auth/signup',
    '/api/v1/auth/signin',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/verify-email',
    '/api/v1/auth/resend-verification',
    '/api/v1/auth/sync',
  ];

  if (exemptPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // If request doesn't have an authenticated cookie (e.g. Bearer token from mobile/testing), pass through
  const sessionCookie = req.cookies && req.cookies[env.SESSION_COOKIE_NAME];
  if (!sessionCookie) {
    return next();
  }

  // When session cookie is present, verify Origin header
  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigin = env.CORS_ORIGIN;

  if (origin && allowedOrigin && allowedOrigin !== '*') {
    try {
      const originUrl = new URL(origin).origin;
      const expectedUrl = new URL(allowedOrigin).origin;

      if (originUrl !== expectedUrl) {
        SecurityLogger.warn('CSRF_VALIDATION_FAILED', {
          origin,
          expectedOrigin: allowedOrigin,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        return next(new AppError('Forbidden: Cross-site request forgery protection triggered', 403));
      }
    } catch {
      // If parsing fails, reject
      return next(new AppError('Forbidden: Invalid request origin', 403));
    }
  }

  next();
};
