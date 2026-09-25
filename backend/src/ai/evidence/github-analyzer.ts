import {
  GitHubProfileAnalysis,
  GitHubRepoAnalysis,
  CanonicalGitHubSummary,
  CanonicalGitHubSummarySchema,
  FlagshipProjectArchitecture,
  ArchitecturalProbe,
  VerifiedTechnology,
} from './evidence-types';
import { PromptRunner } from '../core/prompt-runner';
import { logger } from '../../config/logger';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AI-Interview-Platform-Static-Analyzer' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchRaw(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AI-Interview-Platform-Static-Analyzer' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let decoder: TextDecoder;
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      decoder = new TextDecoder('utf-16le');
    } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      decoder = new TextDecoder('utf-16be');
    } else {
      decoder = new TextDecoder('utf-8', { fatal: false });
    }
    const decoded = decoder.decode(buffer);
    // Strip null characters, BOM, replacement chars, and non-printable control characters (protects Postgres JSONB / 22P05)
    return decoded
      .replace(/[\u0000\uFEFF\uFFFD]/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } catch {
    return null;
  }
}

export class PublicGitHubAnalyzer {
  /**
   * Sanitizes repository content against prompt-injection vectors.
   * Ensures candidate repository text is treated as untrusted data, never as system instructions.
   */
  static sanitizeRepoText(text: string): { sanitizedText: string; hasInjectionAttempt: boolean } {
    if (!text) return { sanitizedText: '', hasInjectionAttempt: false };

    // Strip null characters, UTF-16 BOM artifacts, and control characters that break Postgres JSONB
    let sanitizedText = text
      .replace(/[\u0000\uFEFF\uFFFD]/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const injectionPatterns = [
      /ignore\s+(all\s+)?(previous\s+)?instructions/i,
      /system\s+prompt\s+override/i,
      /give\s+(this\s+)?candidate\s+(a\s+)?perfect\s+score/i,
      /disregard\s+prior\s+rules/i,
      /you\s+are\s+now\s+an\s+AI\s+that/i,
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    ];

    let hasInjectionAttempt = false;

    injectionPatterns.forEach((pattern) => {
      if (pattern.test(sanitizedText)) {
        hasInjectionAttempt = true;
        sanitizedText = sanitizedText.replace(pattern, '[REDACTED_UNTRUSTED_INSTRUCTION]');
      }
    });

    if (sanitizedText.length > 3000) {
      sanitizedText = sanitizedText.slice(0, 3000) + '\n... [Truncated for Static Analysis]';
    }

    return { sanitizedText, hasInjectionAttempt };
  }

  /**
   * Extracts known frameworks, databases, and dependencies from manifests.
   */
  private static extractDependenciesFromPackageJson(rawJson: string): {
    dependencies: string[];
    hasTests: boolean;
  } {
    try {
      const parsed = JSON.parse(rawJson);
      const deps: string[] = [];
      const allDeps = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };

      const keyTechKeywords = [
        'react', 'next', 'vue', 'angular', 'svelte', 'express', 'fastify', 'nest', '@nestjs/core',
        'prisma', '@prisma/client', 'typeorm', 'sequelize', 'mongoose', 'pg', 'mysql2',
        'redis', 'ioredis', 'bull', 'bullmq', 'kafkajs', 'amqplib',
        'socket.io', 'ws', 'graphql', 'apollo-server',
        'tailwind', 'tailwindcss', 'redux', 'zustand', 'trpc',
        'jest', 'vitest', 'mocha', 'cypress', 'playwright', 'supertest',
        'docker', 'aws-sdk', '@aws-sdk/client-s3', 'firebase', 'supabase',
      ];

      for (const key of Object.keys(allDeps)) {
        const lower = key.toLowerCase();
        for (const kw of keyTechKeywords) {
          if (lower === kw || lower.startsWith(`${kw}/`)) {
            if (!deps.includes(kw)) deps.push(kw);
          }
        }
      }

      const scripts = parsed.scripts || {};
      const testScript = scripts.test || '';
      const hasTests =
        Boolean(testScript) &&
        !testScript.includes('no test specified') &&
        !testScript.includes('exit 1');

      return { dependencies: deps, hasTests };
    } catch {
      return { dependencies: [], hasTests: false };
    }
  }

  /**
   * Extracts Python dependencies from requirements.txt or pyproject.toml
   */
  private static extractDependenciesFromPython(rawText: string): {
    dependencies: string[];
    hasTests: boolean;
  } {
    const deps: string[] = [];
    const lower = rawText.toLowerCase();

    const pythonTechs = [
      'fastapi', 'django', 'flask', 'celery', 'redis', 'sqlalchemy', 'tortoise-orm',
      'alembic', 'pytest', 'unittest', 'pydantic', 'numpy', 'pandas', 'scipy',
      'torch', 'tensorflow', 'transformers', 'langchain', 'openai', 'httpx', 'asyncio'
    ];

    for (const tech of pythonTechs) {
      if (lower.includes(tech)) {
        deps.push(tech);
      }
    }

    const hasTests = lower.includes('pytest') || lower.includes('unittest') || lower.includes('coverage');
    return { dependencies: deps, hasTests };
  }

  /**
   * Performs static inspection of up to 15 public GitHub repositories.
   * NEVER executes code, installs packages, or runs binaries.
   */
  static async analyzePublicProfile(
    githubUrlOrUsername: string,
    jdSkills: string[] = []
  ): Promise<GitHubProfileAnalysis | null> {
    if (!githubUrlOrUsername) return null;

    try {
      let username = githubUrlOrUsername.trim();
      if (username.includes('github.com/')) {
        const parts = username.split('github.com/')[1].split('/');
        username = parts[0];
      }

      username = username.replace(/^@/, '').trim();
      if (!username) return null;

      logger.info(`Fetching public GitHub profile statically for: ${username}`);

      const userData = await fetchJson(`https://api.github.com/users/${username}`);
      // Fetch the latest 15 repositories (sorted by last updated)
      const reposData: any[] =
        (await fetchJson(`https://api.github.com/users/${username}/repos?sort=updated&per_page=15`)) || [];

      const allTechnologies = new Set<string>();

      // Inspect up to 15 repositories concurrently
      const targetRepos = reposData.slice(0, 15);

      const analyzedRepos: GitHubRepoAnalysis[] = (
        await Promise.all(
          targetRepos.map(async (repo) => {
            const repoName = repo.name;
            const description = (repo.description || '').replace(/[\u0000\uFEFF\uFFFD]/g, '');
            const language = (repo.language || '').replace(/[\u0000\uFEFF\uFFFD]/g, '');
            const defaultBranch = repo.default_branch || 'main';

            if (language) allTechnologies.add(language);

            const rawBase = `https://raw.githubusercontent.com/${username}/${repoName}/${defaultBranch}`;

            // Concurrent static fetches of project manifests
            const [
              pkgJsonRaw,
              reqsTxtRaw,
              goModRaw,
              cargoRaw,
              dockerfileRaw,
              dockerComposeRaw,
              readmeRaw,
            ] = await Promise.all([
              fetchRaw(`${rawBase}/package.json`),
              fetchRaw(`${rawBase}/requirements.txt`),
              fetchRaw(`${rawBase}/go.mod`),
              fetchRaw(`${rawBase}/Cargo.toml`),
              fetchRaw(`${rawBase}/Dockerfile`),
              fetchRaw(`${rawBase}/docker-compose.yml`),
              fetchRaw(`${rawBase}/README.md`),
            ]);

            let hasDocker = Boolean(dockerfileRaw || dockerComposeRaw);
            let hasTests = false;
            let detectedDeps: string[] = [];

            if (pkgJsonRaw) {
              const res = this.extractDependenciesFromPackageJson(pkgJsonRaw);
              detectedDeps.push(...res.dependencies);
              if (res.hasTests) hasTests = true;
            }

            if (reqsTxtRaw) {
              const res = this.extractDependenciesFromPython(reqsTxtRaw);
              detectedDeps.push(...res.dependencies);
              if (res.hasTests) hasTests = true;
            }

            if (goModRaw) {
              if (goModRaw.includes('gin-gonic/gin')) detectedDeps.push('gin');
              if (goModRaw.includes('go-chi/chi')) detectedDeps.push('chi');
              if (goModRaw.includes('gorm.io/gorm')) detectedDeps.push('gorm');
            }

            if (cargoRaw) {
              if (cargoRaw.includes('actix-web')) detectedDeps.push('actix-web');
              if (cargoRaw.includes('axum')) detectedDeps.push('axum');
              if (cargoRaw.includes('tokio')) detectedDeps.push('tokio');
            }

            detectedDeps.forEach((dep) => allTechnologies.add(dep));

            // Sanitize README content
            let readmeSummary = '';
            let hasInjection = false;

            let effectiveReadme = readmeRaw;
            if (!effectiveReadme && defaultBranch === 'main') {
              effectiveReadme = await fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/master/README.md`);
            }

            if (effectiveReadme) {
              const sanitized = this.sanitizeRepoText(effectiveReadme);
              readmeSummary = sanitized.sanitizedText.slice(0, 600);
              hasInjection = sanitized.hasInjectionAttempt;
            } else {
              readmeSummary = description;
            }

            // Calculate relevance score
            let relevanceScore = repo.stargazers_count ? repo.stargazers_count * 2 : 0;
            const matchedTechs: string[] = [];

            if (language && jdSkills.some((s) => s.toLowerCase().includes(language.toLowerCase()))) {
              relevanceScore += 5;
              matchedTechs.push(language);
            }

            detectedDeps.forEach((dep) => {
              if (jdSkills.some((s) => s.toLowerCase().includes(dep.toLowerCase()))) {
                relevanceScore += 4;
                if (!matchedTechs.includes(dep)) matchedTechs.push(dep);
              }
            });

            jdSkills.forEach((skill) => {
              if (
                repoName.toLowerCase().includes(skill.toLowerCase()) ||
                description.toLowerCase().includes(skill.toLowerCase())
              ) {
                relevanceScore += 3;
                if (!matchedTechs.includes(skill)) matchedTechs.push(skill);
              }
            });

            if (hasDocker) relevanceScore += 2;
            if (hasTests) relevanceScore += 2;

            // Classify architecture type
            let architectureType = 'Full-Stack Application';
            if (detectedDeps.includes('next') || detectedDeps.includes('react')) {
              architectureType = detectedDeps.includes('express') || detectedDeps.includes('fastify') || detectedDeps.includes('prisma')
                ? 'Full-Stack Web App (Next.js & Node.js)'
                : 'Frontend Single-Page App';
            } else if (detectedDeps.includes('fastapi') || detectedDeps.includes('django') || detectedDeps.includes('flask')) {
              architectureType = 'Python Backend / Microservice API';
            } else if (detectedDeps.includes('express') || detectedDeps.includes('fastify') || detectedDeps.includes('nest')) {
              architectureType = 'Node.js REST / GraphQL Service';
            } else if (language.toLowerCase() === 'go') {
              architectureType = 'Go High-Performance Service';
            } else if (language.toLowerCase() === 'rust') {
              architectureType = 'Rust Systems / Async Service';
            }

            const structureHighlights: string[] = [];
            if (hasDocker) structureHighlights.push('Containerized (Docker)');
            if (hasTests) structureHighlights.push('Automated Tests Present');
            if (detectedDeps.includes('prisma') || detectedDeps.includes('sqlalchemy')) structureHighlights.push('ORM / Relational Data Model');
            if (detectedDeps.includes('redis')) structureHighlights.push('Redis Cache / PubSub Layer');
            if (detectedDeps.includes('bull') || detectedDeps.includes('bullmq') || detectedDeps.includes('celery')) {
              structureHighlights.push('Asynchronous Job Queue Worker');
            }

            return {
              repoName,
              description,
              language,
              stars: repo.stargazers_count || 0,
              relevantTechnologies: Array.from(new Set([...matchedTechs, ...detectedDeps, language].filter(Boolean))),
              readmeSummary,
              keySourceFiles: [],
              relevanceScore,
              hasPromptInjectionAttempt: hasInjection,
              architectureType,
              detectedDependencies: detectedDeps,
              hasTests,
              hasDocker,
              hasCiCd: Boolean(repo.has_pages || hasDocker),
              structureHighlights,
            };
          })
        )
      ).filter(Boolean) as GitHubRepoAnalysis[];

      analyzedRepos.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Synthesize Canonical GitHub Summary (Executive architecture overview, flagship projects, and questions)
      const canonicalSummary = await this.synthesizeCanonicalSummary(
        username,
        `https://github.com/${username}`,
        userData?.public_repos || reposData.length,
        analyzedRepos,
        Array.from(allTechnologies),
        jdSkills
      );

      return {
        username,
        profileUrl: `https://github.com/${username}`,
        publicRepoCount: userData?.public_repos || reposData.length,
        analyzedRepos,
        topTechnologies: Array.from(allTechnologies),
        analysisTimestamp: new Date().toISOString(),
        canonicalSummary,
      };
    } catch (err: any) {
      logger.warn(`Public GitHub static analysis skipped or rate-limited for ${githubUrlOrUsername}: ${err.message}`);
      return null;
    }
  }

  /**
   * Deterministic rule-based fallback generator for Canonical GitHub Summary.
   */
  private static generateFallbackCanonicalSummary(
    username: string,
    profileUrl: string,
    totalPublicRepos: number,
    analyzedRepos: GitHubRepoAnalysis[],
    allTechnologies: string[],
    jdSkills: string[]
  ): CanonicalGitHubSummary {
    const flagshipProjects: FlagshipProjectArchitecture[] = [];
    const verifiedTechnologies: VerifiedTechnology[] = [];
    const suggestedProbes: ArchitecturalProbe[] = [];

    // Map top 3-5 flagship projects
    for (const repo of analyzedRepos.slice(0, 5)) {
      const techs = repo.relevantTechnologies.length > 0 ? repo.relevantTechnologies : [repo.language].filter(Boolean);
      const hasDocker = repo.hasDocker || false;
      const hasTests = repo.hasTests || false;

      let pipeline = `${techs.slice(0, 2).join(' / ')}`;
      if (techs.some((t) => ['prisma', 'sqlalchemy', 'postgres', 'pg', 'mysql2', 'sqlite'].includes(t.toLowerCase()))) {
        pipeline += ' -> Database Layer';
      }
      if (techs.some((t) => ['redis', 'ioredis'].includes(t.toLowerCase()))) {
        pipeline += ' -> Redis Cache';
      }
      if (hasDocker) pipeline += ' -> Docker Container';

      const maturity =
        hasTests && hasDocker && repo.stars >= 1
          ? 'PRODUCTION_GRADE'
          : repo.detectedDependencies.length >= 3
          ? 'SOLID_INDIVIDUAL_PROJECT'
          : 'PROTOTYPE';

      const decisions: string[] = [];
      if (techs.includes('redis')) decisions.push('Integrated Redis for low-latency caching/queuing');
      if (techs.includes('prisma')) decisions.push('Utilized Prisma ORM for type-safe schema queries');
      if (hasDocker) decisions.push('Containerized execution environment with multi-stage Dockerfile');
      if (hasTests) decisions.push('Configured automated test harness and assertions');

      flagshipProjects.push({
        repoName: repo.repoName,
        url: `https://github.com/${username}/${repo.repoName}`,
        primaryLanguage: repo.language || 'TypeScript',
        architectureType: repo.architectureType || 'Modular Service Architecture',
        primaryPurpose: repo.description || `Software project built with ${techs.slice(0, 3).join(', ')}`,
        endToEndArchitecture: pipeline,
        keyTechnologies: techs,
        designPatterns: ['Modular Layering', 'Separation of Concerns', ...(techs.includes('redis') ? ['Cache-Aside'] : [])],
        hasTests,
        hasDocker,
        hasCiCd: repo.hasCiCd || false,
        codeMaturity: maturity,
        verifiedArchitecturalDecisions: decisions,
      });

      // Formulate a probing question grounded in what the candidate actually built
      const primaryTech = techs[0] || repo.language || 'architecture';
      suggestedProbes.push({
        repoName: repo.repoName,
        question: `In your repository "${repo.repoName}", you architected a solution using ${techs.slice(0, 3).join(', ')}. How did you handle data consistency, error recovery, and concurrency when implementing the core logic?`,
        rationale: `Grounded in candidate's actual repository '${repo.repoName}'. Directly verifies architectural ownership and technical depth.`,
        targetedSkill: primaryTech,
      });
    }

    // Verified technologies
    const techMap = new Map<string, string[]>();
    analyzedRepos.forEach((repo) => {
      repo.relevantTechnologies.forEach((tech) => {
        const existing = techMap.get(tech) || [];
        if (!existing.includes(repo.repoName)) existing.push(repo.repoName);
        techMap.set(tech, existing);
      });
    });

    techMap.forEach((repos, tech) => {
      verifiedTechnologies.push({
        technology: tech,
        repos,
        depth: repos.length >= 2 ? 'CORE_DEPENDENCY' : 'UTILITY',
      });
    });

    const isFullStack = allTechnologies.some((t) => ['react', 'next', 'vue'].includes(t.toLowerCase())) &&
      allTechnologies.some((t) => ['express', 'fastify', 'nest', 'fastapi', 'django', 'go'].includes(t.toLowerCase()));

    const primaryArchetype = isFullStack
      ? 'Full-Stack Systems & Product Engineer'
      : allTechnologies.some((t) => ['fastapi', 'express', 'go', 'rust'].includes(t.toLowerCase()))
      ? 'Backend & API Systems Architect'
      : `${allTechnologies[0] || 'Software'} Engineer`;

    const executiveSummary = `${username} exhibits strong hands-on code development across ${analyzedRepos.length} analyzed repositories. Built projects utilizing ${allTechnologies.slice(0, 6).join(', ')}, demonstrating hands-on architectural experience with ${flagshipProjects.map((p) => p.repoName).slice(0, 3).join(', ')}. Code inspection verifies containerization in ${flagshipProjects.filter((p) => p.hasDocker).length} repos and testing suites in ${flagshipProjects.filter((p) => p.hasTests).length} repos.`;

    return {
      username,
      profileUrl,
      totalPublicRepos,
      analyzedRepoCount: analyzedRepos.length,
      primaryArchetype,
      executiveSummary,
      flagshipProjects,
      verifiedTechnologies,
      architecturalStrengths: [
        `Hands-on code evidence across ${analyzedRepos.length} repositories`,
        `Direct multi-technology orchestration (${allTechnologies.slice(0, 5).join(', ')})`,
        ...(flagshipProjects.some((p) => p.hasDocker) ? ['Containerization with Docker across core services'] : []),
        ...(flagshipProjects.some((p) => p.hasTests) ? ['Automated unit and integration test discipline'] : []),
      ],
      engineeringGaps: [
        ...(flagshipProjects.every((p) => !p.hasTests) ? ['Limited automated test coverage in examined repositories'] : []),
        ...(flagshipProjects.every((p) => !p.hasDocker) ? ['No containerization files observed in active repositories'] : []),
      ],
      suggestedArchitectureProbes: suggestedProbes.slice(0, 4),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Synthesizes Canonical GitHub Summary using AI PromptRunner with high-rigor fallback.
   */
  private static async synthesizeCanonicalSummary(
    username: string,
    profileUrl: string,
    totalPublicRepos: number,
    analyzedRepos: GitHubRepoAnalysis[],
    allTechnologies: string[],
    jdSkills: string[]
  ): Promise<CanonicalGitHubSummary> {
    const input = {
      username,
      profileUrl,
      totalPublicRepos,
      analyzedRepos,
      allTechnologies,
      jdSkills,
    };

    return await PromptRunner.execute(
      {
        name: 'CanonicalGitHubSummarySynthesizer',
        systemInstruction: `You are a Principal Software Architect and Ground-Truth Technical Evaluator.
Your mission is to perform static architectural evaluation of a software engineer's last 15 GitHub repositories.
Synthesize an authoritative Canonical GitHub Summary that recruiters and technical interviewers can rely on as ground-truth evidence of what the candidate has ACTUALLY built.
Ground your evaluation strictly in the concrete manifests, code architectures, frameworks, and design patterns discovered.
Generate targeted architectural probe questions that an AI interviewer can ask to test their code authorship and engineering decisions.`,
        rules: [
          'Ground all findings in the concrete repositories, dependencies, and architectures provided.',
          'Identify 3 to 5 flagship projects with clear end-to-end architecture pipeline representations (e.g. Next.js 14 -> FastAPI -> Redis -> PostgreSQL + Docker).',
          'Formulate 3 to 5 high-signal architectural probe questions directly grounded in what the candidate built in their repositories.',
          'Never invent repositories, code, or dependencies not present in the input.',
          'Classify code maturity objectively (PROTOTYPE, SOLID_INDIVIDUAL_PROJECT, PRODUCTION_GRADE, LIBRARY_FRAMEWORK).',
        ],
        outputSchema: CanonicalGitHubSummarySchema,
        schemaDescription: `{
  "username": "${username}",
  "profileUrl": "${profileUrl}",
  "totalPublicRepos": ${totalPublicRepos},
  "analyzedRepoCount": ${analyzedRepos.length},
  "primaryArchetype": "Full-Stack Distributed Systems Engineer",
  "executiveSummary": "Comprehensive summary of what the candidate has built across their last 15 repositories, end-to-end architectures, and code rigor.",
  "flagshipProjects": [
    {
      "repoName": "repo-name",
      "url": "https://github.com/...",
      "primaryLanguage": "TypeScript",
      "architectureType": "Full-Stack Web App",
      "primaryPurpose": "What the project does",
      "endToEndArchitecture": "Next.js -> Node.js API -> Redis Cache -> PostgreSQL via Prisma -> Docker",
      "keyTechnologies": ["Next.js", "Redis", "Prisma", "PostgreSQL", "Docker"],
      "designPatterns": ["Cache-Aside", "Repository Pattern"],
      "hasTests": true,
      "hasDocker": true,
      "hasCiCd": true,
      "codeMaturity": "PRODUCTION_GRADE",
      "verifiedArchitecturalDecisions": ["Implemented Redis caching with cache-aside pattern", "Containerized with Docker"]
    }
  ],
  "verifiedTechnologies": [
    { "technology": "Redis", "repos": ["repo-1"], "depth": "CORE_DEPENDENCY" }
  ],
  "architecturalStrengths": ["Clear modular separation", "Production containerization"],
  "engineeringGaps": ["Limited CI/CD automation in secondary repositories"],
  "suggestedArchitectureProbes": [
    {
      "repoName": "repo-name",
      "question": "In your repository 'repo-name', you built an order service with Prisma and Redis. How did you handle cache invalidation during high-volume checkout writes?",
      "rationale": "Directly probes actual concurrency and caching decisions in candidate's project.",
      "targetedSkill": "Redis & Concurrency"
    }
  ],
  "generatedAt": "2026-09-21T00:00:00.000Z"
}`,
        fallbackGenerator: (inp) =>
          this.generateFallbackCanonicalSummary(
            inp.username,
            inp.profileUrl,
            inp.totalPublicRepos,
            inp.analyzedRepos,
            inp.allTechnologies,
            inp.jdSkills
          ),
      },
      input,
      (inp) => `
Analyze the candidate's last ${inp.analyzedRepos.length} public GitHub repositories and generate the Canonical GitHub Summary:

Candidate GitHub: @${inp.username}
Profile URL: ${inp.profileUrl}
Total Public Repos: ${inp.totalPublicRepos}
Target Job Skills to Triangulate: ${inp.jdSkills.join(', ') || 'General Full-Stack / Backend Engineering'}

Analyzed Repositories (Up to 15 latest):
${inp.analyzedRepos
  .map(
    (r, idx) => `
--- Repo #${idx + 1}: ${r.repoName} (${r.language || 'Unknown'}, Stars: ${r.stars}) ---
Description: ${r.description || 'None'}
Architecture Type: ${r.architectureType}
Detected Manifest Dependencies: ${r.detectedDependencies.join(', ') || 'None detected'}
Relevant Technologies: ${r.relevantTechnologies.join(', ')}
Has Docker: ${r.hasDocker} | Has Automated Tests: ${r.hasTests}
README Summary:
${r.readmeSummary || 'None'}
`
  )
  .join('\n')}

Synthesize the complete Canonical GitHub Summary adhering strictly to the schema. Make sure the suggestedArchitectureProbes directly probe what the candidate built!
`
    );
  }
}
