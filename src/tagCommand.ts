import * as vscode from "vscode";
import * as cp from "node:child_process";
import { isSafeTag } from "./manifest";
import { runInPanel } from "./run";
import { levelChoices, parseProposal, parseTaggedRef, pushCommand, tagArgs } from "./tag";

function exec(binary: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile(binary, args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || err.message).trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

// Tag next version: letsgo proposes, the person picks a level, letsgo tags.
// The tag is the one write the extension makes routinely; publishing stays with
// CI, so the offer that follows is to push the tag, which is what starts it.
export async function tagNextVersion(binary: string, dir: string, output: vscode.OutputChannel): Promise<void> {
  let proposal;
  try {
    proposal = parseProposal(await exec(binary, ["tag", "--json"], dir));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    output.appendLine(`letsgo tag --json failed in ${dir}: ${reason}`);
    void vscode.window.showErrorMessage(`letsgo could not propose a version: ${reason}`);
    return;
  }

  const choice = await vscode.window.showQuickPick(levelChoices(proposal), {
    title: `Tag next version (${proposal.previous ?? "no release yet"} → ${proposal.next})`,
    placeHolder: "Pick the level; the proposed one is first",
  });
  if (!choice) {
    return;
  }

  let created: string | undefined;
  try {
    created = parseTaggedRef(await exec(binary, tagArgs(choice.level), dir));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    output.appendLine(`letsgo tag failed in ${dir}: ${reason}`);
    void vscode.window.showErrorMessage(`letsgo did not tag: ${reason}`);
    return;
  }
  if (!created || !isSafeTag(created)) {
    void vscode.window.showInformationMessage("letsgo did not create a tag.");
    return;
  }

  const push = "Push tag";
  const answer = await vscode.window.showInformationMessage(`Tagged ${created}. Pushing it starts the release in CI.`, push);
  if (answer === push) {
    output.appendLine(pushCommand(created));
    await runInPanel(`push ${created}`, "git", ["push", "origin", created], dir);
  }
}
