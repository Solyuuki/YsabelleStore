import { AppShell } from "@/app/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationStack } from "@/components/shared/NotificationStack";
import { ToastProvider } from "@/components/shared/ToastProvider";

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppShell />
        <NotificationStack />
      </AuthProvider>
    </ToastProvider>
  );
}
