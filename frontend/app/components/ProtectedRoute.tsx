"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // Pass the current pathname so we could theoretically redirect back after login
      router.push(`/auth?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isLoggedIn, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // The useEffect will handle the redirect
  }

  return <>{children}</>;
}
