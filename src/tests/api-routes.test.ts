import test from "node:test";
import assert from "node:assert/strict";
import { GET as getHealth } from "../app/api/nebius/health/route.js";
import { GET as getBenchmark } from "../app/api/benchmark/route.js";
import { POST as postAnalyze } from "../app/api/analyze/route.js";
import { POST as postHeal } from "../app/api/heal/route.js";

test("API: GET /api/nebius/health returns connectivity data", async () => {
  const res = await getHealth();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.connected, false); // health probe does not claim verified connection without transport
  assert.equal(data.data.configured, true);
  assert.ok(data.data.model.includes("nemotron"));
  assert.ok(["LIVE_NEBIUS", "MOCK_SIMULATED"].includes(data.data.mode));
});

test("API: GET /api/benchmark returns unmeasured architectural comparison without fabricated metrics", async () => {
  const res = await getBenchmark();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.measured, false);
  assert.equal(data.data.status, "UNMEASURED");
  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes("4.1x"), false);
  assert.equal(serialized.includes("8.3x"), false);
  assert.equal(serialized.includes("100.0%"), false);
  assert.ok(data.data.description.includes("unmeasured"));
});

test("API: POST /api/analyze validates payload and returns audit report", async () => {
  // 1. Missing code returns 400
  const reqEmpty = new Request("http://localhost:3005/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const resEmpty = await postAnalyze(reqEmpty);
  assert.equal(resEmpty.status, 400);

  // 2. Valid code returns 200 with report
  const reqValid = new Request("http://localhost:3005/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "const key = 'sk-1234567890abcdef1234567890';",
      filename: "test.ts",
    }),
  });
  const resValid = await postAnalyze(reqValid);
  assert.equal(resValid.status, 200);
  const data = await resValid.json();
  assert.equal(data.success, true);
  assert.equal(data.data.passed, false);
  assert.equal(data.data.metrics.criticalCount, 1);
});

test("API: POST /api/heal executes healing loop and returns session", async () => {
  // 1. Missing code returns 400
  const reqEmpty = new Request("http://localhost:3005/api/heal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const resEmpty = await postHeal(reqEmpty);
  assert.equal(resEmpty.status, 400);

  // 2. Vulnerable code returns 200 with healed session
  const reqValid = new Request("http://localhost:3005/api/heal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "const key = 'sk-1234567890abcdef1234567890';",
      filename: "test.ts",
    }),
  });
  const resValid = await postHeal(reqValid);
  assert.equal(resValid.status, 200);
  const data = await resValid.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status, "SUCCESS");
  assert.ok(data.data.currentCode.includes("process.env.API_CREDENTIAL"));
});
