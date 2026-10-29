import ts from "typescript";
import { CodeAnalyzer } from "./code-analyzer";

export interface FixtureVerificationResult {
  passed: boolean;
  output: string;
  phase: "STATIC_RULES" | "TYPECHECK" | "RUNTIME_EXECUTION" | "NONE";
  details: {
    staticPassed: boolean;
    staticScore: number;
    typecheckPassed: boolean;
    runtimeExecution: "NOT_VERIFIED";
    businessContract: "NOT_VERIFIED";
    error?: string;
  };
}

export type FixtureVerifierFn = (repairedCode: string) => Promise<FixtureVerificationResult>;

const AMBIENT_DECLARATIONS = `
declare const json: any;
declare const $json: any;
declare function verifyHumanApproval(event?: any): Promise<boolean>;
declare function dispatchSlackAlert(opts: any): Promise<any>;
declare const process: {
  env: Record<string, string | undefined>;
};
declare const event: any;
`;

const NOTIFIER_DECLARATIONS = `
export declare function dispatchSlackAlert(opts: any): Promise<any>;
`;

/**
 * Performs in-memory TypeScript semantic type checking without executing the code.
 * Detects type errors (e.g. assigning string to number) and syntax errors.
 * R1: Uses a stable virtual implementation path (/virtual/__evaluated_patch__.ts) independent
 * of the caller-supplied filename, preventing declaration file (.d.ts) bypasses and internal collisions.
 */
export function checkTypeScriptSemantic(code: string, fileName?: string): { passed: boolean; error?: string } {
  // R1 Fix: Stable virtual implementation path independent of caller filename
  const targetVirtualName = "/virtual/__evaluated_patch__.ts";
  const internalNotifierName = "/virtual/__sentinel_internal_notifier__.ts";
  const internalAmbientName = "/virtual/__sentinel_internal_ambient__.d.ts";

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(options);
  const origGetSourceFile = host.getSourceFile;
  const origFileExists = host.fileExists;

  host.getSourceFile = (name, languageVersion) => {
    if (name === targetVirtualName) return ts.createSourceFile(name, code, languageVersion);
    if (name === internalNotifierName) return ts.createSourceFile(name, NOTIFIER_DECLARATIONS, languageVersion);
    if (name === internalAmbientName) return ts.createSourceFile(name, AMBIENT_DECLARATIONS, languageVersion);
    return origGetSourceFile(name, languageVersion);
  };

  host.fileExists = (name) => {
    if (name === targetVirtualName || name === internalNotifierName || name === internalAmbientName) return true;
    return origFileExists(name);
  };

  host.resolveModuleNames = (moduleNames) => {
    return moduleNames.map((mod) => {
      if (mod === "./notifier" || mod.includes("notifier")) {
        return { resolvedFileName: internalNotifierName, isExternalLibraryImport: false };
      }
      return undefined;
    });
  };

  try {
    const program = ts.createProgram([targetVirtualName, internalNotifierName, internalAmbientName], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName === targetVirtualName);

    if (diagnostics.length > 0) {
      const firstError = diagnostics[0];
      const message = ts.flattenDiagnosticMessageText(firstError.messageText, "\n");
      return {
        passed: false,
        error: `TS${firstError.code}: ${message}`,
      };
    }

    return { passed: true };
  } catch (err: any) {
    return { passed: false, error: `TypeScript compiler error: ${err.message}` };
  }
}

/**
 * Creates a verifier for code patches.
 * Security boundary: Does NOT execute arbitrary or model-generated code within the host/application process.
 * Enforces:
 * 1. Static rule & invariant checks (eradication of secrets, HITL gatekeepers, expression syntax).
 * 2. In-memory TypeScript semantic type checking (type correctness & syntax without execution).
 * 3. Quarantines runtime execution: marks business contracts NOT_VERIFIED until dedicated isolated runner is available.
 */
export function createFixtureVerifier(fixtureName: string): FixtureVerifierFn {
  return async function verifyFixture(repairedCode: string): Promise<FixtureVerificationResult> {
    // --- Layer 1: Static Rules & Invariants ---
    const staticReport = CodeAnalyzer.analyze(repairedCode, fixtureName);
    if (staticReport.metrics.criticalCount > 0) {
      const firstCrit = staticReport.issues.find((i) => i.severity === "CRITICAL");
      return {
        passed: false,
        phase: "STATIC_RULES",
        output: `Static invariant failed: ${firstCrit?.message || "Critical violation present"} (Line ${firstCrit?.line || "?"})`,
        details: {
          staticPassed: false,
          staticScore: staticReport.score,
          typecheckPassed: false,
          runtimeExecution: "NOT_VERIFIED",
          businessContract: "NOT_VERIFIED",
          error: firstCrit?.message,
        },
      };
    }

    // --- Layer 2: TypeScript Semantic Type Checking (AST & compiler diagnostics, 0 execution) ---
    const typeCheck = checkTypeScriptSemantic(repairedCode, fixtureName);
    if (!typeCheck.passed) {
      return {
        passed: false,
        phase: "TYPECHECK",
        output: `TypeScript semantic check failed: ${typeCheck.error}`,
        details: {
          staticPassed: staticReport.passed,
          staticScore: staticReport.score,
          typecheckPassed: false,
          runtimeExecution: "NOT_VERIFIED",
          businessContract: "NOT_VERIFIED",
          error: typeCheck.error,
        },
      };
    }

    // --- Layer 3: Runtime Execution & Business Contract Suite ---
    // Security policy: Untrusted/generated code is NOT executed inside the application process.
    // node:vm is not an effective isolation sandbox (can escape via constructor chains).
    // Runtime execution is explicitly marked NOT_VERIFIED.
    const overallPassed = staticReport.passed;

    return {
      passed: overallPassed,
      phase: overallPassed ? "NONE" : "STATIC_RULES",
      output: overallPassed
        ? `Static rules passed (${staticReport.score}/100) + TypeScript semantic check passed. Runtime business execution NOT_VERIFIED (host process execution disabled for security isolation).`
        : `Static violations detected (${staticReport.issues.length} issues, score: ${staticReport.score}/100).`,
      details: {
        staticPassed: staticReport.passed,
        staticScore: staticReport.score,
        typecheckPassed: true,
        runtimeExecution: "NOT_VERIFIED",
        businessContract: "NOT_VERIFIED",
      },
    };
  };
}
