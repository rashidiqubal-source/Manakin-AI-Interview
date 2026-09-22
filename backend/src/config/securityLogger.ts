import { logger } from './logger';

export type SecurityEventType =
  | 'SIGNUP_SUCCESS'
  | 'SIGNIN_SUCCESS'
  | 'SIGNIN_FAILURE'
  | 'SIGNOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_SUCCESS'
  | 'EMAIL_VERIFIED'
  | 'EMAIL_VERIFICATION_RESENT'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'RATE_LIMIT_TRIGGERED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'FORBIDDEN_ACCESS_ATTEMPT'
  | 'CSRF_VALIDATION_FAILED';

export interface SecurityEventMetadata {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Sanitizes metadata to ensure zero sensitive data leakage into logs.
 * Strips any passwords, hashes, tokens, auth headers, and cookies.
 */
function sanitizeMetadata(meta: SecurityEventMetadata): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const forbiddenKeys = new Set([
    'password',
    'passwordhash',
    'newpassword',
    'currentpassword',
    'token',
    'rawtoken',
    'sessiontoken',
    'sessiontokenhash',
    'tokenhash',
    'resettoken',
    'verificationtoken',
    'cookie',
    'cookies',
    'authorization',
    'secret',
  ]);

  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as SecurityEventMetadata);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Security-focused structured event logger.
 */
export const SecurityLogger = {
  log(event: SecurityEventType, metadata: SecurityEventMetadata = {}): void {
    const sanitized = sanitizeMetadata(metadata);
    const logPayload = {
      event,
      timestamp: new Date().toISOString(),
      ...sanitized,
    };

    logger.info(`[SECURITY_AUDIT] [${event}] ${JSON.stringify(logPayload)}`);
  },

  warn(event: SecurityEventType, metadata: SecurityEventMetadata = {}): void {
    const sanitized = sanitizeMetadata(metadata);
    const logPayload = {
      event,
      timestamp: new Date().toISOString(),
      ...sanitized,
    };

    logger.warn(`[SECURITY_AUDIT] [${event}] ${JSON.stringify(logPayload)}`);
  },

  error(event: SecurityEventType, metadata: SecurityEventMetadata = {}): void {
    const sanitized = sanitizeMetadata(metadata);
    const logPayload = {
      event,
      timestamp: new Date().toISOString(),
      ...sanitized,
    };

    logger.error(`[SECURITY_AUDIT] [${event}] ${JSON.stringify(logPayload)}`);
  },
};
