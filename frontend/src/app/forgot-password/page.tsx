"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { forgotPasswordAPI } from "@/services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    try {
      const res = await forgotPasswordAPI(email);
      setIsSent(true);
      setMessage(res.message || "If an account exists, a password reset link has been dispatched.");
      toast.success("Password reset request submitted");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to process request");
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
              🔒
            </span>
            <span className="text-2xl font-bold text-white tracking-tight">Lumina AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Reset Your Password</h1>
          <p className="text-zinc-400 text-sm mt-1">Enter your registered email to receive a recovery link</p>
        </div>

        <Card className="border border-white/10 bg-zinc-950/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl">
          {isSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Check Your Inbox</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">{message}</p>
              <div className="pt-2">
                <Link href="/">
                  <Button variant="outline" className="w-full h-10 border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs">
                    Return to Home
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
                <label className="text-xs font-medium text-zinc-300">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
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
                {isLoading ? "Sending Reset Link..." : "Send Password Reset Link"}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <Link
              href="/applicant/sign-in"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
