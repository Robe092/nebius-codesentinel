import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(".");

test("CLI: prints help when invoked without arguments or with help flag", async () => {
  const { stdout: help1 } = await execFileAsync("node", ["--import", "tsx", "bin/cli.ts", "help"], {
    cwd: PROJECT_ROOT,
  });
  assert.ok(help1.includes("Nebius CodeSentinel CLI"));
  assert.ok(help1.includes("USAGE:"));

  const { stdout: help2 } = await execFileAsync("node", ["--import", "tsx", "bin/cli.ts"], {
    cwd: PROJECT_ROOT,
  });
  assert.ok(help2.includes("Nebius CodeSentinel CLI"));
});

test("CLI: benchmark command prints architectural comparison without unsupported numbers", async () => {
  const { stdout } = await execFileAsync("node", ["--import", "tsx", "bin/cli.ts", "benchmark"], {
    cwd: PROJECT_ROOT,
  });
  assert.ok(stdout.includes("Nebius Token Factory + NVIDIA Nemotron"));
  assert.equal(stdout.includes("4.1x"), false);
  assert.equal(stdout.includes("8.3x"), false);
  assert.equal(stdout.includes("100.0%"), false);
  assert.ok(stdout.includes("unmeasured") || stdout.includes("Architectural"));
});

test("CLI: audit on clean workflow returns exit code 0 and 100/100 score", async () => {
  const { stdout } = await execFileAsync(
    "node",
    ["--import", "tsx", "bin/cli.ts", "audit", "samples/clean_workflow.ts"],
    { cwd: PROJECT_ROOT }
  );
  assert.ok(stdout.includes("Compliance Score: 100 / 100 [PASS]"));
  assert.ok(stdout.includes("Zero violations detected"));
});

test("CLI: audit on vulnerable workflow returns exit code 1 with detailed violations", async () => {
  try {
    await execFileAsync(
      "node",
      ["--import", "tsx", "bin/cli.ts", "audit", "samples/vulnerable_workflow.ts"],
      { cwd: PROJECT_ROOT }
    );
    assert.fail("Should have exited with non-zero code");
  } catch (err: any) {
    assert.equal(err.code, 1);
    assert.ok(err.stdout.includes("[CRITICAL] SEC-001"));
    assert.ok(err.stdout.includes("[HIGH] GOV-001"));
    assert.ok(err.stdout.includes("[MEDIUM] SYN-001"));
  }
});

test("CLI: heal dry-run proposes patch and exits with code 0 without modifying file", async () => {
  const samplePath = path.resolve("samples/vulnerable_workflow.ts");
  const originalContent = fs.readFileSync(samplePath, "utf-8");

  const { stdout } = await execFileAsync(
    "node",
    ["--import", "tsx", "bin/cli.ts", "heal", "samples/vulnerable_workflow.ts"],
    { cwd: PROJECT_ROOT }
  );
  assert.ok(stdout.includes("Healing Status: SUCCESS"));
  assert.ok(stdout.includes("Nemotron Reasoning:"));
  assert.ok(stdout.includes("Unified Diff:"));
  assert.ok(stdout.includes("Dry-run mode"));

  const contentAfterDryRun = fs.readFileSync(samplePath, "utf-8");
  assert.equal(contentAfterDryRun, originalContent);
});

test("CLI: heal with --apply overwrites file and fixes all violations", async () => {
  const tempPath = path.resolve("samples/temp_test_cli_heal.ts");
  const vulnerableContent = fs.readFileSync(path.resolve("samples/vulnerable_workflow.ts"), "utf-8");
  fs.writeFileSync(tempPath, vulnerableContent, "utf-8");

  try {
    const { stdout } = await execFileAsync(
      "node",
      ["--import", "tsx", "bin/cli.ts", "heal", "samples/temp_test_cli_heal.ts", "--apply"],
      { cwd: PROJECT_ROOT }
    );
    assert.ok(stdout.includes("Repaired code written to:"));

    // Verify the file was updated
    const repairedContent = fs.readFileSync(tempPath, "utf-8");
    assert.ok(repairedContent.includes("process.env.API_CREDENTIAL"));
    assert.ok(repairedContent.includes("$json."));

    // Verify audit now passes
    const { stdout: auditOut } = await execFileAsync(
      "node",
      ["--import", "tsx", "bin/cli.ts", "audit", "samples/temp_test_cli_heal.ts"],
      { cwd: PROJECT_ROOT }
    );
    assert.ok(auditOut.includes("Compliance Score: 100 / 100 [PASS]"));
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});

test("CLI: error handling for missing target file", async () => {
  try {
    await execFileAsync("node", ["--import", "tsx", "bin/cli.ts", "audit"], {
      cwd: PROJECT_ROOT,
    });
    assert.fail("Should have exited with error");
  } catch (err: any) {
    assert.equal(err.code, 1);
    assert.ok(err.stderr.includes("Target file path required"));
  }

  try {
    await execFileAsync(
      "node",
      ["--import", "tsx", "bin/cli.ts", "audit", "samples/does_not_exist.ts"],
      { cwd: PROJECT_ROOT }
    );
    assert.fail("Should have exited with error");
  } catch (err: any) {
    assert.equal(err.code, 1);
    assert.ok(err.stderr.includes("File not found"));
  }
});

test("CLI: heal with --apply does NOT overwrite file when outcome is not SUCCESS", async () => {
  const tempPath = path.resolve("samples/temp_test_cli_fail.ts");
  const invalidContent = `const secret = "sk-123456789012345678901234";\nexport function broken(): number {\n  return "not a number";\n}\n`;
  fs.writeFileSync(tempPath, invalidContent, "utf-8");

  try {
    try {
      await execFileAsync(
        "node",
        ["--import", "tsx", "bin/cli.ts", "heal", "samples/temp_test_cli_fail.ts", "--apply"],
        { cwd: PROJECT_ROOT }
      );
      assert.fail("Should have exited with error code 1");
    } catch (err: any) {
      assert.equal(err.code, 1);
    }

    // Verify file content was NOT overwritten
    const contentAfter = fs.readFileSync(tempPath, "utf-8");
    assert.equal(contentAfter, invalidContent);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});
