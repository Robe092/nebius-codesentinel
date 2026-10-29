"use client";

import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronRight, Circle, Clock3, FileCode2, GitCompareArrows, Info, LoaderCircle, ShieldCheck, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import type { AuditReport, CodeIssue, SelfHealingSession } from "@/types";
import { sessionEvidence } from "@/lib/workspace-evidence";
import { PatchComparison } from "./code-pane";

export type ResultTab = "audit" | "healing" | "diff";
export interface RunTiming { auditMs?: number; repairMs?: number }

const categoryLabels: Record<string, string> = {
  HARDCODED_SECRET: "Exposed credential",
  FORBIDDEN_DIRECT_COMMUNICATION: "Missing human approval",
  MISSING_GUARDRAIL: "Missing guardrail",
  EXPRESSION_SYNTAX: "Invalid expression",
  DEPRECATED_COMPONENT: "Unsafe or deprecated code",
};

export function ResultTabs({ active, onChange, report, session }: { active: ResultTab; onChange: (tab: ResultTab) => void; report: AuditReport | null; session: SelfHealingSession | null }) {
  const tabs = [
    { id: "audit" as const, label: "Findings", icon: ShieldCheck },
    { id: "healing" as const, label: "Repair", icon: Sparkles },
    { id: "diff" as const, label: "Changes", icon: GitCompareArrows },
  ].filter(tab => tab.id === "audit" || !!session || tab.id === active);
  return <div className="result-tabs" role="tablist" aria-label="Review results" onKeyDown={(event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }}>
    {tabs.map(({ id, label, icon: Icon }) => <button id={`tab-${id}`} key={id} role="tab" aria-selected={active === id} aria-controls={`panel-${id}`} tabIndex={active === id ? 0 : -1} onClick={() => onChange(id)}><Icon size={15} /><span>{label}</span>{id === "audit" && report && report.issues.length > 0 && <span className="tab-count">{report.issues.length}</span>}{id === "diff" && session && <span className="tab-dot" />}</button>)}
  </div>;
}

function EmptyState({ kind, onAudit, onRepair }: { kind: ResultTab; onAudit: () => void; onRepair: () => void }) {
  if (kind === "audit") return <div className="empty-findings">
    <div className="inspection-illustration" aria-hidden="true"><div className="illustration-file"><FileCode2 size={24} /><span className="illustration-code"><i /><i /><i /><i /></span></div><div className="illustration-check"><ShieldCheck size={22} /></div></div>
    <h2>Good code starts with a closer look.</h2>
    <p>Inspect the sample on the left, or paste your own source. Start with an audit to see what needs attention.</p>
    <button className="text-button" onClick={onAudit}>Inspect this source <ArrowRight size={16} /></button>
    <div className="check-scope"><span><Check size={14} />Exposed secrets</span><span><Check size={14} />Human approvals</span><span><Check size={14} />Expression rules</span></div>
    <div className="quiet-note"><Info size={15} /><span>Rule-based analysis. Your source is inspected, never executed.</span></div>
  </div>;
  return <div className="secondary-empty"><span className="empty-icon">{kind === "diff" ? <GitCompareArrows size={24} /> : kind === "healing" ? <Sparkles size={24} /> : <FileCode2 size={24} />}</span>
    <h2>{kind === "diff" ? "Every change, in context." : kind === "healing" ? "A repair you can inspect." : "Evidence from your own run."}</h2>
    <p>{kind === "diff" ? "Run a repair to compare the original source with the proposed changes, line by line." : kind === "healing" ? "The repair loop proposes changes, rechecks the rules and stops after at most three attempts." : "Audit and repair results will appear here with their source, model and request timings."}</p>
    <button className="text-button" onClick={onRepair}>Run a repair<ArrowRight size={16} /></button>
  </div>;
}

function AuditView({ report, onIssue, onRepair, disabled, original }: { report: AuditReport; onIssue: (issue: CodeIssue) => void; onRepair: () => void; disabled: boolean; original: boolean }) {
  const clean = report.issues.length === 0;
  return <div className="findings-view">
    {original && <p className="findings-context"><FileCode2 size={14} />Original source findings. Open Repair for the returned result.</p>}
    <div className={`audit-overview ${clean ? "is-clean" : "has-findings"}`}><div><span className="result-status">{clean ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}{clean ? "No rule violations found" : `${report.issues.length} issues need a closer look`}</span><p>{clean ? "The source passes the configured checks." : "Review the findings, then inspect a proposed repair."}</p></div><div className="audit-score" aria-label={`Rule score ${report.score} out of 100`}><strong>{report.score}</strong><span>/ 100</span></div></div>
    <div className="severity-summary" aria-label="Issue severity"><span><i className="severity-dot critical" />{report.metrics.criticalCount} critical</span><span><i className="severity-dot high" />{report.metrics.highCount} high</span><span><i className="severity-dot medium" />{report.metrics.mediumCount + report.metrics.lowCount} other</span><span className="summary-caption">Rule score</span></div>
    {clean ? <div className="clean-result"><CheckCircle2 size={30} /><h3>A clean result for these checks.</h3><p>No changes are needed under the current rules. Review and test your source in its intended environment before using it.</p></div> : <div className="findings-list">{report.issues.map((issue) => <article className="finding" key={issue.id}>
      <div className="finding-topline"><span className={`severity-label ${issue.severity.toLowerCase()}`}>{issue.severity}</span><span className="rule-id">{issue.ruleId}</span>{issue.line && <button className="line-link" onClick={() => onIssue(issue)}>Line {issue.line}<ChevronRight size={13} /></button>}</div>
      <h3>{categoryLabels[issue.category] || issue.category.replaceAll("_", " ").toLowerCase()}</h3><p>{issue.message}</p>
      {issue.snippet && <button className="finding-snippet" onClick={() => onIssue(issue)} title={`Go to line ${issue.line ?? 1}`}><code>{issue.snippet}</code></button>}
      {issue.remediationHint && <div className="remediation"><ArrowRight size={14} /><span>{issue.remediationHint}</span></div>}
    </article>)}</div>}
    {!clean && <div className="next-action"><span>{original ? "These findings refer to the original source. Open Repair to review the proposal." : "Review the findings, then use Repair source to propose a change."}</span></div>}
    <p className="analysis-limit">Checks cover configured patterns, not full compilation or runtime correctness.</p>
  </div>;
}

function HealingView({ session, onChanges }: { session: SelfHealingSession; onChanges: () => void }) {
  const evidence = sessionEvidence(session);
  const success = session.status === "SUCCESS";
  const partial = session.status === "PARTIAL";
  const simulated = evidence.modes.includes("MOCK_SIMULATED");
  const changed = session.currentCode !== session.originalCode;
  return <div className="healing-view">
    <div className={`session-summary ${success ? "is-success" : partial ? "is-partial" : "is-failed"}`}>
      {success ? <CheckCircle2 size={23} /> : <TriangleAlert size={23} />}
      <div>
        <h2>
          {success
            ? changed
              ? "Repair complete. Review the changes."
              : "No repair was needed."
            : partial
            ? "Partial repair: review required."
            : "Repair stopped. Review is required."}
        </h2>
        <p>
          {success
            ? "The returned source has been rechecked against the configured rules."
            : partial
            ? "An improvement was accepted, but configured findings remain open."
            : "The original checks still need attention. No successful repair is claimed."}
        </p>
      </div>
    </div>
    <div className="session-facts"><div><span>Final rule score</span><strong id="session-score">{evidence.finalScore ?? "—"}<small> / 100</small></strong></div><div><span>Attempts</span><strong>{session.currentIteration}<small> / {session.maxIterations}</small></strong></div><div><span>Result</span><strong className={`session-state ${success ? "success-text" : "warning-text"}`}>{session.status}</strong></div></div>
    <div className={`mode-disclosure ${simulated ? "is-simulation" : ""}`}><Info size={16} /><span>{evidence.patchCount === 0 ? "No model call was needed for this source." : simulated ? "MOCK_SIMULATED · Deterministic repair for this run. No live model inference is claimed." : `${evidence.modes.join(", ")} · Provenance reported by the repair service.`}</span></div>
    {evidence.models.length > 0 && <p className="model-provenance"><span>Model reported by the service</span><code>{evidence.models.join(", ")}</code></p>}
    <div className="trace-heading"><h3>Execution trace</h3><span>{session.steps.length} recorded {session.steps.length === 1 ? "step" : "steps"}</span></div>
    <ol className="execution-trace">{session.steps.map((step, index) => <li key={`${step.iteration}-${index}`}>
      <span className={`trace-marker ${step.invariantPassed ? "passed" : ""}`}>{step.invariantPassed ? <Check size={13} /> : <Circle size={11} />}</span>
      <div className="trace-content"><div className="trace-step-title"><h4>Iteration #{step.iteration}</h4><span>{step.status.replaceAll("_", " ").toLowerCase()}</span></div>
        {step.patch && <><p className="trace-caption">{step.patch.sourceMode === "MOCK_SIMULATED" ? "Simulated repair steps" : "Repair explanation"}</p><ul>{step.patch.reasoningSteps.map((reason, i) => <li key={i}>{reason}</li>)}</ul></>}
        {step.testResults && <div className={`verification-output ${step.testResults.passed ? "passed" : "failed"}`}><span>{step.testResults.passed ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}Rule recheck<span className="output-duration">{step.testResults.durationMs} ms</span></span><p>{step.testResults.output}</p></div>}
        {!step.patch && <p>{step.feedbackNotes || "The source was checked without a patch."}</p>}
      </div>
    </li>)}</ol>
    {changed && <button className="button button-secondary changes-action" onClick={onChanges}><GitCompareArrows size={16} />Review source changes<ArrowRight size={15} /></button>}
  </div>;
}

export function EvidenceView({ report, initialReport, session, timings, onExport }: { report: AuditReport | null; initialReport: AuditReport | null; session: SelfHealingSession | null; timings: RunTiming; onExport: () => void }) {
  const evidence = session ? sessionEvidence(session) : null;
  return <div className="evidence-view"><div className="view-heading"><h2>Evidence you can take with you.</h2><p>Results from this source and this run. Download the record to inspect it independently.</p></div>
    <dl className="evidence-list">
      <div><dt>Original rule score</dt><dd>{initialReport?.score ?? report?.score ?? "—"} / 100</dd></div>
      <div><dt>Final rule score</dt><dd>{session ? evidence?.finalScore ?? "Not returned" : "No repair run"}{evidence?.finalScore != null ? " / 100" : ""}</dd></div>
      <div><dt>Audit request time</dt><dd>{timings.auditMs != null ? `${timings.auditMs.toLocaleString()} ms` : "Not measured"}</dd></div>
      <div><dt>Repair request time</dt><dd>{timings.repairMs != null ? `${timings.repairMs.toLocaleString()} ms` : "Not measured"}</dd></div>
      <div><dt>Repair provenance</dt><dd>{evidence ? evidence.modes.join(", ") || "No model call" : "No repair run"}</dd></div>
      <div><dt>Model reported</dt><dd>{evidence?.models.join(", ") || "No model call recorded"}</dd></div>
      <div><dt>Verification scope</dt><dd>Static rules + TypeScript check (runtime NOT_VERIFIED)</dd></div>
      <div><dt>Recorded at</dt><dd>{report ? new Date(report.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" }) : "—"}</dd></div>
    </dl>
    <div className="evidence-explainer"><Clock3 size={17} /><p>Times measure the full browser request, including networking and server work. They are not model inference benchmarks.</p></div><div className="evidence-explainer"><ShieldCheck size={17} /><p>Verification covers configured static rules and in-memory TypeScript semantic checks. Host process execution and runtime business equivalence remain NOT_VERIFIED. Review and test proposed code in your staging environment before use.</p></div>
    <button className="button button-secondary export-action" onClick={onExport}><ArrowDownToLine size={16} />Download run evidence</button><p className="export-note">JSON includes source code, findings and any repair proposal. Review it before sharing.</p>
  </div>;
}

export function ResultPanel({ active, report, initialReport, session, busy, timings, onAudit, onRepair, onIssue, onTab, onExport }: {
  active: ResultTab; report: AuditReport | null; initialReport: AuditReport | null; session: SelfHealingSession | null; busy: "audit" | "healing" | null; timings: RunTiming;
  onAudit: () => void; onRepair: () => void; onIssue: (issue: CodeIssue) => void; onTab: (tab: ResultTab) => void; onExport: () => void;
}) {
  const sourceReport = session ? initialReport ?? session.steps[0]?.auditReport ?? null : report;
  const hasContent = active === "audit" ? !!sourceReport : !!session;
  return <section key={active} id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className={`result-panel ${active === "diff" ? "is-diff-panel" : ""}`} tabIndex={0} aria-busy={busy !== null}>
    {busy && (active === busy || active === "audit" && busy === "healing") ? <div className="working-state" role="status"><div className="working-label"><LoaderCircle size={19} className="is-spinning" /><span>{busy === "audit" ? "Inspecting your source…" : "Preparing and checking a repair…"}</span></div><h2>{busy === "audit" ? "A closer look at the details." : "A proposal is on its way."}</h2><p>{busy === "audit" ? "Checking for credentials, approval gates and expression issues." : "The service proposes a patch and rechecks the rules. This can take a moment."}</p><div className="skeleton-list" aria-hidden="true"><i /><i /><i /></div></div>
      : !hasContent ? <EmptyState kind={active} onAudit={onAudit} onRepair={onRepair} />
      : active === "audit" && sourceReport ? <AuditView report={sourceReport} onIssue={onIssue} onRepair={session ? () => onTab("healing") : onRepair} disabled={!!busy} original={!!session} />
      : active === "healing" && session ? <HealingView session={session} onChanges={() => onTab("diff")} />
      : active === "diff" && session ? <div className="changes-view"><div className="view-heading"><h2>{session.originalCode === session.currentCode ? "The source is unchanged." : "See exactly what changed."}</h2><p>Computed from the original and returned source. {session.status === "SUCCESS" ? "Review before using the proposal." : "The repair did not succeed; inspect the returned source carefully."}</p></div><PatchComparison before={session.originalCode} after={session.currentCode} filename={session.fileName} /><div className="quiet-note"><Info size={15} /><span>This view compares the full sources, including simulated repairs.</span></div></div>
      : null}
  </section>;
}
