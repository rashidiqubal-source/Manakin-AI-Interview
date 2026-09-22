"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, CheckCircle2, FileText, UserCheck, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getInvitationByTokenAPI, claimInvitationAPI } from "@/services/api";
import { useInterviewStore } from "@/lib/store";
import { useAuthStore } from "@/lib/authStore";

export default function InviteLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const { user, isInitialized } = useAuthStore();
  const { setInvitationToken } = useInterviewStore();

  const [invitation, setInvitation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      setInvitationToken(token);
    }
  }, [token, setInvitationToken]);

  // Load invitation details
  useEffect(() => {
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

    fetchInvitation();
  }, [token]);

  // Auto-claim when user is signed in
  useEffect(() => {
    const claim = async () => {
      if (isInitialized && user && token && invitation && !isClaiming) {
        setIsClaiming(true);
        try {
          // Claim invitation
          await claimInvitationAPI(token, user.id);

          toast.success("Invitation claimed! Redirecting to your dashboard...");
          router.push("/applicant/dashboard");
        } catch (err: any) {
          console.error("Failed to claim invitation:", err);
          toast.error("Failed to claim invitation", {
            description: err?.response?.data?.message || err.message
          });
        } finally {
          setIsClaiming(false);
        }
      }
    };

    claim();
  }, [isInitialized, user, token, invitation, router, isClaiming]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400 font-mono tracking-widest text-sm uppercase animate-pulse">
        Resolving secure interview invitation...
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-500/20 bg-zinc-950 p-8 text-center rounded-2xl shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Invalid Invitation Link</h2>
          <p className="text-zinc-400 text-sm mb-6">{error || "This interview invitation link is invalid or expired."}</p>
          <Button onClick={() => router.push("/")} className="bg-zinc-800 hover:bg-zinc-700 text-white w-full">
            Return to Home Page
          </Button>
        </Card>
      </div>
    );
  }

  const job = invitation.jobDescription;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Aurora glow blobs */}
      <div className="absolute top-0 opacity-25 transform translate-x-1/4 -translate-y-1/4 w-[600px] h-[600px] bg-teal-600 rounded-full blur-[140px]" />
      <div className="absolute bottom-0 opacity-25 transform -translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-cyan-600 rounded-full blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-xl z-10"
      >
        <Card className="border border-white/10 bg-black/60 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl space-y-6">
          
          {/* Header Announcement Badge */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Shortlisted Candidate
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Congratulations! 🎉
            </h1>
            <p className="text-xl font-medium text-teal-300">
              You have been shortlisted for the next round
            </p>
          </div>

          {/* Job Details Card */}
          <div className="bg-zinc-900/60 border border-white/5 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Position</span>
              <span className="text-sm font-bold text-white bg-zinc-800 px-3 py-1 rounded-full">{job?.title}</span>
            </div>

            {job?.aiSummary && (
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 font-medium">Job Overview</span>
                <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950/40 p-3.5 rounded-xl border border-white/5">
                  {job.aiSummary}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Assigned Candidate Email: <strong className="text-zinc-200">{invitation.applicantEmail}</strong></span>
            </div>
          </div>

          {/* Auth / Action Section */}
          <div className="space-y-4 pt-2">
            {isInitialized && !user && (
              <div className="space-y-3">
                <p className="text-xs text-center text-zinc-400">
                  Please sign up or log in with <strong className="text-teal-300">{invitation.applicantEmail}</strong> to claim your interview.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => router.push(`/applicant/sign-up?token=${token}`)}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-semibold h-12 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(13,148,136,0.3)]"
                  >
                    Sign Up to Start <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/applicant/sign-in?token=${token}`)}
                    className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 h-12 rounded-xl text-sm"
                  >
                    Log In Existing Account
                  </Button>
                </div>
              </div>
            )}

            {isInitialized && user && (
              <div className="text-center py-4 space-y-3">
                <div className="flex items-center justify-center gap-2 text-teal-400 text-sm font-semibold">
                  <UserCheck className="w-5 h-5 animate-bounce" /> Logged in as {user.email}
                </div>
                <p className="text-xs text-zinc-400">Claiming your interview and redirecting to your Applicant Dashboard...</p>
              </div>
            )}
          </div>

        </Card>
      </motion.div>
    </div>
  );
}
