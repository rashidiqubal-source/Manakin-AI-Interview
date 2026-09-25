/**
 * Multi-Signal Evidence-Based Proctoring Engine (Client-Side)
 * Collects objective telemetry from MediaPipe Face Landmarker, Web Audio API,
 * and standard browser environment APIs without intrusive OS-level hooks.
 *
 * Adheres strictly to Non-Punitive Evidence Principles:
 * - Emits factual observations, NOT cheating labels.
 * - Temporal hysteresis prevents momentary natural blinks/glances from triggering flags.
 * - Respects candidate privacy (no OS process snooping, no personal file access).
 */

import { Socket } from 'socket.io-client';

export type ProctoringEventType =
  | 'FACE_MISSING'
  | 'MULTIPLE_FACES'
  | 'FACE_IDENTITY_CHANGE'
  | 'HEAD_TURN'
  | 'GAZE_AWAY'
  | 'EYES_CLOSED'
  | 'CAMERA_OBSTRUCTED'
  | 'FULLSCREEN_EXIT'
  | 'TAB_HIDDEN'
  | 'WINDOW_BLUR'
  | 'SCREEN_SHARE_STOPPED'
  | 'MIC_DISABLED'
  | 'AUDIO_ANOMALY'
  | 'RAPID_FOCUS_CHANGE'
  | 'CLIPBOARD_ACTIVITY'
  | 'UNAUTHORIZED_DEVICE'
  | 'SUSPICIOUS_OBJECT'
  | 'UNKNOWN';

export interface ProctoringSignalPayload {
  sessionId: string;
  type: ProctoringEventType;
  durationMs?: number;
  source: 'YOLO' | 'MEDIAPIPE' | 'BROWSER' | 'AUDIO';
  confidence?: number;
  questionId?: string;
  answerId?: string;
  metadata?: Record<string, any>;
}

export interface HeadPoseEstimation {
  yaw: number; // degrees approx (-90 to +90)
  pitch: number; // degrees approx (-90 to +90)
  roll: number; // degrees approx (-90 to +90)
  direction: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
  isTurned: boolean;
}

export interface FaceIdentityAnchor {
  eyeToChinRatio: number;
  mouthToEyeRatio: number;
  calibrated: boolean;
  sampleCount: number;
}

class ProctoringEngine {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private getCurrentTurn: (() => number | string) | null = null;
  private isRunning = false;

  // --- Head Pose Hysteresis ---
  private headTurnStartTime: number | null = null;
  private lastHeadDirection: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' = 'CENTER';
  private headTurnDispatched = false;
  private readonly HEAD_TURN_THRESHOLD_MS = 1500; // >= 1.5s sustained

  // --- Eye Closure / EAR Hysteresis ---
  private eyeClosedStartTime: number | null = null;
  private eyeClosedDispatched = false;
  private readonly EYE_CLOSED_THRESHOLD_MS = 2000; // >= 2.0s sustained (filters normal 150-300ms blinks)
  private readonly EAR_CLOSED_THRESHOLD = 0.16;

  // --- Gaze Away Hysteresis ---
  private gazeAwayStartTime: number | null = null;
  private gazeAwayDispatched = false;
  private lastGazeDirection = 'CENTER';
  private readonly GAZE_AWAY_THRESHOLD_MS = 1800; // >= 1.8s sustained

  // --- Face Absence Hysteresis ---
  private faceAbsenceStartTime: number | null = null;
  private faceAbsenceDispatched = false;
  private readonly FACE_ABSENCE_THRESHOLD_MS = 1000; // >= 1.0s sustained

  // --- Face Identity Anchor ---
  private identityAnchor: FaceIdentityAnchor = {
    eyeToChinRatio: 0,
    mouthToEyeRatio: 0,
    calibrated: false,
    sampleCount: 0,
  };
  private identityDiscrepancyStart: number | null = null;
  private identityDiscrepancyDispatched = false;

  // --- Camera Obstruction / Darkness ---
  private cameraObstructedStart: number | null = null;
  private cameraObstructedDispatched = false;
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;

  // --- Browser Focus & Visibility ---
  private tabHiddenStartTime: number | null = null;
  private windowBlurStartTime: number | null = null;
  private recentBlurTimestamps: number[] = [];

  // --- Audio Anomaly in Silence Deliberation ---
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private isMonitoringSilence = false;
  private silenceAnomalyStart: number | null = null;
  private silenceAnomalyDispatched = false;
  private baselineNoiseEnergy = 0.02;
  private audioMonitorInterval: any = null;

  /**
   * Initializes and starts proctoring sensors and browser listeners.
   */
  public start(params: {
    socket: Socket;
    sessionId: string;
    getCurrentTurn?: () => number | string;
  }) {
    this.socket = params.socket;
    this.sessionId = params.sessionId;
    this.getCurrentTurn = params.getCurrentTurn || null;
    this.isRunning = true;

    if (typeof window !== 'undefined') {
      this.attachBrowserListeners();
    }
  }

  /**
   * Stops proctoring and detaches listeners.
   */
  public stop() {
    this.isRunning = false;
    this.detachBrowserListeners();
    this.stopSilenceAudioMonitoring();
    this.resetState();
  }

  /**
   * Updates active session id
   */
  public setSessionId(id: string) {
    this.sessionId = id;
  }

  // -------------------------------------------------------------
  // 1. MEDIAPIPE LANDMARK PROCESSING (Head Pose, EAR, Identity)
  // -------------------------------------------------------------

  /**
   * Evaluates MediaPipe 478 face landmarks at ~10-15 FPS.
   */
  public processLandmarks(landmarks: any[] | null | undefined, videoElement?: HTMLVideoElement | null) {
    if (!this.isRunning || !this.socket || !this.sessionId) return;

    const now = Date.now();

    // 1. Face Absence Detection
    if (!landmarks || landmarks.length === 0) {
      if (this.faceAbsenceStartTime === null) {
        this.faceAbsenceStartTime = now;
      } else if (now - this.faceAbsenceStartTime >= this.FACE_ABSENCE_THRESHOLD_MS && !this.faceAbsenceDispatched) {
        this.faceAbsenceDispatched = true;
        this.emitEvent({
          type: 'FACE_MISSING',
          durationMs: now - this.faceAbsenceStartTime,
          source: 'MEDIAPIPE',
          confidence: 0.95,
        });
      }
      // Reset active face states
      this.resetHeadTurn(now);
      this.resetEyeClosed(now);
      return;
    }

    // Face is present -> reset absence
    if (this.faceAbsenceStartTime !== null) {
      const absenceDuration = now - this.faceAbsenceStartTime;
      if (this.faceAbsenceDispatched) {
        // Log return of face
        this.emitEvent({
          type: 'FACE_MISSING',
          durationMs: absenceDuration,
          source: 'MEDIAPIPE',
          confidence: 0.95,
          metadata: { note: 'Face returned to frame' },
        });
      }
      this.faceAbsenceStartTime = null;
      this.faceAbsenceDispatched = false;
    }

    // 2. Camera Obstruction Check (Average Luminance)
    if (videoElement) {
      this.checkCameraObstruction(videoElement, now);
    }

    // 3. Head Pose Estimation
    const headPose = this.estimateHeadPose(landmarks);
    this.evaluateHeadPoseHysteresis(headPose, now);

    // 4. Eye Aspect Ratio (EAR) & Eye Closure
    const ear = this.calculateEAR(landmarks);
    this.evaluateEyeClosureHysteresis(ear, now);

    // 5. Face Identity Consistency (Geometric Landmark Ratios)
    this.evaluateFaceIdentity(landmarks, now);
  }

  /**
   * Estimates head yaw, pitch, and roll geometrically from key 3D landmarks:
   * #1 Nose tip, #152 Chin, #33 Left eye corner, #263 Right eye corner, #61 Mouth left, #291 Mouth right
   */
  public estimateHeadPose(landmarks: any[]): HeadPoseEstimation {
    const nose = landmarks[1] || { x: 0.5, y: 0.5, z: 0 };
    const chin = landmarks[152] || { x: 0.5, y: 0.8, z: 0 };
    const leftEye = landmarks[33] || { x: 0.4, y: 0.4, z: 0 };
    const rightEye = landmarks[263] || { x: 0.6, y: 0.4, z: 0 };

    // Yaw calculation (horizontal nose displacement relative to eye corners)
    const dLeft = Math.abs(nose.x - leftEye.x);
    const dRight = Math.abs(rightEye.x - nose.x);
    const eyeSpan = Math.abs(rightEye.x - leftEye.x) || 0.001;
    const yawRatio = (dRight - dLeft) / eyeSpan;
    const yawDeg = Math.round(yawRatio * 75); // approx +/- 60-75 degrees

    // Pitch calculation (vertical nose position relative to eye-chin axis)
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const faceHeight = Math.abs(chin.y - eyeMidY) || 0.001;
    const pitchRatio = (nose.y - eyeMidY) / faceHeight; // normal ~ 0.35 to 0.45
    const pitchDeg = Math.round((pitchRatio - 0.4) * 100);

    // Roll calculation
    const dEyeX = rightEye.x - leftEye.x;
    const dEyeY = rightEye.y - leftEye.y;
    const rollDeg = Math.round((Math.atan2(dEyeY, dEyeX) * 180) / Math.PI);

    let direction: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' = 'CENTER';
    let isTurned = false;

    if (yawDeg > 25) {
      direction = 'LEFT'; // mirrored camera perspective
      isTurned = true;
    } else if (yawDeg < -25) {
      direction = 'RIGHT';
      isTurned = true;
    } else if (pitchDeg < -20) {
      direction = 'UP';
      isTurned = true;
    } else if (pitchDeg > 25) {
      direction = 'DOWN';
      isTurned = true;
    }

    return {
      yaw: yawDeg,
      pitch: pitchDeg,
      roll: rollDeg,
      direction,
      isTurned,
    };
  }

  private evaluateHeadPoseHysteresis(headPose: HeadPoseEstimation, now: number) {
    if (headPose.isTurned) {
      if (this.headTurnStartTime === null) {
        this.headTurnStartTime = now;
        this.lastHeadDirection = headPose.direction;
      } else if (now - this.headTurnStartTime >= this.HEAD_TURN_THRESHOLD_MS && !this.headTurnDispatched) {
        this.headTurnDispatched = true;
        this.emitEvent({
          type: 'HEAD_TURN',
          durationMs: now - this.headTurnStartTime,
          source: 'MEDIAPIPE',
          confidence: 0.88,
          metadata: {
            direction: headPose.direction,
            yaw: headPose.yaw,
            pitch: headPose.pitch,
            roll: headPose.roll,
          },
        });
      }
    } else {
      this.resetHeadTurn(now);
    }
  }

  private resetHeadTurn(now: number) {
    if (this.headTurnStartTime !== null && this.headTurnDispatched) {
      const totalDur = now - this.headTurnStartTime;
      this.emitEvent({
        type: 'HEAD_TURN',
        durationMs: totalDur,
        source: 'MEDIAPIPE',
        confidence: 0.88,
        metadata: {
          direction: this.lastHeadDirection,
          action: 'RETURNED_TO_CENTER',
        },
      });
    }
    this.headTurnStartTime = null;
    this.headTurnDispatched = false;
  }

  /**
   * Calculates Eye Aspect Ratio (EAR) for both eyes.
   * EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
   */
  public calculateEAR(landmarks: any[]): number {
    const dist = (i1: number, i2: number) => {
      const p1 = landmarks[i1] || { x: 0, y: 0 };
      const p2 = landmarks[i2] || { x: 0, y: 0 };
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Left eye: 33 (outer), 160 (upper-outer), 158 (upper-inner), 133 (inner), 153 (lower-inner), 144 (lower-outer)
    const leftD1 = dist(160, 144);
    const leftD2 = dist(158, 153);
    const leftD3 = dist(33, 133);
    const leftEar = leftD3 > 0 ? (leftD1 + leftD2) / (2 * leftD3) : 0.28;

    // Right eye: 362 (inner), 385 (upper-inner), 387 (upper-outer), 263 (outer), 373 (lower-outer), 380 (lower-inner)
    const rightD1 = dist(385, 380);
    const rightD2 = dist(387, 373);
    const rightD3 = dist(362, 263);
    const rightEar = rightD3 > 0 ? (rightD1 + rightD2) / (2 * rightD3) : 0.28;

    return (leftEar + rightEar) / 2;
  }

  private evaluateEyeClosureHysteresis(ear: number, now: number) {
    if (ear < this.EAR_CLOSED_THRESHOLD) {
      if (this.eyeClosedStartTime === null) {
        this.eyeClosedStartTime = now;
      } else if (now - this.eyeClosedStartTime >= this.EYE_CLOSED_THRESHOLD_MS && !this.eyeClosedDispatched) {
        this.eyeClosedDispatched = true;
        this.emitEvent({
          type: 'EYES_CLOSED',
          durationMs: now - this.eyeClosedStartTime,
          source: 'MEDIAPIPE',
          confidence: 0.85,
          metadata: { ear: Math.round(ear * 100) / 100 },
        });
      }
    } else {
      this.resetEyeClosed(now);
    }
  }

  private resetEyeClosed(now: number) {
    if (this.eyeClosedStartTime !== null && this.eyeClosedDispatched) {
      const dur = now - this.eyeClosedStartTime;
      this.emitEvent({
        type: 'EYES_CLOSED',
        durationMs: dur,
        source: 'MEDIAPIPE',
        confidence: 0.85,
        metadata: { action: 'EYES_OPENED' },
      });
    }
    this.eyeClosedStartTime = null;
    this.eyeClosedDispatched = false;
  }

  /**
   * Face Identity Geometric Landmark Anchor Consistency.
   * Compares eye-to-chin and mouth-to-eye proportions against calibrated baseline.
   */
  private evaluateFaceIdentity(landmarks: any[], now: number) {
    const leftEye = landmarks[33] || { x: 0.4, y: 0.4 };
    const rightEye = landmarks[263] || { x: 0.6, y: 0.4 };
    const chin = landmarks[152] || { x: 0.5, y: 0.8 };
    const mouthLeft = landmarks[61] || { x: 0.45, y: 0.7 };
    const mouthRight = landmarks[291] || { x: 0.55, y: 0.7 };

    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const eyeMid = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const faceLength = Math.hypot(chin.x - eyeMid.x, chin.y - eyeMid.y);
    const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);

    if (faceLength === 0 || eyeDist === 0) return;

    const eyeToChinRatio = eyeDist / faceLength;
    const mouthToEyeRatio = mouthWidth / eyeDist;

    // Calibration during initial stable frames (first 30 samples)
    if (!this.identityAnchor.calibrated) {
      this.identityAnchor.eyeToChinRatio =
        (this.identityAnchor.eyeToChinRatio * this.identityAnchor.sampleCount + eyeToChinRatio) /
        (this.identityAnchor.sampleCount + 1);
      this.identityAnchor.mouthToEyeRatio =
        (this.identityAnchor.mouthToEyeRatio * this.identityAnchor.sampleCount + mouthToEyeRatio) /
        (this.identityAnchor.sampleCount + 1);
      this.identityAnchor.sampleCount++;

      if (this.identityAnchor.sampleCount >= 25) {
        this.identityAnchor.calibrated = true;
      }
      return;
    }

    // Compute relative variance from baseline
    const varRatio1 = Math.abs(eyeToChinRatio - this.identityAnchor.eyeToChinRatio) / this.identityAnchor.eyeToChinRatio;
    const varRatio2 = Math.abs(mouthToEyeRatio - this.identityAnchor.mouthToEyeRatio) / this.identityAnchor.mouthToEyeRatio;
    const totalVariance = (varRatio1 + varRatio2) / 2;

    // Significant structural shift (> 38% variance sustained for >= 3s)
    if (totalVariance > 0.38) {
      if (this.identityDiscrepancyStart === null) {
        this.identityDiscrepancyStart = now;
      } else if (now - this.identityDiscrepancyStart >= 3000 && !this.identityDiscrepancyDispatched) {
        this.identityDiscrepancyDispatched = true;
        this.emitEvent({
          type: 'FACE_IDENTITY_CHANGE',
          durationMs: now - this.identityDiscrepancyStart,
          source: 'MEDIAPIPE',
          confidence: 0.82,
          metadata: {
            variancePercentage: Math.round(totalVariance * 100),
            note: 'Facial geometric proportions shifted from baseline',
          },
        });
      }
    } else {
      this.identityDiscrepancyStart = null;
      this.identityDiscrepancyDispatched = false;
    }
  }

  /**
   * Samples video frame luminance to detect camera covers, physical tape, or extreme darkness.
   */
  private checkCameraObstruction(video: HTMLVideoElement, now: number) {
    if (!video || video.videoWidth === 0) return;

    if (!this.sampleCanvas) {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = 16;
      this.sampleCanvas.height = 16;
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!this.sampleCtx) return;

    try {
      this.sampleCtx.drawImage(video, 0, 0, 16, 16);
      const imgData = this.sampleCtx.getImageData(0, 0, 16, 16).data;
      let totalLuminance = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        totalLuminance += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
      }
      const avgLuminance = totalLuminance / (imgData.length / 4);

      // Blackout threshold (luminance < 10 out of 255)
      if (avgLuminance < 10) {
        if (this.cameraObstructedStart === null) {
          this.cameraObstructedStart = now;
        } else if (now - this.cameraObstructedStart >= 2500 && !this.cameraObstructedDispatched) {
          this.cameraObstructedDispatched = true;
          this.emitEvent({
            type: 'CAMERA_OBSTRUCTED',
            durationMs: now - this.cameraObstructedStart,
            source: 'MEDIAPIPE',
            confidence: 0.95,
            metadata: { avgLuminance: Math.round(avgLuminance) },
          });
        }
      } else {
        if (this.cameraObstructedStart !== null && this.cameraObstructedDispatched) {
          this.emitEvent({
            type: 'CAMERA_OBSTRUCTED',
            durationMs: now - this.cameraObstructedStart,
            source: 'MEDIAPIPE',
            confidence: 0.95,
            metadata: { action: 'FEED_RESTORED' },
          });
        }
        this.cameraObstructedStart = null;
        this.cameraObstructedDispatched = false;
      }
    } catch {
      // ignore cross-origin or canvas read errors
    }
  }

  // -------------------------------------------------------------
  // 2. GAZE AWAY TRACKING (from EyeTracker)
  // -------------------------------------------------------------

  public reportGaze(direction: string, isAway: boolean) {
    if (!this.isRunning) return;
    const now = Date.now();

    if (isAway || direction === 'AWAY_FROM_SCREEN') {
      if (this.gazeAwayStartTime === null) {
        this.gazeAwayStartTime = now;
        this.lastGazeDirection = direction;
      } else if (now - this.gazeAwayStartTime >= this.GAZE_AWAY_THRESHOLD_MS && !this.gazeAwayDispatched) {
        this.gazeAwayDispatched = true;
        this.emitEvent({
          type: 'GAZE_AWAY',
          durationMs: now - this.gazeAwayStartTime,
          source: 'MEDIAPIPE',
          confidence: 0.85,
          metadata: { direction },
        });
      }
    } else {
      if (this.gazeAwayStartTime !== null && this.gazeAwayDispatched) {
        this.emitEvent({
          type: 'GAZE_AWAY',
          durationMs: now - this.gazeAwayStartTime,
          source: 'MEDIAPIPE',
          confidence: 0.85,
          metadata: { direction: this.lastGazeDirection, action: 'RETURNED_TO_CENTER' },
        });
      }
      this.gazeAwayStartTime = null;
      this.gazeAwayDispatched = false;
    }
  }

  // -------------------------------------------------------------
  // 3. BROWSER ENVIRONMENT LISTENERS
  // -------------------------------------------------------------

  private attachBrowserListeners() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    window.addEventListener('paste', this.handlePaste);
  }

  private detachBrowserListeners() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    window.removeEventListener('paste', this.handlePaste);
  }

  private handleVisibilityChange = () => {
    const now = Date.now();
    if (document.hidden) {
      this.tabHiddenStartTime = now;
    } else {
      if (this.tabHiddenStartTime !== null) {
        const durationMs = now - this.tabHiddenStartTime;
        if (durationMs >= 600) {
          this.emitEvent({
            type: 'TAB_HIDDEN',
            durationMs,
            source: 'BROWSER',
            confidence: 1.0,
            metadata: { visibilityState: 'hidden' },
          });
        }
        this.tabHiddenStartTime = null;
      }
    }
  };

  private handleWindowBlur = () => {
    const now = Date.now();
    this.windowBlurStartTime = now;

    // Track frequency of rapid focus transitions
    this.recentBlurTimestamps.push(now);
    this.recentBlurTimestamps = this.recentBlurTimestamps.filter((t) => now - t <= 12000);

    if (this.recentBlurTimestamps.length >= 3) {
      this.emitEvent({
        type: 'RAPID_FOCUS_CHANGE',
        source: 'BROWSER',
        confidence: 0.9,
        metadata: { blurCountIn12s: this.recentBlurTimestamps.length },
      });
      this.recentBlurTimestamps = [];
    }
  };

  private handleWindowFocus = () => {
    const now = Date.now();
    if (this.windowBlurStartTime !== null) {
      const durationMs = now - this.windowBlurStartTime;
      // Only report if tab was not already reported as hidden (avoid duplicate noise)
      if (durationMs >= 1000 && !this.tabHiddenStartTime) {
        this.emitEvent({
          type: 'WINDOW_BLUR',
          durationMs,
          source: 'BROWSER',
          confidence: 0.95,
        });
      }
      this.windowBlurStartTime = null;
    }
  };

  private handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      this.emitEvent({
        type: 'FULLSCREEN_EXIT',
        source: 'BROWSER',
        confidence: 1.0,
      });
    }
  };

  private handlePaste = () => {
    this.emitEvent({
      type: 'CLIPBOARD_ACTIVITY',
      source: 'BROWSER',
      confidence: 1.0,
      metadata: { action: 'PASTE_DETECTED' },
    });
  };

  // -------------------------------------------------------------
  // 4. AUDIO ANOMALY DETECTION (During Thinking Silence)
  // -------------------------------------------------------------

  /**
   * Starts monitoring acoustic energy during candidate's post-question thinking silence.
   */
  public startSilenceAudioMonitoring(stream: MediaStream) {
    if (!stream || this.isMonitoringSilence) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      this.audioSource = this.audioContext.createMediaStreamSource(stream);
      this.audioSource.connect(this.audioAnalyser);

      this.isMonitoringSilence = true;
      this.silenceAnomalyStart = null;
      this.silenceAnomalyDispatched = false;

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.audioMonitorInterval = setInterval(() => {
        if (!this.isMonitoringSilence || !this.audioAnalyser) return;

        this.audioAnalyser.getByteFrequencyData(dataArray);

        // Compute RMS energy
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength) / 255;
        const now = Date.now();

        // Energy spike above background threshold (0.15) while candidate is supposed to be silent
        if (rms > 0.16) {
          if (this.silenceAnomalyStart === null) {
            this.silenceAnomalyStart = now;
          } else if (now - this.silenceAnomalyStart >= 1200 && !this.silenceAnomalyDispatched) {
            this.silenceAnomalyDispatched = true;
            this.emitEvent({
              type: 'AUDIO_ANOMALY',
              durationMs: now - this.silenceAnomalyStart,
              source: 'AUDIO',
              confidence: 0.8,
              metadata: {
                rmsLevel: Math.round(rms * 100) / 100,
                note: 'Acoustic activity detected during post-question thinking silence',
              },
            });
          }
        } else {
          this.silenceAnomalyStart = null;
          this.silenceAnomalyDispatched = false;
        }
      }, 200);
    } catch (err: any) {
      console.warn('[ProctoringEngine] Audio analysis start note:', err?.message);
    }
  }

  /**
   * Stops audio silence monitoring once candidate starts answering or TTS resumes.
   */
  public stopSilenceAudioMonitoring() {
    this.isMonitoringSilence = false;
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
      this.audioMonitorInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.audioAnalyser = null;
    this.audioSource = null;
    this.silenceAnomalyStart = null;
    this.silenceAnomalyDispatched = false;
  }

  // -------------------------------------------------------------
  // 5. EVENT DISPATCH TO SERVER
  // -------------------------------------------------------------

  private emitEvent(event: Omit<ProctoringSignalPayload, 'sessionId'>) {
    if (!this.socket || !this.sessionId) return;

    const turnId = this.getCurrentTurn ? this.getCurrentTurn() : undefined;

    const payload: ProctoringSignalPayload = {
      sessionId: this.sessionId,
      type: event.type,
      durationMs: event.durationMs ? Math.round(event.durationMs) : 0,
      source: event.source,
      confidence: event.confidence ?? 1.0,
      questionId: turnId ? `turn-${turnId}` : undefined,
      metadata: event.metadata,
    };

    try {
      this.socket.emit('proctoring_event', payload);
    } catch (err: any) {
      console.error('[ProctoringEngine] Emit failed:', err?.message);
    }
  }

  private resetState() {
    this.headTurnStartTime = null;
    this.headTurnDispatched = false;
    this.eyeClosedStartTime = null;
    this.eyeClosedDispatched = false;
    this.gazeAwayStartTime = null;
    this.gazeAwayDispatched = false;
    this.faceAbsenceStartTime = null;
    this.faceAbsenceDispatched = false;
    this.cameraObstructedStart = null;
    this.cameraObstructedDispatched = false;
    this.tabHiddenStartTime = null;
    this.windowBlurStartTime = null;
    this.recentBlurTimestamps = [];
  }
}

export const proctoringEngine = new ProctoringEngine();
