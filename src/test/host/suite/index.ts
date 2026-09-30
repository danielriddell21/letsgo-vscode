import * as fs from "node:fs";
import * as path from "node:path";
import Mocha from "mocha";

// Entry point the extension host loads: runs the suites for the mode the
// launcher chose (LETSGO_HOST_MODE), so trusted and untrusted runs differ.
export function run(): Promise<void> {
  const mode = process.env.LETSGO_HOST_MODE;
  if (mode !== "trusted" && mode !== "untrusted") {
    return Promise.reject(new Error(`LETSGO_HOST_MODE must be trusted or untrusted, got ${mode}`));
  }
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 30_000 });
  for (const file of fs.readdirSync(__dirname)) {
    if (file === `${mode}.test.js`) {
      mocha.addFile(path.join(__dirname, file));
    }
  }
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} tests failed`)) : resolve()));
  });
}
