import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { env } from '../config/env';
import { extractSessionToken } from '../middlewares/requireAuth';
import { CookieOptions } from 'express';

/**
 * Builds standard secure cookie options according to environment configuration.
 */
export function getSessionCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production';
  const isSecure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : isProd;

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    maxAge: env.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
  };
}

export class AuthController {
  /**
   * POST /api/v1/auth/signup/applicant
   */
  static async signupApplicant(req: Request, res: Response) {
    const result = await AuthService.signup({ ...req.body, role: 'APPLICANT' }, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      data: {
        user: result.user,
      },
    });
  }

  /**
   * POST /api/v1/auth/signup/recruiter
   */
  static async signupRecruiter(req: Request, res: Response) {
    const result = await AuthService.signup({ ...req.body, role: 'RECRUITER' }, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      data: {
        user: result.user,
      },
    });
  }

  /**
   * POST /api/v1/auth/signup (Legacy / General)
   */
  static async signup(req: Request, res: Response) {
    const result = await AuthService.signup(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      data: {
        user: result.user,
      },
    });
  }

  /**
   * POST /api/v1/auth/signin (Single shared signin flow)
   */
  static async signin(req: Request, res: Response) {
    const result = await AuthService.signin(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const cookieOptions = getSessionCookieOptions();
    res.cookie(env.SESSION_COOKIE_NAME, result.rawToken, cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      user: result.user,
      accessToken: result.rawToken,
      data: {
        user: result.user,
        accessToken: result.rawToken,
      },
    });
  }

  /**
   * POST /api/v1/auth/signout
   */
  static async signout(req: Request, res: Response) {
    const rawToken = extractSessionToken(req);
    await AuthService.signout(rawToken || undefined);

    const cookieOptions = getSessionCookieOptions();
    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      domain: cookieOptions.domain,
    });

    return res.status(200).json({
      success: true,
      message: 'Signed out successfully',
    });
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }

  /**
   * POST /api/v1/auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response) {
    const { token } = req.body;
    const result = await AuthService.verifyEmail(token);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }

  /**
   * POST /api/v1/auth/resend-verification
   */
  static async resendVerification(req: Request, res: Response) {
    const { email } = req.body;
    const result = await AuthService.resendVerification(email, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }

  /**
   * POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }

  /**
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;
    const result = await AuthService.resetPassword(token, newPassword, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Clear existing session cookie on password reset
    const cookieOptions = getSessionCookieOptions();
    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      domain: cookieOptions.domain,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }
}
