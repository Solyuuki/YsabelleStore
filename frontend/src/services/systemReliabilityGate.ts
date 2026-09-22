export type MutationBlockReason = "checking" | "degraded" | "reconnecting" | "unavailable" | null;

type MutationGateState = {
  blocked: boolean;
  reason: MutationBlockReason;
};

let mutationGateState: MutationGateState = {
  blocked: true,
  reason: "checking"
};

export class SystemMutationBlockedError extends Error {
  public readonly code = "SYSTEM_MUTATION_BLOCKED";
  public readonly reason: MutationBlockReason;

  public constructor(reason: MutationBlockReason) {
    super(
      reason === "reconnecting"
        ? "Ysabelle Store is reconnecting. This action is temporarily paused to protect transaction integrity."
        : "Ysabelle Store is not ready for changes right now. Please wait for the system connection to recover."
    );
    this.name = "SystemMutationBlockedError";
    this.reason = reason;
  }
}

export function setSystemMutationGate(blocked: boolean, reason: MutationBlockReason) {
  mutationGateState = {
    blocked,
    reason: blocked ? reason : null
  };
}

export function getSystemMutationGate() {
  return mutationGateState;
}

export function assertSystemMutationAllowed(method: string | undefined) {
  if (!isMutationMethod(method) || !mutationGateState.blocked) {
    return;
  }

  throw new SystemMutationBlockedError(mutationGateState.reason);
}

export function isMutationMethod(method: string | undefined) {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);
}
