"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, LoaderCircle, Play, RotateCcw, ShieldCheck, Sparkles, Square, TriangleAlert, X } from "lucide-react";
import { AuditReportSchema, SelfHealingSessionSchema, type AuditReport, type SelfHealingSession } from "@/types";
import { WORKSPACE_SAMPLES } from "@/lib/workspace-samples";
import { CodePane } from "@/components/code-pane";
import { EvidenceView, ResultPanel, ResultTabs, type ResultTab, type RunTiming } from "@/components/result-views";

interface Health {
  connected: boolean;
  configured?: boolean;
  model: string;
  mode: "LIVE_NEBIUS" | "MOCK_SIMULATED";
  latencyMs: number;
  message?: string;
}

export default function CockpitStudio() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [code, setCode] = useState(WORKSPACE_SAMPLES[0].code);
  const [filename, setFilename] = useState(WORKSPACE_SAMPLES[0].filename);
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [initialReport, setInitialReport] = useState<AuditReport | null>(null);
  const [session, setSession] = useState<SelfHealingSession | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("audit");
  const [busy, setBusy] = useState<"audit" | "healing" | null>(null);
  const [error, setError] = useState<{ message: string; operation?: "audit" | "healing" } | null>(null);
  const [timings, setTimings] = useState<RunTiming>({});
  const [focusLine, setFocusLine] = useState<{ line: number; key: number } | null>(null);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const requestController = useRef<AbortController | null>(null);
  const demoActive = useRef(false);
  const demoGeneration = useRef(0);
  const operationActive = useRef(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/nebius/health", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success || !["MOCK_SIMULATED", "LIVE_NEBIUS"].includes(payload.data?.mode) || typeof payload.data.connected !== "boolean") throw new Error("Health unavailable");
        setHealth(payload.data);
      })
      .catch((reason) => { if (reason.name !== "AbortError") setHealthFailed(true); });
    return () => {
      controller.abort(); demoActive.current = false; requestController.current?.abort();
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  const invalidateResults = () => {
    requestController.current?.abort();
    setReport(null); setInitialReport(null); setSession(null); setTimings({});
    setError(null); setFocusLine(null); setActiveTab("audit"); setNotice(""); setCopied(false);
  };

  const selectSample = (index: number) => {
    if (operationActive.current || demoActive.current) return;
    invalidateResults(); setSampleIndex(index); setCode(WORKSPACE_SAMPLES[index].code);
    setFilename(WORKSPACE_SAMPLES[index].filename); setEdited(false);
  };

  const editCode = (value: string) => {
    if (operationActive.current || demoActive.current) return;
    invalidateResults(); setCode(value); setEdited(value !== WORKSPACE_SAMPLES[sampleIndex].code);
  };

  const runOperation = async (operation: "audit" | "healing", source = code, target = filename, controller = new AbortController()) => {
    if (operationActive.current || !source.trim()) return null;
    operationActive.current = true; requestController.current = controller;
    setBusy(operation); setError(null); setNotice(""); setActiveTab(operation);
    if (operation === "audit") { setReport(null); setInitialReport(null); setSession(null); setTimings({}); }
    else { setSession(null); setReport(initialReport); setTimings((previous) => ({ auditMs: previous.auditMs })); }
    const start = performance.now();
    try {
      const response = await fetch(operation === "audit" ? "/api/analyze" : "/api/heal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: source, filename: target }), signal: controller.signal,
      });
      const payload = await response.json();
      if (controller.signal.aborted) return null;
      if (!response.ok || !payload.success) throw new Error(payload.error || `Request failed (${response.status}). Try again.`);
      const elapsed = Math.round(performance.now() - start);
      if (operation === "audit") {
        const parsed = AuditReportSchema.safeParse(payload.data);
        if (!parsed.success) throw new Error("The service returned an incomplete audit report. Try the request again.");
        const audit = parsed.data;
        setReport(audit); setInitialReport(audit); setTimings({ auditMs: elapsed });
        return audit;
      }
      const parsed = SelfHealingSessionSchema.safeParse(payload.data);
      if (!parsed.success) throw new Error("The service returned an incomplete repair record. Try the request again.");
      const healed = parsed.data;
      setSession(healed);
      setInitialReport((previous) => previous ?? healed.steps[0]?.auditReport ?? null);
      setReport(healed.finalReport ?? null);
      setTimings((previous) => ({ ...previous, repairMs: elapsed }));
      return healed;
    } catch (reason) {
      if (!controller.signal.aborted) {
        const message = reason instanceof SyntaxError ? "The service returned an unreadable response. Try the request again." : reason instanceof Error ? reason.message : "The request could not be completed. Try again.";
        setError({ message, operation });
      }
      return null;
    } finally {
      if (requestController.current === controller) { operationActive.current = false; setBusy(null); }
    }
  };

  const stopDemo = () => {
    demoGeneration.current++;
    demoActive.current = false; requestController.current?.abort();
    setDemoStep(null); setBusy(null); operationActive.current = false;
    setNotice("Guided demo stopped. Any server work already started may still finish; its response will be ignored.");
  };

  const startDemo = async () => {
    if (operationActive.current || demoActive.current) return;
    invalidateResults();
    const sample = WORKSPACE_SAMPLES[0];
    setSampleIndex(0); setCode(sample.code); setFilename(sample.filename); setEdited(false);
    demoActive.current = true; setDemoStep(0);
    const generation = ++demoGeneration.current;
    const controller = new AbortController();
    const audit = await runOperation("audit", sample.code, sample.filename, controller);
    if (generation !== demoGeneration.current) return;
    if (!audit || !demoActive.current) { demoActive.current = false; setDemoStep(null); return; }
    setDemoStep(1);
    const healing = await runOperation("healing", sample.code, sample.filename, controller);
    if (generation !== demoGeneration.current) return;
    if (!demoActive.current) return;
    demoActive.current = false; setDemoStep(null);
    if (healing && "status" in healing && healing.status === "SUCCESS") {
      setActiveTab("diff"); setNotice("Guided demo complete. Compare the source changes, then expand Run details & evidence for the record.");
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true); setNotice("Source code copied.");
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError({ message: "Clipboard access is unavailable. Select and copy the source directly in the editor." }); }
  };

  const exportEvidence = () => {
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), filename, source: code, audit: initialReport ?? report, repair: session, requestTimings: timings, measurementScope: "Browser request round trips; not model inference benchmarks.", verificationScope: "Configured static rules plus in-memory TypeScript semantic checks; host runtime execution NOT_VERIFIED." }, null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${filename.replace(/\.[^.]+$/, "")}-evidence.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Run evidence downloaded. Review the included source code before sharing.");
  };

  const locked = busy !== null || demoStep !== null;
  const patchExists = !!session?.steps.some((step) => step.patch);
  const showReview = Boolean(report || session || busy);
  const mode = health?.mode;
  const connectionLabel = healthFailed ? "Connection unknown" : !health ? "Checking connection…" : mode === "MOCK_SIMULATED" ? "Simulation mode" : "Configured — connection not verified";

  return <div className="app-shell simple-workspace">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header className="app-header">
      <a className="brand" href="/" aria-label="Nebius CodeSentinel home"><span className="brand-mark"><ShieldCheck size={23} strokeWidth={1.7} /></span><span><strong>CodeSentinel<span className="brand-period">.</span></strong><small>Nebius × NVIDIA</small></span></a>
      <div className="header-actions"><span className={`connection-status ${mode === "MOCK_SIMULATED" ? "simulation" : health?.configured ? "configured" : "unknown"}`} title={health?.message}><i />{connectionLabel}</span><button id="btn-autopilot" className="button demo-button" onClick={demoStep !== null ? stopDemo : startDemo} disabled={!!busy && demoStep === null}>{demoStep !== null ? <Square size={14} /> : <Play size={14} />}<span>{demoStep !== null ? "Stop demo" : "Guided demo"}</span></button></div>
    </header>

    <main className="workspace-main" id="workspace">
      <span className="sr-only" role="status" aria-live="polite">{busy ? busy === "audit" ? "Audit in progress." : "Repair in progress." : session ? `Repair result: ${session.status}. Rule score: ${session.finalReport?.score ?? "not returned"}.` : report ? `Audit complete. ${report.issues.length} issues found. Rule score: ${report.score} out of 100.` : ""}</span>
      <div className="workspace-intro"><p className="workspace-eyebrow">Code review, step by step</p><h1>Find risks. Review the fix.</h1><p>Check automation code for exposed secrets, missing approvals and expression errors.</p></div>

      <div className="workspace-toolbar">
        <div className="example-picker"><label htmlFor="scenario-select">Start with an example</label><div className="select-wrap"><select id="scenario-select" aria-label="Example scenario" value={sampleIndex} disabled={locked} onChange={event => selectSample(Number(event.target.value))}>{WORKSPACE_SAMPLES.map((sample, index) => <option key={sample.filename} value={index}>{sample.title}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></div></div>
        <button id="btn-static-audit" className={`button ${report || session ? "button-secondary" : "button-primary"}`} onClick={() => runOperation("audit")} disabled={locked || !code.trim()}>{busy === "audit" ? <LoaderCircle size={16} className="is-spinning" /> : <ShieldCheck size={16} />}<span>{busy === "audit" ? "Analyzing…" : report || session ? "Analyze again" : "Analyze code"}</span>{!busy && !report && !session && <ArrowRight size={16} />}</button>
      </div>

      {error && <div role="alert" className="error-banner"><TriangleAlert size={18} /><div><strong>That request could not be completed.</strong><p>{error.message}</p></div>{error.operation && <button className="text-button" onClick={() => runOperation(error.operation!)} disabled={locked}>Try again<RotateCcw size={14} /></button>}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={16} /></button></div>}
      {demoStep !== null && <div className="demo-banner" role="status"><LoaderCircle size={16} className="is-spinning" /><span>{demoStep === 0 ? "Guided demo: inspecting the payment webhook." : "Guided demo: proposing a repair and checking the returned source."}</span><span>{demoStep + 1} / 2</span></div>}

      <div className={`workspace-panels ${showReview ? "has-review" : "is-starting"} ${activeTab === "diff" && session ? "is-comparing" : ""}`}>
        <div className="source-column"><div className="section-heading"><h2>{session ? "Original source" : "Your code"}</h2><span>{edited ? "Modified source" : "Editable example"}</span></div>
          <CodePane code={code} filename={filename} disabled={locked} issues={session ? initialReport?.issues ?? [] : report?.issues ?? []} focusLine={focusLine} copied={copied} onChange={editCode} onCopy={copyCode} onReset={() => selectSample(sampleIndex)} />
          <p className="source-safety"><ShieldCheck size={13} />Paste your own TypeScript here. Your source is never executed.</p>
        </div>
        {showReview && <div className="results-column"><div className="section-heading review-heading"><h2>{session ? "Review the proposal" : "Your results"}</h2>{report && report.issues.length > 0 && session?.status !== "SUCCESS" && <button id="btn-healing-loop" className="button button-primary" onClick={() => runOperation("healing")} disabled={locked}>{busy === "healing" ? <LoaderCircle size={15} className="is-spinning" /> : <Sparkles size={15} />}<span>{busy === "healing" ? "Repairing…" : "Repair source"}</span><ArrowRight size={15} /></button>}</div>
          <div className="results-shell"><ResultTabs active={activeTab} onChange={setActiveTab} report={session ? initialReport : report} session={session} /><ResultPanel active={activeTab} report={report} initialReport={initialReport} session={session} busy={busy} timings={timings} onAudit={() => runOperation("audit")} onRepair={() => runOperation("healing")} onIssue={issue => setFocusLine({ line: issue.line ?? 1, key: Date.now() })} onTab={setActiveTab} onExport={exportEvidence} /></div>
          {(report || session) && <details className="evidence-details" id="run-evidence" key={session?.sessionId ?? report?.timestamp}><summary><span>Run details &amp; evidence</span><ChevronDown size={16} /></summary><EvidenceView report={report} initialReport={initialReport} session={session} timings={timings} onExport={exportEvidence} /></details>}
        </div>}
      </div>
      <footer className="workspace-footer"><span>Powered by NVIDIA Nemotron · Nebius Token Factory</span><div className="footer-help"><span className="footer-mode">{health ? health.mode : healthFailed ? "CONNECTION_NOT_VERIFIED" : "CHECKING_CONNECTION"}</span><details className="how-it-works"><summary>How it works<ChevronDown size={13} /></summary><p>Analyze the source, review the findings, then inspect a repair proposal and its changes.</p><p>Live mode sends your source to the configured model. Simulation uses deterministic local repairs. Runtime behavior remains NOT_VERIFIED.</p><p>Review and test every proposal in its intended environment.</p></details></div></footer>
      <div className={`notice ${notice ? "is-visible" : ""}`} role="status" aria-live="polite">{notice && <><CheckCircle2 size={16} /><span>{notice}</span><button className="icon-button" onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={14} /></button></>}</div>
    </main>
  </div>;
}
