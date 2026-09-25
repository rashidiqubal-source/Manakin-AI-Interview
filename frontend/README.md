# AI Interviewer Frontend

## Overview
The frontend for the **AI Interview Platform** provides a dynamic, responsive, and secure interface for candidates to undergo automated evaluations, and for recruiters/administrators to manage pipelines and review candidate performance.

## Architecture
Built on modern React paradigms, the frontend utilizes **Next.js 16 (App Router)**.
- **UI & Styling**: Crafted with **TailwindCSS v4**, **Shadcn UI**, and **Base UI** components to ensure a high-quality, accessible, and polished user experience. **Framer Motion** drives micro-interactions and smooth page transitions.
- **State Management**: Managed globally via **Zustand** (`useAuthStore`, `useInterviewStore`), orchestrating authentication, interview sessions, proctoring flags, and chat history.
- **Authentication**: Native custom authentication system with secure `HttpOnly` session cookies, support for multiple roles (`APPLICANT`, `RECRUITER`), email verification, and password recovery.
- **30-Minute Live Session Countdown Timer**: Top room header displays an active countdown timer (`29:45 / 30:00`) that starts when candidate enters the interview. Features adaptive color coding (< 5 mins amber, < 2 mins pulsing red) and automatically concludes the session gracefully when time runs out.
- **Deep Cutoff Gate Protection**: Ensures candidates undergo at least 10–14 rich technical turns before cutoff is allowed.
- **Real-time Proctoring & 1.0s Absence Snapshot**: Streams webcam frames to the backend via **Socket.IO** at 10 FPS for server-side ML inference (Face & Device Detection). Triggers immediate photographic violation snapshots if the candidate departs the camera frame for 1.0 second (`ABSENT_USER`).
- **AWS S3 Violation Evidence Viewer**: In Candidate Analysis (`/admin`), clicking any proctoring violation tag opens a high-resolution modal displaying photographic evidence fetched via secure AWS S3 presigned URLs, exact S3 key, and multi-snapshot cycling.
- **10-Question Demo Interview Mode (`/demo`)**: Standalone interview experience with live hardware diagnostics (camera video feed and microphone level meter) running through 10 curated software engineering questions with zero OpenAI calls.

## Project Structure
```text
frontend/
├── src/
│   ├── app/                  # Next.js App Router pages and layouts
│   │   ├── applicant/        # Applicant sign-in, sign-up, and dashboard
│   │   ├── recruiter/        # Recruiter sign-in, sign-up, dashboard, and 2-stage JD document upload
│   │   ├── demo/             # 10-Question Demo Interview with live hardware check
│   │   ├── verify-email/     # Interactive email token verification
│   │   ├── forgot-password/  # Password reset request flow
│   │   ├── reset-password/   # New password submission
│   │   ├── invite/[token]/   # Token-based candidate invitation landing with optional GitHub URL submission
│   │   ├── interview/        # Candidate voice AI interview platform
│   │   ├── dashboard/        # Candidate evaluation history
│   │   ├── evaluation/       # Recruiter Evidence Intelligence View (Evidence Graph, Gap Ledger, GitHub Card, Claims, Contradictions)
│   │   └── admin/            # Admin dashboard for reviewing platform metrics & AWS S3 violation evidence
│   ├── components/           # Reusable UI components (UserMenu, Shadcn UI, Base UI)
│   ├── hooks/                # Custom React hooks (useAudioRecorder, etc.)
│   ├── lib/                  # Zustand stores (authStore, store), utilities, face detector
│   └── services/             # Backend API client with axios credentials
├── public/                   # Static assets
├── middleware.ts              # Session cookie auth route protection middleware
├── .env.example               # Reference env file — copy to .env.local
└── package.json
```

## Setup & Running Locally

### 1. Prerequisites
- **Node.js** v18+
- The **backend** server running at `http://localhost:3000`

### 2. Environment Variables
Copy the example file and fill in your values:
```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend REST API base URL (e.g. `http://localhost:3000/api/v1`) |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | Backend Socket.IO root URL (e.g. `http://localhost:3000`) |

### 3. Installation
```bash
cd frontend
npm install
```

### 4. Running the Application
Start the development server:
```bash
npm run dev
```
The frontend will be accessible at `http://localhost:3001`.

### 5. Production Build
```bash
npm run build
npm start
```
