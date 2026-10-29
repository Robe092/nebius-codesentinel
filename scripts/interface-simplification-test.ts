import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3005";
const output = path.resolve(process.env.TEST_OUTPUT_DIR || "docs/progressive-ui-20261028");
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const results: Array<{ name: string; passed: boolean; error?: string }> = [];
async function check(name: string, run: (page: Awaited<ReturnType<typeof browser.newPage>>) => Promise<void>) {
  const page = await browser.newPage();
  try {
    await run(page);
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`FAIL ${name}: ${String(error)}`);
  } finally { await page.close(); }
}
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await check(`one clear action above the fold at ${viewport.width}x${viewport.height}`, async (page) => {
      await page.setViewport(viewport);
      await page.goto(baseURL, { waitUntil: "networkidle0" });
      assert.equal(await page.$eval("#btn-static-audit", e => e.textContent?.trim()), "Analyze code");
      assert.equal(await page.$(".results-shell"), null, "No empty review panel before analysis");
      assert.equal(await page.$("#btn-healing-loop"), null, "Repair follows analysis rather than competing on first load");
      assert.equal(await page.$$(".button-primary").then(es => es.length), 1);
      assert.equal(await page.$$eval("#scenario-select option", es => es.length), 3);
      const geometry = await page.$eval("#btn-static-audit", e => {
        const r = e.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: innerHeight, width: innerWidth };
      });
      assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.height && geometry.left >= 0 && geometry.right <= geometry.width, JSON.stringify(geometry));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, `initial-${viewport.width}.png`), fullPage: true });
    });
  }
  await check("findings, repair and evidence appear progressively and reset with source edits", async (page) => {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(baseURL, { waitUntil: "networkidle0" });
    await page.click("#btn-static-audit");
    await page.waitForSelector(".finding");
    await page.waitForFunction(() => !(document.querySelector("#btn-static-audit") as HTMLButtonElement)?.disabled);
    assert.deepEqual(await page.$$eval(".button-primary", elements => elements.map(e => e.id)), ["btn-healing-loop"], "Repair is the single primary action after analysis");
    // CSS color transitions briefly retain the old computed background after
    // the class changes. Observe the settled appearance, without a fixed sleep.
    await page.waitForFunction(() => document.querySelector("#btn-static-audit")!.getAnimations().every(animation => animation.playState !== "running"));
    const actionColors = await page.evaluate(() => ({
      analyze: getComputedStyle(document.querySelector("#btn-static-audit")!).backgroundColor,
      repair: getComputedStyle(document.querySelector("#btn-healing-loop")!).backgroundColor,
      analyzeClass: document.querySelector("#btn-static-audit")!.getAttribute("class"),
      repairClass: document.querySelector("#btn-healing-loop")!.getAttribute("class"),
    }));
    assert.notEqual(actionColors.analyze, actionColors.repair, `Analyze again must look secondary to repair: ${JSON.stringify(actionColors)}`);
    assert.equal(await page.$$(".finding").then(es => es.length), 3);
    assert.equal(await page.$eval(".audit-score strong", e => e.textContent), "45");
    assert.equal(await page.$("#tab-diff"), null, "Comparison is available only after a proposal");
    assert.equal(await page.$eval("#run-evidence", e => (e as HTMLDetailsElement).open), false);
    assert.equal(await page.$eval("#btn-healing-loop", e => e.textContent?.trim()), "Repair source");
    await page.screenshot({ path: path.join(output, "progressive-findings.png"), fullPage: true });
    let releaseRepair: (() => void) | undefined;
    const repairGate = new Promise<void>(resolve => { releaseRepair = resolve; });
    await page.setRequestInterception(true);
    page.on("request", async request => {
      if (request.url().endsWith("/api/heal")) await repairGate;
      await request.continue().catch(() => undefined);
    });
    try {
      await page.click("#btn-healing-loop");
      await page.waitForSelector("#tab-healing", { timeout: 2500 });
      assert.equal(await page.$eval("#tab-healing", e => e.getAttribute("aria-selected")), "true");
      assert.equal(await page.$eval('[role="tabpanel"]', e => e.getAttribute("aria-labelledby")), "tab-healing");
    } finally { releaseRepair?.(); }
    await page.waitForSelector("#session-score");
    assert.match(await page.$eval(".mode-disclosure", e => e.textContent || ""), /MOCK_SIMULATED/);
    assert.equal(await page.$eval("#run-evidence", e => (e as HTMLDetailsElement).open), false);
    await page.click("#tab-diff");
    await page.waitForSelector(".patch-comparison");
    await page.click("#run-evidence > summary");
    assert.equal(await page.$eval("#run-evidence", e => (e as HTMLDetailsElement).open), true);
    assert.match(await page.$eval(".evidence-list", e => e.textContent || ""), /100 \/ 100/);
    await page.click("#tab-audit");
    await page.click("textarea");
    await page.keyboard.type("// edited\n");
    await page.waitForFunction(() => !document.querySelector(".results-shell"));
    assert.equal(await page.$("#run-evidence"), null);
    assert.equal(await page.$eval("#btn-static-audit", e => e.textContent?.trim()), "Analyze code");
    await page.select("#scenario-select", "2");
    assert.match(await page.$eval("textarea", e => e.value), /processSecureBatch/);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "simplification-results.json"), JSON.stringify({ baseURL, results }, null, 2));
}
if (results.some(r => !r.passed)) process.exitCode = 1;
