import type { SelfHealingSession } from "@/types";

export interface ComparisonLine {
  kind: "context" | "removed" | "added";
  text: string;
  beforeLine?: number;
  afterLine?: number;
}

export function buildLineComparison(before: string, after: string): ComparisonLine[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  const rows: ComparisonLine[] = [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    rows.push({ kind: "context", text: a[start], beforeLine: start + 1, afterLine: start + 1 });
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  // Keep arbitrary pasted files from allocating an unbounded LCS matrix.
  if ((n + 1) * (m + 1) > 1_000_000) {
    for (let i = start; i < endA; i++) rows.push({ kind: "removed", text: a[i], beforeLine: i + 1 });
    for (let j = start; j < endB; j++) rows.push({ kind: "added", text: b[j], afterLine: j + 1 });
  } else {
    const width = m + 1;
    const lengths = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lengths[i * width + j] = a[start + i] === b[start + j]
          ? 1 + lengths[(i + 1) * width + j + 1]
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        rows.push({ kind: "context", text: a[start + i], beforeLine: start + i + 1, afterLine: start + j + 1 });
        i++; j++;
      } else if (i < n && (j === m || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
        rows.push({ kind: "removed", text: a[start + i], beforeLine: start + i + 1 }); i++;
      } else {
        rows.push({ kind: "added", text: b[start + j], afterLine: start + j + 1 }); j++;
      }
    }
  }
  for (let i = endA, j = endB; i < a.length; i++, j++) {
    rows.push({ kind: "context", text: a[i], beforeLine: i + 1, afterLine: j + 1 });
  }
  return rows;
}

export function sessionEvidence(session: SelfHealingSession) {
  const patches = session.steps.flatMap((step) => step.patch ? [step.patch] : []);
  return {
    finalScore: session.finalReport?.score ?? null,
    modes: [...new Set(patches.map((patch) => patch.sourceMode))],
    models: [...new Set(patches.map((patch) => patch.modelUsed))],
    patchCount: patches.length,
  };
}
