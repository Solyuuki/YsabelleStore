import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";
import type { AuthSession, AuthUser } from "@/types/auth";

const AUTH_TOKEN_KEY = "ysabellestore.authToken";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: "OWNER" | "STAFF";
};

type AuthContextValue = {
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<boolean>;
  switchUser: () => Promise<void>;
  status: AuthStatus;
  user: AuthUser | null;
};

type CurrentUserResponse = {
  user: AuthUser;
};

type AuthErrorPayload = {
  code?: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function resolveAuthErrorMessage(response: ApiResponse<unknown, AuthErrorPayload>) {
  if (!response.success && response.error?.code === "ACCOUNT_NOT_FOUND") {
    return "Account not found. Please run the development seed or register an authorized user.";
  }

  if (!response.success && response.error?.code === "INVALID_CREDENTIALS") {
    return "Invalid email or password.";
  }

  return response.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [error, setError] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const applySession = useCallback((session: AuthSession) => {
    localStorage.setItem(AUTH_TOKEN_KEY, session.token);
    setToken(session.token);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      if (!token) {
        setStatus("unauthenticated");
        return;
      }

      setStatus("loading");

      try {
        const response = await apiClient.request<CurrentUserResponse>("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!active) {
          return;
        }

        if (response.success && response.data?.user) {
          setUser(response.data.user);
          setError(null);
          setStatus("authenticated");
          return;
        }

        clearSession();
      } catch {
        if (active) {
          clearSession();
        }
      }
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, [clearSession, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      setStatus("loading");
      setError(null);

      try {
        const response: ApiResponse<AuthSession, AuthErrorPayload> = await apiClient.request(
          "/api/auth/login",
          {
            method: "POST",
            json: {
              email,
              password
            }
          }
        );

        if (!response.success || !response.data) {
          setError(resolveAuthErrorMessage(response));
          setUser(null);
          setStatus("unauthenticated");
          return false;
        }

        applySession(response.data);
        return true;
      } catch {
        setError("Authentication service is unavailable. Please check the backend server.");
        setUser(null);
        setStatus("unauthenticated");
        return false;
      }
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setStatus("loading");
      setError(null);

      try {
        const response: ApiResponse<AuthSession, AuthErrorPayload> = await apiClient.request(
          "/api/auth/register",
          {
            method: "POST",
            json: input
          }
        );

        if (!response.success || !response.data) {
          setError(resolveAuthErrorMessage(response));
          setUser(null);
          setStatus("unauthenticated");
          return false;
        }

        applySession(response.data);
        return true;
      } catch {
        setError("Authentication service is unavailable. Please check the backend server.");
        setUser(null);
        setStatus("unauthenticated");
        return false;
      }
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);

    clearSession();

    if (currentToken) {
      try {
        await apiClient.request("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });
      } catch {
        // Local logout is authoritative for the desktop session.
      }
    }
  }, [clearSession]);

  const switchUser = useCallback(async () => {
    await logout();
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      login,
      logout,
      register,
      switchUser,
      status,
      user
    }),
    [error, login, logout, register, status, switchUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
