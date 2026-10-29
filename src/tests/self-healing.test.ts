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

test("SelfHealingOrchestrator rejects blank patch proposal and preserves original code", async () => {
  const blankClient = {
    generatePatch: async () => ({
      id: "stub-blank",
      timestamp: new Date().toISOString(),
      modelUsed: "STUB",
      reasoningSteps: ["Empty"],
      explanation: "Empty stub",
      diff: "",
      repairedCode: "",
      fixedIssueIds: [],
      confidenceScore: 0.1,
      sourceMode: "MOCK_SIMULATED" as const,
    }),
  } as any;

  const originalCode = `export async function handlePayment(event: any) {\n  const secret = "sk-123456789012345678901234";\n  return event;\n}`;
  const orchestrator = new SelfHealingOrchestrator({ client: blankClient, maxIterations: 1 });
  const session = await orchestrator.executeHealingLoop(originalCode, "payment_webhook.ts");

  assert.notEqual(session.status, "SUCCESS");
  assert.equal(session.currentCode, originalCode); // original code preserved!
  assert.equal(session.steps[0].testResults?.passed, false);
});

test("SelfHealingOrchestrator rejects patch that deletes exported handlePayment", async () => {
  const deleteClient = {
    generatePatch: async () => ({
      id: "stub-deleted-export",
      timestamp: new Date().toISOString(),
      modelUsed: "STUB",
      reasoningSteps: ["Deleted export"],
      explanation: "Deleted export stub",
      diff: "",
      repairedCode: `const secret = process.env.API_CREDENTIAL ?? "";`,
      fixedIssueIds: [],
      confidenceScore: 0.1,
      sourceMode: "MOCK_SIMULATED" as const,
    }),
  } as any;

  const originalCode = `export async function handlePayment(event: any) {\n  const secret = "sk-123456789012345678901234";\n  return event;\n}`;
  const orchestrator = new SelfHealingOrchestrator({ client: deleteClient, maxIterations: 1 });
  const session = await orchestrator.executeHealingLoop(originalCode, "payment_webhook.ts");

  assert.notEqual(session.status, "SUCCESS");
  assert.equal(session.currentCode, originalCode);
  assert.equal(session.steps[0].testResults?.passed, false);
});

test("SelfHealingOrchestrator: remaining SYN-001 cannot yield SUCCESS, yields PARTIAL", async () => {
  const unchangedExpression = "export const amount = json.amount;";
  const stubClient = {
    generatePatch: async () => ({
      id: "stub-partial",
      timestamp: new Date().toISOString(),
      modelUsed: "STUB",
      reasoningSteps: ["Unresolved expression"],
      explanation: "Unresolved",
      diff: "",
      repairedCode: unchangedExpression,
      fixedIssueIds: [],
      confidenceScore: 0.5,
      sourceMode: "MOCK_SIMULATED" as const,
    }),
  } as any;

  const orchestrator = new SelfHealingOrchestrator({ client: stubClient, maxIterations: 1 });
  const session = await orchestrator.executeHealingLoop(unchangedExpression, "pipeline.ts");

  assert.equal(session.status, "PARTIAL");
  assert.equal(session.finalReport?.issues.length, 1);
});

test("R1 Acceptance: session shares single budget of 2 requests across full healing loop", async () => {
  let completionCalls = 0;
  const primary = "nvidia/nemotron-3-super-120b-a12b";
  const fallback = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
  const budgetClient = new NebiusClient({
    mockMode: false,
    apiKey: "OFFLINE_DEMO_ONLY",
    baseURL: "https://offline.invalid/v1/",
    model: primary,
    fallbackModel: fallback,
  });

  (budgetClient.openai as any).chat.completions.create = (async (request: any) => {
    completionCalls++;
    if (request.model === primary) {
      throw new Error("OFFLINE_PRIMARY_UNAVAILABLE");
    }
    return {
      id: "offline-resp",
      model: request.model,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              repairedCode: `export async function run(event: any) { const apiKey = process.env.API_CREDENTIAL; return event; }`,
              explanation: "Repaired",
              diff: "",
            }),
          },
        },
      ],
    };
  }) as any;

  const originalCode = `export async function run(event: any) { const apiKey = "DEMO_NOT_A_REAL_KEY"; return event; }`;
  const orchestrator = new SelfHealingOrchestrator({
    client: budgetClient,
    maxIterations: 3,
    testVerifier: async () => ({
      passed: false,
      output: "Offline verification failure exercises the session budget",
    }),
  });

  const session = await orchestrator.executeHealingLoop(originalCode);

  assert.ok(completionCalls <= 2, `completionCalls must be <= 2, got ${completionCalls}`);
  assert.equal(session.currentCode, originalCode); // preserved original code
  assert.ok(session.status === "CIRCUIT_BREAKER_TRIGGERED" || session.status === "FAILED");
});

test("Cause A Acceptance: orchestrator healing loop rejects always-true approval guard", async () => {
  const badGuard = 'export async function send(event: any) { if ((await verifyHumanApproval(event)) || true) { await dispatchSlackAlert({text: "Demo"}); } }';
  const originalGuard = 'export async function send(event: any) { await dispatchSlackAlert({text: "Demo"}); }';
  const proposal = (code: string) => ({
    id: "offline-proposal",
    timestamp: new Date().toISOString(),
    modelUsed: "OFFLINE_STUB",
    reasoningSteps: [],
    explanation: "Offline test",
    diff: "",
    repairedCode: code,
    fixedIssueIds: [],
    sourceMode: "MOCK_SIMULATED" as const,
  });

  const orchestrator = new SelfHealingOrchestrator({
    client: { generatePatch: async () => proposal(badGuard) } as any,
    maxIterations: 1,
  });
  const guardSession = await orchestrator.executeHealingLoop(originalGuard);
  assert.notEqual(guardSession.status, "SUCCESS");
});

test("Cause B Acceptance: orchestrator healing loop preserves public parameter contract when candidate drops type annotation", async () => {
  const original = 'export function run(event: number = 0) { const apiKey = "DEMO_ONLY_NOT_A_REAL_CREDENTIAL"; return event; }';
  const changed = 'export function run(event = "changed") { const apiKey = process.env.API_CREDENTIAL; return event; }';
  const proposal = (code: string) => ({
    id: "offline-proposal",
    timestamp: new Date().toISOString(),
    modelUsed: "OFFLINE_STUB",
    reasoningSteps: [],
    explanation: "Offline test",
    diff: "",
    repairedCode: code,
    fixedIssueIds: [],
    sourceMode: "MOCK_SIMULATED" as const,
  });

  const orchestrator = new SelfHealingOrchestrator({
    client: { generatePatch: async () => proposal(changed) } as any,
    maxIterations: 1,
  });
  const session = await orchestrator.executeHealingLoop(original);
  assert.notEqual(session.status, "SUCCESS");
  assert.equal(session.currentCode, original);
});



