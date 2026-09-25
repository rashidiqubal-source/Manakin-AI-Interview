# AI Interviewer Backend

## Overview
The backend for the **AI Interview Platform** powers the core logic of the application: production-grade authentication, session management, recruiter JD analysis (including 2-Stage olmOCR 2 + OpenAI processing), candidate resume parsing, AI-driven voice interview evaluations (via OpenAI/Gemini), real-time vision proctoring (YOLO26), and transactional email notifications.

## Architecture
The backend is built with a robust, scalable architecture using **Node.js, Express, TypeScript, and Prisma ORM**.
- **Database Layer**: Uses **PostgreSQL** (Neon) paired with **Prisma ORM** for type-safe database access and schema migrations. The database tracks `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `JobDescription`, `ApplicantResume`, `InterviewInvitation`, `InterviewSession`, `Message`, and `DetectionEvent` entities.
- **Authentication & Security System**:
  - **Argon2id Hashing**: OWASP memory-hard password hashing (`m=65536, t=3, p=4`) with constant-time verification.
  - **Session Management**: Cryptographically secure 256-bit CSPRNG tokens stored in database with `HttpOnly`, `SameSite=Lax` cookies, sliding expiration, and single/all revocation.
  - **Email Verification & Password Reset**: Single-use cryptographic tokens with rate limiting and automated session invalidation on reset.
  - **CSRF & Rate Limiting**: Dedicated rate limiting per endpoint, strict Origin/Referer CSRF protection on mutation routes.
  - **Security Audit Logger**: Structured JSON audit logging masking sensitive fields.
- **Rule-Based Answer Integrity Guard (`AnswerIntegrityGuard`)**:
  - **Zero LLM / Zero External API**: 100% deterministic regex pattern inspection executing locally in memory under $1\text{ms}$ before any text reaches the AI evaluator.
  - **Anti-Evasion Normalization**: Standardizes Unicode via NFKC (recomposing fullwidth characters like `Ｉｇｎｏｒｅ`), strips zero-width and invisible control codes (`\u200B-\u200D`, `\uFEFF`), and standardizes punctuation/whitespace.
  - **Weighted Signals**: `INSTRUCTION_OVERRIDE` (+4), `SCORE_MANIPULATION` (+4), `EVALUATION_MANIPULATION` (+3), `SYSTEM_PROMPT_MANIPULATION` (+3), `ROLE_PERSONA_MANIPULATION` (+3), Multiple patterns bonus (+1). Default threshold $\ge 5 \rightarrow \text{BLOCK}$.
  - **Safe-Pivot Architecture**: Bypasses the OpenAI evaluator and chat completion on block, logs audit feedback, increments `cheatCount`, and moves directly to the next technical question.
  - **Zero False Positives**: Legitimate technical answers mentioning "system", "ignore", or "score of 10/10" pass with risk score 0.
- **Evidence-Driven Interview Intelligence & 30-Minute Adaptive Engine**:
  - **30-Minute Session Budget**: Computes remaining time based on actual wall-clock elapsed minutes from the candidate's first response (`timeRemainingMinutes = Math.max(1, 30 - elapsedMinutes)`).
  - **Strict Priority Hierarchy**:
    1. **Priority 1 — Job Description (JD) Core Competencies**: Mandatory competencies probed first via scenario problems and cross-verification.
    2. **Mid-Interview Live Coding Challenge & Follow-ups**: Live coding challenge anchored to candidate's repo, followed by **Follow-Up 1** (algorithmic Big-O complexity & edge cases) and **Follow-Up 2** (production integration & load testing).
    3. **Priority 2 — GitHub Repository Projects**: Real code architecture, library choices, data flows, and bottlenecks across candidate's analyzed public repositories.
    4. **Priority 3 — Resume Claims & Impact**: Probes specific resume claims, root cause bottlenecks, exact architectural changes, and trade-offs.
    5. **AI Fluency & High-Scale System Design**: Critical auditing of AI-generated code, distributed systems, cache stampedes, idempotency, and concurrency resilience.
  - **Conversational "Two and Fro" Style**: Injects directives instructing the AI interviewer to briefly acknowledge or challenge the candidate's last answer before asking tricky conceptual depth questions testing under-the-hood behavior and trade-offs.
  - **Deterministic Priority Engine**: Enforces strict hiring priority: `MANDATORY JD requirement → Live Coding + 2 Follow-ups → GitHub projects → Resume claims → AI Fluency → System Design → FINISH`.
  - **Adaptive Deep Verification**: Dynamically generates follow-up probes when evidence is ambiguous, requiring at least 14 rich technical turns before early conclusion is considered.
  - **Question Guardrail Layer**: Validates every interview question deterministically (coverage, purpose, anti-duplication, seniority level, and 30-minute time budget).
  - **15-Repository Canonical GitHub Architecture Analyzer & PostgreSQL UTF-16 Sanitization**:
    - Statically audits up to 15 latest public GitHub repositories concurrently via `Promise.all` before the interview begins.
    - Decodes UTF-16LE/BE with BOM and strips null bytes / non-printable control characters via `sanitizeForPostgres()` to prevent PostgreSQL `22P05` encoding errors.
    - Inspects project manifests (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `prisma/schema.prisma`), `Dockerfile`, `docker-compose.yml`, and test suites. Zero script or binary execution. Defangs prompt-injection attempts.
    - Synthesizes an authoritative **Canonical GitHub Summary**: Candidate primary archetype, executive code architecture summary, 3–5 flagship projects with end-to-end architecture pipelines (e.g. `Next.js 14 -> Fastify API -> Redis Cache -> PostgreSQL via Prisma -> Docker`), verified code technologies with repo citations, and code maturity levels (`PRODUCTION_GRADE`, `SOLID_INDIVIDUAL_PROJECT`, `PROTOTYPE`).
  - **Ground-Truth Question Probing (What Candidate Actually Built)**:
    - Triangulates the 3-Pillar Candidate Profile: **JD** (what is required), **Resume** (what candidate claims), and **GitHub** (ground truth of what they actually built).
    - AI Interviewer generates and asks technical questions anchored directly onto the candidate's real GitHub projects and architecture choices (e.g. concurrency, caching invalidation, schema models, network partitions).
- **Audio & Speech Engine (Kokoro TTS)**:
  - Synthesizes interview questions aloud with human-like prosody via Kokoro TTS (`POST /api/v1/interview/tts`) with automatic fallback to OpenAI TTS (`tts-1`) and Web Speech API.
  - **Post-TTS Silence Latency Stopwatch**: Measures exact candidate thinking time in seconds elapsed between when Kokoro TTS finishes speaking and when the candidate begins their answer.
- **MediaPipe Face Landmarker 3D Eye Tracking**:
  - Operates client-side via `@mediapipe/tasks-vision` (WebAssembly & WebGL GPU delegate) tracking 478 3D landmarks + iris positions.
  - Computes **Gaze Timeline**, **2D Scanpath coordinates**, **Away-from-screen duration & episodes**, and **Fixations** (clusters $\ge 150\text{ms}$).
- **Proctoring Engine**: Powered by **Ultralytics YOLO26** (`yolo26n.pt` and `yolo26_widerdataset.pt` face model). Processes Base64-encoded webcam frames sent from the frontend over WebSocket/REST to detect misconduct (multiple faces, missing faces, or unauthorized cell phones/devices) in real-time with sub-35ms latency.
- **AI Integration**: Connects with **OpenAI API** to drive conversational voice flow, evaluate candidate responses across technical metrics (technical accuracy, depth, problem solving, system architecture, code quality), and generate detailed scorecards.
- **Private AWS S3 Storage for Proctoring Screenshots (`S3Service`)**:
  - Direct integration with AWS S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) targeting private bucket configured via `AWS_S3_BUCKET`.
  - Formats keys strictly as `interviews/{interviewId}/screenshot_{sequenceNumber}.png` with 3-digit zero-padding (`screenshot_001.png`, `screenshot_002.png`).
  - Implements concurrency-safe per-session atomic sequence counter to prevent key collisions across parallel violation events.
  - Generates short-lived presigned GET URLs (15-minute expiration) with recruiter/admin authorization validation (`isUserAuthorizedForInterview`).
- **10-Question Demo Technical Interview Engine (Zero OpenAI Calls)**:
  - Supports self-contained demo interview sessions initialized via `POST /api/v1/interview/start` with `{ isDemo: true }`.
  - Operates sequentially through 10 static foundational Computer Science questions with **zero OpenAI / LLM calls**, responding with *"Great! Let's move on to the next question..."*.
  - Full proctoring active: MediaPipe face departures, YOLO phone detection, AWS S3 screenshot capture, and local `AnswerIntegrityGuard` inspection.
  - Automatically completes upon answering Question 10 with deterministic evaluation scoring.
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
│   ├── ai/               # Modular AI engine (jd, resume, interview, evaluation, evidence, core)
│   │   └── evidence/     # Evidence Graph, Gap Ledger, Static GitHub Inspector, Claims, Contradictions
│   ├── config/           # Environment variables, security logger, Prisma client
│   ├── controllers/      # Route handlers implementing business logic (AuthController, RecruiterController, etc.)
│   ├── middlewares/      # requireAuth, requireRole, rateLimiter, csrf, errorHandler
│   ├── ml/               # YOLO26 inference service & ML routes
│   ├── routes/           # Express API route definitions (/v1/auth, /v1/recruiter, /v1/applicant, etc.)
│   ├── services/         # AuthService, SessionService, EmailService, InterviewService, JDAnalysisService, ResumeAnalysisService, InvitationService
│   ├── sockets/          # Socket.IO real-time proctoring handlers
│   ├── test/             # Automated integration tests (20/20 test suite)
│   ├── utils/            # Argon2id password utils, token utils, AppError
│   ├── validations/      # Zod validation schemas for requests
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
| `CORS_ORIGIN` | ⬜ | Whitelisted CORS origin (default: `http://localhost:3001`) |
| `GEMINI_API_KEY` | ⬜ | When set, Gemini is used for extended LLM capabilities |
| `PORT` | ⬜ | Server port (default: `3000`) |
| `NODE_ENV` | ⬜ | `development` / `production` / `test` |
| `SMTP_HOST` | ⬜ | SMTP host (e.g. `smtp.ethereal.email` or MailerSend) |
| `SMTP_PORT` | ⬜ | SMTP port (default: `587`) |
| `SMTP_USER` | ⬜ | SMTP username |
| `SMTP_PASS` | ⬜ | SMTP password |
| `SMTP_FROM` | ⬜ | Sender name and address |
| `AWS_REGION` | ⬜ | AWS region for S3 screenshots (default: `ap-south-1`) |
| `AWS_ACCESS_KEY_ID` | ⬜ | AWS access key for private S3 screenshot bucket |
| `AWS_SECRET_ACCESS_KEY` | ⬜ | AWS secret access key for private S3 screenshot bucket |
| `AWS_S3_BUCKET` | ⬜ | Target private S3 bucket (default: `aiinterview-324037300977-ap-south-1-an`) |

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
