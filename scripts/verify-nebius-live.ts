import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import ts from "typescript";
import { CodeAnalyzer } from "../src/lib/code-analyzer";
import { checkTypeScriptSemantic } from "../src/lib/fixture-verifier";
import { executeBoundedInference, BoundedInferenceBudget } from "../src/lib/bounded-inference";

export interface LiveProbeResult {
  status: "PASS" | "FAIL" | "BLOCKED";
  testedAtUtc: string;
  endpoint: string;
  apiKeyConfigured: boolean;
  primaryAttempts: number;
  fallbackAttempts: number;
  totalAttempts: number;
  retriesCount: number;
  primaryModel: string;
  actualModelUsed?: string;
  responseId?: string;
  latencyMs?: number;
  tokensUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | "unknown";
  repairVerified?: boolean;
  details: string;
  rawResponseSnippet?: string;
}

export const CONTROLLED_DEMO_CREDENTIAL = "DEMO_ONLY_NOT_A_REAL_CREDENTIAL";

export const CONTROLLED_REPAIR_PAYLOAD = {
  systemPrompt:
    "You are the Nebius NVIDIA Nemotron CodeSentinel code healing engine. The code contains a fictitious demonstration placeholder, not a real credential. Replace that hardcoded placeholder with process.env.API_CREDENTIAL, preserving the function, and return a strict JSON object with fields: repairedCode (string), explanation (string), and diff (string).",
  userPrompt: `// Payment webhook invariant test fixture
const STRIPE_SECRET = "${CONTROLLED_DEMO_CREDENTIAL}";
export async function handlePayment(event: any) {
  return { status: "processed", email: event.customer?.email };
}
`,
};

interface ValidatedRepair {
  actualModelUsed: string;
  responseId: string;
  repairedCode: string;
  explanation: string;
  tokensUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | "unknown";
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) {
    expression = expression.expression;
  }
  return expression;
}

function propertyReceiver(expression: ts.Expression, property: string): ts.Expression | undefined {
  expression = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(expression) && expression.name.text === property) return expression.expression;
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression) &&
    expression.argumentExpression.text === property) return expression.expression;
  return undefined;
}

function validateControlledRepairStructure(code: string): void {
  const source = ts.createSourceFile("controlled-repair.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  let shadowsProcess = false;
  const visit = (node: ts.Node): void => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) ||
      ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isModuleDeclaration(node) ||
      ts.isEnumDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isImportClause(node) ||
      ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) &&
      node.name && ts.isIdentifier(node.name) && node.name.text === "process") shadowsProcess = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (shadowsProcess) throw new Error("Controlled repair must not shadow the process environment binding");

  const credential = source.statements.filter(ts.isVariableStatement)
    .filter((statement) => (statement.declarationList.flags & ts.NodeFlags.Const) !== 0)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "STRIPE_SECRET");
  let initializer = credential?.initializer && unwrapExpression(credential.initializer);
  if (initializer && ts.isBinaryExpression(initializer) &&
    (initializer.operatorToken.kind === ts.SyntaxKind.BarBarToken || initializer.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    const fallback = unwrapExpression(initializer.right);
    if (!ts.isStringLiteral(fallback) || fallback.text !== "") throw new Error("STRIPE_SECRET may only use an empty credential fallback");
    initializer = unwrapExpression(initializer.left);
  }
  const environment = initializer && propertyReceiver(initializer, "API_CREDENTIAL");
  const processBinding = environment && propertyReceiver(environment, "env");
  if (!processBinding || !ts.isIdentifier(unwrapExpression(processBinding)) ||
    unwrapExpression(processBinding).getText(source) !== "process") {
    throw new Error("Controlled repair must initialize STRIPE_SECRET from process.env.API_CREDENTIAL");
  }

  const handler = source.statements.find((statement) => ts.isFunctionDeclaration(statement) &&
    statement.name?.text === "handlePayment" && statement.body &&
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    !statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  if (!handler) throw new Error("Controlled repair must preserve the exported handlePayment function");
}

/**
 * Validates the model response rigorously without runtime code execution.
 * Enforces:
 * 1. Model provenance presence and NVIDIA/Nemotron family adherence.
 * 2. Non-empty response content and strict JSON structure.
 * 3. Non-empty repairedCode.
 * 4. Invariant satisfaction: eradication of plaintext secret & extraction to process.env.
 * 5. In-memory TypeScript semantic type checking on the repaired code.
 */
export function validateModelResponse(response: any): ValidatedRepair {
  if (!response || typeof response.model !== "string" || !response.model.trim()) {
    throw new Error("Missing or invalid model provenance in response: 'model' property is absent or empty");
  }

  if (!response.id || typeof response.id !== "string" || !response.id.trim()) {
    throw new Error("Missing or invalid response ID in response: 'id' property is absent or empty");
  }

  const modelLower = response.model.toLowerCase();
  const isFamilyExpected = modelLower.includes("nemotron") || modelLower.includes("nvidia");
  if (!isFamilyExpected) {
    throw new Error(`Unexpected model family returned: expected NVIDIA Nemotron family, got '${response.model}'`);
  }

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty response content received from model endpoint");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Model response content is not valid JSON: '${content.slice(0, 80)}'`);
  }

  if (!parsed || typeof parsed.repairedCode !== "string" || !parsed.repairedCode.trim()) {
    throw new Error("Missing or empty 'repairedCode' in model patch proposal");
  }

  if (parsed.repairedCode.includes(CONTROLLED_DEMO_CREDENTIAL) || parsed.repairedCode.includes("sk-live_98372498237498237498234")) {
    throw new Error("Repaired code still contains the plaintext credential invariant violation");
  }

  const audit = CodeAnalyzer.analyze(parsed.repairedCode, "payment_webhook.ts");
  if (audit.issues.length > 0) {
    throw new Error(`Static audit rejected repaired code: ${audit.issues[0].message}`);
  }

  const typeCheck = checkTypeScriptSemantic(parsed.repairedCode, "payment_webhook.ts");
  if (!typeCheck.passed) {
    throw new Error(`Repaired code failed TypeScript semantic check: ${typeCheck.error}`);
  }
  validateControlledRepairStructure(parsed.repairedCode);

  const tokensUsage = response.usage
    ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : ("unknown" as const);

  return {
    actualModelUsed: response.model,
    responseId: response.id,
    repairedCode: parsed.repairedCode,
    explanation: parsed.explanation || "Automated repair",
    tokensUsage,
  };
}

export async function runLiveVerification(options?: {
  client?: any;
  apiKey?: string;
  outputDir?: string;
  enableLiveRepair?: boolean;
}): Promise<LiveProbeResult> {
  const testedAtUtc = new Date().toISOString();
  const endpoint = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1/";
  const primaryModel = process.env.NEBIUS_MODEL || "nvidia/nemotron-3-super-120b-a12b";
  const fallbackModel = process.env.NEBIUS_FALLBACK_MODEL || "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

  // Check key from env, options, or .env.local without logging or leaking it
  let apiKey = options?.apiKey || process.env.NEBIUS_API_KEY || "";
  const envLocalPath = path.resolve(".env.local");
  if (!apiKey && fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, "utf-8").split("\n");
    for (const line of lines) {
      if (line.startsWith("NEBIUS_API_KEY=")) {
        apiKey = line.split("=")[1].trim();
      }
    }
  }

  const defaultDir = process.env.HANDOFF_DIR || "docs/handoff-antigravity-final-corrections-20261027";
  const targetDir = path.resolve(options?.outputDir || defaultDir);
  fs.mkdirSync(targetDir, { recursive: true });
  const outputFile = path.join(targetDir, "LIVE_NEBIUS_PROBE.json");

  // 1. Gate live execution: require ENABLE_LIVE_REPAIR === "true" for CLI;
  // If explicitly disabled (ENABLE_LIVE_REPAIR === "false" or enableLiveRepair === false), block even library callers.
  const isExplicitlyDisabled =
    process.env.ENABLE_LIVE_REPAIR === "false" || options?.enableLiveRepair === false;
  const isCli = Boolean(
    process.argv[1] &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
  const isBlockedByGate = isCli
    ? process.env.ENABLE_LIVE_REPAIR !== "true"
    : isExplicitlyDisabled;

  if (isBlockedByGate) {
    const blockedResult: LiveProbeResult = {
      status: "BLOCKED",
      testedAtUtc,
      endpoint,
      apiKeyConfigured: Boolean(apiKey && apiKey !== "your_nebius_api_key_here"),
      primaryAttempts: 0,
      fallbackAttempts: 0,
      totalAttempts: 0,
      retriesCount: 0,
      primaryModel,
      details:
        "ENABLE_LIVE_REPAIR is disabled or not set to true. Live inference transport is blocked to prevent unexpected costs.",
    };
    fs.writeFileSync(outputFile, JSON.stringify(blockedResult, null, 2), "utf-8");
    console.log(`ℹ️ [Nebius Live Probe] BLOCKED: ENABLE_LIVE_REPAIR gate active. Report saved to ${outputFile}`);
    return blockedResult;
  }

  // 2. If no valid key is configured, record BLOCKED status honestly (exit code 0)
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_nebius_api_key_here") {
    const blockedResult: LiveProbeResult = {
      status: "BLOCKED",
      testedAtUtc,
      endpoint,
      apiKeyConfigured: false,
      primaryAttempts: 0,
      fallbackAttempts: 0,
      totalAttempts: 0,
      retriesCount: 0,
      primaryModel,
      details:
        "NEBIUS_API_KEY is unset or contains mock placeholder. Cannot perform live inference without valid Nebius credentials. Simulation mode (MOCK_SIMULATED) remains active for zero-credit evaluation.",
    };
    fs.writeFileSync(outputFile, JSON.stringify(blockedResult, null, 2), "utf-8");
    console.log(`ℹ️ [Nebius Live Probe] BLOCKED: No active NEBIUS_API_KEY. Report saved to ${outputFile}`);
    return blockedResult;
  }

  console.log(`📡 [Nebius Live Probe] Initiating bounded live repair probe against ${endpoint}...`);
  const client =
    options?.client ||
    new OpenAI({
      baseURL: endpoint,
      apiKey,
      timeout: 30000,
      maxRetries: 0,
    });

  const budget: BoundedInferenceBudget = { maxRequests: 2, requestsUsed: 0 };
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  const start = Date.now();

  try {
    primaryAttempts++;
    const inferenceResult = await executeBoundedInference({
      client: client as any,
      model: primaryModel,
      messages: [
        { role: "system", content: CONTROLLED_REPAIR_PAYLOAD.systemPrompt },
        { role: "user", content: CONTROLLED_REPAIR_PAYLOAD.userPrompt },
      ],
      maxTokens: 4000,
      budget,
    });

    const latencyMs = Date.now() - start;
    const validated = validateModelResponse({
      id: inferenceResult.id,
      model: inferenceResult.model,
      usage: inferenceResult.usage
        ? {
            prompt_tokens: inferenceResult.usage.promptTokens,
            completion_tokens: inferenceResult.usage.completionTokens,
            total_tokens: inferenceResult.usage.totalTokens,
          }
        : undefined,
      choices: [{ finish_reason: "stop", message: { content: inferenceResult.content } }],
    });

    const successResult: LiveProbeResult = {
      status: "PASS",
      testedAtUtc,
      endpoint,
      apiKeyConfigured: true,
      primaryAttempts,
      fallbackAttempts,
      totalAttempts: primaryAttempts + fallbackAttempts,
      retriesCount: 0,
      primaryModel,
      actualModelUsed: validated.actualModelUsed,
      responseId: validated.responseId,
      latencyMs,
      tokensUsage: validated.tokensUsage,
      repairVerified: true,
      details: `Controlled repair passed static rules, TypeScript and fixture structure checks. Runtime NOT_VERIFIED. Model: ${validated.actualModelUsed}`,
      rawResponseSnippet: validated.repairedCode.slice(0, 120),
    };

    fs.writeFileSync(outputFile, JSON.stringify(successResult, null, 2), "utf-8");
    console.log(`✅ [Nebius Live Probe] PASS: Connected in ${latencyMs}ms. Model: ${validated.actualModelUsed}`);
    return successResult;
  } catch (err: any) {
    console.warn(`⚠️ [Nebius Live Probe] Primary model failed: ${err.message}. Attempting bounded fallback...`);

    try {
      fallbackAttempts++;
      const fbStart = Date.now();
      const fbInferenceResult = await executeBoundedInference({
        client: client as any,
        model: fallbackModel,
        messages: [
          { role: "system", content: CONTROLLED_REPAIR_PAYLOAD.systemPrompt },
          { role: "user", content: CONTROLLED_REPAIR_PAYLOAD.userPrompt },
        ],
        maxTokens: 4000,
        budget,
      });

      const latencyMs = Date.now() - fbStart;
      const validated = validateModelResponse({
        id: fbInferenceResult.id,
        model: fbInferenceResult.model,
        usage: fbInferenceResult.usage
          ? {
              prompt_tokens: fbInferenceResult.usage.promptTokens,
              completion_tokens: fbInferenceResult.usage.completionTokens,
              total_tokens: fbInferenceResult.usage.totalTokens,
            }
          : undefined,
        choices: [{ finish_reason: "stop", message: { content: fbInferenceResult.content } }],
      });

      const fallbackResult: LiveProbeResult = {
        status: "PASS",
        testedAtUtc,
        endpoint,
        apiKeyConfigured: true,
        primaryAttempts,
        fallbackAttempts,
        totalAttempts: primaryAttempts + fallbackAttempts,
        retriesCount: 0,
        primaryModel,
        actualModelUsed: validated.actualModelUsed,
        responseId: validated.responseId,
        latencyMs,
        tokensUsage: validated.tokensUsage,
        repairVerified: true,
        details: `Primary model failed (${err.message}); fallback ${validated.actualModelUsed} passed static rules, TypeScript and fixture structure checks. Runtime NOT_VERIFIED.`,
        rawResponseSnippet: validated.repairedCode.slice(0, 120),
      };

      fs.writeFileSync(outputFile, JSON.stringify(fallbackResult, null, 2), "utf-8");
      return fallbackResult;
    } catch (fbErr: any) {
      const failResult: LiveProbeResult = {
        status: "FAIL",
        testedAtUtc,
        endpoint,
        apiKeyConfigured: true,
        primaryAttempts,
        fallbackAttempts,
        totalAttempts: primaryAttempts + fallbackAttempts,
        retriesCount: 0,
        primaryModel,
        repairVerified: false,
        details: `Live connection failed on both primary (${err.message}) and fallback (${fbErr.message}).`,
      };
      fs.writeFileSync(outputFile, JSON.stringify(failResult, null, 2), "utf-8");
      return failResult;
    }
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runLiveVerification()
    .then((result) => { process.exitCode = result.status === "FAIL" ? 2 : 0; })
    .catch((err) => {
      console.error("Fatal in verify-nebius-live:", err);
      process.exitCode = 1;
    });
}
