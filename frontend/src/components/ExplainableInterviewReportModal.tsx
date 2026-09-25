"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Timer, 
  Smartphone, 
  ShieldAlert, 
  ShieldCheck,
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Quote, 
  Activity,
  Layers,
  ArrowUpRight,
  Monitor,
  Mic,
  Maximize2,
  Filter,
  Info,
  Camera,
  Brain,
  BookOpen,
  Compass,
  Check,
  GitBranch,
  Code2,
  Server,
  Database,
  Box,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanpathVisualizer } from "@/components/ScanpathVisualizer";

export interface FlagshipProjectArchitecture {
  repoName: string;
  url: string;
  primaryLanguage: string;
  architectureType: string;
  primaryPurpose: string;
  endToEndArchitecture: string;
  keyTechnologies: string[];
  designPatterns: string[];
  hasTests: boolean;
  hasDocker: boolean;
  hasCiCd: boolean;
  codeMaturity: 'PROTOTYPE' | 'SOLID_INDIVIDUAL_PROJECT' | 'PRODUCTION_GRADE' | 'LIBRARY_FRAMEWORK';
  verifiedArchitecturalDecisions: string[];
}

export interface CanonicalGitHubSummary {
  username: string;
  profileUrl: string;
  totalPublicRepos: number;
  analyzedRepoCount: number;
  primaryArchetype: string;
  executiveSummary: string;
  flagshipProjects: FlagshipProjectArchitecture[];
  verifiedTechnologies: Array<{
    technology: string;
    repos: string[];
    depth: 'CORE_DEPENDENCY' | 'UTILITY' | 'INFRASTRUCTURE';
  }>;
  architecturalStrengths: string[];
  engineeringGaps: string[];
  suggestedArchitectureProbes: Array<{
    repoName: string;
    question: string;
    rationale: string;
    targetedSkill: string;
  }>;
  generatedAt?: string;
}

export interface CompetencyEvidenceItem {
  category: string;
  rating: "High" | "Strong" | "Medium" | "Limited evidence" | "Low" | "No evidence";
  score: number;
  asciiBar: string;
  percentage: number;
  inDepthRationale: string;
  verifiedFindings: string[];
  remainingGaps: string[];
  evidenceSources: Array<"INTERVIEW" | "RESUME" | "GITHUB" | "EVALUATION">;
  traceableTurns: number[];
  quotes: string[];
}

export interface ExplainableQnATurn {
  turn: number;
  question: string;
  answer: string;
  ttsDurationSec: number;
  silenceLatencySec: number;
  latencyAssessment: "Rapid (<2s)" | "Thoughtful (2-5s)" | "Extended Pause (>5s)";
  competencyTargeted: string;
  evidenceExtracted: string;
  score?: number;
  difficultyLevel?: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  difficultyWeight?: number;
  calibratedScore?: number;
}

export interface GazePatternEvaluation {
  id: string;
  name: string;
  category: 'HORIZONTAL_READING_SACCADES' | 'CONCEALED_DOWNWARD_DWELL' | 'REPEATED_CORNER_GLANCES' | 'CENTER_STABLE_FOCUS' | 'NATURAL_COGNITIVE_DIVERGENCE';
  status: 'DETECTED' | 'NORMAL' | 'NOT_OBSERVED' | 'LOW';
  severity: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  observedCount: number;
  durationSec?: number;
  biomechanicalSignature: string;
  cognitiveMeaning: string;
  recruiterImplication: string;
  recommendedAction: string;
}

export interface RecruiterGazeEducationGuide {
  readingVsThinking: {
    summary: string;
    readingIndicators: string[];
    thinkingIndicators: string[];
  };
  patternsGuide: Array<{
    patternName: string;
    riskLevel: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
    whatItMeans: string;
    whyItHappens: string;
    howToVerify: string;
  }>;
}

export interface GazeStabilityAnalysis {
  isExcessiveMovement: boolean;
  movementAssessment: "Stable Visual Focus" | "Moderate Gaze Shifts" | "Excessive Eye Movement / High Volatility";
  volatilityIndex: number;
  explanation: string;
  awayDurationSec: number;
  awayPercentage: number;
  awayEpisodesCount: number;
  totalFixations: number;
  avgFixationDurationMs: number;
  distribution: {
    centerPct: number;
    peripheralPct: number;
    awayPct: number;
  };
  detectedPatterns?: GazePatternEvaluation[];
  recruiterEducation?: RecruiterGazeEducationGuide;
}

export interface YoloProctoringReport {
  phoneCount: number;
  faceAbsenceCount: number;
  multipleFacesCount: number;
  totalMisconductScore: number;
  severity: "CLEAN" | "LOW_RISK" | "SUSPICIOUS" | "SEVERE_MISCONDUCT";
  explanation: string;
  events: Array<{
    eventType: string;
    objectClass?: string;
    confidence?: number;
    riskLevel: string;
    timestamp: string;
  }>;
}

export interface FactualProctoringSummary {
  facePresenceConsistency: string;
  multipleFacesEvents: number;
  fullscreenExits: number;
  tabVisibilityEvents: number;
  sustainedGazeAwayEvents: number;
  sustainedHeadTurnEvents: number;
  cameraInterruptions: number;
  microphoneInterruptions: number;
  audioAnomalies: number;
  unauthorizedDeviceEvents: number;
  codePasteBursts?: number;
  unnaturalKeystrokeEvents?: number;
  reviewRecommendedEventsCount: number;
  reviewRecommended: boolean;
  factualOverview: string;
}

export interface ProctoringTimelineItem {
  id: string;
  timeOffsetFormatted: string;
  timestamp: number;
  type: string;
  displayLabel: string;
  durationFormatted?: string;
  source: string;
  confidence: number;
  questionTurn?: number | string;
  requiresReview: boolean;
  metadata?: Record<string, any>;
}

export interface CorrelatedObservation {
  id: string;
  title: string;
  observation: string;
  timestamp: number;
  involvedEventTypes: string[];
  relatedQuestionTurn?: number | string;
  requiresReview: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CohortPercentileRanking {
  cohortSize: number;
  rank: number;
  overallPercentile: number;
  headline: string;
  competencyPercentiles: Array<{
    competency: string;
    percentile: number;
    score: number;
    cohortAverage: number;
  }>;
}

export interface ExplainableCandidateReportData {
  sessionId: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle: string;
  overallRecommendation: string;
  totalScore: number;
  candidateEvidenceProfile: CompetencyEvidenceItem[];
  explainableTranscript: ExplainableQnATurn[];
  gazeStabilityAnalysis: GazeStabilityAnalysis;
  yoloProctoringReport: YoloProctoringReport;
  factualProctoringSummary?: FactualProctoringSummary;
  proctoringTimeline?: ProctoringTimelineItem[];
  correlatedObservations?: CorrelatedObservation[];
  summaryExecutive: string;
  eyeTrackingData?: any;
  cohortRanking?: CohortPercentileRanking;
  canonicalGitHubSummary?: CanonicalGitHubSummary;
}

interface ExplainableInterviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExplainableCandidateReportData | null;
}

export function ExplainableInterviewReportModal({
  isOpen,
  onClose,
  report,
}: ExplainableInterviewReportModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "github" | "transcript" | "gaze" | "yolo" | "timeline">("profile");
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "REVIEW" | "BROWSER" | "VISION">("ALL");
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ image: string; title: string; time: string } | null>(null);

  if (!isOpen || !report) return null;

  const toggleExpand = (cat: string) => {
    setExpandedCompetency((prev) => (prev === cat ? null : cat));
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "High":
      case "Strong":
        return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
      case "Medium":
        return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
      case "Limited evidence":
        return "text-amber-400 border-amber-500/30 bg-amber-500/10";
      default:
        return "text-rose-400 border-rose-500/30 bg-rose-500/10";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-5xl bg-zinc-950 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Bar */}
          <div className="p-6 pb-4 border-b border-white/10 flex justify-between items-start bg-zinc-900/60">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Explainable Candidate Report
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {report.candidateName}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Target Role: <span className="text-zinc-200 font-medium">{report.jobTitle}</span> • Session ID: <span className="font-mono text-zinc-400">{report.sessionId.slice(0, 8)}...</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold tracking-wider ${
                report.overallRecommendation === "PASS"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/40 text-rose-400"
              }`}>
                {report.overallRecommendation}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Executive Summary Card */}
          <div className="px-6 py-3 bg-black/40 border-b border-white/5 text-xs text-zinc-300 leading-relaxed">
            <span className="font-semibold text-cyan-400 mr-1.5">Executive Evidence Summary:</span>
            {report.summaryExecutive}
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 pt-3 pb-1 border-b border-white/5 flex gap-2 overflow-x-auto bg-zinc-950">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "profile"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Candidate Evidence Profile
            </button>
            {report.canonicalGitHubSummary && (
              <button
                onClick={() => setActiveTab("github")}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "github"
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" /> GitHub Architecture Dossier ({report.canonicalGitHubSummary.analyzedRepoCount || 15} repos)
              </button>
            )}
            <button
              onClick={() => setActiveTab("transcript")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "transcript"
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Timer className="w-3.5 h-3.5" /> Q&A & Silence Latency ({report.explainableTranscript.length})
            </button>
            <button
              onClick={() => setActiveTab("gaze")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "gaze"
                  ? "border-violet-400 text-violet-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Gaze Stability & Scanpath
            </button>
            <button
              onClick={() => setActiveTab("yolo")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "yolo"
                  ? "border-rose-400 text-rose-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> YOLO Vision ({report.yoloProctoringReport.phoneCount} phones, {report.yoloProctoringReport.faceAbsenceCount} away)
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "timeline"
                  ? "border-indigo-400 text-indigo-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Proctoring Audit & Timeline ({report.proctoringTimeline?.length || 0})
            </button>
          </div>

          {/* Tab Content Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* TAB 1: CANDIDATE EVIDENCE PROFILE */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Cohort Percentile Benchmark Card (Strictly Real Applicant Pool) */}
                {report.cohortRanking && (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-zinc-900/60 border border-cyan-500/20 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Role Cohort Percentile Ranking
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Strict live benchmark across {report.cohortRanking.cohortSize} actual applicant{report.cohortRanking.cohortSize > 1 ? 's' : ''} for {report.jobTitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Rank #{report.cohortRanking.rank} of {report.cohortRanking.cohortSize}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {report.cohortRanking.overallPercentile}th Percentile
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-200">
                        {report.cohortRanking.headline}
                      </p>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Candidate scored <strong className="text-white">{report.totalScore}/10</strong> overall. 
                        {report.cohortRanking.cohortSize === 1 
                          ? " Initial candidate evaluated for this requisition. Relative rankings will dynamically calibrate as subsequent applicants complete interviews." 
                          : ` Positioned higher than ${report.cohortRanking.overallPercentile}% of all evaluated candidates for this specific role.`}
                      </p>
                    </div>

                    {/* Competency Percentile Breakdown Bars */}
                    {report.cohortRanking.competencyPercentiles && report.cohortRanking.competencyPercentiles.length > 0 && (
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-semibold">
                          Competency Standing Relative to Cohort:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {report.cohortRanking.competencyPercentiles.map((cp) => (
                            <div key={cp.competency} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-zinc-300 truncate max-w-[170px]">{cp.competency}</span>
                                <span className="font-mono text-cyan-300 font-bold">{cp.percentile}th %ile</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div 
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                                  style={{ width: `${Math.min(100, Math.max(5, cp.percentile))}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                <span>Score: {cp.score}/10</span>
                                <span>Cohort Avg: {cp.cohortAverage}/10</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Canonical GitHub Architecture Highlights Card in Tab 1 */}
                {report.canonicalGitHubSummary && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-zinc-900/60 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                        <GitBranch className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Ground-Truth GitHub Intelligence Mapped
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {report.canonicalGitHubSummary.primaryArchetype}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                          {report.canonicalGitHubSummary.executiveSummary}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setActiveTab("github")}
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-xs font-mono font-semibold"
                    >
                      View Architecture Dossier ({report.canonicalGitHubSummary.flagshipProjects.length} Flagships) →
                    </Button>
                  </div>
                )}

                <div className="flex justify-between items-center pb-1">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                    Competency Evidence Ledger
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">
                    Click each competency for in-depth verification proof
                  </span>
                </div>

                <div className="space-y-3">
                  {report.candidateEvidenceProfile.map((item) => {
                    const isExpanded = expandedCompetency === item.category;
                    return (
                      <div
                        key={item.category}
                        className="rounded-2xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all overflow-hidden"
                      >
                        {/* Summary Row */}
                        <div
                          onClick={() => toggleExpand(item.category)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-bold text-white">{item.category}</span>
                              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold ${getRatingColor(item.rating)}`}>
                                {item.rating}
                              </span>
                            </div>
                            {/* ASCII Bar requested by user */}
                            <div className="font-mono text-sm tracking-wider text-cyan-400 select-all">
                              {item.asciiBar} <span className="text-xs text-zinc-400 font-sans ml-2">{item.rating} ({item.score}/10)</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Sources</span>
                              <span className="text-xs font-mono text-zinc-300">
                                {item.evidenceSources.join(" + ")}
                              </span>
                            </div>
                            <div className="p-1 rounded-lg bg-white/5 text-zinc-400">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* In-Depth Accordion Body */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3.5 bg-black/30 text-xs">
                            <div>
                              <span className="font-semibold text-zinc-300 block mb-1">In-Depth Assessment:</span>
                              <p className="text-zinc-400 leading-relaxed">{item.inDepthRationale}</p>
                            </div>

                            {item.verifiedFindings && item.verifiedFindings.length > 0 && (
                              <div>
                                <span className="font-semibold text-emerald-400 block mb-1">Verified Evidence Points:</span>
                                <ul className="space-y-1">
                                  {item.verifiedFindings.map((finding, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5 text-zinc-300">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                      <span>{finding}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {item.quotes && item.quotes.length > 0 && (
                              <div>
                                <span className="font-semibold text-teal-400 block mb-1">Candidate Answer Quotes:</span>
                                <div className="space-y-1 pl-3 border-l-2 border-teal-500/40">
                                  {item.quotes.map((quote, idx) => (
                                    <p key={idx} className="text-zinc-300 italic">{quote}</p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {item.remainingGaps && item.remainingGaps.length > 0 && (
                              <div>
                                <span className="font-semibold text-amber-400 block mb-1">Remaining Gaps & Scope Limits:</span>
                                <ul className="space-y-1">
                                  {item.remainingGaps.map((gap, idx) => (
                                    <li key={idx} className="text-zinc-400">• {gap}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="pt-1 flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                              <span>Traceable Turns: {item.traceableTurns.length > 0 ? `#${item.traceableTurns.join(", #")}` : "Direct evaluation inference"}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: GITHUB ARCHITECTURE DOSSIER */}
            {activeTab === "github" && report.canonicalGitHubSummary && (
              <div className="space-y-6">
                {/* Executive Dossier Header */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-zinc-900/60 border border-emerald-500/20 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <GitBranch className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white uppercase tracking-wider block">
                            Canonical GitHub Architecture Dossier
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Ground Truth
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                          Profile:{" "}
                          <a
                            href={report.canonicalGitHubSummary.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1 font-mono font-semibold"
                          >
                            @{report.canonicalGitHubSummary.username}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-zinc-600">•</span>
                          <span>Static audit of {report.canonicalGitHubSummary.analyzedRepoCount || 15} latest repositories</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {report.canonicalGitHubSummary.primaryArchetype}
                      </span>
                    </div>
                  </div>

                  {/* Executive Architecture Summary */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
                      Executive Architectural Summary (What Candidate Actually Built):
                    </span>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-black/30 p-3.5 rounded-xl border border-white/5">
                      {report.canonicalGitHubSummary.executiveSummary}
                    </p>
                  </div>

                  {/* Quick Stat Counter Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                      <span className="text-[10px] font-mono text-zinc-400 block uppercase">Repos Analyzed</span>
                      <span className="text-base font-bold font-mono text-white">{report.canonicalGitHubSummary.analyzedRepoCount || 15}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                      <span className="text-[10px] font-mono text-zinc-400 block uppercase">Flagship Architectures</span>
                      <span className="text-base font-bold font-mono text-emerald-400">{report.canonicalGitHubSummary.flagshipProjects.length}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                      <span className="text-[10px] font-mono text-zinc-400 block uppercase">Verified Techs in Code</span>
                      <span className="text-base font-bold font-mono text-cyan-400">{report.canonicalGitHubSummary.verifiedTechnologies.length}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                      <span className="text-[10px] font-mono text-zinc-400 block uppercase">Targeted Code Probes</span>
                      <span className="text-base font-bold font-mono text-purple-400">{report.canonicalGitHubSummary.suggestedArchitectureProbes.length}</span>
                    </div>
                  </div>
                </div>

                {/* Flagship Projects & End-to-End Architectures */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                        Flagship Projects & End-to-End Architectures
                      </h3>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono">
                      Mapped from manifests, dependencies, and code patterns
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {report.canonicalGitHubSummary.flagshipProjects.map((project, idx) => (
                      <div
                        key={project.repoName}
                        className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-4 shadow-lg hover:border-emerald-500/30 transition-all"
                      >
                        {/* Project Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-white hover:text-emerald-400 flex items-center gap-1.5 transition-colors font-mono"
                            >
                              {project.repoName}
                              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                            </a>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-white/5">
                              {project.primaryLanguage}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                              project.codeMaturity === 'PRODUCTION_GRADE'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                : project.codeMaturity === 'SOLID_INDIVIDUAL_PROJECT'
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                            }`}>
                              {project.codeMaturity.replace(/_/g, ' ')}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/35">
                              {project.architectureType}
                            </span>
                          </div>
                        </div>

                        {/* Purpose */}
                        {project.primaryPurpose && (
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {project.primaryPurpose}
                          </p>
                        )}

                        {/* Visual End-to-End Architecture Flow */}
                        <div className="space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
                            End-to-End Architecture Pipeline:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {project.endToEndArchitecture.split('->').map((step, sIdx, arr) => (
                              <React.Fragment key={sIdx}>
                                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-950/40 text-emerald-200 border border-emerald-500/25 shadow-sm">
                                  {step.trim()}
                                </span>
                                {sIdx < arr.length - 1 && (
                                  <span className="text-zinc-500 font-bold font-mono text-xs">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Tech Stack & Design Patterns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Key Technologies:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {project.keyTechnologies.map((tech) => (
                                <span
                                  key={tech}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-white/5"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Design Patterns:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {project.designPatterns.map((pat) => (
                                <span
                                  key={pat}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-cyan-950/30 text-cyan-300 border border-cyan-500/20"
                                >
                                  {pat}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Engineering Discipline Badges & Verified Decisions */}
                        <div className="pt-2 border-t border-white/5 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border ${
                              project.hasTests
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-900 text-zinc-500 border-white/5'
                            }`}>
                              <CheckCircle2 className={`w-3.5 h-3.5 ${project.hasTests ? 'text-emerald-400' : 'text-zinc-600'}`} />
                              {project.hasTests ? 'Automated Tests Present' : 'No Automated Tests'}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border ${
                              project.hasDocker
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-900 text-zinc-500 border-white/5'
                            }`}>
                              <Box className={`w-3.5 h-3.5 ${project.hasDocker ? 'text-emerald-400' : 'text-zinc-600'}`} />
                              {project.hasDocker ? 'Containerized (Docker)' : 'No Containerization'}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border ${
                              project.hasCiCd
                                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                : 'bg-zinc-900 text-zinc-500 border-white/5'
                            }`}>
                              <Activity className={`w-3.5 h-3.5 ${project.hasCiCd ? 'text-indigo-400' : 'text-zinc-600'}`} />
                              {project.hasCiCd ? 'CI/CD Automation' : 'Manual Deployment'}
                            </span>
                          </div>

                          {project.verifiedArchitecturalDecisions && project.verifiedArchitecturalDecisions.length > 0 && (
                            <div className="pt-2">
                              <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block mb-1">
                                Verified Code Decisions:
                              </span>
                              <ul className="space-y-1">
                                {project.verifiedArchitecturalDecisions.map((dec, dIdx) => (
                                  <li key={dIdx} className="text-xs text-zinc-300 flex items-start gap-1.5">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{dec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Targeted Architectural Probe Questions Grounded in Code */}
                {report.canonicalGitHubSummary.suggestedArchitectureProbes && report.canonicalGitHubSummary.suggestedArchitectureProbes.length > 0 && (
                  <div className="p-5 rounded-2xl bg-zinc-900/50 border border-purple-500/20 space-y-3.5 shadow-lg">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                      <Code2 className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Grounded Architectural Questions (Synthesized from Candidate Code)
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {report.canonicalGitHubSummary.suggestedArchitectureProbes.map((probe, pIdx) => (
                        <div key={pIdx} className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-purple-300 font-bold">
                              Repo: <span className="text-white underline">{probe.repoName}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/25">
                              Skill: {probe.targetedSkill}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white bg-zinc-900/80 p-2.5 rounded-lg border border-white/5">
                            "{probe.question}"
                          </p>
                          <p className="text-[11px] text-zinc-400 italic">
                            Rationale: {probe.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verified Technologies Ledger */}
                {report.canonicalGitHubSummary.verifiedTechnologies && report.canonicalGitHubSummary.verifiedTechnologies.length > 0 && (
                  <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Verified Technologies (Evidence Grounded Across Repositories)
                      </h4>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {report.canonicalGitHubSummary.verifiedTechnologies.map((item) => (
                        <div
                          key={item.technology}
                          className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2 text-xs"
                        >
                          <span className="font-semibold text-zinc-200">{item.technology}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                            item.depth === 'CORE_DEPENDENCY'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : item.depth === 'INFRASTRUCTURE'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {item.depth.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {item.repos.length} repo{item.repos.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Architectural Strengths & Engineering Limits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Architectural Strengths
                    </span>
                    <ul className="space-y-1.5 text-xs text-zinc-300 pt-1">
                      {report.canonicalGitHubSummary.architecturalStrengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Engineering Gaps & Scope Limits
                    </span>
                    <ul className="space-y-1.5 text-xs text-zinc-300 pt-1">
                      {report.canonicalGitHubSummary.engineeringGaps.length > 0 ? (
                        report.canonicalGitHubSummary.engineeringGaps.map((gap, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-zinc-400">
                            <span>•</span>
                            <span>{gap}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-zinc-500 italic">No critical architectural gaps observed in public repositories.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: QUESTIONS ASKED & ANSWERED WITH POST-TTS SILENCE LATENCY */}
            {activeTab === "transcript" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Post-TTS Silence & Response Latency Analysis
                  </div>
                  <p className="text-amber-200/80 leading-relaxed">
                    Tracks candidate thinking time elapsed after Kokoro TTS completed speaking the question before the candidate started answering.
                  </p>
                </div>

                <div className="space-y-4">
                  {report.explainableTranscript.map((turn) => {
                    const silence = turn.silenceLatencySec;
                    const ratingColor =
                      silence < 2.0
                        ? "text-teal-400 border-teal-500/30 bg-teal-500/10"
                        : silence < 5.0
                        ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                        : "text-amber-400 border-amber-500/30 bg-amber-500/10";

                    return (
                      <div
                        key={turn.turn}
                        className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 space-y-3.5 shadow-lg"
                      >
                        {/* Turn Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center">
                              {turn.turn}
                            </span>
                            <span className="text-xs font-semibold text-zinc-300 font-mono">
                              Competency: <strong className="text-white">{turn.competencyTargeted}</strong>
                            </span>
                            {turn.difficultyLevel && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                turn.difficultyLevel === 'EXPERT'
                                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/35'
                                  : turn.difficultyLevel === 'HARD'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                                  : turn.difficultyLevel === 'MEDIUM'
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/35'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              }`}>
                                {turn.difficultyLevel} ({turn.difficultyWeight || 1.0}x Complexity)
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            {turn.calibratedScore !== undefined && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[11px]">
                                Calibrated: <strong>{turn.calibratedScore}/10</strong>
                              </span>
                            )}
                            <span className="text-zinc-500 text-[11px]">TTS: {turn.ttsDurationSec.toFixed(1)}s</span>
                            <span className="text-zinc-600">•</span>
                            <span className={`px-2 py-0.5 rounded-full border ${ratingColor}`}>
                              Silence / Thinking: <strong>{silence.toFixed(1)}s</strong> ({turn.latencyAssessment})
                            </span>
                          </div>
                        </div>

                        {/* Question */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Question Spoken by AI:</span>
                          <p className="text-sm font-medium text-white leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                            {turn.question}
                          </p>
                        </div>

                        {/* Candidate Answer */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Candidate Spoken Response:</span>
                          <p className="text-xs text-zinc-300 leading-relaxed bg-emerald-950/10 p-3 rounded-xl border border-emerald-500/15">
                            "{turn.answer}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: GAZE MOVEMENT, BIOMECHANICAL PATTERNS & RECRUITER EDUCATION */}
            {activeTab === "gaze" && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Gaze Assessment</span>
                    <div className={`text-base font-bold font-mono mt-1 ${
                      report.gazeStabilityAnalysis.isExcessiveMovement ? "text-rose-400" : "text-cyan-400"
                    }`}>
                      {report.gazeStabilityAnalysis.movementAssessment}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Saccadic scan stability</p>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Away-From-Screen</span>
                    <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                      {report.gazeStabilityAnalysis.awayDurationSec}s ({report.gazeStabilityAnalysis.awayPercentage}%)
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Across {report.gazeStabilityAnalysis.awayEpisodesCount} episodes
                    </p>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Reading Fixations</span>
                    <div className="text-xl font-bold font-mono text-violet-300 mt-1">
                      {report.gazeStabilityAnalysis.totalFixations} clusters
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Avg duration {report.gazeStabilityAnalysis.avgFixationDurationMs}ms (≥150ms)
                    </p>
                  </Card>
                </div>

                {/* Detailed Analysis Explanation */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-1.5 text-xs text-zinc-300">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" /> Excessive Movement Evaluation:
                  </span>
                  <p className="text-zinc-400 leading-relaxed">
                    {report.gazeStabilityAnalysis.explanation}
                  </p>
                </div>

                {/* BIOMECHANICAL GAZE PATTERN DIAGNOSTICS */}
                {report.gazeStabilityAnalysis.detectedPatterns && report.gazeStabilityAnalysis.detectedPatterns.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-violet-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Biomechanical Gaze Pattern Diagnostics ({report.gazeStabilityAnalysis.detectedPatterns.length} Patterns Evaluated)
                        </h4>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        AI Iris Vector & Scanpath Classification
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {report.gazeStabilityAnalysis.detectedPatterns.map((pat) => {
                        const isHigh = pat.severity === 'HIGH';
                        const isMedium = pat.severity === 'MEDIUM';
                        const isDetected = pat.status === 'DETECTED';

                        const cardBorder = isDetected
                          ? isHigh
                            ? 'border-rose-500/40 bg-rose-500/[0.04]'
                            : isMedium
                            ? 'border-amber-500/40 bg-amber-500/[0.04]'
                            : 'border-cyan-500/40 bg-cyan-500/[0.04]'
                          : 'border-white/10 bg-zinc-900/40';

                        const statusBadgeClass = isDetected
                          ? isHigh
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isMedium
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/5';

                        const riskBadgeClass =
                          pat.severity === 'HIGH'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : pat.severity === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';

                        return (
                          <div
                            key={pat.id}
                            className={`p-4 rounded-2xl border transition-all ${cardBorder} space-y-3`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white tracking-wide">
                                  {pat.name}
                                </span>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                                  {pat.status === 'DETECTED' ? `DETECTED (${pat.observedCount}x)` : pat.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold ${riskBadgeClass}`}>
                                  Risk: {pat.severity}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                <span className="font-semibold text-cyan-300 flex items-center gap-1.5 text-[11px]">
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Biomechanical Signature:
                                </span>
                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                  {pat.biomechanicalSignature}
                                </p>
                              </div>

                              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                <span className="font-semibold text-violet-300 flex items-center gap-1.5 text-[11px]">
                                  <Brain className="w-3.5 h-3.5 text-violet-400" /> Cognitive & Behavioral Meaning:
                                </span>
                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                  {pat.cognitiveMeaning}
                                </p>
                              </div>

                              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                <span className="font-semibold text-amber-300 flex items-center gap-1.5 text-[11px]">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Recruiter Evaluation Implication:
                                </span>
                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                  {pat.recruiterImplication}
                                </p>
                              </div>

                              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                <span className="font-semibold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Actionable Verification Guide:
                                </span>
                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                  {pat.recommendedAction}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* RECRUITER EDUCATIONAL PRIMER: READING VS THINKING */}
                {report.gazeStabilityAnalysis.recruiterEducation && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-zinc-900/60 to-black/60 border border-indigo-500/20 space-y-4">
                    <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Recruiter Educational Primer: Biomechanics of Gaze & Attention
                          </h4>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {report.gazeStabilityAnalysis.recruiterEducation.readingVsThinking.summary}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold shrink-0">
                        HIRING PLAYBOOK
                      </span>
                    </div>

                    {/* Side-by-Side Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Reading Saccades */}
                      <div className="p-4 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                          <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                            Reading Saccades (External AI Script / Secondary Screen)
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Characterized by rhythmic horizontal eye traversal followed by quick leftward return sweeps as the candidate reads lines of text off-screen.
                        </p>
                        <ul className="space-y-1.5 pt-1">
                          {report.gazeStabilityAnalysis.recruiterEducation.readingVsThinking.readingIndicators.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Right: Cognitive Gaze Aversion */}
                      <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                            Cognitive Gaze Aversion (Authentic Problem Solving)
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Neurobiological reflex where candidates look upward or into neutral space during difficult mental formulation to reduce visual cognitive load.
                        </p>
                        <ul className="space-y-1.5 pt-1">
                          {report.gazeStabilityAnalysis.recruiterEducation.readingVsThinking.thinkingIndicators.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Fair Hiring Safeguard Notice */}
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-white">Fair Evaluation Safeguard for Recruiters:</span>
                        <p className="text-zinc-300 text-[11px] leading-relaxed">
                          Never penalize a candidate simply for looking away or looking up while thinking. Cognitive gaze aversion is proof of authentic memory retrieval and logic synthesis. True cheating manifests as rhythmic horizontal line-reading while delivering unnatural, unbroken speech without thinking pauses.
                        </p>
                      </div>
                    </div>

                    {/* Forensic Patterns Quick Reference */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                        Forensic Pattern Quick-Reference Guide:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {report.gazeStabilityAnalysis.recruiterEducation.patternsGuide.map((guide, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">{guide.patternName}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                guide.riskLevel === 'HIGH' ? 'bg-rose-500/20 text-rose-300' :
                                guide.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                {guide.riskLevel}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-300">
                              <strong className="text-zinc-400">Meaning:</strong> {guide.whatItMeans}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              <strong className="text-zinc-500">Why:</strong> {guide.whyItHappens}
                            </p>
                            <p className="text-[11px] text-cyan-300">
                              <strong className="text-cyan-400">Verify:</strong> {guide.howToVerify}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2D Scanpath Visualization */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-white">MediaPipe 2D Scanpath & Attention Map</span>
                    <span className="text-[10px] font-mono text-cyan-400">478 3D Landmarks & Iris Vectors</span>
                  </div>
                  <ScanpathVisualizer
                    points={report.eyeTrackingData?.scanpath || []}
                    width={800}
                    height={360}
                  />
                </div>
              </div>
            )}

            {/* TAB 4: YOLO VISION PROCTORING SUMMARY */}
            {activeTab === "yolo" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Phones Detected</span>
                    <div className={`text-2xl font-bold font-mono mt-1 ${
                      report.yoloProctoringReport.phoneCount > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {report.yoloProctoringReport.phoneCount}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Unauthorized devices</p>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Out of Screen</span>
                    <div className={`text-2xl font-bold font-mono mt-1 ${
                      report.yoloProctoringReport.faceAbsenceCount > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {report.yoloProctoringReport.faceAbsenceCount}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Face absence events</p>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Multiple Faces</span>
                    <div className={`text-2xl font-bold font-mono mt-1 ${
                      report.yoloProctoringReport.multipleFacesCount > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {report.yoloProctoringReport.multipleFacesCount}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Room presence check</p>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-4">
                    <span className="text-xs text-zinc-400">Misconduct Score</span>
                    <div className={`text-2xl font-bold font-mono mt-1 ${
                      report.yoloProctoringReport.totalMisconductScore > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {report.yoloProctoringReport.totalMisconductScore} pts
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Status: {report.yoloProctoringReport.severity}</p>
                  </Card>
                </div>

                {/* YOLO Assessment Explanation */}
                <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  report.yoloProctoringReport.severity === "CLEAN"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                }`}>
                  <span className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> YOLO26 Vision Model Assessment:
                  </span>
                  <p className="leading-relaxed">
                    {report.yoloProctoringReport.explanation}
                  </p>
                </div>

                {/* Event Log */}
                {report.yoloProctoringReport.events && report.yoloProctoringReport.events.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-white">Detection Event Timeline</span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {report.yoloProctoringReport.events.map((evt, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-white">{evt.eventType}</span>
                            {evt.objectClass && (
                              <span className="text-zinc-400">({evt.objectClass})</span>
                            )}
                          </div>
                          <span className="text-zinc-500 text-[10px]">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: MULTI-SIGNAL PROCTORING AUDIT & TIMELINE */}
            {activeTab === "timeline" && (
              <div className="space-y-6">
                {/* Non-Punitive Auditor Notice */}
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-3">
                  <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold text-white">Non-Punitive Evidence Proctoring System</span>
                    <p className="leading-relaxed text-zinc-300">
                      Signals are recorded as neutral objective observations for recruiter review. No candidate is automatically penalized or labeled as fraudulent based on automated metrics.
                    </p>
                  </div>
                </div>

                {/* Audit Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Face Presence</span>
                    <div className="text-xs font-bold text-emerald-400 mt-1 truncate">
                      {report.factualProctoringSummary?.facePresenceConsistency || "Consistent (>98%)"}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Tab / Window</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      (report.factualProctoringSummary?.tabVisibilityEvents || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {report.factualProctoringSummary?.tabVisibilityEvents || 0}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Sustained Gaze</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      (report.factualProctoringSummary?.sustainedGazeAwayEvents || 0) > 0 ? "text-cyan-400" : "text-emerald-400"
                    }`}>
                      {report.factualProctoringSummary?.sustainedGazeAwayEvents || 0}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Head Turns</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      (report.factualProctoringSummary?.sustainedHeadTurnEvents || 0) > 0 ? "text-violet-400" : "text-emerald-400"
                    }`}>
                      {report.factualProctoringSummary?.sustainedHeadTurnEvents || 0}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Audio Anomalies</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      (report.factualProctoringSummary?.audioAnomalies || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {report.factualProctoringSummary?.audioAnomalies || 0}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Device Events</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      (report.factualProctoringSummary?.unauthorizedDeviceEvents || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {report.factualProctoringSummary?.unauthorizedDeviceEvents || 0}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Paste Bursts</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      (report.factualProctoringSummary?.codePasteBursts || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {report.factualProctoringSummary?.codePasteBursts || 0}
                    </div>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/10 p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Key Cadence</span>
                    <div className={`text-sm font-bold font-mono mt-1 truncate ${
                      (report.factualProctoringSummary?.unnaturalKeystrokeEvents || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {(report.factualProctoringSummary?.unnaturalKeystrokeEvents || 0) > 0 ? "MACRO" : "NATURAL"}
                    </div>
                  </Card>
                </div>

                {/* Audit Overview Banner */}
                <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
                  report.factualProctoringSummary?.reviewRecommended
                    ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                }`}>
                  <div className="flex items-center gap-2.5">
                    {report.factualProctoringSummary?.reviewRecommended ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>
                      <strong className="font-semibold text-white mr-1.5">Factual Overview:</strong>
                      {report.factualProctoringSummary?.factualOverview || "All sensor streams operating within standard session baseline."}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/10 text-white font-bold">
                    {report.factualProctoringSummary?.reviewRecommended ? "REVIEW RECOMMENDED" : "BASELINE VERIFIED"}
                  </span>
                </div>

                {/* Correlated Observation Clusters */}
                {report.correlatedObservations && report.correlatedObservations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Cross-Signal Correlated Patterns ({report.correlatedObservations.length})
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {report.correlatedObservations.map((obs) => (
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
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Chronological Event Timeline
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

                  {/* Timeline Items */}
                  {(() => {
                    const allTimeline = report.proctoringTimeline || [];
                    const filtered = allTimeline.filter((item) => {
                      if (timelineFilter === "REVIEW") return item.requiresReview;
                      if (timelineFilter === "BROWSER") return item.source === "BROWSER";
                      if (timelineFilter === "VISION") return item.source !== "BROWSER";
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center rounded-2xl bg-zinc-900/30 border border-white/5 text-zinc-500 text-xs">
                          No proctoring events recorded. Continuous candidate presence verified.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {filtered.map((item) => {
                          const isExpanded = expandedTimelineId === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setExpandedTimelineId(isExpanded ? null : item.id)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
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
                              {isExpanded && (
                                <div className="mt-3 pt-2.5 border-t border-white/10 text-[11px] space-y-2 text-zinc-400 font-mono">
                                  <div className="flex justify-between">
                                    <span>Event Type: <strong className="text-white">{item.type}</strong></span>
                                    <span>Confidence: <strong className="text-emerald-400">{Math.round((item.confidence || 1) * 100)}%</strong></span>
                                  </div>

                                  {/* Photographic Evidence Snapshot */}
                                  {item.metadata?.snapshot && (() => {
                                    const snapshotUrl = item.metadata.snapshot as string;
                                    return (
                                      <div className="p-3 rounded-2xl bg-zinc-950 border border-rose-500/30 space-y-2 font-sans">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                                            <Camera className="w-3.5 h-3.5" /> Photographic Violation Evidence Captured
                                          </span>
                                          <span className="text-[10px] text-zinc-500 font-mono">Recorded at {item.timeOffsetFormatted}</span>
                                        </div>
                                        <div
                                          className="relative group cursor-pointer inline-block"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSnapshot({
                                              image: snapshotUrl,
                                              title: item.displayLabel,
                                              time: item.timeOffsetFormatted,
                                            });
                                          }}
                                        >
                                          <img
                                            src={snapshotUrl}
                                            alt="Violation Snapshot"
                                            className="w-48 h-36 object-cover rounded-xl border border-white/15 shadow-xl group-hover:border-cyan-400 transition-all"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity text-white text-xs gap-1 font-semibold">
                                            <Maximize2 className="w-4 h-4" /> Click to Enlarge
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {item.metadata && Object.keys(item.metadata).length > 0 && (
                                    <pre className="p-2 rounded-xl bg-black/60 text-[10px] text-zinc-300 overflow-x-auto border border-white/5 mt-1">
                                      {JSON.stringify(
                                        Object.fromEntries(
                                          Object.entries(item.metadata).filter(([k]) => k !== 'snapshot')
                                        ),
                                        null,
                                        2
                                      )}
                                    </pre>
                                  )}
                                  <p className="text-[10px] text-zinc-500 italic mt-1 font-sans">
                                    Logged as objective photographic and sensory proctoring evidence for recruiter verification.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-white/10 bg-zinc-900/60 flex justify-between items-center">
            <span className="text-xs text-zinc-500 font-mono">
              AI-Interview Intelligence Platform • Explainable Recruiter Dossier
            </span>
            <Button
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs px-5"
            >
              Close Dossier
            </Button>
          </div>

          {/* Photographic Evidence Lightbox Modal */}
          {selectedSnapshot && (
            <div
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 cursor-pointer"
              onClick={() => setSelectedSnapshot(null)}
            >
              <div
                className="relative max-w-2xl w-full bg-zinc-950 border border-white/20 rounded-3xl p-5 shadow-2xl space-y-3 cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Camera className="w-4 h-4 text-rose-400" />
                      <span>{selectedSnapshot.title}</span>
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      Session Timestamp: <strong className="text-cyan-400">{selectedSnapshot.time}</strong>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSnapshot(null)}
                    className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-black flex justify-center">
                  <img
                    src={selectedSnapshot.image}
                    alt="High-Res Violation Snapshot"
                    className="max-h-[60vh] w-auto object-contain"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 italic text-center">
                  Tamper-evident frame captured directly from candidate webcam stream during flagged violation event.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
