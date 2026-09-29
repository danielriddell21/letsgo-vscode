export interface WorkspaceFolder {
  name: string;
  fsPath: string;
}

export interface ModuleLocation {
  label: string;
  dir: string;
}

export function findModules(
  folders: WorkspaceFolder[],
  hasLetsgoMod: (dir: string) => boolean,
): ModuleLocation[] {
  return folders.filter((f) => hasLetsgoMod(f.fsPath)).map((f) => ({ label: f.name, dir: f.fsPath }));
}
