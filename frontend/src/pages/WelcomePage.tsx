import { ArrowRight, MonitorCheck, UsersRound } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";

type WelcomePageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

export function WelcomePage({ onNavigate }: WelcomePageProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-10 py-8 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl grid-cols-[1fr_420px] items-center gap-10">
        <section>
          <StatusBadge variant="success">Checking session</StatusBadge>
          <h1 className="mt-6 text-4xl font-semibold tracking-normal">YsabelleStore</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Desktop retail inventory recommender system for grocery operations, ready for quick
            continuation into sales, inventory, and product workspaces.
          </p>
          <div className="mt-8 max-w-xl">
            <LoadingState label="Checking local desktop session" />
          </div>
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg">Welcome back</CardTitle>
              <StatusBadge variant="info">Device recognized</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <MonitorCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-slate-950">Retail counter workstation</p>
                    <p className="text-sm text-slate-500">
                      Active user: Abarado, owner access pending
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="h-11 w-full"
                onClick={() => onNavigate("/dashboard")}
                type="button"
              >
                Continue to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button className="h-11 w-full" type="button" variant="secondary">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                Switch user
              </Button>

              <p className="text-xs leading-5 text-slate-500">
                Protected areas will ask for owner approval before sensitive store controls open.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
