import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters'),
    name: z
      .string()
      .trim()
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    role: z
      .enum(['RECRUITER', 'APPLICANT'])
      .optional()
      .default('APPLICANT'),
  }),
});

export const applicantSignupSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters'),
    name: z
      .string()
      .trim()
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    role: z
      .literal('APPLICANT')
      .optional()
      .default('APPLICANT'),
  }),
});

export const recruiterSignupSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters'),
    name: z
      .string()
      .trim()
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    role: z
      .literal('RECRUITER')
      .optional()
      .default('RECRUITER'),
  }),
});

export const signinSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(1, 'Password cannot be empty')
      .max(128, 'Password cannot exceed 128 characters'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z
      .string()
      .trim()
      .min(16, 'Invalid token length')
      .max(128, 'Invalid token length'),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string()
      .trim()
      .min(16, 'Invalid token length')
      .max(128, 'Invalid token length'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .max(128, 'New password cannot exceed 128 characters'),
  }),
});
