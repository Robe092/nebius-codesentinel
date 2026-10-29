"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, Copy, FileCode2, RotateCcw } from "lucide-react";
import type { CodeIssue } from "@/types";
import { buildLineComparison } from "@/lib/workspace-evidence";

function highlight(line: string) {
  const tokens = line.split(/(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b(?:export|import|from|const|let|return|if|await|async|function|throw|new|type|interface)\b|\b(?:true|false|null|undefined|any|number|string)\b|\b\d+\b)/g);
  return tokens.map((token, index) => {
    let type = "";
    if (token.startsWith("//")) type = "comment";
    else if (/^["'`]/.test(token)) type = "string";
    else if (/^(export|import|from|const|let|return|if|await|async|function|throw|new|type|interface)$/.test(token)) type = "keyword";
    else if (/^(true|false|null|undefined|any|number|string|\d+)$/.test(token)) type = "literal";
    return <span key={index} className={type ? `syntax-${type}` : undefined}>{token}</span>;
  });
}

interface CodePaneProps {
  code: string;
  filename: string;
  disabled: boolean;
  issues: CodeIssue[];
  focusLine: { line: number; key: number } | null;
  copied: boolean;
  onChange: (value: string) => void;
  onCopy: () => void;
  onReset: () => void;
}

export function CodePane({ code, filename, disabled, issues, focusLine, copied, onChange, onCopy, onReset }: CodePaneProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const content = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => code.split("\n"), [code]);
  const issueLines = new Set(issues.map((issue) => issue.line));

  const syncScroll = () => {
    const editor = textarea.current;
    if (!editor) return;
    if (content.current) content.current.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    if (gutter.current) gutter.current.style.transform = `translateY(${-editor.scrollTop}px)`;
  };

  useEffect(() => {
    if (!focusLine || !textarea.current) return;
    const editor = textarea.current;
    const start = lines.slice(0, focusLine.line - 1).reduce((offset, line) => offset + line.length + 1, 0);
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(start, start + (lines[focusLine.line - 1]?.length || 0));
    editor.scrollTop = Math.max(0, (focusLine.line - 1) * 22 - editor.clientHeight / 3);
    syncScroll();
  }, [focusLine, lines]);

  useEffect(syncScroll, [code]);

  return <section className="source-pane" aria-label="Source editor">
    <div className="pane-toolbar">
      <div className="file-title"><FileCode2 size={16} /><span>{filename}</span><span className="file-extension">TS</span></div>
      <div className="toolbar-actions">
        <button className="icon-button" onClick={onCopy} aria-label={copied ? "Code copied" : "Copy source code"} title="Copy source code">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        <button className="icon-button" onClick={onReset} disabled={disabled} aria-label="Reset source code" title="Reset source code"><RotateCcw size={16} /></button>
      </div>
    </div>
    <div className="code-editor">
      <div className="code-gutter" aria-hidden="true"><div ref={gutter}>{lines.map((_, index) => <div key={index} className={issueLines.has(index + 1) ? "line-has-issue" : ""}>{index + 1}</div>)}</div></div>
      <div className="code-input-area">
        <pre ref={content} className="highlighted-source" aria-hidden="true">{lines.map((line, index) => <span className="source-line" key={index}>{highlight(line)}{"\n"}</span>)}</pre>
        <textarea ref={textarea} id="source-code" aria-label="Source code" value={code} onChange={(event) => onChange(event.target.value)} onScroll={syncScroll} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" disabled={disabled} />
      </div>
    </div>
    <div className="editor-status"><span>{lines.length} lines<span className="status-separator" />TypeScript</span><span>{disabled ? "Working…" : "Editable source"}</span></div>
  </section>;
}

export function PatchComparison({ before, after, filename }: { before: string; after: string; filename: string }) {
  const rows = useMemo(() => buildLineComparison(before, after), [before, after]);
  const added = rows.filter((row) => row.kind === "added").length;
  const removed = rows.filter((row) => row.kind === "removed").length;
  return <div className="patch-comparison">
    <div className="comparison-toolbar"><span><FileCode2 size={15} />{filename}</span><span><b className="addition-count">+{added}</b><b className="removal-count">−{removed}</b></span></div>
    <div className="comparison-columns" aria-hidden="true"><span>Original source</span><span>Repair proposal</span></div>
    <div className="comparison-scroll" tabIndex={0} aria-label="Source comparison. Removed lines on the left, added lines on the right.">
      <div className="comparison-grid">
        {rows.map((row, index) => <div key={index} className={`comparison-row comparison-${row.kind}`}>
          <div className={`comparison-cell ${row.kind === "added" ? "comparison-blank" : ""}`}><span className="comparison-line-number">{row.beforeLine ?? ""}</span><code>{row.kind !== "added" ? <><span className="diff-marker">{row.kind === "removed" ? "−" : " "}</span>{highlight(row.text)}</> : " "}</code></div>
          <div className={`comparison-cell ${row.kind === "removed" ? "comparison-blank" : ""}`}><span className="comparison-line-number">{row.afterLine ?? ""}</span><code>{row.kind !== "removed" ? <><span className="diff-marker">{row.kind === "added" ? "+" : " "}</span>{highlight(row.text)}</> : " "}</code></div>
        </div>)}
      </div>
    </div>
  </div>;
}
