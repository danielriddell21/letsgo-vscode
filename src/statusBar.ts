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

  let fails = 0;
  let warns = 0;
  for (const plan of plans) {
    for (const check of plan.checks) {
      if (check.status === "fail") {
        fails++;
      } else if (check.status === "warn") {
        warns++;
      }
    }
  }

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
