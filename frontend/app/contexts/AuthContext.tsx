"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";

interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (googleToken: string) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem("auth_token");
        if (savedToken) {
          setToken(savedToken);
          const valid = await verifyTokenWithAPI(savedToken);
          if (!valid) {
            localStorage.removeItem("auth_token");
            setToken(null);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (googleToken: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/auth/login`, {
        token: googleToken,
      });

      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem("auth_token", access_token);
      console.log("✓ Logged in successfully");
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    console.log("✓ Logged out");
  };

  const verifyTokenWithAPI = async (currentToken: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await axios.post(
        `${API_URL}/auth/verify-token`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.data.valid && response.data.user) {
        setUser(response.data.user);
        return true;
      }
      return false;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        console.warn("Token verification timed out");
      } else {
        console.error("Token verification failed:", error.message);
      }
      return false;
    }
  };

  const verifyToken = async (): Promise<boolean> => {
    if (!token) return false;
    return verifyTokenWithAPI(token);
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    verifyToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
