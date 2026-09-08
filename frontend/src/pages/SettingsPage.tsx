import { RotateCcw, Save, ServerCog } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchBackendReadiness, type BackendHealth } from "@/services/healthApi";
import {
  getWorkstationPreferences,
  resetWorkstationPreferences,
  saveWorkstationPreferences,
  type DashboardRefreshSeconds,
  type WorkstationPreferences
} from "@/services/workstationPreferences";

const refreshOptions: readonly { label: string; value: DashboardRefreshSeconds }[] = [
  { label: "Manual only", value: 0 },
  { label: "Every 30 seconds", value: 30 },
  { label: "Every 60 seconds", value: 60 },
  { label: "Every 2 minutes", value: 120 }
];

export function SettingsPage() {
  const [preferences, setPreferences] = useState<WorkstationPreferences>(getWorkstationPreferences);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      setHealthLoading(true);
      try {
        const result = await fetchBackendReadiness();
        if (!active) return;
        setHealth(result);
        setHealthError(null);
      } catch (error) {
        if (!active) return;
        setHealth(null);
        setHealthError(error instanceof Error ? error.message : "Unable to load backend readiness.");
      } finally {
        if (active) setHealthLoading(false);
      }
    }

    void loadHealth();
    return () => {
      active = false;
    };
  }, []);

  function updatePreference<K extends keyof WorkstationPreferences>(
    key: K,
    value: WorkstationPreferences[K]
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSavedMessage(null);
  }

  function handleSave() {
    const saved = saveWorkstationPreferences(preferences);
    setPreferences(saved);
    setSavedMessage("Settings saved for this workstation.");
  }

  function handleReset() {
    const defaults = resetWorkstationPreferences();
    setPreferences(defaults);
    setSavedMessage("Workstation settings reset to defaults.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner area"
        title="Settings"
        description="Configure workstation behavior and review the current backend readiness state."
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Workstation preferences</CardTitle>
              <StatusBadge variant="info">Local to this device</StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">Dashboard refresh interval</span>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                value={preferences.dashboardRefreshSeconds}
                onChange={(event) =>
                  updatePreference(
                    "dashboardRefreshSeconds",
                    Number(event.target.value) as DashboardRefreshSeconds
                  )
                }
              >
                {refreshOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <input
                checked={preferences.refreshDashboardOnFocus}
                className="mt-1 h-4 w-4"
                onChange={(event) => updatePreference("refreshDashboardOnFocus", event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">Refresh when window regains focus</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Pull fresh sales and inventory state when returning to YsabelleStore.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <input
                checked={preferences.showForecastSummary}
                className="mt-1 h-4 w-4"
                onChange={(event) => updatePreference("showForecastSummary", event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">Show forecast summary on Dashboard</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Controls only the Dashboard card; it does not change forecast generation or data.
                </span>
              </span>
            </label>

            {savedMessage ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {savedMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} type="button">
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Save settings
              </Button>
              <Button onClick={handleReset} type="button" variant="secondary">
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Reset defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>System readiness</CardTitle>
              <ServerCog className="h-5 w-5 text-slate-500" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <p className="text-sm text-slate-500">Checking backend readiness...</p>
            ) : healthError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {healthError}
              </div>
            ) : health ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                  <span className="text-sm text-slate-600">Backend</span>
                  <StatusBadge variant={health.ready ? "success" : "warning"}>
                    {health.ready ? "Ready" : health.status}
                  </StatusBadge>
                </div>
                <ReadinessRow label="Database" value={health.checks.database} />
                <ReadinessRow label="Prisma" value={health.checks.prisma} />
                <ReadinessRow label="Environment" value={health.environment} />
                <ReadinessRow
                  label="Database config"
                  value={health.configuration.databaseUrlLoaded ? "Loaded" : "Missing"}
                />
                <ReadinessRow
                  label="JWT config"
                  value={health.configuration.jwtSecretLoaded ? "Loaded" : "Missing"}
                />
                <p className="pt-2 text-xs leading-5 text-slate-500">{health.database.message}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ReadinessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
