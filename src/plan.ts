export type Status = "pass" | "fail" | "warn" | "skip";

export interface Pos {
  file: string;
  line: number;
  col: number;
}

export interface Check {
  name: string;
  status: Status;
  detail: string;
  pos?: Pos;
}

export interface Source {
  field: string;
  value: string;
  from: string;
}

export interface Features {
  disabled?: string[];
  required?: string[];
}

export interface Plugin {
  command: string;
  version?: string;
  digest?: string;
}

export interface PlanResult {
  schema: number;
  project: string;
  version?: string;
  commit: string;
  resolved?: Source[];
  checks: Check[];
  artifacts?: string[];
  features: Features;
  plugins?: Record<string, Plugin>;
}

const supportedSchema = 1;

export function parsePlan(text: string): PlanResult {
  const data = JSON.parse(text) as PlanResult;
  if (data.schema !== supportedSchema) {
    throw new Error(`unsupported plan schema ${data.schema}`);
  }
  return data;
}
