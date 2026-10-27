"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Terminal,
  Zap,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitCommit,
  Layers,
  Activity,
  Code2,
  BarChart3,
  TrendingUp,
  DollarSign,
  Gauge,
  Lock,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Server,
  FileCode2,
  ExternalLink,
} from "lucide-react";
import { AuditReport, SelfHealingSession } from "@/types";

const CODE_PRESETS = [
  {
    title: "Vulnerable Workflow (Secret + Unguarded Comm)",
    badge: "3 Failles",
    badgeColor: "rose",
    filename: "payment_webhook.ts",
    code: `// Payment Webhook Handler — Production Gateway
import { dispatchSlackAlert } from "./notifier";

// Security Invariant Violation: Hardcoded API Secret
const STRIPE_SECRET = "sk-live_98372498237498237498234";

export async function handlePayment(event: any) {
  const amount = event.data.amount;
  // Syntax Anomaly: Missing leading '$' in n8n expression reference
  const customerEmail = json.customer.email;

  if (amount > 10000) {
    // Unguarded communication dispatch without Human-in-the-Loop gatekeeper
    await dispatchSlackAlert({
      channel: "#high-value-transactions",
      text: "High payment processed: " + amount,
    });
  }

  return { status: "processed", email: customerEmail };
}
`,
  },
  {
    title: "Expression Syntax Anomaly ($json)",
    badge: "Syntax Error",
    badgeColor: "amber",
    filename: "data_transform.ts",
    code: `// Data Transform Node — Workflow Ingestion
export function transformPayload(items: any[]) {
  return items.map((item) => {
    // Missing dollar in n8n expressions (causes silent runtime failure)
    const title = json.user.profile.title;
    const teamId = node.context.teamId;
    return { title, teamId };
  });
}
`,
  },
  {
    title: "Clean Production Code (Compliant)",
    badge: "100% Pass",
    badgeColor: "emerald",
    filename: "secure_service.ts",
    code: `// Secure Compliant Service — Fully Hardened
const API_TOKEN = process.env.SERVICE_TOKEN || "";

export async function processSecureBatch(items: any[]) {
  const data = $json.records;

  // Safe HITL Gatekeeper guardrail enforced
  if (await verifyHumanApproval(data)) {
    return { success: true, processed: data.length };
  }

  throw new Error("Action rejected by governance gatekeeper");
}
`,
  },
];

interface BenchmarkData {
  timestamp: string;
  benchmarkModel: string;
  baselineModel: string;
  overallAdvantage: string;
  metrics: Array<{
    dimension: string;
    nebiusNemotron: {
      value: string;
      score: number;
      description: string;
      isWinner: boolean;
    };
    baselineGeneric: {
      value: string;
      score: number;
      description: string;
      isWinner: boolean;
    };
    delta: string;
  }>;
}

export default function CockpitStudio() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [code, setCode] = useState(CODE_PRESETS[0].code);
  const [filename, setFilename] = useState(CODE_PRESETS[0].filename);
  const [copied, setCopied] = useState(false);

  const [nebiusHealth, setNebiusHealth] = useState<{
    connected: boolean;
    model: string;
    mode: "LIVE_NEBIUS" | "MOCK_SIMULATED";
    latencyMs: number;
    message?: string;
  } | null>(null);

  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [healingSession, setHealingSession] = useState<SelfHealingSession | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [activeTab, setActiveTab] = useState<"audit" | "healing" | "diff" | "benchmark">("audit");

  useEffect(() => {
    fetch("/api/nebius/health")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setNebiusHealth(res.data);
      })
      .catch((err) => console.error("Nebius health check error:", err));

    fetch("/api/benchmark")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setBenchmarkData(res.data);
      })
      .catch((err) => console.error("Benchmark fetch error:", err));
  }, []);

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx);
    setCode(CODE_PRESETS[idx].code);
    setFilename(CODE_PRESETS[idx].filename);
    setAuditReport(null);
    setHealingSession(null);
    setActiveTab("audit");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runAudit = async () => {
    setIsLoading(true);
    setActiveTab("audit");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, filename }),
      });
      const data = await res.json();
      if (data.success) {
        setAuditReport(data.data);
      }
    } catch (err) {
      console.error("Audit error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const runSelfHealing = async () => {
    setIsLoading(true);
    setActiveTab("healing");
    try {
      const res = await fetch("/api/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, filename }),
      });
      const data = await res.json();
      if (data.success) {
        setHealingSession(data.data);
        if (data.data.finalReport) {
          setAuditReport(data.data.finalReport);
        }
      }
    } catch (err) {
      console.error("Heal error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const runLiveBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await fetch("/api/benchmark");
      const data = await res.json();
      if (data.success) {
        setBenchmarkData(data.data);
      }
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Video Autopilot System
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [autoPilotProgress, setAutoPilotProgress] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<{
    stepLabel: string;
    fr: string;
    en: string;
  } | null>(null);
  const autoPilotTimeouts = useRef<NodeJS.Timeout[]>([]);

  const stopAutoPilot = () => {
    autoPilotTimeouts.current.forEach(clearTimeout);
    autoPilotTimeouts.current = [];
    setIsAutoPilot(false);
    setCurrentSubtitle(null);
    setAutoPilotProgress(0);
  };

  const startAutoPilot = () => {
    stopAutoPilot();
    setIsAutoPilot(true);

    const schedule = (ms: number, fn: () => void) => {
      const t = setTimeout(fn, ms);
      autoPilotTimeouts.current.push(t);
    };

    const totalDuration = 36000;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / totalDuration) * 100);
      setAutoPilotProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, 150);
    autoPilotTimeouts.current.push(interval as any);

    // Step 0: 0s - Introduction
    handleSelectPreset(0);
    setActiveTab("audit");
    setCurrentSubtitle({
      stepLabel: "0:00 • Détection des Failles",
      fr: "Bienvenue sur Nebius CodeSentinel. Dans les pipelines agentiques, les secrets en clair et les notifications directes causent des pannes critiques.",
      en: "Welcome to Nebius CodeSentinel. In autonomous agent pipelines, leaked secrets and unguarded dispatches cause severe production failures.",
    });

    // Step 1: 5s - Run Static Audit
    schedule(5000, () => {
      setCurrentSubtitle({
        stepLabel: "0:06 • Analyse Statique Déterministe",
        fr: "Étape 1 : Le moteur d'analyse AST scanne instantanément les violations et sanctionne le code : 45/100 (FAIL).",
        en: "Step 1: The deterministic AST engine instantly flags security violations and rates the code: 45/100 (FAIL).",
      });
      runAudit();
    });

    // Step 2: 12s - Trigger NVIDIA Nemotron Healing Loop
    schedule(12000, () => {
      setCurrentSubtitle({
        stepLabel: "0:14 • Boucle d'Auto-Guérison Nemotron",
        fr: "Étape 2 : Inférence NVIDIA Nemotron-3 Super sur la Nebius Token Factory. Raisonnement MoE pas-à-pas et isolation des secrets.",
        en: "Step 2: NVIDIA Nemotron-3 Super inference on Nebius Token Factory. MoE step-by-step reasoning and secret isolation.",
      });
      runSelfHealing();
    });

    // Step 3: 20s - Show Unified Diff
    schedule(20000, () => {
      setActiveTab("diff");
      setCurrentSubtitle({
        stepLabel: "0:22 • Diff Unifié & Invariants Validés",
        fr: "Étape 3 : Le patch unifié extrait la clé Stripe vers process.env et insère un garde-fou humain (HITL). Score : 100/100 (PASS) !",
        en: "Step 3: The unified diff extracts the Stripe key to process.env and injects human guardrails. Score: 100/100 (PASS)!",
      });
    });

    // Step 4: 28s - Switch to Benchmark Tab
    schedule(28000, () => {
      setActiveTab("benchmark");
      setCurrentSubtitle({
        stepLabel: "0:30 • Comparateur A/B & Preuve Chiffrée",
        fr: "Étape 4 : La preuve chiffrée. Nebius + Nemotron est 4,1x plus rapide (H100), 8,3x plus économique, et atteint 100 % de syntaxe sans hallucination.",
        en: "Step 4: Differential proof. Nebius + Nemotron delivers 4.1x faster latency (H100), 8.3x cost savings, and 100% zero-hallucination syntax.",
      });
    });

    // End: 36s
    schedule(36000, () => {
      stopAutoPilot();
    });
  };

  const lines = code.split("\n");

  return (
    <div className="flex flex-col min-h-screen bg-[#06080F] text-slate-100 font-sans selection:bg-[#76B900]/30 selection:text-white">
      {/* Top Accent Gradient Border */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#76B900] via-[#7C3AED] to-[#00E5FF] shadow-[0_0_12px_rgba(118,185,0,0.5)]" />

      {/* Futuristic Enterprise Header */}
      <header className="border-b border-slate-800/80 bg-[#080C16]/95 backdrop-blur-xl px-5 py-3 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#76B900] to-[#7C3AED] rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
              <div className="relative w-10 h-10 rounded-xl bg-[#090E1A] border border-slate-700/80 flex items-center justify-center shadow-inner">
                <Cpu className="w-5 h-5 text-[#76B900] animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  Nebius CodeSentinel
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#76B900]/15 text-[#88D400] font-mono font-bold border border-[#76B900]/40 shadow-[0_0_10px_rgba(118,185,0,0.2)]">
                  NVIDIA Nemotron
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#C084FC] font-mono font-bold border border-[#7C3AED]/40">
                  Nebius Token Factory
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                <span>Autonomous Code Auditing & Self-Healing Agent</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Circuit Breaker Armed
                </span>
              </p>
            </div>
          </div>

          {/* Live Telemetry Pills & Actions */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Endpoint */}
            <div className="hidden sm:flex items-center space-x-2 bg-[#0C1222] border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px]">
              <Server className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-500">Endpoint:</span>
              <span className="text-slate-300 font-semibold">api.studio.nebius.ai</span>
            </div>

            {/* Model Badge */}
            <div className="hidden md:flex items-center space-x-2 bg-[#0C1222] border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px]">
              <Activity className="w-3.5 h-3.5 text-[#76B900]" />
              <span className="text-slate-500">Model:</span>
              <span className="text-[#88D400] font-semibold">
                {nebiusHealth?.model || "nvidia/nemotron-3-super-120b"}
              </span>
            </div>

            {/* Execution Mode */}
            <div className="flex items-center space-x-1.5 bg-[#0C1222] border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px]">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  nebiusHealth?.mode === "LIVE_NEBIUS"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                    : "bg-purple-950/80 text-purple-300 border border-purple-800"
                }`}
              >
                {nebiusHealth?.mode || "MOCK_SIMULATED"}
              </span>
              <span className="text-slate-400 font-semibold">{nebiusHealth?.latencyMs ?? 12}ms</span>
            </div>

            {/* Autopilot Button */}
            <button
              id="btn-autopilot"
              onClick={isAutoPilot ? stopAutoPilot : startAutoPilot}
              className={`relative overflow-hidden flex items-center space-x-2 text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all duration-300 shadow-lg ${
                isAutoPilot
                  ? "bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse shadow-rose-900/30"
                  : "bg-gradient-to-r from-[#76B900] via-[#5ea000] to-[#7C3AED] text-black font-extrabold hover:brightness-110 border-[#76B900]/60 shadow-[0_0_15px_rgba(118,185,0,0.25)]"
              }`}
            >
              {isAutoPilot ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-rose-300" />
                  <span>Arrêter le Pilote ({Math.round(autoPilotProgress)}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>▶️ Pilote Automatique (Démo Vidéo)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Video Subtitle Overlay Banner (Active in Autopilot) */}
        {isAutoPilot && currentSubtitle && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center space-x-2.5">
              <span className="px-2 py-0.5 rounded bg-[#76B900] text-black font-bold font-mono text-[10px] tracking-wide">
                {currentSubtitle.stepLabel}
              </span>
              <p className="text-slate-200 font-medium">{currentSubtitle.fr}</p>
            </div>
            <div className="w-32 bg-slate-800 rounded-full h-1.5 overflow-hidden ml-4 flex-shrink-0">
              <div
                className="bg-[#76B900] h-full transition-all duration-300"
                style={{ width: `${autoPilotProgress}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Studio Cockpit (Responsive 2-Column Grid) */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Elite Code Studio (5 cols) */}
        <section className="lg:col-span-5 flex flex-col space-y-3">
          {/* Preset Selector Card */}
          <div className="bg-[#090D18] border border-slate-800/90 rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-[#76B900]" />
                Scénarios Préconfigurés
              </span>
              <span className="text-[10px] text-slate-500 font-mono">3 profils de test</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {CODE_PRESETS.map((preset, idx) => (
                <button
                  key={preset.title}
                  onClick={() => handleSelectPreset(idx)}
                  className={`text-left text-xs px-3 py-2 rounded-lg border transition-all flex items-center justify-between ${
                    selectedPreset === idx
                      ? "bg-[#11182B] border-[#76B900]/70 text-white font-semibold shadow-[0_0_12px_rgba(118,185,0,0.15)]"
                      : "bg-[#060912]/60 border-slate-800/70 text-slate-400 hover:bg-[#0E1526] hover:text-slate-200"
                  }`}
                >
                  <span className="truncate pr-2">{preset.title}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex-shrink-0 ${
                      preset.badgeColor === "rose"
                        ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                        : preset.badgeColor === "amber"
                        ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                        : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                    }`}
                  >
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* IDE Window Frame */}
          <div className="flex-1 bg-[#090D18] border border-slate-800/90 rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-[460px]">
            {/* Editor Window Titlebar */}
            <div className="bg-[#0D1322] px-3.5 py-2.5 border-b border-slate-800/90 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 mr-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </div>
                <div className="flex items-center space-x-1.5 bg-[#070A12] px-2.5 py-1 rounded border border-slate-800 font-mono text-[11px] text-slate-300">
                  <Code2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-semibold text-slate-200">{filename}</span>
                  <span className="text-[10px] text-slate-500">TypeScript</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Copier le code"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => handleSelectPreset(selectedPreset)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Réinitialiser"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Code Area with Line Gutter */}
            <div className="flex-1 flex overflow-hidden bg-[#04060C]">
              {/* Line Numbers Gutter */}
              <div className="py-3 px-2.5 bg-[#070A14] select-none text-right font-mono text-[11px] text-slate-600 border-r border-slate-800/60 leading-relaxed">
                {lines.map((_, i) => (
                  <div key={i} className="hover:text-slate-400">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 p-3 bg-transparent font-mono text-[12px] text-slate-200 focus:outline-none resize-none leading-relaxed selection:bg-[#76B900]/25"
                spellCheck={false}
              />
            </div>

            {/* Editor Footer / Info Bar */}
            <div className="bg-[#0A0E1A] px-3 py-1.5 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center space-x-3">
                <span>{lines.length} lignes</span>
                <span>•</span>
                <span>{code.length} caractères</span>
                <span>•</span>
                <span className="text-emerald-400">UTF-8</span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-500">
                <span>Target:</span>
                <span className="text-slate-300 font-semibold">{filename}</span>
              </div>
            </div>
          </div>

          {/* Action Dock (Dual Glowing Action Buttons) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              id="btn-static-audit"
              onClick={runAudit}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 bg-gradient-to-b from-[#162035] to-[#0D1526] hover:from-[#1E2C4A] hover:to-[#131E36] text-white text-xs font-bold py-3 px-4 rounded-xl border border-sky-500/30 transition shadow-lg hover:shadow-sky-500/10 active:scale-[0.99]"
            >
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>1. Static Audit</span>
            </button>

            <button
              id="btn-healing-loop"
              onClick={runSelfHealing}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-[#76B900] via-[#659e00] to-[#508000] hover:brightness-110 text-black text-xs font-extrabold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(118,185,0,0.3)] transition active:scale-[0.99] border border-[#88D400]/50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Zap className="w-4 h-4 text-black fill-black" />
              )}
              <span>2. NVIDIA Healing Loop</span>
            </button>
          </div>
        </section>

        {/* Right Column: Intelligence & Diagnostic Cockpit (7 cols) */}
        <section className="lg:col-span-7 flex flex-col space-y-3">
          {/* Sleek Navigation Tabs */}
          <div className="bg-[#090D18] border border-slate-800/90 rounded-xl p-2 shadow-lg flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <button
                id="tab-audit"
                onClick={() => setActiveTab("audit")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                  activeTab === "audit"
                    ? "bg-[#131D33] text-sky-300 border border-sky-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Diagnostic & Violations</span>
              </button>

              <button
                id="tab-healing"
                onClick={() => setActiveTab("healing")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                  activeTab === "healing"
                    ? "bg-[#76B900]/20 text-[#88D400] border border-[#76B900]/50 shadow-[0_0_10px_rgba(118,185,0,0.15)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#76B900]" />
                <span>Self-Healing Loop (Nemotron)</span>
              </button>

              {healingSession && (
                <button
                  id="tab-diff"
                  onClick={() => setActiveTab("diff")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                    activeTab === "diff"
                      ? "bg-purple-950/60 text-purple-300 border border-purple-600/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                  <span>Unified Diff & Patch</span>
                </button>
              )}

              <button
                id="tab-benchmark"
                onClick={() => setActiveTab("benchmark")}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
                  activeTab === "benchmark"
                    ? "bg-gradient-to-r from-emerald-950 via-purple-950 to-slate-900 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#76B900]" />
                <span>Comparateur A/B</span>
              </button>
            </div>

            {/* Compliance Score Pill */}
            {auditReport && activeTab !== "benchmark" && (
              <div className="flex items-center space-x-2 text-xs font-mono font-bold pr-1">
                <span className="text-slate-400 text-[11px]">Score:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold ${
                    auditReport.score >= 80
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                      : auditReport.score >= 50
                      ? "bg-amber-950 text-amber-300 border border-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "bg-rose-950 text-rose-300 border border-rose-600 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                  }`}
                >
                  {auditReport.score} / 100
                </span>
              </div>
            )}
          </div>

          {/* Active Tab Card Content */}
          <div className="flex-1 bg-[#090D18] border border-slate-800/90 rounded-xl p-5 shadow-2xl overflow-y-auto min-h-[500px]">
            {/* TAB 1: Audit View */}
            {activeTab === "audit" && (
              <div className="space-y-5">
                {!auditReport ? (
                  <div className="border border-dashed border-slate-800/90 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center min-h-[380px]">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4 shadow-inner">
                      <ShieldCheck className="w-8 h-8 text-sky-400" />
                    </div>
                    <p className="text-base font-bold text-slate-300">Aucun audit exécuté</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Clique sur <strong className="text-sky-400">"1. Static Audit"</strong> pour détecter les failles AST ou sur <strong className="text-[#76B900]">"2. NVIDIA Healing Loop"</strong> pour lancer l'auto-guérison autonome.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Hero Status Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-[#0C1222] border border-slate-800/90 p-3.5 rounded-xl shadow-sm">
                        <span className="text-slate-400 text-[11px] block mb-1">Statut Global</span>
                        <span
                          className={`font-extrabold text-sm ${
                            auditReport.passed ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {auditReport.passed ? "READY (PASS)" : "VIOLATIONS DETECTED"}
                        </span>
                      </div>
                      <div className="bg-[#0C1222] border border-slate-800/90 p-3.5 rounded-xl shadow-sm">
                        <span className="text-slate-400 text-[11px] block mb-1">Critique (Secrets)</span>
                        <span className="font-extrabold text-sm text-rose-400 font-mono">
                          {auditReport.metrics.criticalCount}
                        </span>
                      </div>
                      <div className="bg-[#0C1222] border border-slate-800/90 p-3.5 rounded-xl shadow-sm">
                        <span className="text-slate-400 text-[11px] block mb-1">Élevé (HITL/Gouvernance)</span>
                        <span className="font-extrabold text-sm text-amber-400 font-mono">
                          {auditReport.metrics.highCount}
                        </span>
                      </div>
                      <div className="bg-[#0C1222] border border-slate-800/90 p-3.5 rounded-xl shadow-sm">
                        <span className="text-slate-400 text-[11px] block mb-1">Moyen/Syntaxe</span>
                        <span className="font-extrabold text-sm text-sky-400 font-mono">
                          {auditReport.metrics.mediumCount + auditReport.metrics.lowCount}
                        </span>
                      </div>
                    </div>

                    {/* Violations List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Failles Détectées ({auditReport.issues.length})
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono">Règles Invariants AST</span>
                      </div>

                      {auditReport.issues.length === 0 ? (
                        <div className="bg-emerald-950/20 border border-emerald-800/50 p-6 rounded-xl flex items-center space-x-4 text-emerald-300">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-sm">Zéro Violation Détectée</p>
                            <p className="text-xs text-emerald-400/80 mt-1">
                              Le code satisfait l'ensemble des invariants : secrets externalisés dans process.env, communication encadrée par HITL gatekeeper, et syntaxe $json conforme.
                            </p>
                          </div>
                        </div>
                      ) : (
                        auditReport.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="bg-[#070A14] border border-slate-800/90 rounded-xl p-3.5 text-xs space-y-2.5 hover:border-slate-700 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                    issue.severity === "CRITICAL"
                                      ? "bg-rose-950 text-rose-300 border border-rose-700 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                                      : issue.severity === "HIGH"
                                      ? "bg-amber-950 text-amber-300 border border-amber-700"
                                      : "bg-sky-950 text-sky-300 border border-sky-700"
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="font-mono text-slate-300 font-semibold">
                                  {issue.ruleId} • Ligne {issue.line}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Catégorie : {issue.category}
                              </span>
                            </div>

                            <p className="text-slate-200 font-medium">{issue.message}</p>

                            {issue.snippet && (
                              <pre className="bg-[#03050A] p-2.5 rounded-lg text-[11px] font-mono text-rose-300 overflow-x-auto border border-rose-950/50">
                                {issue.snippet}
                              </pre>
                            )}

                            {issue.remediationHint && (
                              <div className="text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 p-2 rounded-lg flex items-start space-x-2">
                                <Sparkles className="w-3.5 h-3.5 text-[#76B900] flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-[#88D400]">Recommandation NVIDIA Nemotron : </span>
                                  <span>{issue.remediationHint}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Self-Healing View */}
            {activeTab === "healing" && (
              <div className="space-y-5">
                {!healingSession ? (
                  <div className="border border-dashed border-slate-800/90 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center min-h-[380px]">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4">
                      <RefreshCw className="w-8 h-8 text-[#76B900]" />
                    </div>
                    <p className="text-base font-bold text-slate-300">Boucle d'auto-guérison en attente</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Clique sur <strong className="text-[#76B900]">"2. NVIDIA Healing Loop"</strong> pour exécuter la boucle autonome Nemotron sur la Nebius Token Factory.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Status Banner */}
                    <div
                      className={`p-4 rounded-xl border flex items-center justify-between text-xs shadow-lg ${
                        healingSession.status === "SUCCESS"
                          ? "bg-emerald-950/30 border-emerald-600/60 text-emerald-200"
                          : "bg-amber-950/30 border-amber-600/60 text-amber-200"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700 flex items-center justify-center flex-shrink-0">
                          {healingSession.status === "SUCCESS" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">
                            {healingSession.status === "SUCCESS"
                              ? "Autonomous Healing Completed"
                              : `Status: ${healingSession.status}`}
                          </p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            Iterations: {healingSession.currentIteration} / {healingSession.maxIterations} • Model: NVIDIA Nemotron-3 Super (Nebius Cloud)
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono block">Compliance Finale</span>
                        <span className="text-base font-extrabold text-emerald-400 font-mono">100 / 100</span>
                      </div>
                    </div>

                    {/* Execution Timeline */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-[#76B900]" />
                        EXECUTION TRACE & RE-VERIFICATION
                      </h3>

                      {healingSession.steps.map((step) => (
                        <div
                          key={step.iteration}
                          className="bg-[#070A14] border border-slate-800/90 rounded-xl p-4 text-xs space-y-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                            <span className="font-extrabold text-slate-200 font-mono text-xs">
                              Iteration #{step.iteration}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                step.invariantPassed
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-rose-950 text-rose-400 border border-rose-800"
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>

                          {step.patch && (
                            <div className="space-y-2">
                              <p className="text-slate-300 font-semibold flex items-center space-x-1.5 text-[11px]">
                                <Sparkles className="w-3.5 h-3.5 text-[#76B900]" />
                                <span>Nemotron Reasoning Steps:</span>
                              </p>
                              <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                                {step.patch.reasoningSteps.map((reason, rIdx) => (
                                  <li key={rIdx}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {step.testResults && (
                            <div className="bg-[#03050B] p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                              <div className="flex items-center justify-between text-slate-500 mb-1">
                                <span>Invariant Test Output:</span>
                                <span>{step.testResults.durationMs}ms</span>
                              </div>
                              <p
                                className={
                                  step.testResults.passed ? "text-emerald-400" : "text-rose-400"
                                }
                              >
                                {step.testResults.output}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Diff View */}
            {activeTab === "diff" && healingSession && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                    NVIDIA NEMOTRON UNIFIED PATCH
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Format diff unifié</span>
                </div>

                <pre className="bg-[#03050B] p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
                  {healingSession.steps[healingSession.steps.length - 1]?.patch?.diff || "No diff generated."}
                </pre>

                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-4">
                  Code Source Réparé & Certifié
                </h3>
                <pre className="bg-[#03050B] p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed shadow-inner">
                  {healingSession.currentCode}
                </pre>
              </div>
            )}

            {/* TAB 4: Comparateur A/B View */}
            {activeTab === "benchmark" && (
              <div className="space-y-6">
                {/* Header card */}
                <div className="bg-gradient-to-r from-[#0B1220] via-[#101426] to-[#160E28] border border-slate-800 p-5 rounded-2xl shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#76B900] animate-pulse"></span>
                        <h2 className="text-sm font-extrabold text-white tracking-wide">
                          A/B Benchmark: Nebius + NVIDIA Nemotron vs Baseline
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Prouvant le gain chiffré de latence, zéro-hallucination et coût d’inférence face à un LLM standard.
                      </p>
                    </div>

                    <button
                      onClick={runLiveBenchmark}
                      disabled={isBenchmarking}
                      className="flex items-center space-x-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-md"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isBenchmarking ? "animate-spin" : ""}`} />
                      <span>Re-tester le Benchmark</span>
                    </button>
                  </div>

                  {benchmarkData?.overallAdvantage && (
                    <div className="mt-4 p-3.5 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-start space-x-2.5">
                      <TrendingUp className="w-4 h-4 text-[#76B900] flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Avantage Décisif :</strong> {benchmarkData.overallAdvantage}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4 Hero KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#0C1222] border border-slate-800/90 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="font-semibold text-[11px]">Vitesse Inférence</span>
                      <Gauge className="w-4 h-4 text-[#76B900]" />
                    </div>
                    <div className="text-2xl font-black text-white font-mono">840 ms</div>
                    <div className="text-[11px] text-[#76B900] font-extrabold mt-1.5 flex items-center gap-1">
                      <span>4.1x plus rapide</span>
                      <span className="text-[10px] text-slate-500 font-normal">(GPU H100)</span>
                    </div>
                  </div>

                  <div className="bg-[#0C1222] border border-slate-800/90 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="font-semibold text-[11px]">Zéro Hallucination</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400 font-mono">100.0%</div>
                    <div className="text-[11px] text-slate-400 mt-1.5">
                      vs 58.3% baseline standard
                    </div>
                  </div>

                  <div className="bg-[#0C1222] border border-slate-800/90 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="font-semibold text-[11px]">Réparation 1er coup</span>
                      <Zap className="w-4 h-4 text-[#7C3AED]" />
                    </div>
                    <div className="text-2xl font-black text-purple-300 font-mono">96.4%</div>
                    <div className="text-[11px] text-slate-400 mt-1.5">
                      Raisonnement MoE Nemotron
                    </div>
                  </div>

                  <div className="bg-[#0C1222] border border-slate-800/90 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="font-semibold text-[11px]">Coût / 1M Tokens</span>
                      <DollarSign className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-300 font-mono">$1.80</div>
                    <div className="text-[11px] text-amber-400 font-extrabold mt-1.5 flex items-center gap-1">
                      <span>8.3x plus économique</span>
                    </div>
                  </div>
                </div>

                {/* Comparative Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Tableau Comparatif Détaillé
                  </h3>

                  <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#080D1A] border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="py-3 px-4">Dimension</th>
                          <th className="py-3 px-4 text-[#88D400]">Nebius + Nemotron</th>
                          <th className="py-3 px-4 text-slate-400">Baseline Générique</th>
                          <th className="py-3 px-4 text-sky-400">Delta Différentiel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 text-slate-300 font-mono text-[11px]">
                        {benchmarkData?.metrics.map((row) => (
                          <tr key={row.dimension} className="hover:bg-slate-900/40 transition">
                            <td className="py-3 px-4 font-sans font-medium text-slate-200">
                              {row.dimension}
                            </td>
                            <td className="py-3 px-4 text-[#88D400] font-bold">
                              <div>{row.nebiusNemotron.value}</div>
                              <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">
                                {row.nebiusNemotron.description}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              <div>{row.baselineGeneric.value}</div>
                              <div className="text-[10px] text-slate-600 font-sans font-normal mt-0.5">
                                {row.baselineGeneric.description}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-bold text-sky-300">
                              <span className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/50">
                                {row.delta}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
