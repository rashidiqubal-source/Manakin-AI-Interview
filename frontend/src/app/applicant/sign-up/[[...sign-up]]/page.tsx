"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/authStore";

function ApplicantSignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { user, isInitialized, signup } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && user) {
      if (token) {
        router.push(`/invite/${token}`);
      } else {
        router.push("/applicant/dashboard");
      }
    }
  }, [user, isInitialized, token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);
    const result = await signup({
      email,
      password,
      name: name || undefined,
      role: "APPLICANT",
    });
    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      toast.success("Account created successfully!");
    } else {
      setError(result.error || "Failed to create account");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 opacity-30 transform -translate-x-1/4 -translate-y-1/4 w-[500px] h-[500px] bg-teal-600 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-cyan-600 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <span className="h-9 w-9 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center justify-center text-teal-400 font-bold text-lg">
              ✨
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">Lumina AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create Applicant Account</h1>
          <p className="text-zinc-400 text-sm mt-1">Join the future of voice AI recruitment</p>
        </div>

        <Card className="border border-white/10 bg-zinc-950/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Verification Email Sent!</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                We sent a verification link to <span className="font-semibold text-white">{email}</span>. Please check your inbox to verify your account.
              </p>
              <div className="pt-2">
                <Link href={token ? `/applicant/sign-in?token=${token}` : "/applicant/sign-in"}>
                  <Button className="w-full h-11 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-xl transition-all">
                    Proceed to Sign In
                  </Button>
                </Link>
              </div>
            </motion.div>
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
                <label className="text-xs font-medium text-zinc-300">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="applicant@example.com"
                    required
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters (mixed case, digit, symbol)"
                    required
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500">Must include uppercase, lowercase, number & special character</p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.2)] mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Creating Account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Create Account <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-white/5 text-center space-y-2">
            <p className="text-xs text-zinc-400">
              Already have an account?{" "}
              <Link
                href={token ? `/applicant/sign-in?token=${token}` : "/applicant/sign-in"}
                className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
              >
                Sign In
              </Link>
            </p>
            <p className="text-[11px] text-zinc-500">
              Looking to hire candidates?{" "}
              <Link href="/recruiter/sign-up" className="text-violet-400 hover:text-violet-300">
                Register as Recruiter
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function ApplicantSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <ApplicantSignUpContent />
    </Suspense>
  );
}
