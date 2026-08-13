"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  profile_pic?: string;
  provider?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  logout: () => void;
  checkAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
    setIsLoggedIn(false);
  };

  const tryRefresh = async (refreshToken: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
      setIsLoggedIn(true);
      const userStr = localStorage.getItem("user");
      setUser(userStr ? JSON.parse(userStr) : null);
      return true;
    } catch {
      return false;
    }
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");
      const userStr = localStorage.getItem("user");

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const isExpired = payload.exp * 1000 < Date.now();

          if (isExpired) {
            if (refreshToken && (await tryRefresh(refreshToken))) {
              return;
            }
            clearAuth();
          } else {
            setIsLoggedIn(true);
            setUser(userStr ? JSON.parse(userStr) : null);
          }
        } catch (e) {
          console.error("Invalid token format", e);
          clearAuth();
        }
      } else {
        clearAuth();
      }
    } catch (e) {
      console.error("Error checking auth state", e);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "access_token" || e.key === "user" || e.key === null) {
        checkAuth();
      }
    };

    // Listen for custom event from login page
    window.addEventListener("auth-change", checkAuth as EventListener);
    // Listen for storage events (multi-tab support)
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("auth-change", checkAuth as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, isLoading, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
