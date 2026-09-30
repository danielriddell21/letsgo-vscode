import type { PlanResult } from "./plan";

export interface StatusSummary {
  text: string;
  tooltip: string;
  isError: boolean;
}

export function summarize(plans: PlanResult[]): StatusSummary {
  if (plans.length === 0) {
    return { text: "$(circle-slash) letsgo", tooltip: "No letsgo.mod found in this workspace.", isError: false };
  }

  const checks = plans.flatMap((plan) => plan.checks);
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  if (fails > 0) {
    return {
      text: `$(error) letsgo: ${fails} failing`,
      tooltip: `${fails} check${fails === 1 ? "" : "s"} failing`,
      isError: true,
    };
  }
  if (warns > 0) {
    return {
      text: `$(warning) letsgo: ${warns} warning${warns === 1 ? "" : "s"}`,
      tooltip: `${warns} check${warns === 1 ? "" : "s"} warned`,
      isError: false,
    };
  }
  return { text: "$(check) letsgo", tooltip: "All checks passing", isError: false };
}

// markStale flags a summary built from a plan that could not be refreshed.
export function markStale(summary: StatusSummary): StatusSummary {
  return { ...summary, text: `${summary.text} (stale)`, tooltip: `${summary.tooltip}; the last refresh failed` };
}
