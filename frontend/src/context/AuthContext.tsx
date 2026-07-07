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
import { wait } from "@/utils/timing";

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
const SESSION_RESTORED_TITLE = "Session restored";
const SESSION_RESTORED_MESSAGE = "You were returned to where you left off.";
const SESSION_RESTORED_DURATION_MS = 11000;
const PASSWORD_LOGIN_MINIMUM_MS = 800;
const TRUSTED_DEVICE_CONTINUE_MINIMUM_MS = 700;

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
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  continueWithTrustedDevice: (account: RememberedAccount) => Promise<boolean>;
  rememberedAccounts: RememberedAccount[];
  removeRememberedAccount: (id: string) => Promise<void>;
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

export type LoginResult = {
  fieldError: boolean;
  message: string | null;
  success: boolean;
};

type AuthErrorPayload = {
  code?: string;
};

type StartupAuthResolution = {
  sourceToken: string | null;
  user: AuthUser | null;
  valid: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STARTUP_AUTH_NONE_KEY = "__startup_auth_none__";
const startupAuthResolutionCache = new Map<string, StartupAuthResolution>();
const startupAuthResolutionPromiseCache = new Map<string, Promise<StartupAuthResolution>>();
let startupRestoreToastToken: string | null = null;

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

function getStartupAuthCacheKey(token: string | null) {
  return token ?? STARTUP_AUTH_NONE_KEY;
}

function getCachedStartupAuthResolution(token: string | null) {
  return startupAuthResolutionCache.get(getStartupAuthCacheKey(token)) ?? null;
}

async function getStartupAuthResolution(token: string | null): Promise<StartupAuthResolution> {
  const cacheKey = getStartupAuthCacheKey(token);
  const cachedResolution = startupAuthResolutionCache.get(cacheKey);

  if (cachedResolution) {
    return cachedResolution;
  }

  const cachedPromise = startupAuthResolutionPromiseCache.get(cacheKey);

  if (cachedPromise) {
    return cachedPromise;
  }

  const resolutionPromise = (async () => {
    if (!token) {
      const resolution = {
        sourceToken: null,
        user: null,
        valid: false
      } satisfies StartupAuthResolution;

      startupAuthResolutionCache.set(cacheKey, resolution);
      return resolution;
    }

    try {
      const response = await apiClient.request<CurrentUserResponse>("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.success && response.data?.user) {
        const resolution = {
          sourceToken: token,
          user: response.data.user,
          valid: true
        } satisfies StartupAuthResolution;

        startupAuthResolutionCache.set(cacheKey, resolution);
        return resolution;
      }
    } catch {
      // Falling through to the unauthenticated resolution keeps startup deterministic.
    }

    const resolution = {
      sourceToken: token,
      user: null,
      valid: false
    } satisfies StartupAuthResolution;

    startupAuthResolutionCache.set(cacheKey, resolution);
    return resolution;
  })().finally(() => {
    startupAuthResolutionPromiseCache.delete(cacheKey);
  });

  startupAuthResolutionPromiseCache.set(cacheKey, resolutionPromise);
  return resolutionPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedAuthToken = localStorage.getItem(AUTH_TOKEN_KEY);
  const cachedStartupResolution = getCachedStartupAuthResolution(storedAuthToken);
  const [status, setStatus] = useState<AuthStatus>(() =>
    cachedStartupResolution?.valid
      ? "authenticated"
      : storedAuthToken
        ? "loading"
        : "unauthenticated"
  );
  const [isAuthReady, setIsAuthReady] = useState(
    () => storedAuthToken === null || Boolean(cachedStartupResolution?.valid)
  );
  const [user, setUser] = useState<AuthUser | null>(() => cachedStartupResolution?.user ?? null);
  const [token, setToken] = useState<string | null>(() =>
    cachedStartupResolution?.valid ? cachedStartupResolution.sourceToken : storedAuthToken
  );
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>(() =>
    readRememberedAccounts()
  );
  const [trustedDeviceTokens, setTrustedDeviceTokens] = useState<TrustedDeviceTokenStore>(() =>
    readTrustedDeviceTokens()
  );
  const [error, setError] = useState<string | null>(null);
  const { clearToastScope, pushToast } = useToast();
  const initialAuthTokenRef = useRef(token);

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
    const isStartupToken = token !== null && token === initialAuthTokenRef.current;

    async function loadCurrentUser() {
      const resolution = await getStartupAuthResolution(token);

      if (!active) {
        return;
      }

      if (resolution.valid && resolution.user) {
        setUser(resolution.user);
        setError(null);
        setStatus("authenticated");
        setIsAuthReady(true);
        rememberAccount(resolution.user);

        if (isStartupToken && startupRestoreToastToken !== resolution.sourceToken) {
          startupRestoreToastToken = resolution.sourceToken;
          pushAuthToast({
            durationMs: SESSION_RESTORED_DURATION_MS,
            message: SESSION_RESTORED_MESSAGE,
            title: SESSION_RESTORED_TITLE,
            variant: "info"
          });
        }

        return;
      }

      if (resolution.sourceToken) {
        clearAuthToken();
      }

      setUser(null);
      setError(null);
      setStatus("unauthenticated");
      setIsAuthReady(true);
    }

    const cachedResolution = getCachedStartupAuthResolution(token);

    if (cachedResolution) {
      if (cachedResolution.valid && cachedResolution.user) {
        setUser(cachedResolution.user);
        setError(null);
        setStatus("authenticated");
        setIsAuthReady(true);
        rememberAccount(cachedResolution.user);

        if (isStartupToken && startupRestoreToastToken !== cachedResolution.sourceToken) {
          startupRestoreToastToken = cachedResolution.sourceToken;
          pushAuthToast({
            durationMs: SESSION_RESTORED_DURATION_MS,
            message: SESSION_RESTORED_MESSAGE,
            title: SESSION_RESTORED_TITLE,
            variant: "info"
          });
        }
      } else {
        if (cachedResolution.sourceToken) {
          clearAuthToken();
        }

        setUser(null);
        setError(null);
        setStatus("unauthenticated");
        setIsAuthReady(true);
      }

      return () => {
        active = false;
      };
    }

    if (!token) {
      setUser(null);
      setError(null);
      setStatus("unauthenticated");
      setIsAuthReady(true);
      return () => {
        active = false;
      };
    }

    setStatus("loading");
    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, [clearAuthToken, pushAuthToast, rememberAccount, token]);

  const continueWithTrustedDevice = useCallback(
    async (account: RememberedAccount) => {
      const trustedDeviceToken = trustedDeviceTokens[account.id];
      let trustedDeviceFailureMessage = TRUSTED_DEVICE_FAILED_MESSAGE;
      const minimumDuration = wait(TRUSTED_DEVICE_CONTINUE_MINIMUM_MS);

      setError(null);

      if (!trustedDeviceToken) {
        await minimumDuration;
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
        // Trusted devices are intentionally user-initiated. A remembered trusted device must not
        // auto-login on startup.
        const [response]: [ApiResponse<AuthSession, AuthErrorPayload>, void] = await Promise.all([
          apiClient.request<AuthSession, AuthErrorPayload>("/api/auth/trusted-device/session", {
            method: "POST",
            json: {
              trustedDeviceToken
            }
          }),
          minimumDuration
        ]);

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
        await minimumDuration;
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
        variant: "error"
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
      const minimumDuration = wait(PASSWORD_LOGIN_MINIMUM_MS);

      setError(null);

      try {
        const [response]: [ApiResponse<AuthSession, AuthErrorPayload>, void] = await Promise.all([
          apiClient.request<AuthSession, AuthErrorPayload>("/api/auth/login", {
            method: "POST",
            json: {
              email,
              password
            }
          }),
          minimumDuration
        ]);

        if (!response.success || !response.data) {
          const errorMessage = resolveAuthErrorMessage(response);
          const isCredentialError = errorMessage === "Invalid email or password.";

          setError(errorMessage);
          setUser(null);
          setStatus("unauthenticated");
          pushAuthToast(resolveLoginToast(response));
          return {
            fieldError: isCredentialError,
            message: errorMessage,
            success: false
          };
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
        return {
          fieldError: false,
          message: null,
          success: true
        };
      } catch {
        const message = "Please make sure the backend server is running.";

        await minimumDuration;
        setError("Authentication service is unavailable. Please check the backend server.");
        setUser(null);
        setStatus("unauthenticated");
        pushAuthToast({
          message,
          title: "Authentication service unavailable",
          variant: "error"
        });
        return {
          fieldError: false,
          message: "Authentication service is unavailable. Please check the backend server.",
          success: false
        };
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
      variant: "warning"
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
        variant: "warning"
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
      continueWithTrustedDevice,
      isAuthReady,
      login,
      logout,
      rememberedAccounts: rememberedAccountsForDisplay,
      removeRememberedAccount,
      register,
      switchUser,
      status,
      user
    }),
    [
      clearRememberedAccount,
      continueWithTrustedDevice,
      error,
      isAuthReady,
      login,
      logout,
      rememberedAccountsForDisplay,
      register,
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
