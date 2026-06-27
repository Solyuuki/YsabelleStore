import { ArrowRight, ShieldCheck, UsersRound } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";

type WelcomePageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

const ambientParticles = [
  "left-[12%] top-[18%] h-1 w-1 animation-delay-0",
  "left-[22%] top-[74%] h-1.5 w-1.5 animation-delay-700",
  "left-[36%] top-[30%] h-1 w-1 animation-delay-1400",
  "left-[51%] top-[82%] h-1 w-1 animation-delay-2100",
  "left-[64%] top-[22%] h-1.5 w-1.5 animation-delay-2800",
  "left-[76%] top-[68%] h-1 w-1 animation-delay-3500",
  "left-[88%] top-[28%] h-1 w-1 animation-delay-4200",
  "left-[91%] top-[78%] h-1.5 w-1.5 animation-delay-4900"
];

export function WelcomePage({ onNavigate }: WelcomePageProps) {
  return (
    <main className="welcome-ambient relative min-h-screen overflow-hidden px-[clamp(2.25rem,5vw,6rem)] py-[clamp(2rem,4vh,4.5rem)] text-slate-950">
      <div className="welcome-ambient-blob left-[8%] top-[12%] h-[clamp(15rem,24vw,28rem)] w-[clamp(15rem,24vw,28rem)] bg-emerald-200" />
      <div className="welcome-ambient-blob right-[7%] top-[8%] h-[clamp(16rem,26vw,32rem)] w-[clamp(16rem,26vw,32rem)] bg-blue-200 animation-delay-7000" />
      <div className="welcome-ambient-blob bottom-[2%] left-[38%] h-[clamp(14rem,22vw,26rem)] w-[clamp(14rem,22vw,26rem)] bg-violet-200 animation-delay-14000" />
      <div className="pointer-events-none absolute inset-0 z-0">
        {ambientParticles.map((particle) => (
          <span className={`welcome-particle ${particle}`} key={particle} />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-clamp(4rem,8vh,9rem))] max-w-[min(90vw,1500px)] grid-cols-[minmax(0,1fr)_minmax(clamp(25rem,30vw,35rem),0.78fr)] items-center gap-[clamp(3rem,6vw,7.5rem)]">
        <section className="max-w-[min(58vw,55rem)]">
          <StatusBadge variant="success">Checking session</StatusBadge>
          <h1 className="mt-[clamp(1.5rem,2.4vw,2.5rem)] text-[clamp(2.75rem,5vw,5rem)] font-semibold leading-[1.02] tracking-normal">
            YsabelleStore
          </h1>
          <p className="mt-[clamp(1rem,1.8vw,1.75rem)] max-w-[clamp(42rem,52vw,58rem)] text-[clamp(1rem,1.25vw,1.25rem)] leading-[1.75] text-slate-600">
            Desktop retail inventory recommender system for grocery operations, ready for quick
            continuation into sales, inventory, and product workspaces.
          </p>
          <div className="mt-[clamp(2rem,3.5vw,3.75rem)] max-w-[clamp(34rem,44vw,48rem)]">
            <LoadingState label="Checking local desktop session" />
          </div>
        </section>

        <Card className="border-white/70 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-[clamp(1.125rem,1.5vw,1.45rem)]">Welcome back</CardTitle>
              <StatusBadge variant="info">Device recognized</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[clamp(1rem,1.6vw,1.5rem)]">
              <div className="flex items-center gap-3 rounded-md border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Active user: Abarado, owner access pending</span>
              </div>
              <Button
                className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                onClick={() => onNavigate("/dashboard")}
                type="button"
              >
                Continue to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                type="button"
                variant="secondary"
              >
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                Switch user
              </Button>

              <p className="text-[clamp(0.78rem,0.9vw,0.9rem)] leading-6 text-slate-500">
                Protected areas will ask for owner approval before sensitive store controls open.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
