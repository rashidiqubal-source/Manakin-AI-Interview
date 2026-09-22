"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, Plus, Send, FileText, Sparkles, CheckCircle2, 
  Clock, ArrowLeft, User, Mail, ShieldAlert, Award, ChevronRight, RefreshCw, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { uploadJDAPI, getRecruiterJDsAPI, sendInvitationAPI, getRecruiterInvitationsAPI } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";
import { UserMenu } from "@/components/UserMenu";

export default function RecruiterDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, isInitialized } = useAuthStore();

  const [jds, setJds] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload JD Form State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [jdTitle, setJdTitle] = useState("");
  const [jdContent, setJdContent] = useState("");
  const [isUploadingJD, setIsUploadingJD] = useState(false);

  // Invite Applicant Modal State
  const [selectedJd, setSelectedJd] = useState<any>(null);
  const [applicantEmail, setApplicantEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Initial Auth & Data Load
  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/recruiter/sign-in");
    }
  }, [isInitialized, user, router]);

  const loadRecruiterData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Fetch JDs & Invitations
      const [fetchedJds, fetchedInvites] = await Promise.all([
        getRecruiterJDsAPI(user.id),
        getRecruiterInvitationsAPI(user.id)
      ]);

      setJds(fetchedJds || []);
      setInvitations(fetchedInvites || []);
    } catch (err: any) {
      console.error("Failed to load recruiter dashboard data:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized && user) {
      loadRecruiterData();
    }
  }, [user, isInitialized]);

  const handleUploadJD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdTitle.trim() || !jdContent.trim() || !user) {
      toast.error("Please provide both Job Title and Job Description text.");
      return;
    }

    setIsUploadingJD(true);
    try {
      await uploadJDAPI(jdTitle, jdContent, user.id);
      toast.success("Job Description uploaded & analyzed by AI!");
      setShowUploadModal(false);
      setJdTitle("");
      setJdContent("");
      loadRecruiterData();
    } catch (err: any) {
      console.error("Failed to upload JD:", err);
      toast.error("Failed to upload JD", { description: err?.response?.data?.message || err.message });
    } finally {
      setIsUploadingJD(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJd || !applicantEmail.trim() || !user) {
      toast.error("Please enter a valid applicant email address.");
      return;
    }

    setIsSendingInvite(true);
    try {
      await sendInvitationAPI(selectedJd.id, applicantEmail.trim(), user.id);
      toast.success(`Invitation email sent to ${applicantEmail}!`, {
        description: "The applicant will receive a unique link to take their AI interview."
      });
      setSelectedJd(null);
      setApplicantEmail("");
      loadRecruiterData();
    } catch (err: any) {
      console.error("Failed to send invite:", err);
      toast.error("Failed to send invitation", { description: err?.response?.data?.message || err.message });
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (!isInitialized || authLoading || !user) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }


  return (
    <div className="min-h-screen bg-black text-white py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
              <Building2 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Recruiter Portal</h1>
              <p className="text-xs text-zinc-400">Upload JDs, analyze requirements, & invite candidates</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/admin")}
              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-xs h-10 font-semibold"
            >
              <Award className="w-4 h-4 mr-1.5 text-yellow-400" /> Candidate Analytics
            </Button>
            <Button
              onClick={() => router.push("/recruiter/create-jd")}
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)]"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Job Opening
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowUploadModal(true)}
              className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs h-10"
            >
              Quick Paste JD
            </Button>
            <UserMenu />
          </div>


        </div>

        {isLoading ? (
          <div className="text-center py-20 text-violet-400 font-mono text-sm uppercase tracking-widest animate-pulse">
            Fetching recruiter workspace records...
          </div>
        ) : (
          <div className="space-y-10">

            {/* Section 1: Active Job Descriptions */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-violet-400" /> Active Job Descriptions ({jds.length})
                </h2>
                <Button variant="ghost" onClick={loadRecruiterData} size="sm" className="text-xs text-zinc-400 hover:text-white">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>

              {jds.length === 0 ? (
                <Card className="border-dashed border-white/10 bg-zinc-950/40 p-8 text-center rounded-2xl">
                  <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                  <h3 className="text-zinc-300 font-medium text-sm">No Job Descriptions Uploaded Yet</h3>
                  <p className="text-zinc-500 text-xs mt-1 mb-4">Upload a Job Description to let AI summarize competencies and generate tailored interviews.</p>
                  <Button onClick={() => setShowUploadModal(true)} className="bg-violet-600 hover:bg-violet-500 text-xs">
                    Upload Your First JD
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jds.map((jd) => (
                    <motion.div key={jd.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="border border-white/5 bg-zinc-950 hover:border-violet-500/30 p-5 rounded-2xl space-y-4 shadow-lg transition-all group">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">{jd.title}</h3>
                            <span className="text-[10px] font-mono text-zinc-500">Created: {new Date(jd.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-semibold">
                            {jd.invitations?.length || 0} Invites Sent
                          </span>
                        </div>

                        {jd.aiSummary && (
                          <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5 space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> AI Summary
                            </span>
                            <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">{jd.aiSummary}</p>
                          </div>
                        )}

                        {jd.aiAnalysis?.keySkills && (
                          <div className="flex flex-wrap gap-1.5">
                            {jd.aiAnalysis.keySkills.slice(0, 4).map((skill: string, i: number) => (
                              <span key={i} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        <Button
                          onClick={() => setSelectedJd(jd)}
                          className="w-full bg-violet-600/20 hover:bg-violet-600 border border-violet-500/30 hover:border-violet-600 text-violet-300 hover:text-white text-xs font-semibold h-9 rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" /> Invite Applicant for this JD
                        </Button>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Sent Invitations & Live Evaluation Results */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-teal-400" /> Sent Candidate Invitations ({invitations.length})
              </h2>

              {invitations.length === 0 ? (
                <Card className="border border-white/5 bg-zinc-950/40 p-8 text-center rounded-2xl text-zinc-500 text-xs">
                  No invitations sent yet. Click "Invite Applicant" on any Job Description card above.
                </Card>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <Card key={inv.id} className="border border-white/5 bg-zinc-950 p-5 rounded-2xl space-y-3 shadow-md hover:border-white/10">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-base">{inv.applicantEmail}</span>
                            {inv.applicant?.name && <span className="text-xs text-zinc-400">({inv.applicant.name})</span>}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">Role: <strong className="text-violet-300">{inv.jobDescription?.title}</strong></p>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {inv.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5" /> Invitation Sent
                            </span>
                          )}
                          {inv.status === 'ACCEPTED' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-semibold">
                              <User className="w-3.5 h-3.5" /> Accepted / Resume Uploaded
                            </span>
                          )}
                          {inv.status === 'IN_PROGRESS' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-400/10 border border-violet-400/20 text-violet-400 text-xs font-semibold animate-pulse">
                              <RefreshCw className="w-3.5 h-3.5" /> Interview In Progress
                            </span>
                          )}
                          {inv.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Interview Completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Resume Summary if available */}
                      {inv.applicantResume && (
                        <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Candidate Resume Summary ({inv.applicantResume.fileName})
                          </span>
                          <p className="text-xs text-zinc-300 leading-relaxed">{inv.applicantResume.aiSummary}</p>
                        </div>
                      )}

                      {/* Interview Evaluation Results if completed */}
                      {inv.interviewSession && (
                        <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-emerald-500/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <Award className="w-4 h-4" /> AI Assessment Results
                            </span>
                            <span className="text-xs font-mono font-bold text-white bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-md">
                              Recommendation: {inv.interviewSession.overallRecommendation}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-400 flex items-center gap-4">
                            <span>Score: <strong className="text-white">{inv.interviewSession.totalScore?.toFixed(1)} / 60</strong></span>
                            <span>Proctor Violations: <strong className="text-rose-400">{inv.interviewSession.evaluationData?.proctoringSummary?.misconductScore || 0}</strong></span>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* MODAL 1: Upload Job Description */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-xl">
              <Card className="border border-white/10 bg-zinc-950 p-6 rounded-2xl space-y-5 shadow-2xl">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-400" /> Upload Job Description
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowUploadModal(false)} className="text-zinc-400 text-xs">✕</Button>
                </div>

                <form onSubmit={handleUploadJD} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Job Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Frontend Developer / Math Tutor"
                      value={jdTitle}
                      onChange={(e) => setJdTitle(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Job Description Content</label>
                    <textarea
                      rows={8}
                      placeholder="Paste the full job description text here..."
                      value={jdContent}
                      onChange={(e) => setJdContent(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed font-sans"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)} className="border-zinc-800 text-zinc-400 text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isUploadingJD} className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-5">
                      {isUploadingJD ? "Analyzing with AI..." : "Analyze & Save JD"}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Invite Applicant */}
      <AnimatePresence>
        {selectedJd && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md">
              <Card className="border border-white/10 bg-zinc-950 p-6 rounded-2xl space-y-5 shadow-2xl">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-violet-400" /> Invite Candidate
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedJd(null)} className="text-zinc-400 text-xs">✕</Button>
                </div>

                <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-violet-400">Job Position</span>
                  <p className="text-sm font-semibold text-white">{selectedJd.title}</p>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Applicant Email Address</label>
                    <input
                      type="email"
                      placeholder="candidate@example.com"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="text-[11px] text-zinc-400 bg-violet-500/10 p-3 rounded-xl border border-violet-500/20">
                    The candidate will receive an email stating:
                    <strong className="block text-violet-300 mt-1">"Congratulations! You have been shortlisted for the next round."</strong>
                    with a unique interview link.
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setSelectedJd(null)} className="border-zinc-800 text-zinc-400 text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSendingInvite} className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-5">
                      {isSendingInvite ? "Sending Email..." : "Send Invitation Email"}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
