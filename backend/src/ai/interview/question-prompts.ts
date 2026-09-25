export const QUESTION_ENGINE_SYSTEM_PROMPT = `You are a World-Class Technical Interview Architect.
Your mission is to synthesize a personalized, deep-probing interview question plan by triangulating:
1. RECRUITER JOB DESCRIPTION (Determines WHAT MUST BE TESTED)
2. APPLICANT RESUME EVIDENCE (Determines what candidate claims)
3. CANDIDATE GITHUB ARCHITECTURE & GROUND TRUTH (Determines what the candidate has ACTUALLY built, structured, and committed in code)

NEVER ask generic, textbook interview questions (e.g. "What is Redis?").
Instead, ask high-signal questions that specifically anchor onto the candidate's actual projects, architectures, and repositories (e.g. "In your repository 'ecommerce-platform', you used Prisma with Redis. How did you handle cache invalidation during high-volume checkout writes?").`;

export const QUESTION_ENGINE_RULES = [
  "Questions MUST derive from JD requirements, Applicant resume evidence, AND their actual public GitHub repositories.",
  "When GitHub profile evidence is available, generate at least 2 questions directly probing what the candidate actually built in their repositories (tagging sources with ['GITHUB_PROJECT_ARCHITECTURE'] or ['RESUME_GITHUB_OVERLAP']).",
  "Anchor questions to real repository names, end-to-end architectures (e.g., Next.js -> FastAPI -> Redis -> PostgreSQL), data consistency, concurrency, trade-offs, and failure handling.",
  "DO NOT invent experience or repositories not provided in the inputs.",
  "When generating questions for skills where candidate has project experience in their resume, tag sources with ['JD_REQUIREMENT', 'RESUME_PROJECT', 'JD_RESUME_OVERLAP'].",
  "When generating questions for candidate's GitHub repositories, tag sources with ['JD_REQUIREMENT', 'GITHUB_PROJECT_ARCHITECTURE', 'RESUME_GITHUB_OVERLAP'].",
  "If the candidate lacks evidence for a mandatory JD skill (a 'JD_GAP'), phrase the question as a scenario testing that skill in the context of their closest relevant background and tag with ['JD_REQUIREMENT', 'JD_GAP'].",
  "Provide a clear 'rationale' for each question explaining why it was asked, referencing the repo name or resume project.",
  "Include 2-3 objective evaluation criteria and 1-2 follow-up probes for each question.",
  "Output strictly valid raw JSON matching the QuestionGenerationPlan schema.",
];

export const QUESTION_PLAN_SCHEMA_DESCRIPTION = `{
  "roleTitle": "Role Title",
  "candidateName": "Candidate Name",
  "summaryRationale": "Executive summary of why this interview question plan was shaped this way",
  "overlapSummary": ["Candidate has direct project experience with PostgreSQL and Redis matching JD"],
  "gapSummary": ["Candidate lacks documented experience in Kubernetes, which is preferred by JD"],
  "githubProjectSummary": ["Candidate built a full-stack order service with Prisma, Redis, and Docker in repo 'ecommerce-platform'"],
  "questions": [
    {
      "id": "q1",
      "question": "In your e-commerce backend project from your resume, you utilized Redis for product caching. What specific caching patterns did you implement, and how did you handle cache invalidation during high-volume price updates?",
      "skill": "Redis",
      "difficulty": "MEDIUM",
      "sources": ["JD_REQUIREMENT", "RESUME_PROJECT", "JD_RESUME_OVERLAP"],
      "rationale": "Redis is a required technical skill in the JD, and candidate listed Redis caching in their e-commerce backend project.",
      "suggestedEvaluationCriteria": [
        "Mentions specific caching pattern (e.g. Cache-Aside / Write-Through)",
        "Explains invalidation trigger and TTL strategy",
        "Understands concurrency and race conditions"
      ],
      "followUpProbes": [
        "What happens if Redis becomes completely unreachable during a peak sale?"
      ]
    },
    {
      "id": "q2",
      "question": "In your GitHub repository 'ecommerce-platform', you built an order service using Prisma, Redis, and PostgreSQL. How did you structure your caching and database transactions to avoid race conditions during concurrent product purchases?",
      "skill": "Redis & Concurrency",
      "difficulty": "HARD",
      "sources": ["JD_REQUIREMENT", "GITHUB_PROJECT_ARCHITECTURE", "RESUME_GITHUB_OVERLAP"],
      "rationale": "Directly probes what the candidate actually built in 'ecommerce-platform' to verify their concurrency and caching architecture against JD requirements.",
      "githubProject": "ecommerce-platform",
      "targetArchitecture": "Next.js -> Node.js -> Redis -> PostgreSQL (Prisma)",
      "suggestedEvaluationCriteria": [
        "Mentions specific caching pattern and distributed locking",
        "Explains database transaction isolation and idempotency",
        "Articulates actual failure handling and edge cases"
      ],
      "followUpProbes": [
        "How would you refactor this to handle a 10x spike in write throughput?"
      ]
    }
  ]
}`;
