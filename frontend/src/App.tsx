import { AppShell } from "@/app/AppShell";
import { AuthProvider } from "@/context/AuthContext";

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
