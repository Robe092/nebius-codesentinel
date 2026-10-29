import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  validateModelResponse,
  runLiveVerification,
} from "../../scripts/verify-nebius-live.js";

test("Probe import from a test filename never starts CLI requests or writes a report", (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-import-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const entry = path.resolve("scripts/verify-nebius-live.ts");
  const code = `
    import OpenAI from "openai";
    import fs from "node:fs";
    let calls = 0;
    OpenAI.prototype.makeRequest = () => { throw new Error("NETWORK_DISABLED_BY_TEST"); };
    OpenAI.prototype.post = async () => { calls++; throw new Error("UNEXPECTED_IMPORT_REQUEST"); };
    process.argv[1] = ${JSON.stringify(path.resolve("src/tests/verify-nebius-live.test.ts"))};
    await import(${JSON.stringify(pathToFileURL(entry).href)});
    await new Promise(setImmediate);
    console.log(JSON.stringify({ calls, reportCreated: fs.existsSync(${JSON.stringify(path.join(outputDir, "LIVE_NEBIUS_PROBE.json"))}) }));
    process.exitCode = 0;
  `;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      MOCK_MODE: "true",
      NEBIUS_API_KEY: "offline-test-key-never-sent",
      NEBIUS_BASE_URL: "https://review.invalid/v1/",
      HANDOFF_DIR: outputDir,
    },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr);
  const observation = JSON.parse(child.stdout.trim().split("\n").at(-1)!);
  assert.deepEqual(observation, { calls: 0, reportCreated: false });
});

test("Explicit probe CLI without a key writes BLOCKED with zero attempts", (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-cli-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const child = spawnSync(process.execPath, ["--import", "tsx", path.resolve("scripts/verify-nebius-live.ts")], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH, NODE_ENV: "test", NEBIUS_API_KEY: "your_nebius_api_key_here", HANDOFF_DIR: outputDir },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(outputDir, "LIVE_NEBIUS_PROBE.json"), "utf8"));
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.totalAttempts, 0);
});

test("A failed library probe returns FAIL without changing the caller exit status", async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-library-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const previousExitCode = process.exitCode;
  try {
    const client: any = { chat: { completions: { create: async () => { throw new Error("Offline failure"); } } } };
    const result = await runLiveVerification({ client, apiKey: "offline-key", outputDir });
    assert.equal(result.status, "FAIL");
    assert.equal(result.totalAttempts, 2);
    assert.equal(process.exitCode, previousExitCode);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test("R2 Offline: validateModelResponse REJECTS non-JSON model response", () => {
  const badResponse = {
    id: "resp-1",
    model: "nvidia/nemotron-3-super-120b",
    choices: [{ index: 0, message: { content: "Hello, I cannot produce a patch." } }],
  };
  assert.throws(
    () => validateModelResponse(badResponse),
    /Model response content is not valid JSON/
  );
});

test("R2 Offline: validateModelResponse REJECTS unchanged plaintext secret", () => {
  const unchangedSecretResponse = {
    id: "resp-2",
    model: "nvidia/nemotron-3-super-120b",
    choices: [
      {
        index: 0,
        message: {
          content: JSON.stringify({
            repairedCode:
              'const STRIPE_SECRET = "sk-live_98372498237498237498234";\nexport async function handlePayment() { return { status: "processed" }; }',
            explanation: "Did not fix secret",
          }),
        },
      },
    ],
  };
  assert.throws(
    () => validateModelResponse(unchangedSecretResponse),
    /still contains the plaintext credential/
  );
});

test("R2 Offline: validateModelResponse REJECTS empty or missing repairedCode", () => {
  const emptyCodeResponse = {
    id: "resp-3",
    model: "nvidia/nemotron-3-super-120b",
    choices: [
      {
        index: 0,
        message: {
          content: JSON.stringify({
            repairedCode: "   ",
            explanation: "Deleted code",
          }),
        },
      },
    ],
  };
  assert.throws(
    () => validateModelResponse(emptyCodeResponse),
    /Missing or empty 'repairedCode'/
  );
});

test("R2 Offline: validateModelResponse REJECTS unexpected model family", () => {
  const unexpectedModelResponse = {
    id: "resp-4",
    model: "other-provider/unexpected-model",
    choices: [
      {
        index: 0,
        message: {
          content: JSON.stringify({
            repairedCode:
              'const API = process.env.API_CREDENTIAL || "";\nexport async function handlePayment() { return { status: "processed" }; }',
            explanation: "Valid repair",
          }),
        },
      },
    ],
  };
  assert.throws(
    () => validateModelResponse(unexpectedModelResponse),
    /Unexpected model family returned/
  );
});

test("R2 Offline: validateModelResponse REJECTS missing model property", () => {
  const missingModelResponse = {
    id: "resp-5",
    choices: [
      {
        index: 0,
        message: {
          content: JSON.stringify({
            repairedCode:
              'const API = process.env.API_CREDENTIAL || "";\nexport async function handlePayment() { return { status: "processed" }; }',
            explanation: "Valid repair",
          }),
        },
      },
    ],
  };
  assert.throws(
    () => validateModelResponse(missingModelResponse),
    /Missing or invalid model provenance/
  );
});

test("R2 Offline: validateModelResponse REJECTS repaired code with TypeScript semantic error", () => {
  const typeErrorResponse = {
    id: "resp-6",
    model: "nvidia/nemotron-3-super-120b",
    choices: [
      {
        index: 0,
        message: {
          content: JSON.stringify({
            repairedCode:
              'const amount: number = "wrong-type";\nconst API = process.env.API_CREDENTIAL || "";\nexport async function handlePayment() { return { status: "processed", amount }; }',
            explanation: "Contains TS2322 error",
          }),
        },
      },
    ],
  };
  assert.throws(
    () => validateModelResponse(typeErrorResponse),
    /failed TypeScript semantic check.*TS2322/
  );
});

test("R2 Offline: validateModelResponse ACCEPTS compliant repair with verified model and typescript diagnostics", () => {
  const validResponse = {
    id: "resp-valid",
    model: "nvidia/nemotron-3-super-120b",
    usage: { prompt_tokens: 150, completion_tokens: 80, total_tokens: 230 },
    choices: [
      {
        index: 0,
        message: {
          content: JSON.stringify({
            repairedCode: `import { dispatchSlackAlert } from "./notifier";
const STRIPE_SECRET = process.env.API_CREDENTIAL || "";
export async function handlePayment(event: any) {
  return { status: "processed", email: event.customer?.email };
}
`,
            explanation: "Extracted credential to process.env.API_CREDENTIAL",
          }),
        },
      },
    ],
  };

  const result = validateModelResponse(validResponse);
  assert.equal(result.actualModelUsed, "nvidia/nemotron-3-super-120b");
  assert.equal(result.responseId, "resp-valid");
  assert.ok(result.repairedCode.includes("process.env.API_CREDENTIAL"));
  assert.equal(typeof result.tokensUsage, "object");
  if (typeof result.tokensUsage === "object") {
    assert.equal(result.tokensUsage.totalTokens, 230);
  }
});

test("R2 Offline: runLiveVerification counts primary & fallback attempts accurately on offline stub", async () => {
  let callCount = 0;
  const mockClient: any = {
    chat: {
      completions: {
        create: async ({ model }: any) => {
          callCount++;
          if (callCount === 1) {
            // First call (primary) throws a network timeout simulation
            throw new Error("Simulated primary model timeout");
          }
          // Second call (fallback) succeeds with valid Nemotron response
          return {
            id: "fallback-resp-1",
            model: "nvidia/Llama-3.1-Nemotron-70B-Instruct",
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            choices: [
              {
                index: 0,
                message: {
                  content: JSON.stringify({
                    repairedCode: `const STRIPE_SECRET = process.env.API_CREDENTIAL || "";
export async function handlePayment(event: any) {
  return { status: "processed", email: event.customer?.email };
}
`,
                    explanation: "Fallback repair",
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const result = await runLiveVerification({
    client: mockClient,
    apiKey: "test-offline-key",
    outputDir: "node_modules/.cache/test-stub-probe",
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.primaryAttempts, 1);
  assert.equal(result.fallbackAttempts, 1);
  assert.equal(result.totalAttempts, 2);
  assert.equal(result.actualModelUsed, "nvidia/Llama-3.1-Nemotron-70B-Instruct");
  assert.equal(result.repairVerified, true);
});

const controlledHandler = `export async function handlePayment(event: any) {
  return { status: "processed", email: event.customer?.email };
}`;
const validControlledRepair = `const STRIPE_SECRET = process.env.API_CREDENTIAL || "";\n${controlledHandler}`;
const invalidControlledRepairs = [
  { name: "deleted program with an environment comment", code: "// process.env\nexport const unrelated = 0;" },
  { name: "environment reference only inside a string", code: `const STRIPE_SECRET = "process.env";\n${controlledHandler}` },
  { name: "replacement hardcoded credential", code: `const STRIPE_SECRET = "replacement_credential_123456789";\nconst other = process.env.OTHER;\n${controlledHandler}` },
  { name: "credential read from the wrong environment variable", code: `const STRIPE_SECRET = process.env.OTHER;\n${controlledHandler}` },
  { name: "missing payment export", code: `const STRIPE_SECRET = process.env.API_CREDENTIAL;\nasync function handlePayment(event: any) { return event; }` },
  { name: "non-function payment export", code: `const STRIPE_SECRET = process.env.API_CREDENTIAL;\nexport const handlePayment = 123;` },
  { name: "shadowed process object", code: `const process = { env: { API_CREDENTIAL: "fake" } };\nconst STRIPE_SECRET = process.env.API_CREDENTIAL;\n${controlledHandler}` },
  { name: "default-only payment export", code: `const STRIPE_SECRET = process.env.API_CREDENTIAL;\nexport default async function handlePayment(event: any) { return event; }` },
  { name: "process namespace shadowing", code: `namespace process { export const env = { API_CREDENTIAL: "fake" }; }\nconst STRIPE_SECRET = process.env.API_CREDENTIAL;\n${controlledHandler}` },
  { name: "process enum shadowing through a type assertion", code: `enum process { env = "fake" }\nconst STRIPE_SECRET = (process as any).env.API_CREDENTIAL;\n${controlledHandler}` },
];

function offlineResponse(code: string, model = "nvidia/test-primary-nemotron", id = "offline-primary") {
  return {
    id, object: "chat.completion", created: 0, model,
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ repairedCode: code, explanation: "Controlled offline fixture", diff: "- hardcoded credential\n+ environment credential" }) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
  };
}

for (const fixture of invalidControlledRepairs) {
  test(`Controlled repair rejects ${fixture.name}`, () => {
    assert.throws(() => validateModelResponse(offlineResponse(fixture.code)));
  });
}

for (const initializer of ["process.env.API_CREDENTIAL", 'process.env["API_CREDENTIAL"] ?? ""']) {
  test(`Controlled repair accepts a real credential access: ${initializer}`, () => {
    const code = `const STRIPE_SECRET = ${initializer};\n${controlledHandler}`;
    assert.equal(validateModelResponse(offlineResponse(code)).repairedCode, code);
  });
}

for (const fixture of [invalidControlledRepairs[0], invalidControlledRepairs[2]]) {
  test(`Invalid primary ${fixture.name} is rejected before a valid fallback`, async (t) => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-primary-"));
    t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
    let attempts = 0;
    const client: any = { chat: { completions: { create: async () => {
      attempts++;
      return attempts === 1
        ? offlineResponse(fixture.code)
        : offlineResponse(validControlledRepair, "nvidia/test-fallback-nemotron", "offline-fallback");
    } } } };
    const result = await runLiveVerification({ client, apiKey: "offline-key", outputDir });
    assert.equal(result.status, "PASS");
    assert.equal(result.totalAttempts, 2);
    assert.equal(result.primaryAttempts, 1);
    assert.equal(result.fallbackAttempts, 1);
    assert.equal(result.actualModelUsed, "nvidia/test-fallback-nemotron");
    assert.equal(result.responseId, "offline-fallback");
  });

  test(`Invalid fallback ${fixture.name} never becomes a verified repair`, async (t) => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-fallback-"));
    t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
    let attempts = 0;
    const client: any = { chat: { completions: { create: async () => {
      if (++attempts === 1) throw new Error("Offline primary unavailable");
      return offlineResponse(fixture.code, "nvidia/test-fallback-nemotron", "offline-fallback");
    } } } };
    const result = await runLiveVerification({ client, apiKey: "offline-key", outputDir });
    assert.equal(result.status, "FAIL");
    assert.equal(result.repairVerified, false);
    assert.equal(result.totalAttempts, 2);
  });
}

test("Valid controlled primary repair succeeds without an unnecessary fallback", async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-valid-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const client: any = { chat: { completions: { create: async () => offlineResponse(validControlledRepair) } } };
  const result = await runLiveVerification({ client, apiKey: "offline-key", outputDir });
  assert.equal(result.status, "PASS");
  assert.equal(result.repairVerified, true);
  assert.equal(result.totalAttempts, 1);
  assert.equal(result.fallbackAttempts, 0);
});

test("R5 Acceptance: ENABLE_LIVE_REPAIR='false' gates live probe and makes zero transport calls", async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-r5-gate-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  const prevGate = process.env.ENABLE_LIVE_REPAIR;
  process.env.ENABLE_LIVE_REPAIR = "false";
  let transportCalls = 0;

  try {
    const stubClient: any = {
      chat: {
        completions: {
          create: async () => {
            transportCalls++;
            return {
              id: "offline-id",
              model: "nvidia/nemotron",
              choices: [{ finish_reason: "stop", message: { content: "{}" } }],
            };
          },
        },
      },
    };

    const probe = await runLiveVerification({
      apiKey: "OFFLINE_DEMO_KEY",
      outputDir,
      client: stubClient,
    });

    assert.equal(probe.status, "BLOCKED");
    assert.equal(transportCalls, 0);
  } finally {
    if (prevGate !== undefined) {
      process.env.ENABLE_LIVE_REPAIR = prevGate;
    } else {
      delete process.env.ENABLE_LIVE_REPAIR;
    }
  }
});

test("R5 Acceptance: live probe source code actually imports and uses shared executeBoundedInference", () => {
  const probeSource = fs.readFileSync(path.resolve("scripts/verify-nebius-live.ts"), "utf8");
  assert.ok(
    /import[\s\S]*?from\s+["'][^"']*bounded-inference/.test(probeSource),
    "scripts/verify-nebius-live.ts must import from bounded-inference"
  );
  assert.ok(
    /executeBoundedInference\(/.test(probeSource),
    "scripts/verify-nebius-live.ts must call executeBoundedInference()"
  );
});

test("Cause C Acceptance: live probe rejects absent provider ID and model on offline stub", async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-no-meta-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const saved = JSON.parse(fs.readFileSync("docs/live-proof-20261028/MODEL_RESPONSE_1.json", "utf8"));
  const noMetadata = { choices: [{ finish_reason: "stop", message: { content: saved.content } }], usage: saved.usage };
  const probe = await runLiveVerification({
    apiKey: "OFFLINE_DEMO_ONLY",
    enableLiveRepair: true,
    outputDir,
    client: {
      chat: {
        completions: {
          create: async () => noMetadata,
        },
      },
    },
  });
  assert.notEqual(probe.status, "PASS");
  assert.notEqual(probe.responseId, "response-live");
  assert.notEqual(probe.responseId, "response-fallback");
});


