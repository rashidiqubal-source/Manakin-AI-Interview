"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateJDRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/recruiter");
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400 text-sm">
      Redirecting to Recruiter Portal...
    </div>
  );
}
