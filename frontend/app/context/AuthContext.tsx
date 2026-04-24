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

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = () => {
    try {
      const token = localStorage.getItem("access_token");
      const userStr = localStorage.getItem("user");

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const isExpired = payload.exp * 1000 < Date.now();

          if (isExpired) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("user");
            setUser(null);
            setIsLoggedIn(false);
          } else {
            setIsLoggedIn(true);
            if (userStr) {
              setUser(JSON.parse(userStr));
            } else {
              setUser(null);
            }
          }
        } catch (e) {
          console.error("Invalid token format", e);
          setIsLoggedIn(false);
          setUser(null);
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch (e) {
      console.error("Error checking auth state", e);
      setUser(null);
      setIsLoggedIn(false);
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
