// letsgo plan runs code the repository chooses: pinned plugins, git and go.
// In an untrusted workspace nothing runs. This is the one place that decision
// is made, so extension.ts has a single gate to call rather than repeating
// the check at every call site.
export function isPlanAllowed(workspaceTrusted: boolean): boolean {
  return workspaceTrusted;
}
