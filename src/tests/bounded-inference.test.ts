import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executeBoundedInference, BoundedInferenceBudget } from "../lib/bounded-inference";
import { NebiusClient } from "../lib/nebius-client";

test("executeBoundedInference: requests carry max_tokens: 4000 and zero SDK retries configured", async () => {
  let capturedRequest: any = null;
  const mockSdk: any = {
    maxRetries: 0,
    chat: {
      completions: {
        create: async (req: any) => {
          capturedRequest = req;
          return {
            id: "chatcmpl-test-1",
            model: "nvidia/nemotron-3-super-120b-a12b",
            choices: [{ message: { content: "{\"repairedCode\":\"fixed\"}" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          };
        },
      },
    },
  };

  const budget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 0 };
  const result = await executeBoundedInference({
    client: mockSdk,
    model: "nvidia/nemotron-3-super-120b-a12b",
    messages: [{ role: "user", content: "test" }],
    budget,
  });

  assert.equal(capturedRequest.max_tokens, 4000);
  assert.equal(result.id, "chatcmpl-test-1");
  assert.equal(result.model, "nvidia/nemotron-3-super-120b-a12b");
  assert.equal(budget.requestsUsed, 1);
});

test("executeBoundedInference: oversized payload (> 8192 bytes) is rejected before transport", async () => {
  let transportReached = false;
  const mockSdk: any = {
    chat: {
      completions: {
        create: async () => {
          transportReached = true;
          return {};
        },
      },
    },
  };

  const oversized = "a".repeat(9000);
  const budget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 0 };

  await assert.rejects(
    async () => {
      await executeBoundedInference({
        client: mockSdk,
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [{ role: "user", content: oversized }],
        budget,
      });
    },
    /exceeds limit|payload/i
  );

  assert.equal(transportReached, false);
  assert.equal(budget.requestsUsed, 0);
});

test("executeBoundedInference: exhausted request budget is rejected before transport", async () => {
  let transportReached = false;
  const mockSdk: any = {
    chat: {
      completions: {
        create: async () => {
          transportReached = true;
          return {};
        },
      },
    },
  };

  const budget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 2 };

  await assert.rejects(
    async () => {
      await executeBoundedInference({
        client: mockSdk,
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [{ role: "user", content: "hello" }],
        budget,
      });
    },
    /budget exhausted/i
  );

  assert.equal(transportReached, false);
});

test("executeBoundedInference: provider failure remains an explicit failure without mock fallback", async () => {
  const mockSdk: any = {
    chat: {
      completions: {
        create: async () => {
          throw new Error("PROVIDER_DOWN_503");
        },
      },
    },
  };

  const budget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 0 };

  await assert.rejects(
    async () => {
      await executeBoundedInference({
        client: mockSdk,
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [{ role: "user", content: "repair" }],
        budget,
      });
    },
    /PROVIDER_DOWN_503/
  );
});

test("NebiusClient: testConnection makes zero completion requests", async () => {
  let completionCalled = false;
  const client = new NebiusClient({
    mockMode: false,
    apiKey: "DUMMY_KEY_FOR_TEST",
    baseURL: "https://api.tokenfactory.nebius.com/v1/",
    model: "nvidia/nemotron-3-super-120b-a12b",
  });

  // Spy on internal openai client if initialized
  if ((client as any).openai) {
    (client as any).openai.chat.completions.create = async () => {
      completionCalled = true;
      throw new Error("SHOULD_NOT_BE_CALLED");
    };
  }

  const health = await client.testConnection();
  assert.equal(completionCalled, false);
  assert.equal(health.connected, false); // health status does not claim verified connection without transport
  assert.equal(health.configured, true);
  assert.equal(health.mode, "LIVE_NEBIUS");
});

test("R4 Acceptance: absent provider confidence stays unknown and is not fabricated", async () => {
  const savedPath = path.resolve("docs/live-proof-20261028/MODEL_RESPONSE_1.json");
  const saved = JSON.parse(fs.readFileSync(savedPath, "utf-8"));

  const client = new NebiusClient({
    mockMode: false,
    apiKey: "OFFLINE_KEY",
    baseURL: "https://api.tokenfactory.nebius.com/v1/",
    model: saved.model,
  });

  (client as any).openai = {
    maxRetries: 0,
    chat: {
      completions: {
        create: async () => ({
          id: saved.id,
          model: saved.model,
          usage: saved.usage,
          choices: [{ finish_reason: "stop", message: { content: saved.content } }],
        }),
      },
    },
  };

  const patch = await client.generatePatch({
    code: "export async function run(event: any) { return event; }",
    issues: [],
  });

  assert.ok(patch.confidenceScore === undefined || patch.confidenceScore === null);
});

test("R4 Acceptance: missing provider model and ID are not fabricated", async () => {
  const primary = "nvidia/nemotron-3-super-120b-a12b";
  const mockSdk: any = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify({ repairedCode: "const a = 1;" }) },
            },
          ],
        }),
      },
    },
  };

  const budget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 0 };
  const metadataResult = await executeBoundedInference({
    client: mockSdk,
    model: primary,
    messages: [{ role: "user", content: "Offline demo" }],
    budget,
  });

  assert.notEqual(metadataResult.id, "unknown-id");
  assert.notEqual(metadataResult.model, primary);
  assert.equal(metadataResult.id, undefined);
  assert.equal(metadataResult.model, undefined);
});


test("NebiusClient: replaying saved live response preserves exact model, response ID and tokens usage without inventing reasoningSteps", async () => {
  const savedPath = path.resolve("docs/live-proof-20261028/MODEL_RESPONSE_1.json");
  const saved = JSON.parse(fs.readFileSync(savedPath, "utf-8"));

  const client = new NebiusClient({
    mockMode: false,
    apiKey: "OFFLINE_KEY",
    baseURL: "https://api.tokenfactory.nebius.com/v1/",
    model: saved.model,
  });

  // Inject transport stub returning the exact saved model response
  (client as any).openai = {
    maxRetries: 0,
    chat: {
      completions: {
        create: async () => ({
          id: saved.id,
          model: saved.model,
          usage: saved.usage,
          choices: [{ finish_reason: "stop", message: { content: saved.content } }],
        }),
      },
    },
  };

  const patch = await client.generatePatch({
    code: "const STRIPE_SECRET = 'DEMO_ONLY_NOT_A_REAL_CREDENTIAL';",
    issues: [],
  });

  assert.equal(patch.sourceMode, "LIVE_NEBIUS");
  assert.equal(patch.providerResponseId, saved.id);
  assert.equal(patch.modelUsed, saved.model);
  assert.deepEqual(patch.tokenUsage, {
    promptTokens: saved.usage.prompt_tokens,
    completionTokens: saved.usage.completion_tokens,
    totalTokens: saved.usage.total_tokens,
  });
  // Must NOT invent fake reasoningSteps when the model did not provide them in saved.content
  assert.deepEqual(patch.reasoningSteps, []);
});

test("NebiusClient: live failure throws explicit error rather than silently returning mock patch", async () => {
  const client = new NebiusClient({
    mockMode: false,
    apiKey: "OFFLINE_KEY",
    baseURL: "https://api.tokenfactory.nebius.com/v1/",
    model: "nvidia/nemotron-3-super-120b-a12b",
  });

  (client as any).openai = {
    maxRetries: 0,
    chat: {
      completions: {
        create: async () => {
          throw new Error("NEBIUS_LIVE_NETWORK_TIMEOUT");
        },
      },
    },
  };

  await assert.rejects(
    async () => {
      await client.generatePatch({
        code: "const STRIPE_SECRET = 'DEMO';",
        issues: [],
      });
    },
    /NEBIUS_LIVE_NETWORK_TIMEOUT/
  );
});
