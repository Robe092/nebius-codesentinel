import test from "node:test";
import assert from "node:assert/strict";
import { CodeAnalyzer } from "../lib/code-analyzer.js";

test("CodeAnalyzer flags hardcoded secrets with CRITICAL severity", () => {
  const code = `
const token = "sk-99887766554433221100aa";
console.log("ready");
`;
  const report = CodeAnalyzer.analyze(code);
  assert.equal(report.passed, false);
  assert.equal(report.metrics.criticalCount, 1);
  assert.equal(report.issues[0]?.category, "HARDCODED_SECRET");
});

test("CodeAnalyzer flags un-guarded direct communication dispatches", () => {
  const code = `
async function notify() {
  await slack.postMessage({ channel: "#alerts", text: "Production alarm" });
}
`;
  const report = CodeAnalyzer.analyze(code);
  assert.equal(report.passed, false);
  assert.equal(report.metrics.highCount, 1);
  assert.equal(report.issues[0]?.category, "FORBIDDEN_DIRECT_COMMUNICATION");
});

test("CodeAnalyzer flags invalid n8n expression syntax", () => {
  const code = `
const data = json.customerName;
`;
  const report = CodeAnalyzer.analyze(code);
  assert.equal(report.metrics.mediumCount, 1);
  assert.equal(report.issues[0]?.category, "EXPRESSION_SYNTAX");
});

test("CodeAnalyzer reports 100% score for compliant code", () => {
  const cleanCode = `
// Safe configuration loaded from environment
const apiKey = process.env.SERVICE_KEY || "";
const data = $json.customerName;

if (await verifyHumanApproval(data)) {
  await dispatchNotification(data);
}
`;
  const report = CodeAnalyzer.analyze(cleanCode);
  assert.equal(report.passed, true);
  assert.equal(report.score, 100);
  assert.equal(report.issues.length, 0);
});
