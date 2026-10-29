import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NebiusClient } from "../lib/nebius-client.js";

test("NebiusClient initializes in mock simulation mode when no API key is provided", async () => {
  const client = new NebiusClient({
    mockMode: true,
    model: "nvidia/nemotron-3-super-120b",
  });

  assert.equal(client.isMock(), true);
  assert.equal(client.getModelName(), "nvidia/nemotron-3-super-120b");

  const conn = await client.testConnection();
  assert.equal(conn.connected, false); // health status does not claim verified connection without transport
  assert.equal(conn.configured, true);
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
  assert.ok((patch.confidenceScore ?? 0) > 0.9);
});

test("Cause C Acceptance: main client does not claim requested model as observed model when metadata is absent", async () => {
  const saved = JSON.parse(fs.readFileSync("docs/live-proof-20261028/MODEL_RESPONSE_1.json", "utf8"));
  const noMetadata = { choices: [{ finish_reason: "stop", message: { content: saved.content } }], usage: saved.usage };
  const client = new NebiusClient({ mockMode: false, apiKey: "OFFLINE_DEMO_ONLY", baseURL: "https://offline.invalid/v1/" });
  (client as any).openai = {
    chat: {
      completions: {
        create: async () => noMetadata,
      },
    },
  };
  const patch = await client.generatePatch({ code: 'const source = "DEMO_ONLY";', issues: [] });
  assert.ok(!patch.modelUsed || patch.modelUsed === "UNKNOWN" || (patch as any).providerModelVerified === false);
});

