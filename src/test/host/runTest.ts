import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";

// Launches VS Code with the extension loaded and runs each suite in the
// extension host: once with a trusted workspace, once with an untrusted one.
// A fake `letsgo` goes first on PATH so nothing needs a real binary, and every
// run gets a fresh copy of the fixture workspace. The fake is a node script
// with a shebang, so these tests run on Linux and macOS.

const root = path.resolve(__dirname, "../../..");
const fixtures = path.join(root, "src", "test", "host", "fixtures");

function launch(executable: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(executable, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => (code === 0 ? resolve() : reject(new Error(`VS Code exited with ${code ?? signal}`))));
  });
}

type Mode = "trusted" | "untrusted";

function scratch(): string {
  // Short, because the user-data-dir holds unix sockets with a path limit.
  return fs.mkdtempSync(path.join(os.tmpdir(), "lg-host-"));
}

function installFake(dir: string): string {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const target = path.join(bin, "letsgo");
  const source = fs.readFileSync(path.join(fixtures, "bin", "letsgo"), "utf8").replace(/^#!.*\n/, `#!${process.execPath}\n`);
  fs.writeFileSync(target, source, { mode: 0o755 });
  return bin;
}

async function runSuite(mode: Mode, vscodeExecutablePath: string): Promise<void> {
  const dir = scratch();
  const workspace = path.join(dir, "workspace");
  fs.cpSync(path.join(fixtures, "workspace"), workspace, { recursive: true });
  const bin = installFake(dir);
  const log = path.join(dir, "letsgo.log");
  fs.writeFileSync(log, "");

  const userData = path.join(dir, "user-data");
  fs.mkdirSync(path.join(userData, "User"), { recursive: true });
  fs.writeFileSync(
    path.join(userData, "User", "settings.json"),
    JSON.stringify({
      "security.workspace.trust.enabled": mode === "untrusted",
      "security.workspace.trust.startupPrompt": "never",
      "security.workspace.trust.banner": "never",
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
    }),
  );

  const args = [
    workspace,
    "--user-data-dir",
    userData,
    "--extensions-dir",
    path.join(dir, "extensions"),
    "--extensionDevelopmentPath=" + root,
    "--extensionTestsPath=" + path.join(__dirname, "suite", "index"),
    "--disable-extensions",
    "--disable-gpu",
    "--disable-updates",
    "--no-sandbox",
    "--skip-welcome",
    "--skip-release-notes",
    "--no-cached-data",
  ];
  // Workspace Trust stays on only for the untrusted run. @vscode/test-electron's
  // runTests always passes --disable-workspace-trust, so VS Code is launched
  // directly here for both modes.
  if (mode === "trusted") {
    args.push("--disable-workspace-trust");
  }

  try {
    await launch(vscodeExecutablePath, args, {
      ...process.env,
      LETSGO_HOST_MODE: mode,
      LETSGO_FAKE_LOG: log,
      LETSGO_HOST_WORKSPACE: workspace,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
      // The extension looks in these before PATH.
      GOBIN: "",
      GOPATH: "",
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const version = process.env.VSCODE_TEST_VERSION ?? "stable";
  const vscodeExecutablePath = await downloadAndUnzipVSCode(version);
  for (const mode of ["trusted", "untrusted"] as const) {
    console.log(`\n=== extension-host tests: ${mode} workspace ===`);
    await runSuite(mode, vscodeExecutablePath);
  }
}

main().catch((err) => {
  console.error("extension-host tests failed:", err);
  process.exit(1);
});
