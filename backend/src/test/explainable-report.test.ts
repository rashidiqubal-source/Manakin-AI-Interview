import { EvidenceProfileBuilder } from '../ai/evidence/evidence-profile-builder';

describe('Explainable Candidate Report & Evidence Profile Suite', () => {
  it('1. Generates correct ASCII evidence bars and level ratings', () => {
    expect(EvidenceProfileBuilder.generateAsciiBar(9.0)).toBe('█████████░');
    expect(EvidenceProfileBuilder.generateAsciiBar(7.0)).toBe('███████░░░');
    expect(EvidenceProfileBuilder.generateAsciiBar(5.0)).toBe('█████░░░░░');
    expect(EvidenceProfileBuilder.generateAsciiBar(8.0)).toBe('████████░░');
    expect(EvidenceProfileBuilder.generateAsciiBar(10.0)).toBe('██████████');
  });

  it('2. Builds in-depth Candidate Evidence Profile across requested competencies', () => {
    const report = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-test-123',
      candidateName: 'Alex Mercer',
      candidateEmail: 'alex@example.com',
      jobTitle: 'Senior Full Stack Engineer',
      overallRecommendation: 'PASS',
      totalScore: 8.5,
      messages: [
        {
          role: 'assistant',
          content: 'How do you structure microservices in Node.js to handle error boundaries and concurrency?',
          ttsDuration: 3.8,
        },
        {
          role: 'user',
          content: 'We use Express with domain error handlers, circuit breakers, and async worker pools.',
          silenceLatency: 2.1,
          clarity: 9,
        },
        {
          role: 'assistant',
          content: 'Describe your approach to relational database indexing and query optimization in PostgreSQL.',
          ttsDuration: 3.5,
        },
        {
          role: 'user',
          content: 'We use compound indexes, explain analyze, and vacuuming, with Prisma transactions.',
          silenceLatency: 1.8,
          clarity: 8,
        },
      ],
      detectionEvents: [
        {
          eventType: 'UNAUTHORIZED_DEVICE',
          objectClass: 'cell phone',
          confidence: 0.91,
          riskLevel: 'HIGH',
        },
        {
          eventType: 'FACE_ABSENCE',
          objectClass: null,
          confidence: 0.85,
          riskLevel: 'MEDIUM',
        },
      ],
      eyeTrackingData: {
        awayDurationSec: 4.2,
        awayPercentage: 6.8,
        awayEpisodes: [{ startSec: 10, endSec: 14.2, durationSec: 4.2 }],
        totalFixationCount: 52,
        avgFixationDurationMs: 270,
        gazeTimeline: [
          { direction: 'CENTER' },
          { direction: 'CENTER' },
          { direction: 'LOOKING_LEFT' },
          { direction: 'CENTER' },
        ],
      },
    });

    // Verify In-Depth Candidate Evidence Profile
    expect(report.candidateEvidenceProfile.length).toBeGreaterThanOrEqual(5);

    const backend = report.candidateEvidenceProfile.find((c) => c.category === 'Backend Engineering');
    expect(backend).toBeDefined();
    expect(backend?.asciiBar).toContain('█');
    expect(backend?.inDepthRationale.length).toBeGreaterThan(20);

    const db = report.candidateEvidenceProfile.find((c) => c.category === 'Database Engineering');
    expect(db).toBeDefined();

    const systemDesign = report.candidateEvidenceProfile.find((c) => c.category === 'System Design');
    expect(systemDesign).toBeDefined();

    const comm = report.candidateEvidenceProfile.find((c) => c.category === 'Communication');
    expect(comm).toBeDefined();

    const ai = report.candidateEvidenceProfile.find((c) => c.category === 'AI Engineering');
    expect(ai).toBeDefined();

    // Verify Explainable Transcript
    expect(report.explainableTranscript.length).toBe(2);
    expect(report.explainableTranscript[0].turn).toBe(1);
    expect(report.explainableTranscript[0].silenceLatencySec).toBe(2.1);
    expect(report.explainableTranscript[0].ttsDurationSec).toBe(3.8);
    expect(report.explainableTranscript[1].silenceLatencySec).toBe(1.8);

    // Verify Gaze Stability
    expect(report.gazeStabilityAnalysis.isExcessiveMovement).toBe(false);
    expect(report.gazeStabilityAnalysis.awayDurationSec).toBe(4.2);
    expect(report.gazeStabilityAnalysis.totalFixations).toBe(52);

    // Verify YOLO Vision Proctoring
    expect(report.yoloProctoringReport.phoneCount).toBe(1);
    expect(report.yoloProctoringReport.faceAbsenceCount).toBe(1);
    expect(report.yoloProctoringReport.severity).toBe('SUSPICIOUS');
  });

  it('3. Detects excessive eye movement when gaze volatility exceeds safety threshold', () => {
    const report = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-volatile',
      candidateName: 'Jane Doe',
      messages: [],
      eyeTrackingData: {
        awayDurationSec: 25.0,
        awayPercentage: 35.0,
        awayEpisodes: [
          { startSec: 5, endSec: 15, durationSec: 10 },
          { startSec: 30, endSec: 45, durationSec: 15 },
        ],
        totalFixationCount: 8,
        avgFixationDurationMs: 140,
        gazeTimeline: [
          { direction: 'LOOKING_LEFT' },
          { direction: 'LOOKING_RIGHT' },
          { direction: 'AWAY_FROM_SCREEN' },
          { direction: 'LOOKING_UP' },
          { direction: 'LOOKING_DOWN' },
          { direction: 'AWAY_FROM_SCREEN' },
        ],
      },
    });

    expect(report.gazeStabilityAnalysis.isExcessiveMovement).toBe(true);
    expect(report.gazeStabilityAnalysis.movementAssessment).toBe('Excessive Eye Movement / High Volatility');
    expect(report.gazeStabilityAnalysis.awayPercentage).toBe(35);
  });

  it('4. Evaluates gaze patterns and equips recruiters with educational interpretation guide', () => {
    const report = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-gaze-patterns',
      candidateName: 'Alex Mercer',
      messages: [],
      eyeTrackingData: {
        awayDurationSec: 6.0,
        awayPercentage: 12.0,
        awayEpisodes: [{ startSec: 10, endSec: 16, durationSec: 6 }],
        totalFixationCount: 22,
        avgFixationDurationMs: 280,
        gazeTimeline: [
          { x: 0.20, y: 0.40, direction: 'LOOKING_LEFT' },
          { x: 0.26, y: 0.41, direction: 'LOOKING_LEFT' },
          { x: 0.31, y: 0.40, direction: 'LOOKING_LEFT' },
          { x: 0.36, y: 0.42, direction: 'LOOKING_LEFT' },
          { x: 0.50, y: 0.85, direction: 'LOOKING_DOWN' },
          { x: 0.50, y: 0.20, direction: 'LOOKING_UP' },
          { x: 0.50, y: 0.50, direction: 'CENTER' },
        ],
      },
      detectionEvents: [
        { eventType: 'OFF_SCREEN_READING', timestamp: new Date(1000).toISOString(), riskLevel: 'HIGH' },
        { eventType: 'CONCEALED_PHONE_GAZE', timestamp: new Date(3000).toISOString(), riskLevel: 'HIGH' },
      ],
    });

    const gaze = report.gazeStabilityAnalysis;
    expect(gaze.detectedPatterns).toBeDefined();
    expect(gaze.detectedPatterns!.length).toBeGreaterThanOrEqual(4);

    const readingPattern = gaze.detectedPatterns!.find((p) => p.category === 'HORIZONTAL_READING_SACCADES');
    expect(readingPattern).toBeDefined();
    expect(readingPattern!.status).toBe('DETECTED');
    expect(readingPattern!.cognitiveMeaning).toContain('Reading continuous structured text');
    expect(readingPattern!.recruiterImplication).toContain('external script');

    const downwardPattern = gaze.detectedPatterns!.find((p) => p.category === 'CONCEALED_DOWNWARD_DWELL');
    expect(downwardPattern).toBeDefined();
    expect(downwardPattern!.status).toBe('DETECTED');

    const cognitivePattern = gaze.detectedPatterns!.find((p) => p.category === 'NATURAL_COGNITIVE_DIVERGENCE');
    expect(cognitivePattern).toBeDefined();
    expect(cognitivePattern!.severity).toBe('NORMAL');
    expect(cognitivePattern!.recommendedAction).toContain('DO NOT penalize');

    // Verify Recruiter Education Guide
    expect(gaze.recruiterEducation).toBeDefined();
    expect(gaze.recruiterEducation!.readingVsThinking.readingIndicators.length).toBeGreaterThan(0);
    expect(gaze.recruiterEducation!.readingVsThinking.thinkingIndicators.length).toBeGreaterThan(0);
    expect(gaze.recruiterEducation!.patternsGuide.length).toBeGreaterThanOrEqual(4);
  });

  it('5. Computes Percentile Cohort Ranking strictly against real applicant pool', () => {
    // Single applicant case (no synthetic fallback)
    const singleReport = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-solo',
      candidateName: 'Solo Candidate',
      totalScore: 8.5,
      messages: [],
      cohortScores: [{ id: 'sess-solo', totalScore: 8.5 }],
    });

    expect(singleReport.cohortRanking).toBeDefined();
    expect(singleReport.cohortRanking!.cohortSize).toBe(1);
    expect(singleReport.cohortRanking!.rank).toBe(1);
    expect(singleReport.cohortRanking!.overallPercentile).toBe(100);
    expect(singleReport.cohortRanking!.headline).toContain('Initial candidate for this role');

    // Multi-applicant cohort
    const cohortReport = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-top',
      candidateName: 'Top Performer',
      totalScore: 9.0,
      messages: [],
      cohortScores: [
        { id: 'sess-1', totalScore: 7.2 },
        { id: 'sess-2', totalScore: 8.1 },
        { id: 'sess-top', totalScore: 9.0 },
        { id: 'sess-3', totalScore: 6.5 },
      ],
    });

    expect(cohortReport.cohortRanking).toBeDefined();
    expect(cohortReport.cohortRanking!.cohortSize).toBe(4);
    expect(cohortReport.cohortRanking!.rank).toBe(1);
    expect(cohortReport.cohortRanking!.overallPercentile).toBe(100);
    expect(cohortReport.cohortRanking!.headline).toContain('Top');
  });

  it('6. Normalizes Question Difficulty and computes calibrated competency scores', () => {
    const report = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-difficulty',
      candidateName: 'Algorithmic Dev',
      messages: [
        {
          role: 'assistant',
          content: 'Explain distributed consensus and Raft leader election algorithm with network partitions.',
        },
        {
          role: 'user',
          content: 'In Raft, when a network partition occurs, the cluster splits into majority and minority quorums...',
          clarity: 8.0,
        },
        {
          role: 'assistant',
          content: 'Tell me about yourself and your background.',
        },
        {
          role: 'user',
          content: 'I have 5 years of full stack software engineering experience...',
          clarity: 8.0,
        },
      ],
    });

    expect(report.explainableTranscript.length).toBe(2);

    const expertTurn = report.explainableTranscript[0];
    expect(expertTurn.difficultyLevel).toBe('EXPERT');
    expect(expertTurn.difficultyWeight).toBe(1.25);
    // 8.0 * 1.25 = 10.0
    expect(expertTurn.calibratedScore).toBe(10.0);

    const easyTurn = report.explainableTranscript[1];
    expect(easyTurn.difficultyLevel).toBe('EASY');
    expect(easyTurn.difficultyWeight).toBe(0.85);
    // 8.0 * 0.85 = 6.8
    expect(easyTurn.calibratedScore).toBe(6.8);
  });
});

