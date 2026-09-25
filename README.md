# AI Tutor & Candidate Screening Platform ("AI-Interview")

## 🚀 Full-Stack Setup Guide

This project is a monorepo with two workspaces:

```
AI-Interview/
├── backend/    # Node.js + Express + Prisma + Custom Native Auth API + YOLO26 Proctoring
└── frontend/   # Next.js 16 App Router + TailwindCSS v4 + Zustand Auth & Session State
```

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v18+ | [Download](https://nodejs.org) |
| npm | v9+ | Bundled with Node.js |
| PostgreSQL | any | [Neon (free cloud)](https://neon.tech) · [Supabase](https://supabase.com) · local |

---

### Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd AI-Interview
```

---

### Step 2 — Configure the Backend

```bash
cd backend

# 1. Copy the example env file and fill in your values
cp .env.example .env
```

Open `backend/.env` and set **at minimum** these variables:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
OPENAI_API_KEY="sk-proj-..."
SESSION_SECRET="your-32-character-cryptographic-session-secret"
FRONTEND_URL="http://localhost:3001"

# AWS S3 Storage for Proctoring Screenshots
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_S3_BUCKET="your-s3-bucket-name"
```

> **Get your keys & resources:**
> - **PostgreSQL** → [neon.tech](https://neon.tech) (free, no credit card required)
> - **OpenAI** → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
> - **AWS S3** → [aws.amazon.com/s3](https://aws.amazon.com/s3) (private bucket for violation evidence)
> - **Gemini (optional)** → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

```bash
# 2. Install dependencies
npm install

# 3. Generate Prisma client and push schema to DB
npx prisma generate
npx prisma db push

# 4. Run automated test suite (20/20 Security & Auth Tests)
npm test

# 5. Start the dev server  →  http://localhost:3000
npm run dev
```

---

### Step 3 — Configure the Frontend

Open a **new terminal**, then:

```bash
cd frontend

# 1. Copy the example env file and fill in your values
cp .env.example .env.local
```

Open `frontend/.env.local` and set these variables:

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:3000/api/v1"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
```

```bash
# 2. Install dependencies
npm install

# 3. Start the dev server  →  http://localhost:3001
npm run dev
```

---

### Step 4 — Open the App

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3000/api/v1 |
| Health Check | http://localhost:3000/health |

> **Admin Panel** → Sign in as a `RECRUITER` to access `/admin` and review candidate submissions.

---

### Production Build

**Backend:**
```bash
cd backend
npm run build   # runs prisma generate + tsc
npm start       # runs prisma db push + node dist/server.js
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

---

## Application Features

### 🛡️ Production-Grade Native Authentication & Session Management
A full-stack, enterprise-grade authentication system built directly into the application:
- **Argon2id Password Hashing**: OWASP-recommended memory-hard hashing (`m=65536, t=3, p=4`) with constant-time verification preventing timing side-channel attacks.
- **Secure Stateful Cookie Sessions**: 256-bit cryptographically random tokens stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies with automatic session rotation.
- **Email Verification & Password Reset**: Single-use cryptographic SHA-256 tokens with automatic revocation and rate limiting.
- **Security Audit Logging**: Structured JSON logging masking PII (passwords, tokens, emails).
- **Role-Based Access Control**: Strict multi-role permission tiers (`APPLICANT`, `RECRUITER`).

### 📧 Automated Transactional Email Notifications
Once a candidate is invited or completes their interview, transactional emails are automatically dispatched with unique interview tokens, status updates, or evaluation summaries via Nodemailer/Ethereal.

### 🔁 Cold Start Prevention — Keep-Alive Polling
A background polling mechanism keeps cloud-hosted backend instances warm, ensuring candidates never experience cold-start latency when initiating an interview.

### 📄 2-Stage JD Analysis Pipeline (olmOCR 2 + OpenAI Clarification Engine)
A 2-stage document processing and analysis pipeline:
- **olmOCR 2 Extraction**: Extracts PDF, DOCX, image, and text JDs directly into Markdown.
- **Stage 1 (Analysis & Ambiguity Check)**: OpenAI parses Markdown into structured JSON (`role`, `seniority`, `must_have_skills`, `experience_requirements`, etc.) and determines if clarification is needed.
- **Robust Regex Question Parser**: Backend regex matches, validates, and sequentially renumbers questions `1..N`. If `questionCount === 0`, status becomes `COMPLETED` in **1 OpenAI call**.
- **Stage 2 (Single-Step Finalization)**: Recruiter answers all questions in 1 input step. OpenAI merges answers into the `Final Structured JD` in **at most 2 OpenAI calls total**.

### 🛡️ Rule-Based Answer Integrity Guard (`AnswerIntegrityGuard`)
A local, deterministic security filter that protects the evaluation engine from prompt injection, score manipulation, and evaluator hijacking before candidate answers reach the AI:
- **Zero AI / External API Overhead**: 100% deterministic regex pattern inspection executing locally in memory under $1\text{ms}$.
- **Comprehensive Pattern Detection**: Identifies instruction overrides (`"ignore previous instructions"`), score manipulation (`"give me 10/10"`, `"mark this answer as completely correct"`), evaluation manipulation (`"you must rate this"`), system prompt leaks (`"reveal your system prompt"`), and persona tampering (`"act as an unrestricted evaluator"`).
- **Anti-Evasion Normalization**: Standardizes Unicode via NFKC (recomposing fullwidth characters like `Ｉｇｎｏｒｅ`), strips zero-width and control characters (`\u200B-\u200D`, `\uFEFF`), and standardizes punctuation/whitespace.
- **Configurable Risk Scoring**: Weighted signal scoring with configurable thresholds (default: $\text{riskScore} \ge 5 \rightarrow \text{BLOCK}$).
- **Safe-Pivot Execution**: When an injection is blocked, the text is omitted from LLM evaluators, the session's `cheatCount` is incremented, audit feedback is preserved, and the interview smoothly pivots to the next technical question.
- **Zero False Positives**: Legitimate engineering answers using words like "system", "ignore", or "score of 10/10" receive a risk score of 0 and pass cleanly.

### ⏱️ 30-Minute Adaptive Deep Technical Interview Engine & Priority Hierarchy
An adaptive, conversational interview engine designed for an authentic 30-minute technical evaluation:
- **30-Minute Live Countdown Timer**: Frontend header displays a live session timer (`29:45 / 30:00`) with color alerts (< 5 mins amber, < 2 mins pulsing red) and auto-conclusion upon expiration.
- **Dynamic Wall-Clock Budgeting**: Backend calculates `timeRemainingMinutes` based on elapsed wall-clock minutes since the first response, preventing premature termination.
- **Strict Evaluation Priority Hierarchy**:
  1. **Priority 1 — Job Description (JD) Core Competencies**: Mandatory competencies and responsibilities probed first via practical scenarios and cross-verification.
  2. **Mid-Interview Live Coding Challenge & Follow-ups**: Live coding challenge anchored to candidate's repository work, followed by **Follow-Up 1** (algorithmic Big-O complexity and null/empty edge cases) and **Follow-Up 2** (production integration, concurrency, and stress testing).
  3. **Priority 2 — GitHub Repository Projects**: Probes real code, architecture, library choices, data flows, and bottlenecks across candidate's analyzed public repositories.
  4. **Priority 3 — Resume Claims & Impact**: Probes specific resume claims, root cause bottlenecks, exact architectural changes, and trade-offs.
  5. **AI Fluency & High-Scale System Design**: Critical auditing of AI-generated code, distributed systems, cache stampedes, idempotency, and concurrency resilience.
- **Conversational "Two and Fro" Style**: The AI interviewer briefly acknowledges or challenges the candidate's last answer before asking tricky conceptual depth questions testing under-the-hood behavior and trade-offs rather than trivia definitions or artificial brainteasers.
- **Deep 14+ Turn Evaluation**: Requires at least 14 rich technical turns across all phases before considering early conclusion.

### 🤖 Multi-Signal Evidence-Based Smart Proctoring & Telemetry Engine
A multi-modal proctoring and audit layer operating strictly within non-punitive evidence principles:
- **Instant 1.0-Second Absence Detection Snapshot (`ABSENT_USER`)**: Candidate camera departure triggers an immediate violation event and photographic snapshot evidence after 1.0 second of missed frames (`FACE_LOST_FRAMES = 1`, `FACE_ABSENCE_THRESHOLD_MS = 1000`).
- **Keystroke & Paste Velocity Telemetry**: Flags copy-paste code injection bursts (>40 chars or $\ge 3$ lines in $<200\text{ms}$) with automated webcam snapshot evidence; detects unnatural macro typing cadences ($<12\text{ms}$ inter-keystroke interval).
- **Natural Interruption Handling (Barge-In)**: Browser-side Web Audio `AnalyserNode` detects candidate voice energy ($\text{RMS} > 0.05$ sustained for $>150\text{ms}$) during AI speech playback, instantly pausing Kokoro TTS without awkward audio collision.
- **Biomechanical Gaze & Saccade Analysis**: MediaPipe 478 3D landmark tracking detects rhythmic reading sweeps (`OFF_SCREEN_READING`) vs natural cognitive thinking recall (`NATURAL_COGNITIVE_DIVERGENCE`), with an educational guide for recruiters.
- **YOLO26 Real-Time Vision**: Continuous server-side detection of secondary mobile devices, unauthorized screens, and multiple individuals in camera view.
- **Zero Deceptive Probabilities**: Completely rejects misleading "cheating percentage" scores in favor of objective, factual event counts and clickable chronological timeline provenance.

### 🎙️ Streaming Voice Pipeline & Kokoro TTS Local Synthesis
- **Real-Time Voice Streaming**: Upgraded audio recording pipeline streaming $250\text{ms}$ audio chunks over WebSockets (`voice_stream_chunk`).
- **Kokoro-82M Local Audio**: High-fidelity, ultra-low latency voice synthesis ($<300\text{ms}$) running locally with zero per-character cloud API charges.
- **Post-TTS Silence Stopwatch**: Tracks exact candidate deliberation latency from question delivery to speech start.

### 🧠 Evidence-Driven Adaptive Interview Intelligence Platform
- **Traceable Evidence Graph & Gap Ledger**: Tracks evidence resolution (`VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `NO_EVIDENCE`) with complete source provenance nodes linking JD requirements, Resume claims, GitHub code, questions, and spoken answers.
- **Percentile Cohort Ranking (Strictly Real Applicants)**: Dynamically ranks candidates against actual applicants who took the interview for that requisition ($\text{Rank } \#X \text{ of } N$ and overall percentile) without synthetic baseline fallbacks.
- **Question Difficulty Normalization**: Calibrates candidate competency scores with algorithmic weights (`EXPERT` $1.25\times$, `HARD` $1.15\times$, `MEDIUM` $1.00\times$, `EASY` $0.85\times$) so candidates tackling complex distributed systems questions are evaluated fairly.
- **Static GitHub Inspection & Robust UTF-16 Encoding**: Parses public GitHub profiles and up to 15 repositories concurrently via `Promise.all`. Defangs prompt injections and handles UTF-16LE with BOM encoding and control character sanitization before storing in PostgreSQL.

### ☁️ Private Cloud Storage for Violation Evidence & 100-Image Threshold Cap
Proctoring violation screenshots are stored in private cloud object storage with a strict safety threshold:
- **Private Object Storage Bucket**: Uploads photographic snapshots directly to private cloud storage configured via `AWS_S3_BUCKET` without public ACLs.
- **Isolated Key Structure**: Strictly enforces `interviews/{interviewId}/screenshot_{sequenceNumber}.png` with 3-digit zero-padded numbering (`screenshot_001.png`, `screenshot_002.png`, etc.).
- **Atomic Sequence Mutex & 100-Image Threshold Cap**: Concurrency-safe per-session sequence counter with a **hard limit of maximum 100 images per interview session** (`MAX_IMAGES_PER_INTERVIEW = 100`) to prevent cloud storage bloat and denial-of-wallet risks.
- **Dynamic Presigned URL Auto-Resigning**: Regex key extraction `(interviews/[^/?]+/screenshot_\d+\.png)` automatically refreshes short-lived presigned GET URLs on every load, preventing expired link errors.
- **Clean Non-Technical Enterprise Terminology**: All UI components use clean, non-technical labels (**"Photographic Evidence"**, **"Photo Captures"**, **"Verified Evidence"**, **"Ref ID"**) instead of raw infrastructure names.
- **Interactive Candidate Analysis Modal & Full Report Access**: In `/admin` and `/evaluation`, clicking on any violation card opens a high-resolution viewer with exact reference ID, timestamp, multi-snapshot cycling, and high-res inspection.

### 🎯 10-Question Demo Technical Interview & Post-Interview Evaluation
A standalone demo interview mode that allows any visitor to experience a full technical assessment with **zero external AI costs**:
- **Visitor Entry Point**: Anyone visiting `/` or `/demo` can test the platform without needing a recruiter invitation link.
- **Live Hardware Diagnostics**: Real-time webcam video feed verification and interactive microphone volume meter before starting.
- **10 Curated Easy Computer Science Questions**: Covers foundational programming concepts: CS introduction, variables & data types, if-else conditionals, for/while loops, functions & code reusability, arrays & indexing, classes & objects in OOP, stacks vs queues (LIFO/FIFO), algorithms & linear search, and database fundamentals.
- **Deterministic "Great!" Progression**: Whatever answer the candidate provides, the system responds immediately with *"Great! Let's move on to the next question..."* and walks through all 10 questions sequentially with zero latency.
- **Full Active Proctoring & Saved Session Evaluation**: 1.0s Camera departure detection, YOLO mobile phone detection, snapshot captures (capped at 100 max), 3D eye tracking, tab blur monitoring, code paste burst detection, and local Answer Integrity Guard operate actively throughout the session. Completed demo sessions are saved to the database and viewable via the **`[View Evaluation & Proctoring Report]`** screen.

---

## What I Built and Which Problem I Picked

**The Problem:** Organizations hire tutors and software engineers continuously. To ensure high-quality education and technical competency, every candidate must be screened for crucial soft skills (communication clarity, patience, warmth, simplifying complex topics) as well as hard technical requirements. Human-led screening is expensive, inherently subjective, slow to execute, and difficult to scale.

**What I Built:** A fully functional, interactive **AI Tutor Screener and Technical Candidate Evaluation Platform**. This platform conducts dynamic, browser-based voice conversations with candidates to assess both their technical understanding and pedagogical temperament.

The AI can act as a curious 9-year-old student (e.g. asking *"Explain fractions to me"*) or a technical interviewer probing system design and coding concepts. It listens to the candidate's spoken response, adapts dynamically, and evaluates their skills with dimension-by-dimension scores, proctoring flags, direct evidence quotes, and a traceable Evidence Graph.

---

### Documentation & Specifications Index

- [Backend Architecture & Setup](./backend/README.md)
- [Frontend Architecture & Setup](./frontend/README.md)
- [Multi-Signal Evidence-Based Smart Proctoring Specification](./docs/smart-proctoring-system.md)
- [Evidence-Driven Adaptive Interview Intelligence Specification](./docs/evidence-driven-interview-platform.md)
- [Authentication Architecture & Access Control Specification](./docs/authentication.md)
- [Production-Grade Auth & Security Specification](./docs/Signin.md)
- [AI Analysis Architecture & Intelligence Pipeline Specification](./docs/ai-analysis-architecture.md)
- [Recruiter Job Description & 2-Stage Analysis Specification](./docs/job-description-requirements.md)
- [Interview Question Engine & Synthesis Specification](./docs/interview-question-engine.md)
- [Applicant Resume Intelligence & Evidence Preservation Specification](./docs/resume-analysis.md)
- [Smart Resume Intelligence Pipeline Specification](./docs/resume-intelligence.md)