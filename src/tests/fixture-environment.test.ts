import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CodeAnalyzer } from "../lib/code-analyzer.js";
import { createFixtureVerifier } from "../lib/fixture-verifier.js";
import { NebiusClient } from "../lib/nebius-client.js";
import { WORKSPACE_SAMPLES } from "../lib/workspace-samples.js";

test("The shipped clean workflow passes the same verifier used for repair proposals", async () => {
  const code = readFileSync("samples/clean_workflow.ts", "utf8");
  const result = await createFixtureVerifier("clean_workflow.ts")(code);
  assert.equal(result.passed, true, result.output);
  assert.equal(result.details.staticScore, 100);
  assert.equal(result.details.typecheckPassed, true);
  assert.equal(result.details.runtimeExecution, "NOT_VERIFIED");
});

test("Live repair requests describe the fixture helpers required to typecheck the complete payment example", async () => {
  // Only the external transport is replaced: prompt creation, bounded inference,
  // proposal parsing, static analysis and semantic verification are real.
  const client = new NebiusClient({ mockMode: false, apiKey: "OFFLINE_CONTRACT_FIXTURE", baseURL: "https://offline.invalid/v1/" });
  const code = WORKSPACE_SAMPLES[0].code;
  const report = CodeAnalyzer.analyze(code, "payment_webhook.ts");
  const repairedCode = readFileSync("samples/clean_workflow.ts", "utf8");
  let systemMessage = "";
  (client as any).openai = {
    chat: { completions: { create: async (request: any) => {
      systemMessage = request.messages.find((message: any) => message.role === "system").content;
      return {
        id: "offline-fixture-contract-response", object: "chat.completion", created: 0,
        model: "nvidia/nemotron-3-super-120b-a12b",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({
          reasoningSteps: ["Controlled offline contract fixture"], explanation: "Fixture environment compatibility",
          diff: "", repairedCode, fixedIssueIds: report.issues.map(issue => issue.id), confidenceScore: 1,
        }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    } } },
  };
  const patch = await client.generatePatch({ code, issues: report.issues });
  assert.match(systemMessage, /verifyHumanApproval\(event\??:\s*any\):\s*Promise<boolean>/);
  assert.match(systemMessage, /\$json/);
  assert.match(systemMessage, /process\.env/);
  assert.match(systemMessage, /\.\/notifier/);
  const verification = await createFixtureVerifier("payment_webhook.ts")(patch.repairedCode);
  assert.equal(verification.passed, true, verification.output);
  assert.equal(verification.details.staticScore, 100);
  assert.equal(verification.details.runtimeExecution, "NOT_VERIFIED");
});
