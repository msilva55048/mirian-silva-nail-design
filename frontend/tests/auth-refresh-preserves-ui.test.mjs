import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");

test("TOKEN_REFRESHED não reinicializa Cliente nem ADM", () => {
  assert.equal((source.match(/event === "TOKEN_REFRESHED"\) return;/g) ?? []).length, 2);
  assert.doesNotMatch(source, /controllerchange[\s\S]*location\.reload/);
});
