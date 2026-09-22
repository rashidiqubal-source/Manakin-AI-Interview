# Production-Grade Authentication & Authorization System

This document provides a comprehensive, production-grade specification and architectural guide for the authentication and authorization system implemented in the AI-Interview platform.

---

## 1. Authentication Architecture

The logical and physical architecture implements defense-in-depth across every layer of the application:

```text
                               ┌───────────────────────────┐
                               │   Frontend / Client SPA   │
                               │   (Next.js / Browser)     │
                               └─────────────┬─────────────┘
                                             │ HTTPS / Secure Cookie
                                             ▼
                               ┌───────────────────────────┐
                               │     Express HTTP API      │
                               └─────────────┬─────────────┘
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
             ▼                               ▼                               ▼
     [Helmet Security]             [Rate Limiters]                 [CSRF Defense]
     • HSTS                        • /auth/signup (5/15m)          • Origin Header Check
     • X-Content-Type-Options      • /auth/signin (10/15m)         • Referer Validation
     • SameOrigin FrameOptions     • /auth/forgot-pw (5/15m)       • Method Filtering
             │                               │                               │
             └───────────────────────────────┼───────────────────────────────┘
                                             ▼
                               ┌───────────────────────────┐
                               │  Input Validation (Zod)   │
                               │  • Email format & len     │
                               │  • Password complexity    │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │     Auth Middleware       │
                               │  • requireAuth()          │
                               │  • requireRole(role)      │
                               │  • requireVerifiedEmail() │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │     Business Services     │
                               ├───────────────────────────┤
                               │ • AuthService             │
                               │ • SessionService          │
                               │ • EmailService            │
                               │ • SecurityLogger          │
                               └─────────────┬─────────────┘
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
             ▼                               ▼                               ▼
    [Argon2id Hashing]             [Session Management]           [Email Delivery]
    • 64MB memory cost             • 256-bit crypto tokens        • Mailero / Nodemailer
    • 3 iterations                 • SHA-256 DB token hashes      • Ethereal Dev Fallback
    • 4 parallel lanes             • Expiration & Revocation      • Verification & Resets
             │                               │                               │
             └───────────────────────────────┼───────────────────────────────┘
                                             ▼
                               ┌───────────────────────────┐
                               │     PostgreSQL Database   │
                               │  • User (Unique Email)    │
                               │  • Session                │
                               │  • EmailVerificationToken │
                               │  • PasswordResetToken     │
                               └───────────────────────────┘
```

---

## 2. Technology Decisions & Rationale

| Area | Choice | Rationale |
| :--- | :--- | :--- |
| **Password Hashing** | **Argon2id** (`@node-rs/argon2`) | Argon2id is the state-of-the-art password hashing winner (Password Hashing Competition). It provides hybrid protection against both side-channel timing attacks and GPU/ASIC-accelerated brute-force attacks. Configured with OWASP parameters (64MB memory, 3 iterations, 4 lanes). |
| **Session Architecture** | **Opaque Server-Side Sessions** | Unlike stateless JWTs (which cannot be revoked instantly without complex distributed blacklists), server-side sessions stored in PostgreSQL can be invalidated immediately upon signout, password reset, or suspicious activity. |
| **Token Storage** | **SHA-256 Hashed Tokens in DB** | Raw session tokens, email verification tokens, and password reset tokens are never stored in plaintext in the database. Only their SHA-256 hashes are persisted. If the database is read-compromised, attackers cannot hijack sessions or forge reset links. |
| **Session Delivery** | **HttpOnly, Secure, SameSite Cookie** | Storing session tokens in `localStorage` or `sessionStorage` exposes tokens to JavaScript XSS theft. HttpOnly cookies cannot be read by client scripts. `SameSite=Lax` prevents CSRF on cross-site requests. |
| **CSRF Defense** | **Defense-in-Depth (SameSite + Origin Verification)** | Combines strict SameSite cookie policies with server-side Origin / Referer validation on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`). |
| **CORS Strategy** | **Explicit Origin Whitelisting with Credentials** | `Access-Control-Allow-Origin: *` is strictly prohibited with credentialed cookies. The backend explicitly validates `env.CORS_ORIGIN` and sends `credentials: true`. |
| **Rate Limiting** | **Endpoint-Specific Tiered Limiters** | Protects `/signup`, `/signin`, `/forgot-password`, `/reset-password`, and `/verify-email` individually using `express-rate-limit` with customizable windows, preventing volumetric credential stuffing and DoS attacks. |
| **Email Verification** | **Cryptographic Single-Use 256-bit Tokens** | Tokens expire in 24 hours and are consumed atomically in a database transaction upon first use. |
| **Password Reset** | **Single-Use 1-Hour Tokens + Global Session Invalidation** | Password resets automatically revoke all existing sessions across all browsers/devices for that user, neutralizing hijacked accounts. |
| **Security Headers** | **Helmet Security Suite** | Enables `Strict-Transport-Security` (HSTS), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: SAMEORIGIN`. |

---

## 3. Database Schema

### `User`
Stores the core account identity, role, and verification status.

```prisma
model User {
  id                   String                  @id @default(uuid())
  clerkId              String?                 @unique
  email                String                  @unique
  name                 String?
  passwordHash         String?
  emailVerified        Boolean                 @default(false)
  role                 UserRole                @default(APPLICANT)
  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt

  sessions             Session[]
  emailVerifications   EmailVerificationToken[]
  passwordResets       PasswordResetToken[]
  jobDescriptions      JobDescription[]
  interviewInvitations InterviewInvitation[]   @relation("RecruiterInvitations")
  receivedInvitations  InterviewInvitation[]   @relation("ApplicantInvitations")
  resumes              ApplicantResume[]
}
```
* **Constraints**: `email` has a DB-level `UNIQUE` constraint. `clerkId` is optional to support both native auth and legacy/federated sync.

### `Session`
Stores active server-side sessions with SHA-256 hashed session identifiers.

```prisma
model Session {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionTokenHash String    @unique
  expiresAt        DateTime
  createdAt        DateTime  @default(now())
  lastUsedAt       DateTime  @default(now())
  revokedAt        DateTime?
  ipAddress        String?
  userAgent        String?

  @@index([userId])
  @@index([sessionTokenHash])
  @@index([expiresAt])
}
```
* **Indexes**: Indexed by `userId`, `sessionTokenHash`, and `expiresAt` for $O(1)$ lookups and fast garbage collection.

### `EmailVerificationToken`
Stores single-use email verification tokens.

```prisma
model EmailVerificationToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([tokenHash])
}
```

### `PasswordResetToken`
Stores single-use password reset tokens.

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([tokenHash])
}
```

---

## 4. Complete Signup Flow

```text
Browser / Client
       │
       │ POST /api/v1/auth/signup { email, password, name, role }
       ▼
[Rate Limiter (signupLimiter)] ──► Exceeded? ──► 429 Too Many Requests
       │
       ▼
[Input Validation (Zod)] ───────► Invalid? ──► 400 Bad Request
       │
       ▼
[AuthService.signup]
       │
       ├─► Normalize Email: trim() and toLowerCase()
       ├─► Validate Password Complexity (length 8-128, uppercase, lowercase, digit, symbol)
       ├─► Query User by Email
       │     └─► Found? ──► Log Security Event ──► 409 Conflict (Safe generic message)
       │
       ├─► Hash Password with Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
       ├─► Insert User into DB (emailVerified: false)
       ├─► Generate 32-byte cryptographically secure random token (rawToken)
       ├─► Compute tokenHash = SHA-256(rawToken)
       ├─► Insert EmailVerificationToken record (expiresAt = +24h)
       ├─► Dispatch Verification Email via EmailService (non-blocking)
       └─► Log SIGNUP_SUCCESS
       │
       ▼
201 Created Response:
{
  "success": true,
  "message": "Registration successful. A verification email has been sent to your address.",
  "data": { "user": { "id": "...", "email": "...", "role": "APPLICANT", "emailVerified": false } }
}
(Password hash and token are strictly excluded)
```

---

## 5. Complete Signin Flow

```text
Browser / Client
       │
       │ POST /api/v1/auth/signin { email, password }
       ▼
[Rate Limiter (signinLimiter)] ──► Exceeded? ──► 429 Too Many Requests
       │
       ▼
[Input Validation (Zod)] ───────► Invalid? ──► 400 Bad Request
       │
       ▼
[AuthService.signin]
       │
       ├─► Normalize Email
       ├─► Query User by Email
       │     └─► Not Found?
       │           ├─► Run dummyVerify() [Equalizes timing side-channel]
       │           ├─► Log SIGNIN_FAILURE
       │           └─► Throw 401 "Invalid email or password"
       │
       ├─► Verify Password Hash with verifyPassword(password, user.passwordHash)
       │     └─► Mismatch?
       │           ├─► Log SIGNIN_FAILURE
       │           └─► Throw 401 "Invalid email or password"
       │
       ├─► Generate 32-byte random session token (rawToken)
       ├─► Compute sessionTokenHash = SHA-256(rawToken)
       ├─► Insert Session record into DB (expiresAt = +7 days, ipAddress, userAgent)
       ├─► Log SIGNIN_SUCCESS
       │
       ▼
[AuthController.signin]
       │
       ├─► Set HttpOnly Cookie:
       │     Set-Cookie: ai_interview_session=<rawToken>;
       │                 Path=/;
       │                 HttpOnly;
       │                 SameSite=Lax;
       │                 Max-Age=604800;
       │                 [Secure in production]
       │
       ▼
200 OK Response:
{
  "success": true,
  "message": "Signed in successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "name": "...",
      "role": "APPLICANT",
      "emailVerified": false
    }
  }
}
```

---

## 6. Session Lifecycle

1. **Creation**: Generated on successful signin via `SessionService.createSession`. Token is 32 bytes (256 bits of entropy) in hex. Database stores only the SHA-256 hash.
2. **Validation**: Incoming requests carry the cookie or `Authorization: Bearer <token>` header. `requireAuth` computes SHA-256 of the token, looks up active session where `revokedAt IS NULL` and `expiresAt > NOW()`.
3. **Usage / Touch**: Upon successful validation, `lastUsedAt` is updated in the database asynchronously without blocking the request.
4. **Expiration**: Sessions naturally expire when `NOW() >= expiresAt` (default 7 days).
5. **Revocation**:
   - Explicit user logout via `POST /api/v1/auth/signout` sets `revokedAt = NOW()`.
   - Global session invalidation occurs automatically when a user resets their password via `SessionService.revokeAllUserSessions(userId)`.
6. **Logout**: Sets `revokedAt` in DB and sends response headers instructing the browser to clear the cookie:
   `Set-Cookie: ai_interview_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

---

## 7. Email Verification Flow

```text
1. User registers or calls /resend-verification
2. AuthService creates single-use 32-byte token, hashes with SHA-256, saves with 24h expiration
3. Verification link emailed: https://app.example.com/verify-email?token=<rawToken>
4. User clicks link -> Client submits POST /api/v1/auth/verify-email { token }
5. Backend hashes token -> Finds record -> Validates usedAt IS NULL and expiresAt > NOW()
6. Database Transaction:
   - Sets EmailVerificationToken.usedAt = NOW()
   - Sets User.emailVerified = true
7. Logs EMAIL_VERIFIED event
8. Returns 200 OK
```

---

## 8. Forgot Password Flow

```text
1. Client submits POST /api/v1/auth/forgot-password { email }
2. Endpoint rate-limited to 5 requests per 15 minutes
3. Email normalized -> User looked up
4. If user exists:
   - Previous unused reset tokens for this user are invalidated
   - New 32-byte token generated, hashed, stored with 1-hour expiration
   - Reset email sent with URL: https://app.example.com/reset-password?token=<rawToken>
   - Logs PASSWORD_RESET_REQUESTED
5. Always returns generic safe message:
   "If an account exists for this email address, a password reset link has been sent."
   (Guarantees zero user enumeration)
```

---

## 9. Reset Password Flow

```text
1. Client submits POST /api/v1/auth/reset-password { token, newPassword }
2. Validates newPassword complexity (length, uppercase, lowercase, digit, symbol)
3. Hashes token with SHA-256 -> Finds PasswordResetToken
4. Validates token exists, usedAt IS NULL, expiresAt > NOW()
5. Hashes newPassword with Argon2id
6. Database Transaction:
   - Sets PasswordResetToken.usedAt = NOW()
   - Updates User.passwordHash = <newArgon2idHash>
7. SessionService.revokeAllUserSessions(userId):
   - Sets revokedAt = NOW() on all active sessions for this user
8. Clears session cookie on response
9. Logs PASSWORD_RESET_SUCCESS
10. Returns 200 OK
```

---

## 10. API Reference

### `POST /api/v1/auth/signup`
* **Auth Required**: No
* **Rate Limit**: 5 requests / 15 minutes
* **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!@#",
  "name": "Jane Doe",
  "role": "APPLICANT"
}
```
* **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Registration successful. A verification email has been sent to your address.",
  "data": {
    "user": {
      "id": "c1f71a06-5b96-48c2-a9fb-13c58619bc9e",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "APPLICANT",
      "emailVerified": false,
      "createdAt": "2026-09-03T01:30:00.000Z"
    }
  }
}
```
* **Errors**: `400 Validation Error`, `409 Conflict`, `429 Rate Limit Exceeded`

---

### `POST /api/v1/auth/signin`
* **Auth Required**: No
* **Rate Limit**: 10 requests / 15 minutes
* **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!@#"
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Signed in successfully",
  "data": {
    "user": {
      "id": "c1f71a06-5b96-48c2-a9fb-13c58619bc9e",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "APPLICANT",
      "emailVerified": false
    }
  }
}
```
* **Headers Set**: `Set-Cookie: ai_interview_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
* **Errors**: `400 Validation Error`, `401 Invalid email or password`, `429 Rate Limit Exceeded`

---

### `POST /api/v1/auth/signout`
* **Auth Required**: No (Safe idempotent operation)
* **Request Body**: None
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

---

### `GET /api/v1/auth/me`
* **Auth Required**: Yes (`requireAuth`)
* **Request Headers / Cookies**: `Cookie: ai_interview_session=...` or `Authorization: Bearer <token>`
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "c1f71a06-5b96-48c2-a9fb-13c58619bc9e",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "APPLICANT",
      "emailVerified": true
    }
  }
}
```
* **Errors**: `401 Unauthorized: Authentication required`

---

### `POST /api/v1/auth/verify-email`
* **Auth Required**: No
* **Rate Limit**: 10 requests / 15 minutes
* **Request Body**:
```json
{
  "token": "4a18f2d5e69b07a4128f643e..."
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Email verified successfully. You may now enjoy full access."
}
```
* **Errors**: `400 Invalid or expired verification token`

---

### `POST /api/v1/auth/resend-verification`
* **Auth Required**: No
* **Rate Limit**: 10 requests / 15 minutes
* **Request Body**:
```json
{
  "email": "user@example.com"
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "If an unverified account exists with this email address, a new verification link has been sent."
}
```

---

### `POST /api/v1/auth/forgot-password`
* **Auth Required**: No
* **Rate Limit**: 5 requests / 15 minutes
* **Request Body**:
```json
{
  "email": "user@example.com"
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "If an account exists for this email address, a password reset link has been sent."
}
```

---

### `POST /api/v1/auth/reset-password`
* **Auth Required**: No
* **Rate Limit**: 5 requests / 15 minutes
* **Request Body**:
```json
{
  "token": "e8a93b4f1c7d206e...",
  "newPassword": "NewStrongPassword456$%^"
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please sign in with your new password."
}
```
* **Errors**: `400 Invalid or expired password reset token`, `400 Password complexity error`

---

## 11. Code Architecture

The backend follows a strict layered separation of concerns:

```text
HTTP Request
     │
     ▼
[routes/v1/authRoutes.ts]          ◄── Routes, URL mapping, rate limiters, validation binding
     │
     ▼
[controllers/authController.ts]     ◄── Parses HTTP, sets HttpOnly cookies, formats JSON
     │
     ▼
[services/AuthService.ts]          ◄── Core business logic & orchestration
     │
     ├─► [services/SessionService.ts]    ◄── Session lifecycle, hashing, DB storage
     ├─► [services/EmailService.ts]      ◄── Transactional email templates & transport
     ├─► [utils/password.ts]             ◄── Argon2id cryptographic hashing & complexity checks
     ├─► [utils/token.ts]                ◄── 256-bit token generation & SHA-256 hashing
     └─► [config/securityLogger.ts]      ◄── Sanitized audit log stream
     │
     ▼
[config/prisma.ts]                 ◄── PostgreSQL database ORM client
```

---

## 12. Function-by-Function Explanation

### `hashPassword(password: string): Promise<string>`
* **Purpose**: Hashes a plaintext password using Argon2id.
* **Input**: Plaintext password string.
* **Output**: Argon2id hash string (`$argon2id$v=19$...`).
* **Called by**: `AuthService.signup`, `AuthService.resetPassword`.
* **Calls**: `@node-rs/argon2.hash`.
* **Security Considerations**: OWASP memory cost 64MB, time cost 3, parallelism 4.
* **Failure Cases**: Rejects on unexpected non-string inputs.

### `verifyPassword(password: string, passwordHash: string): Promise<boolean>`
* **Purpose**: Validates plaintext password against Argon2id hash.
* **Input**: Plaintext password, Argon2id hash.
* **Output**: `boolean` (`true` if valid, `false` otherwise).
* **Called by**: `AuthService.signin`.
* **Calls**: `@node-rs/argon2.verify`.
* **Security Considerations**: Argon2id internal constant-time verification.
* **Failure Cases**: Returns `false` on malformed hashes without throwing unhandled exceptions.

### `dummyVerify(): Promise<void>`
* **Purpose**: Performs a dummy Argon2id hash calculation when a non-existent email is submitted during signin.
* **Input**: None.
* **Output**: `Promise<void>`.
* **Called by**: `AuthService.signin`.
* **Calls**: `@node-rs/argon2.verify` against a pre-computed dummy hash.
* **Security Considerations**: Equalizes execution time between existing and non-existing email signins to defeat timing side-channel attacks.

### `validatePassword(password: string): PasswordValidationResult`
* **Purpose**: Enforces password complexity rules.
* **Input**: Password string.
* **Output**: `{ isValid: boolean; reason?: string }`.
* **Called by**: `AuthService.signup`, `AuthService.resetPassword`.
* **Security Considerations**: Enforces min 8, max 128 characters, uppercase, lowercase, numbers, and symbols.

### `generateSecureToken(byteLength = 32): string`
* **Purpose**: Generates high-entropy cryptographic random tokens.
* **Input**: Byte length (default 32 bytes = 256 bits).
* **Output**: Hex-encoded string (64 characters).
* **Called by**: `SessionService.createSession`, `AuthService.signup`, `AuthService.forgotPassword`.
* **Calls**: `crypto.randomBytes`.
* **Security Considerations**: Uses OS CSPRNG.

### `hashToken(token: string): string`
* **Purpose**: Computes SHA-256 digest of high-value tokens before saving to database.
* **Input**: Raw token string.
* **Output**: 64-character SHA-256 hex string.
* **Called by**: `SessionService`, `AuthService`.
* **Calls**: `crypto.createHash('sha256')`.
* **Security Considerations**: Protects active sessions and tokens from database leak exposure.

### `createSession(userId: string, metadata?: RequestMetadata): Promise<{ rawToken, session }>`
* **Purpose**: Creates an active server-side session in PostgreSQL.
* **Input**: `userId`, optional IP and User-Agent.
* **Output**: Raw token for cookie and created `Session` entity.
* **Called by**: `AuthService.signin`.
* **Calls**: `generateSecureToken`, `hashToken`, `prisma.session.create`.

### `validateSession(rawToken: string): Promise<SessionValidationResult | null>`
* **Purpose**: Validates token hash, checks revocation and expiration, and fetches user.
* **Input**: Raw session token from cookie/header.
* **Output**: `{ session, user }` or `null`.
* **Called by**: `requireAuth` middleware.
* **Calls**: `hashToken`, `prisma.session.findUnique`, `prisma.session.update` (touch lastUsedAt).

### `revokeSession(tokenOrSessionId: string): Promise<boolean>`
* **Purpose**: Revokes a single session.
* **Input**: Raw token or session ID.
* **Output**: `boolean`.
* **Called by**: `AuthService.signout`.
* **Calls**: `prisma.session.updateMany` setting `revokedAt = NOW()`.

### `revokeAllUserSessions(userId: string): Promise<number>`
* **Purpose**: Revokes all active sessions for a user upon password reset or security compromise.
* **Input**: `userId`.
* **Output**: Number of sessions revoked.
* **Called by**: `AuthService.resetPassword`.

### `requireAuth(req, res, next)`
* **Purpose**: Middleware enforcing session authentication.
* **Input**: Express request with cookie or Bearer header.
* **Output**: Attaches `req.user` and `req.session` or returns 401.

### `requireRole(...allowedRoles: UserRole[])`
* **Purpose**: RBAC authorization middleware.
* **Input**: Allowed roles (e.g. `['RECRUITER']`).
* **Output**: Calls `next()` if user has role, otherwise returns 403 Forbidden.

### `csrfProtection(req, res, next)`
* **Purpose**: Validates request origin on state-changing methods for cookie-authenticated requests.
* **Input**: Express request.
* **Output**: Calls `next()` if valid or returns 403 Forbidden.

---

## 13. Security Threat Model & Mitigations

| Threat | Vulnerability Mechanism | Implemented Mitigation |
| :--- | :--- | :--- |
| **Brute Force & Credential Stuffing** | Rapid automated password guessing | Multi-tier rate limiting on `/signin` (10 per 15m), Argon2id computational work factor. |
| **Password Theft (DB Breach)** | Leaked database dump reveals plaintext passwords | Argon2id hashing with unique per-password salt. Passwords are never stored in plaintext. |
| **Session Hijacking** | XSS scripts reading session token | HttpOnly session cookies cannot be accessed by client-side JavaScript (`document.cookie`). |
| **Session Fixation** | Attacker presets session ID prior to login | A brand new session ID is generated on every signin attempt; previous session IDs are not reused. |
| **Cross-Site Request Forgery (CSRF)** | Third-party site triggers forged state-changing requests | `SameSite=Lax` cookies + `csrfProtection` validating request `Origin` and `Referer` against whitelisted domain. |
| **Account Enumeration** | Different responses for existing vs non-existing emails | `/forgot-password` and `/resend-verification` return identical safe generic messages regardless of email existence. `/signin` executes `dummyVerify()` to equalize response time. |
| **IDOR / BOLA** | Client tampers with `userId` query/body parameters | Authenticated user context (`req.user.id`) is derived strictly from the validated server-side session, never client input. |
| **Token Replay** | Reusing expired or previously consumed tokens | Reset and verification tokens have `usedAt` timestamps and are atomically consumed via DB transactions. |
| **SQL Injection** | Malicious input manipulating SQL queries | Prisma parameterized SQL queries with strict typed schema. |
| **Sensitive Data Leakage** | API responses exposing hashes or internal tokens | Zod schemas, explicit Prisma `.select()` clauses, and response sanitization prevent `passwordHash`, `sessionTokenHash`, and raw tokens from appearing in responses. |

---

## 14. Request / Response Examples

### Signup Example
**Request**:
```http
POST /api/v1/auth/signup HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "email": "candidate@example.com",
  "password": "Password987!#$",
  "name": "Candidate Name",
  "role": "APPLICANT"
}
```
**Response**:
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "message": "Registration successful. A verification email has been sent to your address.",
  "data": {
    "user": {
      "id": "2d65e714-4113-44b4-a4b0-a3e2e88a38c1",
      "email": "candidate@example.com",
      "name": "Candidate Name",
      "role": "APPLICANT",
      "emailVerified": false,
      "createdAt": "2026-09-03T01:38:00.000Z"
    }
  }
}
```

---

## 15. Error Handling Standard

All authentication errors follow uniform JSON error envelopes:

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

Standard status code mappings:
* `400 Bad Request`: Input validation failed, malformed payload, or invalid/expired single-use token.
* `401 Unauthorized`: Missing, expired, or revoked session credentials.
* `403 Forbidden`: Insufficient role permissions or CSRF origin violation.
* `404 Not Found`: Target resource does not exist.
* `409 Conflict`: Registration attempted with an existing email address.
* `429 Too Many Requests`: Rate limit exceeded on endpoint.
* `500 Internal Server Error`: Sanitized unexpected server errors (stack traces suppressed in production).

---

## 16. Environment Variables

| Variable | Required | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | - | PostgreSQL connection URL |
| `NODE_ENV` | Yes | `development` | `development` \| `production` \| `test` |
| `PORT` | No | `3000` | Backend HTTP port |
| `CORS_ORIGIN` | Yes | `http://localhost:3001` | Whitelisted frontend origin |
| `FRONTEND_URL` | Yes | `http://localhost:3001` | Frontend base URL for email verification and reset links |
| `SESSION_COOKIE_NAME` | No | `ai_interview_session` | Name of the session cookie |
| `SESSION_SECRET` | Yes | strong secret | Secret used for cookie signing |
| `SESSION_EXPIRES_DAYS` | No | `7` | Session lifetime in days |
| `COOKIE_SECURE` | No | `false` (dev) / `true` (prod) | Requires HTTPS for cookie |
| `COOKIE_SAME_SITE` | No | `lax` | Cookie SameSite policy (`lax` \| `strict` \| `none`) |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | No | `15` | Window duration for rate limiting |
| `AUTH_RATE_LIMIT_MAX_SIGNIN` | No | `10` | Max signin attempts per window |
| `AUTH_RATE_LIMIT_MAX_SIGNUP` | No | `5` | Max signup attempts per window |
| `AUTH_RATE_LIMIT_MAX_FORGOT_PW` | No | `5` | Max forgot-password requests per window |
| `MAILERO_HOST` | No | `smtp.mailersend.net` | SMTP host for emails |
| `MAILERO_PORT` | No | `587` | SMTP port |
| `MAILERO_USERNAME` | No | - | SMTP username |
| `MAILERO_PASSWORD` | No | - | SMTP password |
| `MAILERO_FROM` | No | `"AI Interview Platform" <careers@example.com>` | Sender email header |

---

## 17. Automated Security Test Coverage

The integration test suite (`backend/src/test/auth.test.ts`) validates 20 security requirements:

1. **Password Validation**: Validates password length and required character sets.
2. **Argon2id Hashing**: Verifies hash structure (`$argon2id$`) and verifies matching/mismatched passwords.
3. **Cryptographic Tokens**: Validates 256-bit entropy and deterministic SHA-256 hashing.
4. **Signup Validation**: Rejects invalid email formats and weak passwords with status 400.
5. **Signup Hash Protection**: Verifies user creation in DB with Argon2id hash while guaranteeing API responses never return `passwordHash`.
6. **Signup Duplicate Prevention**: Rejects duplicate email registration with status 409.
7. **Signin Incorrect Password**: Verifies 401 failure on wrong password.
8. **Signin Non-Existent Account**: Verifies generic 401 without user enumeration.
9. **Signin Cookie Issuance**: Verifies `Set-Cookie` header with `HttpOnly`, `Path=/`, and valid session token.
10. **Protected Route Rejection**: Rejects unauthenticated `/auth/me` with status 401.
11. **Tampered Cookie Rejection**: Rejects forged or invalid cookies with status 401.
12. **Authorized Session Profile**: Allows valid cookie session and returns sanitized user profile.
13. **Bearer Token Support**: Verifies `Authorization: Bearer <token>` works for API clients.
14. **Email Verification Token Validation**: Rejects malformed or invalid verification tokens.
15. **Email Verification Consumption**: Verifies email address, sets `emailVerified: true`, and blocks token reuse.
16. **Resend Verification Non-Enumeration**: Returns safe identical message regardless of user existence.
17. **Forgot Password Non-Enumeration**: Verifies exact matching safe responses for registered and unverified emails.
18. **Password Reset Execution**: Updates password hash with Argon2id, invalidates reset token, and revokes all active user sessions.
19. **Old Password Invalidation**: Confirms signin with old password fails after reset.
20. **Signout Session Revocation**: Confirms session revocation in database and rejection of subsequent requests.

---

## 18. Production Deployment Checklist

```text
[x] PostgreSQL connection verified with connection pooling (Neon/Supabase)
[x] Prisma models (User, Session, EmailVerificationToken, PasswordResetToken) synced
[x] Argon2id password hashing active with 64MB memory / 3 iterations
[x] SHA-256 token hashing active for all database tokens
[x] HttpOnly, SameSite=Lax session cookies active
[x] CORS configured with strict origin matching and credentials enabled
[x] Helmet security headers active (HSTS, nosniff, SameOrigin)
[x] CSRF Origin/Referer defense middleware active
[x] Endpoint-specific rate limiting enabled on all auth routes
[x] Input validation enforced via Zod schemas on all endpoints
[x] Error handler configured to suppress SQL and stack trace leakage
[x] Security audit logger configured with sensitive data redaction
[x] Transactional email templates configured with Ethereal development fallback
[x] 20/20 Automated security integration tests passing
```

---

## 19. Security Assumptions & Trust Boundaries

1. **Transport Layer Security**: HTTPS must be terminated at the edge or reverse proxy (e.g. Cloudflare / Render / AWS ALB). Cookies in production must enforce `COOKIE_SECURE=true`.
2. **Reverse Proxy Configuration**: The application runs with `app.set('trust proxy', 1)` to accurately obtain client IPs for rate limiting from proxy headers (`X-Forwarded-For`).
3. **Database Security**: Direct database connections are restricted via VPC / IP allowlists / SSL require.
4. **Client-Side Secrets**: No signing keys or database credentials are exposed to the client application.
