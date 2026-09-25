"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Sparkles, ArrowRight, CheckCircle2, ShieldCheck, 
  AlertCircle, Upload, Video, Mic, Camera, Loader2, 
  Play, FileCheck, Check, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  getInvitationByTokenAPI, 
  uploadResumeAPI, 
  startInvitedInterviewAPI,
  recordInterviewExitAPI
} from "@/services/api";
import { useInterviewStore } from "@/lib/store";

export default function InviteLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const { setInvitationToken, setSessionId, setCandidateName, addMessage } = useInterviewStore();

  const [invitation, setInvitation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resume Upload State
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  // Media / System Check State
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start Interview State
  const [isStartingInterview, setIsStartingInterview] = useState(false);

  useEffect(() => {
    if (token) {
      setInvitationToken(token);
    }
  }, [token, setInvitationToken]);

  // Load invitation details
  const fetchInvitation = async () => {
    if (!token) return;
    try {
      const data = await getInvitationByTokenAPI(token);
      setInvitation(data);
    } catch (err: any) {
      console.error("Failed to resolve invitation token:", err);
      setError(err?.response?.data?.message || "Invalid or expired interview link");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitation();
  }, [token]);

  // Hardware Camera & Microphone Initializer
  const requestMediaAccess = async () => {
    setMediaError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch((e) => console.warn("Preview play warning:", e));
      }

      setIsVideoActive(stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].readyState === "live");
      setIsMicActive(stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].readyState === "live");
      toast.success("Camera & Microphone initialized successfully!");
    } catch (err: any) {
      console.error("Media permission error:", err);
      setMediaError("Camera or microphone permission was denied. Please allow access in your browser.");
      setIsVideoActive(false);
      setIsMicActive(false);
    }
  };

  // Clean up media on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Track mid-interview exit: if interview was started and user leaves, increment exit count
  const [interviewStarted, setInterviewStarted] = useState(false);
  useEffect(() => {
    if (!interviewStarted || !invitation?.id) return;

    const handleExit = () => {
      // Use sendBeacon for reliability on tab close
      const payload = JSON.stringify({ invitationId: invitation.id, sessionId: null });
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/applicant/interview/exit`,
        new Blob([payload], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleExit);
    return () => window.removeEventListener('beforeunload', handleExit);
  }, [interviewStarted, invitation?.id]);

  // Auto-request camera check once invitation loads
  useEffect(() => {
    if (invitation && !isVideoActive && !mediaError) {
      requestMediaAccess();
    }
  }, [invitation]);

  // Handle Resume Upload directly via invitation token
  const handleResumeFileSelect = async (file: File) => {
    if (!file || !invitation) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Invalid file format. Please upload a PDF file (.pdf)");
      return;
    }

    setIsUploadingResume(true);
    try {
      await uploadResumeAPI(file, invitation.applicantId || undefined, token);
      toast.success("Resume uploaded & analyzed by AI!", {
        description: "Your qualifications and skills have been processed."
      });
      await fetchInvitation();
    } catch (err: any) {
      console.error("Failed to upload resume:", err);
      toast.error("Resume upload failed", {
        description: err?.response?.data?.message || err.message
      });
    } finally {
      setIsUploadingResume(false);
    }
  };

  // Handle Start Interview (Gated by Dual Readiness: Resume + Hardware)
  const handleStartInterview = async () => {
    if (!invitation) return;

    if (!invitation.applicantResume) {
      toast.error("Resume required", {
        description: "Please upload your resume PDF in Step 1 before starting the interview."
      });
      return;
    }

    if (!isVideoActive || !isMicActive) {
      toast.error("Hardware check required", {
        description: "Please enable your camera and microphone in Step 2 before starting the interview."
      });
      return;
    }

    setIsStartingInterview(true);
    try {
      const candidateName = invitation.applicant?.name || invitation.applicantEmail.split("@")[0] || "Candidate";
      const candidateEmail = invitation.applicantEmail;
      setCandidateName(candidateName);

      // Release preview stream so interview room can attach camera without contention
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Start custom interview session linked to invitation
      const data = await startInvitedInterviewAPI(
        invitation.id,
        candidateName,
        candidateEmail,
        invitation.githubUrl
      );

      setSessionId(data.sessionId);
      if (data.question) {
        addMessage({
          id: "msg_first",
          role: "assistant",
          content: data.question,
        });
      }

      toast.success("Interview session initialized! Entering interview room...");
      setInterviewStarted(true);
      router.push("/interview");
    } catch (err: any) {
      console.error("Failed to start interview:", err);
      toast.error("Failed to start interview", {
        description: err?.response?.data?.message || err.message || "Please check backend connection and retry."
      });
    } finally {
      setIsStartingInterview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 text-cyan-400 font-mono tracking-widest text-sm uppercase">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span>Resolving candidate interview invitation...</span>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 p-8 rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Invalid or Expired Link</h2>
          <p className="text-xs text-zinc-400">
            {error || "This interview invitation token does not exist or has expired. Please request a new invitation from your recruiter."}
          </p>
          <Button onClick={() => router.push("/")} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  // No retake: interview already completed
  if (invitation.completedAt) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-emerald-500/20 p-8 rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Interview Completed</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            You have already completed this interview. Retakes are not permitted.<br />
            Your recruiter will review your results and contact you with next steps.
          </p>
        </div>
      </div>
    );
  }

  // Exit-locked: candidate exited 3 or more times
  if (invitation.exitCount >= 3) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-amber-500/20 p-8 rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Interview Link Locked</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            You have exited this interview 3 times. This link is now locked.<br />
            Please contact your recruiter to receive a new invitation link.
          </p>
        </div>
      </div>
    );
  }

  const job = invitation.jobDescription;
  const isResumeReady = !!invitation.applicantResume;
  const isSystemReady = isVideoActive && isMicActive;
  const bothThingsReady = isResumeReady && isSystemReady;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Aurora Ambience */}
      <div className="absolute top-0 opacity-20 transform -translate-x-1/4 -translate-y-1/4 w-[600px] h-[600px] bg-cyan-600 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-violet-600 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl z-10 my-8"
      >
        <Card className="border border-white/10 bg-black/60 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-6 sm:p-8 rounded-[2.5rem] space-y-6">
          
          {/* Header & Company Brand */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>MANAKIN.AI Technical Assessment</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {job?.title || "Technical Interview"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Dispatched by <span className="text-cyan-300 font-medium">{invitation.recruiter?.name || invitation.recruiter?.email || "Talent Acquisition"}</span>
            </p>
          </div>

          {/* Job Overview Card */}
          {job?.aiSummary && (
            <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5 space-y-1.5 text-xs text-zinc-300">
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Position Summary
              </span>
              <p className="leading-relaxed text-zinc-300">{job.aiSummary}</p>
            </div>
          )}

          {/* DUAL READINESS PREPARATION (RESUME + SYSTEM) - NO PASSWORD BARRIER */}
          <div className="space-y-6">

            {/* Verified Candidate Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/60 px-4 py-3 rounded-2xl border border-white/10 text-xs text-zinc-400">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Verified Candidate: <strong className="text-white font-mono">{invitation.applicantEmail}</strong></span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                Official Recruiter Invite
              </span>
            </div>

            {/* READINESS CHECKLIST BAR */}
            <div className="bg-zinc-950/80 p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">Dual Readiness Status</span>
                <span className={bothThingsReady ? "text-emerald-400 font-bold flex items-center gap-1" : "text-amber-400 font-semibold flex items-center gap-1"}>
                  {bothThingsReady ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Both Ready to Start
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Complete 2 Requirements Below
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                  isResumeReady ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    isResumeReady ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isResumeReady ? "✓" : "1"}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-[11px]">1. Resume PDF</div>
                    <div className="text-[10px] text-zinc-400">{isResumeReady ? "Uploaded & Analyzed" : "Upload Pending"}</div>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                  isSystemReady ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    isSystemReady ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isSystemReady ? "✓" : "2"}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-[11px]">2. Camera & Mic</div>
                    <div className="text-[10px] text-zinc-400">{isSystemReady ? "Live & Verified" : "Permission Needed"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* REQUIREMENT 1: RESUME PDF UPLOAD */}
            <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Step 1: Upload Resume</h3>
                </div>
                {isResumeReady ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Required
                  </span>
                )}
              </div>

              {isResumeReady ? (
                <div className="bg-zinc-950 p-4 rounded-xl border border-emerald-500/20 space-y-2">
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>File: <strong className="text-white">{invitation.applicantResume?.fileName}</strong></span>
                    <label className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer underline">
                      Replace PDF
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        disabled={isUploadingResume}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleResumeFileSelect(file);
                        }}
                      />
                    </label>
                  </div>
                  {invitation.applicantResume?.aiSummary && (
                    <p className="text-xs text-zinc-300 leading-relaxed italic bg-zinc-900/60 p-3 rounded-lg border border-white/5">
                      "{invitation.applicantResume.aiSummary}"
                    </p>
                  )}
                  {invitation.githubUrl && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
                      <span className="text-emerald-300 font-mono font-semibold flex items-center gap-1.5">
                        🐙 GitHub Profile: {invitation.githubUrl}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Analyzing 15 latest repositories & architectures
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl bg-zinc-950/60 hover:bg-zinc-950 transition-all text-center group">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                    {isUploadingResume ? (
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    ) : (
                      <Upload className="w-6 h-6 text-cyan-400" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {isUploadingResume ? "Analyzing Resume PDF with AI..." : "Click or Drop Resume PDF (.pdf)"}
                  </span>
                  <span className="text-xs text-zinc-500 mt-1">
                    Our system extracts your verified technical skills & projects for dynamic assessment
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={isUploadingResume}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleResumeFileSelect(file);
                    }}
                  />
                </label>
              )}
            </div>

            {/* REQUIREMENT 2: SYSTEM / CAMERA / AUDIO CHECK */}
            <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Step 2: Camera & Audio Pre-Flight Check</h3>
                </div>
                {isSystemReady ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Required
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Video Preview Box */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-white/10 flex items-center justify-center">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isVideoActive ? "block" : "hidden"}`}
                  />
                  {!isVideoActive && (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
                      <Camera className="w-8 h-8 text-zinc-600" />
                      <span className="text-xs">Camera preview offline</span>
                    </div>
                  )}

                  {isVideoActive && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 border border-white/10 text-[9px] text-emerald-400 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </div>
                  )}
                </div>

                {/* Hardware Diagnostics */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center bg-zinc-950 px-3 py-2.5 rounded-xl border border-white/5">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Video Camera:
                    </span>
                    <span className={isVideoActive ? "text-emerald-400 font-bold" : "text-amber-400"}>
                      {isVideoActive ? "✓ Active" : "● Offline"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950 px-3 py-2.5 rounded-xl border border-white/5">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5" /> Microphone:
                    </span>
                    <span className={isMicActive ? "text-emerald-400 font-bold" : "text-amber-400"}>
                      {isMicActive ? "✓ Connected" : "● Offline"}
                    </span>
                  </div>

                  {mediaError && (
                    <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                      {mediaError}
                    </p>
                  )}

                  {(!isVideoActive || !isMicActive) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={requestMediaAccess}
                      className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs rounded-xl cursor-pointer"
                    >
                      Enable Camera & Microphone Access
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* MANDATORY ASSESSMENT & PROCTORING INTEGRITY GUIDELINES */}
            <div className="bg-zinc-950/90 p-5 rounded-2xl border border-amber-500/30 space-y-3 shadow-[0_0_25px_rgba(245,158,11,0.08)]">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider pb-2 border-b border-white/5">
                <AlertCircle className="w-4 h-4" />
                <span>Mandatory Assessment Guidelines & Environment Setup</span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-300 leading-relaxed font-sans">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold mt-0.5">•</span>
                  <span><strong>Close All Other Browser Tabs:</strong> Close all other open tabs in this browser and background apps (Slack, Discord, ChatGPT, IDEs). The interview requires exclusive fullscreen mode.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold mt-0.5">•</span>
                  <span><strong>Clean & Well-Lit Background:</strong> Ensure your room is quiet and your face is evenly illuminated with no backlighting or shadows.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold mt-0.5">•</span>
                  <span><strong>Keep Head Still & Centered:</strong> Position your webcam at eye level. Minimize sudden movements or turning away from the camera.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold mt-0.5">•</span>
                  <span><strong>Maintain Gaze on Screen:</strong> Look directly at the interview screen. Avoid reading notes, glancing at secondary monitors, or looking down at your lap/desk.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold mt-0.5">•</span>
                  <span><strong>Zero Unauthorized Devices:</strong> Mobile phones, secondary tablets, smartwatches, and headphones must remain out of camera view and cannot be used.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold mt-0.5">•</span>
                  <span className="text-zinc-400"><em>Automated 3D gaze tracking, posture analysis, full screen monitoring, and visual object detection actively verify compliance throughout this session.</em></span>
                </li>
              </ul>
            </div>

            {/* DUAL READINESS ACTION: START INTERVIEW BUTTON */}
            <div className="pt-2">
              <Button
                size="lg"
                disabled={!bothThingsReady || isStartingInterview}
                onClick={handleStartInterview}
                className={`w-full py-6 text-base font-bold rounded-2xl transition-all duration-300 shadow-xl flex items-center justify-center gap-2 ${
                  bothThingsReady
                    ? "bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:opacity-95 text-white shadow-[0_0_30px_rgba(20,184,166,0.4)] cursor-pointer"
                    : "bg-zinc-800/80 text-zinc-500 border border-white/5 cursor-not-allowed"
                }`}
              >
                {isStartingInterview ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Starting Interview...
                  </span>
                ) : bothThingsReady ? (
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" /> Start Interview Now <ArrowRight className="w-5 h-5" />
                  </span>
                ) : !isResumeReady ? (
                  <span>Upload Resume Above to Unlock Interview</span>
                ) : (
                  <span>Enable Camera & Microphone Above to Unlock Interview</span>
                )}
              </Button>

              <p className="text-center text-[11px] text-zinc-500 mt-2.5">
                AI Proctoring and Voice Evaluation will automatically engage once you click Start Interview.
              </p>
            </div>

          </div>

        </Card>
      </motion.div>
    </div>
  );
}
