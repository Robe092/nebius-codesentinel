# 👨‍⚖️ Judge & Reviewer Testing Guide — Nebius CodeSentinel

> **Welcome to Nebius CodeSentinel!**  
> This guide provides step-by-step instructions for hackathon judges and reviewers to test and evaluate the project from the repository root without requiring paid inference credits or proprietary setup.

---

## ⚡ 1. Rapid Zero-Credit Evaluation (Under 3 Minutes)

CodeSentinel includes a **zero-credit, deterministic simulation mode (`MOCK_SIMULATED`)** enabled by default. You can inspect, run, and verify the entire system, CLI, and interactive studio without creating a Nebius account or configuring an API key.

### Prerequisites
- **Verified Environments**: macOS (Node 24 / npm 10), Linux Ubuntu 22.04 LTS (Node 20 LTS / npm 10)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run the Offline Test Suite
Run the comprehensive offline test suite (98 automated tests covering static rules, structural AST checks, shared session budgets, approval guardrails, and CLI routes):
```bash
MOCK_MODE=true npm test
```
The suite uses injected offline transports to exercise the live-probe library. Run it with `ENABLE_LIVE_REPAIR` unset; explicitly setting it to `false` also blocks those injected transports. Keep the application server in simulation and do not run `verify:live` for this check.

*Expected result:* 100% of tests pass (98/98) with **zero provider network requests**. Duration varies by machine.

### Step 3: Run Sequential Build and Typecheck
To ensure zero build or TypeScript errors without race conditions:
```bash
npm run build
npx tsc --noEmit
```
*Expected result:* Build and typecheck exit cleanly with code 0.

### Step 4: Run Headless Chrome E2E Tests (Optional)
Run headless Chrome automation via Puppeteer:
```bash
npm run test:e2e
npm run test:ui
```
*Expected result:* 26 core browser checks pass. With the studio running in another terminal, `npm run test:simple` adds 4 checks for primary-action visibility and progressive results (30 checks in total).

---

## 🖥️ 2. Testing the Interactive Cockpit Studio

### Launch the Development Server
```bash
npm run dev
```
Open your browser at **[http://localhost:3005](http://localhost:3005)**.

### Walkthrough the Core Scenarios
1. **Scenario 1: Payment Webhook (`payment_webhook.ts`)**
   - Click **"Analyze code"**: Detects 3 configured rule violations:
     - `SEC-001` (Critical): Hardcoded plaintext Stripe secret.
     - `SYN-001` (Medium): Malformed n8n expression (missing leading `$` in `json.customer.email`).
     - `GOV-001` (High): Unguarded external communication dispatch to Slack without Human-in-the-Loop (HITL) gatekeeper.
     - Compliance Score: **45 / 100 [FAIL]**.
   - Click **"Repair source"**: Executes the self-healing loop.
     - Inspect the **Repair** tab: review the trace and non-regression score checks.
     - Inspect the **Changes** tab: side-by-side unified source diff showing the secret extracted to `process.env.API_CREDENTIAL`, `$json` normalized, and an approval gate inserted before the Slack dispatch.
     - Expand **Run details & evidence**: view request timings, final score (100 / 100), and provenance (`MOCK_SIMULATED`).
     - Click **"Download run evidence"** to download the structured JSON session audit.
2. **Reproducing AST Structural Rejection & Source Preservation (Offline)**
   - To inspect how CodeSentinel prevents destruction of exports and signatures, run the structural acceptance suite:
   ```bash
   MOCK_MODE=true node --import tsx --test src/tests/patch-structure.test.ts src/tests/self-healing.test.ts
   ```
   - This test verifies that if a model proposes an adversarial patch (empty candidate, removing `handlePayment`, altering `async` modifiers, changing return types, or stripping optional parameters), the AST structural guard (`checkPatchStructure`) immediately rejects the candidate, preserves the original code intact, and halts safely via the circuit breaker without overwriting source code.
3. **Explicit Incomplete & Partial Outcomes**
   - If a proposed repair leaves an unresolved issue (e.g. `export const amount = json.amount;`), the orchestrator yields `PARTIAL` status with review required, strictly refusing to claim `SUCCESS` when defects remain.

---

## 💻 3. Testing the CLI

CodeSentinel provides a full CLI for CI/CD pre-commit hooks and terminal automation:

```bash
# 1. Audit a target file (exits with code 1 on violations)
npm run cli -- audit samples/vulnerable_workflow.ts

# 2. Heal dry-run (prints Nemotron reasoning and unified diff without writing to disk)
npm run cli -- heal samples/vulnerable_workflow.ts

# 3. Heal with --apply (writes repaired code to disk ONLY if status is SUCCESS)
npm run cli -- heal samples/vulnerable_workflow.ts --apply

# 4. Architectural comparison
npm run cli -- benchmark
```

---

## 📡 4. Verifying the Recorded Nebius Token Factory Proof

A genuine live repair was executed and recorded against **Nebius Token Factory** (`https://api.tokenfactory.nebius.com/v1/`) on October 28, 2026, using **NVIDIA Nemotron-3 Super 120B** (`nvidia/nemotron-3-super-120b-a12b`).

You can inspect the exact recorded evidence locally without consuming credits:
- **`docs/live-proof-20261028/MODEL_RESPONSE_1.json`**: Exact raw JSON response returned by Nebius Token Factory:
  - Model: `nvidia/nemotron-3-super-120b-a12b`
  - Response ID: `chatcmpl-aa293e018d7955bb`
  - Usage: 143 prompt tokens, 736 completion tokens (879 total tokens)
  - Estimated inference cost: ~$0.0007053
- **`docs/live-proof-20261028/LIVE_NEBIUS_PROBE.json`**: Probe validation summary report.
- **Offline Replay Assertion Test**: Run `node --import tsx --test src/tests/bounded-inference.test.ts` to verify that replaying this saved response preserves exact provider metadata, response ID, and token counts.

*(Note: Live network inference via `npm run verify:live` requires a funded `NEBIUS_API_KEY` in `.env.local` and `ENABLE_LIVE_REPAIR=true`. When `ENABLE_LIVE_REPAIR` is unset or false, the command exits immediately with `status: BLOCKED` without consuming network transport or credits. In accordance with hackathon evaluation guidelines, judges do NOT need to spend credits).*

---

## 🔒 5. Security & Verification Boundaries

- **In-Memory Semantic Verification**: CodeSentinel validates TypeScript semantic diagnostics in memory using the official TypeScript Compiler API (`ts.createProgram`).
- **No Host Execution**: Untrusted model-generated code is **never executed** within the host application process (`NOT_VERIFIED`).
- **Bounded Inference**: All requests are capped at 4,000 output tokens, zero automatic SDK retries, an 8,192-byte serialized payload limit, and a strict per-run budget of 2 requests.
