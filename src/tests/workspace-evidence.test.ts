import test from "node:test";
import assert from "node:assert/strict";
import { buildLineComparison, sessionEvidence } from "../lib/workspace-evidence.js";
import type { SelfHealingSession } from "../types/index.js";

test("line comparison preserves context and identifies actual additions and removals", () => {
  assert.deepEqual(buildLineComparison("const key = 'secret';\nrun();", "const key = process.env.KEY;\nrun();"), [
    { kind: "removed", text: "const key = 'secret';", beforeLine: 1 },
    { kind: "added", text: "const key = process.env.KEY;", afterLine: 1 },
    { kind: "context", text: "run();", beforeLine: 2, afterLine: 2 },
  ]);
});

test("line comparison handles empty sources and unchanged trailing newlines", () => {
  assert.deepEqual(buildLineComparison("", "hello"), [{ kind: "added", text: "hello", afterLine: 1 }]);
  assert.deepEqual(buildLineComparison("hello", ""), [{ kind: "removed", text: "hello", beforeLine: 1 }]);
  assert.deepEqual(buildLineComparison("a\n", "a\n"), [
    { kind: "context", text: "a", beforeLine: 1, afterLine: 1 },
    { kind: "context", text: "", beforeLine: 2, afterLine: 2 },
  ]);
});

test("line comparison bounds work on large sources while retaining all lines", () => {
  const before = Array.from({ length: 2100 }, (_, index) => `before ${index}`).join("\n");
  const after = Array.from({ length: 2100 }, (_, index) => `after ${index}`).join("\n");
  const rows = buildLineComparison(before, after);
  assert.equal(rows.filter((row) => row.kind === "removed").length, 2100);
  assert.equal(rows.filter((row) => row.kind === "added").length, 2100);
});

test("session evidence uses actual score and all patch provenance, including fallback", () => {
  const base: SelfHealingSession = {
    sessionId: "failed", fileName: "file.ts", originalCode: "old", currentCode: "old", status: "CIRCUIT_BREAKER_TRIGGERED", currentIteration: 3, maxIterations: 3,
    steps: [{ iteration: 1, status: "FAILED", patch: {
      id: "patch", timestamp: "2026-10-27T15:00:00Z", modelUsed: "fallback-model", sourceMode: "LIVE_NEBIUS", reasoningSteps: [], explanation: "", diff: "", repairedCode: "old", fixedIssueIds: [], confidenceScore: 0.2,
    } }],
    finalReport: { targetName: "file.ts", timestamp: "2026-10-27T15:00:00Z", score: 70, passed: false, issues: [], metrics: { totalLines: 1, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 } },
  };
  assert.deepEqual(sessionEvidence(base), { finalScore: 70, modes: ["LIVE_NEBIUS"], models: ["fallback-model"], patchCount: 1 });
  assert.deepEqual(sessionEvidence({ ...base, steps: [], finalReport: undefined }), { finalScore: null, modes: [], models: [], patchCount: 0 });
});
