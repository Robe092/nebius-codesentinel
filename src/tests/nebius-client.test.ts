import test from "node:test";
import assert from "node:assert/strict";
import { NebiusClient } from "../lib/nebius-client.js";

test("NebiusClient initializes in mock simulation mode when no API key is provided", async () => {
  const client = new NebiusClient({
    mockMode: true,
    model: "nvidia/nemotron-3-super-120b",
  });

  assert.equal(client.isMock(), true);
  assert.equal(client.getModelName(), "nvidia/nemotron-3-super-120b");

  const conn = await client.testConnection();
  assert.equal(conn.connected, true);
  assert.equal(conn.mode, "MOCK_SIMULATED");
  assert.ok(conn.latencyMs >= 0);
});

test("NebiusClient generates high-fidelity Nemotron patch proposal in mock mode", async () => {
  const client = new NebiusClient({ mockMode: true });

  const vulnerableCode = `
const apiKey = "sk-1234567890abcdef1234567890";
const target = json.item;
slack.postMessage({ text: "Hello" });
`;

  const patch = await client.generatePatch({
    code: vulnerableCode,
    issues: [
      {
        id: "issue-1",
        ruleId: "SEC-001",
        category: "HARDCODED_SECRET",
        severity: "CRITICAL",
        message: "Secret exposed",
        autoFixable: true,
      },
      {
        id: "issue-2",
        ruleId: "SYN-001",
        category: "EXPRESSION_SYNTAX",
        severity: "MEDIUM",
        message: "Missing dollar prefix",
        autoFixable: true,
      },
    ],
  });

  assert.ok(patch.id.startsWith("patch-"));
  assert.equal(patch.sourceMode, "MOCK_SIMULATED");
  assert.ok(patch.reasoningSteps.length > 0);
  assert.ok(patch.repairedCode.includes("process.env.API_CREDENTIAL"));
  assert.ok(patch.repairedCode.includes("$json."));
  assert.ok(patch.confidenceScore > 0.9);
});
