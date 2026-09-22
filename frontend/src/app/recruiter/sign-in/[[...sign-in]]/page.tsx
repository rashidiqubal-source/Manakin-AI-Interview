"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/authStore";

function RecruiterSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/recruiter";

  const { user, isInitialized, login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && user) {
      router.push(redirectParam);
    }
  }, [user, isInitialized, redirectParam, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      toast.success("Welcome back, Recruiter!");
      router.push(redirectParam);
    } else {
      setError(result.error || "Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 opacity-30 transform -translate-x-1/4 -translate-y-1/4 w-[500px] h-[500px] bg-violet-600 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-purple-600 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <span className="h-9 w-9 bg-violet-500/10 border border-violet-500/30 rounded-xl flex items-center justify-center text-violet-400 font-bold text-lg">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">Lumina AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Recruiter Portal</h1>
          <p className="text-zinc-400 text-sm mt-1">Sign in to manage job descriptions & candidate pipelines</p>
        </div>

        <Card className="border border-white/10 bg-zinc-950/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl">
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
              <label className="text-xs font-medium text-zinc-300">Corporate Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  required
                  className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
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

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.2)] mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In to Recruiter Hub <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 text-center space-y-2">
            <p className="text-xs text-zinc-400">
              New hiring organization?{" "}
              <Link
                href="/recruiter/sign-up"
                className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                Create Recruiter Account
              </Link>
            </p>
            <p className="text-[11px] text-zinc-500">
              Are you a job applicant?{" "}
              <Link href="/applicant/sign-in" className="text-teal-400 hover:text-teal-300">
                Applicant Portal
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function RecruiterSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <RecruiterSignInContent />
    </Suspense>
  );
}
