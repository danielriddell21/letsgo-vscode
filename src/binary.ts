import * as path from "node:path";

export interface BinaryEnv {
  GOBIN?: string;
  GOPATH?: string;
  HOME?: string;
  USERPROFILE?: string;
  PATH?: string;
}

function exeName(platform: NodeJS.Platform): string {
  return platform === "win32" ? "letsgo.exe" : "letsgo";
}

export function candidatePaths(env: BinaryEnv, platform: NodeJS.Platform = process.platform): string[] {
  const exe = exeName(platform);
  const candidates: string[] = [];

  if (env.GOBIN) {
    candidates.push(path.join(env.GOBIN, exe));
  }
  if (env.GOPATH) {
    candidates.push(path.join(env.GOPATH, "bin", exe));
  }
  const home = env.HOME ?? env.USERPROFILE;
  if (home) {
    candidates.push(path.join(home, "go", "bin", exe));
  }
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (dir) {
      candidates.push(path.join(dir, exe));
    }
  }
  return candidates;
}

export function resolveBinary(
  configured: string | undefined,
  env: BinaryEnv,
  exists: (candidate: string) => boolean,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (configured) {
    return exists(configured) ? configured : undefined;
  }
  return candidatePaths(env, platform).find(exists);
}
