import { z } from "zod";

// --- Severity & Status Definitions ---
export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type VerificationStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED";

export type AuditCategory =
  | "HARDCODED_SECRET"
  | "MISSING_GUARDRAIL"
  | "DEPRECATED_COMPONENT"
  | "FORBIDDEN_DIRECT_COMMUNICATION"
  | "CODE_SYNTAX_ERROR"
  | "EXPRESSION_SYNTAX"
  | "INVARIANT_VIOLATION";

// --- Issue Schema ---
export const CodeIssueSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  category: z.enum([
    "HARDCODED_SECRET",
    "MISSING_GUARDRAIL",
    "DEPRECATED_COMPONENT",
    "FORBIDDEN_DIRECT_COMMUNICATION",
    "CODE_SYNTAX_ERROR",
    "EXPRESSION_SYNTAX",
    "INVARIANT_VIOLATION",
  ]),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  snippet: z.string().optional(),
  autoFixable: z.boolean().default(true),
  remediationHint: z.string().optional(),
});

export type CodeIssue = z.infer<typeof CodeIssueSchema>;

// --- Audit Report Schema ---
export const AuditReportSchema = z.object({
  targetName: z.string(),
  timestamp: z.string(),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  issues: z.array(CodeIssueSchema),
  metrics: z.object({
    totalLines: z.number(),
    criticalCount: z.number(),
    highCount: z.number(),
    mediumCount: z.number(),
    lowCount: z.number(),
  }),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;

// --- Patch Proposal Schema ---
export const TokenUsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const PatchProposalSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  modelUsed: z.string(),
  requestedModel: z.string().optional(),
  providerModelVerified: z.boolean().optional(),
  reasoningSteps: z.array(z.string()),
  explanation: z.string(),
  diff: z.string(),
  repairedCode: z.string(),
  fixedIssueIds: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1).optional().nullable(),
  sourceMode: z.enum(["LIVE_NEBIUS", "MOCK_SIMULATED"]),
  providerResponseId: z.string().optional(),
  tokenUsage: TokenUsageSchema.optional(),
});

export type PatchProposal = z.infer<typeof PatchProposalSchema>;

// --- Self-Healing Step & Loop Schema ---
export const SelfHealingStepSchema = z.object({
  iteration: z.number(),
  status: z.enum(["AUDITING", "PROPOSING_PATCH", "RUNNING_TESTS", "VERIFYING_INVARIANTS", "COMPLETED", "FAILED"]),
  auditReport: AuditReportSchema.optional(),
  patch: PatchProposalSchema.optional(),
  testResults: z.object({
    passed: z.boolean(),
    output: z.string(),
    durationMs: z.number(),
  }).optional(),
  invariantPassed: z.boolean().optional(),
  feedbackNotes: z.string().optional(),
});

export type SelfHealingStep = z.infer<typeof SelfHealingStepSchema>;

export const SelfHealingSessionSchema = z.object({
  sessionId: z.string(),
  fileName: z.string(),
  originalCode: z.string(),
  currentCode: z.string(),
  status: z.enum(["IDLE", "IN_PROGRESS", "SUCCESS", "PARTIAL", "FAILED", "CIRCUIT_BREAKER_TRIGGERED"]),
  currentIteration: z.number(),
  maxIterations: z.number().default(3),
  steps: z.array(SelfHealingStepSchema),
  finalReport: AuditReportSchema.optional(),
});

export type SelfHealingSession = z.infer<typeof SelfHealingSessionSchema>;

// --- Nebius Client Interfaces ---
export interface NebiusClientConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  fallbackModel?: string;
  mockMode?: boolean;
}

export interface PromptPayload {
  code: string;
  issues: CodeIssue[];
  context?: string;
  previousAttempts?: Array<{
    iteration: number;
    patchDiff: string;
    testFailureReason: string;
  }>;
}
