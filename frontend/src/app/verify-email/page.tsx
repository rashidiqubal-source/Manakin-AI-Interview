"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Mail, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { verifyEmailAPI, resendVerificationAPI } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { fetchUser } = useAuthStore();

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token]);

  const handleVerify = async (tok: string) => {
    setStatus("verifying");
    try {
      const res = await verifyEmailAPI(tok);
      setStatus("success");
      setMessage(res.message || "Email address successfully verified!");
      toast.success("Email verified!");
      await fetchUser();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.message || err.message || "Verification link is invalid or has expired.");
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) {
      toast.error("Please provide your email address");
      return;
    }

    setIsResending(true);
    try {
      const res = await resendVerificationAPI(resendEmail);
      toast.success(res.message || "Verification link dispatched!");
      setResendEmail("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 opacity-30 transform -translate-x-1/4 -translate-y-1/4 w-[500px] h-[500px] bg-cyan-600 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-violet-600 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <span className="h-9 w-9 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400 font-bold text-lg">
              ✨
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">Lumina AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Email Verification</h1>
          <p className="text-zinc-400 text-sm mt-1">Activate and verify your account</p>
        </div>

        <Card className="border border-white/10 bg-zinc-950/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl text-center">
          {status === "verifying" && (
            <div className="py-8 space-y-4">
              <div className="w-12 h-12 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-white">Verifying your token...</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Verification Confirmed!</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">{message}</p>
              <div className="pt-2 flex flex-col gap-2">
                <Link href="/applicant/sign-in">
                  <Button className="w-full h-11 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-xl">
                    Sign In as Applicant
                  </Button>
                </Link>
                <Link href="/recruiter/sign-in">
                  <Button variant="outline" className="w-full h-11 border-zinc-800 text-zinc-300 hover:text-white rounded-xl">
                    Sign In as Recruiter
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Verification Failed</h2>
              <p className="text-xs text-red-400 leading-relaxed">{message}</p>
            </div>
          )}

          {status !== "success" && (
            <div className="mt-6 pt-4 border-t border-white/5 text-left">
              <h3 className="text-xs font-semibold text-white mb-2">Need a new verification link?</h3>
              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    required
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isResending}
                  className="w-full h-9 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-xl"
                >
                  {isResending ? "Dispatching..." : "Resend Verification Email"}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
