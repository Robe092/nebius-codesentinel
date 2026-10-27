import test from "node:test";
import assert from "node:assert/strict";
import { SelfHealingOrchestrator } from "../lib/self-healing-orchestrator.js";
import { NebiusClient } from "../lib/nebius-client.js";

test("SelfHealingOrchestrator repairs vulnerable code within iterations", async () => {
  const client = new NebiusClient({ mockMode: true });
  const orchestrator = new SelfHealingOrchestrator({ client, maxIterations: 3 });

  const buggyCode = `
const apiKey = "sk-99887766554433221100aa";
const user = json.userName;
`;

  const session = await orchestrator.executeHealingLoop(buggyCode, "user_service.ts");

  assert.equal(session.status, "SUCCESS");
  assert.ok(session.steps.length >= 1);
  assert.ok(session.currentCode.includes("process.env.API_CREDENTIAL"));
  assert.ok(session.currentCode.includes("$json."));
  assert.equal(session.finalReport?.passed, true);
});

test("SelfHealingOrchestrator triggers circuit breaker if verifier continuously rejects patch", async () => {
  const client = new NebiusClient({ mockMode: true });
  const orchestrator = new SelfHealingOrchestrator({
    client,
    maxIterations: 2,
    testVerifier: async () => ({
      passed: false,
      output: "Intentional rejection by strict external test suite.",
    }),
  });

  const buggyCode = `const secret = "sk-99887766554433221100aa";`;
  const session = await orchestrator.executeHealingLoop(buggyCode);

  assert.equal(session.status, "CIRCUIT_BREAKER_TRIGGERED");
  assert.equal(session.steps.length, 2);
  assert.equal(session.steps[0].testResults?.passed, false);
});
