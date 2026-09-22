# The AI Tutor Screener

> 🔐 **ADMIN PASSWORD: `Admin123`**

---

## 🚀 Full-Stack Setup Guide

This project is a monorepo with two workspaces:

```
AI-Interview/
├── backend/    # Node.js + Express + Prisma + Custom Native Auth API
└── frontend/   # Next.js 16 App Router + Zustand Auth State
```

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v18+ | [Download](https://nodejs.org) |
| npm | v9+ | Bundled with Node.js |
| PostgreSQL | any | [Neon (free cloud)](https://neon.tech) · [Supabase](https://supabase.com) · local |

---

### Step 1 — Clone the repository

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
```

> **Get your keys & resources:**
> - **PostgreSQL** → [neon.tech](https://neon.tech) (free, no credit card)
> - **OpenAI** → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
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
| Health check | http://localhost:3000/health |

> **Admin panel** → Sign in and navigate to `/admin` · Password: `Admin123`

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
- **Role-Based Access Control**: Strict multi-role permission tiers (`APPLICANT`, `RECRUITER`, `ADMIN`).

### 📧 Automated Transactional Email Notifications
Once a candidate is invited or completes their interview, transactional emails are automatically dispatched with unique interview tokens, status updates, or evaluation summaries.

### 🔁 Cold Start Prevention — Keep-Alive Polling
A background polling mechanism keeps cloud-hosted backend instances warm, ensuring candidates never experience cold-start latency when initiating an interview.

### 🤖 YOLO26 Real-Time Vision & Proctoring Engine
A computer vision pipeline running proctoring analysis during the interview:
- **Face Presence Verification**: Temporal state machine ensuring candidate remains present.
- **Unauthorized Device Detection**: Continuous monitoring for unauthorized phones or secondary screens.

---

## What I Built and Which Problem I Picked

**The Problem:** The company hires hundreds of tutors every month. To ensure high-quality education, every candidate must be screened for crucial soft skills: communication clarity, patience, warmth, the ability to simplify complex topics, and English fluency. Human-led screening is expensive, inherently subjective, slow to execute, and difficult to scale.

**What I Built:** A fully functional, interactive **AI Tutor Screener**. This platform conducts dynamic, browser-based voice conversations with tutor candidates to assess whether they possess the right pedagogical temperament to move to the next round.

The AI acts as a curious, sometimes frustrated, or confused 9-year-old student, asking questions like *"Explain fractions to me"* or indicating *"I don't understand."* It listens to the candidate's spoken response, adapts dynamically, and evaluates their soft skills with dimension-by-dimension scores and direct candidate quotes.

---

### Navigation
- [Backend Architecture & Setup](./backend/README.md)
- [Frontend Architecture & Setup](./frontend/README.md)
- [Authentication Specification](./Signup/Signin.md)