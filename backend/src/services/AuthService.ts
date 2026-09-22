import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { hashPassword, verifyPassword, validatePassword, dummyVerify } from '../utils/password';
import { generateSecureToken, hashToken } from '../utils/token';
import { SessionService, AuthenticatedUser } from './SessionService';
import { EmailService } from './EmailService';
import { SecurityLogger } from '../config/securityLogger';
import { UserRole } from '@prisma/client';

export interface SignupDTO {
  email: string;
  password: string;
  name?: string;
  role?: 'RECRUITER' | 'APPLICANT';
}

export interface SigninDTO {
  email: string;
  password: string;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Registers a new user with Argon2id password hashing and verification email.
   */
  static async signup(dto: SignupDTO, metadata?: RequestMetadata) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Enforce strong password complexity rules
    const passwordCheck = validatePassword(dto.password);
    if (!passwordCheck.isValid) {
      throw new AppError(passwordCheck.reason || 'Password does not meet complexity requirements', 400);
    }

    // Check if account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      SecurityLogger.warn('UNAUTHORIZED_ACCESS_ATTEMPT', {
        reason: 'Duplicate registration attempt',
        email: normalizedEmail,
        ip: metadata?.ip,
      });
      // Return 409 Conflict with generic safe message
      throw new AppError('An account with this email address already exists', 409);
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(dto.password);

    const userRole: UserRole = dto.role === 'RECRUITER' ? 'RECRUITER' : 'APPLICANT';

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: dto.name?.trim() || normalizedEmail.split('@')[0],
        role: userRole,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Generate secure email verification token
    const rawVerificationToken = generateSecureToken(32);
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Send verification email asynchronously
    EmailService.sendVerificationEmail(user.email, rawVerificationToken, user.name || undefined).catch((err) => {
      SecurityLogger.error('SIGNUP_SUCCESS', {
        reason: 'Verification email dispatch error',
        userId: user.id,
        error: String(err),
      });
    });

    SecurityLogger.log('SIGNUP_SUCCESS', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    return {
      user,
      message: 'Registration successful. A verification email has been sent to your address.',
    };
  }

  /**
   * Authenticates user, verifies Argon2id hash with timing attack resistance, and creates session.
   */
  static async signin(dto: SigninDTO, metadata?: RequestMetadata) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user does not exist or has no password hash, perform dummy verification to prevent timing attacks
    if (!user || !user.passwordHash) {
      await dummyVerify();
      SecurityLogger.warn('SIGNIN_FAILURE', {
        reason: 'User not found or no password configured',
        email: normalizedEmail,
        ip: metadata?.ip,
      });
      throw new AppError('Invalid email or password', 401);
    }

    // Verify password hash
    const isPasswordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      SecurityLogger.warn('SIGNIN_FAILURE', {
        reason: 'Invalid password',
        userId: user.id,
        email: normalizedEmail,
        ip: metadata?.ip,
      });
      throw new AppError('Invalid email or password', 401);
    }

    // Create secure database session
    const { rawToken, session } = await SessionService.createSession(user.id, {
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    SecurityLogger.log('SIGNIN_SUCCESS', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: metadata?.ip,
    });

    const safeUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      rawToken,
      session,
      user: safeUser,
    };
  }

  /**
   * Signs out user and revokes current session.
   */
  static async signout(rawToken?: string) {
    if (rawToken) {
      await SessionService.revokeSession(rawToken);
    }
    SecurityLogger.log('SIGNOUT');
    return { success: true, message: 'Signed out successfully' };
  }

  /**
   * Verifies email with a cryptographically secure token.
   */
  static async verifyEmail(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new AppError('Invalid or expired verification token', 400);
    }

    const tokenHash = hashToken(rawToken);

    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    if (tokenRecord.usedAt) {
      throw new AppError('This verification token has already been used', 400);
    }

    if (tokenRecord.expiresAt <= new Date()) {
      throw new AppError('Verification link has expired. Please request a new one.', 400);
    }

    // Mark token as used and update user status in a transaction
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerified: true },
      }),
    ]);

    SecurityLogger.log('EMAIL_VERIFIED', { userId: tokenRecord.userId });

    return { message: 'Email verified successfully. You may now enjoy full access.' };
  }

  /**
   * Resends verification email if user exists and is unverified.
   */
  static async resendVerification(email: string, metadata?: RequestMetadata) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user exists and not verified, generate new token and send
    if (user && !user.emailVerified) {
      // Invalidate existing unused tokens for this user
      await prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      EmailService.sendVerificationEmail(user.email, rawToken, user.name || undefined).catch((err) => {
        SecurityLogger.error('EMAIL_VERIFICATION_RESENT', {
          reason: 'Resend email dispatch error',
          userId: user.id,
          error: String(err),
        });
      });

      SecurityLogger.log('EMAIL_VERIFICATION_RESENT', { userId: user.id });
    }

    // Always return safe generic message to prevent email enumeration
    return {
      message: 'If an unverified account exists with this email address, a new verification link has been sent.',
    };
  }

  /**
   * Initiates forgot password flow without leaking account existence.
   */
  static async forgotPassword(email: string, metadata?: RequestMetadata) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Invalidate existing unused password reset tokens
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawResetToken = generateSecureToken(32);
      const tokenHash = hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      EmailService.sendPasswordResetEmail(user.email, rawResetToken, user.name || undefined).catch((err) => {
        SecurityLogger.error('PASSWORD_RESET_REQUESTED', {
          reason: 'Password reset email dispatch error',
          userId: user.id,
          error: String(err),
        });
      });

      SecurityLogger.log('PASSWORD_RESET_REQUESTED', {
        userId: user.id,
        ip: metadata?.ip,
      });
    }

    // Safe generic response prevents account enumeration
    return {
      message: 'If an account exists for this email address, a password reset link has been sent.',
    };
  }

  /**
   * Resets password using valid token and revokes all existing sessions.
   */
  static async resetPassword(token: string, newPassword: string, metadata?: RequestMetadata) {
    if (!token || typeof token !== 'string') {
      throw new AppError('Invalid or expired password reset token', 400);
    }

    // Enforce password strength
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.isValid) {
      throw new AppError(passwordCheck.reason || 'New password does not meet complexity requirements', 400);
    }

    const tokenHash = hashToken(token);

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      throw new AppError('Invalid or expired password reset token', 400);
    }

    if (tokenRecord.usedAt) {
      throw new AppError('This password reset link has already been used', 400);
    }

    if (tokenRecord.expiresAt <= new Date()) {
      throw new AppError('Password reset link has expired. Please request a new one.', 400);
    }

    // Hash new password with Argon2id
    const passwordHash = await hashPassword(newPassword);

    // Atomically update password and mark reset token used
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      }),
    ]);

    // Security: Invalidate all previously active user sessions
    await SessionService.revokeAllUserSessions(tokenRecord.userId);

    SecurityLogger.log('PASSWORD_RESET_SUCCESS', {
      userId: tokenRecord.userId,
      ip: metadata?.ip,
    });

    return {
      message: 'Password has been reset successfully. Please sign in with your new password.',
    };
  }
}
