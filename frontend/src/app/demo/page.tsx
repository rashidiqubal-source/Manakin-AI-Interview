"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Camera, CameraOff, Mic, MicOff, Shield, ShieldCheck, ArrowRight, 
  Sparkles, CheckCircle2, AlertCircle, Smartphone, Eye, Cloud, Lock, 
  Terminal, Play, ArrowLeft, RefreshCw, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { startInterviewAPI } from "@/services/api";
import { useInterviewStore } from "@/lib/store";
import { useAuthStore } from "@/lib/authStore";

export default function DemoInterviewPage() {
  const router = useRouter();
  const { setCandidateName, setSessionId, addMessage, reset, setIsDemo } = useInterviewStore();
  const { user, isInitialized } = useAuthStore();

  // Recruiter-only guard — redirect everyone else to sign-in
  useEffect(() => {
    if (!isInitialized) return;
    if (!user || user.role !== "RECRUITER") {
      toast.error("Demo interviews are available for recruiters only.");
      router.replace("/recruiter/sign-in");
    }
  }, [isInitialized, user, router]);

  const [name, setName] = useState("Demo Candidate");
  const [email, setEmail] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  // Hardware Diagnostic State
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isCheckingHardware, setIsCheckingHardware] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Auto-request camera and microphone access on load
  const requestHardwareAccess = async () => {
    setIsCheckingHardware(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch((e) => console.warn("Preview play:", e));
      }

      const hasVideo = stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].readyState === "live";
      const hasAudio = stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].readyState === "live";

      setIsVideoActive(hasVideo);
      setIsMicActive(hasAudio);

      // Set up simple audio volume monitor
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (audioErr) {
        console.warn("Audio meter setup note:", audioErr);
      }

      toast.success("Camera and microphone verified!");
    } catch (err: any) {
      console.error("Hardware permission denied:", err);
      toast.error("Hardware Permission Denied", {
        description: "Please allow camera and microphone access to test proctoring during the demo.",
      });
      setIsVideoActive(false);
      setIsMicActive(false);
    } finally {
      setIsCheckingHardware(false);
    }
  };

  useEffect(() => {
    requestHardwareAccess();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const handleStartDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a candidate name to begin.");
      return;
    }

    setIsStarting(true);
    try {
      reset(); // Clear previous session state
      setIsDemo(true);
      setCandidateName(name.trim());

      // Release preview stream so interview room can attach webcam without contention
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      // Initialize demo session on backend with isDemo: true (Zero OpenAI calls)
      const data = await startInterviewAPI(name.trim(), email.trim() || undefined, true);

      setSessionId(data.sessionId);
      if (data.question) {
        addMessage({
          id: "msg_first",
          role: "assistant",
          content: data.question,
        });
      }

      toast.success("Demo interview initialized! Entering interview room...");
      router.push("/interview");
    } catch (err: any) {
      console.error("Failed to start demo interview:", err);
      toast.error("Failed to start demo interview", {
        description: err?.response?.data?.message || err.message || "Please check backend connection.",
      });
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black text-white p-4 sm:p-8 flex items-center justify-center relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 opacity-25 transform translate-x-1/4 -translate-y-1/4 w-[600px] h-[600px] bg-cyan-600 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 opacity-25 transform -translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-violet-600 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 10 Static Questions • Full Proctoring
          </span>
        </div>

        {/* Main Card */}
        <Card className="border border-white/10 bg-black/60 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] rounded-[2rem] overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-zinc-800/80 bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-white">
                Live Demo Technical Interview
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Experience 10 foundational Computer Science questions with real-time phone detection, face tracking, and photo violation capture.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-3 py-1.5 rounded-xl self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ready to Test
            </div>
          </div>

          <form onSubmit={handleStartDemo} className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Column 1: Candidate Info & Proctoring Features */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Your Name (for report & session)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Email Address (optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                  />
                </div>

                {/* Proctoring Highlights */}
                <div className="pt-2">
                  <h3 className="text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider font-mono">
                    Active Security & Proctoring Controls
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-zinc-300">YOLO Phone Detection</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-zinc-300">1.0s Face Departure</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-zinc-300">Photo Evidence Snapshots</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-zinc-300">3D Gaze Dwell</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                  <strong className="text-white">Deterministic & Fast:</strong> Each answer is acknowledged with <em className="text-cyan-300 font-mono">"Great!"</em> before moving sequentially to the next static question with zero latency.
                </div>
              </div>

              {/* Column 2: Live Hardware Diagnostic Preview */}
              <div className="space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-400" /> Live Webcam Preview
                  </span>
                  <button
                    type="button"
                    onClick={requestHardwareAccess}
                    disabled={isCheckingHardware}
                    className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingHardware ? "animate-spin" : ""}`} /> Retest
                  </button>
                </div>

                {/* Webcam Box */}
                <div className="w-full aspect-video bg-black rounded-2xl border border-zinc-800 overflow-hidden relative flex items-center justify-center shadow-inner">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />

                  {!isVideoActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 bg-zinc-950/90 p-4 text-center">
                      <CameraOff className="w-8 h-8 text-zinc-600" />
                      <span className="text-xs">Camera feed not active</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={requestHardwareAccess}
                        className="text-xs border-zinc-700 mt-1"
                      >
                        Enable Camera
                      </Button>
                    </div>
                  )}

                  {isVideoActive && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Feed Active
                    </div>
                  )}
                </div>

                {/* Microphone Meter */}
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isMicActive ? (
                      <Mic className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <MicOff className="w-4 h-4 text-zinc-500" />
                    )}
                    <span className="text-xs text-zinc-300">
                      {isMicActive ? "Microphone Detected" : "Microphone Offline"}
                    </span>
                  </div>
                  {isMicActive && (
                    <div className="flex items-center gap-1 w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
                        style={{ width: `${Math.max(8, micVolume)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Launch Button */}
            <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-zinc-500 font-mono">
                10 Foundational Computer Science Questions • Instant Start
              </span>

              <Button
                type="submit"
                disabled={isStarting}
                className="w-full sm:w-auto px-8 py-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:opacity-95 text-white font-bold text-base transition-all shadow-[0_0_25px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Initializing Session...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Start 10-Question Demo Interview</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
