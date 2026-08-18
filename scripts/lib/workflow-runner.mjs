export function runSteps(steps, executor, onStep = () => {}) {
  for (const step of steps) {
    onStep(step);
    const result = executor(step);

    if (!result.ok) {
      return {
        failedStep: step.label,
        ok: false,
        status: result.status ?? 1
      };
    }
  }

  return { failedStep: null, ok: true, status: 0 };
}
