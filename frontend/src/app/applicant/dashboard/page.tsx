"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, Upload, Sparkles, CheckCircle2, Clock, 
  ArrowLeft, Mic, Play, ShieldAlert, Award, FileCheck, ArrowRight, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  getApplicantInvitationsAPI, uploadResumeAPI, 
  startInvitedInterviewAPI, startInterviewAPI 
} from "@/services/api";
import { useInterviewStore } from "@/lib/store";
import { useAuthStore } from "@/lib/authStore";
import { UserMenu } from "@/components/UserMenu";

export default function ApplicantDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, isInitialized } = useAuthStore();
  const { setSessionId, setCandidateName, addMessage } = useInterviewStore();

  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Resume Upload State
  const [uploadingResumeForInvId, setUploadingResumeForInvId] = useState<string | null>(null);
  const [startingInterviewForInvId, setStartingInterviewForInvId] = useState<string | null>(null);

  const loadApplicantData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Fetch Received Invitations
      const fetchedInvites = await getApplicantInvitationsAPI(user.id);
      setInvitations(fetchedInvites || []);
    } catch (err: any) {
      console.error("Failed to load applicant dashboard data:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      if (!user) {
        router.push("/applicant/sign-in");
      } else if (user.role === "RECRUITER") {
        router.push("/recruiter");
      }
    }
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (isInitialized && user && user.role !== "RECRUITER") {
      loadApplicantData();
    }
  }, [user, isInitialized]);


  const handleResumeUpload = async (invitationToken: string, invitationId: string, file: File) => {
    if (!user || !file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file (.pdf)");
      return;
    }

    setUploadingResumeForInvId(invitationId);
    try {
      await uploadResumeAPI(file, user.id, invitationToken);
      toast.success("Resume uploaded & analyzed by AI!", {
        description: "Your resume summary has been stored and linked to your interview."
      });
      loadApplicantData();
    } catch (err: any) {
      console.error("Failed to upload resume:", err);
      toast.error("Resume upload failed", { description: err?.response?.data?.message || err.message });
    } finally {
      setUploadingResumeForInvId(null);
    }
  };

  const handleStartInterview = async (invitation: any) => {
    if (!user) return;

    const email = user.email || invitation.applicantEmail;
    const name = user.name || (email ? email.split("@")[0] : "Applicant");

    setStartingInterviewForInvId(invitation.id);
    try {
      setCandidateName(name);

      // Start custom interview linked to invitation (JD + Resume AI system prompt)
      const data = await startInvitedInterviewAPI(invitation.id, name, email);

      setSessionId(data.sessionId);
      if (data.question) {
        addMessage({
          id: Math.random().toString(),
          role: "assistant",
          content: data.question
        });
      }

      toast.success("Interview session initialized!");
      router.push("/interview");
    } catch (err: any) {
      console.error("Failed to start interview:", err);
      toast.error("Failed to start interview", { description: err?.response?.data?.message || err.message });
    } finally {
      setStartingInterviewForInvId(null);
    }
  };

  if (!isInitialized || authLoading || !user) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Applicant Portal</h1>
            <p className="text-xs text-zinc-400">Welcome, <strong className="text-teal-300">{user.name || user.email.split("@")[0]}</strong></p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push("/")} className="border-white/10 text-zinc-300 hover:bg-white/5 text-xs h-10">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Home
            </Button>
            <UserMenu />
          </div>
        </div>


        {isLoading ? (
          <div className="text-center py-20 text-teal-400 font-mono text-sm uppercase tracking-widest animate-pulse">
            Loading assigned interviews & profile...
          </div>
        ) : (
          <div className="space-y-6">

            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-400" /> Assigned Interviews ({invitations.length})
              </h2>
              <Button variant="ghost" onClick={loadApplicantData} size="sm" className="text-xs text-zinc-400 hover:text-white">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </div>

            {invitations.length === 0 ? (
              <Card className="border border-white/5 bg-zinc-950/40 p-10 text-center rounded-2xl space-y-3">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto" />
                <h3 className="text-white font-medium text-base">No Assigned Interviews Found</h3>
                <p className="text-zinc-400 text-xs max-w-md mx-auto">
                  When a recruiter shortlists you for a position, your assigned interview link will appear here automatically.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {invitations.map((inv) => (
                  <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border border-white/10 bg-zinc-950 p-6 rounded-2xl space-y-5 shadow-xl hover:border-teal-500/30 transition-all">

                      {/* Header Info */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-800 pb-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-teal-400">Position Shortlist</span>
                          <h3 className="text-xl font-bold text-white mt-0.5">{inv.jobDescription?.title}</h3>
                          <p className="text-xs text-zinc-400 mt-1">Invited by: {inv.recruiter?.name || inv.recruiter?.email}</p>
                        </div>

                        {/* Invitation Status */}
                        <div>
                          {inv.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                          ) : inv.status === 'IN_PROGRESS' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
                              <RefreshCw className="w-3.5 h-3.5" /> In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5" /> Shortlisted & Ready
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Job Description Executive Summary */}
                      {inv.jobDescription?.aiSummary && (
                        <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-teal-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Job Description Summary
                          </span>
                          <p className="text-xs text-zinc-300 leading-relaxed">{inv.jobDescription.aiSummary}</p>
                        </div>
                      )}

                      {/* STEP 1: Candidate Resume Upload Section */}
                      <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-teal-400" /> Step 1: Candidate Resume PDF
                          </span>
                          {inv.applicantResume ? (
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Resume Uploaded & Analyzed
                            </span>
                          ) : (
                            <span className="text-[10px] text-yellow-400 font-semibold">Required before interview</span>
                          )}
                        </div>

                        {inv.applicantResume ? (
                          <div className="bg-zinc-950 p-3 rounded-lg border border-white/5 space-y-1.5 text-xs text-zinc-300">
                            <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                              <span>File: <strong className="text-white">{inv.applicantResume.fileName}</strong></span>
                              <span>Uploaded: {new Date(inv.applicantResume.createdAt).toLocaleDateString()}</span>
                            </div>
                            {inv.applicantResume.aiSummary && (
                              <p className="text-zinc-300 text-xs leading-relaxed italic border-t border-zinc-900 pt-1.5 mt-1">
                                "{inv.applicantResume.aiSummary}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <label className="w-full cursor-pointer flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-dashed border-teal-500/40 text-teal-300 px-4 py-3 rounded-xl text-xs transition-all">
                              <Upload className="w-4 h-4" />
                              <span>{uploadingResumeForInvId === inv.id ? "Analyzing Resume PDF..." : "Upload Resume PDF (.pdf)"}</span>
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                disabled={uploadingResumeForInvId === inv.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleResumeUpload(inv.token, inv.id, file);
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      {/* STEP 2: Launch AI Interview */}
                      <div className="pt-1">
                        <Button
                          disabled={!inv.applicantResume || inv.status === 'COMPLETED' || startingInterviewForInvId === inv.id}
                          onClick={() => handleStartInterview(inv)}
                          className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold h-12 rounded-xl text-sm transition-all shadow-[0_0_25px_rgba(13,148,136,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {startingInterviewForInvId === inv.id ? (
                            <span>Building Custom AI Interview...</span>
                          ) : inv.status === 'COMPLETED' ? (
                            <span>Interview Completed</span>
                          ) : !inv.applicantResume ? (
                            <span>Upload Resume Above to Unlock Interview</span>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" />
                              <span>Launch AI Voice Interview Now</span>
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>

                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
