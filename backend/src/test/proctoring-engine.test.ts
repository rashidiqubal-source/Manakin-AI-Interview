import {
  ProctoringCorrelationEngine,
  ProctoringEvent,
} from '../ai/evidence/proctoring-correlation-engine';
import { EvidenceProfileBuilder } from '../ai/evidence/evidence-profile-builder';

describe('Multi-Signal Proctoring Correlation Engine Suite', () => {
  const baseTime = 1700000000000;

  it('1. Correctly formats chronological timeline offsets and durations', () => {
    const events: ProctoringEvent[] = [
      {
        id: 'e1',
        sessionId: 'sess-1',
        type: 'TAB_HIDDEN',
        timestamp: baseTime + 45000, // 45 sec in
        durationMs: 2500,
        source: 'BROWSER',
        confidence: 1.0,
      },
      {
        id: 'e2',
        sessionId: 'sess-1',
        type: 'HEAD_TURN',
        timestamp: baseTime + 130000, // 2 min 10 sec in
        durationMs: 3200,
        source: 'MEDIAPIPE',
        confidence: 0.88,
        metadata: { direction: 'LEFT' },
      },
    ];

    const report = ProctoringCorrelationEngine.processSessionEvents({
      sessionId: 'sess-1',
      events,
      sessionStartTime: baseTime,
    });

    expect(report.timeline.length).toBe(2);
    expect(report.timeline[0].timeOffsetFormatted).toBe('00:45');
    expect(report.timeline[0].durationFormatted).toBe('for 2.5 sec');
    expect(report.timeline[1].timeOffsetFormatted).toBe('02:10');
    expect(report.timeline[1].displayLabel).toContain('Head oriented away from center');
  });

  it('2. Correlates Tab Hidden event prior to answer submission', () => {
    const tabHideTime = baseTime + 60000;
    const answerSubmissionTime = tabHideTime + 5000; // 5 seconds later

    const events: ProctoringEvent[] = [
      {
        id: 'e-tab',
        sessionId: 'sess-1',
        type: 'TAB_HIDDEN',
        timestamp: tabHideTime,
        durationMs: 3000,
        source: 'BROWSER',
        questionId: 'turn-2',
      },
    ];

    const messages = [
      {
        role: 'assistant',
        content: 'Explain database indexing tradeoffs.',
        createdAt: new Date(baseTime + 50000).toISOString(),
      },
      {
        role: 'user',
        content: 'B-trees accelerate lookups but incur write overhead during page splitting.',
        createdAt: new Date(answerSubmissionTime).toISOString(),
      },
    ];

    const report = ProctoringCorrelationEngine.processSessionEvents({
      sessionId: 'sess-1',
      events,
      messages,
      sessionStartTime: baseTime,
    });

    const correlatedTabObs = report.observations.find((o) =>
      o.title.includes('Tab Hidden Prior to Answer Submission')
    );
    expect(correlatedTabObs).toBeDefined();
    expect(correlatedTabObs?.requiresReview).toBe(true);
    expect(correlatedTabObs?.severity).toBe('MEDIUM');
    expect(correlatedTabObs?.relatedQuestionTurn).toBe('turn-2');
  });

  it('3. Correlates concurrent Gaze Away and Head Turn in close proximity', () => {
    const t = baseTime + 90000;
    const events: ProctoringEvent[] = [
      {
        id: 'gaze-1',
        sessionId: 'sess-1',
        type: 'GAZE_AWAY',
        timestamp: t,
        durationMs: 2000,
        source: 'MEDIAPIPE',
      },
      {
        id: 'head-1',
        sessionId: 'sess-1',
        type: 'HEAD_TURN',
        timestamp: t + 500, // 500ms apart
        durationMs: 2200,
        source: 'MEDIAPIPE',
        metadata: { yaw: 35 },
      },
    ];

    const report = ProctoringCorrelationEngine.processSessionEvents({
      sessionId: 'sess-1',
      events,
      sessionStartTime: baseTime,
    });

    const concurrentObs = report.observations.find((o) =>
      o.title.includes('Concurrent Sustained Gaze & Head Turn')
    );
    expect(concurrentObs).toBeDefined();
    // Non-punitive: natural thinking glance away is informational (requiresReview: false)
    expect(concurrentObs?.requiresReview).toBe(false);
  });

  it('4. Computes factual audit metrics without speculative cheating probabilities', () => {
    const events: ProctoringEvent[] = [
      {
        id: '1',
        sessionId: 'sess-clean',
        type: 'FULLSCREEN_EXIT',
        timestamp: baseTime + 10000,
        source: 'BROWSER',
      },
      {
        id: '2',
        sessionId: 'sess-clean',
        type: 'TAB_HIDDEN',
        timestamp: baseTime + 20000,
        durationMs: 1200,
        source: 'BROWSER',
      },
      {
        id: '3',
        sessionId: 'sess-clean',
        type: 'GAZE_AWAY',
        timestamp: baseTime + 40000,
        durationMs: 1900,
        source: 'MEDIAPIPE',
      },
    ];

    const report = ProctoringCorrelationEngine.processSessionEvents({
      sessionId: 'sess-clean',
      events,
      sessionStartTime: baseTime,
    });

    expect(report.summary.facePresenceConsistency).toContain('Consistent');
    expect(report.summary.tabVisibilityEvents).toBe(1);
    expect(report.summary.fullscreenExits).toBe(1);
    expect(report.summary.sustainedGazeAwayEvents).toBe(1);
    expect(report.summary.unauthorizedDeviceEvents).toBe(0);
    // Verified non-punitive phrasing
    expect(report.summary.factualOverview).not.toContain('cheating probability');
  });

  it('5. Integrates into EvidenceProfileBuilder.buildReport seamlessly', () => {
    const candidateReport = EvidenceProfileBuilder.buildReport({
      sessionId: 'sess-audit-full',
      candidateName: 'Jordan Vance',
      candidateEmail: 'jordan@example.com',
      jobTitle: 'Distributed Systems Engineer',
      overallRecommendation: 'PASS',
      totalScore: 9.0,
      messages: [
        {
          role: 'assistant',
          content: 'How do you prevent split-brain in distributed Raft consensus clusters?',
          createdAt: new Date(baseTime).toISOString(),
        },
        {
          role: 'user',
          content: 'Quorum majorities with election terms and monotonic log indexing.',
          silenceLatency: 2.3,
          createdAt: new Date(baseTime + 10000).toISOString(),
        },
      ],
      detectionEvents: [
        {
          id: 'dev-1',
          eventType: 'UNAUTHORIZED_DEVICE',
          objectClass: 'cell phone',
          confidence: 0.94,
          riskLevel: 'HIGH',
          timestamp: new Date(baseTime + 5000),
          durationMs: 1500,
          source: 'YOLO26',
        },
        {
          id: 'tab-1',
          eventType: 'TAB_HIDDEN',
          confidence: 1.0,
          riskLevel: 'MEDIUM',
          timestamp: new Date(baseTime + 8000),
          durationMs: 1100,
          source: 'BROWSER',
        },
      ],
    });

    expect(candidateReport.factualProctoringSummary).toBeDefined();
    expect(candidateReport.factualProctoringSummary.unauthorizedDeviceEvents).toBe(1);
    expect(candidateReport.factualProctoringSummary.tabVisibilityEvents).toBe(1);
    expect(candidateReport.proctoringTimeline).toBeDefined();
    expect(candidateReport.proctoringTimeline.length).toBe(2);
    expect(candidateReport.correlatedObservations).toBeDefined();
  });

  it('6. Correlates Code Paste Bursts and Unnatural Keystroke Cadence in editor', () => {
    const events: ProctoringEvent[] = [
      {
        id: 'paste-1',
        sessionId: 'sess-code-burst',
        type: 'CODE_PASTE_BURST',
        timestamp: baseTime + 1000,
        source: 'EDITOR_TELEMETRY',
        confidence: 1.0,
        metadata: {
          charCount: 280,
          lineCount: 14,
          elapsedMs: 80,
        },
      },
      {
        id: 'key-1',
        sessionId: 'sess-code-burst',
        type: 'UNNATURAL_KEYSTROKE_CADENCE',
        timestamp: baseTime + 4000,
        source: 'EDITOR_TELEMETRY',
        confidence: 0.95,
        metadata: {
          avgIkiMs: 8.5,
          sampleSize: 45,
        },
      },
    ];

    const report = ProctoringCorrelationEngine.processSessionEvents({
      sessionId: 'sess-code-burst',
      events,
      sessionStartTime: baseTime,
    });

    expect(report.summary.codePasteBursts).toBe(1);
    expect(report.summary.unnaturalKeystrokeEvents).toBe(1);
    expect(report.summary.reviewRecommended).toBe(true);

    const pasteObs = report.observations.find((o) => o.involvedEventTypes.includes('CODE_PASTE_BURST'));
    expect(pasteObs).toBeDefined();
    expect(pasteObs!.title).toContain('Bulk Code Paste');
    expect(pasteObs!.requiresReview).toBe(true);

    const keyObs = report.observations.find((o) => o.involvedEventTypes.includes('UNNATURAL_KEYSTROKE_CADENCE'));
    expect(keyObs).toBeDefined();
    expect(keyObs!.title).toContain('Synthetic / Macro');
  });
});
