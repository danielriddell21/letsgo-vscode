import assert from "node:assert/strict";
import { test } from "node:test";
import { findModules } from "../modules";

test("findModules keeps only folders with a letsgo.mod", () => {
  const folders = [
    { name: "api", fsPath: "/repo/services/api" },
    { name: "web", fsPath: "/repo/services/web" },
  ];
  const has = (dir: string) => dir === "/repo/services/api";
  assert.deepEqual(findModules(folders, has), [{ label: "api", dir: "/repo/services/api" }]);
});

test("findModules returns nothing when no folder has a letsgo.mod", () => {
  assert.deepEqual(
    findModules([{ name: "x", fsPath: "/x" }], () => false),
    [],
  );
});
