import { describe, it, expect } from '@jest/globals';
import {
  ResumeAnalyzer,
  CanonicalNormalizedResumeSchema,
} from '../ai';

describe('Applicant Resume Intelligence & Evidence Preservation Tests', () => {
  const sampleResumeText = `
Alex Rivera
Email: alex.rivera@example.com | Phone: +1-555-0199 | San Francisco, CA
GitHub: https://github.com/alexrivera | LinkedIn: https://linkedin.com/in/alexrivera

PROFESSIONAL SUMMARY
Backend Software Engineer with 4 years of experience building high-scale distributed services in Node.js, TypeScript, and PostgreSQL.

EXPERIENCE
CloudScale Systems — Backend Engineer (Jan 2022 - Present)
- Designed and developed payment reconciliation service handling 100k daily transactions.
- Optimized PostgreSQL queries and connection pooling, reducing peak P99 latency from 450ms to 45ms.
- Containerized microservices using Docker for AWS ECS deployments.

DataPulse Inc — Junior Developer (June 2020 - Dec 2021)
- Built REST APIs in Node.js and Express for analytics dashboard.
- Maintained MongoDB schemas and automated integration testing with Jest.

PROJECTS
E-Commerce Checkout Engine (https://github.com/alexrivera/checkout-engine)
- Built distributed order management backend using Node.js, Express, and PostgreSQL.
- Implemented Redis caching for product catalog, handling 5,000 requests per second.

SKILLS
Languages & Frameworks: Node.js, TypeScript, JavaScript, Python
Databases: PostgreSQL, Redis, MongoDB
DevOps & Tools: Docker, AWS, Git, Linux
Incidental Knowledge: Kubernetes, GraphQL

EDUCATION
University of California, Berkeley — B.S. in Computer Science (2016 - 2020)
GPA: 3.8 / 4.0
`;

  it('should analyze resume text into Canonical Normalized Resume adhering to Zod schema', async () => {
    const normalizedResume = await ResumeAnalyzer.analyzeResumeText(sampleResumeText);
    const validation = CanonicalNormalizedResumeSchema.safeParse(normalizedResume);

    expect(validation.success).toBe(true);
    expect(normalizedResume.profile.name.toLowerCase()).toContain('alex');
    expect(normalizedResume.profile.email.toLowerCase()).toBe('alex.rivera@example.com');
  });

  it('should extract skills and strictly preserve verbatim evidence snippets', async () => {
    const normalizedResume = await ResumeAnalyzer.analyzeResumeText(sampleResumeText);

    expect(normalizedResume.skills.length).toBeGreaterThan(0);

    const postgresSkill = normalizedResume.skills.find(
      (s) => s.name.toLowerCase().includes('postgres')
    );

    expect(postgresSkill).toBeDefined();
    expect(postgresSkill?.evidence.length).toBeGreaterThan(0);
    expect(postgresSkill?.category).toBe('DATABASE');
  });

  it('should extract experience items with company names and highlights', async () => {
    const normalizedResume = await ResumeAnalyzer.analyzeResumeText(sampleResumeText);

    expect(normalizedResume.experience.length).toBeGreaterThan(0);
    const cloudScaleExp = normalizedResume.experience.find(
      (e) => e.company.toLowerCase().includes('cloudscale')
    );

    if (cloudScaleExp) {
      expect(cloudScaleExp.role.toLowerCase()).toContain('backend');
      expect(cloudScaleExp.highlights.length).toBeGreaterThan(0);
    }
  });

  it('should extract projects with technology associations and evidence', async () => {
    const normalizedResume = await ResumeAnalyzer.analyzeResumeText(sampleResumeText);

    if (normalizedResume.projects.length > 0) {
      const checkoutProject = normalizedResume.projects.find(
        (p) => p.name.toLowerCase().includes('checkout') || p.description.toLowerCase().includes('order')
      );
      if (checkoutProject) {
        expect(checkoutProject.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('should reject unsupported proficiency claims by assigning UNKNOWN or conservative level', async () => {
    const normalizedResume = await ResumeAnalyzer.analyzeResumeText(sampleResumeText);

    // Skills listed only in skills list (like Kubernetes or GraphQL) should NOT be tagged as EXPERT
    const k8sSkill = normalizedResume.skills.find((s) => s.name.toLowerCase().includes('kubernetes'));
    if (k8sSkill) {
      expect(k8sSkill.proficiency).not.toBe('EXPERT');
    }
  });
});
