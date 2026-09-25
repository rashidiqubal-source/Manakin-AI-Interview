import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { SecurityLogger } from '../config/securityLogger';

/**
 * CSRF Protection Middleware for state-changing requests.
 * Uses Origin / Referer header verification and custom header check (Defense-in-Depth).
 */
/**
 * Parses a URL string to its lowercase origin (e.g. 'https://manakin-ai-interview.vercel.app').
 */
const getCleanOrigin = (urlStr?: string): string | null => {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).origin.toLowerCase();
  } catch {
    return null;
  }
};

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

  // If custom anti-CSRF request header is present (set by our SPA client, rejected by browsers cross-origin)
  const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
  if (customHeader) {
    return next();
  }

  // If wild-card CORS origin is explicitly configured, skip CSRF origin restriction
  if (env.CORS_ORIGIN === '*') {
    return next();
  }

  // Collect and parse all allowed origins from CORS_ORIGIN and FRONTEND_URL
  const allowedOrigins = new Set<string>();
  const rawCandidates = [
    ...env.CORS_ORIGIN.split(','),
    ...env.FRONTEND_URL.split(','),
    'https://manakin-ai-interview.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  for (const candidate of rawCandidates) {
    const clean = getCleanOrigin(candidate.trim());
    if (clean) allowedOrigins.add(clean);
  }

  // When session cookie is present, verify Origin / Referer header
  const rawOrigin = req.headers.origin || req.headers.referer;
  const requestOrigin = getCleanOrigin(rawOrigin as string);

  if (requestOrigin) {
    // 1. Direct match with allowed origins
    if (allowedOrigins.has(requestOrigin)) {
      return next();
    }

    // 2. Allow Vercel preview or production deployments for manakin-ai-interview
    if (
      requestOrigin.endsWith('.vercel.app') &&
      (requestOrigin.includes('manakin-ai-interview') || requestOrigin.includes('ai-interview'))
    ) {
      return next();
    }

    SecurityLogger.warn('CSRF_VALIDATION_FAILED', {
      origin: rawOrigin,
      parsedOrigin: requestOrigin,
      allowedOrigins: Array.from(allowedOrigins),
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return next(new AppError('Forbidden: Cross-site request forgery protection triggered', 403));
  }

  next();
};
