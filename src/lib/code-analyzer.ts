import ts from "typescript";
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

function unwrapParens(expr: ts.Expression): ts.Expression {
  let curr = expr;
  while (ts.isParenthesizedExpression(curr)) {
    curr = curr.expression;
  }
  return curr;
}

function evaluateApprovalCondition(
  rawExpr: ts.Expression,
  sourceFile: ts.SourceFile
): "POSITIVE" | "NEGATIVE" | "NONE" {
  const expr = unwrapParens(rawExpr);

  // String literals or template strings are constants, not approval checks
  if (
    ts.isStringLiteral(expr) ||
    ts.isNoSubstitutionTemplateLiteral(expr) ||
    ts.isTemplateExpression(expr)
  ) {
    return "NONE";
  }

  // Negation: !(cond)
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const inner = evaluateApprovalCondition(expr.operand, sourceFile);
    if (inner === "POSITIVE") return "NEGATIVE";
    if (inner === "NEGATIVE") return "POSITIVE";
    return "NONE";
  }

  // Binary expressions: checking against boolean literals
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    const leftText = expr.left.getText(sourceFile);
    const rightText = expr.right.getText(sourceFile);

    const isRightFalse = rightText === "false" || expr.right.kind === ts.SyntaxKind.FalseKeyword;
    const isLeftFalse = leftText === "false" || expr.left.kind === ts.SyntaxKind.FalseKeyword;
    const isRightTrue = rightText === "true" || expr.right.kind === ts.SyntaxKind.TrueKeyword;
    const isLeftTrue = leftText === "true" || expr.left.kind === ts.SyntaxKind.TrueKeyword;

    if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken) {
      if (isRightFalse) {
        const inner = evaluateApprovalCondition(expr.left, sourceFile);
        return inner === "POSITIVE" ? "NEGATIVE" : "NONE";
      }
      if (isLeftFalse) {
        const inner = evaluateApprovalCondition(expr.right, sourceFile);
        return inner === "POSITIVE" ? "NEGATIVE" : "NONE";
      }
      if (isRightTrue) return evaluateApprovalCondition(expr.left, sourceFile);
      if (isLeftTrue) return evaluateApprovalCondition(expr.right, sourceFile);
    }

    if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken) {
      if (isRightFalse) return evaluateApprovalCondition(expr.left, sourceFile);
      if (isLeftFalse) return evaluateApprovalCondition(expr.right, sourceFile);
      if (isRightTrue) {
        const inner = evaluateApprovalCondition(expr.left, sourceFile);
        return inner === "POSITIVE" ? "NEGATIVE" : "NONE";
      }
      if (isLeftTrue) {
        const inner = evaluateApprovalCondition(expr.right, sourceFile);
        return inner === "POSITIVE" ? "NEGATIVE" : "NONE";
      }
    }

    // Any other binary operator (e.g. ||, &&) is an unsupported compound condition
    return "NONE";
  }

  // Await expression: await verifyHumanApproval(...)
  if (ts.isAwaitExpression(expr)) {
    return evaluateApprovalCondition(expr.expression, sourceFile);
  }

  // Identifiers with approval-related names
  if (ts.isIdentifier(expr)) {
    if (/^(isapproved|hasapproval|approved|approval|is_approved|has_approval)$/i.test(expr.text)) {
      return "POSITIVE";
    }
    return "NONE";
  }

  // Property access expression: e.g. event.isApproved, gatekeeper.approval
  if (ts.isPropertyAccessExpression(expr)) {
    if (/^(isapproved|hasapproval|approved|approval|is_approved|has_approval)$/i.test(expr.name.text)) {
      return "POSITIVE";
    }
    return "NONE";
  }

  // Call expressions: only recognize supported approval functions/methods
  if (ts.isCallExpression(expr)) {
    if (ts.isIdentifier(expr.expression)) {
      if (/^(verifyhuman(approval)?|gatekeeper(approval)?|hitl(approval)?|checkapproval|verifyapproval|isapproved|hasapproval)$/i.test(expr.expression.text)) {
        return "POSITIVE";
      }
    } else if (ts.isPropertyAccessExpression(expr.expression)) {
      const methodName = expr.expression.name.text;
      const receiverText = expr.expression.expression.getText(sourceFile);
      if (
        /^(verifyhuman(approval)?|gatekeeper(approval)?|hitl(approval)?|checkapproval|verifyapproval)$/i.test(methodName) ||
        (/^(approve|approval|isapproved|hasapproval|verify|check)$/i.test(methodName) &&
          /(gatekeeper|hitl|approval|guardrail)/i.test(receiverText))
      ) {
        return "POSITIVE";
      }
    }
    return "NONE";
  }

  return "NONE";
}

function isNodeDescendantOf(node: ts.Node, parent: ts.Node): boolean {
  if (node === parent) return true;
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (curr === parent) return true;
    curr = curr.parent;
  }
  return false;
}

function statementExits(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) {
    return true;
  }
  if (ts.isBlock(stmt)) {
    for (const s of stmt.statements) {
      if (statementExits(s)) {
        return true;
      }
    }
  }
  return false;
}

function isGuardedByConditionalApproval(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let child = node;
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isIfStatement(current)) {
      const cond = evaluateApprovalCondition(current.expression, sourceFile);
      if (cond === "POSITIVE" && isNodeDescendantOf(child, current.thenStatement)) {
        return true;
      }
      if (cond === "NEGATIVE" && current.elseStatement && isNodeDescendantOf(child, current.elseStatement)) {
        return true;
      }
    }
    child = current;
    current = current.parent;
  }
  return false;
}

function hasPrecedingApprovalGuard(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let block: ts.Node | undefined = node.parent;
  while (block && !ts.isBlock(block) && !ts.isSourceFile(block)) {
    block = block.parent;
  }
  if (!block) return false;

  const statements = ts.isBlock(block) ? block.statements : (block as ts.SourceFile).statements;
  const nodePos = node.getStart(sourceFile);

  for (const stmt of statements) {
    if (stmt.getStart(sourceFile) >= nodePos) break;
    if (ts.isIfStatement(stmt)) {
      const cond = evaluateApprovalCondition(stmt.expression, sourceFile);
      if (cond === "NEGATIVE" && statementExits(stmt.thenStatement)) {
        return true;
      }
      if (cond === "POSITIVE" && stmt.elseStatement && statementExits(stmt.elseStatement)) {
        return true;
      }
    }
  }
  return false;
}

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

    // 2. Scan for un-guarded direct communication dispatches using AST conditional check
    const sourceFile = ts.createSourceFile(
      targetName,
      code,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    const isCommCall = (text: string): { isComm: boolean; comm: string } => {
      const lower = text.toLowerCase();
      for (const comm of FORBIDDEN_COMMS) {
        if (
          lower.includes(comm.toLowerCase()) &&
          (lower.includes("post") || lower.includes("send") || lower.includes("dispatch") || lower.includes("api."))
        ) {
          return { isComm: true, comm };
        }
      }
      return { isComm: false, comm: "" };
    };

    const flaggedLines = new Set<number>();

    const checkNode = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const exprText = node.expression.getText(sourceFile);
        const { isComm, comm } = isCommCall(exprText);
        if (isComm) {
          const guarded =
            isGuardedByConditionalApproval(node, sourceFile) ||
            hasPrecedingApprovalGuard(node, sourceFile);

          if (!guarded) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            const lineNum = line + 1;
            if (!flaggedLines.has(lineNum)) {
              flaggedLines.add(lineNum);
              issues.push({
                id: `issue-${issueCounter++}`,
                ruleId: "GOV-001",
                category: "FORBIDDEN_DIRECT_COMMUNICATION",
                severity: "HIGH",
                message: `Unguarded direct dispatch to external channel (${comm}) without HITL approval or circuit breaker.`,
                line: lineNum,
                snippet: lines[line]?.trim() || exprText,
                autoFixable: true,
                remediationHint: "Enforce Human-in-the-Loop approval gate before dispatch.",
              });
            }
          }
        }
      }
      ts.forEachChild(node, checkNode);
    };

    checkNode(sourceFile);

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
