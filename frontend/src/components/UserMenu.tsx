"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, ShieldCheck, Mail, ChevronDown, CheckCircle2, AlertCircle, Award, Clock } from "lucide-react";

import { toast } from "sonner";
import Link from "next/link";

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out successfully");
      setIsOpen(false);
      router.push("/");
    } catch {
      toast.error("Signout error");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 hover:border-white/20 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-semibold text-white leading-tight max-w-[120px] truncate">
            {user.name || user.email.split("@")[0]}
          </p>
          <span className="text-[10px] text-zinc-400 capitalize">{user.role.toLowerCase()}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6)] py-2 z-50 text-white"
          >
            {/* User Profile Header */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.name || "User"}</p>
                  <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                </div>
              </div>

              {/* Status & Role Badges */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                  user.role === "RECRUITER" 
                    ? "bg-violet-500/10 text-violet-300 border border-violet-500/20" 
                    : "bg-teal-500/10 text-teal-300 border border-teal-500/20"
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  {user.role}
                </span>

                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  user.emailVerified 
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" 
                    : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                }`}>
                  {user.emailVerified ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-400" /> Unverified
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="py-1">
              {user.role === "RECRUITER" ? (
                <>
                  <Link
                    href="/recruiter"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <User className="w-4 h-4 text-violet-400" />
                    Recruiter Dashboard
                  </Link>
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Award className="w-4 h-4 text-yellow-400" />
                    Candidate Analytics
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/applicant/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <User className="w-4 h-4 text-teal-400" />
                    Applicant Dashboard
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Interview History
                  </Link>
                </>
              )}
            </div>


            {/* Signout Button */}
            <div className="border-t border-white/5 pt-1 mt-1">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
