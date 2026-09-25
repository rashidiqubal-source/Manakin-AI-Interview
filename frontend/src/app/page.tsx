"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, ArrowRight, Shield, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useInterviewStore } from "@/lib/store";
import { useAuthStore } from "@/lib/authStore";
import { UserMenu } from "@/components/UserMenu";

export default function LandingPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();
  const [isStarting, setIsStarting] = useState(false);
  const { setCandidateName } = useInterviewStore();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in first!");
      return;
    }

    const candidateEmail = user.email;
    const candidateName = user.name || (candidateEmail ? candidateEmail.split("@")[0] : "Candidate");

    setIsStarting(true);
    try {
      setCandidateName(candidateName);
      router.push("/interview");
    } catch {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4">
      {/* Premium Aurora Background Blobs */}
      <div className="absolute top-0 opacity-30 transform translate-x-1/4 -translate-y-1/4 w-[600px] h-[600px] bg-cyan-600 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 opacity-30 transform -translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-violet-600 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-lg z-10"
      >
        <Card className="border border-white/5 bg-black/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 rounded-[2rem] relative overflow-hidden">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="h-16 w-16 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mb-2">
              <Mic className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-white">
                Lumina AI
              </h1>
              <p className="text-sm text-zinc-400 tracking-wide">
                A naturally conversational, voice-driven AI waiting to interview you.
              </p>
            </div>

            <div className="w-full space-y-4 pt-2">
              {isInitialized && !user && (
                <div className="w-full space-y-4">
                  {/* Recruiter Flow Button */}
                  <Link href="/recruiter/sign-in" className="block w-full">
                    <Button variant="outline" className="w-full py-5 border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 font-semibold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer">
                      <span>Enter Recruiter Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>

                  {/* Candidate Invitation-Only Notice */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 text-left space-y-1.5 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                      <Shield className="w-4 h-4" />
                      <span>Official Job Interviews: Invitation Only</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Official candidate assessments require an invitation link sent to your email. Recruiters can sign in above to manage job descriptions, invite candidates, and run demo interviews.
                    </p>
                  </div>
                </div>
              )}

              {isInitialized && user && (
                <motion.div
                  className="space-y-4 pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center justify-between border border-zinc-800 rounded-xl p-3 bg-zinc-900/50 backdrop-blur-md">
                    <span className="text-white text-xs">
                      Signed in as <span className="font-bold text-violet-300">{user.name || user.email.split("@")[0]}</span> ({user.role})
                    </span>
                    <UserMenu />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link href="/recruiter" className="block w-full">
                      <Button className="w-full h-24 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 font-semibold rounded-2xl transition-all flex flex-col items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(139,92,246,0.15)] cursor-pointer">
                        <span className="text-base font-bold text-white">Recruiter Dashboard</span>
                        <span className="text-[11px] text-zinc-400">Manage JDs & Candidate Invites</span>
                      </Button>
                    </Link>

                    <Link href="/admin" className="block w-full">
                      <Button className="w-full h-24 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 font-semibold rounded-2xl transition-all flex flex-col items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(234,179,8,0.1)] cursor-pointer">
                        <span className="text-base font-bold text-white">Candidate Analytics</span>
                        <span className="text-[11px] text-zinc-400">View Applicant Pipeline & Scores</span>
                      </Button>
                    </Link>
                  </div>

                  {/* Quick Demo Access for Signed-In Recruiters/Admins */}
                  <Link href="/demo" className="block w-full">
                    <Button variant="outline" className="w-full py-4 border-cyan-800/40 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer">
                      <Play className="w-4 h-4 fill-current" />
                      <span>Test 10-Question Demo Interview (With Full Proctoring & Evidence)</span>
                    </Button>
                  </Link>
                </motion.div>
              )}

            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
