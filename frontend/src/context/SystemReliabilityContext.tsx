import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { checkSystemHealth, type SystemHealthState } from "@/services/systemHealthService";
import { setSystemMutationGate } from "@/services/systemReliabilityGate";

export type SystemReliabilityMode =
  | "checking"
  | "healthy"
  | "degraded"
  | "reconnecting"
  | "unavailable";

type SystemReliabilityContextValue = {
  healthState: SystemHealthState;
  lastHealthyAt: Date | null;
  mode: SystemReliabilityMode;
  recentlyRestored: boolean;
  retryNow: () => Promise<void>;
};

const SystemReliabilityContext = createContext<SystemReliabilityContextValue | undefined>(
  undefined
);

const HEALTH_POLL_INTERVAL_MS = 4_000;
const RESTORED_NOTICE_MS = 3_000;

export function SystemReliabilityProvider({ children }: { children: ReactNode }) {
  const [healthState, setHealthState] = useState<SystemHealthState>("checking");
  const [mode, setMode] = useState<SystemReliabilityMode>("checking");
  const [lastHealthyAt, setLastHealthyAt] = useState<Date | null>(null);
  const [recentlyRestored, setRecentlyRestored] = useState(false);
  const consecutiveTransportFailuresRef = useRef(0);
  const modeRef = useRef<SystemReliabilityMode>("checking");
  const checkInFlightRef = useRef<Promise<void> | null>(null);
  const restoredTimerRef = useRef<number | null>(null);

  const applyMode = useCallback((nextMode: SystemReliabilityMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
    setSystemMutationGate(nextMode !== "healthy", nextMode === "healthy" ? null : nextMode);
  }, []);

  const applyHealthState = useCallback(
    (nextState: SystemHealthState) => {
      const previousMode = modeRef.current;
      setHealthState(nextState);

      if (nextState === "healthy") {
        consecutiveTransportFailuresRef.current = 0;
        setLastHealthyAt(new Date());
        applyMode("healthy");

        if (
          previousMode === "degraded" ||
          previousMode === "reconnecting" ||
          previousMode === "unavailable"
        ) {
          setRecentlyRestored(true);

          if (restoredTimerRef.current !== null) {
            window.clearTimeout(restoredTimerRef.current);
          }

          restoredTimerRef.current = window.setTimeout(() => {
            setRecentlyRestored(false);
            restoredTimerRef.current = null;
          }, RESTORED_NOTICE_MS);
        }

        return;
      }

      setRecentlyRestored(false);

      if (nextState === "degraded") {
        consecutiveTransportFailuresRef.current = 0;
        applyMode("degraded");
        return;
      }

      if (nextState === "database-unavailable" || nextState === "offline") {
        consecutiveTransportFailuresRef.current = 2;
        applyMode("unavailable");
        return;
      }

      if (nextState === "backend-unavailable" || nextState === "timeout") {
        consecutiveTransportFailuresRef.current += 1;
        applyMode(consecutiveTransportFailuresRef.current >= 2 ? "unavailable" : "reconnecting");
        return;
      }

      applyMode("checking");
    },
    [applyMode]
  );

  const retryNow = useCallback(async () => {
    if (checkInFlightRef.current) {
      return checkInFlightRef.current;
    }

    const checkPromise = checkSystemHealth()
      .then(applyHealthState)
      .finally(() => {
        checkInFlightRef.current = null;
      });

    checkInFlightRef.current = checkPromise;
    return checkPromise;
  }, [applyHealthState]);

  useEffect(() => {
    setSystemMutationGate(true, "checking");
    void retryNow();

    const intervalId = window.setInterval(() => {
      void retryNow();
    }, HEALTH_POLL_INTERVAL_MS);

    const handleOnline = () => {
      void retryNow();
    };
    const handleOffline = () => {
      applyHealthState("offline");
    };
    const handleFocus = () => {
      void retryNow();
    };
    const handleApiUnreachable = () => {
      if (modeRef.current === "healthy") {
        applyHealthState("backend-unavailable");
      }
      void retryNow();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("ysabelle:api-unreachable", handleApiUnreachable);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("ysabelle:api-unreachable", handleApiUnreachable);

      if (restoredTimerRef.current !== null) {
        window.clearTimeout(restoredTimerRef.current);
      }
    };
  }, [applyHealthState, retryNow]);

  const value = useMemo<SystemReliabilityContextValue>(
    () => ({
      healthState,
      lastHealthyAt,
      mode,
      recentlyRestored,
      retryNow
    }),
    [healthState, lastHealthyAt, mode, recentlyRestored, retryNow]
  );

  return (
    <SystemReliabilityContext.Provider value={value}>{children}</SystemReliabilityContext.Provider>
  );
}

export function useSystemReliability() {
  const context = useContext(SystemReliabilityContext);

  if (!context) {
    throw new Error("useSystemReliability must be used inside SystemReliabilityProvider.");
  }

  return context;
}
