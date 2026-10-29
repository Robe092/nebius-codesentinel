import ts from "typescript";

export interface PatchStructureResult {
  passed: boolean;
  error?: string;
}

interface ExportedFunction {
  kind: "function";
  name: string;
  isDefault: boolean;
  paramCount: number;
  params: Array<{
    name: string;
    type?: string;
    isOptional: boolean;
    isRest: boolean;
  }>;
  returnType?: string;
  isAsync: boolean;
}

interface ExportedVariable {
  kind: "variable";
  name: string;
  isDefault: boolean;
  type?: string;
}

interface ExportedOther {
  kind: "class" | "interface" | "type" | "default";
  name: string;
  isDefault: boolean;
}

type ExportedSymbol = ExportedFunction | ExportedVariable | ExportedOther;

function findLocalDeclaration(
  source: ts.SourceFile,
  localName: string
): ts.Statement | ts.Declaration | undefined {
  for (const stmt of source.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === localName) {
      return stmt;
    }
    if (ts.isClassDeclaration(stmt) && stmt.name?.text === localName) {
      return stmt;
    }
    if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === localName) {
      return stmt;
    }
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === localName) {
      return stmt;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === localName) {
          return decl;
        }
      }
    }
  }
  return undefined;
}

function extractFunctionSymbol(
  name: string,
  fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  isDefault: boolean,
  source: ts.SourceFile
): ExportedFunction {
  const isAsync = fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  const params = fn.parameters.map((p) => ({
    name: p.name.getText(source),
    type: p.type?.getText(source),
    isOptional: p.questionToken !== undefined || p.initializer !== undefined,
    isRest: p.dotDotDotToken !== undefined,
  }));
  const returnType = fn.type?.getText(source);

  return {
    kind: "function",
    name,
    isDefault,
    paramCount: params.length,
    params,
    returnType,
    isAsync,
  };
}

function getExportedSymbols(source: ts.SourceFile): Map<string, ExportedSymbol> {
  const exportsMap = new Map<string, ExportedSymbol>();

  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

    if (isExported) {
      if (isDefault) {
        // Named or anonymous default export
        if (ts.isFunctionDeclaration(statement)) {
          exportsMap.set("default", extractFunctionSymbol("default", statement, true, source));
        } else if (ts.isClassDeclaration(statement)) {
          exportsMap.set("default", { kind: "class", name: "default", isDefault: true });
        } else {
          exportsMap.set("default", { kind: "default", name: "default", isDefault: true });
        }
      } else {
        if (ts.isFunctionDeclaration(statement)) {
          const name = statement.name?.text;
          if (name) {
            exportsMap.set(name, extractFunctionSymbol(name, statement, false, source));
          }
        } else if (ts.isVariableStatement(statement)) {
          for (const decl of statement.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              const name = decl.name.text;
              if (
                decl.initializer &&
                (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
              ) {
                exportsMap.set(name, extractFunctionSymbol(name, decl.initializer, false, source));
              } else {
                exportsMap.set(name, {
                  kind: "variable",
                  name,
                  isDefault: false,
                  type: decl.type?.getText(source),
                });
              }
            }
          }
        } else if (ts.isClassDeclaration(statement)) {
          const name = statement.name?.text;
          if (name) {
            exportsMap.set(name, { kind: "class", name, isDefault: false });
          }
        } else if (ts.isInterfaceDeclaration(statement)) {
          exportsMap.set(statement.name.text, { kind: "interface", name: statement.name.text, isDefault: false });
        } else if (ts.isTypeAliasDeclaration(statement)) {
          exportsMap.set(statement.name.text, { kind: "type", name: statement.name.text, isDefault: false });
        }
      }
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const spec of statement.exportClause.elements) {
          const exportedName = spec.name.text;
          const localName = spec.propertyName?.text || spec.name.text;
          const isDef = exportedName === "default";
          const localDecl = findLocalDeclaration(source, localName);

          if (localDecl && ts.isFunctionDeclaration(localDecl)) {
            exportsMap.set(exportedName, extractFunctionSymbol(exportedName, localDecl, isDef, source));
          } else if (
            localDecl &&
            ts.isVariableDeclaration(localDecl) &&
            localDecl.initializer &&
            (ts.isArrowFunction(localDecl.initializer) || ts.isFunctionExpression(localDecl.initializer))
          ) {
            exportsMap.set(exportedName, extractFunctionSymbol(exportedName, localDecl.initializer, isDef, source));
          } else if (localDecl && ts.isClassDeclaration(localDecl)) {
            exportsMap.set(exportedName, { kind: "class", name: exportedName, isDefault: isDef });
          } else if (localDecl && ts.isInterfaceDeclaration(localDecl)) {
            exportsMap.set(exportedName, { kind: "interface", name: exportedName, isDefault: isDef });
          } else if (localDecl && ts.isTypeAliasDeclaration(localDecl)) {
            exportsMap.set(exportedName, { kind: "type", name: exportedName, isDefault: isDef });
          } else {
            exportsMap.set(exportedName, { kind: "variable", name: exportedName, isDefault: isDef });
          }
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      const isDef = true;
      if (ts.isIdentifier(statement.expression)) {
        const localDecl = findLocalDeclaration(source, statement.expression.text);
        if (localDecl && ts.isFunctionDeclaration(localDecl)) {
          exportsMap.set("default", extractFunctionSymbol("default", localDecl, true, source));
        } else if (
          localDecl &&
          ts.isVariableDeclaration(localDecl) &&
          localDecl.initializer &&
          (ts.isArrowFunction(localDecl.initializer) || ts.isFunctionExpression(localDecl.initializer))
        ) {
          exportsMap.set("default", extractFunctionSymbol("default", localDecl.initializer, true, source));
        } else {
          exportsMap.set("default", { kind: "default", name: "default", isDefault: isDef });
        }
      } else {
        exportsMap.set("default", { kind: "default", name: "default", isDefault: isDef });
      }
    }
  }

  return exportsMap;
}

/**
 * Validates structural integrity between original source and proposed patch candidate.
 * Rejects blank candidates, removed exports, and signature alterations.
 */
export function checkPatchStructure(originalCode: string, candidateCode: string): PatchStructureResult {
  if (!candidateCode || candidateCode.trim().length === 0) {
    return { passed: false, error: "Candidate patch is empty or whitespace only" };
  }

  const origSource = ts.createSourceFile("original.ts", originalCode, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const candSource = ts.createSourceFile("candidate.ts", candidateCode, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  if (candSource.statements.length === 0 && origSource.statements.length > 0) {
    return { passed: false, error: "Candidate patch has no statements while original code had content" };
  }

  const origExports = getExportedSymbols(origSource);
  const candExports = getExportedSymbols(candSource);

  for (const [name, origExp] of origExports) {
    const candExp = candExports.get(name);
    if (!candExp) {
      return {
        passed: false,
        error: `Candidate patch removed exported ${origExp.kind} '${name}'`,
      };
    }

    if (origExp.kind !== candExp.kind) {
      return {
        passed: false,
        error: `Candidate patch changed exported ${origExp.kind} '${name}' to a non-${origExp.kind} ${candExp.kind}`,
      };
    }

    if (origExp.kind === "function" && candExp.kind === "function") {
      // 1. Verify async modifier contract
      if (origExp.isAsync !== candExp.isAsync) {
        return {
          passed: false,
          error: `Candidate patch changed async modifier on exported function '${name}': expected async=${origExp.isAsync}, got async=${candExp.isAsync}`,
        };
      }

      // 2. Verify explicit return type contract
      if (origExp.returnType && (!candExp.returnType || origExp.returnType !== candExp.returnType)) {
        return {
          passed: false,
          error: `Candidate patch altered return type of exported function '${name}': expected '${origExp.returnType}', got '${candExp.returnType || "unspecified"}'`,
        };
      }

      // 3. Verify parameter count
      if (origExp.paramCount !== candExp.paramCount) {
        return {
          passed: false,
          error: `Candidate patch changed signature of exported function '${name}': expected ${origExp.paramCount} parameter(s), got ${candExp.paramCount}`,
        };
      }

      // 4. Verify parameter types, optionality, and rest flags
      for (let i = 0; i < origExp.params.length; i++) {
        const origParam = origExp.params[i];
        const candParam = candExp.params[i];

        if (origParam.type && (!candParam.type || origParam.type !== candParam.type)) {
          return {
            passed: false,
            error: `Candidate patch altered parameter type annotation for '${name}' parameter '${origParam.name}': expected '${origParam.type}', got '${candParam.type || "unspecified"}'`,
          };
        }

        if (origParam.isOptional !== candParam.isOptional) {
          return {
            passed: false,
            error: `Candidate patch changed optionality of parameter '${origParam.name}' on exported function '${name}': expected optional=${origParam.isOptional}, got optional=${candParam.isOptional}`,
          };
        }

        if (origParam.isRest !== candParam.isRest) {
          return {
            passed: false,
            error: `Candidate patch changed rest parameter contract for '${origParam.name}' on exported function '${name}'`,
          };
        }
      }
    }
  }

  return { passed: true };
}
