export type DashboardRefreshSeconds = 0 | 30 | 60 | 120;

export type WorkstationPreferences = {
  dashboardRefreshSeconds: DashboardRefreshSeconds;
  refreshDashboardOnFocus: boolean;
  showForecastSummary: boolean;
};

export const WORKSTATION_PREFERENCES_KEY = "ysabellestore.workstationPreferences.v1";

export const DEFAULT_WORKSTATION_PREFERENCES: WorkstationPreferences = {
  dashboardRefreshSeconds: 30,
  refreshDashboardOnFocus: true,
  showForecastSummary: true
};

const VALID_REFRESH_SECONDS = new Set<DashboardRefreshSeconds>([0, 30, 60, 120]);

export function normalizeWorkstationPreferences(value: unknown): WorkstationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_WORKSTATION_PREFERENCES };
  }

  const candidate = value as Partial<WorkstationPreferences>;
  const refreshSeconds = VALID_REFRESH_SECONDS.has(candidate.dashboardRefreshSeconds as DashboardRefreshSeconds)
    ? (candidate.dashboardRefreshSeconds as DashboardRefreshSeconds)
    : DEFAULT_WORKSTATION_PREFERENCES.dashboardRefreshSeconds;

  return {
    dashboardRefreshSeconds: refreshSeconds,
    refreshDashboardOnFocus:
      typeof candidate.refreshDashboardOnFocus === "boolean"
        ? candidate.refreshDashboardOnFocus
        : DEFAULT_WORKSTATION_PREFERENCES.refreshDashboardOnFocus,
    showForecastSummary:
      typeof candidate.showForecastSummary === "boolean"
        ? candidate.showForecastSummary
        : DEFAULT_WORKSTATION_PREFERENCES.showForecastSummary
  };
}

export function getWorkstationPreferences(): WorkstationPreferences {
  try {
    const rawValue = window.localStorage.getItem(WORKSTATION_PREFERENCES_KEY);

    if (!rawValue) {
      return { ...DEFAULT_WORKSTATION_PREFERENCES };
    }

    return normalizeWorkstationPreferences(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_WORKSTATION_PREFERENCES };
  }
}

export function saveWorkstationPreferences(
  preferences: WorkstationPreferences
): WorkstationPreferences {
  const normalized = normalizeWorkstationPreferences(preferences);
  window.localStorage.setItem(WORKSTATION_PREFERENCES_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetWorkstationPreferences(): WorkstationPreferences {
  window.localStorage.removeItem(WORKSTATION_PREFERENCES_KEY);
  return { ...DEFAULT_WORKSTATION_PREFERENCES };
}
