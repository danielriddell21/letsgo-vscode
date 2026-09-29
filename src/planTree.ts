import type { PlanResult, Pos, Status } from "./plan";

export type NodeKind =
  | "module"
  | "checks"
  | "check"
  | "artifacts"
  | "artifact"
  | "features"
  | "feature"
  | "plugins"
  | "plugin"
  | "error";

export interface TreeNode {
  kind: NodeKind;
  label: string;
  description?: string;
  detail?: string;
  status?: Status;
  pos?: Pos;
  children?: TreeNode[];
}

export function buildModuleTree(moduleLabel: string, plan: PlanResult): TreeNode {
  const children: TreeNode[] = [];

  if (plan.checks.length > 0) {
    children.push({
      kind: "checks",
      label: "Checks",
      children: plan.checks.map((c) => ({
        kind: "check",
        label: c.name,
        description: c.status,
        detail: c.detail,
        status: c.status,
        pos: c.pos,
      })),
    });
  }

  if (plan.artifacts && plan.artifacts.length > 0) {
    children.push({
      kind: "artifacts",
      label: "Artifacts",
      children: plan.artifacts.map((a) => ({ kind: "artifact", label: a })),
    });
  }

  const disabled = plan.features.disabled ?? [];
  const required = plan.features.required ?? [];
  if (disabled.length > 0 || required.length > 0) {
    children.push({
      kind: "features",
      label: "Features",
      children: [
        ...disabled.map((f) => ({ kind: "feature" as const, label: f, description: "disabled" })),
        ...required.map((f) => ({ kind: "feature" as const, label: f, description: "required" })),
      ],
    });
  }

  const plugins = plan.plugins ?? {};
  const hooks = Object.keys(plugins);
  if (hooks.length > 0) {
    children.push({
      kind: "plugins",
      label: "Plugins",
      children: hooks.map((hook) => {
        const p = plugins[hook];
        return {
          kind: "plugin" as const,
          label: hook,
          description: p.version ? `${p.command} @ ${p.version}` : p.command,
          detail: p.digest,
        };
      }),
    });
  }

  const failing = plan.checks.some((c) => c.status === "fail");
  return {
    kind: "module",
    label: moduleLabel,
    description: plan.version,
    status: failing ? "fail" : undefined,
    children,
  };
}

export function errorNode(moduleLabel: string, message: string): TreeNode {
  return { kind: "error", label: moduleLabel, description: "error", detail: message };
}
