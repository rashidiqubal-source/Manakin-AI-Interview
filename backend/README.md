# AI Interviewer Backend

## Overview
The backend for the **AI Interview Platform** powers the core logic of the application: production-grade authentication, session management, recruiter JD analysis, candidate resume parsing, AI-driven voice interview evaluations (via OpenAI/Gemini), real-time proctoring (YOLO26), and transactional email notifications.

## Architecture
The backend is built with a robust, scalable architecture using **Node.js, Express, TypeScript, and Prisma ORM**.
- **Database Layer**: Uses **PostgreSQL** (Neon) paired with **Prisma ORM** for type-safe database access and schema migrations. The database tracks `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `JobDescription`, `ApplicantResume`, `InterviewInvitation`, `InterviewSession`, and `Message` entities.
- **Authentication & Security System**:
  - **Argon2id Hashing**: OWASP memory-hard password hashing (`m=65536, t=3, p=4`) with constant-time verification.
  - **Session Management**: Cryptographically secure 256-bit CSPRNG tokens stored in database with `HttpOnly`, `SameSite=Lax` cookies, sliding expiration, and single/all revocation.
  - **Email Verification & Password Reset**: Single-use cryptographic tokens with rate limiting and automated session invalidation on reset.
  - **CSRF & Rate Limiting**: Dedicated rate limiting per endpoint, strict Origin/Referer CSRF protection on mutation routes.
  - **Security Audit Logger**: Structured JSON audit logging masking sensitive fields.
- **Proctoring Engine**: Powered by **Ultralytics YOLO26** (`yolo26n.pt` and `yolo26_widerdataset.pt` face model). Processes Base64-encoded webcam frames sent from the frontend over WebSocket/REST to detect misconduct (multiple faces, missing faces, or unauthorized cell phones/devices) in real-time with sub-35ms latency.
- **AI Integration**: Connects with **OpenAI API** to drive the conversational flow, evaluate responses, and generate detailed scorecards.
- **Notification System**: Utilizes **Nodemailer** with Ethereal fallback in development to automatically dispatch verification, password reset, and invitation emails.

## Project Structure
```text
backend/
├── ml_service/           # YOLO26 FastAPI microservice & model loaders
│   ├── server.py
│   └── requirements.txt
├── prisma/               # Database schema and migrations
│   └── schema.prisma
├── src/
│   ├── config/           # Environment variables, security logger, Prisma client
│   ├── controllers/      # Route handlers implementing business logic (AuthController, etc.)
│   ├── middlewares/      # requireAuth, requireRole, rateLimiter, csrf, errorHandler
│   ├── ml/               # YOLO26 inference service & ML routes
│   ├── routes/           # Express API route definitions (/auth, /recruiter, /applicant, etc.)
│   ├── services/         # AuthService, SessionService, EmailService, InterviewService, JDAnalysisService
│   ├── sockets/          # Socket.IO real-time proctoring handlers
│   ├── test/             # Automated integration tests (20/20 test suite)
│   ├── utils/            # Argon2id password utils, token utils, AppError
│   ├── validations/      # Zod v4 validation schemas for requests
│   ├── app.ts            # Express application setup
│   └── server.ts         # Server entry point
├── .env.example          # Reference env file — copy to .env
├── package.json
└── tsconfig.json
```

## Setup & Running Locally

### 1. Prerequisites
- **Node.js** v18+
- **PostgreSQL** database — [Neon](https://neon.tech) (free cloud) or local

### 2. Environment Variables
Copy the example file and fill in your values:
```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | Used for Whisper STT (`whisper-1`) and chat/eval (`gpt-4o-mini`) |
| `SESSION_SECRET` | ✅ | Cryptographic secret for session cookie signing (min 32 chars) |
| `FRONTEND_URL` | ✅ | Frontend base URL for CORS and links (default: `http://localhost:3001`) |
| `GEMINI_API_KEY` | ⬜ | When set, Gemini is the primary LLM; OpenAI becomes fallback |
| `PORT` | ⬜ | Server port (default: `3000`) |
| `NODE_ENV` | ⬜ | `development` / `production` / `test` |
| `SMTP_HOST` | ⬜ | SMTP host (e.g. `smtp.ethereal.email` or MailerSend) |
| `SMTP_USER` | ⬜ | SMTP username |
| `SMTP_PASS` | ⬜ | SMTP password |

### 3. Installation
```bash
cd backend
npm install
```

### 4. Database Initialization
Generate the Prisma client and push the schema to your database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Running Automated Tests
Run the complete security and authentication integration test suite:
```bash
npm test
```

### 6. Running the Application
Start the development server:
```bash
npm run dev
```
The server will be running on `http://localhost:3000`.

### 7. Production Build
```bash
npm run build
npm start
```
