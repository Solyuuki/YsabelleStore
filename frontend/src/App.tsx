import { AppShell } from "@/app/AppShell";
import { GlobalHttpStatusNotifier } from "@/components/shared/GlobalHttpStatusNotifier";\nimport { GlobalReliabilityUI } from "@/components/shared/GlobalReliabilityUI";
import { NotificationStack } from "@/components/shared/NotificationStack";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { AuthProvider } from "@/context/AuthContext";
import { SystemReliabilityProvider } from "@/context/SystemReliabilityContext";

export function App() {
  return (
    <SystemReliabilityProvider>
      <ToastProvider>
        <AuthProvider>
          <div data-reliability-content>
            <AppShell />
            <NotificationStack />
          </div>
          <GlobalHttpStatusNotifier />\n          <GlobalReliabilityUI />
        </AuthProvider>
      </ToastProvider>
    </SystemReliabilityProvider>
  );
}
