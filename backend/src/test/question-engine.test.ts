import { describe, it, expect } from '@jest/globals';
import {
  QuestionEngine,
  CanonicalNormalizedJD,
  CanonicalNormalizedResume,
  QuestionGenerationPlanSchema,
} from '../ai';

describe('Interview Question Engine Synthesis & Source Classification Tests', () => {
  const mockNormalizedJD: CanonicalNormalizedJD = {
    job: {
      title: 'Senior Backend Engineer',
      department: 'Payments',
      level: 'SENIOR',
      employmentType: 'FULL_TIME',
      openings: 1,
      workMode: 'REMOTE',
      location: 'Remote',
      joiningDate: null,
    },
    role: {
      summary: 'Architect resilient transaction processing pipelines',
      description: 'Senior engineer to design scalable distributed services.',
      hiringReason: 'EXPANSION',
    },
    responsibilities: [
      {
        description: 'Design and develop scalable payment APIs with idempotency',
        priority: 'MANDATORY',
        source: { type: 'RECRUITER_FORM', step: 3 },
      },
    ],
    requiredSkills: [
      {
        name: 'PostgreSQL',
        category: 'DATABASE',
        importance: 'MUST_HAVE',
        proficiency: 'ADVANCED',
        source: { type: 'RECRUITER_FORM', step: 4 },
      },
      {
        name: 'Redis',
        category: 'DATABASE',
        importance: 'MUST_HAVE',
        proficiency: 'INTERMEDIATE',
        source: { type: 'RECRUITER_FORM', step: 4 },
      },
      {
        name: 'System Design',
        category: 'ARCHITECTURE',
        importance: 'MUST_HAVE',
        proficiency: 'ADVANCED',
        source: { type: 'RECRUITER_FORM', step: 4 },
      },
      {
        name: 'Kafka',
        category: 'BACKEND',
        importance: 'MUST_HAVE',
        proficiency: 'INTERMEDIATE',
        source: { type: 'RECRUITER_FORM', step: 4 },
      },
    ],
    preferredSkills: [
      {
        name: 'Docker',
        category: 'DEVOPS',
        importance: 'PREFERRED',
        proficiency: 'INTERMEDIATE',
        source: { type: 'RECRUITER_FORM', step: 7 },
      },
    ],
    experience: {
      minimumYears: 4,
      maximumYears: 8,
      industryExperience: ['FinTech'],
      freshersAllowed: false,
      fresherRequirements: [],
      source: { type: 'RECRUITER_FORM', step: 5 },
    },
    education: {
      minimumLevel: 'BACHELORS',
      degrees: ['Computer Science'],
      minimumCGPA: null,
      certifications: [],
      source: { type: 'RECRUITER_FORM', step: 6 },
    },
    candidateQualities: {
      behavioral: ['Ownership', 'Problem Solving'],
      languages: ['English'],
      source: { type: 'RECRUITER_FORM', step: 8 },
    },
    logistics: {
      shiftRequirements: [],
      relocationRequired: false,
      workMode: 'REMOTE',
      location: 'Remote',
      joiningDate: null,
      source: { type: 'RECRUITER_FORM', step: 1 },
    },
    interviewRequirements: {
      technical: true,
      coding: true,
      systemDesign: true,
      behavioral: true,
      domainKnowledge: true,
      source: { type: 'RECRUITER_FORM', step: 4 },
    },
    interviewDimensions: [
      {
        skill: 'PostgreSQL',
        category: 'DATABASE',
        importance: 'MUST_HAVE',
        testAreas: ['Schema design', 'ACID transactions', 'Indexes'],
        sampleProbes: ['How do you prevent deadlocks during high-concurrency balance updates?'],
      },
    ],
  };

  const mockNormalizedResume: CanonicalNormalizedResume = {
    profile: {
      name: 'Taylor Jordan',
      email: 'taylor.jordan@example.com',
      phone: null,
      location: 'New York, NY',
      links: ['https://github.com/taylorjordan'],
    },
    summary: 'Backend Engineer with 4 years building e-commerce and order processing systems.',
    education: [
      {
        degree: 'B.S. Computer Science',
        major: 'Computer Science',
        institution: 'NYU',
        graduationYear: '2020',
        gpa: null,
        honors: [],
        evidence: 'B.S. Computer Science NYU 2020',
      },
    ],
    experience: [
      {
        company: 'RetailHub',
        role: 'Backend Developer',
        location: 'New York, NY',
        duration: '2021 - Present',
        current: true,
        highlights: ['Built payment and checkout services using PostgreSQL for order tracking.'],
        technologies: ['Node.js', 'PostgreSQL', 'Redis'],
        measurableAchievements: ['Processed 2M orders'],
        evidence: ['Used PostgreSQL for order management and transactions.'],
      },
    ],
    skills: [
      {
        name: 'PostgreSQL',
        category: 'DATABASE',
        proficiency: 'INTERMEDIATE',
        evidence: ['Used PostgreSQL for order management and transactions.'],
        source: 'PROJECT',
        confidence: 0.95,
      },
      {
        name: 'Redis',
        category: 'DATABASE',
        proficiency: 'INTERMEDIATE',
        evidence: ['Implemented Redis product caching in e-commerce backend.'],
        source: 'PROJECT',
        confidence: 0.92,
      },
    ],
    projects: [
      {
        name: 'E-Commerce Ordering Engine',
        description: 'Online storefront backend handling orders and real-time inventory.',
        role: 'Sole Developer',
        technologies: ['PostgreSQL', 'Redis', 'Node.js'],
        highlights: ['Implemented Redis caching for inventory and catalog data.'],
        measurableAchievements: [],
        liveUrl: null,
        evidence: ['Used Redis for caching and PostgreSQL for orders.'],
      },
    ],
    certifications: [],
    achievements: [],
    technologies: ['PostgreSQL', 'Redis', 'Node.js', 'TypeScript'],
    domains: [
      { name: 'E-Commerce', evidence: 'Online storefront backend handling orders' },
    ],
  };

  it('should compute overlaps and gaps correctly', () => {
    const analysis = QuestionEngine.analyzeOverlapAndGaps(mockNormalizedJD, mockNormalizedResume);

    // Overlaps: PostgreSQL and Redis
    expect(analysis.overlapSkills.some((s) => s.toLowerCase() === 'postgresql')).toBe(true);
    expect(analysis.overlapSkills.some((s) => s.toLowerCase() === 'redis')).toBe(true);

    // Gap: Kafka (required by JD but absent from resume)
    expect(analysis.gapSkills.some((s) => s.toLowerCase() === 'kafka')).toBe(true);
  });

  it('should synthesize a QuestionGenerationPlan adhering strictly to the Zod schema', async () => {
    const plan = await QuestionEngine.generateQuestions(mockNormalizedJD, mockNormalizedResume, 'Taylor Jordan');
    const validation = QuestionGenerationPlanSchema.safeParse(plan);

    expect(validation.success).toBe(true);
    expect(plan.roleTitle).toBe('Senior Backend Engineer');
    expect(plan.candidateName).toBe('Taylor Jordan');
    expect(plan.questions.length).toBeGreaterThanOrEqual(3);
  });

  it('should generate personalized overlap questions anchoring on resume project evidence', async () => {
    const plan = await QuestionEngine.generateQuestions(mockNormalizedJD, mockNormalizedResume, 'Taylor Jordan');

    // Find questions with JD_RESUME_OVERLAP
    const overlapQuestions = plan.questions.filter(
      (q) => q.sources.includes('JD_RESUME_OVERLAP') || q.sources.includes('RESUME_PROJECT')
    );

    expect(overlapQuestions.length).toBeGreaterThan(0);

    const firstOverlap = overlapQuestions[0];
    expect(firstOverlap.rationale).toBeDefined();
    expect(firstOverlap.suggestedEvaluationCriteria.length).toBeGreaterThan(0);
  });

  it('should record question sources accurately (JD_REQUIREMENT, RESUME_PROJECT, JD_GAP, etc.)', async () => {
    const plan = await QuestionEngine.generateQuestions(mockNormalizedJD, mockNormalizedResume, 'Taylor Jordan');

    for (const q of plan.questions) {
      expect(Array.isArray(q.sources)).toBe(true);
      expect(q.sources.length).toBeGreaterThan(0);
      expect(q.rationale.length).toBeGreaterThan(5);
    }
  });

  it('should generate an adaptive follow-up probe challenging a candidate answer', async () => {
    const followUp = await QuestionEngine.generateFollowUpQuestion(
      'How did you handle Redis cache invalidation?',
      'We just set a 5-minute TTL on everything.',
      { responseQuality: 'vague', weakAreas: ['No cache-aside invalidation'] }
    );

    expect(followUp.followUpQuestion).toBeDefined();
    expect(followUp.followUpQuestion.length).toBeGreaterThan(10);
    expect(followUp.source).toBe('FOLLOW_UP');
  });
});
