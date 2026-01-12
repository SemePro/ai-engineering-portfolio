"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Shield,
  AlertTriangle,
  Clock,
  FileText,
  Database,
  Cpu,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Network,
} from "lucide-react";

export default function IncidentProjectPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Back Link */}
          <Link href="/projects" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Search className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">AI Incident Investigator</h1>
                <p className="text-slate-400 mt-1">Automated root cause analysis with evidence-based hypotheses</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge className="bg-amber-500/20 text-amber-400">RAG</Badge>
              <Badge className="bg-blue-500/20 text-blue-400">FastAPI</Badge>
              <Badge className="bg-green-500/20 text-green-400">ChromaDB</Badge>
              <Badge className="bg-purple-500/20 text-purple-400">GPT-4</Badge>
              <Badge className="bg-red-500/20 text-red-400">Incident Response</Badge>
            </div>
          </div>

          {/* Overview */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <p className="text-slate-300 leading-relaxed">
                The AI Incident Investigator is an interactive system designed to assist SRE and DevOps teams 
                during incident response. It ingests various artifacts (logs, alerts, deploy history, runbooks), 
                reconstructs an incident timeline, and generates ranked root-cause hypotheses backed by 
                concrete evidence from the artifacts.
              </p>
              <p className="text-slate-300 leading-relaxed mt-4">
                Unlike generic AI assistants, this system enforces strict evidence requirements—refusing to 
                speculate when data is insufficient—and provides counter-evidence for each hypothesis, 
                making it a trustworthy tool for high-stakes incident analysis.
              </p>
            </Card>
          </section>

          {/* Architecture */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Architecture</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                  <FileText className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                  <h4 className="font-medium text-white">Artifact Ingestion</h4>
                  <p className="text-xs text-slate-400 mt-1">Logs, alerts, deploys, runbooks</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                  <Database className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <h4 className="font-medium text-white">Vector Store</h4>
                  <p className="text-xs text-slate-400 mt-1">ChromaDB with embeddings</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                  <Cpu className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                  <h4 className="font-medium text-white">Analysis Engine</h4>
                  <p className="text-xs text-slate-400 mt-1">RAG + LLM hypothesis generation</p>
                </div>
              </div>
              
              <div className="bg-slate-800/30 p-4 rounded-lg">
                <pre className="text-xs text-slate-400 overflow-x-auto">
{`┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Next.js UI    │────▶│  Secure Gateway  │────▶│ Incident Service  │
│ (Interactive)   │     │  (PII, Injection)│     │   (FastAPI)       │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                                                         │
                    ┌────────────────────────────────────┼────────────────┐
                    │                                    ▼                │
                    │  ┌─────────────┐   ┌─────────────────────────────┐ │
                    │  │   Parsers   │──▶│      Vector Store           │ │
                    │  │ (Timeline)  │   │   (ChromaDB per case)       │ │
                    │  └─────────────┘   └─────────────────────────────┘ │
                    │         │                         │                 │
                    │         ▼                         ▼                 │
                    │  ┌─────────────────────────────────────────────┐   │
                    │  │              Analysis Engine                 │   │
                    │  │  - Evidence retrieval (RAG)                  │   │
                    │  │  - Hypothesis generation (LLM)               │   │
                    │  │  - Strict mode refusal                       │   │
                    │  └─────────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </Card>
          </section>

          {/* Key Features */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Timeline Reconstruction</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Automatically extracts and orders events from logs, deploys, and alerts 
                      using pattern matching for timestamps and error signatures.
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Evidence-Based Hypotheses</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Each hypothesis must cite at least 2 evidence excerpts. 
                      Counter-evidence is also surfaced for balanced analysis.
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Strict Mode Refusal</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      When evidence is insufficient, the system refuses to speculate 
                      and instead recommends what data to collect next.
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <Network className="h-5 w-5 text-purple-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">What Changed Analysis</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Automatically detects deployments, config changes, and infrastructure 
                      modifications around the incident timeframe.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Failure Modes */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Failure Modes Addressed</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Hallucination Prevention</h4>
                    <p className="text-sm text-slate-400">
                      Strict mode requires evidence for every claim. System refuses to speculate 
                      when retrieval confidence is below threshold. Each hypothesis must reference 
                      concrete excerpts from ingested artifacts.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Prompt Injection Protection</h4>
                    <p className="text-sm text-slate-400">
                      All user inputs (incident summary, user notes) are scanned for injection 
                      patterns by the gateway before reaching the analysis engine.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">PII in Logs</h4>
                    <p className="text-sm text-slate-400">
                      Artifact content is scanned and redacted for emails, phone numbers, and 
                      other PII before storage and analysis. Gateway enforces redaction.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Rate Limiting</h4>
                    <p className="text-sm text-slate-400">
                      Analysis requests are expensive (LLM calls). Gateway enforces per-IP rate 
                      limits with higher token costs for analysis endpoints.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Tradeoffs */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Tradeoffs & Future Work</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-white mb-2">Current Limitations</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      Log parsers use regex heuristics; complex custom formats may need extension
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      Case storage uses JSON files; production would benefit from PostgreSQL
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      No real-time log streaming; artifacts must be pasted or uploaded
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-2">Future Improvements</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      Integration with Datadog, Splunk, Loki for direct log ingestion
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      Multi-turn conversational interface for iterative investigation
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      Automated runbook execution suggestions with one-click actions
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      Historical incident pattern matching for faster diagnosis
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </section>

          {/* CTA */}
          <div className="text-center">
            <Link href="/demo/incident">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black">
                Try the Demo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
