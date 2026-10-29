import test from "node:test";
import assert from "node:assert/strict";
import { createFixtureVerifier } from "../lib/fixture-verifier.js";
import { SelfHealingOrchestrator } from "../lib/self-healing-orchestrator.js";
import { NebiusClient } from "../lib/nebius-client.js";

test("FixtureVerifier: REJECTS patch with TypeScript semantic type error (TS2322)", async () => {
  const verifier = createFixtureVerifier("data_transform.ts");

  // Type error: assigning string literal to number variable
  const typeErrorPatch = `
const amount: number = "wrong-type";
export function transformPayload() {
  return amount;
}
`;

  const result = await verifier(typeErrorPatch);
  assert.equal(result.passed, false);
  assert.equal(result.phase, "TYPECHECK");
  assert.ok(result.output.includes("TS2322"));
  assert.ok(result.output.includes("Type 'string' is not assignable to type 'number'"));
  assert.equal(result.details?.typecheckPassed, false);
  assert.equal(result.details?.runtimeExecution, "NOT_VERIFIED");
});

test("R1 Regression: FixtureVerifier REJECTS same type error when caller provides .d.ts or internal names", async () => {
  const badType = `
const amount: number = "wrong-type";
export function transformPayload() {
  return amount;
}
`;

  // Test caller-provided .d.ts filename (must NOT bypass typecheck via skipLibCheck)
  const dtsVerifier = createFixtureVerifier("data_transform.d.ts");
  const dtsResult = await dtsVerifier(badType);
  assert.equal(dtsResult.passed, false);
  assert.equal(dtsResult.phase, "TYPECHECK");
  assert.ok(dtsResult.output.includes("TS2322"));
  assert.equal(dtsResult.details?.typecheckPassed, false);

  // Test internal name collision avoidance (e.g. ambient.d.ts)
  const ambientVerifier = createFixtureVerifier("ambient.d.ts");
  const ambientResult = await ambientVerifier(badType);
  assert.equal(ambientResult.passed, false);
  assert.equal(ambientResult.phase, "TYPECHECK");
  assert.ok(ambientResult.output.includes("TS2322"));
});

test("FixtureVerifier: REJECTS patch when critical security violation persists", async () => {
  const verifier = createFixtureVerifier("payment_webhook.ts");

  // Code still contains hardcoded secret
  const insecurePatch = `
const STRIPE_SECRET = "sk-live_999999999999999999999999";

export async function handlePayment(event: any) {
  return { status: "processed", email: "test@example.com" };
}
`;

  const result = await verifier(insecurePatch);
  assert.equal(result.passed, false);
  assert.equal(result.phase, "STATIC_RULES");
  assert.ok(result.output.includes("Static invariant failed"));
  assert.equal(result.details?.staticPassed, false);
});

test("FixtureVerifier: REJECTS patch with syntax errors", async () => {
  const verifier = createFixtureVerifier("payment_webhook.ts");

  // Code has invalid TypeScript syntax (unclosed function bracket)
  const syntaxErrorPatch = `
const API = process.env.KEY;
export async function handlePayment(event: any {
  return { status: "processed" };
`;

  const result = await verifier(syntaxErrorPatch);
  assert.equal(result.passed, false);
  assert.equal(result.phase, "TYPECHECK");
  assert.ok(result.output.includes("TS1005") || result.output.includes("TypeScript semantic check failed"));
  assert.equal(result.details?.typecheckPassed, false);
});

test("FixtureVerifier: QUARANTINES runtime execution and does NOT execute untrusted code in host process", async () => {
  const verifier = createFixtureVerifier("payment_webhook.ts");

  // Host access attempt via process.versions: caught by TypeScript semantic diagnostics
  const untrustedPayload = `
const hostAvailable = typeof (process as any) !== "undefined";
export async function handlePayment(event: any) {
  if (!hostAvailable) throw new Error("Host capability not available");
  return { status: "processed" };
}
`;

  const result = await verifier(untrustedPayload);
  // Code must never execute in host process; runtime execution is safely reported as NOT_VERIFIED
  assert.equal(result.details?.runtimeExecution, "NOT_VERIFIED");
  assert.equal(result.details?.businessContract, "NOT_VERIFIED");
  assert.ok(result.output.includes("Runtime business execution NOT_VERIFIED"));
});

test("SelfHealingOrchestrator: REJECTS patch that degrades compliance score (90 -> 80) and preserves previous code without replacement", async () => {
  // Client test double proposing a patch with 2 violations (score 80) for a source with 1 violation (score 90)
  const client: any = {
    generatePatch: async () => ({
      id: "review-regression-patch",
      timestamp: new Date().toISOString(),
      modelUsed: "controlled-test-double",
      sourceMode: "MOCK_SIMULATED",
      reasoningSteps: [],
      explanation: "Testing regression rejection",
      diff: "",
      fixedIssueIds: [],
      confidenceScore: 1,
      repairedCode: "const first = json.one;\nconst second = json.two;",
    }),
  };

  const orchestrator = new SelfHealingOrchestrator({ client, maxIterations: 2 });
  const initialCode = "const only = json.one;";
  const session = await orchestrator.executeHealingLoop(initialCode, "arbitrary.ts");

  // The orchestrator must refuse the score degradation from 90 to 80
  assert.equal(session.status, "CIRCUIT_BREAKER_TRIGGERED");
  assert.equal(session.currentCode, initialCode); // Code must NOT be replaced
  assert.equal(session.finalReport?.score, 90); // Original score preserved
  assert.equal(session.steps[0].testResults?.passed, false);
  assert.ok(session.steps[0].testResults?.output.includes("Regression detected: compliance score degraded from 90 to 80"));
});

test("SelfHealingOrchestrator: Circuit breaker halts after max attempts when verifier continually rejects", async () => {
  const client = new NebiusClient({ mockMode: true });

  // Custom strict verifier that rejects every patch attempt
  let attempts = 0;
  const failingVerifier = async () => {
    attempts++;
    return { passed: false, output: "Intentionally failed by strict business verifier" };
  };

  const orchestrator = new SelfHealingOrchestrator({
    client,
    maxIterations: 3,
    testVerifier: failingVerifier,
  });

  const buggyCode = 'const secret = "sk-1234567890abcdef1234567890";';
  const session = await orchestrator.executeHealingLoop(buggyCode, "payment_webhook.ts");

  assert.equal(session.status, "CIRCUIT_BREAKER_TRIGGERED");
  assert.equal(session.currentIteration, 3);
  assert.equal(attempts, 3);
  assert.ok(session.steps.every((s) => s.testResults?.passed === false));
});

test("FixtureVerifier & Orchestrator: PASSES when compliant patch satisfies static invariants and TypeScript semantic check (runtime NOT_VERIFIED)", async () => {
  const verifier = createFixtureVerifier("payment_webhook.ts");

  const compliantPatch = `
import { dispatchSlackAlert } from "./notifier";

const STRIPE_SECRET = process.env.API_CREDENTIAL || "";

export async function handlePayment(event: any) {
  const amount = event.data?.amount || 0;
  const customerEmail = $json?.customer?.email || "customer@example.com";

  if (amount > 10000) {
    if (await verifyHumanApproval(event)) {
      await dispatchSlackAlert({
        channel: "#high-value-transactions",
        text: "Approved high payment: " + amount,
      });
    }
  }

  return { status: "processed", email: customerEmail };
}
`;

  const result = await verifier(compliantPatch);
  assert.equal(result.passed, true);
  assert.equal(result.details?.staticPassed, true);
  assert.equal(result.details?.typecheckPassed, true);
  assert.equal(result.details?.runtimeExecution, "NOT_VERIFIED");
  assert.ok(result.output.includes("Runtime business execution NOT_VERIFIED"));
});
