import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { SessionService } from '../services/SessionService';
import { AppError } from '../utils/AppError';
import { SecurityLogger } from '../config/securityLogger';

/**
 * Extracts raw session token from signed/secure cookie or Bearer header.
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Check HTTP-only cookie first (primary browser auth)
  if (req.cookies && req.cookies[env.SESSION_COOKIE_NAME]) {
    return req.cookies[env.SESSION_COOKIE_NAME];
  }

  // 2. Check Authorization Bearer header (for mobile / API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Middleware: Requires a valid, active server-side session.
 * Rejects with 401 Unauthorized if missing, expired, or revoked.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const rawToken = extractSessionToken(req);

  if (!rawToken) {
    SecurityLogger.warn('UNAUTHORIZED_ACCESS_ATTEMPT', {
      reason: 'No session token provided',
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return next(new AppError('Unauthorized: Authentication required', 401));
  }

  const result = await SessionService.validateSession(rawToken);

  if (!result) {
    SecurityLogger.warn('UNAUTHORIZED_ACCESS_ATTEMPT', {
      reason: 'Invalid, expired, or revoked session token',
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return next(new AppError('Unauthorized: Session has expired or is invalid', 401));
  }

  req.user = result.user;
  req.session = result.session;
  req.rawSessionToken = rawToken;

  next();
};

/**
 * Middleware: Attaches authenticated user if session is present,
 * but allows unauthenticated requests to proceed.
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const rawToken = extractSessionToken(req);
  if (!rawToken) {
    return next();
  }

  const result = await SessionService.validateSession(rawToken);
  if (result) {
    req.user = result.user;
    req.session = result.session;
    req.rawSessionToken = rawToken;
  }

  next();
};
