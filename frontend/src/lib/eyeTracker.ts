/**
 * MediaPipe Face Landmarker 3D Eye & Gaze Tracking Engine
 * Tracks 478 3D landmarks + Iris landmarks (468-477) to compute:
 * - Gaze Direction & (X, Y) Coordinates
 * - Gaze Timeline (chronological on-screen vs away tracking)
 * - Scanpath (sequential gaze path coordinates)
 * - Away-From-Screen Duration (total seconds, % time, away episodes)
 * - Fixations (fixation clusters >= 150ms and mean fixation duration)
 */

export type GazeDirection = 'CENTER' | 'LOOKING_LEFT' | 'LOOKING_RIGHT' | 'LOOKING_UP' | 'LOOKING_DOWN' | 'AWAY_FROM_SCREEN';

export interface CheatingPatternAlert {
  type: 'OFFSCREEN_READING_PATTERN' | 'CONCEALED_PHONE_GAZE' | 'REPEATED_CORNER_GLANCES';
  description: string;
  confidence: number;
  points: number;
  timestamp: number;
}

export interface GazePoint {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  timestamp: number; // ms
  elapsedSec: number;
  direction: GazeDirection;
  isAway: boolean;
}

export interface AwayEpisode {
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface Fixation {
  x: number;
  y: number;
  durationMs: number;
  timestamp: number;
}

export interface EyeTrackingTelemetry {
  gazeTimeline: GazePoint[];
  scanpath: Array<{ x: number; y: number; timestamp: number }>;
  awayDurationSec: number;
  awayPercentage: number;
  awayEpisodes: AwayEpisode[];
  totalFixations: number;
  averageFixationDurationMs: number;
  fixations: Fixation[];
}

// Suppress benign WASM / XNNPACK initialization banner from triggering Next.js Console Error overlay
if (typeof window !== 'undefined' && !(window as any).__mp_error_filtered) {
  (window as any).__mp_error_filtered = true;
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (
      firstArg.includes('XNNPACK delegate for CPU') ||
      firstArg.includes('Created TensorFlow Lite') ||
      firstArg.includes('INFO: Created')
    ) {
      console.info(...args);
      return;
    }
    originalError.apply(console, args);
  };
}

export class EyeTracker {
  private landmarker: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private timeline: GazePoint[] = [];
  private scanpath: Array<{ x: number; y: number; timestamp: number }> = [];
  private fixations: Fixation[] = [];
  private awayEpisodes: AwayEpisode[] = [];
  private currentAwayStart: number | null = null;
  private sessionStartTime: number = Date.now();
  private lastSampleTime = 0;
  private lastVideoTime = 0;

  // Fixation detection accumulator
  private currentFixationAnchor: { x: number; y: number; startTime: number } | null = null;

  // Cheating Pattern Detection Engine
  private downwardGazeStart: number | null = null;
  private readingSaccadeCounter: number = 0;
  private recentGlanceTimestamps: number[] = [];
  private lastAlertTimes: Record<string, number> = {};
  private pendingCheatingAlert: CheatingPatternAlert | null = null;
  private latestGazePoint: GazePoint | null = null;

  // Latest MediaPipe 3D face landmarks
  public latestLandmarks: any[] | null = null;
  public onLandmarks?: (landmarks: any[] | null) => void;

  /**
   * Initializes MediaPipe FaceLandmarker via WebAssembly & WebGL GPU delegate.
   */
  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.isInitialized) return true;
    if (this.initPromise) {
      await this.initPromise;
      return this.isInitialized;
    }

    this.initPromise = (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        this.isInitialized = true;
        this.sessionStartTime = Date.now();
      } catch (err: any) {
        console.warn('[EyeTracker] MediaPipe FaceLandmarker initialization fallback:', err?.message || err);
        this.isInitialized = false;
      }
    })();

    await this.initPromise;
    return this.isInitialized;
  }

  /**
   * Processes an HTMLVideoElement frame and updates gaze telemetry.
   */
  processFrame(video: HTMLVideoElement): GazePoint | null {
    if (!video || video.readyState < 2) return null;

    const now = performance.now();
    if (now <= this.lastVideoTime) {
      return null;
    }
    this.lastVideoTime = now;

    const elapsedSec = Math.max(0, Math.round(((Date.now() - this.sessionStartTime) / 1000) * 10) / 10);

    // Throttle sampling to ~5 Hz (every 200ms) for timeline efficiency
    const shouldRecordTimeline = Date.now() - this.lastSampleTime >= 200;

    let gazePoint: GazePoint;

    if (this.isInitialized && this.landmarker) {
      try {
        const results = this.landmarker.detectForVideo(video, now);

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          this.latestLandmarks = landmarks;
          if (this.onLandmarks) this.onLandmarks(landmarks);

          // Iris landmarks
          const leftIris = landmarks[468] || { x: 0.5, y: 0.5 };
          const rightIris = landmarks[473] || { x: 0.5, y: 0.5 };

          // Eye corners
          const leftEyeOuter = landmarks[33] || { x: 0.4, y: 0.5 };
          const leftEyeInner = landmarks[133] || { x: 0.45, y: 0.5 };
          const rightEyeInner = landmarks[362] || { x: 0.55, y: 0.5 };
          const rightEyeOuter = landmarks[263] || { x: 0.6, y: 0.5 };

          // Horizontal ratio: position of left iris between outer and inner corner
          const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x) || 0.05;
          const leftH = (leftIris.x - leftEyeOuter.x) / leftEyeWidth;

          // Vertical ratio
          const leftEyeUpper = landmarks[159] || { y: 0.45 };
          const leftEyeLower = landmarks[145] || { y: 0.55 };
          const leftEyeHeight = Math.abs(leftEyeLower.y - leftEyeUpper.y) || 0.03;
          const leftV = (leftIris.y - leftEyeUpper.y) / leftEyeHeight;

          // Calculate normalized gaze (0 to 1) on screen
          const gazeX = Math.min(1, Math.max(0, 0.5 + (leftH - 0.5) * 1.8));
          const gazeY = Math.min(1, Math.max(0, 0.5 + (leftV - 0.5) * 1.8));

          // Determine direction
          let direction: GazeDirection = 'CENTER';
          const isAway = gazeX < 0.1 || gazeX > 0.9 || gazeY < 0.1 || gazeY > 0.95;

          if (isAway) {
            direction = 'AWAY_FROM_SCREEN';
          } else if (gazeX < 0.35) {
            direction = 'LOOKING_LEFT';
          } else if (gazeX > 0.65) {
            direction = 'LOOKING_RIGHT';
          } else if (gazeY < 0.3) {
            direction = 'LOOKING_UP';
          } else if (gazeY > 0.7) {
            direction = 'LOOKING_DOWN';
          } else {
            direction = 'CENTER';
          }

          gazePoint = {
            x: Math.round(gazeX * 1000) / 1000,
            y: Math.round(gazeY * 1000) / 1000,
            timestamp: now,
            elapsedSec,
            direction,
            isAway,
          };
        } else {
          // No face detected -> Looking Away
          this.latestLandmarks = null;
          if (this.onLandmarks) this.onLandmarks(null);
          gazePoint = {
            x: 0.5,
            y: 0.5,
            timestamp: now,
            elapsedSec,
            direction: 'AWAY_FROM_SCREEN',
            isAway: true,
          };
        }
      } catch {
        this.latestLandmarks = null;
        if (this.onLandmarks) this.onLandmarks(null);
        gazePoint = {
          x: 0.5,
          y: 0.5,
          timestamp: now,
          elapsedSec,
          direction: 'CENTER',
          isAway: false,
        };
      }
    } else {
      // Fallback if MediaPipe model is still downloading
      gazePoint = {
        x: 0.5,
        y: 0.5,
        timestamp: now,
        elapsedSec,
        direction: 'CENTER',
        isAway: false,
      };
    }

    // Update Away Episodes
    if (gazePoint.isAway) {
      if (this.currentAwayStart === null) {
        this.currentAwayStart = elapsedSec;
      }
    } else {
      if (this.currentAwayStart !== null) {
        const dur = Math.round((elapsedSec - this.currentAwayStart) * 10) / 10;
        if (dur >= 0.5) {
          this.awayEpisodes.push({
            startSec: this.currentAwayStart,
            endSec: elapsedSec,
            durationSec: dur,
          });
        }
        this.currentAwayStart = null;
      }
    }

    // Fixation Detection (Velocity/Dispersion Threshold)
    if (!gazePoint.isAway) {
      if (!this.currentFixationAnchor) {
        this.currentFixationAnchor = { x: gazePoint.x, y: gazePoint.y, startTime: now };
      } else {
        const dx = gazePoint.x - this.currentFixationAnchor.x;
        const dy = gazePoint.y - this.currentFixationAnchor.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.08) {
          // Gaze moved -> conclude previous fixation if duration >= 150ms
          const fixDur = now - this.currentFixationAnchor.startTime;
          if (fixDur >= 150) {
            this.fixations.push({
              x: this.currentFixationAnchor.x,
              y: this.currentFixationAnchor.y,
              durationMs: fixDur,
              timestamp: this.currentFixationAnchor.startTime,
            });
          }
          this.currentFixationAnchor = { x: gazePoint.x, y: gazePoint.y, startTime: now };
        }
      }
    }

    if (shouldRecordTimeline) {
      this.lastSampleTime = now;
      this.timeline.push(gazePoint);
      this.scanpath.push({ x: gazePoint.x, y: gazePoint.y, timestamp: now });
    }

    this.latestGazePoint = gazePoint;
    this.evaluateCheatingPatterns(gazePoint, now);

    return gazePoint;
  }

  private evaluateCheatingPatterns(gaze: GazePoint, now: number) {
    // 1. Concealed Phone / Notes Downward Gaze Pattern (> 3.5s sustained)
    if (gaze.direction === 'LOOKING_DOWN' || gaze.y > 0.72) {
      if (this.downwardGazeStart === null) {
        this.downwardGazeStart = now;
      } else if (now - this.downwardGazeStart >= 3500) {
        this.triggerPattern(
          'CONCEALED_PHONE_GAZE',
          'Sustained downward gaze (>3.5s) — possible concealed phone or paper notes',
          0.90,
          2,
          now
        );
      }
    } else {
      this.downwardGazeStart = null;
    }

    // 2. Off-Screen Reading Pattern (rhythmic horizontal saccades while looking off-center)
    const isOffCenter = gaze.x < 0.35 || gaze.x > 0.65;
    if (isOffCenter && this.scanpath.length >= 2) {
      const lastPt = this.scanpath[this.scanpath.length - 1];
      const prevPt = this.scanpath[this.scanpath.length - 2];
      const dx = Math.abs(lastPt.x - prevPt.x);
      const dy = Math.abs(lastPt.y - prevPt.y);
      if (dx > 0.03 && dy < 0.08) {
        this.readingSaccadeCounter += 1;
        if (this.readingSaccadeCounter >= 4) {
          this.triggerPattern(
            'OFFSCREEN_READING_PATTERN',
            'Off-screen reading saccades detected — candidate reading text from secondary display or notes',
            0.92,
            2,
            now
          );
        }
      }
    } else if (gaze.direction === 'CENTER') {
      this.readingSaccadeCounter = Math.max(0, this.readingSaccadeCounter - 1);
    }

    // 3. Repeated Corner Glances (glancing to off-screen target >=4 times in 25s)
    if (gaze.direction === 'LOOKING_LEFT' || gaze.direction === 'LOOKING_RIGHT' || gaze.direction === 'AWAY_FROM_SCREEN') {
      const lastGlance = this.recentGlanceTimestamps[this.recentGlanceTimestamps.length - 1];
      if (!lastGlance || now - lastGlance > 1200) {
        this.recentGlanceTimestamps.push(now);
      }
      this.recentGlanceTimestamps = this.recentGlanceTimestamps.filter((t) => now - t <= 25000);
      if (this.recentGlanceTimestamps.length >= 4) {
        this.triggerPattern(
          'REPEATED_CORNER_GLANCES',
          'Repeated off-camera glances (≥4 in 25s) — recurrent visual focus at off-screen target',
          0.85,
          2,
          now
        );
      }
    }
  }

  private triggerPattern(
    type: 'OFFSCREEN_READING_PATTERN' | 'CONCEALED_PHONE_GAZE' | 'REPEATED_CORNER_GLANCES',
    description: string,
    confidence: number,
    points: number,
    now: number
  ) {
    const lastAlert = this.lastAlertTimes[type] || 0;
    if (now - lastAlert < 12000) return;

    this.lastAlertTimes[type] = now;
    this.pendingCheatingAlert = {
      type,
      description,
      confidence,
      points,
      timestamp: now,
    };
  }

  public consumePendingPatternAlert(): CheatingPatternAlert | null {
    const alert = this.pendingCheatingAlert;
    this.pendingCheatingAlert = null;
    return alert;
  }

  public getLiveStatus() {
    const now = performance.now();
    const downwardDwell = this.downwardGazeStart ? Math.round(((now - this.downwardGazeStart) / 1000) * 10) / 10 : 0;
    return {
      direction: this.latestGazePoint?.direction || 'CENTER',
      gazeX: this.latestGazePoint?.x ?? 0.5,
      gazeY: this.latestGazePoint?.y ?? 0.5,
      isAway: this.latestGazePoint?.isAway ?? false,
      downwardDwellSec: downwardDwell,
      readingSaccades: this.readingSaccadeCounter,
      recentGlancesCount: this.recentGlanceTimestamps.length,
      hasPendingAlert: !!this.pendingCheatingAlert,
    };
  }

  /**
   * Compiles the full Eye Tracking Telemetry summary.
   */
  getTelemetry(): EyeTrackingTelemetry {
    const totalDurationSec = Math.max(1, (Date.now() - this.sessionStartTime) / 1000);

    // Compute total away duration
    let totalAwaySec = this.awayEpisodes.reduce((acc, ep) => acc + ep.durationSec, 0);
    if (this.currentAwayStart !== null) {
      const ongoing = Math.max(0, (Date.now() - this.sessionStartTime) / 1000 - this.currentAwayStart);
      totalAwaySec += ongoing;
    }

    const awayDurationSec = Math.round(totalAwaySec * 10) / 10;
    const awayPercentage = Math.min(100, Math.round((awayDurationSec / totalDurationSec) * 100));

    // Fixations summary
    const totalFixations = this.fixations.length;
    const avgDuration = totalFixations > 0
      ? Math.round(this.fixations.reduce((acc, f) => acc + f.durationMs, 0) / totalFixations)
      : 280; // default human fixation average ~250-300ms

    return {
      gazeTimeline: this.timeline.slice(-300), // keep latest 300 samples for UI rendering
      scanpath: this.scanpath.slice(-150),
      awayDurationSec,
      awayPercentage,
      awayEpisodes: this.awayEpisodes,
      totalFixations,
      averageFixationDurationMs: avgDuration,
      fixations: this.fixations.slice(-50),
    };
  }

  reset() {
    this.timeline = [];
    this.scanpath = [];
    this.fixations = [];
    this.awayEpisodes = [];
    this.currentAwayStart = null;
    this.sessionStartTime = Date.now();
    this.lastSampleTime = 0;
    this.currentFixationAnchor = null;
  }
}

export const eyeTracker = new EyeTracker();
