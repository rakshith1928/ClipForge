"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Handle Google OAuth redirect payload
  useEffect(() => {
    const token = searchParams.get("token");
    const refresh = searchParams.get("refresh");
    const redirect = searchParams.get("redirect");

    if (token) {
      localStorage.setItem("access_token", token);
      if (refresh) localStorage.setItem("refresh_token", refresh);
      window.dispatchEvent(new Event("auth-change"));

      if (redirect && redirect.startsWith("/")) {
        router.replace(redirect);
      } else {
        router.replace("/");
      }
    }
  }, [searchParams, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = isLogin ? "/auth/login" : "/auth/register";
    const payload = isLogin
      ? { email: formData.email, password: formData.password }
      : { name: formData.name, email: formData.email, password: formData.password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Validation errors usually come as an array in FastAPI
        if (Array.isArray(data.detail)) {
          throw new Error(data.detail[0]?.msg || "Validation error");
        }
        throw new Error(data.detail || "Authentication failed");
      }

      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token);
        }
        // Save minimal user info
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
        // Trigger a custom event so Navbar can update immediately if it listens
        window.dispatchEvent(new Event("auth-change"));
        const redirect = searchParams.get("redirect");
        if (redirect && redirect.startsWith("/")) {
          router.replace(redirect);
        } else {
          router.replace("/");
        }
      } else {
        throw new Error("No token received");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirects browser to backend which initiates Google OAuth flow
    window.location.href = `${API_BASE}/auth/google/login`;
  };

  return (
    <main className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4 relative overflow-hidden font-body">
      {/* Background glow effects matching Landing Page */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#ba9eff] opacity-20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#6e3bd7] opacity-20 blur-[150px] rounded-full pointer-events-none" />

      <div className="glass-card shadow-[0_0_40px_-10px_rgba(186,158,255,0.15)] rounded-3xl p-8 sm:p-12 w-full max-w-[480px] z-10 border border-white/5 relative">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-headline font-bold text-white mb-3">
            {isLogin ? "Welcome back" : "Create an account"}
          </h1>
          <p className="text-[#adaaad] text-sm font-medium">
            {isLogin
              ? "Sign in to access your PodClip dashboard"
              : "Start clipping your podcasts with AI today."}
          </p>
        </div>

        {/* Social Login Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-[#0e0e10] font-semibold py-3 px-6 rounded-xl transition-all duration-200 mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[#767577] text-sm font-medium">or use email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {error && (
          <div className="bg-[#a70138]/20 border border-[#d73357]/50 text-[#ffb2b9] text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#767577] group-focus-within:text-[#ba9eff] transition-colors" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full bg-[#131315] border border-white/10 focus:border-[#ba9eff] rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-[#48474a] outline-none transition-all"
                required={!isLogin}
              />
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#767577] group-focus-within:text-[#ba9eff] transition-colors" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
              className="w-full bg-[#131315] border border-white/10 focus:border-[#ba9eff] rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-[#48474a] outline-none transition-all"
              required
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#767577] group-focus-within:text-[#ba9eff] transition-colors" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isLogin ? "Password" : "Create password (8+ chars, 1 special)"}
              className="w-full bg-[#131315] border border-white/10 focus:border-[#ba9eff] rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-[#48474a] outline-none transition-all"
              required
              minLength={isLogin ? 1 : 8}
            />
          </div>

          {!isLogin && (
            <p className="text-[#767577] text-xs px-2 pt-1">
              Must be at least 8 characters and include a special character (!@#$%^&*).
            </p>
          )}

          {isLogin && (
            <div className="flex justify-end pt-1">
              <button type="button" className="text-sm font-medium text-[#ba9eff] hover:text-[#ae8dff] transition-colors">
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full premium-gradient-bg hover:brightness-110 text-[#2b006e] font-bold py-3.5 px-6 rounded-xl transition-all duration-200 mt-4 flex justify-center items-center gap-2 group shadow-[0_0_20px_-5px_rgba(186,158,255,0.4)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? "Sign In" : "Create Account"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[#adaaad] text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="font-semibold text-[#ba9eff] hover:text-white transition-colors"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0e0e10] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>}>
      <AuthForm />
    </Suspense>
  );
}
