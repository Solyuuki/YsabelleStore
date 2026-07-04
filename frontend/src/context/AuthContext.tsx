import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";
import type { AuthSession, AuthUser } from "@/types/auth";
import { useToast } from "@/components/shared/ToastProvider";
import type { ToastInput } from "@/components/shared/toast.types";

const AUTH_TOKEN_KEY = "ysabellestore.authToken";
const REMEMBERED_ACCOUNTS_KEY = "ysabelle.rememberedAccounts";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: "OWNER" | "STAFF";
};

export type RememberedAccount = {
  id: string;
  name: string;
  email: string;
  role: AuthUser["role"];
  lastUsedAt: string;
};

type AuthContextValue = {
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  rememberedAccounts: RememberedAccount[];
  removeRememberedAccount: (id: string) => void;
  selectRememberedAccount: (account: RememberedAccount) => Promise<boolean>;
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

function sortRememberedAccounts(accounts: RememberedAccount[]) {
  return [...accounts].sort(
    (left, right) => new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime()
  );
}

function readRememberedAccounts() {
  try {
    const rawValue = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);

    if (!rawValue) {
      return [] as RememberedAccount[];
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [] as RememberedAccount[];
    }

    return sortRememberedAccounts(
      parsedValue.filter((item): item is RememberedAccount => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const candidate = item as Partial<RememberedAccount>;

        return (
          typeof candidate.id === "string" &&
          typeof candidate.name === "string" &&
          typeof candidate.email === "string" &&
          (candidate.role === "OWNER" || candidate.role === "STAFF") &&
          typeof candidate.lastUsedAt === "string"
        );
      })
    );
  } catch {
    return [] as RememberedAccount[];
  }
}

function writeRememberedAccounts(accounts: RememberedAccount[]) {
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(sortRememberedAccounts(accounts)));
}

function buildRememberedAccount(
  user: AuthUser,
  lastUsedAt = new Date().toISOString()
): RememberedAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    lastUsedAt,
    role: user.role
  };
}

function resolveAuthErrorMessage(response: ApiResponse<unknown, AuthErrorPayload>) {
  if (
    !response.success &&
    (response.error?.code === "ACCOUNT_NOT_FOUND" || response.error?.code === "INVALID_CREDENTIALS")
  ) {
    return "Invalid email or password.";
  }

  if (!response.success && response.error?.code === "AUTH_NOT_CONFIGURED") {
    return "Authentication is not configured. Please check the local development environment.";
  }

  return response.message;
}

function resolveLoginToast(response: ApiResponse<unknown, AuthErrorPayload>): ToastInput {
  if (
    !response.success &&
    (response.error?.code === "AUTH_NOT_CONFIGURED" ||
      response.error?.code === "PASSWORD_HASH_UNSUPPORTED")
  ) {
    return {
      message: "Please check the local development environment.",
      title: "Authentication not configured",
      variant: "error"
    };
  }

  return {
    message: "Invalid email or password.",
    title: "Login failed",
    variant: "error"
  };
}

function resolveRegisterToast(response: ApiResponse<unknown, AuthErrorPayload>): ToastInput {
  if (
    !response.success &&
    (response.error?.code === "AUTH_NOT_CONFIGURED" ||
      response.error?.code === "PASSWORD_HASH_UNSUPPORTED")
  ) {
    return {
      message: "Please check the local development environment.",
      title: "Authentication not configured",
      variant: "error"
    };
  }

  return {
    message: "Please check the account details and try again.",
    title: "Account creation failed",
    variant: "error"
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>(() =>
    readRememberedAccounts()
  );
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();

  const rememberAccount = useCallback((account: AuthUser) => {
    const nextAccount = buildRememberedAccount(account);

    setRememberedAccounts((currentAccounts) => {
      const filteredAccounts = currentAccounts.filter((item) => item.id !== account.id);

      return sortRememberedAccounts([nextAccount, ...filteredAccounts]);
    });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const applySession = useCallback((session: AuthSession) => {
    localStorage.setItem(AUTH_TOKEN_KEY, session.token);
    setToken(session.token);
    setUser(session.user);
    setError(null);
    setStatus("authenticated");
  }, []);

  const clearRememberedAccount = useCallback((id: string) => {
    setRememberedAccounts((currentAccounts) =>
      currentAccounts.filter((account) => account.id !== id)
    );
  }, []);

  useEffect(() => {
    writeRememberedAccounts(rememberedAccounts);
  }, [rememberedAccounts]);

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
          rememberAccount(response.data.user);
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
  }, [clearSession, rememberAccount, token]);

  const selectRememberedAccount = useCallback(
    async (account: RememberedAccount) => {
      const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);

      setError(null);

      if (!currentToken) {
        clearSession();
        pushToast({
          message: "Please sign in again to continue.",
          title: "Login required",
          variant: "warning"
        });
        return false;
      }

      try {
        const response = await apiClient.request<CurrentUserResponse>("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });

        if (response.success && response.data?.user && response.data.user.id === account.id) {
          setUser(response.data.user);
          setError(null);
          setStatus("authenticated");
          rememberAccount(response.data.user);
          pushToast({
            message: "Welcome back.",
            title: "Device recognized",
            variant: "success"
          });
          return true;
        }

        clearSession();
      } catch {
        clearSession();
      }

      pushToast({
        message: "Please sign in again to continue.",
        title: "Login required",
        variant: "warning"
      });
      return false;
    },
    [clearSession, pushToast, rememberAccount]
  );

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
          const errorMessage = resolveAuthErrorMessage(response);

          setError(errorMessage);
          setUser(null);
          setStatus("unauthenticated");
          pushToast(resolveLoginToast(response));
          return false;
        }

        applySession(response.data);
        rememberAccount(response.data.user);
        pushToast({
          message: "Welcome back.",
          title: "Login successful",
          variant: "success"
        });
        return true;
      } catch {
        const message = "Please make sure the backend server is running.";

        setError("Authentication service is unavailable. Please check the backend server.");
        setUser(null);
        setStatus("unauthenticated");
        pushToast({
          message,
          title: "Authentication service unavailable",
          variant: "error"
        });
        return false;
      }
    },
    [applySession, pushToast, rememberAccount]
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
          const errorMessage = resolveAuthErrorMessage(response);

          setError(errorMessage);
          setUser(null);
          setStatus("unauthenticated");
          pushToast(resolveRegisterToast(response));
          return false;
        }

        applySession(response.data);
        pushToast({
          message: "Store account has been created.",
          title: "Account created",
          variant: "success"
        });
        return true;
      } catch {
        const message = "Please make sure the backend server is running.";

        setError("Authentication service is unavailable. Please check the backend server.");
        setUser(null);
        setStatus("unauthenticated");
        pushToast({
          message,
          title: "Authentication service unavailable",
          variant: "error"
        });
        return false;
      }
    },
    [applySession, pushToast]
  );

  const performLogout = useCallback(
    async (toast?: ToastInput) => {
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

      if (toast) {
        pushToast(toast);
      }
    },
    [clearSession, pushToast]
  );

  const logout = useCallback(async () => {
    await performLogout({
      message: "You have been signed out.",
      title: "Signed out",
      variant: "info"
    });
  }, [performLogout]);

  const switchUser = useCallback(async () => {
    await performLogout({
      message: "Please sign in with your store credentials.",
      title: "Use another account",
      variant: "info"
    });
  }, [performLogout]);

  const removeRememberedAccount = useCallback(
    (id: string) => {
      clearRememberedAccount(id);
      pushToast({
        message: "This account was removed from quick access.",
        title: "Account removed",
        variant: "info"
      });
    },
    [clearRememberedAccount, pushToast]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      login,
      logout,
      rememberedAccounts,
      removeRememberedAccount,
      selectRememberedAccount,
      register,
      switchUser,
      status,
      user
    }),
    [
      clearRememberedAccount,
      error,
      login,
      logout,
      pushToast,
      rememberedAccounts,
      register,
      selectRememberedAccount,
      removeRememberedAccount,
      status,
      switchUser,
      user
    ]
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
