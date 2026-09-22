import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { generateSecureToken, hashToken } from '../utils/token';
import { SecurityLogger } from '../config/securityLogger';
import { User, Session } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: 'RECRUITER' | 'APPLICANT';
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionValidationResult {
  session: Session;
  user: AuthenticatedUser;
}

export class SessionService {
  /**
   * Creates a new cryptographically secure server-side session.
   * Stores the SHA-256 hash of the session token in the database.
   * Returns the raw token to be delivered to the client via HttpOnly cookie.
   */
  static async createSession(
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ rawToken: string; session: Session }> {
    const rawToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + env.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId,
        sessionTokenHash,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return { rawToken, session };
  }

  /**
   * Validates a raw session token.
   * Verifies the token hash matches an active, unexpired, non-revoked session.
   */
  static async validateSession(rawToken: string): Promise<SessionValidationResult | null> {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const sessionTokenHash = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { sessionTokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check if session is revoked
    if (session.revokedAt) {
      SecurityLogger.warn('UNAUTHORIZED_ACCESS_ATTEMPT', {
        reason: 'Revoked session accessed',
        userId: session.userId,
      });
      return null;
    }

    // Check if session is expired
    if (session.expiresAt <= new Date()) {
      return null;
    }

    // Touch lastUsedAt asynchronously without blocking request
    prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      // Ignore background timestamp update errors
    });

    return {
      session,
      user: session.user,
    };
  }

  /**
   * Revokes a specific session by raw token or session ID.
   */
  static async revokeSession(tokenOrSessionId: string): Promise<boolean> {
    if (!tokenOrSessionId) return false;

    try {
      const isRawToken = tokenOrSessionId.length === 64;
      if (isRawToken) {
        const sessionTokenHash = hashToken(tokenOrSessionId);
        await prisma.session.updateMany({
          where: { sessionTokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else {
        await prisma.session.updateMany({
          where: { id: tokenOrSessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      SecurityLogger.log('SESSION_REVOKED', { tokenOrSessionId });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Revokes all active sessions for a given user (e.g. after password reset).
   */
  static async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    SecurityLogger.log('ALL_SESSIONS_REVOKED', { userId, count: result.count });
    return result.count;
  }
}
