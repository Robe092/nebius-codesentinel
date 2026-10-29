import {
  AuditReport,
  PatchProposal,
  SelfHealingSession,
  SelfHealingStep,
  PromptPayload,
} from "@/types";
import { CodeAnalyzer } from "./code-analyzer";
import { NebiusClient, nebiusClient } from "./nebius-client";
import { createFixtureVerifier } from "./fixture-verifier";
import { checkPatchStructure } from "./patch-structure";
import { BoundedInferenceBudget } from "./bounded-inference";

export interface SelfHealingOptions {
  client?: NebiusClient;
  maxIterations?: number;
  fileName?: string;
  testVerifier?: (code: string) => Promise<{ passed: boolean; output: string }>;
}

export class SelfHealingOrchestrator {
  private client: NebiusClient;
  private maxIterations: number;
  private testVerifier?: (code: string) => Promise<{ passed: boolean; output: string }>;

  constructor(options?: SelfHealingOptions) {
    this.client = options?.client || nebiusClient;
    this.maxIterations = options?.maxIterations || 3;
    this.testVerifier = options?.testVerifier;
  }

  /**
   * Runs the complete autonomous audit-and-healing loop powered by Nebius & NVIDIA Nemotron
   */
  public async executeHealingLoop(
    initialCode: string,
    fileName: string = "pipeline_workflow.ts"
  ): Promise<SelfHealingSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let currentCode = initialCode;
    const steps: SelfHealingStep[] = [];
    const previousAttempts: PromptPayload["previousAttempts"] = [];

    let currentIteration = 1;
    let loopStatus: SelfHealingSession["status"] = "IN_PROGRESS";
    let finalAudit: AuditReport | undefined;
    let anyPatchAccepted = false;
    const sessionBudget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 0 };

    while (currentIteration <= this.maxIterations) {
      // Step 1: Static Audit
      const audit = CodeAnalyzer.analyze(currentCode, fileName);
      finalAudit = audit;

      // If code is already pristine, finish early
      if (audit.passed && audit.issues.length === 0) {
        steps.push({
          iteration: currentIteration,
          status: "COMPLETED",
          auditReport: audit,
          invariantPassed: true,
          feedbackNotes: "No critical or high severity defects detected. Invariant satisfied.",
        });
        loopStatus = "SUCCESS";
        break;
      }

      // Step 2: Propose Patch with Nebius NVIDIA Nemotron (bounded by session budget)
      let patch: PatchProposal;
      try {
        patch = await (this.client as any).generatePatch(
          {
            code: currentCode,
            issues: audit.issues,
            context: `Iteration ${currentIteration}/${this.maxIterations} on ${fileName}`,
            previousAttempts,
          },
          { budget: sessionBudget }
        );
      } catch (err: any) {
        steps.push({
          iteration: currentIteration,
          status: "FAILED",
          auditReport: audit,
          invariantPassed: false,
          feedbackNotes: `Inference halted or session budget exhausted: ${err.message}`,
        });
        loopStatus = anyPatchAccepted ? "PARTIAL" : "CIRCUIT_BREAKER_TRIGGERED";
        break;
      }

      // Step 3: Run Verification & Score Non-Regression Guard on Repaired Code
      let testPassed = true;
      let testOutput = "Automated invariant test suite passed.";
      const testStart = Date.now();

      // Guard 3.1: Structural integrity (rejects empty candidate, removed exports, altered signatures)
      const structureCheck = checkPatchStructure(currentCode, patch.repairedCode);
      if (!structureCheck.passed) {
        testPassed = false;
        testOutput = `Patch structural rejection: ${structureCheck.error}`;
      }

      const candidateAudit = CodeAnalyzer.analyze(patch.repairedCode, fileName);

      if (testPassed) {
        if (candidateAudit.metrics.criticalCount > 0) {
          testPassed = false;
          testOutput = `Critical vulnerability still present: ${candidateAudit.issues.find((i) => i.severity === "CRITICAL")?.message || "Critical security violation"}`;
        } else if (candidateAudit.score < audit.score) {
          testPassed = false;
          testOutput = `Regression detected: compliance score degraded from ${audit.score} to ${candidateAudit.score}`;
        } else if (this.testVerifier) {
          try {
            const res = await this.testVerifier(patch.repairedCode);
            testPassed = res.passed;
            testOutput = res.output;
          } catch (err: any) {
            testPassed = false;
            testOutput = `Test execution runtime error: ${err.message}`;
          }
        } else {
          // Multi-layer verification: Static Invariants + TypeScript Semantic Checks (0 execution in app process)
          const fixtureVerifier = createFixtureVerifier(fileName);
          try {
            const res = await fixtureVerifier(patch.repairedCode);
            testPassed = res.passed;
            testOutput = res.output;
          } catch (err: any) {
            testPassed = false;
            testOutput = `Verification error: ${err.message}`;
          }
        }
      }

      const durationMs = Date.now() - testStart;

      steps.push({
        iteration: currentIteration,
        status: testPassed ? "COMPLETED" : "RUNNING_TESTS",
        auditReport: audit,
        patch,
        testResults: {
          passed: testPassed,
          output: testOutput,
          durationMs,
        },
        invariantPassed: testPassed,
        feedbackNotes: testPassed
          ? (candidateAudit.score > audit.score
              ? `Patch improved score from ${audit.score} to ${candidateAudit.score}.`
              : "Patch preserved compliance score without regression.")
          : `Patch failed validation: ${testOutput}`,
      });

      // Apply the repaired code ONLY if test passed and score did not regress
      if (testPassed) {
        anyPatchAccepted = true;
        currentCode = patch.repairedCode;
        finalAudit = candidateAudit;

        if (candidateAudit.passed && candidateAudit.issues.length === 0) {
          loopStatus = "SUCCESS";
          break;
        }
      } else {
        // Record failure for next iteration feedback without replacing currentCode
        previousAttempts.push({
          iteration: currentIteration,
          patchDiff: patch.diff,
          testFailureReason: testOutput,
        });
      }

      currentIteration++;
    }

    if (loopStatus === "IN_PROGRESS") {
      if (anyPatchAccepted && finalAudit && finalAudit.passed && finalAudit.issues.length > 0) {
        loopStatus = "PARTIAL";
      } else {
        // Circuit breaker triggered after max attempts
        loopStatus = "CIRCUIT_BREAKER_TRIGGERED";
      }
    }

    return {
      sessionId,
      fileName,
      originalCode: initialCode,
      currentCode,
      status: loopStatus,
      currentIteration: Math.min(currentIteration, this.maxIterations),
      maxIterations: this.maxIterations,
      steps,
      finalReport: finalAudit,
    };
  }
}

export const selfHealingOrchestrator = new SelfHealingOrchestrator();
