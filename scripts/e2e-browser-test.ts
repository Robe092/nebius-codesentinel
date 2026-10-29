import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import puppeteer from "puppeteer-core";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3005";
const output = path.resolve(process.env.TEST_OUTPUT_DIR || "docs/interface-polish-20261027");
const downloads = path.join(output, "downloads");
fs.mkdirSync(downloads, { recursive: true });

async function serverAvailable() {
  try { return (await fetch(baseURL, { signal: AbortSignal.timeout(2500) })).ok; }
  catch { return false; }
}

let server: ChildProcess | undefined;
let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
const checks: string[] = [];
const passed = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };

try {
  if (!(await serverAvailable())) {
    server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "dev", "-p", new URL(baseURL).port || "3005"], { stdio: "ignore", env: { ...process.env, MOCK_MODE: "true" } });
    const deadline = Date.now() + 45_000;
    while (!(await serverAvailable())) {
      if (Date.now() > deadline) throw new Error("Local server did not become ready");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(baseURL, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("MOCK_SIMULATED"));
  assert.ok((await page.title()).includes("CodeSentinel"));
  assert.equal(await page.$$eval('[role="tab"]', (elements) => elements.length), 0);
  assert.equal(await page.$(".results-shell"), null);
  await page.screenshot({ path: path.join(output, "desktop-initial.png"), fullPage: true });
  passed("Initial workspace and explicit simulation provenance");

  const auditResponse = page.waitForResponse((response) => response.url().endsWith("/api/analyze") && response.request().method() === "POST");
  await page.click("#btn-static-audit");
  const audit = (await (await auditResponse).json()).data;
  await page.waitForSelector(".audit-score strong");
  await page.waitForFunction(() => !(document.querySelector("#btn-static-audit") as HTMLButtonElement)?.disabled);
  assert.equal(await page.$eval(".audit-score strong", (element) => Number(element.textContent)), audit.score);
  assert.equal(await page.$$(".finding").then((elements) => elements.length), audit.issues.length);
  assert.equal(audit.score, 45);
  assert.equal(audit.issues.length, 3);
  await page.screenshot({ path: path.join(output, "desktop-audit.png"), fullPage: true });
  passed("Real audit response drives the visible findings and score");

  await page.click(".finding:first-child .line-link");
  assert.ok((await page.$eval("textarea", (element) => element.value.slice(element.selectionStart, element.selectionEnd))).includes("STRIPE_SECRET"));
  passed("Finding navigation selects the actual source line");

  const healResponse = page.waitForResponse((response) => response.url().endsWith("/api/heal") && response.request().method() === "POST");
  await page.click("#btn-healing-loop");
  const session = (await (await healResponse).json()).data;
  await page.waitForSelector("#session-score");
  assert.equal(session.status, "SUCCESS");
  assert.equal(await page.$eval("#session-score", (element) => element.textContent?.trim()), `${session.finalReport.score} / 100`);
  assert.ok((await page.$eval(".mode-disclosure", (element) => element.textContent)).includes("MOCK_SIMULATED"));
  await page.screenshot({ path: path.join(output, "desktop-repair.png"), fullPage: true });
  passed("Repair trace shows the returned score and actual mode");

  await page.click("#tab-diff");
  await page.waitForSelector(".patch-comparison");
  const comparison = await page.$eval(".comparison-grid", (element) => element.textContent);
  assert.ok(comparison.includes("sk-live_98372498237498237498234"));
  assert.ok(comparison.includes("process.env.API_CREDENTIAL"));
  assert.ok(comparison.includes("verifyHumanApproval"));
  assert.ok((await page.$eval(".results-column", (element) => element.getBoundingClientRect().width)) > 900);
  await page.screenshot({ path: path.join(output, "desktop-changes.png"), fullPage: true });
  passed("Full-width comparison uses actual source lines rather than the simulated diff summary");

  await page.click("#run-evidence > summary");
  await page.waitForSelector(".evidence-list");
  const evidenceText = await page.$eval(".evidence-list", (element) => element.textContent);
  assert.match(evidenceText, /45 \/ 100/);
  assert.match(evidenceText, /100 \/ 100/);
  assert.match(evidenceText, /MOCK_SIMULATED/);
  assert.ok(!evidenceText.includes("840 ms"));
  assert.ok(!evidenceText.includes("4.1x"));
  await page.screenshot({ path: path.join(output, "desktop-evidence.png"), fullPage: true });
  passed("Evidence contains measured request timings without invented comparison metrics");

  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  const downloadedFile = path.join(downloads, "payment_webhook-evidence.json");
  fs.rmSync(downloadedFile, { force: true });
  await page.click(".export-action");
  const deadline = Date.now() + 5000;
  let downloaded;
  while (true) {
    try {
      downloaded = JSON.parse(fs.readFileSync(downloadedFile, "utf8"));
      break;
    } catch (error) {
      if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (Date.now() > deadline) throw new Error("Evidence download did not finish with valid JSON");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.equal(downloaded.audit.score, 45);
  assert.equal(downloaded.repair.sessionId, session.sessionId);
  assert.equal(downloaded.repair.currentCode, session.currentCode);
  assert.equal(downloaded.source, session.originalCode);
  assert.equal(typeof downloaded.requestTimings.repairMs, "number");
  passed("Downloaded JSON contains the source and the actual session record");

  await page.focus("#tab-audit");
  await page.keyboard.press("End");
  assert.equal(await page.$eval("#tab-diff", (element) => element.getAttribute("aria-selected")), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-diff");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-healing");
  passed("Result tabs support keyboard navigation and selection");

  await page.click("#tab-audit");
  await page.select("#scenario-select", "2");
  assert.equal(await page.$(".audit-score"), null);
  await page.click("#btn-static-audit");
  await page.waitForSelector(".clean-result");
  assert.equal(await page.$eval(".audit-score strong", (element) => element.textContent), "100");
  assert.equal(await page.$("#btn-healing-loop"), null, "Clean audit needs no repair or model call");
  passed("Clean source needs no model call and changing scenarios clears previous results");

  await page.click("#tab-audit");
  await page.click("textarea");
  await page.$eval("textarea", (element) => element.select());
  await page.keyboard.press("Backspace");
  assert.equal(await page.$eval("textarea", (element) => element.value), "");
  assert.equal(await page.$eval("#btn-static-audit", (element) => (element as HTMLButtonElement).disabled), true);
  assert.equal(await page.$("#btn-healing-loop"), null);
  passed("Empty source disables analysis and keeps repair unavailable");

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.goto(baseURL, { waitUntil: "networkidle0" });
    await page.click("#btn-static-audit");
    await page.waitForSelector(".finding");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `No page overflow at ${viewport.width}px`);
    await page.screenshot({ path: path.join(output, `audit-${viewport.width}.png`), fullPage: true });
    passed(`Audit layout at ${viewport.width} × ${viewport.height}`);
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(baseURL, { waitUntil: "networkidle0" });
  await page.click("#btn-autopilot");
  await page.waitForSelector(".patch-comparison", { timeout: 20_000 });
  assert.equal(await page.$eval("#tab-diff", (element) => element.getAttribute("aria-selected")), "true");
  assert.match(await page.$eval(".notice", (element) => element.textContent), /Guided demo complete/);
  passed("Guided demonstration waits for responses and opens the returned source comparison");

  assert.deepEqual(pageErrors, []);
  passed("No uncaught browser errors throughout the journey");
  fs.writeFileSync(path.join(output, "journey-results.json"), JSON.stringify({ timestamp: new Date().toISOString(), baseURL, mode: "MOCK_SIMULATED", checks }, null, 2));
  console.log(`Verified ${checks.length} browser checks.`);
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
