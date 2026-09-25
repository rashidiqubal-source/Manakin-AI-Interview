"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, ArrowLeft, Trophy, Search, Check, X, Mail, MessageSquare, 
  Skull, Building2, User, Sparkles, AlertTriangle, Eye, Clock, 
  ShieldAlert, ShieldCheck, CheckCircle2, FileText, Monitor, 
  Smartphone, VideoOff, Timer, Lock, Camera, ChevronLeft, ChevronRight, Cloud, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { updateApplicationStatusAPI, getCandidatesAPI } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";

export default function AdminPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [filterWithSnapshotsOnly, setFilterWithSnapshotsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [selectedViolationSnapshot, setSelectedViolationSnapshot] = useState<{
    title: string;
    eventType: string;
    snapshots: Array<{ url: string; time: string; details?: string; s3Key?: string }>;
    activeIndex: number;
  } | null>(null);

  const openViolationSnapshots = (categoryTitle: string, eventTypes: string[]) => {
    if (!selectedCandidate) return;

    const isAll = eventTypes.includes('ALL');
    const events = isAll
      ? (selectedCandidate.detectionEvents || [])
      : (selectedCandidate.detectionEvents || []).filter((e: any) =>
          eventTypes.includes(e.eventType) || (e.objectClass && eventTypes.includes(e.objectClass))
        );

    const snapshots: Array<{ url: string; time: string; details?: string; s3Key?: string }> = [];
    events.forEach((e: any) => {
      const meta = typeof e.metadata === 'string'
        ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })()
        : (e.metadata || {});
      const url = meta.snapshotUrl || meta.snapshot;
      if (url) {
        snapshots.push({
          url,
          time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          details: meta.message || e.eventType,
          s3Key: meta.snapshotKey,
        });
      }
    });

    if (snapshots.length === 0) {
      // Check if candidate has ANY snapshots in other categories
      const allCandidateSnapshots: Array<{ url: string; time: string; details?: string; s3Key?: string }> = [];
      (selectedCandidate.detectionEvents || []).forEach((e: any) => {
        const meta = typeof e.metadata === 'string'
          ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })()
          : (e.metadata || {});
        const url = meta.snapshotUrl || meta.snapshot;
        if (url) {
          allCandidateSnapshots.push({
            url,
            time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            details: meta.message || e.eventType,
            s3Key: meta.snapshotKey,
          });
        }
      });

      if (allCandidateSnapshots.length > 0) {
        toast.info(`"${categoryTitle}" has no camera capture. Opening all ${allCandidateSnapshots.length} photo snapshot(s) for this candidate.`);
        setSelectedViolationSnapshot({
          title: `All Proctoring Evidence (${selectedCandidate.candidateName})`,
          eventType: 'ALL',
          snapshots: allCandidateSnapshots,
          activeIndex: 0,
        });
        return;
      }

      toast.info(`No visual camera snapshots recorded for this candidate's interview session. Visual evidence is only captured upon camera-triggered proctoring events.`);
      return;
    }

    setSelectedViolationSnapshot({
      title: categoryTitle,
      eventType: eventTypes[0],
      snapshots,
      activeIndex: 0,
    });
  };

  const fetchCandidates = useCallback(async (recruiterId?: string) => {
    setIsLoading(true);
    try {
      const candidatesList = await getCandidatesAPI(recruiterId);
      const counts: Record<string, number> = {};
      
      const enhancedList = [...(candidatesList || [])]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(c => {
           const key = c.candidateEmail || c.candidateName;
           counts[key] = (counts[key] || 0) + 1;
           return { ...c, attemptNumber: counts[key] };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
      setCandidates(enhancedList);
    } catch (error) {
      toast.error("Failed to fetch candidates from server.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Authenticate strictly via recruiter role (no password/secret key prompt)
  useEffect(() => {
    if (isInitialized) {
      if (user?.role === "RECRUITER") {
        fetchCandidates(user.id);
      }
    }
  }, [user, isInitialized, fetchCandidates]);

  const handleStatusUpdate = async (id: string, status: "ACCEPTED" | "REJECTED") => {
    setActionLoadingId(id);
    try {
      await updateApplicationStatusAPI(id, status);
      toast.success(`Candidate marked as ${status}. Email dispatched.`);
      
      // Update local state smoothly without reloading table
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, applicationStatus: status } : c));
      if (selectedCandidate?.id === id) {
        setSelectedCandidate((prev: any) => ({ ...prev, applicationStatus: status }));
      }
    } catch (error) {
      toast.error("Failed to update status and send email");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getAnalytics = (evalData: any) => {
    if (!evalData) return { strong: [], weak: [] };
    const metrics = ["clarity", "simplicity", "patience", "warmth", "fluency"];
    const strong: string[] = [];
    const weak: string[] = [];

    metrics.forEach((m) => {
      if (evalData[m] && evalData[m].score >= 8) strong.push(m);
      if (evalData[m] && evalData[m].score <= 5) weak.push(m);
    });

    return { 
       strong: strong.length ? strong.join(", ") : "None highlighted", 
       weak: weak.length ? weak.join(", ") : "None highlighted" 
    };
  };

  const candidatesWithSnapshotsCount = useMemo(() => {
    return candidates.filter((c) =>
      (c.detectionEvents || []).some((e: any) => {
        const m = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
        return Boolean(m.snapshotUrl || m.snapshot);
      })
    ).length;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (filterWithSnapshotsOnly) {
        const hasSnaps = (c.detectionEvents || []).some((e: any) => {
          const m = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
          return Boolean(m.snapshotUrl || m.snapshot);
        });
        if (!hasSnaps) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (c.candidateName || '').toLowerCase().includes(q);
        const emailMatch = (c.candidateEmail || '').toLowerCase().includes(q);
        const jdMatch = (c.invitation?.jobDescription?.title || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !jdMatch) return false;
      }
      return true;
    });
  }, [candidates, filterWithSnapshotsOnly, searchQuery]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "RECRUITER") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="w-full max-w-md bg-zinc-900/90 border border-white/10 p-6 rounded-3xl text-center space-y-5 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-rose-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Recruiter Access Only</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Candidate reports, AI evaluation scores, and proctoring telemetry are strictly confidential and accessible only to verified recruiters.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                onClick={() => router.push("/recruiter/sign-in")}
                className="w-full py-5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:opacity-95 text-black font-semibold rounded-xl text-sm"
              >
                Sign In as Recruiter
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/")}
                className="w-full text-zinc-400 hover:text-white"
              >
                Return to Home
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500" />
              {user?.role === "RECRUITER" ? "Candidate Analytics & Pipeline" : "Candidate Logistics & Analytics"}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              {user?.role === "RECRUITER" 
                ? `Showing candidate assessments for ${user.name || user.email} openings` 
                : "Review applicant metrics and finalize decisions"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === "RECRUITER" && (
              <Button
                variant="outline"
                onClick={() => router.push("/recruiter")}
                className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs h-10"
              >
                <Building2 className="w-3.5 h-3.5 mr-1.5" /> Recruiter Hub
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push(user?.role === "RECRUITER" ? "/recruiter" : "/")}
              className="border-zinc-700 text-white hover:bg-zinc-800 text-xs h-10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> {user?.role === "RECRUITER" ? "Back to Dashboard" : "Exit Hub"}
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/60 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setFilterWithSnapshotsOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                !filterWithSnapshotsOnly
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              All Candidates ({candidates.length})
            </button>
            <button
              onClick={() => setFilterWithSnapshotsOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filterWithSnapshotsOnly
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                  : 'text-cyan-400/80 hover:text-cyan-300 hover:bg-cyan-950/40 border border-cyan-950'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              With Photo Evidence ({candidatesWithSnapshotsCount})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-teal-500 animate-pulse font-semibold">Loading Candidate Assessments...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40 backdrop-blur-md shadow-2xl">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-widest border-b border-white/5">
                <tr>
                  <th className="px-6 py-5 font-semibold">Candidate & Job</th>
                  <th className="px-6 py-5 font-semibold text-center">Misconduct</th>
                  <th className="px-6 py-5 font-semibold">Analytics: Strong Points</th>
                  <th className="px-6 py-5 font-semibold">Analytics: Weak Points</th>
                  <th className="px-6 py-5 font-semibold text-center">AI Total Score</th>
                  <th className="px-6 py-5 font-semibold text-center">Status</th>
                  <th className="px-6 py-5 font-semibold text-right">Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredCandidates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                      {filterWithSnapshotsOnly
                        ? "No candidates found with visual photo evidence matching your search."
                        : "No candidate interview submissions found matching your search."}
                    </td>
                  </tr>
                )}
                {filteredCandidates.map((c, idx) => {
                  const analytics = getAnalytics(c.evaluationData);
                  const isFlagged = c.evaluationData?.overallRecommendation === 'FLAGGED';
                  const jdTitle = c.invitation?.jobDescription?.title;
                  const candidateSnapshotsCount = (c.detectionEvents || []).filter((e: any) => {
                    const m = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
                    return Boolean(m.snapshotUrl || m.snapshot);
                  }).length;

                  return (
                    <motion.tr 
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedCandidate(c)}
                      className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          {c.candidateName} 
                          {c.attemptNumber > 1 && (
                            <span className="text-teal-400 font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded ml-1">
                              #{c.attemptNumber}
                            </span>
                          )}
                          {isFlagged && (
                            <span className="text-amber-400 text-[10px] font-medium px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5" /> Review Notes
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {c.candidateEmail || "No Email"}
                          </span>
                          {jdTitle ? (
                            <span className="text-violet-400 font-medium text-[11px] bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full w-fit">
                              🎯 {jdTitle}
                            </span>
                          ) : (c.questionBlueprint?.isDemo || !c.invitationId) ? (
                            <span className="text-cyan-400 font-medium text-[11px] bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                              🎮 Demo Interview (10 Questions)
                            </span>
                          ) : null}
                          {candidateSnapshotsCount > 0 && (
                            <span className="text-teal-300 font-mono text-[10px] bg-teal-950/80 border border-teal-600/40 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit shadow-[0_0_10px_rgba(20,184,166,0.15)]">
                              <Camera className="w-3 h-3 text-teal-400" /> {candidateSnapshotsCount} Photo Captures
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600 font-mono">ID: {c.id.split('-')[0]}</span>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-center">
                         {c.cheatCount > 0 ? (
                            <span className="text-amber-400 font-medium bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 text-xs">{c.cheatCount}</span>
                         ) : (
                            <span className="text-zinc-500 font-medium bg-zinc-800/30 px-2.5 py-0.5 rounded-full border border-zinc-700/20 text-xs">0</span>
                         )}
                      </td>
                      <td className="px-6 py-5 text-cyan-400 font-medium capitalize">{analytics.strong}</td>
                      <td className="px-6 py-5 text-rose-400 font-medium capitalize">{analytics.weak}</td>
                      <td className="px-6 py-5 text-center">
                         <span className="bg-violet-500/10 border border-violet-500/20 text-violet-300 px-3 py-1 rounded-full font-mono shadow-[0_0_10px_rgba(139,92,246,0.1)]">
                            {c.totalScore || 0}/60
                         </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                         {c.status === 'IN_PROGRESS' ? (
                            <span className="text-zinc-500 bg-zinc-500/10 border border-zinc-500/20 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.2em]">INCOMPLETE</span>
                         ) : c.applicationStatus === 'PENDING' ? (
                            <span className="text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider">PENDING</span>
                         ) : c.applicationStatus === 'ACCEPTED' ? (
                            <span className="text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider">SELECTED</span>
                         ) : isFlagged ? (
                            <span className="text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full text-xs font-medium">Review Notes</span>
                         ) : (
                            <span className="text-rose-400 bg-rose-400/10 border border-rose-400/20 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider">REJECTED</span>
                         )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {candidateSnapshotsCount > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidate(c);
                                openViolationSnapshots('All Visual Evidence', ['ALL']);
                              }}
                              className="bg-teal-950/80 text-teal-300 border-teal-500/40 hover:bg-teal-900/60 text-xs flex items-center gap-1 shadow-[0_0_10px_rgba(20,184,166,0.2)] cursor-pointer h-8 px-2.5"
                            >
                              <Camera className="w-3.5 h-3.5 text-teal-400" /> Photo Evidence ({candidateSnapshotsCount})
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={(e) => { e.stopPropagation(); router.push(`/evaluation?sessionId=${c.id}&isDemo=${c.questionBlueprint?.isDemo ? 'true' : 'false'}`); }}
                            className="bg-zinc-800/80 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(34,211,238,0.1)] flex items-center gap-1.5 h-8 px-3 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Full Evaluation Report
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Candidate Analysis Modal Overlay */}
        <AnimatePresence>
          {selectedCandidate && (() => {
            const evalData = selectedCandidate.evaluationData || {};
            const procSummary = selectedCandidate.proctoringSummary || evalData.proctoringSummary || {};
            const factual = procSummary.factualSummary || {};

            const mobileCount = procSummary.mobilePhoneCount ?? factual.unauthorizedDeviceEvents ?? 0;
            const absentCount = procSummary.absenceCount ?? factual.absenceEvents ?? 0;
            const concealedCount = procSummary.concealedPhoneCount ?? factual.concealedPhoneEvents ?? 0;
            const readingCount = procSummary.readingPatternCount ?? factual.readingPatternEvents ?? 0;
            const glancesCount = procSummary.cornerGlancesCount ?? factual.cornerGlancesEvents ?? 0;
            const cheatCount = selectedCandidate.cheatCount ?? 0;

            const eyeData = selectedCandidate.eyeTrackingData || evalData.eyeTrackingData || {};
            const awayPercentage = eyeData.awayPercentage ?? 0;
            const visualFocus = Math.max(0, Math.min(100, Math.round(100 - awayPercentage)));

            const latencies = selectedCandidate.responseLatencies || evalData.responseLatencies || [];
            const avgHesitation = Array.isArray(latencies) && latencies.length > 0
              ? (latencies.reduce((acc: number, item: any) => acc + (item.silenceDurationSec || 0), 0) / latencies.length)
              : 0;

            const tabHiddenCount = factual.tabVisibilityEvents ?? 0;
            const pasteBurstCount = factual.codePasteBurstEvents ?? 0;

            const hasSnapshotsFor = (types: string[]) => (selectedCandidate.detectionEvents || []).some((e: any) => {
              const match = types.includes(e.eventType) || (e.objectClass && types.includes(e.objectClass));
              if (!match) return false;
              const meta = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
              return Boolean(meta.snapshotUrl || meta.snapshot);
            });

            const allVisualSnapshotsCount = (selectedCandidate.detectionEvents || []).filter((e: any) => {
              const meta = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
              return Boolean(meta.snapshotUrl || meta.snapshot);
            }).length;

            const injectionAttempts = (selectedCandidate.detectionEvents || []).filter((e: any) =>
              ['PROMPT_INJECTION', 'SCORE_MANIPULATION', 'INJECTION_ATTEMPT'].includes(e.eventType)
            ).length;

            const isFlagged = selectedCandidate.overallRecommendation === 'FLAGGED' || 
              evalData.overallRecommendation === 'FLAGGED' || 
              (procSummary.misconductScore || 0) > 0 || 
              cheatCount > 0;

            return (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              >
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="bg-zinc-950 border border-zinc-800 w-full max-w-6xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
                >
                  {/* Modal Header */}
                  <div className="flex justify-between items-center p-5 border-b border-zinc-800 bg-zinc-900/60">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          {selectedCandidate.candidateName}
                        </h2>
                        <span className="text-zinc-400 text-xs font-mono">({selectedCandidate.candidateEmail || 'No Email'})</span>
                        {isFlagged ? (
                          <span className="text-[11px] font-medium border border-amber-500/20 px-2.5 py-0.5 rounded-full text-amber-300 bg-amber-500/10 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-400" /> Review Notes Available
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Standard Session
                          </span>
                        )}
                        {selectedCandidate.invitation?.jobDescription?.title ? (
                          <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full font-medium">
                            Role: {selectedCandidate.invitation.jobDescription.title}
                          </span>
                        ) : (
                          <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-medium">
                            Role: Demo Technical Assessment (10 CS Questions)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono">
                        <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300">
                          Score: <strong className="text-teal-400">{selectedCandidate.totalScore?.toFixed(1) || 0} / 60</strong>
                        </span>
                        <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400">
                          Status: <strong className="text-white uppercase">{selectedCandidate.applicationStatus}</strong>
                        </span>
                        <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400">
                          Decision: <strong className={selectedCandidate.overallRecommendation === 'PASS' ? 'text-emerald-400' : selectedCandidate.overallRecommendation === 'FLAGGED' ? 'text-amber-400' : 'text-rose-400'}>
                            {selectedCandidate.overallRecommendation === 'FLAGGED' ? 'REVIEW_NOTES' : (selectedCandidate.overallRecommendation || evalData.overallRecommendation || 'IN_REVIEW')}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/evaluation?sessionId=${selectedCandidate.id}&isDemo=${selectedCandidate.questionBlueprint?.isDemo ? 'true' : 'false'}`)}
                        className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs h-9 px-3 flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Full Report
                      </Button>
                      <Button 
                        disabled={actionLoadingId === selectedCandidate.id || selectedCandidate.applicationStatus !== 'PENDING'}
                        onClick={() => handleStatusUpdate(selectedCandidate.id, "ACCEPTED")}
                        className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold text-xs h-9 px-3.5"
                      >
                        {actionLoadingId === selectedCandidate.id ? "Processing..." : <><Check className="w-4 h-4 mr-1" /> Select Candidate</>}
                      </Button>
                      <Button 
                        variant="outline"
                        disabled={actionLoadingId === selectedCandidate.id || selectedCandidate.applicationStatus !== 'PENDING'}
                        onClick={() => handleStatusUpdate(selectedCandidate.id, "REJECTED")}
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-9 px-3.5"
                      >
                        <X className="w-4 h-4 mr-1" /> Reject Candidate
                      </Button>
                      <button 
                        onClick={() => setSelectedCandidate(null)} 
                        className="p-1.5 ml-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Body: Two Columns */}
                  <div className="flex flex-1 overflow-hidden">
                    
                    {/* Column 1: AI Summary & Live Interview Monitoring Telemetry */}
                    <div className="w-1/2 p-6 border-r border-zinc-800/80 flex flex-col bg-zinc-950 overflow-y-auto space-y-6">
                      
                      {allVisualSnapshotsCount > 0 ? (
                        <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(20,184,166,0.1)]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                              <Camera className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white">Photographic Evidence Available</div>
                              <div className="text-[11px] text-teal-300/80 font-mono">{allVisualSnapshotsCount} snapshot(s) recorded in proctoring dossier</div>
                            </div>
                          </div>
                          <button
                            onClick={() => openViolationSnapshots('All Visual Evidence', ['ALL'])}
                            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Camera className="w-3.5 h-3.5" /> View Photo Evidence
                          </button>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Camera className="w-4 h-4 text-zinc-600 shrink-0" />
                            <span>No camera snapshots recorded for <strong>{selectedCandidate.candidateName}</strong></span>
                          </div>
                          {candidates.some(c => (c.detectionEvents || []).some((e: any) => {
                            const m = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
                            return Boolean(m.snapshotUrl || m.snapshot);
                          })) && (
                            <button
                              onClick={() => {
                                const withEvidence = candidates.find(c => (c.detectionEvents || []).some((e: any) => {
                                  const m = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
                                  return Boolean(m.snapshotUrl || m.snapshot);
                                }));
                                if (withEvidence) setSelectedCandidate(withEvidence);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] underline flex items-center gap-1 cursor-pointer"
                            >
                              Switch to {candidates.find(c => (c.detectionEvents || []).some((e: any) => {
                                const m = typeof e.metadata === 'string' ? (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })() : (e.metadata || {});
                                return Boolean(m.snapshotUrl || m.snapshot);
                              }))?.candidateName} (42 Photo Captures)
                            </button>
                          )}
                        </div>
                      )}

                      {/* Section 1: AI Executive Summary & Assessment */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-violet-400" />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                            AI Executive Summary & Assessment
                          </h3>
                        </div>

                        <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 space-y-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Evaluation Verdict</span>
                            <p className="text-zinc-200 leading-relaxed mt-1 text-xs">
                              {selectedCandidate.feedback || 
                               evalData.summary || 
                               evalData.overallFeedback || 
                               "AI evaluation completed based on candidate responses, code assessments, and proctoring telemetry."}
                            </p>
                          </div>

                          {evalData.keyHighlights && evalData.keyHighlights.length > 0 && (
                            <div className="pt-2 border-t border-white/5 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Key Highlights</span>
                              <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                                {evalData.keyHighlights.map((hl: string, i: number) => (
                                  <li key={i}>{hl}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {evalData.riskFlags && evalData.riskFlags.length > 0 && evalData.riskFlags[0] !== "none" && (
                            <div className="pt-2 border-t border-white/5 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Risk Flags Detected</span>
                              <div className="flex flex-wrap gap-1.5">
                                {evalData.riskFlags.map((flag: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded text-[11px] font-mono">
                                    ⚠️ {flag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {evalData.githubVerificationSummary && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">GitHub Verification</span>
                                <span className={evalData.githubVerificationSummary.verified ? "text-emerald-400 text-[10px] font-bold" : "text-amber-400 text-[10px] font-bold"}>
                                  {evalData.githubVerificationSummary.verified ? "✓ Code Verified" : "⚠️ Code Discrepancy"}
                                </span>
                              </div>
                              <p className="text-zinc-300 text-xs">
                                {evalData.githubVerificationSummary.details}
                              </p>
                            </div>
                          )}

                          {selectedCandidate.invitation?.applicantResume && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                Resume: {selectedCandidate.invitation.applicantResume.fileName}
                              </span>
                              {selectedCandidate.invitation.applicantResume.aiSummary && (
                                <p className="text-zinc-400 text-xs line-clamp-2">
                                  {selectedCandidate.invitation.applicantResume.aiSummary}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 2: Live Interview Monitoring & Integrity Telemetry */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-teal-400" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                              Live Interview Monitoring & Telemetry
                            </h3>
                          </div>
                          {allVisualSnapshotsCount > 0 ? (
                            <button
                              onClick={() => openViolationSnapshots('All Visual Evidence', ['ALL'])}
                              className="text-xs px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono flex items-center gap-1.5 hover:bg-teal-500/20 transition-all shadow-sm cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-teal-400" /> View All Photo Evidence ({allVisualSnapshotsCount})
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                              <Camera className="w-3 h-3 text-zinc-600" /> No camera snapshots captured
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          
                          {/* 1. Camera Absence (ABSENT_USER) */}
                          <div 
                            onClick={() => {
                              if (hasSnapshotsFor(['FACE_MISSING', 'ABSENT_USER', 'FACE_ABSENCE'])) {
                                openViolationSnapshots('Camera Departure', ['FACE_MISSING', 'ABSENT_USER', 'FACE_ABSENCE']);
                              } else if (allVisualSnapshotsCount > 0) {
                                openViolationSnapshots('Camera Departure', ['FACE_MISSING', 'ABSENT_USER', 'FACE_ABSENCE']);
                              } else {
                                toast.info('Absence logged via face telemetry. No camera snapshot stored for this event.');
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all ${absentCount > 0 ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400/50 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-900/60 border-white/5'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <VideoOff className={`w-3.5 h-3.5 ${absentCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} /> Camera Departure
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase font-mono ${absentCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {absentCount > 0 ? 'OBSERVED' : 'NORMAL'}
                              </span>
                            </div>
                            <div className="mt-2 flex justify-between items-end">
                              <div>
                                <div className="text-lg font-bold font-mono text-white">{absentCount} event(s)</div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {absentCount > 0 ? "Brief camera departure recorded" : "Continuous presence verified"}
                                </p>
                              </div>
                              {hasSnapshotsFor(['FACE_MISSING', 'ABSENT_USER', 'FACE_ABSENCE']) ? (
                                <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors">
                                  <Camera className="w-3 h-3" /> View Photo Evidence
                                </span>
                              ) : absentCount > 0 ? (
                                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/40">
                                  <Clock className="w-3 h-3 text-zinc-500" /> Telemetry Only
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* 2. Unauthorized Devices (YOLO26) */}
                          <div 
                            onClick={() => {
                              if (hasSnapshotsFor(['UNAUTHORIZED_DEVICE', 'MOBILE_PHONE', 'cell phone', 'phone', 'tablet'])) {
                                openViolationSnapshots('Unauthorized Mobile Devices (YOLO26)', ['UNAUTHORIZED_DEVICE', 'MOBILE_PHONE', 'cell phone', 'phone', 'tablet']);
                              } else if (allVisualSnapshotsCount > 0) {
                                openViolationSnapshots('Unauthorized Mobile Devices (YOLO26)', ['UNAUTHORIZED_DEVICE', 'MOBILE_PHONE', 'cell phone', 'phone', 'tablet']);
                              } else {
                                toast.info('Device presence logged via YOLO26. No camera snapshot stored for this event.');
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all ${mobileCount > 0 ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400/50 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-900/60 border-white/5'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <Smartphone className={`w-3.5 h-3.5 ${mobileCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} /> Mobile Devices
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase font-mono ${mobileCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {mobileCount > 0 ? 'NOTED' : 'CLEAN'}
                              </span>
                            </div>
                            <div className="mt-2 flex justify-between items-end">
                              <div>
                                <div className="text-lg font-bold font-mono text-white">{mobileCount} device(s)</div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {mobileCount > 0 ? "Handheld device noted in camera frame" : "Zero unauthorized devices in frame"}
                                </p>
                              </div>
                              {hasSnapshotsFor(['UNAUTHORIZED_DEVICE', 'MOBILE_PHONE', 'cell phone', 'phone', 'tablet']) ? (
                                <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors">
                                  <Camera className="w-3 h-3" /> View Photo Evidence
                                </span>
                              ) : mobileCount > 0 ? (
                                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/40">
                                  <Smartphone className="w-3 h-3 text-zinc-500" /> Telemetry Only
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* 3. Visual Focus (MediaPipe 3D) */}
                          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <Eye className="w-3.5 h-3.5 text-cyan-400" /> Visual Focus
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-cyan-500/10 text-cyan-400">
                                {visualFocus >= 80 ? 'OPTIMAL' : visualFocus >= 60 ? 'MODERATE' : 'LOW'}
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="text-lg font-bold font-mono text-cyan-300">{visualFocus}% focus</div>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                {awayPercentage.toFixed(0)}% away time ({eyeData.awayCount || 0} episodes)
                              </p>
                            </div>
                          </div>

                          {/* 4. Response Latency (Hesitation) */}
                          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <Timer className="w-3.5 h-3.5 text-amber-400" /> Response Delay
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-amber-500/10 text-amber-400">
                                POST-TTS
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="text-lg font-bold font-mono text-amber-300">{avgHesitation.toFixed(1)}s avg</div>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                {avgHesitation < 2 ? "Instinctive reply (<2s)" : avgHesitation <= 5 ? "Thoughtful hesitation (2-5s)" : "Extended hesitation (>5s)"}
                              </p>
                            </div>
                          </div>

                          {/* 5. Answer Integrity Guard (Prompt Injection) */}
                          <div 
                            onClick={() => {
                              toast.info("Answer Integrity Guard monitors conversational transcripts for prompt injections and score overrides. No webcam camera snapshots are generated for NLP guards.");
                            }}
                            className={`p-3.5 rounded-xl border transition-all ${injectionAttempts > 0 ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400/50 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-900/60 border-white/5'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <ShieldCheck className={`w-3.5 h-3.5 ${injectionAttempts > 0 ? 'text-amber-400' : 'text-teal-400'}`} /> Answer Integrity Guard
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase font-mono ${injectionAttempts > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-teal-500/10 text-teal-400'}`}>
                                {injectionAttempts > 0 ? 'BLOCKED' : 'SAFE'}
                              </span>
                            </div>
                            <div className="mt-2 flex justify-between items-end">
                              <div>
                                <div className="text-lg font-bold font-mono text-white">{injectionAttempts} attempt(s)</div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {injectionAttempts > 0 ? "Prompt injection / score manipulation intercepted" : "Zero manipulation attempts in speech/text"}
                                </p>
                              </div>
                              <span className="text-[10px] text-teal-300 font-mono flex items-center gap-1 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                                <ShieldCheck className="w-3 h-3 text-teal-400" /> Text NLP Guard
                              </span>
                            </div>
                          </div>

                          {/* 6. Concealed Phone / Downward Dwell */}
                          <div 
                            onClick={() => {
                              if (hasSnapshotsFor(['CONCEALED_PHONE_GAZE', 'OFF_SCREEN_READING', 'SUSPICIOUS_CORNER_GLANCES'])) {
                                openViolationSnapshots('Downward Lap/Desk Gaze Dwell', ['CONCEALED_PHONE_GAZE', 'OFF_SCREEN_READING', 'SUSPICIOUS_CORNER_GLANCES']);
                              } else if (allVisualSnapshotsCount > 0) {
                                openViolationSnapshots('Downward Lap/Desk Gaze Dwell', ['CONCEALED_PHONE_GAZE', 'OFF_SCREEN_READING', 'SUSPICIOUS_CORNER_GLANCES']);
                              } else {
                                toast.info('Gaze dwell logged via landmark telemetry. No camera snapshot stored for this event.');
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all ${concealedCount > 0 ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400/50 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-900/60 border-white/5'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <Eye className={`w-3.5 h-3.5 ${concealedCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`} /> Downward Gaze
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase font-mono ${concealedCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                                {concealedCount > 0 ? 'NOTED' : 'NORMAL'}
                              </span>
                            </div>
                            <div className="mt-2 flex justify-between items-end">
                              <div>
                                <div className="text-lg font-bold font-mono text-white">{concealedCount} dwell(s)</div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {concealedCount > 0 ? "Prolonged downward desk/lap gaze" : "Natural eye movement posture"}
                                </p>
                              </div>
                              {hasSnapshotsFor(['CONCEALED_PHONE_GAZE', 'OFF_SCREEN_READING', 'SUSPICIOUS_CORNER_GLANCES']) ? (
                                <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors">
                                  <Camera className="w-3 h-3" /> View Photo Evidence
                                </span>
                              ) : concealedCount > 0 ? (
                                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/40">
                                  <Eye className="w-3 h-3 text-zinc-500" /> Telemetry Only
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* 7. Browser Visibility / Tab Switches */}
                          <div 
                            onClick={() => {
                              if (hasSnapshotsFor(['BROWSER_TAB_HIDDEN', 'BROWSER_WINDOW_BLUR', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'SUSPICIOUS_OBJECT'])) {
                                openViolationSnapshots('Browser Tab Switches', ['BROWSER_TAB_HIDDEN', 'BROWSER_WINDOW_BLUR', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'SUSPICIOUS_OBJECT']);
                              } else if (allVisualSnapshotsCount > 0) {
                                openViolationSnapshots('Browser Tab Switches', ['BROWSER_TAB_HIDDEN', 'BROWSER_WINDOW_BLUR', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'SUSPICIOUS_OBJECT']);
                              } else {
                                toast.info('Browser visibility logged via DOM events. No camera snapshot stored for this event.');
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all ${tabHiddenCount > 0 ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400/50 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-900/60 border-white/5'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <Monitor className={`w-3.5 h-3.5 ${tabHiddenCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`} /> Tab Switches
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase font-mono ${tabHiddenCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                                {tabHiddenCount > 0 ? 'NOTED' : 'CLEAN'}
                              </span>
                            </div>
                            <div className="mt-2 flex justify-between items-end">
                              <div>
                                <div className="text-lg font-bold font-mono text-white">{tabHiddenCount} time(s)</div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {tabHiddenCount > 0 ? "Browser tab hidden or window blurred" : "Continuous fullscreen browser focus"}
                                </p>
                              </div>
                              {hasSnapshotsFor(['BROWSER_TAB_HIDDEN', 'BROWSER_WINDOW_BLUR', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'SUSPICIOUS_OBJECT']) ? (
                                <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors">
                                  <Camera className="w-3 h-3" /> View Photo Evidence
                                </span>
                              ) : tabHiddenCount > 0 ? (
                                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/40">
                                  <Monitor className="w-3 h-3 text-zinc-500" /> Telemetry Only
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* 8. Code Paste Bursts */}
                          <div 
                            onClick={() => {
                              if (hasSnapshotsFor(['CODE_PASTE_BURST', 'UNNATURAL_KEYSTROKE_CADENCE'])) {
                                openViolationSnapshots('Code Paste Bursts', ['CODE_PASTE_BURST', 'UNNATURAL_KEYSTROKE_CADENCE']);
                              } else if (allVisualSnapshotsCount > 0) {
                                openViolationSnapshots('Code Paste Bursts', ['CODE_PASTE_BURST', 'UNNATURAL_KEYSTROKE_CADENCE']);
                              } else {
                                toast.info('Code paste burst logged via keystroke cadence telemetry. No camera snapshot stored for this event.');
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all ${pasteBurstCount > 0 ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400/50 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-900/60 border-white/5'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
                                <FileText className={`w-3.5 h-3.5 ${pasteBurstCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`} /> Paste Bursts
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase font-mono ${pasteBurstCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                                {pasteBurstCount > 0 ? 'NOTED' : 'NORMAL'}
                              </span>
                            </div>
                            <div className="mt-2 flex justify-between items-end">
                              <div>
                                <div className="text-lg font-bold font-mono text-white">{pasteBurstCount} burst(s)</div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {pasteBurstCount > 0 ? "Code paste burst (>40 chars in <200ms)" : "Natural interactive code input"}
                                </p>
                              </div>
                              {hasSnapshotsFor(['CODE_PASTE_BURST', 'UNNATURAL_KEYSTROKE_CADENCE']) ? (
                                <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors">
                                  <Camera className="w-3 h-3" /> View Photo Evidence
                                </span>
                              ) : pasteBurstCount > 0 ? (
                                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/40">
                                  <FileText className="w-3 h-3 text-zinc-500" /> Telemetry Only
                                </span>
                              ) : null}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>

                    {/* Column 2: Verbatim Interview Q&A Transcript */}
                    <div className="w-1/2 flex flex-col bg-black">
                      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex justify-between items-center">
                        <h3 className="text-zinc-200 font-medium text-xs flex items-center gap-2 uppercase tracking-wider">
                          <MessageSquare className="w-4 h-4 text-cyan-400" /> Full Interview Q&A Transcript ({selectedCandidate.messages?.length || 0} turns)
                        </h3>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Chronological Record
                        </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {(!selectedCandidate.messages || selectedCandidate.messages.length === 0) ? (
                          <div className="text-center text-zinc-500 py-16 text-xs">No transcript recorded for this session.</div>
                        ) : (
                          selectedCandidate.messages.map((msg: any, i: number) => {
                            const isUser = msg.role === 'user';
                            return (
                              <div key={i} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] rounded-2xl p-4 shadow-lg border ${
                                  isUser 
                                    ? 'bg-zinc-900/90 text-zinc-200 rounded-tr-sm border-zinc-700/50' 
                                    : 'bg-gradient-to-tr from-violet-950/40 to-cyan-950/40 text-cyan-50 rounded-tl-sm border-cyan-500/20'
                                }`}>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isUser ? 'text-violet-400' : 'text-cyan-400'}`}>
                                      {isUser ? (selectedCandidate.candidateName || 'Candidate') : 'Lumina AI Interviewer'}
                                    </p>
                                    {msg.createdAt && (
                                      <span className="text-[10px] text-zinc-500 font-mono">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                                  {/* Micro-scores if present on user answer */}
                                  {isUser && (msg.clarity !== undefined || msg.fluency !== undefined || msg.simplicity !== undefined) && (
                                    <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-wrap gap-2 text-[10px] font-mono text-zinc-400">
                                      {msg.clarity !== undefined && <span>Clarity: <strong className="text-cyan-400">{msg.clarity}/10</strong></span>}
                                      {msg.simplicity !== undefined && <span>Simplicity: <strong className="text-emerald-400">{msg.simplicity}/10</strong></span>}
                                      {msg.fluency !== undefined && <span>Fluency: <strong className="text-amber-400">{msg.fluency}/10</strong></span>}
                                      {msg.warmth !== undefined && <span>Warmth: <strong className="text-violet-400">{msg.warmth}/10</strong></span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

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
    </div>
  );
}
