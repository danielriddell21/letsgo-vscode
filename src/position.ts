import * as path from "node:path";
import type { Pos } from "./plan";

export interface Target {
  file: string;
  line: number;
  col: number;
}

// resolvePos turns a plan position (1-based, file relative to the module
// unless absolute) into an editor target (0-based).
export function resolvePos(dir: string, pos: Pos): Target {
  return {
    file: path.isAbsolute(pos.file) ? pos.file : path.join(dir, pos.file),
    line: Math.max(pos.line - 1, 0),
    col: Math.max(pos.col - 1, 0),
  };
}
