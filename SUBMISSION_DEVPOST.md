# 🛡️ Nebius CodeSentinel — Official Devpost Submission

> **Hackathon**: Nebius x NVIDIA Global AI Hackathon  
> **Track**: *Coding and Agentic Engineering*  
> **Repository**: `https://github.com/Robe092/nebius-codesentinel`  
> **Test Build & Instructions**: See [`JUDGE_TESTING.md`](JUDGE_TESTING.md) for local evaluation and review walkthrough  
> **Video Demonstration**: [CodeSentinel — public video, 1 min 50](https://youtu.be/6gfGnUcbGi0)  

---

## 1. Project Title & Tagline

- **Project Name**: **Nebius CodeSentinel**
- **Tagline**: *Autonomous code audit and self-healing agent powered by Nebius Token Factory and NVIDIA Nemotron, combining deterministic rule checks, AST structural preservation, TypeScript semantic verification, and anti-regression circuit breakers.*

---

## 2. The Problem & Target Audience

### Target Audience
Developers, DevOps teams, and automation engineers maintaining mission-critical webhook handlers, CI/CD scripts, and orchestration workflows (such as n8n workflows, payment processors, and automated notifications).

### The Problem
Automated workflow scripts are increasingly deployed in production, but they frequently harbor high-risk vulnerabilities:
1. **Plaintext Credential Leaks (`SEC-001`)**: Stripe secrets, API bearer tokens, and GitHub personal access tokens accidentally committed into script source code.
2. **Unguarded External Communications (`GOV-001`)**: High-volume messaging to Slack, Discord, or email dispatchers executed without Human-in-the-Loop (HITL) gatekeepers or circuit breakers.
3. **Expression Syntax Anomalies (`SYN-001`, `SYN-002`)**: Missing leading `$` in `$json` expressions or empty placeholder blocks causing silent runtime failures in production.
4. **The Destructive Patch Problem in Generic LLMs**: When asked to fix code, generic models frequently propose destructive patches—wiping out required exported functions, altering external API contracts, or returning empty strings that pass superficial tests while destroying business logic.

---

## 3. What It Does (The Solution)

**Nebius CodeSentinel** is an autonomous agentic workspace and CLI tool that pairs **deterministic rule inspection** with the reasoning power of **NVIDIA Nemotron** hosted on **Nebius Token Factory**.

### The 3-Step Review Journey: Detect → Repair → Verify

1. **Detect (Deterministic Lexical & AST Rules)**:
   - The developer selects or pastes target code in the dark-themed cockpit studio or runs `npm run cli -- audit`.
   - The engine audits the code against critical security, expression syntax, and governance invariants, computing a transparent compliance score (0 to 100).
2. **Repair (NVIDIA Nemotron on Nebius Token Factory)**:
   - The agent constructs a structured repair request and queries NVIDIA Nemotron via Nebius Token Factory.
   - **AST Structural Preservation Guard (`checkPatchStructure`)**: Before any candidate patch is considered, an AST guard checks that the proposed repair is non-empty and strictly preserves all original exported functions, types, and parameter signatures. Any destructive proposal is immediately rejected, preserving the original code.
3. **Verify (Multi-Layer Invariant & TypeScript Semantic Fencing)**:
   - The repaired code is checked against static invariants and parsed by the TypeScript Compiler API in memory (`ts.createProgram`) to catch semantic type errors (such as TS2322) before acceptance.
   - **Anti-Regression Guard**: A patch is rejected if it degrades the compliance score.
   - **Truthful Status Reporting**: If targeted findings remain open after an accepted improvement, the system explicitly reports `PARTIAL` rather than claiming complete `SUCCESS`.
   - **Circuit Breaker**: If valid repairs cannot be achieved within 3 iterations, execution halts safely.

---

## 4. How We Used Nebius & NVIDIA (Sponsor Technologies)

Nebius CodeSentinel is built natively around Nebius and NVIDIA infrastructure:

1. **Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/`)**:
   - OpenAI-compatible `/v1/chat/completions` API integration with Nebius AI Cloud.
   - Bounded inference client enforcing strict operational boundaries: max 4,000 output tokens, zero automatic SDK retries, an 8,192-byte serialized payload cap, and a per-run limit of 2 requests to protect developers against unexpected token consumption.
   - Full provenance tracking retaining real provider response IDs, model identifiers, and token usage metrics.
2. **NVIDIA Nemotron Models (`nvidia/nemotron-3-super-120b-a12b` & `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`)**:
   - Leverages Nemotron's Mixture-of-Experts (MoE) architecture for rigorous code reasoning and structured JSON output generation (`response_format: { type: "json_object" }`).
3. **Controlled Live Evidence on Nebius**:
   - A genuine live repair was executed and recorded against Nebius Token Factory on October 28, 2026, using `nvidia/nemotron-3-super-120b-a12b`:
     - Response ID: `chatcmpl-aa293e018d7955bb`
     - Tokens consumed: 143 prompt tokens, 736 completion tokens (879 total tokens)
     - Estimated inference cost: ~$0.0007053
     - The repair successfully extracted credentials to `process.env.API_CREDENTIAL` and passed all static and TypeScript semantic checks.
     - Evidence is permanently documented in [`docs/live-proof-20261028/`](docs/live-proof-20261028/).

---

## 5. Architectural Comparison: Defensible Guarantees

| Dimension | Nebius CodeSentinel (Nebius + Nemotron) | Generic Unbounded LLM Approach | Developer Benefit |
|---|---|---|---|
| **API Protocol** | Standard OpenAI-compatible `/v1/chat/completions` on Nebius AI Cloud | Proprietary or fragmented endpoints | Seamless integration without vendor lock-in |
| **Patch Output Format** | Strict JSON schema (`repairedCode`, `explanation`, `diff`) | Conversational markdown text | Direct deterministic parsing without fragile regex |
| **Structural Integrity** | `checkPatchStructure` AST guard rejects empty code or dropped exports | Unconstrained text replacement | External API contracts and function exports cannot be dropped |
| **Type Checking** | In-memory TypeScript Compiler API semantic diagnostics | None prior to file overwrite | Catches TS2322 type mismatches before saving |
| **Incomplete Outcomes** | Explicit `PARTIAL` status with manual review required | Over-optimistic "All Fixed" claims | Incomplete repairs are never marked as complete `SUCCESS` |
| **Cost & Loop Boundaries** | 3-iteration circuit breaker + bounded token budgets | Risk of unbounded runaway re-prompting | Financial and token exhaustion safety |
| **Execution Isolation** | Host process execution disabled (`NOT_VERIFIED`) | Untrusted arbitrary `eval` in host process | Zero host breakout risk from generated code |

*(Note: Numerical latency multipliers and cost deltas are unmeasured and not certified without multi-run telemetry across platforms).*

---

## 6. Developer Feedback for the Nebius Team

Based on our direct integration and test-driven evaluation with Nebius Token Factory, here is our technical feedback:

### What Worked Exceptionally Well:
- **Drop-in OpenAI SDK Compatibility**: Direct compatibility with the official `openai` TypeScript client made configuring baseURL and authentication completely seamless.
- **Reliable JSON Mode**: The `response_format: { type: "json_object" }` parameter reliably produced parseable JSON without hallucinated markdown wrappers.
- **Fast MoE Patch Reasoning**: NVIDIA Nemotron-3 Super produced well-formed, minimal unified diffs that addressed security invariants while respecting surrounding code.

### Constructive Suggestions for the Nebius Engineering Team:
1. **Dynamic Model Capabilities in `/v1/models`**: Returning context window size (`context_window`) and quantization precision (FP8, INT4) in `/v1/models` would help client applications dynamically tune token limits.
2. **Standard Rate-Limit Headers**: Exposing remaining token quotas via standard HTTP headers (`x-ratelimit-remaining-tokens`, `x-ratelimit-reset`) would allow client-side circuit breakers to react proactively.
3. **Native Tool-Calling Testing in Studio**: Adding an interactive function-calling schema playground in the Nebius Token Factory web console would accelerate developer adoption.

---

## 7. How We Built It

- **Frontend Cockpit Studio**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React icons. Accessible dark-theme UI with keyboard navigation and line-by-line diff comparison.
- **Rule Engine & AST Analyzer**: Deterministic rule analysis inspired by `n8n_code_analyzer.py` and GitLab Duo Sentinel, augmented with TypeScript AST checks for Human-in-the-Loop conditional guards (`GOV-001`).
- **Structural Patch Guard**: TypeScript Compiler API AST checker (`checkPatchStructure`) ensuring exports, signatures, and code statements are never wiped out.
- **Testing Suite**: 98 unit and integration tests running with Node.js built-in test runner; 30 headless Chrome browser checks via Puppeteer.
- **Security Quarantine**: Untrusted model-generated code is never executed in the host application process (`NOT_VERIFIED`).

---

## 8. What's Next for Nebius CodeSentinel

- **Isolated Ephemeral Micro-VMs**: Introducing Firecracker micro-VMs or gVisor sandboxes to execute optional dynamic integration tests without exposing host infrastructure.
- **Multi-File Workspace Refactoring**: Expanding AST structural verification from single-file webhooks to entire monorepos and multi-step pipeline architectures.
- **Native CI/CD Marketplace Actions**: Publishing pre-configured GitHub Actions and GitLab CI components for automated PR code reviews backed by Nebius Token Factory.
