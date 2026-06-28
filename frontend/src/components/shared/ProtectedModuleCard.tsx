import { Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";

type ProtectedModuleCardProps = {
  moduleName: string;
  reason: string;
};

export function ProtectedModuleCard({ moduleName, reason }: ProtectedModuleCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-5">
        <div>
          <CardTitle className="text-base">{moduleName} requires owner access</CardTitle>
          <CardDescription className="mt-2 leading-6">{reason}</CardDescription>
        </div>
        <StatusBadge variant="protected">Protected</StatusBadge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-900">Owner verification screen</p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Owner approval is required before this area can be opened on the workstation.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-slate-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-slate-950">Owner PIN</p>
                <p className="text-xs text-slate-500">Awaiting verification</p>
              </div>
            </div>
            <input
              className="mt-4 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500"
              disabled
              value="Not connected"
              readOnly
            />
            <Button className="mt-3 w-full" disabled>
              Verify owner
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
