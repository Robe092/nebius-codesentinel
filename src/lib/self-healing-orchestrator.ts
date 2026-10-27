import {
  AuditReport,
  PatchProposal,
  SelfHealingSession,
  SelfHealingStep,
  PromptPayload,
} from "@/types";
import { CodeAnalyzer } from "./code-analyzer";
import { NebiusClient, nebiusClient } from "./nebius-client";

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

      // Step 2: Propose Patch with Nebius NVIDIA Nemotron
      const patch = await this.client.generatePatch({
        code: currentCode,
        issues: audit.issues,
        context: `Iteration ${currentIteration}/${this.maxIterations} on ${fileName}`,
        previousAttempts,
      });

      // Step 3: Run Verification on Repaired Code
      let testPassed = true;
      let testOutput = "Automated invariant test suite passed.";
      const testStart = Date.now();

      if (this.testVerifier) {
        try {
          const res = await this.testVerifier(patch.repairedCode);
          testPassed = res.passed;
          testOutput = res.output;
        } catch (err: any) {
          testPassed = false;
          testOutput = `Test execution runtime error: ${err.message}`;
        }
      } else {
        // Default deterministic invariant verification:
        // 1. Secrets must be eradicated
        // 2. Syntax must be valid
        // 3. Score must improve
        const postAudit = CodeAnalyzer.analyze(patch.repairedCode, fileName);
        if (postAudit.metrics.criticalCount > 0) {
          testPassed = false;
          testOutput = `Critical vulnerability still present: ${postAudit.issues[0]?.message}`;
        } else if (postAudit.score < audit.score) {
          testPassed = false;
          testOutput = `Regression detected: compliance score degraded from ${audit.score} to ${postAudit.score}`;
        } else {
          testPassed = true;
          testOutput = `Code passed security invariant checks. Score improved: ${audit.score} ➔ ${postAudit.score}`;
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
          ? "Patch successfully resolved identified issues without regression."
          : `Patch failed validation: ${testOutput}`,
      });

      // Apply the repaired code if test passed
      if (testPassed) {
        currentCode = patch.repairedCode;
        const recheck = CodeAnalyzer.analyze(currentCode, fileName);
        finalAudit = recheck;

        if (recheck.passed) {
          loopStatus = "SUCCESS";
          break;
        }
      } else {
        // Record failure for next iteration feedback
        previousAttempts.push({
          iteration: currentIteration,
          patchDiff: patch.diff,
          testFailureReason: testOutput,
        });
      }

      currentIteration++;
    }

    if (loopStatus === "IN_PROGRESS") {
      // Circuit breaker triggered after max attempts
      loopStatus = "CIRCUIT_BREAKER_TRIGGERED";
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
