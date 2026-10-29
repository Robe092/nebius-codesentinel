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

test("CodeAnalyzer: approval-name spoofing without conditional guard is flagged with GOV-001", () => {
  const spoofCode = `
const approvalLabel = "no approval performed";
slack.postMessage({ text: "Hello" });
`;
  const report = CodeAnalyzer.analyze(spoofCode);
  const govIssues = report.issues.filter((i) => i.ruleId === "GOV-001");
  assert.equal(govIssues.length, 1);
});

test("CodeAnalyzer: approval result not used to gate the dispatch is flagged with GOV-001", () => {
  const ungatedCode = `
const isApproved = await verifyHumanApproval(event);
slack.postMessage({ text: "Hello" });
`;
  const report = CodeAnalyzer.analyze(ungatedCode);
  const govIssues = report.issues.filter((i) => i.ruleId === "GOV-001");
  assert.equal(govIssues.length, 1);
});

test("CodeAnalyzer: supported actual conditional approval check is accepted", () => {
  const guardedCode = `
if (await verifyHumanApproval(event)) {
  slack.postMessage({ text: "Hello" });
}
`;
  const report = CodeAnalyzer.analyze(guardedCode);
  const govIssues = report.issues.filter((i) => i.ruleId === "GOV-001");
  assert.equal(govIssues.length, 0);
});

test("R2 Acceptance: approval guard must verify positive polarity and flow-control path", () => {
  const guardCases: Array<[string, string, number]> = [
    ["negative approval branch", 'if (!(await verifyHumanApproval(event))) { await slack.postMessage({text:"Demo"}); }', 1],
    ["approval else branch", 'if (await verifyHumanApproval(event)) {} else { await slack.postMessage({text:"Demo"}); }', 1],
    ["truthy string condition", 'if ("approval required") { await slack.postMessage({text:"Demo"}); }', 1],
    ["positive early return sends only when not approved", 'if (await verifyHumanApproval(event)) { return; } await slack.postMessage({text:"Demo"});', 1],
    ["variable name spoof", 'const approvalLabel="no approval"; await slack.postMessage({text:"Demo"});', 1],
    ["supported positive guard", 'if (await verifyHumanApproval(event)) { await slack.postMessage({text:"Demo"}); }', 0],
    ["supported negative early return", 'if (!approval) { return; } await slack.postMessage({text:"Demo"});', 0],
  ];

  for (const [name, body, expected] of guardCases) {
    const code = "export async function send(event: any) { " + body + " }";
    const findings = CodeAnalyzer.analyze(code).issues.filter((i) => i.ruleId === "GOV-001").length;
    assert.equal(findings, expected, `Case '${name}' expected ${expected} GOV-001 findings, got ${findings}`);
  }
});

test("Cause A Acceptance: unrecognised compound expressions must not become proof of approval", () => {
  for (const condition of ['(await verifyHumanApproval(event)) || true', 'Boolean("approval required")']) {
    const code = `export async function send(event: any) { if (${condition}) { await dispatchSlackAlert({text: "Demo"}); } }`;
    const findings = CodeAnalyzer.analyze(code).issues.filter((i) => i.ruleId === "GOV-001").length;
    assert.equal(findings, 1, `Approval required for condition: ${condition}`);
  }
});


