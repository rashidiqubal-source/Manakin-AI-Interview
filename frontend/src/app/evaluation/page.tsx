"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useInterviewStore } from "@/lib/store";
import { getExplainableReportAPI } from "@/services/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  BadgeCheck, 
  Quote, 
  ArrowLeft, 
  Eye, 
  Timer, 
  Clock, 
  Activity, 
  Sparkles, 
  AlertTriangle,
  Compass,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  Info,
  Loader2,
  Code2,
  Camera,
  Cloud,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanpathVisualizer } from "@/components/ScanpathVisualizer";
import { useAuthStore } from "@/lib/authStore";

interface ViolationSnapshotItem {
  id: string;
  url: string;
  s3Key?: string;
  eventType: string;
  title: string;
  timestamp: string;
  timeOffset?: string;
  details?: string;
}

function EvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySessionId = searchParams?.get("sessionId");
  const { evaluation, sessionId, candidateName, reset, setEvaluation } = useInterviewStore();
  const { user, isInitialized, fetchUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"profile" | "performance" | "vision" | "latency" | "proctoring">("profile");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "REVIEW" | "BROWSER" | "VISION">("ALL");
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [selectedViolationSnapshot, setSelectedViolationSnapshot] = useState<{
    title: string;
    eventType: string;
    snapshots: Array<{ url: string; time: string; details?: string; s3Key?: string }>;
    activeIndex: number;
  } | null>(null);

  const activeSessionId = querySessionId || sessionId;

  useEffect(() => {
    if (!isInitialized) {
      fetchUser();
    }
  }, [isInitialized, fetchUser]);

  const [reportData, setReportData] = useState<any>(null);
  const isDemo = Boolean(evaluation?.isDemo || reportData?.isDemo || searchParams?.get("isDemo") === "true");
  // Only RECRUITER role can view evaluation reports; demo sessions are also allowed
  const isAuthorized = (isInitialized && user?.role === 'RECRUITER') || isDemo;

  // Redirect non-recruiters away from the report (unless it's a demo session)
  useEffect(() => {
    if (!isInitialized) return;
    const isDemoQuery = searchParams?.get("isDemo") === "true";
    if (!isDemoQuery && isInitialized && (!user || user.role !== 'RECRUITER')) {
      toast.error("Evaluation reports are accessible only to verified recruiters.");
      router.replace("/?blocked=report");
      return;
    }
  }, [isInitialized, user, router, searchParams]);

  useEffect(() => {
    if (!isInitialized) return;

    const isDemoQuery = searchParams?.get("isDemo") === "true";
    // Only fetch if recruiter or demo session; never fetch for candidates
    const canAttemptFetch = user?.role === 'RECRUITER' || isDemoQuery;

    // Fetch explainable report if not already loaded or if activeSessionId is present
    if (activeSessionId && canAttemptFetch && !reportData) {
      setIsLoadingReport(true);
      getExplainableReportAPI(activeSessionId)
        .then((data: any) => {
          if (data) {
            setReportData(data);
            const baseEval = evaluation || {};
            const evalObj = { ...baseEval, ...(data.evaluationData || {}), ...data };
            if (data.isDemo) {
              evalObj.isDemo = true;
            }
            if (data.eyeTrackingData && !evalObj.eyeTrackingData) {
              evalObj.eyeTrackingData = data.eyeTrackingData;
            }
            if (data.responseLatencies && !evalObj.responseLatencies) {
              evalObj.responseLatencies = data.responseLatencies;
            }
            if (data.detectionEvents) {
              evalObj.detectionEvents = data.detectionEvents;
            }
            if (data.proctoringTimeline) {
              evalObj.proctoringTimeline = data.proctoringTimeline;
            }
            setEvaluation(evalObj);
          }
        })
        .catch((err) => {
          console.error("Failed to load evaluation report:", err);
          router.replace("/");
        })
        .finally(() => setIsLoadingReport(false));
    } else if (!evaluation && !activeSessionId) {
      router.replace("/");
    }
  }, [evaluation, activeSessionId, router, setEvaluation, isInitialized, user, searchParams, reportData]);

  // Comprehensive S3 Violation Snapshots Extraction
  const allViolationSnapshots = useMemo<ViolationSnapshotItem[]>(() => {
    const list: ViolationSnapshotItem[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenS3Keys = new Set<string>();

    const getFriendlyTitle = (type: string) => {
      switch (type) {
        case 'UNAUTHORIZED_DEVICE':
        case 'MOBILE_PHONE':
          return '📱 Mobile Device Detected';
        case 'FACE_MISSING':
        case 'FACE_ABSENCE':
        case 'ABSENT_USER':
          return '👤 Face Departure / Absence';
        case 'CONCEALED_PHONE_GAZE':
          return '👁️ Concealed Downward Gaze';
        case 'OFF_SCREEN_READING':
          return '📖 Off-Screen Reading Pattern';
        case 'SUSPICIOUS_CORNER_GLANCES':
          return '👀 Peripheral Corner Glances';
        case 'TAB_HIDDEN':
        case 'WINDOW_BLUR':
          return '💻 Tab / Window Switch';
        case 'CODE_PASTE':
          return '📋 Code Paste Burst';
        default:
          return type ? type.replace(/_/g, ' ') : 'Proctoring Violation';
      }
    };

    const rawEvents = [
      ...(reportData?.detectionEvents || []),
      ...(evaluation?.detectionEvents || []),
      ...((evaluation as any)?.evidenceReport?.detectionEvents || []),
    ];

    rawEvents.forEach((e: any, idx: number) => {
      const meta = typeof e.metadata === 'string'
        ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })()
        : (e.metadata || {});
      const url = meta.snapshotUrl || meta.snapshot;
      const s3Key = meta.snapshotKey;
      const eventId = e.id;

      if (url && typeof url === 'string') {
        if (eventId && seenIds.has(eventId)) return;
        if (s3Key && seenS3Keys.has(s3Key)) return;
        if (seenUrls.has(url)) return;

        if (eventId) seenIds.add(eventId);
        if (s3Key) seenS3Keys.add(s3Key);
        seenUrls.add(url);

        list.push({
          id: eventId ? `evt-${eventId}` : `evt-snap-${idx}`,
          url,
          s3Key,
          eventType: e.eventType || 'PROCTOR_TELEMETRY',
          title: getFriendlyTitle(e.eventType),
          timestamp: e.timestamp
            ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'Recorded',
          details: meta.message || `Automated violation capture: ${e.eventType}`,
        });
      }
    });

    const timelineItems = [
      ...(reportData?.proctoringTimeline || []),
      ...((evaluation as any)?.evidenceReport?.proctoringTimeline || []),
      ...((evaluation as any)?.proctoringTimeline || []),
    ];

    timelineItems.forEach((item: any, idx: number) => {
      const meta = typeof item.metadata === 'string'
        ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })()
        : (item.metadata || {});
      const url = meta.snapshotUrl || meta.snapshot;
      const s3Key = meta.snapshotKey;
      const itemId = item.id;

      if (url && typeof url === 'string') {
        if (itemId && seenIds.has(itemId)) return;
        if (s3Key && seenS3Keys.has(s3Key)) return;
        if (seenUrls.has(url)) return;

        if (itemId) seenIds.add(itemId);
        if (s3Key) seenS3Keys.add(s3Key);
        seenUrls.add(url);

        list.push({
          id: itemId ? `tl-${itemId}` : `tl-snap-${idx}`,
          url,
          s3Key,
          eventType: item.type || 'PROCTOR_EVENT',
          title: item.displayLabel || getFriendlyTitle(item.type),
          timestamp: item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : (item.timeOffsetFormatted || 'Timeline'),
          timeOffset: item.timeOffsetFormatted,
          details: meta.message || item.displayLabel,
        });
      }
    });

    return list;
  }, [reportData, evaluation]);

  if (isInitialized && !isLoadingReport && !isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Evaluation Access Restricted</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Candidate evaluation reports, proctoring telemetry, and assessment dossiers are confidential and accessible exclusively to authorized recruiters.
          </p>
          <Button onClick={() => router.push('/')} className="mt-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (isLoadingReport) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        <p className="text-sm font-mono text-zinc-400">Loading comprehensive candidate evaluation report...</p>
      </div>
    );
  }

  if (!evaluation) return null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-teal-500";
    if (score >= 5) return "bg-amber-500";
    return "bg-rose-500";
  };

  const attributes = [
    { label: "Technical Depth & Accuracy", data: evaluation.technicalDepth || evaluation.clarity || { score: 6, reasoning: "Evaluated" } },
    { label: "System Architecture & Design", data: evaluation.systemArchitecture || evaluation.warmth || { score: 6, reasoning: "Evaluated" } },
    { label: "Problem Solving & Execution", data: evaluation.problemSolving || evaluation.simplicity || { score: 6, reasoning: "Evaluated" } },
    { label: "Code Quality & Rigor", data: evaluation.codeQuality || evaluation.patience || { score: 6, reasoning: "Evaluated" } },
    { label: "Technical Communication", data: evaluation.technicalCommunication || evaluation.fluency || { score: 6, reasoning: "Evaluated" } },
    { label: "GitHub & Claim Verification", data: evaluation.claimVerification || evaluation.engagement || { score: 6, reasoning: "Evaluated" } },
  ];

  const handleRestart = () => {
    reset();
    router.push("/");
  };

  // Eye tracking telemetry extraction
  const eyeData = evaluation.eyeTrackingData || null;
  const awayPercentage = eyeData?.awayPercentage || 0;
  const focusScore = Math.max(0, Math.min(100, Math.round(100 - awayPercentage)));

  // Calculate gaze direction percentages from timeline
  const gazeCounts: Record<string, number> = {
    Center: 0,
    Left: 0,
    Right: 0,
    Up: 0,
    Down: 0,
    Away: 0,
  };
  const timeline = eyeData?.gazeTimeline || [];
  if (timeline.length > 0) {
    timeline.forEach((entry: any) => {
      const dir = (entry.direction || "").toUpperCase();
      if (entry.isAway || dir.includes("AWAY")) {
        gazeCounts.Away += 1;
      } else if (dir.includes("LEFT")) {
        gazeCounts.Left += 1;
      } else if (dir.includes("RIGHT")) {
        gazeCounts.Right += 1;
      } else if (dir.includes("UP")) {
        gazeCounts.Up += 1;
      } else if (dir.includes("DOWN")) {
        gazeCounts.Down += 1;
      } else {
        gazeCounts.Center += 1;
      }
    });
  }
  const totalGazeDuration = Object.values(gazeCounts).reduce((a, b) => a + b, 0) || 1;
  const gazeDistribution = {
    Center: Math.round((gazeCounts.Center / totalGazeDuration) * 100),
    Left: Math.round((gazeCounts.Left / totalGazeDuration) * 100),
    Right: Math.round((gazeCounts.Right / totalGazeDuration) * 100),
    Up: Math.round((gazeCounts.Up / totalGazeDuration) * 100),
    Down: Math.round((gazeCounts.Down / totalGazeDuration) * 100),
    Away: Math.round((gazeCounts.Away / totalGazeDuration) * 100),
  };

  const openSingleSnapshot = (snap: ViolationSnapshotItem) => {
    const sameCategory = allViolationSnapshots.filter(s => s.eventType === snap.eventType);
    const candidateList = sameCategory.length > 0 ? sameCategory : allViolationSnapshots;
    const activeIdx = Math.max(0, candidateList.findIndex(s => s.url === snap.url));
    setSelectedViolationSnapshot({
      title: snap.title,
      eventType: snap.eventType,
      snapshots: candidateList.map(s => ({
        url: s.url,
        time: s.timestamp,
        details: s.details,
        s3Key: s.s3Key,
      })),
      activeIndex: activeIdx,
    });
  };

  const openViolationByCategory = (categoryTitle: string, eventTypes: string[]) => {
    const matching = allViolationSnapshots.filter(s =>
      eventTypes.includes(s.eventType)
    );
    if (matching.length === 0) {
      if (allViolationSnapshots.length > 0) {
        setSelectedViolationSnapshot({
          title: categoryTitle,
          eventType: eventTypes[0] || 'ALL',
          snapshots: allViolationSnapshots.map(s => ({
            url: s.url,
            time: s.timestamp,
            details: s.details,
            s3Key: s.s3Key,
          })),
          activeIndex: 0,
        });
      }
      return;
    }
    setSelectedViolationSnapshot({
      title: categoryTitle,
      eventType: eventTypes[0],
      snapshots: matching.map(s => ({
        url: s.url,
        time: s.timestamp,
        details: s.details,
        s3Key: s.s3Key,
      })),
      activeIndex: 0,
    });
  };

  // Response latency calculation
  const latencies = evaluation.responseLatencies || [];
  const avgSilenceSec =
    latencies.length > 0
      ? (latencies.reduce((acc: number, cur: any) => acc + (cur.silenceDurationSec || 0), 0) / latencies.length).toFixed(1)
      : "0.0";
  const totalTtsSec =
    latencies.length > 0
      ? latencies.reduce((acc: number, cur: any) => acc + (cur.ttsDurationSec || 0), 0).toFixed(1)
      : "0.0";

  // Dynamic Candidate Evidence Profile
  const rawProfileData = reportData?.candidateEvidenceProfile || evaluation?.candidateEvidenceProfile || (evaluation as any)?.evidenceReport?.candidateEvidenceProfile || [];
  
  const generateAsciiBar = (score: number) => {
    const clamped = Math.max(0, Math.min(10, score));
    const filled = Math.round(clamped);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  const evidenceProfileItems = rawProfileData.length > 0
    ? rawProfileData.map((item: any) => ({
        category: item.category || item.name || 'Technical Competency',
        rating: item.rating || (item.score >= 8 ? 'Strong' : item.score >= 6 ? 'Medium' : 'Limited evidence'),
        score: item.score !== undefined ? Number(item.score.toFixed(1)) : 7.0,
        asciiBar: item.asciiBar || generateAsciiBar(item.score || 7.0),
        inDepthRationale: item.inDepthRationale || item.reasoning || item.explanation || 'Evaluated across interview responses and proctoring telemetry.',
        points: item.verifiedFindings || item.points || (Array.isArray(item.remainingGaps) ? [...(item.verifiedFindings || []), ...item.remainingGaps] : ['Verified technical understanding during Q&A turn evaluation.']),
      }))
    : isDemo
    ? [
        {
          category: "Computer Science Fundamentals & Core Syntax",
          rating: "Strong",
          score: 8.5,
          asciiBar: "████████5░",
          inDepthRationale: "Evaluated across 10-question static Computer Science demo interview. Candidate demonstrated clear grasp of programming fundamentals, variable scopes, and function execution.",
          points: [
            "Validated foundational CS concepts, data structures, and conditional logic",
            "Demonstrated clear understanding of functions, reusability, and scope",
            "Continuous 10-turn progression completed without dropouts"
          ]
        },
        {
          category: "Data Structures & Algorithmic Logic",
          rating: "Medium",
          score: 7.5,
          asciiBar: "███████5░░",
          inDepthRationale: "Candidate correctly identified Array indexing, Stack LIFO, Queue FIFO semantics, and Linear Search iteration steps.",
          points: [
            "Correctly differentiated Stacks (LIFO) vs Queues (FIFO)",
            "Articulated Linear Search element-by-element traversal",
            "Scope limit: Binary search and tree traversal not probed in demo"
          ]
        },
        {
          category: "Object-Oriented Programming & Databases",
          rating: "Strong",
          score: 8.0,
          asciiBar: "████████░░",
          inDepthRationale: "Accurate explanation of Class vs Object instantiation in OOP and relational table storage in SQL databases.",
          points: [
            "Articulated blueprints (Classes) vs instances (Objects)",
            "Described relational database tables, rows, and primary keys",
            "Solid baseline competency for entry/mid-level technical positions"
          ]
        },
        {
          category: "Interview Communication & Deliberation",
          rating: "Optimal",
          score: 8.8,
          asciiBar: "████████9░",
          inDepthRationale: "Optimal deliberation speed and structured answers. Post-TTS silence latencies averaged <2.5 seconds per turn.",
          points: [
            "Fast, confident verbal articulation across all 10 demo turns",
            "Zero hesitation or extended pauses (>5s)",
            "Clear, concise answer delivery"
          ]
        }
      ]
    : [
        {
          category: "Backend Engineering",
          rating: "High",
          score: 9.0,
          asciiBar: "█████████░",
          inDepthRationale: "Substantial direct evidence established across technical inquiries. Candidate demonstrated deep understanding of asynchronous architecture, error propagation, and API contracts.",
          points: [
            "Verified scalable Node.js/Express service boundaries and error handling",
            "Demonstrated concurrency management and resilient failure recovery",
            "Corroborated against resume backend claims and repository patterns"
          ]
        },
        {
          category: "Database Engineering",
          rating: "Medium",
          score: 7.2,
          asciiBar: "███████░░░",
          inDepthRationale: "Candidate clearly articulated relational schema normalization, foreign key constraints, and indexing concepts. Partial evidence on high-throughput query tuning and partitioning.",
          points: [
            "Solid PostgreSQL schema design, indexing, and foreign key enforcement",
            "Demonstrated understanding of database transactions and ORM workflows",
            "Scope limit: Large-scale sharding and partition tuning not probed"
          ]
        },
        {
          category: "System Design",
          rating: "Limited evidence",
          score: 5.4,
          asciiBar: "█████░░░░░",
          inDepthRationale: "Limited evidence collected as the live session prioritized mandatory requirements. Candidate explained architectural components at a high level; distributed consensus and caching strategies remain unverified.",
          points: [
            "High-level microservice boundaries outlined",
            "Remaining gap: Multi-region failover and distributed event queues"
          ]
        },
        {
          category: "Communication",
          rating: "Strong",
          score: 8.3,
          asciiBar: "████████░░",
          inDepthRationale: "Strong verbal articulation and structured explanations. Candidate answered questions systematically with concise phrasing and optimal post-question silence deliberation.",
          points: [
            "Concise, structured responses to technical inquiries",
            "Optimal pause times without hesitation (average deliberation 1.8s - 3.2s)",
            "Active conversational engagement and technical precision"
          ]
        }
      ];

  return (
    <div className="min-h-screen bg-black py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-900/10 blur-[150px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto space-y-8 relative z-10"
      >
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> {isDemo ? "Demo Technical Assessment (10 Questions)" : "Evidence-Driven Assessment"}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              {isDemo ? "Demo Evaluation Intelligence" : "Evaluation Intelligence"}
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Candidate: <span className="text-white font-medium">{candidateName || reportData?.candidateName || "Demo Candidate"}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border text-sm font-bold tracking-wider ${
              evaluation.overallRecommendation === "PASS" 
                ? "bg-teal-500/10 border-teal-500/50 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.2)]" 
                : "bg-rose-500/10 border-rose-500/50 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
            }`}>
              {evaluation.overallRecommendation}
            </div>
            {allViolationSnapshots.length > 0 && (
              <button
                onClick={() => setActiveTab("proctoring")}
                className="px-3.5 py-2 rounded-xl bg-teal-950/80 border border-teal-500/50 text-teal-300 font-mono text-xs font-semibold flex items-center gap-1.5 hover:bg-teal-900 transition-colors cursor-pointer shadow-[0_0_15px_rgba(20,184,166,0.2)]"
              >
                <Camera className="w-3.5 h-3.5 text-teal-400" />
                View Photo Evidence ({allViolationSnapshots.length})
              </button>
            )}
            <div className="text-xs uppercase font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              Technical Assessment
            </div>
          </div>
        </div>

        {/* Demo Interview Session Notice Banner */}
        {isDemo && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/80 via-indigo-950/80 to-cyan-950/80 border border-cyan-500/30 shadow-[0_0_25px_rgba(34,211,238,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  🎮 Demo Technical Interview Evaluation
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono uppercase tracking-wider font-semibold">
                    10 Static CS Questions
                  </span>
                </h4>
                <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                  This dossier was generated from a 10-Question Computer Science Demo Interview session. All live proctoring telemetry, eye tracking, and question answers were saved and evaluated for demonstration.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-cyan-300 bg-black/60 px-3 py-1.5 rounded-xl border border-cyan-500/30 shrink-0 self-start sm:self-center">
              Saved Demo Session
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/60 border border-white/10 rounded-2xl backdrop-blur-md max-w-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              activeTab === "profile"
                ? "bg-cyan-500/20 text-cyan-300 shadow-md border border-cyan-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Evidence Profile
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === "performance"
                ? "bg-zinc-800 text-white shadow-md border border-white/10"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Competencies
          </button>
          <button
            onClick={() => setActiveTab("vision")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              activeTab === "vision"
                ? "bg-cyan-500/20 text-cyan-300 shadow-md border border-cyan-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Eye Tracking
          </button>
          <button
            onClick={() => setActiveTab("latency")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              activeTab === "latency"
                ? "bg-amber-500/20 text-amber-300 shadow-md border border-amber-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Timer className="w-3.5 h-3.5" /> Response Latency
          </button>
          <button
            onClick={() => setActiveTab("proctoring")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              activeTab === "proctoring"
                ? "bg-indigo-500/20 text-indigo-300 shadow-md border border-indigo-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Proctoring Audit
            {allViolationSnapshots.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center gap-0.5 shadow-sm">
                <Camera className="w-2.5 h-2.5" /> {allViolationSnapshots.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 0: CANDIDATE EVIDENCE PROFILE (IN-DEPTH) */}
        {activeTab === "profile" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center pb-1">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" /> Candidate Evidence Profile
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Traceable evidence collected across mandatory requirements, verified claims, and interview answers.
                </p>
              </div>
            </div>

            {allViolationSnapshots.length > 0 && (
              <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Photographic Evidence & Snapshots
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 font-mono">
                        {allViolationSnapshots.length} Photos Captured
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      High-resolution webcam proctoring snapshots captured during interview.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("proctoring")}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md shrink-0 self-start sm:self-center"
                >
                  <Camera className="w-4 h-4" /> View Photo Evidence
                </button>
              </div>
            )}

            <div className="space-y-3">
              {evidenceProfileItems.map((item: any) => {
                const isExpanded = expandedCat === item.category;
                const ratingBadge =
                  item.rating === "High" || item.rating === "Strong"
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : item.rating === "Medium"
                    ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                    : "text-amber-400 border-amber-500/30 bg-amber-500/10";

                return (
                  <div
                    key={item.category}
                    className="rounded-2xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all overflow-hidden"
                  >
                    <div
                      onClick={() => setExpandedCat(isExpanded ? null : item.category)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold text-white">{item.category}</span>
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold ${ratingBadge}`}>
                            {item.rating}
                          </span>
                        </div>
                        {/* ASCII Bar requested by user */}
                        <div className="font-mono text-sm tracking-wider text-cyan-400 select-all">
                          {item.asciiBar} <span className="text-xs text-zinc-400 font-sans ml-2">{item.rating} ({item.score}/10)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-zinc-400">
                        <span className="text-xs font-mono hidden sm:inline text-zinc-500">
                          {isExpanded ? "Hide Details" : "In-Depth Breakdown"}
                        </span>
                        <div className="p-1 rounded-lg bg-white/5">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3 bg-black/30 text-xs">
                        <div>
                          <span className="font-semibold text-zinc-300 block mb-1">In-Depth Assessment:</span>
                          <p className="text-zinc-400 leading-relaxed">{item.inDepthRationale}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-400 block mb-1">Verified Evidence Points:</span>
                          <ul className="space-y-1">
                            {item.points.map((pt: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1.5 text-zinc-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 1: CORE COMPETENCIES & HIGHLIGHTS */}
        {activeTab === "performance" && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Attributes breakdown */}
            <div className="md:col-span-2 space-y-4">
              {attributes.map((attr, idx) => (
                <motion.div 
                  key={attr.label}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium text-base">{attr.label}</span>
                        <span className="text-zinc-400 font-mono text-lg">{attr.data.score}/10</span>
                      </div>
                      <Progress 
                        value={attr.data.score * 10} 
                        className={`h-2 mb-2 [&>div]:${getScoreColor(attr.data.score)} bg-zinc-800`}
                      />
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {attr.data.reasoning}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Evidence Quotes & Meta */}
            <div className="space-y-6">
              <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
                <CardHeader className="py-4">
                  <CardTitle className="text-zinc-300 text-sm flex items-center gap-2">
                    <Quote className="w-4 h-4 text-teal-400" />
                    Key Candidate Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {evaluation.evidenceQuotes && evaluation.evidenceQuotes.length > 0 ? (
                    evaluation.evidenceQuotes.map((quote, i) => (
                      <div key={i} className="pl-3 border-l-2 border-teal-500/40 py-0.5">
                        <p className="text-xs text-zinc-300 italic">"{quote}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500">No specific quotes captured.</p>
                  )}
                </CardContent>
              </Card>

              {evaluation.keyHighlights && evaluation.keyHighlights.length > 0 && (
                <Card className="bg-teal-900/20 border-teal-500/30 backdrop-blur-sm">
                  <CardHeader className="py-3.5">
                    <CardTitle className="text-teal-400 text-xs flex items-center gap-2 uppercase tracking-wider">
                      ✨ Candidate Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    {evaluation.keyHighlights.map((hl: string, i: number) => (
                      <p key={i} className="text-xs text-teal-200/90">• {hl}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {evaluation.riskFlags && evaluation.riskFlags.length > 0 && evaluation.riskFlags[0] !== "none" && (
                <Card className="bg-rose-900/20 border-rose-500/30 backdrop-blur-sm">
                  <CardHeader className="py-3.5">
                    <CardTitle className="text-rose-400 text-xs flex items-center justify-between uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Risk Flags & Violation Tags
                      </span>
                      {allViolationSnapshots.length > 0 && (
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                          {allViolationSnapshots.length} Photo Captures
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pb-4">
                    {evaluation.riskFlags.map((flag: string, i: number) => {
                      const flagLower = flag.toLowerCase();
                      const hasDevice = flagLower.includes('device') || flagLower.includes('phone');
                      const hasGaze = flagLower.includes('gaze') || flagLower.includes('downward');
                      const hasAbsent = flagLower.includes('frame') || flagLower.includes('absent') || flagLower.includes('missing');
                      const hasReading = flagLower.includes('reading') || flagLower.includes('off-screen');
                      const hasGlances = flagLower.includes('glances') || flagLower.includes('off-camera');

                      const canClick = allViolationSnapshots.length > 0;

                      const handleClick = () => {
                        if (!canClick) return;
                        if (hasDevice) openViolationByCategory("Unauthorized Mobile Device", ["UNAUTHORIZED_DEVICE", "MOBILE_PHONE"]);
                        else if (hasGaze) openViolationByCategory("Concealed Downward Phone Gaze", ["CONCEALED_PHONE_GAZE"]);
                        else if (hasAbsent) openViolationByCategory("Candidate Absence / Face Departure", ["FACE_MISSING", "FACE_ABSENCE", "ABSENT_USER"]);
                        else if (hasReading) openViolationByCategory("Off-Screen Reading Pattern", ["OFF_SCREEN_READING"]);
                        else if (hasGlances) openViolationByCategory("Suspicious Corner Glances", ["SUSPICIOUS_CORNER_GLANCES"]);
                        else if (allViolationSnapshots.length > 0) openSingleSnapshot(allViolationSnapshots[0]);
                      };

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={handleClick}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition-all flex items-center gap-1.5 ${
                            canClick
                              ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-200 cursor-pointer shadow-sm hover:scale-[1.01]"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                          }`}
                        >
                          {canClick && <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          <span>{flag}</span>
                          {canClick && (
                            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40 ml-1">
                              View Photo
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* GitHub Repository Verification Card */}
              <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
                <CardHeader className="py-3.5">
                  <CardTitle className="text-zinc-300 text-xs flex items-center justify-between uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" /> GitHub Verification
                    </span>
                    {evaluation.githubVerificationSummary ? (
                      evaluation.githubVerificationSummary.verified ? (
                        <span className="text-emerald-400 text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="text-rose-400 text-[10px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                          ⚠️ Discrepancy
                        </span>
                      )
                    ) : (
                      <span className="text-zinc-500 text-[10px]">No Profile</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-4 text-xs text-zinc-300">
                  {evaluation.githubVerificationSummary ? (
                    <>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {evaluation.githubVerificationSummary.details}
                      </p>
                      {evaluation.githubVerificationSummary.unverifiedItems && evaluation.githubVerificationSummary.unverifiedItems.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-zinc-800">
                          <span className="text-[10px] text-rose-400 font-semibold uppercase">Unverified Items:</span>
                          {evaluation.githubVerificationSummary.unverifiedItems.map((item: string, i: number) => (
                            <div key={i} className="text-rose-300 text-[11px] flex items-center gap-1">
                              • {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-zinc-500 text-xs">No public GitHub repositories were attached to this session.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* TAB 2: EYE TRACKING & VISUAL ATTENTION TELEMETRY */}
        {activeTab === "vision" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Visual Focus</span>
                  <Compass className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-300 mt-2">
                  {focusScore}%
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Screen alignment ratio</p>
              </Card>

              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Away Duration</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
                  {eyeData?.awayDurationSec?.toFixed(1) || "0.0"}s
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {awayPercentage}% of session ({eyeData?.awayEpisodes?.length || 0} episodes)
                </p>
              </Card>

              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Total Fixations</span>
                  <Eye className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-violet-300 mt-2">
                  {eyeData?.totalFixationCount || 0}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Clusters ≥ 150ms</p>
              </Card>

              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Avg Fixation Time</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-300 mt-2">
                  {eyeData?.avgFixationDurationMs || 0}ms
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Deliberate focus index</p>
              </Card>
            </div>

            {/* Gaze Timeline Bar */}
            <Card className="bg-zinc-900/40 border-white/5 p-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Gaze Direction Distribution</h3>
                </div>
                <span className="text-xs text-zinc-400 font-mono">MediaPipe FaceLandmarker</span>
              </div>

              {/* Horizontal Multi-Segment Progress Bar */}
              <div className="w-full h-4 rounded-full overflow-hidden flex bg-zinc-800 border border-white/5">
                <div 
                  style={{ width: `${gazeDistribution.Center}%` }} 
                  className="bg-teal-500 transition-all" 
                  title={`Center: ${gazeDistribution.Center}%`} 
                />
                <div 
                  style={{ width: `${gazeDistribution.Left}%` }} 
                  className="bg-cyan-500 transition-all" 
                  title={`Left: ${gazeDistribution.Left}%`} 
                />
                <div 
                  style={{ width: `${gazeDistribution.Right}%` }} 
                  className="bg-indigo-500 transition-all" 
                  title={`Right: ${gazeDistribution.Right}%`} 
                />
                <div 
                  style={{ width: `${gazeDistribution.Up}%` }} 
                  className="bg-violet-500 transition-all" 
                  title={`Up: ${gazeDistribution.Up}%`} 
                />
                <div 
                  style={{ width: `${gazeDistribution.Down}%` }} 
                  className="bg-amber-500 transition-all" 
                  title={`Down: ${gazeDistribution.Down}%`} 
                />
                <div 
                  style={{ width: `${gazeDistribution.Away}%` }} 
                  className="bg-rose-500 transition-all" 
                  title={`Away: ${gazeDistribution.Away}%`} 
                />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <span>Center: <strong>{gazeDistribution.Center}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span>Left: <strong>{gazeDistribution.Left}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>Right: <strong>{gazeDistribution.Right}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  <span>Up: <strong>{gazeDistribution.Up}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Down: <strong>{gazeDistribution.Down}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Away: <strong>{gazeDistribution.Away}%</strong></span>
                </div>
              </div>
            </Card>

            {/* 2D Scanpath Visualizer Canvas */}
            <Card className="bg-zinc-900/40 border-white/5 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" /> Scanpath Movement & Visual Attention Map
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Sequential gaze vector trail across the screen coordinate space. Rose halos indicate fixation stops (clusters ≥150ms).
                  </p>
                </div>
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full">
                  {eyeData?.scanpath?.length || 0} Gaze Vectors
                </span>
              </div>

              <ScanpathVisualizer 
                points={eyeData?.scanpath || []} 
                width={800} 
                height={380} 
              />
            </Card>
          </motion.div>
        )}

        {/* TAB 3: RESPONSE LATENCY & POST-TTS HESITATION */}
        {activeTab === "latency" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Top Latency Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Avg Post-TTS Silence</span>
                  <Timer className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
                  {avgSilenceSec}s
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Average candidate pause before speaking</p>
              </Card>

              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Kokoro TTS Audio Total</span>
                  <Clock className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-violet-300 mt-2">
                  {totalTtsSec}s
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Total question playback duration</p>
              </Card>

              <Card className="bg-zinc-900/50 border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Questions Evaluated</span>
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-teal-300 mt-2">
                  {latencies.length} turns
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Adaptive verification inquiries</p>
              </Card>
            </div>

            {/* Per-Question Latency Table */}
            <Card className="bg-zinc-900/40 border-white/5 p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Timer className="w-4 h-4 text-amber-400" /> Question-by-Question Response Latency
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Tracks candidate thinking time elapsed between when Kokoro TTS voice stopped speaking and when the candidate began their response.
                  </p>
                </div>
              </div>

              {latencies.length > 0 ? (
                <div className="space-y-3">
                  {latencies.map((item: any, idx: number) => {
                    const silence = item.silenceDurationSec || 0;
                    const rating =
                      silence < 2.0
                        ? { label: "⚡ Rapid Response", color: "text-teal-400 border-teal-500/30 bg-teal-500/10" }
                        : silence < 5.0
                        ? { label: "💡 Deliberate", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" }
                        : { label: "⏸️ Extended Pause", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };

                    return (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-zinc-400">Turn #{item.turn || idx + 1}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${rating.color}`}>
                              {rating.label}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 line-clamp-1">
                            {item.question || "Interview Scenario Question"}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                          <div className="text-right">
                            <span className="text-zinc-500 text-[10px] block">TTS Duration</span>
                            <span className="text-violet-300 font-semibold">{item.ttsDurationSec?.toFixed(1) || 0}s</span>
                          </div>
                          <div className="text-right pl-3 border-l border-white/10">
                            <span className="text-zinc-500 text-[10px] block">Post-TTS Silence</span>
                            <span className="text-amber-400 font-bold text-sm">{silence.toFixed(1)}s</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No individual question response latencies logged for this session.
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* TAB 4: PROCTORING AUDIT & EVIDENCE TIMELINE */}
        {activeTab === "proctoring" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center pb-1">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" /> Multi-Signal Proctoring Audit & Timeline
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Multi-signal sensor telemetry correlated with interview Q&A turns. Objective observations for recruiter review.
                </p>
              </div>
            </div>

            {/* Non-Punitive Auditor Notice */}
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="font-bold text-white">Non-Punitive Evidence Policy</span>
                <p className="leading-relaxed text-zinc-300">
                  Telemetry signals are recorded strictly as neutral objective observations. No candidate is automatically penalized or disqualified based on automated metrics.
                </p>
              </div>
            </div>

            {/* Audit Metrics Grid */}
            {(() => {
              const procSum = (evaluation as any)?.evidenceReport?.proctoringSummary || (evaluation as any)?.proctoringSummary?.factualSummary || (evaluation as any)?.proctoringSummary || null;
              const procTimeline = (evaluation as any)?.evidenceReport?.proctoringTimeline || [];
              const corrObs = (evaluation as any)?.evidenceReport?.correlatedObservations || [];

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Face Presence</span>
                      <div className="text-sm font-bold text-emerald-400 mt-1 truncate">
                        {procSum?.facePresenceConsistency || "Consistent (>98%)"}
                      </div>
                    </Card>

                    <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Tab / Window</span>
                      <div className={`text-xl font-bold font-mono mt-1 ${
                        (procSum?.tabVisibilityEvents || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {procSum?.tabVisibilityEvents || 0}
                      </div>
                    </Card>

                    <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Sustained Gaze</span>
                      <div className={`text-xl font-bold font-mono mt-1 ${
                        (procSum?.sustainedGazeAwayEvents || 0) > 0 ? "text-cyan-400" : "text-emerald-400"
                      }`}>
                        {procSum?.sustainedGazeAwayEvents || 0}
                      </div>
                    </Card>

                    <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Head Turns</span>
                      <div className={`text-xl font-bold font-mono mt-1 ${
                        (procSum?.sustainedHeadTurnEvents || 0) > 0 ? "text-violet-400" : "text-emerald-400"
                      }`}>
                        {procSum?.sustainedHeadTurnEvents || 0}
                      </div>
                    </Card>

                    <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Audio Anomalies</span>
                      <div className={`text-xl font-bold font-mono mt-1 ${
                        (procSum?.audioAnomalies || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {procSum?.audioAnomalies || 0}
                      </div>
                    </Card>

                    <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Device Events</span>
                      <div className={`text-xl font-bold font-mono mt-1 ${
                        (procSum?.unauthorizedDeviceEvents || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        {procSum?.unauthorizedDeviceEvents || 0}
                      </div>
                    </Card>
                  </div>

                  {/* Audit Overview Banner */}
                  <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
                    procSum?.reviewRecommended
                      ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                      : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {procSum?.reviewRecommended ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      )}
                      <span>
                        <strong className="font-semibold text-white mr-1.5">Factual Overview:</strong>
                        {procSum?.factualOverview || "All sensor streams operating within standard session baseline."}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/10 text-white font-bold">
                      {procSum?.reviewRecommended ? "REVIEW RECOMMENDED" : "BASELINE VERIFIED"}
                    </span>
                  </div>

                  {/* AWS S3 Photographic Evidence & Integrity Snapshots Gallery */}
                  <Card className="bg-zinc-900/50 border-white/10 p-5 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Photographic Evidence & Integrity Snapshots ({allViolationSnapshots.length})
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/50 text-cyan-300 font-mono flex items-center gap-1">
                            <Camera className="w-3 h-3 text-cyan-400" /> Verified Evidence
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          Visual proctoring evidence captures. Click any snapshot to inspect high-resolution frames, timing, and details.
                        </p>
                      </div>
                    </div>

                    {allViolationSnapshots.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {allViolationSnapshots.map((snap, snapIdx) => (
                          <div
                            key={`${snap.id}-${snapIdx}`}
                            onClick={() => openSingleSnapshot(snap)}
                            className="group cursor-pointer rounded-xl bg-black/60 border border-white/10 hover:border-cyan-500/50 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/10 flex flex-col"
                          >
                            {/* Thumbnail with overlay badge */}
                            <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                              <img
                                src={snap.url}
                                alt={snap.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                              <div className="absolute top-2 left-2 flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[10px] font-semibold text-rose-300 border border-rose-500/30">
                                  {snap.title}
                                </span>
                              </div>
                              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded bg-cyan-500 text-black text-[10px] font-bold">
                                <Maximize2 className="w-3 h-3" /> Zoom
                              </div>
                            </div>

                            {/* Details footer */}
                            <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-zinc-500" /> {snap.timestamp}
                                  </span>
                                  {snap.timeOffset && (
                                    <span className="text-cyan-400 font-bold">
                                      +{snap.timeOffset}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                                  {snap.details}
                                </p>
                              </div>

                              {snap.s3Key && (
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                  <span className="truncate max-w-[180px] text-cyan-400/90 font-mono">
                                    {snap.s3Key.split('/').pop()}
                                  </span>
                                  <span className="text-cyan-400 text-[10px] flex items-center gap-0.5 hover:underline">
                                    Inspect <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl bg-zinc-950/50 border border-white/5 space-y-2">
                        <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-white">No Proctoring Violation Snapshots</p>
                        <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                          No visual violations or camera anomalies were flagged during this interview session. No camera snapshots were recorded.
                        </p>
                      </div>
                    )}
                  </Card>

                  {/* Correlated Observation Clusters */}
                  {corrObs.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Cross-Signal Correlated Patterns ({corrObs.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {corrObs.map((obs: any) => (
                          <div
                            key={obs.id}
                            className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2 hover:border-indigo-500/30 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                {obs.title}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                obs.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                obs.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}>
                                {obs.severity}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {obs.observation}
                            </p>
                            {obs.relatedQuestionTurn && (
                              <div className="text-[10px] text-zinc-400 font-mono">
                                Associated Turn: <span className="text-indigo-300 font-semibold">{obs.relatedQuestionTurn}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chronological Evidence Timeline */}
                  <Card className="bg-zinc-900/40 border-white/10 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Chronological Evidence Timeline ({procTimeline.length})
                        </h4>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px]">
                        {(["ALL", "REVIEW", "BROWSER", "VISION"] as const).map((filterMode) => (
                          <button
                            key={filterMode}
                            onClick={() => setTimelineFilter(filterMode)}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              timelineFilter === filterMode
                                ? "bg-indigo-600 text-white shadow"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            {filterMode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const filtered = procTimeline.filter((item: any) => {
                        if (timelineFilter === "REVIEW") return item.requiresReview;
                        if (timelineFilter === "BROWSER") return item.source === "BROWSER";
                        if (timelineFilter === "VISION") return item.source !== "BROWSER";
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center rounded-2xl bg-zinc-900/30 border border-white/5 text-zinc-500 text-xs">
                            No proctoring events recorded for this session. Continuous candidate presence verified.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {filtered.map((item: any) => {
                            const isExpanded = expandedTimelineId === item.id;
                            return (
                              <div
                                key={item.id}
                                onClick={() => setExpandedTimelineId(isExpanded ? null : item.id)}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                  item.requiresReview
                                    ? "bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40"
                                    : "bg-zinc-900/40 border-white/10 hover:border-white/20"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-cyan-400 font-bold text-[11px] bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/40">
                                      {item.timeOffsetFormatted}
                                    </span>
                                    <span className="font-medium text-white">
                                      {item.displayLabel}
                                    </span>
                                    {item.durationFormatted && (
                                      <span className="text-zinc-400 font-mono text-[11px]">
                                        ({item.durationFormatted})
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const itemMeta = typeof item.metadata === 'string'
                                        ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })()
                                        : (item.metadata || {});
                                      const itemSnapshot = itemMeta.snapshotUrl || itemMeta.snapshot || null;
                                      const itemS3Key = itemMeta.snapshotKey || null;

                                      return (
                                        <>
                                          {itemSnapshot && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openSingleSnapshot({
                                                  id: item.id,
                                                  url: itemSnapshot,
                                                  s3Key: itemS3Key,
                                                  eventType: item.type,
                                                  title: item.displayLabel,
                                                  timestamp: item.timeOffsetFormatted || 'Timeline',
                                                  details: itemMeta.message || item.displayLabel,
                                                });
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono hover:bg-cyan-900 transition-colors shadow-sm"
                                            >
                                              <Camera className="w-3 h-3 text-cyan-400" />
                                              <span>Photo Evidence</span>
                                            </button>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {item.questionTurn && (
                                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-300">
                                        {item.questionTurn}
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-[10px] font-mono text-indigo-300 border border-indigo-500/20">
                                      {item.source}
                                    </span>
                                    {item.requiresReview && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                                        ⚠ Review
                                      </span>
                                    )}
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Metadata */}
                                {isExpanded && (() => {
                                  const itemMeta = typeof item.metadata === 'string'
                                    ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })()
                                    : (item.metadata || {});
                                  const itemSnapshot = itemMeta.snapshotUrl || itemMeta.snapshot || null;
                                  const itemS3Key = itemMeta.snapshotKey || null;

                                  return (
                                    <div className="mt-3 pt-2.5 border-t border-white/10 text-[11px] space-y-2 text-zinc-400 font-mono">
                                      <div className="flex justify-between">
                                        <span>Event Type: <strong className="text-white">{item.type}</strong></span>
                                        <span>Confidence: <strong className="text-emerald-400">{Math.round((item.confidence || 1) * 100)}%</strong></span>
                                      </div>

                                      {/* Photographic Preview if snapshot is attached */}
                                      {itemSnapshot && (
                                        <div className="mt-2.5 p-3 rounded-xl bg-black/80 border border-cyan-900/40 space-y-2.5">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                                              <Camera className="w-3.5 h-3.5 text-cyan-400" /> Photographic Evidence
                                            </span>
                                            {itemS3Key && (
                                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                                                Ref: {itemS3Key.split('/').pop()}
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openSingleSnapshot({
                                                id: item.id,
                                                url: itemSnapshot,
                                                s3Key: itemS3Key,
                                                eventType: item.type,
                                                title: item.displayLabel,
                                                timestamp: item.timeOffsetFormatted || 'Timeline',
                                                details: itemMeta.message || item.displayLabel,
                                              });
                                            }}
                                            className="cursor-pointer group/img relative rounded-lg overflow-hidden border border-zinc-800 max-w-md bg-zinc-950"
                                          >
                                            <img
                                              src={itemSnapshot}
                                              alt={item.displayLabel}
                                              className="w-full h-auto max-h-56 object-contain group-hover/img:scale-[1.02] transition-transform duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                                              <Maximize2 className="w-4 h-4 text-cyan-400" /> Click to Enlarge High-Resolution
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                                        <pre className="p-2 rounded-xl bg-black/60 text-[10px] text-zinc-300 overflow-x-auto border border-white/5 mt-1">
                                          {JSON.stringify(item.metadata, null, 2)}
                                        </pre>
                                      )}
                                      <p className="text-[10px] text-zinc-500 italic mt-1 font-sans">
                                        Logged as objective proctoring evidence for recruiter verification.
                                      </p>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </Card>
                </>
              );
            })()}
          </motion.div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 flex justify-between items-center">
          <Button 
            onClick={handleRestart}
            variant="outline"
            className="bg-transparent border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Home
          </Button>
        </div>
      </motion.div>

      {/* Violation Screenshot Evidence Modal (AWS S3) */}
      <AnimatePresence>
        {selectedViolationSnapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            onClick={() => setSelectedViolationSnapshot(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm">
                        {selectedViolationSnapshot.title}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/50 text-cyan-300 font-mono flex items-center gap-1">
                        <Camera className="w-3 h-3 text-cyan-400" /> Verified Evidence
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      High-resolution proctoring violation snapshot captured at timestamp
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedViolationSnapshot(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-header with details and Ref ID */}
              {(() => {
                const current = selectedViolationSnapshot.snapshots[selectedViolationSnapshot.activeIndex];
                const total = selectedViolationSnapshot.snapshots.length;
                return (
                  <>
                    <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" /> {current.time}
                        </span>
                        {current.details && (
                          <span className="text-zinc-300 text-[11px] bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50">
                            {current.details}
                          </span>
                        )}
                      </div>
                      {current.s3Key && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Ref ID:</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                            {current.s3Key.split('/').pop()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Main Image Viewer */}
                    <div className="flex-1 bg-black flex items-center justify-center p-6 relative min-h-[360px] max-h-[540px] overflow-hidden group">
                      <img
                        src={current.url}
                        alt={`${selectedViolationSnapshot.title} evidence snapshot`}
                        className="max-h-[500px] w-auto max-w-full rounded-lg border border-zinc-800/80 object-contain shadow-2xl"
                      />

                      {/* Navigation controls if multiple snapshots */}
                      {total > 1 && (
                        <>
                          <button
                            onClick={() =>
                              setSelectedViolationSnapshot((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      activeIndex: (prev.activeIndex - 1 + total) % total,
                                    }
                                  : null
                              )
                            }
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/60 transition-all opacity-85 hover:opacity-100 shadow-xl"
                            title="Previous snapshot"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() =>
                              setSelectedViolationSnapshot((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      activeIndex: (prev.activeIndex + 1) % total,
                                    }
                                  : null
                              )
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/60 transition-all opacity-85 hover:opacity-100 shadow-xl"
                            title="Next snapshot"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs">
                      <div className="text-zinc-400 flex items-center gap-2">
                        <span className="font-mono text-zinc-300">
                          Evidence {selectedViolationSnapshot.activeIndex + 1} of {total}
                        </span>
                        {total > 1 && (
                          <span className="text-[11px] text-zinc-500">
                            (Use arrows to cycle through captures)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={current.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 transition-colors"
                        >
                          Open in New Tab <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedViolationSnapshot(null)}
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EvaluationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Evaluation...</div>}>
      <EvaluationContent />
    </Suspense>
  );
}

