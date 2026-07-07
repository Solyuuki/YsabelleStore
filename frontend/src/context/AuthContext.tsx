import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";

import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";
import type { AuthSession, AuthUser } from "@/types/auth";
import { useToast } from "@/components/shared/ToastProvider";
import type { ToastInput } from "@/components/shared/toast.types";

const AUTH_TOKEN_KEY = "ysabellestore.authToken";
const REMEMBERED_ACCOUNTS_KEY = "ysabelle.rememberedAccounts";
const TRUSTED_DEVICE_TOKENS_KEY = "ysabellestore.trustedDeviceTokens";
const AUTH_TOAST_SCOPE = "auth";
const TRUSTED_DEVICE_FAILED_MESSAGE = "Device verification failed. Please sign in again.";
const TRUSTED_DEVICE_FORGOTTEN_MESSAGE = "This device was forgotten. Please sign in again.";
const TRUSTED_DEVICE_USER_INACTIVE_MESSAGE =
  "Account access is inactive. Please contact the owner.";
const TRUSTED_DEVICE_SUCCESS_MESSAGE = "Device recognized. Welcome back.";
const SAVED_ACCOUNT_MESSAGE = "Saved account found. Please sign in to continue.";

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
  deviceLabel?: string;
  trustedDeviceAvailable?: boolean;
};

type AuthContextValue = {
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  rememberedAccounts: RememberedAccount[];
  removeRememberedAccount: (id: string) => Promise<void>;
  selectRememberedAccount: (account: RememberedAccount) => Promise<boolean>;
  register: (input: RegisterInput, options?: RegisterOptions) => Promise<boolean>;
  switchUser: () => Promise<void>;
  status: AuthStatus;
  user: AuthUser | null;
};

type RegisterOptions = {
  preserveSession?: boolean;
};

type CurrentUserResponse = {
  user: AuthUser;
};

type TrustedDeviceTokenStore = Record<string, string>;

type AuthErrorPayload = {
  code?: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function logAuthDiagnostic(event: string, details: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.info(`[auth] ${event}`, details);
}

function getAuthErrorCode(response: ApiResponse<unknown, AuthErrorPayload>) {
  return response.success ? undefined : response.error?.code;
}

function resolveTrustedDeviceFailureMessage(code: string | undefined) {
  switch (code) {
    case "TRUSTED_DEVICE_REVOKED":
      return TRUSTED_DEVICE_FORGOTTEN_MESSAGE;
    case "TRUSTED_DEVICE_USER_UNAVAILABLE":
      return TRUSTED_DEVICE_USER_INACTIVE_MESSAGE;
    case "TRUSTED_DEVICE_INVALID":
    default:
      return TRUSTED_DEVICE_FAILED_MESSAGE;
  }
}

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
          typeof candidate.lastUsedAt === "string" &&
          (candidate.deviceLabel === undefined || typeof candidate.deviceLabel === "string") &&
          (candidate.trustedDeviceAvailable === undefined ||
            typeof candidate.trustedDeviceAvailable === "boolean")
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

function readTrustedDeviceTokens(): TrustedDeviceTokenStore {
  try {
    const rawValue = localStorage.getItem(TRUSTED_DEVICE_TOKENS_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string" && entry[1].length >= 32
      )
    );
  } catch {
    return {};
  }
}

function writeTrustedDeviceTokens(tokens: TrustedDeviceTokenStore) {
  localStorage.setItem(TRUSTED_DEVICE_TOKENS_KEY, JSON.stringify(tokens));
}

function findTrustedDeviceTokenForRestore() {
  const accounts = readRememberedAccounts();
  const tokens = readTrustedDeviceTokens();
  const account = accounts.find((item) => tokens[item.id]);

  if (!account) {
    logAuthDiagnostic("trusted-device restore skipped", {
      rememberedAccountCount: accounts.length,
      reason: "missing_trusted_device_token"
    });
    return null;
  }

  logAuthDiagnostic("trusted-device restore candidate found", {
    accountId: account.id,
    email: account.email,
    trustedDeviceTokenExists: true
  });

  return {
    accountId: account.id,
    trustedDeviceToken: tokens[account.id]
  };
}

function buildRememberedAccount(
  user: AuthUser,
  lastUsedAt = new Date().toISOString()
): RememberedAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    deviceLabel: "This device",
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
  const [trustedDeviceTokens, setTrustedDeviceTokens] = useState<TrustedDeviceTokenStore>(() =>
    readTrustedDeviceTokens()
  );
  const [error, setError] = useState<string | null>(null);
  const skipAutomaticTrustedRestoreRef = useRef(false);
  const { clearToastScope, pushToast } = useToast();

  const pushAuthToast = useCallback(
    (toast: ToastInput) => {
      clearToastScope(AUTH_TOAST_SCOPE);
      pushToast({
        ...toast,
        scope: AUTH_TOAST_SCOPE
      });
    },
    [clearToastScope, pushToast]
  );

  const rememberAccount = useCallback((account: AuthUser) => {
    const nextAccount = buildRememberedAccount(account);

    setRememberedAccounts((currentAccounts) => {
      const filteredAccounts = currentAccounts.filter((item) => item.id !== account.id);

      return sortRememberedAccounts([nextAccount, ...filteredAccounts]);
    });
  }, []);

  const clearAuthToken = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
  }, []);

  const clearSession = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setError(null);
    setStatus("unauthenticated");
  }, [clearAuthToken]);

  const applySession = useCallback((session: AuthSession) => {
    skipAutomaticTrustedRestoreRef.current = false;
    localStorage.setItem(AUTH_TOKEN_KEY, session.token);
    setToken(session.token);
    setUser(session.user);
    setError(null);
    setStatus("authenticated");
  }, []);

  const storeTrustedDeviceToken = useCallback((accountId: string, trustedDeviceToken?: string) => {
    if (!trustedDeviceToken) {
      logAuthDiagnostic("trusted-device token missing after password login", {
        accountId
      });
      return;
    }

    setTrustedDeviceTokens((currentTokens) => {
      const nextTokens = {
        ...currentTokens,
        [accountId]: trustedDeviceToken
      };

      writeTrustedDeviceTokens(nextTokens);

      return nextTokens;
    });
  }, []);

  const clearTrustedDeviceToken = useCallback((accountId: string) => {
    setTrustedDeviceTokens((currentTokens) => {
      const remainingTokens = { ...currentTokens };
      delete remainingTokens[accountId];
      writeTrustedDeviceTokens(remainingTokens);

      return remainingTokens;
    });
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
    writeTrustedDeviceTokens(trustedDeviceTokens);
  }, [trustedDeviceTokens]);

  useEffect(() => {
    let active = true;

    async function restoreFromTrustedDevice() {
      if (skipAutomaticTrustedRestoreRef.current) {
        logAuthDiagnostic("trusted-device restore skipped", {
          reason: "manual_logout"
        });

        if (active) {
          setStatus("unauthenticated");
        }

        return;
      }

      const trustedDevice = findTrustedDeviceTokenForRestore();

      if (!trustedDevice) {
        if (active) {
          setStatus("unauthenticated");
        }

        return;
      }

      try {
        const response: ApiResponse<AuthSession, AuthErrorPayload> = await apiClient.request(
          "/api/auth/trusted-device/session",
          {
            method: "POST",
            json: {
              trustedDeviceToken: trustedDevice.trustedDeviceToken
            }
          }
        );

        if (!active) {
          return;
        }

        if (response.success && response.data) {
          applySession(response.data);
          rememberAccount(response.data.user);
          logAuthDiagnostic("trusted-device restore succeeded", {
            accountId: response.data.user.id,
            email: response.data.user.email
          });
          return;
        }

        {
          const failureMessage = resolveTrustedDeviceFailureMessage(getAuthErrorCode(response));

          clearTrustedDeviceToken(trustedDevice.accountId);
          setError(failureMessage);
          pushAuthToast({
            message: failureMessage,
            title:
              failureMessage === TRUSTED_DEVICE_FORGOTTEN_MESSAGE
                ? "Device forgotten"
                : "Device verification failed",
            variant: "warning"
          });
        }
        setStatus("unauthenticated");
        logAuthDiagnostic("trusted-device restore rejected", {
          accountId: trustedDevice.accountId,
          code: getAuthErrorCode(response) ?? "UNKNOWN_REJECTION"
        });
      } catch {
        if (active) {
          clearTrustedDeviceToken(trustedDevice.accountId);
          setError(TRUSTED_DEVICE_FAILED_MESSAGE);
          setStatus("unauthenticated");
          pushAuthToast({
            message: TRUSTED_DEVICE_FAILED_MESSAGE,
            title: "Device verification failed",
            variant: "warning"
          });
          logAuthDiagnostic("trusted-device restore failed", {
            accountId: trustedDevice.accountId,
            code: "BACKEND_OR_NETWORK_ERROR"
          });
        }
      }
    }

    async function loadCurrentUser() {
      if (!token) {
        await restoreFromTrustedDevice();
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

        clearAuthToken();
        await restoreFromTrustedDevice();
      } catch {
        if (active) {
          clearAuthToken();
          await restoreFromTrustedDevice();
        }
      }
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, [
    applySession,
    clearAuthToken,
    clearTrustedDeviceToken,
    pushAuthToast,
    rememberAccount,
    token
  ]);

  const selectRememberedAccount = useCallback(
    async (account: RememberedAccount) => {
      const trustedDeviceToken = trustedDeviceTokens[account.id];
      let trustedDeviceFailureMessage = TRUSTED_DEVICE_FAILED_MESSAGE;

      setError(null);

      if (!trustedDeviceToken) {
        logAuthDiagnostic("saved account selected without trusted token", {
          accountId: account.id,
          email: account.email,
          trustedDeviceTokenExists: false
        });
        clearAuthToken();
        setUser(null);
        setStatus("unauthenticated");
        setError(SAVED_ACCOUNT_MESSAGE);
        pushAuthToast({
          message: SAVED_ACCOUNT_MESSAGE,
          title: "Login required",
          variant: "warning"
        });
        return false;
      }

      try {
        skipAutomaticTrustedRestoreRef.current = false;
        const response: ApiResponse<AuthSession, AuthErrorPayload> = await apiClient.request(
          "/api/auth/trusted-device/session",
          {
            method: "POST",
            json: {
              trustedDeviceToken
            }
          }
        );

        if (response.success && response.data && response.data.user.id === account.id) {
          applySession(response.data);
          rememberAccount(response.data.user);
          logAuthDiagnostic("trusted-device selected account succeeded", {
            accountId: response.data.user.id,
            email: response.data.user.email
          });
          pushAuthToast({
            message: TRUSTED_DEVICE_SUCCESS_MESSAGE,
            title: "Device recognized",
            variant: "success"
          });
          return true;
        }

        clearTrustedDeviceToken(account.id);
        trustedDeviceFailureMessage = resolveTrustedDeviceFailureMessage(
          getAuthErrorCode(response)
        );
        logAuthDiagnostic("trusted-device selected account rejected", {
          accountId: account.id,
          email: account.email,
          code: getAuthErrorCode(response) ?? "UNKNOWN_REJECTION"
        });
      } catch {
        clearTrustedDeviceToken(account.id);
        logAuthDiagnostic("trusted-device selected account failed", {
          accountId: account.id,
          email: account.email,
          code: "BACKEND_OR_NETWORK_ERROR"
        });
      }

      clearAuthToken();
      setUser(null);
      setError(trustedDeviceFailureMessage);
      setStatus("unauthenticated");
      pushAuthToast({
        message: trustedDeviceFailureMessage,
        title:
          trustedDeviceFailureMessage === TRUSTED_DEVICE_FORGOTTEN_MESSAGE
            ? "Device forgotten"
            : "Device verification failed",
        variant: "warning"
      });
      return false;
    },
    [
      applySession,
      clearAuthToken,
      clearTrustedDeviceToken,
      pushAuthToast,
      rememberAccount,
      trustedDeviceTokens
    ]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      skipAutomaticTrustedRestoreRef.current = false;
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
          pushAuthToast(resolveLoginToast(response));
          return false;
        }

        applySession(response.data);
        storeTrustedDeviceToken(response.data.user.id, response.data.trustedDeviceToken);
        rememberAccount(response.data.user);
        logAuthDiagnostic("password login trusted-device token result", {
          accountId: response.data.user.id,
          email: response.data.user.email,
          trustedDeviceTokenReturned: Boolean(response.data.trustedDeviceToken)
        });
        pushAuthToast({
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
        pushAuthToast({
          message,
          title: "Authentication service unavailable",
          variant: "error"
        });
        return false;
      }
    },
    [applySession, pushAuthToast, rememberAccount, storeTrustedDeviceToken]
  );

  const register = useCallback(
    async (input: RegisterInput, options?: RegisterOptions) => {
      const previousToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const previousUser = user;

      setStatus("loading");
      setError(null);

      try {
        const response: ApiResponse<AuthSession, AuthErrorPayload> = await apiClient.request(
          "/api/auth/register",
          {
            method: "POST",
            headers: previousToken
              ? {
                  Authorization: `Bearer ${previousToken}`
                }
              : undefined,
            json: input
          }
        );

        if (!response.success || !response.data) {
          const errorMessage = resolveAuthErrorMessage(response);

          setError(errorMessage);

          if (options?.preserveSession && previousToken && previousUser) {
            localStorage.setItem(AUTH_TOKEN_KEY, previousToken);
            setToken(previousToken);
            setUser(previousUser);
            setStatus("authenticated");
          } else {
            setUser(null);
            setStatus("unauthenticated");
          }

          pushAuthToast(resolveRegisterToast(response));
          return false;
        }

        if (options?.preserveSession && previousToken && previousUser) {
          localStorage.setItem(AUTH_TOKEN_KEY, previousToken);
          setToken(previousToken);
          setUser(previousUser);
          setError(null);
          setStatus("authenticated");
        } else {
          applySession(response.data);
          storeTrustedDeviceToken(response.data.user.id, response.data.trustedDeviceToken);
          rememberAccount(response.data.user);
        }

        pushAuthToast({
          message: "Store account has been created.",
          title: "Account created",
          variant: "success"
        });
        return true;
      } catch {
        const message = "Please make sure the backend server is running.";

        setError("Authentication service is unavailable. Please check the backend server.");

        if (options?.preserveSession && previousToken && previousUser) {
          localStorage.setItem(AUTH_TOKEN_KEY, previousToken);
          setToken(previousToken);
          setUser(previousUser);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }

        pushAuthToast({
          message,
          title: "Authentication service unavailable",
          variant: "error"
        });
        return false;
      }
    },
    [applySession, rememberAccount, pushAuthToast, storeTrustedDeviceToken, user]
  );

  const performLogout = useCallback(
    async (toast?: ToastInput) => {
      const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);

      // Logout signs out the current JWT session only.
      // Forget device revokes the trusted-device token used for passwordless restore.
      skipAutomaticTrustedRestoreRef.current = true;
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
        pushAuthToast(toast);
      }
    },
    [clearSession, pushAuthToast]
  );

  const logout = useCallback(async () => {
    await performLogout({
      message: "Signed out.",
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
    async (id: string) => {
      const trustedDeviceToken = trustedDeviceTokens[id];

      if (trustedDeviceToken) {
        try {
          await apiClient.request("/api/auth/trusted-device/revoke", {
            method: "POST",
            json: {
              trustedDeviceToken
            }
          });
        } catch {
          // Local forget remains authoritative if the backend is unavailable.
        }
      }

      clearTrustedDeviceToken(id);
      clearRememberedAccount(id);
      pushAuthToast({
        message: "This device will require a password for that account.",
        title: "Device forgotten",
        variant: "info"
      });
    },
    [clearRememberedAccount, clearTrustedDeviceToken, pushAuthToast, trustedDeviceTokens]
  );

  const rememberedAccountsForDisplay = useMemo(
    () =>
      rememberedAccounts.map((account) => ({
        ...account,
        trustedDeviceAvailable: Boolean(trustedDeviceTokens[account.id])
      })),
    [rememberedAccounts, trustedDeviceTokens]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      login,
      logout,
      rememberedAccounts: rememberedAccountsForDisplay,
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
      pushAuthToast,
      rememberedAccountsForDisplay,
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
