export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitForMinimumDuration<T>(
  operation: Promise<T>,
  minimumDurationMs: number
): Promise<T> {
  const [result] = await Promise.all([
    operation.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, error })
    ),
    wait(minimumDurationMs)
  ]);

  if (result.status === "rejected") {
    throw result.error;
  }

  return result.value;
}
