import { hash, verify } from '@node-rs/argon2';

/**
 * OWASP Recommended Argon2id parameters:
 * - memoryCost: 64 MB (65536 KiB)
 * - timeCost (iterations): 3
 * - parallelism: 4
 */
const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Pre-computed dummy hash to neutralize timing attacks when an email is not found
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$vU0o3K5p2z9Qx6L8Y1j4Aw$Y8u9K3f8Z0e2A4b6C8d0E2f4G6h8I0j2K4l6M8n0O2p';

export interface PasswordValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates password complexity:
 * - Length: 8 to 128 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special symbol
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (typeof password !== 'string') {
    return { isValid: false, reason: 'Password must be a string' };
  }
  if (password.length < 8) {
    return { isValid: false, reason: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { isValid: false, reason: 'Password must not exceed 128 characters' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one numeric digit' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one special character' };
  }

  return { isValid: true };
}

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id password hash.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Performs a constant-time dummy verification when user is not found
 * to prevent user enumeration through timing side-channel attacks.
 */
export async function dummyVerify(): Promise<void> {
  try {
    await verify(DUMMY_HASH, 'dummy-password-check-123456');
  } catch {
    // Ignore dummy verification failure
  }
}
