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
  assert.equal(data.data.connected, true);
  assert.ok(data.data.model.includes("nemotron"));
  assert.ok(["LIVE_NEBIUS", "MOCK_SIMULATED"].includes(data.data.mode));
});

test("API: GET /api/benchmark returns 5 comparative benchmarks", async () => {
  const res = await getBenchmark();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data.metrics));
  assert.equal(data.data.metrics.length, 5);
  assert.ok(data.data.metrics.some((m: any) => m.delta.includes("4.1x Faster")));
  assert.ok(data.data.metrics.some((m: any) => m.delta.includes("8.3x Cheaper")));
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
