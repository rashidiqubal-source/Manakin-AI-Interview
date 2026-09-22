import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { SecurityLogger } from '../config/securityLogger';
import { UserRole } from '@prisma/client';

/**
 * Role-Based Access Control (RBAC) middleware.
 * Ensures the authenticated user possesses one of the required roles.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized: Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      SecurityLogger.warn('FORBIDDEN_ACCESS_ATTEMPT', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
      });
      return next(new AppError('Forbidden: You do not have permission to access this resource', 403));
    }

    next();
  };
};

/**
 * Ensures the user has verified their email before accessing sensitive operations.
 */
export const requireVerifiedEmail = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Unauthorized: Authentication required', 401));
  }

  if (!req.user.emailVerified) {
    return next(new AppError('Forbidden: Please verify your email address before continuing', 403));
  }

  next();
};
