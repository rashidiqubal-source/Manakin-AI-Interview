"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, ArrowRight } from "lucide-react";
import { useInterviewStore } from "@/lib/store";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { transcribeAudioAPI, respondInterviewAPI, evaluateInterviewAPI, concludeEarlyAPI, submitFeedbackAPI, updateApplicationStatusAPI, startInterviewAPI, sendProctoringFrameAPI, detectMLFrameAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, MessageSquareHeart, Camera, CameraOff, ScanFace, Volume2, VolumeX, Eye, Timer, RefreshCw, Code2, Terminal, CheckCircle2, RotateCcw, ShieldCheck, AlertCircle, Maximize2, Minimize2, ShieldAlert, Keyboard, Radio, Sparkles } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";

import { detectFacesInVideo } from "@/lib/faceDetector";
import { eyeTracker, GazePoint } from "@/lib/eyeTracker";
import { proctoringEngine } from "@/lib/proctoringEngine";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";

import { io, Socket } from "socket.io-client";

// Temporal State Machine Configurations
const FACE_CONFIRM_FRAMES = 2;
const FACE_LOST_FRAMES = 1;
const OBJECT_CONFIRM_FRAMES = 2;
const OBJECT_CLEAR_FRAMES = 4;

export default function InterviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const { sessionId, setSessionId, messages, addMessage, setEvaluation, isDemo } = useInterviewStore();
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isBootingRef = useRef(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (sessionId && socketRef.current) {
      proctoringEngine.start({
        socket: socketRef.current,
        sessionId,
        getCurrentTurn: () => messages.filter((m) => m.role === 'assistant').length,
      });
    }
  }, [sessionId, messages.length]);

  // Enforce Invitation Requirement: Candidates can only join via recruiter invitation
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeSession = sessionId || sessionIdRef.current;
      if (!activeSession) {
        toast.error("Invitation Required", {
          description: "Candidates can only access interviews through a valid recruiter invitation link.",
        });
        router.push("/");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [sessionId, router]);
  const engagementStats = useRef({ totalFrames: 0, faceDetectedFrames: 0 });
  const [violationCount, setViolationCount] = useState(0);
  const violationCountRef = useRef(0);
  
  // --- TEMPORAL STATE MACHINE: FACE PRESENCE ---
  const [faceState, setFaceState] = useState<'PRESENT' | 'ABSENCE_CANDIDATE' | 'ABSENT'>('ABSENT');
  const consecutivePositiveFaces = useRef(0);
  const consecutiveMissedFaces = useRef(0);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [detectedFaceCount, setDetectedFaceCount] = useState(0);

  // --- ABSENCE TIMER (STRICT 1.0s RULE) ---
  const absenceTimerRef = useRef(0);
  const [absenceTimerDisplay, setAbsenceTimerDisplay] = useState(0);
  const absenceStartTimeRef = useRef<number | null>(null);
  const lastAbsenceTick = useRef(Date.now());

  // --- LOW CONFIDENCE FACE FLAGGING (<35%) ---
  const consecutiveLowConfFaceFrames = useRef(0);
  const LOW_CONF_FACE_THRESHOLD = 0.35;
  const LOW_CONF_FACE_FRAMES = 5; // Must be low-confidence for 5 consecutive frames to flag

  // --- TEMPORAL STATE MACHINE: UNAUTHORIZED OBJECTS ---
  const [objectState, setObjectState] = useState<'NOT_DETECTED' | 'CANDIDATE' | 'CONFIRMED' | 'VIOLATION_REPORTED'>('NOT_DETECTED');
  const objectStateRef = useRef<'NOT_DETECTED' | 'CANDIDATE' | 'CONFIRMED' | 'VIOLATION_REPORTED'>('NOT_DETECTED');
  const consecutiveObjectFrames = useRef(0);
  const consecutiveClearObjectFrames = useRef(0);
  const [detectedObjectsList, setDetectedObjectsList] = useState<Array<{ class: string; confidence: number }>>([]);

  // --- PIPELINE & DEBUG HUD METRICS ---
  const [inferenceLatency, setInferenceLatency] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [inferenceFps, setInferenceFps] = useState(0);
  const [socketStatus, setSocketStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const lastInferenceCount = useRef(0);
  const lastFpsTimestamp = useRef(Date.now());

  // --- DETAILED PROFILE METRICS ---
  const [encodeTime, setEncodeTime] = useState(0);
  const [networkTime, setNetworkTime] = useState(0);
  const [decodeTime, setDecodeTime] = useState(0);
  const [faceInferenceTime, setFaceInferenceTime] = useState(0);
  const [objectInferenceTime, setObjectInferenceTime] = useState(0);
  const [totalEndToEndTime, setTotalEndToEndTime] = useState(0);
  const [pendingFramesCount, setPendingFramesCount] = useState(0);
  const [droppedFramesCount, setDroppedFramesCount] = useState(0);
  const [cameraFps, setCameraFps] = useState(30);
  const [memoryUsage, setMemoryUsage] = useState(0);

  // --- LATEST-FRAME-ONLY BUFFER & CONCURRENCY CONTROL ---
  const frameCounter = useRef(0);
  const lastProcessedFrameId = useRef(0);
  const latestPendingFrame = useRef<{
    arrayBuffer: ArrayBuffer;
    frameId: number;
    timestamp: number;
    captureTime: number;
    resizeTime: number;
    encodeTime: number;
    runFace: boolean;
    runObject: boolean;
  } | null>(null);
  const droppedFramesCounter = useRef(0);

  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const isInferenceInFlight = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  
  const cheatFlags = useRef<string[]>([]);
  const poppedToastTracks = useRef<Set<string>>(new Set());
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [loadingText, setLoadingText] = useState("We are about to start...");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isConcludingEarly, setIsConcludingEarly] = useState(false);
  const [showConcludeEarlyModal, setShowConcludeEarlyModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- LIVE INTERACTIVE CODING CHALLENGE ---
  interface CodeChallenge {
    id: string;
    repoName: string;
    functionName: string;
    language: string;
    title: string;
    description: string;
    starterCode: string;
    expectedBehavior: string;
  }
  const [activeCodeChallenge, setActiveCodeChallenge] = useState<CodeChallenge | null>(null);
  const [codeSolution, setCodeSolution] = useState<string>("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  // --- KOKORO TTS & POST-TTS SILENCE STOPWATCH ---
  const kokoroTTS = useKokoroTTS();
  const [thinkingTime, setThinkingTime] = useState<number>(0);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState<boolean>(false);
  const silenceStartRef = useRef<number | null>(null);
  const recordedSilenceSecRef = useRef<number>(0);
  const [currentGaze, setCurrentGaze] = useState<GazePoint | null>(null);
  const [perQuestionLatencies, setPerQuestionLatencies] = useState<Array<{
    turn: number;
    question: string;
    silenceDurationSec: number;
    ttsDurationSec: number;
  }>>([]);

  const startSilenceStopwatch = () => {
    silenceStartRef.current = performance.now();
    setIsWaitingForResponse(true);
    setThinkingTime(0);
    if (streamRef.current) {
      proctoringEngine.startSilenceAudioMonitoring(streamRef.current);
    }
  };

  const stopSilenceStopwatch = () => {
    if (silenceStartRef.current !== null) {
      const elapsed = (performance.now() - silenceStartRef.current) / 1000;
      recordedSilenceSecRef.current = Math.max(0, Math.round(elapsed * 10) / 10);
      silenceStartRef.current = null;
    }
    setIsWaitingForResponse(false);
    proctoringEngine.stopSilenceAudioMonitoring();
  };

  useEffect(() => {
    if (!isWaitingForResponse) return;
    const interval = setInterval(() => {
      if (silenceStartRef.current !== null) {
        const elapsed = (performance.now() - silenceStartRef.current) / 1000;
        setThinkingTime(Math.round(elapsed * 10) / 10);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isWaitingForResponse]);

  // Initialize MediaPipe eye tracker on mount
  useEffect(() => {
    eyeTracker.initialize().catch((err) => console.warn("EyeTracker init error:", err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const isSetupCompleteRef = useRef(false);
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasClosedOtherTabs, setHasClosedOtherTabs] = useState(false);

  // --- 30-MINUTE INTERVIEW COUNTDOWN TIMER ---
  const TOTAL_INTERVIEW_DURATION_SEC = 30 * 60;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(TOTAL_INTERVIEW_DURATION_SEC);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!isSetupComplete || isInterviewCompleted || isEvaluating) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimeExpired(true);
          toast.info("30-Minute Interview Concluded", {
            description: "Your session duration has reached 30 minutes. Compiling comprehensive evaluation...",
          });
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSetupComplete, isInterviewCompleted, isEvaluating]);

  const formatTimeRemaining = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    isSetupCompleteRef.current = isSetupComplete;
  }, [isSetupComplete]);

  const spokenMessageIdsRef = useRef<Set<string>>(new Set());

  // Only auto-resume if the candidate has ALREADY started answering previous questions
  useEffect(() => {
    if (sessionId && messages.some((m) => m.role === "user")) {
      setIsSetupComplete(true);
    }
  }, [sessionId, messages]);

  // Automatically trigger Kokoro TTS speech for any new assistant question
  useEffect(() => {
    if (!isSetupComplete) return;
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const latestAssistantMsg = assistantMessages[assistantMessages.length - 1];
    if (latestAssistantMsg && !spokenMessageIdsRef.current.has(latestAssistantMsg.id)) {
      spokenMessageIdsRef.current.add(latestAssistantMsg.id);
      kokoroTTS.speakQuestion(latestAssistantMsg.content, () => {
        startSilenceStopwatch();
      });
    }
  }, [messages, isSetupComplete, kokoroTTS]);

  // --- VIOLATION SNAPSHOT EVIDENCE & LIVE TESTING INSPECTOR STATES ---
  const [latestViolationSnapshot, setLatestViolationSnapshot] = useState<{
    image: string;
    type: string;
    message: string;
    timestamp: string;
  } | null>(null);

  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isInspectorMinimized, setIsInspectorMinimized] = useState(false);
  const [liveGazeStatus, setLiveGazeStatus] = useState({
    direction: 'CENTER',
    gazeX: 0.5,
    gazeY: 0.5,
    isAway: false,
    downwardDwellSec: 0,
    readingSaccades: 0,
    recentGlancesCount: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveGazeStatus(eyeTracker.getLiveStatus());
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // Capture lightweight webcam snapshot (320x240 JPEG)
  const captureViolationSnapshot = (): string | null => {
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, 320, 240);
      return canvas.toDataURL("image/jpeg", 0.6);
    } catch (err) {
      console.warn("Failed to capture violation snapshot:", err);
      return null;
    }
  };

  const triggerViolation = (type: string, message: string, points: number = 1, metadata?: any) => {
    cheatFlags.current.push(type);

    // Capture visual photographic evidence from live camera feed
    const snapshotBase64 = captureViolationSnapshot();
    if (snapshotBase64) {
      setLatestViolationSnapshot({
        image: snapshotBase64,
        type,
        message,
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    // Always increment locally by points (+2 for phone, +1 for face absence) for instant UI feedback
    violationCountRef.current += points;
    setViolationCount(violationCountRef.current);
    
    // Also persist to DB if we have an active session
    const socket = socketRef.current;
    const activeSessionId = sessionId || sessionIdRef.current;
    if (socket && socket.connected && activeSessionId) {
      socket.emit('trigger_violation', {
        sessionId: activeSessionId,
        type,
        message,
        points,
        snapshotBase64,
        metadata,
      });
    }
    // Proctoring telemetry is sent silently to socket and DB
  };

  // --- KEYSTROKE & PASTE VELOCITY TELEMETRY ---
  const [keystrokeMetrics, setKeystrokeMetrics] = useState({
    cpm: 0,
    pasteBursts: 0,
    cadence: 'NATURAL' as 'NATURAL' | 'BURST' | 'SYNTHETIC_MACRO',
    lastBurstChars: 0,
  });
  const keystrokeTimestampsRef = useRef<number[]>([]);
  const pasteBurstsCounterRef = useRef<number>(0);

  const handleCodePaste = (pastedText: string) => {
    const charCount = pastedText.length;
    const lineCount = pastedText.split('\n').length;

    // Detect burst injection: >40 chars or >=3 lines instantaneous paste
    if (charCount > 40 || lineCount >= 3) {
      pasteBurstsCounterRef.current += 1;
      setKeystrokeMetrics((prev) => ({
        ...prev,
        pasteBursts: pasteBurstsCounterRef.current,
        cadence: 'BURST',
        lastBurstChars: charCount,
      }));

      triggerViolation(
        'CODE_PASTE_BURST',
        `Instantaneous code injection detected: ${charCount} chars (${lineCount} lines) pasted into editor.`,
        2,
        {
          charCount,
          lineCount,
          snippetPreview: pastedText.slice(0, 80),
          injectedAt: new Date().toISOString(),
        }
      );
    }
  };

  const recordKeystroke = () => {
    const now = performance.now();
    const timestamps = keystrokeTimestampsRef.current;
    timestamps.push(now);

    if (timestamps.length > 25) {
      timestamps.shift();
    }

    if (timestamps.length >= 6) {
      let totalIki = 0;
      for (let i = 1; i < timestamps.length; i++) {
        totalIki += (timestamps[i] - timestamps[i - 1]);
      }
      const avgIki = totalIki / (timestamps.length - 1);
      const elapsedMin = totalIki / 60000;
      const cpm = elapsedMin > 0 ? Math.round(timestamps.length / elapsedMin) : 0;

      let cadence: 'NATURAL' | 'BURST' | 'SYNTHETIC_MACRO' = 'NATURAL';
      if (avgIki < 12 && timestamps.length >= 15) {
        cadence = 'SYNTHETIC_MACRO';
        triggerViolation(
          'UNNATURAL_KEYSTROKE_CADENCE',
          `Unnatural typing cadence detected: average interval ${avgIki.toFixed(1)}ms (<12ms threshold). Macro injection suspected.`,
          1,
          {
            avgIkiMs: Math.round(avgIki * 10) / 10,
            sampleSize: timestamps.length,
          }
        );
      }

      setKeystrokeMetrics((prev) => ({
        ...prev,
        cpm: Math.min(2000, cpm),
        cadence,
      }));
    }
  };

  // --- NATURAL INTERRUPTION (BARGE-IN) AUDIO LISTENER ---
  const [isBargeInActive, setIsBargeInActive] = useState(false);
  const bargeInThresholdStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!kokoroTTS.isPlaying || !streamRef.current) {
      bargeInThresholdStartRef.current = null;
      return;
    }

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animId: number | null = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source = audioCtx.createMediaStreamSource(streamRef.current);
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);

      const checkVolume = () => {
        if (!kokoroTTS.isPlaying) return;
        analyser!.getFloatTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Voice energy threshold: RMS > 0.05 sustained for > 150ms
        if (rms > 0.05) {
          if (bargeInThresholdStartRef.current === null) {
            bargeInThresholdStartRef.current = performance.now();
          } else if (performance.now() - bargeInThresholdStartRef.current > 150) {
            console.log("🗣️ [BARGE-IN] Candidate interrupted AI playback (RMS:", rms.toFixed(3), ")");
            kokoroTTS.stopAudio();
            setIsBargeInActive(true);
            setTimeout(() => setIsBargeInActive(false), 3000);

            const activeSessionId = sessionId || sessionIdRef.current;
            if (socketRef.current && activeSessionId) {
              socketRef.current.emit('barge_in', {
                sessionId: activeSessionId,
                timestamp: Date.now(),
              });
            }
            startSilenceStopwatch();
            return;
          }
        } else {
          bargeInThresholdStartRef.current = null;
        }

        animId = requestAnimationFrame(checkVolume);
      };

      animId = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn("Barge-in audio monitor error:", err);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (source) source.disconnect();
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    };
  }, [kokoroTTS.isPlaying]);

  // Fullscreen Mode Activation & Proctoring Enforcement
  const requestFullscreenMode = async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
      toast.success("Fullscreen Mode Activated", {
        description: "Browser tabs and toolbars hidden for exam integrity.",
      });
    } catch (err: any) {
      console.warn("Fullscreen request error:", err);
      toast.error("Fullscreen Request Blocked", {
        description: "Please allow fullscreen mode in your browser to proceed.",
      });
    }
  };

  useEffect(() => {
    const updateFsState = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);

      // If exited during an active interview session, log proctoring violation and snapshot
      if (isSetupCompleteRef.current && !isInterviewCompleted && !isFs) {
        triggerViolation(
          "FULLSCREEN_EXIT",
          "Candidate exited fullscreen mode or switched windows/tabs",
          1,
          { action: "FULLSCREEN_EXITED", recordedAt: new Date().toISOString() }
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isSetupCompleteRef.current && !isInterviewCompleted) {
        triggerViolation(
          "TAB_HIDDEN",
          "Candidate navigated away from the active interview tab",
          1,
          { action: "TAB_HIDDEN", recordedAt: new Date().toISOString() }
        );
      }
    };

    updateFsState();
    document.addEventListener("fullscreenchange", updateFsState);
    document.addEventListener("webkitfullscreenchange", updateFsState);
    document.addEventListener("mozfullscreenchange", updateFsState);
    document.addEventListener("MSFullscreenChange", updateFsState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("fullscreenchange", updateFsState);
      document.removeEventListener("webkitfullscreenchange", updateFsState);
      document.removeEventListener("mozfullscreenchange", updateFsState);
      document.removeEventListener("MSFullscreenChange", updateFsState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isInterviewCompleted]);

  // Instant Video Stream Attacher (never lets the video drop on unmount/re-render)
  const attachVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.onloadedmetadata = () => {
        setVideoDimensions({ width: node.videoWidth, height: node.videoHeight });
        node.play().catch(e => console.warn("Video play error:", e));
      };
      node.play().catch(e => console.warn("Video play error:", e));
    }
  };

  // Dedicated Camera Lifecycle with React StrictMode resilience
  useEffect(() => {
    let unmounted = false;

    const startCamera = async () => {
      try {
        console.log("[CAMERA] Requesting user media (video + audio)...");
        let stream: MediaStream;
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, 
            audio: true 
          });
        } catch (mediaErr) {
          console.warn("[CAMERA] Combined request failed, falling back to video only:", mediaErr);
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, 
            audio: false 
          });
        }
        
        if (unmounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        const hasVideo = stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);
        const hasAudio = stream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);

        console.log("[CAMERA] Camera ready. Active tracks:", { video: hasVideo, audio: hasAudio });
        setIsVideoActive(hasVideo);
        setIsMicActive(hasAudio || true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
            }
            videoRef.current?.play().catch(e => console.warn("Video play error:", e));
          };
          videoRef.current.play().catch(e => console.warn("Video play error:", e));
        }
      } catch (err: any) {
        console.error("[CAMERA] Access denied or error:", err);
        toast.error("Camera Permissions Required", {
          description: "Please allow camera and microphone access in your browser."
        });
      } finally {
        setIsCameraReady(true);
      }
    };

    startCamera();

    return () => {
      unmounted = true;
      console.log("[CAMERA] Cleaning up camera tracks on unmount.");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const requestCameraAccess = async () => {
    try {
      console.log("[CAMERA] Manual camera request triggered...");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, 
          audio: true 
        });
      } catch (mediaErr) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, 
          audio: false 
        });
      }
      
      streamRef.current = stream;
      const hasVideo = stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);
      const hasAudio = stream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);

      setIsVideoActive(hasVideo);
      setIsMicActive(hasAudio || true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.play().catch(e => console.warn(e));
        setVideoDimensions({ width: videoRef.current.videoWidth || 640, height: videoRef.current.videoHeight || 480 });
      }
      toast.success("Camera & Microphone Connected!");
    } catch (err: any) {
      console.error("[CAMERA] Manual request failed:", err);
      toast.error("Camera Permission Required", {
        description: "Please click the camera lock icon in your browser address bar to allow permissions."
      });
    }
  };

  // Re-verify stream attachment whenever switching view mode
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(e => console.warn(e));
    }
  }, [isSetupComplete]);

  // Central Processing Function for ML Results (WebSocket + HTTP Fallback)
  const processDetectionResults = (mlResult: any) => {
    const clientReceiveTime = Date.now();
    if (!mlResult || !mlResult.success) {
      isInferenceInFlight.current = false;
      return;
    }

    const meta = mlResult.metadata || {};
    
    // Stale Frame Protection
    if (meta.frameId && meta.frameId <= lastProcessedFrameId.current) {
      console.warn(`[ML] Discarded stale frame: ${meta.frameId} (current: ${lastProcessedFrameId.current})`);
      return;
    }
    if (meta.frameId) {
      lastProcessedFrameId.current = meta.frameId;
    }

    // Memory usage tracker (Chrome/Edge compatible)
    if (typeof window !== 'undefined' && (performance as any).memory) {
      setMemoryUsage(Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024));
    }

    // Capture, resize and encode latency from metadata
    const capture = Math.round(meta.captureTime || 0);
    const resize = Math.round(meta.resizeTime || 0);
    const encoding = Math.round(meta.encodeTime || 0);

    // WebSocket Transmission time (client to server)
    const webSocketTrans = Math.round(Math.max(0, mlResult.timestamp - meta.timestamp));

    // Decode and Inference timings on backend
    const decode = Math.round(mlResult.decodeTimeMs || 0);
    const faceModel = Math.round(mlResult.faceInferenceTimeMs || 0);
    const objectModel = Math.round(mlResult.objectInferenceTimeMs || 0);
    const processing = Math.round(mlResult.processingTimeMs || 0);

    // Response Transmission time (server to client)
    const serverSendTime = mlResult.timestamp + processing;
    const responseTrans = Math.round(Math.max(0, clientReceiveTime - serverSendTime));
    const total = Math.round(clientReceiveTime - meta.timestamp);

    // Update States for Debug/Performance Dashboard
    setEncodeTime(encoding);
    setNetworkTime(webSocketTrans + responseTrans);
    setDecodeTime(decode);
    setFaceInferenceTime(faceModel);
    setObjectInferenceTime(objectModel);
    setTotalEndToEndTime(total);
    setInferenceLatency(processing);

    lastInferenceCount.current += 1;

    // FPS Meter
    const now = Date.now();
    if (now - lastFpsTimestamp.current >= 1000) {
      setInferenceFps(lastInferenceCount.current);
      lastInferenceCount.current = 0;
      lastFpsTimestamp.current = now;
    }

    // Print Profile Log as requested
    console.log(`Frame ID: ${meta.frameId}\n\nCapture:        ${capture} ms\nResize:         ${resize} ms\nEncoding:       ${encoding} ms\nWebSocket:      ${webSocketTrans} ms\nDecode:         ${decode} ms\nFace model:     ${faceModel} ms\nObject model:   ${objectModel} ms\nProcessing:     ${processing} ms\nResponse:       ${responseTrans} ms\n\nTOTAL:          ${total} ms`);

    // Sync violation count from DB — only update UPWARD to avoid overwriting
    // optimistic local increments from face absence / frontend triggers
    if (mlResult.cheatCount !== undefined && mlResult.cheatCount !== null) {
      if (mlResult.cheatCount > violationCountRef.current) {
        violationCountRef.current = mlResult.cheatCount;
        setViolationCount(mlResult.cheatCount);
      }
    }

    const rawFaces = mlResult.faces || [];
    const rawObjects = mlResult.objects || [];

    setDetectedFaceCount(rawFaces.length);
    setDetectedObjectsList(rawObjects);

    if (rawFaces.length > 0) {
      setFaceConfidence(rawFaces[0].confidence || 0.95);
    } else {
      setFaceConfidence(0);
    }

    if (videoRef.current) {
      drawBoundingBoxes(rawFaces, rawObjects, videoRef.current.videoWidth, videoRef.current.videoHeight);
    }

    // --- 1. TEMPORAL STATE MACHINE: FACE PRESENCE ---
    const currentFaceConf = rawFaces.length > 0 ? (rawFaces[0].confidence || 0) : 0;

    if (rawFaces.length > 0) {
      consecutivePositiveFaces.current += 1;
      consecutiveMissedFaces.current = 0;

      if (consecutivePositiveFaces.current >= FACE_CONFIRM_FRAMES) {
        setFaceState('PRESENT');
        setFaceDetected(true);
        absenceStartTimeRef.current = null;
        absenceTimerRef.current = 0;
        setAbsenceTimerDisplay(0);
        engagementStats.current.faceDetectedFrames += 1;
      }

      // --- 1b. LOW CONFIDENCE FACE: flag if face is detected but confidence < 35% ---
      // This catches partially obscured faces, face covered with hand, etc.
      if (currentFaceConf > 0 && currentFaceConf < LOW_CONF_FACE_THRESHOLD) {
        consecutiveLowConfFaceFrames.current += 1;
        if (consecutiveLowConfFaceFrames.current >= LOW_CONF_FACE_FRAMES && isSetupCompleteRef.current) {
          consecutiveLowConfFaceFrames.current = 0; // reset to prevent repeat spam
          triggerViolation(
            'LOW_CONFIDENCE_FACE',
            `Low face confidence detected (${Math.round(currentFaceConf * 100)}%) — possible obstruction or face covering.`
          );
        }
      } else {
        consecutiveLowConfFaceFrames.current = 0;
      }
    } else {
      consecutiveMissedFaces.current += 1;
      consecutivePositiveFaces.current = 0;
      consecutiveLowConfFaceFrames.current = 0;

      if (consecutiveMissedFaces.current >= FACE_LOST_FRAMES) {
        setFaceState('ABSENT');
        setFaceDetected(false);

        if (isSetupCompleteRef.current) {
          const now = Date.now();
          if (!absenceStartTimeRef.current) {
            absenceStartTimeRef.current = now;
          }

          const elapsedSec = (now - absenceStartTimeRef.current) / 1000;
          const currentAbsence = Math.round(elapsedSec * 10) / 10;
          setAbsenceTimerDisplay(currentAbsence);

          if (elapsedSec >= 1.0) {
            triggerViolation('ABSENT_USER', `Candidate out of camera frame (${currentAbsence.toFixed(1)}s)!`, 1);
            absenceStartTimeRef.current = now;
            setAbsenceTimerDisplay(0);
          }
        }
      } else {
        setFaceState('ABSENCE_CANDIDATE');
      }
    }
    lastAbsenceTick.current = Date.now();
    engagementStats.current.totalFrames += 1;

    // --- 2. TEMPORAL STATE MACHINE: UNAUTHORIZED OBJECTS (Backend-Driven Confirmation & Alerts) ---
    let hasAnyFlaggedObj = false;
    let hasAnyCandidateObj = false;

    rawObjects.forEach((obj: any) => {
      if (obj.state === 'FLAGGED') {
        hasAnyFlaggedObj = true;
        if (!poppedToastTracks.current.has(obj.trackId)) {
          poppedToastTracks.current.add(obj.trackId);
          setObjectState('VIOLATION_REPORTED');
          objectStateRef.current = 'VIOLATION_REPORTED';

          // triggerViolation increments the local count immediately AND
          // the backend also atomically increments cheatCount in DB (via ObjectTrackerService).
          // The DB count syncs back via ml_result.cheatCount (upward-only sync).
          triggerViolation(
            obj.risk === 'HIGH' ? 'UNAUTHORIZED_DEVICE' : 'SUSPICIOUS_OBJECT',
            `Unauthorized device (${obj.class.toUpperCase()}) detected — confidence ${Math.round(obj.confidence * 100)}%`,
            2
          );
        }
      } else if (obj.state === 'CLEARED') {
        poppedToastTracks.current.delete(obj.trackId);
      } else if (obj.state === 'CANDIDATE') {
        hasAnyCandidateObj = true;
      }
    });

    if (hasAnyFlaggedObj) {
      setObjectState('VIOLATION_REPORTED');
      objectStateRef.current = 'VIOLATION_REPORTED';
    } else if (hasAnyCandidateObj) {
      setObjectState('CANDIDATE');
      objectStateRef.current = 'CANDIDATE';
    } else if (rawObjects.length === 0) {
      setObjectState('NOT_DETECTED');
      objectStateRef.current = 'NOT_DETECTED';
    }

    // Process pending frame in the single-flight buffer (MAX_PENDING_FRAMES = 1)
    isInferenceInFlight.current = false;
    if (latestPendingFrame.current) {
      const nextFrame = latestPendingFrame.current;
      latestPendingFrame.current = null;
      setPendingFramesCount(0);
      
      isInferenceInFlight.current = true;
      sendFramePacket(nextFrame);
    }
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
    console.log("[WEBSOCKET] Connecting to ML socket:", socketUrl);
    
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 [WEBSOCKET] Connected to ML server with ID:", socket.id);
      setSocketStatus('CONNECTED');
      if (sessionIdRef.current) {
        proctoringEngine.start({
          socket,
          sessionId: sessionIdRef.current,
          getCurrentTurn: () => messages.filter((m) => m.role === 'assistant').length,
        });
      }
      // Reset flight flag on reconnect to resume frame transmission
      isInferenceInFlight.current = false;
      if (latestPendingFrame.current) {
        const nextFrame = latestPendingFrame.current;
        latestPendingFrame.current = null;
        setPendingFramesCount(0);
        isInferenceInFlight.current = true;
        sendFramePacket(nextFrame);
      }
    });

    socket.on("ml_result", (mlResult: any) => {
      processDetectionResults(mlResult);
    });

    socket.on("violation_count_update", (data: { cheatCount: number }) => {
      violationCountRef.current = data.cheatCount;
      setViolationCount(data.cheatCount);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 [WEBSOCKET] Disconnected:", reason);
      setSocketStatus('DISCONNECTED');
    });

    return () => {
      proctoringEngine.stop();
      socket.disconnect();
    };
  }, []);

  // Draw ML Bounding Boxes with Responsive Scaling (Canvas cleared for clean video feed)
  const drawBoundingBoxes = (
    _faces: Array<{ x: number; y: number; width: number; height: number; confidence: number }>,
    _objects: Array<{ class: string; confidence: number; x: number; y: number; width: number; height: number }>,
    videoWidth: number,
    videoHeight: number
  ) => {
    const canvas = canvasOverlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayWidth = canvas.clientWidth || videoWidth || 320;
    const displayHeight = canvas.clientHeight || videoHeight || 240;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
  };

  // Real-Time Frame Inference Loop (Runs smoothly at 10 FPS with temporal and memory optimization)
  useEffect(() => {
    let active = true;
    let intervalId: NodeJS.Timeout;

    const performInference = async () => {
      if (!videoRef.current || !active) return;
      const video = videoRef.current;

      if (video.readyState < video.HAVE_METADATA || video.videoWidth === 0) return;

      // Process MediaPipe Eye Tracking Frame (Gaze, Scanpath, Away, Fixations)
      try {
        const gaze = eyeTracker.processFrame(video);
        if (gaze) {
          setCurrentGaze(gaze);
          proctoringEngine.reportGaze(gaze.direction, gaze.isAway);
        }
        proctoringEngine.processLandmarks(eyeTracker.latestLandmarks, video);

        // Check for Cheating Pattern Alerts (Off-screen reading, concealed phone, corner glances)
        const patternAlert = eyeTracker.consumePendingPatternAlert();
        if (patternAlert && isSetupCompleteRef.current) {
          let eventType = 'OFF_SCREEN_READING';
          if (patternAlert.type === 'CONCEALED_PHONE_GAZE') eventType = 'CONCEALED_PHONE_GAZE';
          else if (patternAlert.type === 'REPEATED_CORNER_GLANCES') eventType = 'SUSPICIOUS_CORNER_GLANCES';

          triggerViolation(
            eventType,
            patternAlert.description,
            patternAlert.points,
            { confidence: patternAlert.confidence, gazeDirection: gaze?.direction }
          );
        }
      } catch {
        // Non-blocking
      }

      const captureStart = performance.now();
      const frameId = frameCounter.current + 1;
      frameCounter.current = frameId;
      
      const captureTime = performance.now() - captureStart;

      const resizeStart = performance.now();
      const offscreenCanvas = document.createElement('canvas');
      const targetWidth = 640; // 640x360 for high-accuracy phone/object and face monitoring
      const aspectRatio = video.videoHeight / video.videoWidth;
      offscreenCanvas.width = targetWidth;
      offscreenCanvas.height = Math.round(targetWidth * (isNaN(aspectRatio) || aspectRatio === 0 ? 0.75 : aspectRatio));
      const offscreenCtx = offscreenCanvas.getContext('2d');
      
      if (!offscreenCtx) return;
      offscreenCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
      const resizeTime = performance.now() - resizeStart;

      const encodeStart = performance.now();
      offscreenCanvas.toBlob(async (blob) => {
        if (!blob) {
          isInferenceInFlight.current = false;
          return;
        }
        const encodeTime = performance.now() - encodeStart;
        const arrayBuffer = await blob.arrayBuffer();

        // Target FPS frequencies: Face (10 FPS) is every frame; Object (5 FPS) is every 2nd frame.
        const runFace = true;
        const runObject = (frameId % 2 === 0);

        const packet = {
          arrayBuffer,
          frameId,
          timestamp: Date.now(),
          captureTime,
          resizeTime,
          encodeTime,
          runFace,
          runObject
        };

        if (isInferenceInFlight.current) {
          // Latest-frame-only buffer (overwrite pending frame)
          if (latestPendingFrame.current) {
            droppedFramesCounter.current++;
            setDroppedFramesCount(droppedFramesCounter.current);
          }
          latestPendingFrame.current = packet;
          setPendingFramesCount(1);
        } else {
          isInferenceInFlight.current = true;
          sendFramePacket(packet);
        }
      }, 'image/jpeg', 0.6);
    };

    const runInferenceLoop = async () => {
      if (!active) return;
      await performInference();
      if (active) {
        intervalId = setTimeout(runInferenceLoop, 100); // 100ms throttle interval to target 10 FPS
      }
    };

    intervalId = setTimeout(runInferenceLoop, 500);

    return () => {
      active = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, []);

  const sendFramePacket = (packet: any) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit('ml_frame', packet.arrayBuffer, {
        runFace: packet.runFace,
        runObject: packet.runObject,
        metadata: {
          frameId: packet.frameId,
          timestamp: packet.timestamp,
          captureTime: packet.captureTime,
          resizeTime: packet.resizeTime,
          encodeTime: packet.encodeTime,
          sessionId: sessionId || null
        }
      });
    } else {
      isInferenceInFlight.current = false;
    }
  };

  // Boot sequence loading texts
  useEffect(() => {
     if (isCameraReady) return;
     const texts = ["We are about to start...", "Initializing secure camera...", "Just a few more seconds...", "Loading AI algorithms..."];
     let idx = 0;
     const interval = setInterval(() => {
        idx = (idx + 1) % texts.length;
        setLoadingText(texts[idx]);
     }, 2500);
     return () => clearInterval(interval);
  }, [isCameraReady]);

  const handleProctorViolation = (reason: string) => {
    triggerViolation(
      reason,
      reason === "MOBILE_PHONE" 
        ? "Unauthorized device (Mobile Phone) detected in frame!" 
        : "Face not detected in camera view for 3 seconds!"
    );
  };

  const handleRecordToggle = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      setIsProcessing(true);

      const activeSessionId = sessionId || sessionIdRef.current;
      if (socketRef.current && activeSessionId) {
        socketRef.current.emit('voice_stream_end', {
          sessionId: activeSessionId,
        });
      }
      
      try {
        if (!blob || blob.size < 500) {
          toast.info("Audio recording was too short. Please speak clearly into your microphone.");
          setIsProcessing(false);
          return;
        }

        // 1. Send Audio to STT
        const transcript = await transcribeAudioAPI(blob);
        
        if (!transcript || !transcript.trim()) {
          toast.info("No clear speech detected. Please speak into your microphone and try again.");
          setIsProcessing(false);
          return;
        }

        // Add User Message
        addMessage({
          id: `msg_user_${Date.now()}_${Math.random()}`,
          role: "user",
          content: transcript,
        });

        if (!activeSessionId) {
          throw new Error("No active session found. Please wait or refresh the interview.");
        }

        const silenceSec = recordedSilenceSecRef.current;
        const ttsDur = kokoroTTS.ttsDurationSec;

        // 2. Fetch AI Response with silence and TTS metrics
        const reply = await respondInterviewAPI(activeSessionId, transcript, silenceSec, ttsDur);
        
        setPerQuestionLatencies((prev) => [
          ...prev,
          {
            turn: prev.length + 1,
            question: messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content || "Question",
            silenceDurationSec: silenceSec,
            ttsDurationSec: ttsDur,
          },
        ]);

        if (reply.codeChallenge || reply.coding) {
          const challenge = reply.codeChallenge || {
            id: `challenge-${Date.now()}`,
            title: "Live Technical Implementation Challenge",
            repoName: "technical-assessment",
            functionName: "solveChallenge",
            language: "typescript",
            description: reply.reply,
            expectedBehavior: "Production-ready solution handling edge cases.",
            starterCode: `// Write your implementation below\nfunction solveChallenge() {\n  // TODO\n}\n`,
          };
          setActiveCodeChallenge(challenge);
          setCodeSolution(challenge.starterCode);
          toast.info("Live Code Assessment Activated", {
            description: `Review the problem prompt and write your solution directly in the code editor below.`,
          });
        }

        if (reply.cutoff || reply.shouldCutoff) {
          if (reply.reply) {
            addMessage({
              id: `msg_asst_${Date.now()}_${Math.random()}`,
              role: "assistant",
              content: reply.reply,
            });
          }
          toast.success("Interview Complete", {
            description: "You have answered all 10 questions. Generating your evaluation...",
          });
          setTimeout(async () => {
            await handleFinish();
          }, 3000);
        } else {
          if (reply.reply) {
            addMessage({
              id: `msg_asst_${Date.now()}_${Math.random()}`,
              role: "assistant",
              content: reply.reply,
            });
          }
        }

      } catch (error: any) {
        console.error("Pipeline failed", error);
        toast.error("Error Processing Response", {
          description: error?.response?.data?.message || error.message || "Failed to process interview response. Please try again."
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        // Candidate is about to respond -> Stop silence/hesitation stopwatch
        stopSilenceStopwatch();
        const activeSessionId = sessionId || sessionIdRef.current;
        await startRecording((chunk, seq) => {
          if (socketRef.current && socketRef.current.connected && activeSessionId) {
            socketRef.current.emit('voice_stream_chunk', {
              sessionId: activeSessionId,
              seq,
              isFinal: false,
            });
          }
        });
      } catch (err: any) {
        toast.error("Microphone Access Denied", {
           description: "Please allow microphone access in your browser settings to continue the interview."
        });
      }
    }
  };

  const handleGenerateQuestion = async () => {
    setIsProcessing(true);
    try {
      const activeSessionId = sessionId || sessionIdRef.current;
      if (!activeSessionId) {
        throw new Error("No active session found. Please wait or refresh the interview.");
      }
      
      addMessage({
        id: Math.random().toString(),
        role: "user",
        content: "[Requested next question]",
      });

      const reply = await respondInterviewAPI(activeSessionId, "Please ask the next question or give me another scenario.");
      
      if (reply.codeChallenge || reply.coding) {
        const challenge = reply.codeChallenge || {
          id: `challenge-${Date.now()}`,
          title: "Live Technical Implementation Challenge",
          repoName: "technical-assessment",
          functionName: "solveChallenge",
          language: "typescript",
          description: reply.reply,
          expectedBehavior: "Clean, production-ready solution handling edge cases.",
          starterCode: `// Write your implementation below\nfunction solveChallenge() {\n  // TODO\n}\n`,
        };
        setActiveCodeChallenge(challenge);
        setCodeSolution(challenge.starterCode);
      }

      if (reply.cutoff && (messages.filter((m) => m.role === "user").length >= 10 || isTimeExpired)) {
        await handleFinish();
      } else {
        // Adding assistant message triggers speech once via centralized useEffect
        addMessage({
          id: `msg_asst_${Date.now()}_${Math.random()}`,
          role: "assistant",
          content: reply.reply,
        });
      }

    } catch (error: any) {
      console.error("Failed to generate question", error);
      toast.error("Error Generating Question", {
        description: error?.response?.data?.message || error.message || "Failed to process request."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitCodeSolution = async () => {
    if (!activeCodeChallenge || !codeSolution.trim()) return;
    setIsSubmittingCode(true);
    try {
      const activeSessionId = sessionId || sessionIdRef.current;
      if (!activeSessionId) {
        throw new Error("No active session found. Please wait or refresh the interview.");
      }

      const challengeSnapshot = activeCodeChallenge;
      const formattedCodeMsg = `[Submitted Code Implementation for ${challengeSnapshot.functionName} (${challengeSnapshot.language})]:\n\`\`\`${challengeSnapshot.language}\n${codeSolution}\n\`\`\``;

      addMessage({
        id: Math.random().toString(),
        role: "user",
        content: formattedCodeMsg,
      });

      const silenceSec = recordedSilenceSecRef.current;
      const ttsDur = kokoroTTS.ttsDurationSec;

      // Close the code editor active view
      setActiveCodeChallenge(null);

      // Submit code payload to backend
      const reply = await respondInterviewAPI(
        activeSessionId,
        formattedCodeMsg,
        silenceSec,
        ttsDur,
        {
          code: codeSolution,
          language: challengeSnapshot.language,
          challengeId: challengeSnapshot.id,
          repoName: challengeSnapshot.repoName,
        }
      );

      if (reply.codeChallenge) {
        setActiveCodeChallenge(reply.codeChallenge);
        setCodeSolution(reply.codeChallenge.starterCode);
      }

      if (reply.cutoff && (messages.filter((m) => m.role === "user").length >= 10 || isTimeExpired)) {
        await handleFinish();
      } else {
        // Adding assistant message triggers speech once via centralized useEffect
        addMessage({
          id: `msg_asst_${Date.now()}_${Math.random()}`,
          role: "assistant",
          content: reply.reply,
        });
      }

      toast.success("Code Evaluated & Submitted", {
        description: `Your implementation for ${challengeSnapshot.functionName} was analyzed. Lumina AI is asking a technical follow-up.`,
      });
    } catch (error: any) {
      console.error("Failed to submit code implementation", error);
      toast.error("Error Submitting Code", {
        description: error?.response?.data?.message || error.message || "Failed to submit code implementation. Please try again.",
      });
    } finally {
      setIsSubmittingCode(false);
    }
  };

  const handleFinish = async () => {
    setIsEvaluating(true);
    kokoroTTS.stopAudio();
    stopSilenceStopwatch();
    proctoringEngine.stop();

    let score = 0;
    if (engagementStats.current.totalFrames > 0) {
       score = Math.round((engagementStats.current.faceDetectedFrames / engagementStats.current.totalFrames) * 10);
    }

    // Capture complete eye tracking telemetry from MediaPipe FaceLandmarker
    const eyeTelemetry = eyeTracker.getTelemetry();
    
    try {
      const evaluationResult = await evaluateInterviewAPI(
        sessionId!,
        Math.max(1, score),
        cheatFlags.current,
        eyeTelemetry
      );
      if (evaluationResult) {
        evaluationResult.eyeTrackingData = eyeTelemetry;
        evaluationResult.responseLatencies = perQuestionLatencies;
        setEvaluation(evaluationResult);
      }
      setShowFeedbackModal(true);
    } catch (error: any) {
      console.error("Evaluation completed in background:", error);
      setShowFeedbackModal(true);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleConcludeClick = () => {
    const userMsgCount = messages.filter((m) => m.role === "user").length;
    if (userMsgCount >= 10 || isTimeExpired) {
      handleFinish();
    } else {
      setShowConcludeEarlyModal(true);
    }
  };

  const handleConfirmConcludeEarly = async () => {
    setShowConcludeEarlyModal(false);
    setIsConcludingEarly(true);
    kokoroTTS.stopAudio();
    stopSilenceStopwatch();
    proctoringEngine.stop();

    try {
      const activeSessionId = sessionId || sessionIdRef.current;
      if (activeSessionId) {
        await concludeEarlyAPI(activeSessionId, "Candidate concluded interview early in between session.");
      }
      setShowFeedbackModal(true);
    } catch (error: any) {
      console.error("Failed to conclude early:", error);
      setShowFeedbackModal(true);
    } finally {
      setIsConcludingEarly(false);
    }
  };

  const handleStartInterview = async () => {
    if (!hasClosedOtherTabs) {
      toast.error("Browser Tabs Check Required", {
        description: "Please close all other browser tabs and check the confirmation box.",
      });
      return;
    }

    // Ensure fullscreen is active before entering interview
    const inFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!inFullscreen) {
      try {
        await requestFullscreenMode();
      } catch (e) {
        toast.error("Fullscreen Required", {
          description: "Exclusive fullscreen is required to hide tabs and ensure exam integrity.",
        });
        return;
      }
    }

    setIsStartingInterview(true);
    setIsSetupComplete(true); // Transition immediately to interview page
    try {
      const activeSessionId = sessionId || sessionIdRef.current;
      const existingFirstMsg = messages.find((m) => m.role === "assistant");

      if (activeSessionId && existingFirstMsg) {
        toast.success("Interview Started", {
          description: "AI Interviewer is ready. Speak clearly into your microphone.",
        });
        return;
      }

      if (activeSessionId) {
        const candidateEmail = user?.email;
        const candidateName = user?.name || (candidateEmail ? candidateEmail.split("@")[0] : "Candidate");
        const apiData = await startInterviewAPI(candidateName, candidateEmail);

        if (apiData) {
          setSessionId(apiData.sessionId);
          addMessage({
            id: `msg_first_${Date.now()}`,
            role: "assistant",
            content: apiData.question,
          });
          toast.success("Interview Started", {
            description: "AI Interviewer is ready. Speak clearly into your microphone.",
          });
        }
        return;
      }

      toast.error("Invitation Required", {
        description: "Please access your interview through the recruiter invitation link.",
      });
      router.push("/");
    } catch (err: any) {
      console.error("Failed to start session:", err);
      toast.error("Failed to start interview", {
        description: err?.message || "Please check backend connection and retry.",
      });
      setSessionFailed(true);
    } finally {
      setIsStartingInterview(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      toast.error("Please enter some feedback.");
      return;
    }
    setIsSubmittingFeedback(true);
    const activeSessionId = sessionId || sessionIdRef.current;
    try {
      if (activeSessionId) {
        await submitFeedbackAPI(activeSessionId, feedbackText);
      }
      toast.success("Feedback submitted! Thank you.");
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmittingFeedback(false);
      setShowFeedbackModal(false);
      setIsInterviewCompleted(true);
    }
  };

  const handleSkipFeedback = () => {
    setShowFeedbackModal(false);
    setIsInterviewCompleted(true);
  };

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden relative">
      
      {/* Session Failure Overlay */}
      {sessionFailed && (
       <div className="absolute inset-0 z-[100] flex flex-col bg-black items-center justify-center p-6 text-center">
          <p className="text-rose-500 font-medium text-xl">Failed to secure an encrypted session key.</p>
          <p className="text-zinc-500 text-sm mt-2">The OpenAI back-end might be unreachable or timed out.</p>
          <Button onClick={() => router.push('/')} className="mt-6 bg-zinc-800 text-white">Return to Secure Hub</Button>
       </div>
      )}

      {/* FULLSCREEN LOCK ENFORCEMENT OVERLAY */}
      {isSetupComplete && !isInterviewCompleted && !isFullscreen && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="max-w-md w-full p-8 rounded-3xl bg-zinc-950 border border-rose-500/40 shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Maximize2 className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Fullscreen Mode Required</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                You have exited fullscreen mode or navigated away from the interview tab. All other browser tabs and external applications must remain hidden during this assessment.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" /> Integrity Violation Logged
              </span>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Exiting fullscreen has been logged in your recruiter proctoring audit dossier. Please re-enter fullscreen immediately to resume the evaluation.
              </p>
            </div>

            <Button
              onClick={requestFullscreenMode}
              className="w-full py-6 text-base font-bold bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:opacity-95 text-white rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] cursor-pointer flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-5 h-5" /> Re-enter Fullscreen & Resume
            </Button>
          </div>
        </div>
      )}

      {/* Boot Sequencer Loading Screen */}
      <AnimatePresence>
        {!isCameraReady && (
           <motion.div 
             exit={{ opacity: 0, scale: 1.05 }}
             transition={{ duration: 0.6, ease: "easeInOut" }}
             className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black"
           >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black pointer-events-none" />
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="z-10 flex flex-col items-center max-w-sm text-center"
              >
                 <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                    <ScanFace className="w-8 h-8 text-cyan-500 animate-pulse" />
                 </div>
                 <motion.p 
                    key={loadingText}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-white font-medium tracking-wider"
                 >
                    {loadingText}
                 </motion.p>
                 <p className="text-zinc-500 text-sm mt-3 animate-pulse">Initializing ML vision models & video streams</p>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Dark Space Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/10 via-black to-black pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-900/20 blur-[150px] rounded-full pointer-events-none" />

      {/* SETUP & CALIBRATION VIEW (Fits 100% of screen without requiring 60% browser zoom) */}
      {!isSetupComplete ? (
        <div className="z-10 flex-1 flex flex-col justify-center items-center p-4 md:p-6 w-full max-w-6xl mx-auto overflow-y-auto">
          <div className="w-full bg-zinc-900/70 border border-white/10 backdrop-blur-2xl rounded-3xl p-5 md:p-7 shadow-2xl flex flex-col gap-5 my-auto">
            
            {/* Setup Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Pre-Flight Verification
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Camera & System Verification</h1>
                <p className="text-zinc-400 text-xs md:text-sm">
                  Position your face clearly in the camera. All hardware and environment checks must pass before unlocking.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 ${
                  isVideoActive && isMicActive && faceState === 'PRESENT' && socketStatus === 'CONNECTED' && isFullscreen && hasClosedOtherTabs
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isVideoActive && isMicActive && faceState === 'PRESENT' && socketStatus === 'CONNECTED' && isFullscreen && hasClosedOtherTabs
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`} />
                  {isVideoActive && isMicActive && faceState === 'PRESENT' && socketStatus === 'CONNECTED' && isFullscreen && hasClosedOtherTabs
                    ? "READY TO START"
                    : "VERIFYING CHECKS"}
                </span>
              </div>
            </div>

            {/* 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              
              {/* Left Column: Live Camera + 4 Badges + System Readiness */}
              <div className="space-y-3">
                {/* Live Camera Preview Box */}
                <div 
                  onClick={!isVideoActive ? requestCameraAccess : undefined}
                  className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-xl group cursor-pointer"
                >
                  <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${isVideoActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">
                      {isVideoActive ? "Camera Active" : "Click to Enable Camera"}
                    </span>
                  </div>

                  {!isVideoActive && (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <CameraOff className="w-8 h-8 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                      <span className="text-xs uppercase tracking-wider group-hover:text-zinc-300 transition-colors">Click to enable camera</span>
                    </div>
                  )}

                  <video 
                    ref={attachVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                  <canvas 
                    ref={canvasOverlayRef}
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  />
                </div>

                {/* 4 Status Badges */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/40 border border-white/5 text-zinc-300 text-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${isVideoActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {isVideoActive ? "✓" : "●"}
                    </div>
                    <span className="text-[10px]">Camera</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/40 border border-white/5 text-zinc-300 text-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${isMicActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {isMicActive ? "✓" : "●"}
                    </div>
                    <span className="text-[10px]">Mic</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/40 border border-white/5 text-zinc-300 text-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${faceState === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'}`}>
                      {faceState === 'PRESENT' ? "✓" : "●"}
                    </div>
                    <span className="text-[10px]">Face In View</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/40 border border-white/5 text-zinc-300 text-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${isFullscreen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'}`}>
                      {isFullscreen ? "✓" : "●"}
                    </div>
                    <span className="text-[10px]">Fullscreen</span>
                  </div>
                </div>

                {/* Pre-Flight Checklist Card */}
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-[11px] text-zinc-300 font-mono space-y-1">
                  <div className="flex justify-between items-center text-zinc-400 font-bold uppercase text-[10px] pb-1 border-b border-white/5">
                    <span>System Readiness</span>
                    <span className={socketStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'}>
                      {socketStatus === 'CONNECTED' ? 'ONLINE' : 'CONNECTING...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Camera & Audio Stream:</span>
                    <span className={isVideoActive && isMicActive ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {isVideoActive && isMicActive ? "✓ Active" : "● Pending Access"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Face Recognition:</span>
                    <span className={faceState === 'PRESENT' ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {faceState === 'PRESENT' ? "✓ Face Verified" : "● Position Face In Frame"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">AI Proctoring Tunnel:</span>
                    <span className={socketStatus === 'CONNECTED' && inferenceLatency > 0 ? "text-emerald-400 font-bold" : "text-cyan-400"}>
                      {socketStatus === 'CONNECTED' && inferenceLatency > 0 ? "✓ Connected" : "● Initializing..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Fullscreen & Tab Removal + Guidelines + Start Button */}
              <div className="space-y-3 flex flex-col justify-between h-full">
                
                {/* Fullscreen & Tab Removal Protocol Card */}
                <div className="bg-zinc-950/90 p-4 rounded-2xl border border-cyan-500/30 space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between pb-1 border-b border-white/5">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                      <Maximize2 className="w-4 h-4 shrink-0" />
                      <span>Locked Fullscreen Protocol</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-bold">
                      REQUIRED
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    Close all other browser tabs and external applications. The interview must run in exclusive locked fullscreen mode.
                  </p>

                  {!isFullscreen ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={requestFullscreenMode}
                      className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 border-cyan-500/40 text-cyan-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    >
                      <Maximize2 className="w-4 h-4 text-cyan-400" />
                      Click to Enter Fullscreen Mode
                    </Button>
                  ) : (
                    <div className="w-full p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Fullscreen Mode Active</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        LOCKED
                      </span>
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasClosedOtherTabs}
                      onChange={(e) => setHasClosedOtherTabs(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500/20 bg-zinc-900 cursor-pointer"
                    />
                    <div className="text-xs text-zinc-300 space-y-0.5">
                      <span className="font-semibold text-white block">
                        I confirm all other browser tabs and external apps are closed
                      </span>
                      <span className="text-[11px] text-zinc-400 block leading-tight">
                        Exiting fullscreen or switching tabs will be logged as an integrity violation.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Integrity Guidelines Card */}
                <div className="bg-zinc-950/90 p-3 rounded-2xl border border-amber-500/20 text-xs text-zinc-300 space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider pb-1 border-b border-white/5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Interview Integrity Guidelines</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-zinc-300">
                    <div className="flex items-start gap-1">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Quiet, well-lit room</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Keep face inside camera</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Look forward at screen</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>No secondary devices/phones</span>
                    </div>
                  </div>
                </div>

                {/* Start Interview Action Button */}
                <Button
                  size="lg"
                  onClick={handleStartInterview}
                  disabled={
                    isStartingInterview || 
                    !isVideoActive || 
                    !isMicActive || 
                    faceState !== 'PRESENT' || 
                    socketStatus !== 'CONNECTED' || 
                    inferenceLatency === 0 ||
                    !isFullscreen ||
                    !hasClosedOtherTabs
                  }
                  className={`w-full py-5 text-sm md:text-base font-semibold rounded-2xl transition-all duration-300 ${
                    isVideoActive && isMicActive && faceState === 'PRESENT' && socketStatus === 'CONNECTED' && inferenceLatency > 0 && isFullscreen && hasClosedOtherTabs
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] cursor-pointer' 
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50 cursor-not-allowed'
                  }`}
                >
                  {isStartingInterview ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Starting AI Session...
                    </span>
                  ) : !isFullscreen ? (
                    <span className="flex items-center gap-2">
                      <Maximize2 className="w-4 h-4 text-cyan-400" /> Enter Fullscreen Above to Unlock
                    </span>
                  ) : !hasClosedOtherTabs ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400" /> Confirm Tab Checkbox Above
                    </span>
                  ) : isVideoActive && isMicActive && faceState === 'PRESENT' && socketStatus === 'CONNECTED' && inferenceLatency > 0 ? (
                    <span className="flex items-center gap-2">
                      <Maximize2 className="w-4 h-4" /> Start Interview <ArrowRight className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying Hardware & Face...
                    </span>
                  )}
                </Button>

              </div>

            </div>

          </div>
        </div>
      ) : (
        <>
          {/* Persistent Camera PiP in Interview View */}
          <div 
            className="fixed top-20 right-6 z-30 w-44 md:w-52 aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
          >
            <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[9px] font-bold uppercase tracking-wider text-zinc-200">
              <span className={`w-1.5 h-1.5 rounded-full ${isVideoActive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
              <span>{isVideoActive ? "Camera Active" : "Camera Offline"}</span>
            </div>
            {!isVideoActive && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-500">
                <CameraOff className="w-5 h-5" />
                <span className="text-[10px] uppercase">No Signal</span>
              </div>
            )}
            <video 
              ref={attachVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            <canvas 
              ref={canvasOverlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />
          </div>

          {/* Header */}
          <header className="px-6 py-4 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-2xl z-10">
            <div className="flex items-center gap-3 relative">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse" />
              <span className="text-zinc-200 font-semibold tracking-wider uppercase text-xs">Lumina Core Active</span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/40 text-cyan-300">
                Question {Math.min(10, Math.max(1, messages.filter(m => m.role === 'assistant').length))} / 10
              </span>
            </div>

            {/* Header Status & Kokoro TTS Audio Controls */}
            <div className="flex items-center gap-3">
              {/* Barge-In Interruption Indicator */}
              {isBargeInActive && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md animate-pulse">
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span>Candidate Interrupted (Barge-In Active)</span>
                </div>
              )}

              {/* Audio Status & Controls */}
              {kokoroTTS.isPlaying ? (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold backdrop-blur-md">
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 h-full bg-violet-400 animate-pulse" />
                    <span className="w-0.5 h-2/3 bg-violet-400 animate-pulse delay-75" />
                    <span className="w-0.5 h-full bg-violet-400 animate-pulse delay-150" />
                    <span className="w-0.5 h-1/2 bg-violet-400 animate-pulse delay-100" />
                  </div>
                  <span>AI Interviewer Speaking...</span>
                </div>
              ) : kokoroTTS.isSynthesizing ? (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-md">
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  <span>Preparing Audio...</span>
                </div>
              ) : kokoroTTS.lastSpokenText ? (
                <button
                  type="button"
                  onClick={() => kokoroTTS.replayLastQuestion()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-medium backdrop-blur-md transition-all cursor-pointer"
                  title="Replay last spoken question"
                >
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Replay Audio</span>
                </button>
              ) : null}

              {/* 30-Minute Live Countdown Timer */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border backdrop-blur-md transition-all ${
                  secondsRemaining <= 120
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                    : secondsRemaining <= 300
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    : "bg-white/5 border-white/10 text-cyan-300"
                }`}
                title="Interview time remaining"
              >
                <Timer className={`w-3.5 h-3.5 ${secondsRemaining <= 120 ? 'text-rose-400' : secondsRemaining <= 300 ? 'text-amber-400' : 'text-cyan-400'}`} />
                <span>{formatTimeRemaining(secondsRemaining)} / 30:00</span>
              </div>

              {/* Live Session Status Indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md bg-white/5 border-white/10 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Session Active
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleConcludeClick}
              disabled={isProcessing || isRecording || isEvaluating || isConcludingEarly || !sessionId}
              className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white backdrop-blur-md transition-all rounded-full px-6 cursor-pointer"
            >
              {isEvaluating || isConcludingEarly ? <Loader2 className="w-4 h-4 animate-spin" /> : "Conclude Session"}
            </Button>
          </header>

          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 scroll-smooth z-10 w-full max-w-5xl mx-auto space-y-6">
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex w-full justify-start"
                >
                  <div className="bg-black/60 border border-cyan-500/30 text-zinc-200 rounded-3xl rounded-tl-sm p-6 max-w-[85%] shadow-2xl backdrop-blur-md flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Initializing AI Interview</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Lumina AI is preparing your first scenario question...</p>
                    </div>
                  </div>
                </motion.div>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex w-full ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-3xl p-5 leading-relaxed tracking-wide text-sm md:text-base border shadow-2xl backdrop-blur-md ${
                      msg.role === "assistant" 
                      ? "bg-black/60 border-white/10 text-zinc-100 rounded-tl-sm shadow-[0_4px_30px_rgba(0,0,0,0.5)]" 
                      : "bg-gradient-to-tr from-cyan-600 to-cyan-500 border-cyan-400/20 text-white rounded-tr-sm shadow-[0_4px_25px_rgba(34,211,238,0.25)]"
                    }`}
                  >
                    {msg.content.includes('```') ? (
                      <div className="space-y-2">
                        {msg.content.split('```').map((part, index) => {
                          if (index % 2 === 1) {
                            const lines = part.trim().split('\n');
                            const lang = lines[0].match(/^[a-z0-9_-]+/i) ? lines[0] : '';
                            const codeText = lang ? lines.slice(1).join('\n') : part;
                            return (
                              <div key={index} className="rounded-xl overflow-hidden bg-black/80 border border-cyan-500/30 my-2 font-mono text-xs shadow-inner">
                                {lang && (
                                  <div className="px-3 py-1 bg-white/5 border-b border-white/5 text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                                    {lang}
                                  </div>
                                )}
                                <pre className="p-3.5 overflow-x-auto text-emerald-300 leading-relaxed font-mono whitespace-pre-wrap">
                                  <code>{codeText}</code>
                                </pre>
                              </div>
                            );
                          }
                          return <p key={index} className="whitespace-pre-wrap">{part}</p>;
                        })}
                      </div>
                    ) : (
                      <div>{msg.content}</div>
                    )}
                    {msg.role === "assistant" && (
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10 text-xs">
                        <button
                          type="button"
                          onClick={() => kokoroTTS.speakQuestion(msg.content, () => startSilenceStopwatch())}
                          className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-all cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                          <span>{kokoroTTS.isPlaying && kokoroTTS.lastSpokenText === msg.content ? "Speaking Question..." : "🔊 Speak Question"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex w-full justify-start"
                >
                  <div className="bg-zinc-900/50 border border-white/5 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-200" />
                  </div>
                </motion.div>
              )}

              {/* Interactive Live Coding Challenge Panel */}
              {activeCodeChallenge && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="w-full rounded-3xl p-6 bg-zinc-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] backdrop-blur-2xl space-y-4"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white tracking-wide">{activeCodeChallenge.title}</h3>
                          <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {activeCodeChallenge.language}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">
                          Repository Anchor: <span className="text-cyan-300 font-semibold">{activeCodeChallenge.repoName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCodeSolution(activeCodeChallenge.starterCode)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-mono transition-all cursor-pointer border border-white/5"
                        title="Reset code to starter template"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  {/* Description & Expected Behavior */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/5 text-xs text-zinc-300 space-y-2 font-sans leading-relaxed">
                    <p className="text-zinc-200 text-sm">{activeCodeChallenge.description}</p>
                    <p className="text-[11px] text-zinc-400 font-mono pt-1 border-t border-white/5">
                      <strong className="text-cyan-400">Expected:</strong> {activeCodeChallenge.expectedBehavior}
                    </p>
                  </div>

                  {/* Live Code Area */}
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
                    <div className="px-4 py-2 bg-black/60 border-b border-white/5 flex justify-between items-center text-[11px] font-mono text-zinc-400">
                      <span className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>solution.{activeCodeChallenge.language === 'python' ? 'py' : 'ts'}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 text-[10px]">Tab key indented</span>
                      </div>
                    </div>

                    <textarea
                      value={codeSolution}
                      onChange={(e) => setCodeSolution(e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        handleCodePaste(pasted);
                      }}
                      onKeyDown={(e) => {
                        recordKeystroke();
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart;
                          const end = target.selectionEnd;
                          const val = target.value;
                          const updated = val.substring(0, start) + '  ' + val.substring(end);
                          setCodeSolution(updated);
                          setTimeout(() => {
                            target.selectionStart = target.selectionEnd = start + 2;
                          }, 0);
                        }
                      }}
                      rows={9}
                      placeholder="Type your implementation here..."
                      className="w-full bg-transparent p-4 font-mono text-xs md:text-sm text-cyan-200 outline-none resize-none leading-relaxed selection:bg-cyan-500/30"
                      spellCheck={false}
                    />
                  </div>

                  {/* Action footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Authentic Authorship Check • Real-Time Technical Evaluation
                    </span>
                    <Button
                      onClick={handleSubmitCodeSolution}
                      disabled={isSubmittingCode || !codeSolution.trim()}
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white font-semibold text-xs rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.35)] cursor-pointer"
                    >
                      {isSubmittingCode ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Evaluating Code...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Submit Code Implementation
                        </span>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </main>

          {/* Interactive Controls (Mic) */}
          {/* Interactive Controls (Mic & Post-TTS Latency Stopwatch) */}
          <div className="relative w-full pb-8 pt-4 flex flex-col justify-center items-center z-10 bg-gradient-to-t from-black via-black/80 to-transparent">
            {/* Live post-TTS latency measured silently in background */}
            {isRecording && (
              <div className="mb-3 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>Recording your answer... (Click mic when done)</span>
              </div>
            )}
            <button
              onClick={handleRecordToggle}
              disabled={isProcessing}
              className={`relative group flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 ease-out focus:outline-none ${
                 isProcessing 
                  ? "bg-zinc-900 border border-white/5 cursor-not-allowed"
                  : isRecording 
                    ? "bg-red-500/10 border border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.4)]" 
                    : "bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.4)] hover:shadow-[0_0_60px_rgba(34,211,238,0.6)] hover:scale-105 border border-white/20"
              }`}
            >
              {isRecording ? (
                <div className="w-8 h-8 bg-red-500 rounded-sm animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              ) : isProcessing ? (
                <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              ) : (
                <Mic className="w-10 h-10 text-white drop-shadow-md" />
              )}

              {/* Premium Aurora Recording Rings */}
              {isRecording && (
                <>
                  <span className="absolute w-[160%] h-[160%] border border-red-500/40 rounded-full animate-ping duration-[3000ms]" />
                  <span className="absolute w-[130%] h-[130%] border border-red-500/60 rounded-full animate-ping duration-[2000ms]" />
                </>
              )}
            </button>
            
            <Button 
              onClick={handleGenerateQuestion} 
              disabled={isProcessing || isRecording || !sessionId}
              title={!sessionId ? "Waiting for session to start..." : "Generate a new question"}
              className={`absolute right-10 md:right-20 border rounded-xl px-4 py-2 flex items-center gap-2 transition-all shadow-lg ${
                sessionId && !isProcessing && !isRecording
                  ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/10 cursor-pointer"
                  : "bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed"
              }`}
            >
              {!sessionId ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Session loading...</>
              ) : (
                <>Generate Question <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Early Conclusion Confirmation Modal */}
      <AnimatePresence>
        {showConcludeEarlyModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-zinc-950 border border-rose-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Conclude Interview Early?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are concluding before answering all questions. If you proceed, this session will end immediately, your application will be marked as <span className="text-rose-400 font-semibold">Rejected</span>, and you will not be able to retake this test.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConcludeEarlyModal(false)}
                  className="flex-1 py-3 border-white/10 text-zinc-300 hover:bg-white/5 rounded-xl cursor-pointer text-xs"
                >
                  Continue Interview
                </Button>
                <Button
                  onClick={handleConfirmConcludeEarly}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.4)] cursor-pointer text-xs"
                >
                  End & Reject
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Modal Overlay */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-6"
            >
              <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
                <div className="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center">
                  <MessageSquareHeart className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Interview Concluded</h2>
                  <p className="text-sm text-zinc-400">Please provide feedback about your experience.</p>
                </div>
              </div>
              
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="What problems did you face? How could we improve this AI Interview?"
                className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800" onClick={handleSkipFeedback}>
                  Skip
                </Button>
                <Button 
                  onClick={handleSubmitFeedback} 
                  disabled={isSubmittingFeedback}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-6"
                >
                  {isSubmittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit & Finish"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Candidate Completion Screen (Clean, Professional, No Scores or Telemetry Shown) */}
      {isInterviewCompleted && (
        <div className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-black p-6 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-black to-black pointer-events-none" />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="z-10 max-w-lg w-full bg-zinc-900/90 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Assessment Completed
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {isDemo ? "Demo Interview Complete!" : "Thank You for Taking the Exam!"}
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {isDemo 
                  ? "Your 10-question demo assessment has been completed and fully evaluated with proctoring telemetry." 
                  : "Your interview session and technical responses have been securely recorded and submitted to MANAKIN.AI."}
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-black/60 border border-white/5 text-left text-xs text-zinc-400 space-y-2">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Session Securely Saved & Evaluated</span>
              </div>
              <p className="text-zinc-500 leading-normal pl-6">
                Your responses and proctoring verification have been securely recorded and submitted to the hiring team.
              </p>
            </div>

            <div className="pt-2 w-full flex flex-col gap-3">
              {isDemo && user?.role === 'RECRUITER' && (
                <Button
                  onClick={() => router.push(`/evaluation?sessionId=${sessionId}&isDemo=true`)}
                  className="w-full py-5 text-sm font-semibold rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:opacity-95 text-white transition-all shadow-[0_0_25px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>View Evaluation & Proctoring Report</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              <Button
                onClick={() => router.push("/")}
                className="w-full py-5 text-sm font-semibold rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 transition-all shadow-lg cursor-pointer"
              >
                Close Session & Return to Home
              </Button>
            </div>

            <p className="text-[11px] text-zinc-600">
              You may now safely close this browser window or tab.
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
