import test from "node:test";
import assert from "node:assert/strict";
import { checkPatchStructure } from "../lib/patch-structure";
import { WORKSPACE_SAMPLES } from "../lib/workspace-samples";

test("checkPatchStructure: rejects blank or whitespace-only candidate", () => {
  const original = WORKSPACE_SAMPLES[0].code;
  const blank = "   \n\t   ";
  const result = checkPatchStructure(original, blank);
  assert.equal(result.passed, false);
  assert.match(result.error || "", /empty|whitespace/i);
});

test("checkPatchStructure: rejects candidate that removes exported handlePayment function", () => {
  const original = WORKSPACE_SAMPLES[0].code;
  const removedExport = `const STRIPE_SECRET = process.env.API_CREDENTIAL ?? "";\n// handlePayment was deleted`;
  const result = checkPatchStructure(original, removedExport);
  assert.equal(result.passed, false);
  assert.match(result.error || "", /handlePayment/i);
});

test("checkPatchStructure: rejects candidate that changes export signature of handlePayment", () => {
  const original = WORKSPACE_SAMPLES[0].code;
  // Original has `export async function handlePayment(event: any)`
  // Candidate changes parameter count to zero: `export async function handlePayment()`
  const zeroParams = `
const STRIPE_SECRET = process.env.API_CREDENTIAL ?? "";
export async function handlePayment() {
  return { status: "processed" };
}
`;
  const resultZero = checkPatchStructure(original, zeroParams);
  assert.equal(resultZero.passed, false);
  assert.match(resultZero.error || "", /signature|parameter/i);

  // Candidate changes exported function to a constant variable
  const asConst = `
export const handlePayment = "not a function";
`;
  const resultConst = checkPatchStructure(original, asConst);
  assert.equal(resultConst.passed, false);
  assert.match(resultConst.error || "", /handlePayment|non-function|signature/i);
});

test("checkPatchStructure: accepts a valid compliant repair preserving exports and signatures", () => {
  const original = WORKSPACE_SAMPLES[0].code;
  const validRepair = `// Payment webhook · automation workspace
import { dispatchSlackAlert } from "./notifier";

const STRIPE_SECRET = process.env.API_CREDENTIAL ?? "";

export async function handlePayment(event: any) {
  const amount = event.data.amount;
  const customerEmail = $json.customer.email;

  if (amount > 10000) {
    if (event.approved === true) {
      await dispatchSlackAlert({
        channel: "#high-value-transactions",
        text: "High payment processed: " + amount,
      });
    }
  }

  return {
    status: "processed",
    email: customerEmail,
  };
}
`;
  const result = checkPatchStructure(original, validRepair);
  assert.equal(result.passed, true);
  assert.equal(result.error, undefined);
});

test("R3 Acceptance: checkPatchStructure rejects contract violations (default, async, returnType, optionality, alias)", () => {
  const original = 'export async function run(event: any) { const apiKey = "DEMO_ONLY_NOT_A_REAL_CREDENTIAL"; return event; }';
  const fixed = 'export async function run(event: any) { const apiKey = process.env.API_CREDENTIAL; return event; }';

  const structuralCases: Array<[string, string, string]> = [
    ['blank patch', original, ''],
    ['removed export', original, 'const kept = 1;'],
    ['named default export removed', original.replace('export async','export default async'), fixed],
    ['async function changed to sync', original, fixed.replace('export async','export')],
    ['return type changed', 'export function run(event: any): Promise<any> { return Promise.resolve(event); }', 'export function run(event: any): string { return "changed"; }'],
    ['optional parameter made required', 'export function run(event?: number) { return event; }', 'export function run(event: number) { return event; }'],
    ['alias-exported function changed to number', 'function run(event: any) { return event; } export {run};', 'export const run = 123;'],
  ];

  for (const [name, before, after] of structuralCases) {
    const result = checkPatchStructure(before, after);
    assert.equal(result.passed, false, `Expected case '${name}' to fail checkPatchStructure, but it passed`);
  }
});

test("Cause B Acceptance: reject numeric default parameter changed to inferred string (omitted type annotation)", () => {
  const original = 'export function run(event: number = 0) { const apiKey = "DEMO_ONLY_NOT_A_REAL_CREDENTIAL"; return event; }';
  const changed = 'export function run(event = "changed") { const apiKey = process.env.API_CREDENTIAL; return event; }';
  const structure = checkPatchStructure(original, changed);
  assert.equal(structure.passed, false);
});


