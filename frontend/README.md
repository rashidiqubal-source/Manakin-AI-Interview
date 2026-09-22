# AI Interviewer Frontend

## Overview
The frontend for the **AI Interview Platform** provides a dynamic, responsive, and secure interface for candidates to undergo automated evaluations, and for recruiters/administrators to manage pipelines and review candidate performance.

## Architecture
Built on modern React paradigms, the frontend utilizes **Next.js 16 (App Router)**.
- **UI & Styling**: Crafted with **TailwindCSS v4**, **Shadcn UI**, and **@base-ui/react** to ensure a high-quality, accessible, and polished user experience. **Framer Motion** drives the micro-interactions and smooth page transitions.
- **State Management**: Managed globally via **Zustand** (`useAuthStore`, `useInterviewStore`), orchestrating authentication, interview sessions, proctoring flags, and chat history.
- **Authentication**: Native custom authentication system with secure `HttpOnly` session cookies, support for multiple roles (`APPLICANT`, `RECRUITER`), email verification, and password recovery.
- **Real-time Proctoring**: Streams webcam frames to the backend via **Socket.IO** at 10 FPS for server-side ML inference (Face & Device Detection), keeping the client lightweight, performant, and tamper-resistant.

## Project Structure
```text
frontend/
├── src/
│   ├── app/                  # Next.js App Router pages and layouts
│   │   ├── applicant/        # Applicant sign-in, sign-up, and dashboard
│   │   ├── recruiter/        # Recruiter sign-in, sign-up, dashboard, and create-jd
│   │   ├── verify-email/     # Interactive email token verification
│   │   ├── forgot-password/  # Password reset request flow
│   │   ├── reset-password/   # New password submission
│   │   ├── invite/[token]/   # Token-based candidate invitation landing
│   │   ├── interview/        # Candidate voice AI interview platform
│   │   ├── dashboard/        # Candidate evaluation history
│   │   └── admin/            # Admin dashboard for reviewing metrics
│   ├── components/           # Reusable UI components (UserMenu, Shadcn UI)
│   ├── hooks/                # Custom React hooks (useAudioRecorder, etc.)
│   ├── lib/                  # Zustand store (authStore, store), utilities, face detector
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
