"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { resetPasswordAPI } from "@/services/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Password reset token is missing from URL");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPasswordAPI({ token, newPassword });
      setIsSuccess(true);
      toast.success("Password reset successfully!");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password. Link may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 opacity-20 transform -translate-x-1/4 -translate-y-1/4 w-[500px] h-[500px] bg-red-600 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-violet-600 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <span className="h-9 w-9 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center text-red-400 font-bold text-lg">
              🔑
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">Lumina AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create New Password</h1>
          <p className="text-zinc-400 text-sm mt-1">Choose a secure password for your account</p>
        </div>

        <Card className="border border-white/10 bg-zinc-950/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl">
          {isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Password Updated!</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your password has been changed and all previous sessions revoked. Please sign in with your new credentials.
              </p>
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] mt-2"
              >
                {isLoading ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
