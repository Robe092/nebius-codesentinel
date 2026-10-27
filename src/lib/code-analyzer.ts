import { CodeIssue, AuditReport } from "@/types";

const SECRET_REGEXES = [
  { pattern: /bearer\s+[a-zA-Z0-9_\-\.]{15,}/i, name: "Bearer Token" },
  { pattern: /sk-[a-zA-Z0-9]{20,}/i, name: "OpenAI/API Secret Key" },
  { pattern: /ghp_[a-zA-Z0-9]{30,}/i, name: "GitHub Personal Access Token" },
  { pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_\-]{12,}["']/i, name: "Hardcoded API Key" },
  { pattern: /secret\s*[:=]\s*["'][a-zA-Z0-9_\-]{12,}["']/i, name: "Hardcoded Secret" },
  { pattern: /password\s*[:=]\s*["'][^"']{6,}["']/i, name: "Hardcoded Password" },
];

const FORBIDDEN_COMMS = [
  "slack",
  "discord",
  "sendgrid",
  "mailgun",
  "twilio",
  "emailSend",
  "gmail",
];

export class CodeAnalyzer {
  /**
   * Performs comprehensive static analysis inspired by n8n_code_analyzer.py and gitlab-duo-sentinel
   */
  public static analyze(code: string, targetName: string = "target.ts"): AuditReport {
    const issues: CodeIssue[] = [];
    const lines = code.split("\n");
    let issueCounter = 1;

    // 1. Scan for hardcoded secrets
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      for (const secretRule of SECRET_REGEXES) {
        if (secretRule.pattern.test(line)) {
          issues.push({
            id: `issue-${issueCounter++}`,
            ruleId: "SEC-001",
            category: "HARDCODED_SECRET",
            severity: "CRITICAL",
            message: `Plaintext credential detected: ${secretRule.name}. Violates security invariant.`,
            line: idx + 1,
            snippet: line.trim(),
            autoFixable: true,
            remediationHint: "Replace with environment variable (e.g. process.env.API_KEY).",
          });
        }
      }
    }

    // 2. Scan for un-guarded direct communication dispatches
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].toLowerCase();
      if (line.trim().startsWith("import ") || line.trim().startsWith("//") || line.trim().startsWith("/*")) {
        continue;
      }
      for (const comm of FORBIDDEN_COMMS) {
        if (
          line.includes(comm) &&
          (line.includes("post") || line.includes("send") || line.includes("dispatch") || line.includes("api."))
        ) {
          // Check if there is an approval or guardrail in the preceding lines (excluding comment lines)
          const windowStart = Math.max(0, idx - 5);
          const precedingContext = lines
            .slice(windowStart, idx)
            .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("/*") && !l.trim().startsWith("*"))
            .join(" ")
            .toLowerCase();
          const hasGuardrail =
            precedingContext.includes("approv") ||
            precedingContext.includes("guardrail") ||
            precedingContext.includes("gatekeeper") ||
            precedingContext.includes("hitl") ||
            precedingContext.includes("verifyhuman");

          if (!hasGuardrail) {
            issues.push({
              id: `issue-${issueCounter++}`,
              ruleId: "GOV-001",
              category: "FORBIDDEN_DIRECT_COMMUNICATION",
              severity: "HIGH",
              message: `Unguarded direct dispatch to external channel (${comm}) without HITL approval or circuit breaker.`,
              line: idx + 1,
              snippet: lines[idx].trim(),
              autoFixable: true,
              remediationHint: "Enforce Human-in-the-Loop approval gate before dispatch.",
            });
          }
        }
      }
    }

    // 3. Scan for n8n expression anomalies
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      // Missing leading $ before json.something
      const missingDollarJson = /(?<![\$a-zA-Z0-9_\.A-Z])json\s*[\.\[]/.test(line);
      if (missingDollarJson && !line.includes("JSON.")) {
        issues.push({
          id: `issue-${issueCounter++}`,
          ruleId: "SYN-001",
          category: "EXPRESSION_SYNTAX",
          severity: "MEDIUM",
          message: "n8n expression syntax error: missing leading '$' in json reference. Must be $json.",
          line: idx + 1,
          snippet: line.trim(),
          autoFixable: true,
          remediationHint: "Prepend '$' to make it $json.prop.",
        });
      }

      // Empty {{ }} expressions
      if (/\{\{\s*\}\}/.test(line)) {
        issues.push({
          id: `issue-${issueCounter++}`,
          ruleId: "SYN-002",
          category: "EXPRESSION_SYNTAX",
          severity: "LOW",
          message: "Empty expression placeholder detected '{{ }}'.",
          line: idx + 1,
          snippet: line.trim(),
          autoFixable: true,
          remediationHint: "Fill or remove empty placeholder.",
        });
      }
    }

    // 4. Deprecated components check
    const deprecatedPatterns = [
      { pattern: /basicLLMChain/i, name: "basicLLMChain (deprecated LangChain node)" },
      { pattern: /eval\s*\(/i, name: "eval() dynamic execution (dangerous)" },
    ];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      for (const dep of deprecatedPatterns) {
        if (dep.pattern.test(line)) {
          issues.push({
            id: `issue-${issueCounter++}`,
            ruleId: "DEP-001",
            category: "DEPRECATED_COMPONENT",
            severity: "HIGH",
            message: `Deprecated or dangerous construct found: ${dep.name}.`,
            line: idx + 1,
            snippet: line.trim(),
            autoFixable: true,
            remediationHint: "Upgrade to modern chainLlm or safe parser construct.",
          });
        }
      }
    }

    // Compute metrics and compliance score (100 - penalties)
    let score = 100;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const issue of issues) {
      switch (issue.severity) {
        case "CRITICAL":
          score -= 30;
          criticalCount++;
          break;
        case "HIGH":
          score -= 15;
          highCount++;
          break;
        case "MEDIUM":
          score -= 10;
          mediumCount++;
          break;
        case "LOW":
        case "INFO":
          score -= 5;
          lowCount++;
          break;
      }
    }

    score = Math.max(0, score);
    const passed = criticalCount === 0 && highCount === 0;

    return {
      targetName,
      timestamp: new Date().toISOString(),
      score,
      passed,
      issues,
      metrics: {
        totalLines: lines.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
      },
    };
  }
}
