// parseTags reads `git tag --list` output, newest first, capped at limit.
export function parseTags(stdout: string, limit: number): string[] {
  return stdout
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .slice(0, limit);
}
