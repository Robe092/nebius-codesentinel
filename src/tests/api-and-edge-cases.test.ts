import test from "node:test";
import assert from "node:assert/strict";
import { CodeAnalyzer } from "../lib/code-analyzer.js";
import { SelfHealingOrchestrator } from "../lib/self-healing-orchestrator.js";
import { NebiusClient } from "../lib/nebius-client.js";
import { PatchProposalSchema } from "../types/index.js";

test("CodeAnalyzer handles empty and whitespace-only code cleanly", () => {
  const report1 = CodeAnalyzer.analyze("");
  assert.equal(report1.passed, true);
  assert.equal(report1.score, 100);
  assert.equal(report1.issues.length, 0);

  const report2 = CodeAnalyzer.analyze("   \n\n   ");
  assert.equal(report2.passed, true);
  assert.equal(report2.score, 100);
  assert.equal(report2.issues.length, 0);
});

test("CodeAnalyzer flags deprecated components (eval, basicLLMChain) with HIGH severity", () => {
  const code = `
const chain = new basicLLMChain();
const res = eval("2 + 2");
`;
  const report = CodeAnalyzer.analyze(code);
  assert.equal(report.passed, false);
  assert.equal(report.metrics.highCount, 2);
  assert.ok(report.issues.some((i) => i.ruleId === "DEP-001" && i.message.includes("basicLLMChain")));
  assert.ok(report.issues.some((i) => i.ruleId === "DEP-001" && i.message.includes("eval()")));
});

test("CodeAnalyzer flags empty expression placeholders '{{ }}' with LOW severity", () => {
  const code = `const expr = "{{  }}";`;
  const report = CodeAnalyzer.analyze(code);
  assert.equal(report.metrics.lowCount, 1);
  assert.equal(report.issues[0]?.ruleId, "SYN-002");
});

test("CodeAnalyzer recognizes HITL guardrails in preceding lines and permits communication", () => {
  const codeWithGuardrail = `
// Step with Human-in-the-Loop gatekeeper
if (await hitlGatekeeper.approve()) {
  await slack.postMessage({ channel: "#approved", text: "Verified transaction" });
}
`;
  const report = CodeAnalyzer.analyze(codeWithGuardrail);
  // Slack post is guarded by hitlGatekeeper so FORBIDDEN_DIRECT_COMMUNICATION should not be triggered
  assert.equal(report.issues.filter((i) => i.category === "FORBIDDEN_DIRECT_COMMUNICATION").length, 0);
});

test("SelfHealingOrchestrator exits immediately with SUCCESS when given already clean code", async () => {
  const client = new NebiusClient({ mockMode: true });
  const orchestrator = new SelfHealingOrchestrator({ client });

  const cleanCode = `
const key = process.env.SAFE_KEY;
const item = $json.data;
`;
  const session = await orchestrator.executeHealingLoop(cleanCode);
  assert.equal(session.status, "SUCCESS");
  assert.equal(session.steps.length, 1);
  assert.equal(session.steps[0]?.invariantPassed, true);
  assert.equal(session.steps[0]?.patch, undefined); // No patch needed
});

test("PatchProposalSchema strictly validates patch schema structure", () => {
  const validPatch = {
    id: "patch-123",
    timestamp: new Date().toISOString(),
    sourceMode: "MOCK_SIMULATED",
    modelUsed: "nvidia/nemotron-3-super-120b",
    repairedCode: "const a = 1;",
    diff: "--- a\n+++ b",
    explanation: "Replaced exposed secret with environment variable",
    fixedIssueIds: ["issue-1"],
    reasoningSteps: ["Step 1", "Step 2"],
    confidenceScore: 0.98,
  };

  const parsed = PatchProposalSchema.safeParse(validPatch);
  assert.equal(parsed.success, true);

  const invalidPatch = {
    id: "patch-123",
    // Missing required fields
  };
  const invalidParsed = PatchProposalSchema.safeParse(invalidPatch);
  assert.equal(invalidParsed.success, false);
});
