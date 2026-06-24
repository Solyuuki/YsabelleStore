import { AppLayout } from "@/layouts/AppLayout";

export function App() {
  return (
    <AppLayout>
      <section className="grid gap-3">
        <p className="text-sm font-medium text-primary">Sprint 1 Application Scaffold</p>
        <h1 className="text-2xl font-semibold text-foreground">YsabelleStore</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The frontend foundation is ready for future thesis modules while preserving the approved
          boundary between UI, services, schemas, hooks, and shared types.
        </p>
      </section>
    </AppLayout>
  );
}
