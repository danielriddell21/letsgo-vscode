// Files whose change can alter what `letsgo plan` reports, relative to a
// workspace folder.
export const watchedGlobs: readonly string[] = [
  "letsgo.mod",
  "go.mod",
  ".letsgo/*.mod",
  ".git/HEAD",
  ".git/packed-refs",
  ".git/refs/tags/**",
];
