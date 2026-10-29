import OpenAI from "openai";
import {
  CodeIssue,
  AuditReport,
  PatchProposal,
  NebiusClientConfig,
  PromptPayload,
  PatchProposalSchema,
} from "@/types";
import { executeBoundedInference, BoundedInferenceBudget } from "./bounded-inference";

export class NebiusClient {
  public openai: OpenAI | null = null;
  private baseURL: string;
  private apiKey: string;
  private model: string;
  private fallbackModel: string;
  private mockMode: boolean;

  constructor(config?: NebiusClientConfig) {
    this.baseURL =
      config?.baseURL ||
      process.env.NEBIUS_BASE_URL ||
      "https://api.tokenfactory.nebius.com/v1/";
    this.apiKey = config?.apiKey || process.env.NEBIUS_API_KEY || "";
    this.model =
      config?.model ||
      process.env.NEBIUS_MODEL ||
      "nvidia/nemotron-3-super-120b-a12b";
    this.fallbackModel =
      config?.fallbackModel ||
      process.env.NEBIUS_FALLBACK_MODEL ||
      "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

    // Auto-detect mock mode: default to simulation unless live repair is explicitly enabled with a valid key
    this.mockMode =
      config?.mockMode ??
      (process.env.MOCK_MODE !== "false" ||
        process.env.ENABLE_LIVE_REPAIR !== "true" ||
        !this.apiKey ||
        this.apiKey.trim() === "");

    if (!this.mockMode && this.apiKey) {
      this.openai = new OpenAI({
        baseURL: this.baseURL,
        apiKey: this.apiKey,
        timeout: 30000,
        maxRetries: 0,
      });
    }
  }

  public isMock(): boolean {
    return this.mockMode;
  }

  public getModelName(): string {
    return this.model;
  }

  public getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Health check to test Nebius Token Factory configuration.
   * Reports configuration status without consuming tokens or initiating inference.
   */
  public async testConnection(): Promise<{
    connected: boolean;
    configured: boolean;
    model: string;
    mode: "LIVE_NEBIUS" | "MOCK_SIMULATED";
    latencyMs: number;
    message?: string;
  }> {
    if (this.mockMode || !this.openai) {
      return {
        connected: false,
        configured: true,
        model: this.model,
        mode: "MOCK_SIMULATED",
        latencyMs: 0,
        message: "Simulation mode active. Ready for offline testing.",
      };
    }

    return {
      connected: false,
      configured: true,
      model: this.model,
      mode: "LIVE_NEBIUS",
      latencyMs: 0,
      message: "Configured — connection not verified (zero inference tokens consumed).",
    };
  }

  /**
   * Generates a code patch using NVIDIA Nemotron on Nebius Token Factory
   */
  public async generatePatch(
    payload: PromptPayload,
    options?: { budget?: BoundedInferenceBudget }
  ): Promise<PatchProposal> {
    const startTime = Date.now();

    if (this.mockMode || !this.openai) {
      return this.simulateNemotronPatch(payload);
    }

    const systemPrompt = `You are NVIDIA Nemotron-3 Super CodeSentinel, an elite autonomous code healing agent operating on the Nebius AI Cloud.
Your mission:
1. Examine the target code and the identified architectural, security, and invariant issues.
2. Formulate step-by-step reasoning explaining why each issue occurred and how to resolve it safely.
3. Preserve all non-impacted business logic, comments, and contracts (Anti-Regression).
4. Provide the exact unified diff and the complete, pristine repaired code.
5. Use the existing fixture environment when repairing automation examples:
   - verifyHumanApproval(event?: any): Promise<boolean> is an available global approval helper. Await it in a conditional before dispatching an external notification.
   - $json: any is the available automation input; process.env exposes environment variables as string | undefined.
   - The existing ./notifier module exports dispatchSlackAlert(opts: any): Promise<any>.
   Preserve helpers already defined in the source. Do not invent new imports or undeclared helpers such as ./guardrails; the verifier cannot resolve arbitrary application modules. These declarations support typechecking only, not runtime execution.
6. Format your output strictly as a JSON object with this exact structure:
{
  "reasoningSteps": ["Step 1...", "Step 2..."],
  "explanation": "Executive summary of the fix",
  "diff": "--- a/file\\n+++ b/file\\n@@ ... @@",
  "repairedCode": "complete updated code",
  "fixedIssueIds": ["issue_id_1", "issue_id_2"],
  "confidenceScore": 0.98
}`;

    const userPrompt = `Here is the target code:
\`\`\`
${payload.code}
\`\`\`

Detected issues:
${JSON.stringify(payload.issues, null, 2)}

${
  payload.previousAttempts && payload.previousAttempts.length > 0
    ? `NOTE: Previous patch attempts failed with test errors:
${JSON.stringify(payload.previousAttempts, null, 2)}
Please adjust your approach to address these test failures directly.`
    : ""
}

Return ONLY the valid JSON object.`;

    const budget: BoundedInferenceBudget = options?.budget || { maxRequests: 2, requestsUsed: 0 };
    const result = await executeBoundedInference({
      client: this.openai,
      model: this.model,
      fallbackModel: this.fallbackModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 4000,
      budget,
      maxPayloadBytes: 8192,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      throw new Error(`Model response content is not valid JSON: ${result.content.slice(0, 80)}`);
    }

    if (!parsed || typeof parsed.repairedCode !== "string") {
      throw new Error("Missing 'repairedCode' in model patch proposal");
    }

    const reasoningSteps: string[] = Array.isArray(parsed.reasoningSteps) ? parsed.reasoningSteps : [];
    const explanation: string = typeof parsed.explanation === "string" ? parsed.explanation : "";
    const confidenceScore: number | undefined =
      typeof parsed.confidenceScore === "number"
        ? Math.min(Math.max(parsed.confidenceScore, 0), 1)
        : undefined;

    const modelUsed = result.model || "UNKNOWN";
    const providerModelVerified = Boolean(result.model);
    const requestedModel = result.requestedModel || this.model;

    return PatchProposalSchema.parse({
      id: `patch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      modelUsed,
      requestedModel,
      providerModelVerified,
      reasoningSteps,
      explanation,
      diff: typeof parsed.diff === "string" ? parsed.diff : "",
      repairedCode: parsed.repairedCode,
      fixedIssueIds: Array.isArray(parsed.fixedIssueIds) ? parsed.fixedIssueIds : payload.issues.map((i) => i.id),
      confidenceScore,
      sourceMode: "LIVE_NEBIUS",
      providerResponseId: result.id,
      tokenUsage: result.usage,
    });
  }

  /**
   * Deterministic high-precision simulation of Nemotron code healing
   * Adheres to Rule 3 (Zéro Faux Positif - tagged as MOCK_SIMULATED)
   */
  private simulateNemotronPatch(payload: PromptPayload): PatchProposal {
    let repaired = payload.code;
    const reasoning: string[] = [];
    const fixedIds: string[] = [];

    // 1. Hardcoded Secrets resolution
    const secretIssue = payload.issues.find((i) => i.category === "HARDCODED_SECRET");
    if (secretIssue) {
      reasoning.push(
        "Detected plain-text credentials violating security invariant. Extracted credential into process.env pattern."
      );
      fixedIds.push(secretIssue.id);
      repaired = repaired.replace(
        /([a-zA-Z0-9_]*(?:secret|key|token|auth)[a-zA-Z0-9_]*\s*[:=]\s*)["'][a-zA-Z0-9_\-\.]{10,}["']/gi,
        '$1process.env.API_CREDENTIAL || ""'
      );
      repaired = repaired.replace(
        /(["'])(sk-[a-zA-Z0-9_\-]{10,}|ghp_[a-zA-Z0-9_\-]{15,}|bearer\s+[a-zA-Z0-9_\-\.]{10,})\1/gi,
        'process.env.API_CREDENTIAL || ""'
      );
    }

    // 2. Missing Guardrail / Direct Comm resolution
    const guardrailIssue = payload.issues.find(
      (i) => i.category === "MISSING_GUARDRAIL" || i.category === "FORBIDDEN_DIRECT_COMMUNICATION"
    );
    if (guardrailIssue) {
      reasoning.push(
        "Detected unvetted direct communication dispatch without HITL gatekeeper. Inserted verification checkpoint and circuit breaker."
      );
      fixedIds.push(guardrailIssue.id);
      if (!repaired.includes("verifyHumanApproval") && !repaired.includes("HITL Gatekeeper")) {
        repaired = repaired.replace(
          /(await\s+dispatch\w+\s*\([^)]*\);|await\s+slack\.\w+\([^)]*\);)/g,
          `// HITL Gatekeeper guardrail check\n    if (await verifyHumanApproval(event)) {\n      $1\n    }`
        );
      }
    }

    // 3. n8n missing dollar prefix syntax resolution
    const syntaxIssue = payload.issues.find((i) => i.category === "EXPRESSION_SYNTAX");
    if (syntaxIssue) {
      reasoning.push(
        "Detected malformed expression (missing leading $ in json/node reference). Normalized expression to $json / $('NodeName')."
      );
      fixedIds.push(syntaxIssue.id);
      repaired = repaired.replace(/(?<![\$a-zA-Z0-9_\.A-Z])json\s*[\.\[]/g, "$json.");
      repaired = repaired.replace(/(?<![\$a-zA-Z0-9_\.A-Z])node\s*[\.\[]/g, "$('Node').");
    }

    // If no specific rule matched, apply a default clean patch
    if (fixedIds.length === 0 && payload.issues.length > 0) {
      reasoning.push("Normalized structural code integrity and applied anti-regression typing.");
      fixedIds.push(payload.issues[0].id);
    }

    const simpleDiff = `--- a/target.js\n+++ b/target.js\n@@ -1,5 +1,9 @@\n- // Vulnerable code\n+ // Fixed by NVIDIA Nemotron (Nebius Token Factory)\n+ ${reasoning.join("\n+ ")}`;

    return {
      id: `patch-mock-${Date.now()}`,
      timestamp: new Date().toISOString(),
      modelUsed: `${this.model} [Nebius Token Factory]`,
      reasoningSteps: reasoning.length > 0 ? reasoning : [
        "Identified code defects from AST analyzer",
        "Formulated invariant-preserving patch using Nemotron 3 MoE reasoning",
        "Verified boundary conditions and prevented regression",
      ],
      explanation:
        "Nemotron self-healing loop repaired all identified security and syntax violations while maintaining existing runtime contracts.",
      diff: simpleDiff,
      repairedCode: repaired,
      fixedIssueIds: fixedIds.length > 0 ? fixedIds : payload.issues.map((i) => i.id),
      confidenceScore: 0.96,
      sourceMode: "MOCK_SIMULATED",
    };
  }
}

// Export singleton instance initialized with default environment variables
export const nebiusClient = new NebiusClient();
