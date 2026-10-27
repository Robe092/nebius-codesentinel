import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOTS_DIR = path.resolve("docs/screenshots");

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/nebius/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server failed to start on ${url} within ${timeoutMs}ms`);
}

async function runE2ETest() {
  console.log("🚀 [E2E Test] Starting Nebius CodeSentinel E2E Puppeteer Suite...");

  let serverProcess: ChildProcess | null = null;
  const alreadyRunning = await isServerUp(BASE_URL);

  if (!alreadyRunning) {
    console.log(`🌐 Spawning Next.js server on port ${PORT}...`);
    serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
      stdio: "pipe",
      shell: true,
    });

    await waitForServer(BASE_URL);
    console.log(`✅ Next.js server is live at ${BASE_URL}`);
  } else {
    console.log(`ℹ️ Next.js server is already running at ${BASE_URL}`);
  }

  console.log("🖥️ Launching Google Chrome headless via Puppeteer...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--window-size=1440,900",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    // 1. Load Studio Home
    console.log("🧭 Navigating to Studio Cockpit...");
    await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 20000 });

    const titleText = await page.evaluate(() => document.body.innerText);
    assert.ok(titleText.includes("Nebius CodeSentinel"), "Brand title must be displayed");
    assert.ok(titleText.includes("NVIDIA Nemotron"), "NVIDIA model badge must be present");
    assert.ok(titleText.includes("api.studio.nebius.ai"), "Nebius endpoint must be visible");

    // 2. Run Static Audit
    console.log("🔍 Testing Step 1: Static Audit execution...");
    await page.waitForSelector("#btn-static-audit", { timeout: 10000 });
    await page.click("#btn-static-audit");

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("VIOLATIONS DETECTED") ||
        document.body.innerText.includes("CRITICAL"),
      { timeout: 8000 }
    );

    const auditOutput = await page.evaluate(() => document.body.innerText);
    assert.ok(auditOutput.includes("CRITICAL"), "CRITICAL issue must be flagged");
    assert.ok(
      auditOutput.includes("HARDCODED_SECRET") ||
        auditOutput.includes("Plaintext credential"),
      "Secret violation must be identified"
    );

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "01-static-audit.png"),
      fullPage: false,
    });
    console.log("📸 Screenshot saved: 01-static-audit.png");

    // 3. Run NVIDIA Nemotron Self-Healing Loop
    console.log("⚡ Testing Step 2: NVIDIA Nemotron Self-Healing Loop...");
    await page.waitForSelector("#btn-healing-loop", { timeout: 5000 });
    await page.click("#btn-healing-loop");

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Autonomous Healing Completed") ||
        document.body.innerText.includes("Nemotron Reasoning Steps"),
      { timeout: 12000 }
    );

    const healOutput = await page.evaluate(() => document.body.innerText);
    console.log("DEBUG healOutput:\n", healOutput.slice(0, 1000));
    assert.ok(
      healOutput.includes("Autonomous Healing Completed") || healOutput.includes("Status: SUCCESS"),
      "Healing loop must report completed status"
    );
    assert.ok(
      healOutput.includes("Iteration #1"),
      "Execution trace must show iteration steps"
    );

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "02-nemotron-healing-loop.png"),
      fullPage: false,
    });
    console.log("📸 Screenshot saved: 02-nemotron-healing-loop.png");

    // 4. Inspect Unified Diff
    console.log("📄 Testing Step 3: Unified Diff & Patch Viewer...");
    await page.waitForSelector("#tab-diff", { timeout: 5000 });
    await page.evaluate(() => (document.getElementById("tab-diff") as HTMLElement)?.click());
    await new Promise((r) => setTimeout(r, 1000));
    const currentText = await page.evaluate(() => document.body.innerText);
    console.log("DEBUG diffTabText:\n", currentText.slice(currentText.indexOf("Unified Diff"), currentText.indexOf("Unified Diff") + 400));

    const diffOutput = await page.evaluate(() => document.body.innerText);
    assert.ok(
      diffOutput.includes("process.env.API_CREDENTIAL") ||
        diffOutput.includes("process.env."),
      "Patch must replace hardcoded secret with env var"
    );

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "03-unified-diff.png"),
      fullPage: false,
    });
    console.log("📸 Screenshot saved: 03-unified-diff.png");

    // 5. Comparateur A/B
    console.log("📊 Testing Step 4: Comparateur A/B Tab & Live Benchmarks...");
    await page.waitForSelector("#tab-benchmark", { timeout: 5000 });
    await page.evaluate(() => (document.getElementById("tab-benchmark") as HTMLElement)?.click());

    await page.waitForFunction(
      () =>
        document.body.innerText.includes(
          "A/B Benchmark: Nebius + NVIDIA Nemotron vs Baseline"
        ) && document.body.innerText.includes("4.1x plus rapide"),
      { timeout: 6000 }
    );

    const benchmarkText = await page.evaluate(() => document.body.innerText);
    assert.ok(benchmarkText.includes("840 ms"), "Latency metric must be 840 ms");
    assert.ok(
      benchmarkText.includes("100.0%"),
      "Zero-hallucination metric must be 100.0%"
    );
    assert.ok(benchmarkText.includes("$1.80"), "Cost metric must be $1.80");

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "04-ab-benchmark.png"),
      fullPage: true,
    });
    console.log("📸 Screenshot saved: 04-ab-benchmark.png");

    console.log("🎉 [E2E Test] All browser interactions verified successfully! 100% PASS.");
  } finally {
    await browser.close();
    if (serverProcess) {
      console.log("🛑 Terminating spawned Next.js server process...");
      serverProcess.kill("SIGTERM");
    }
  }
}

runE2ETest().catch((err) => {
  console.error("❌ E2E Browser Test Failed:", err);
  process.exit(1);
});
