import * as path from "node:path";

// Fixed, system-owned install locations for git. PATH is deliberately not
// searched: a writable directory earlier on it could substitute its own git.
const gitDirs: Record<"posix" | "win32", string[]> = {
  posix: ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"],
  win32: [String.raw`C:\Program Files\Git\cmd`, String.raw`C:\Program Files (x86)\Git\cmd`],
};

// findGit returns the absolute path of git in a fixed system directory, or
// undefined when there is none.
export function findGit(
  exists: (candidate: string) => boolean,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const win = platform === "win32";
  const exe = win ? "git.exe" : "git";
  const join = win ? path.win32.join : path.posix.join;
  return gitDirs[win ? "win32" : "posix"].map((dir) => join(dir, exe)).find(exists);
}

// parseTags reads `git tag --list` output, newest first, capped at limit.
export function parseTags(stdout: string, limit: number): string[] {
  return stdout
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .slice(0, limit);
}
