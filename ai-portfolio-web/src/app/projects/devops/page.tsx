"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Shield,
  AlertTriangle,
  Clock,
  FileText,
  Database,
  CheckCircle2,
  XCircle,
  GitBranch,
  Gauge,
  Server,
  Target,
} from "lucide-react";

export default function DevOpsProjectPage() {
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
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Zap className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">AI DevOps Control Plane</h1>
                <p className="text-slate-400 mt-1">AI-powered deployment risk assessment and change impact analysis</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Badge className="bg-emerald-500/20 text-emerald-400">DevOps</Badge>
              <Badge className="bg-blue-500/20 text-blue-400">FastAPI</Badge>
              <Badge className="bg-green-500/20 text-green-400">ChromaDB</Badge>
              <Badge className="bg-purple-500/20 text-purple-400">RAG</Badge>
              <Badge className="bg-red-500/20 text-red-400">Risk Assessment</Badge>
            </div>
          </div>

          {/* Overview */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <p className="text-slate-300 leading-relaxed">
                The AI DevOps Control Plane is an intelligent system that evaluates deployment risk
                before changes reach production. By analyzing CI/CD pipelines, deploy events,
                configuration changes, and historical incidents, it provides risk scores,
                evidence-based explanations, and rollout recommendations.
              </p>
              <p className="text-slate-300 leading-relaxed mt-4">
                Unlike simple rule-based checks, this system uses RAG to compare incoming changes
                against historical patterns—identifying when a change is similar to past failures
                and refusing to guess when evidence is insufficient.
              </p>
            </Card>
          </section>

          {/* Risk Model */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Risk Model</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-2xl font-bold text-green-400">0-30%</p>
                  <p className="text-sm text-slate-400">Low Risk</p>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <p className="text-2xl font-bold text-yellow-400">30-60%</p>
                  <p className="text-sm text-slate-400">Medium Risk</p>
                </div>
                <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <p className="text-2xl font-bold text-orange-400">60-80%</p>
                  <p className="text-sm text-slate-400">High Risk</p>
                </div>
                <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-2xl font-bold text-red-400">80-100%</p>
                  <p className="text-sm text-slate-400">Critical</p>
                </div>
              </div>

              <h4 className="font-medium text-white mb-3">Risk Factors Considered:</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-emerald-400 mt-0.5" />
                  <span><strong>Historical similarity</strong> - How similar is this change to past failures?</span>
                </li>
                <li className="flex items-start gap-2">
                  <Server className="h-4 w-4 text-blue-400 mt-0.5" />
                  <span><strong>Blast radius</strong> - What services are affected?</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-yellow-400 mt-0.5" />
                  <span><strong>Change velocity</strong> - How frequently does this area change?</span>
                </li>
                <li className="flex items-start gap-2">
                  <Database className="h-4 w-4 text-purple-400 mt-0.5" />
                  <span><strong>Change complexity</strong> - Database changes, config changes, etc.</span>
                </li>
              </ul>
            </Card>
          </section>

          {/* Rollout Recommendations */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Rollout Recommendations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Safe to Deploy</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Low risk change with no concerning patterns. Proceed with normal deployment.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <Gauge className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Canary Recommended</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Some risk factors present. Deploy to a small subset first.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <GitBranch className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Feature Flag First</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Deploy behind a feature flag so it can be toggled off quickly.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Pause Deployment</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Critical risk detected. Do not proceed without investigation.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Integration with Incidents */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Incident Integration</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <p className="text-slate-300 mb-4">
                The DevOps Control Plane integrates with the AI Incident Investigator to:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <span className="text-white">Find similar past incidents</span>
                    <p className="text-sm text-slate-400">
                      When analyzing a DB-heavy deploy, surface past connection pool incidents.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <span className="text-white">Cite incident root causes</span>
                    <p className="text-sm text-slate-400">
                      Show what caused similar failures, helping engineers avoid repeating mistakes.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <span className="text-white">Learn from history</span>
                    <p className="text-sm text-slate-400">
                      Build a knowledge base that improves risk assessment over time.
                    </p>
                  </div>
                </li>
              </ul>
            </Card>
          </section>

          {/* Failure Modes */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Failure Modes Addressed</h2>
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">False Confidence Prevention</h4>
                    <p className="text-sm text-slate-400">
                      Strict mode refuses to score risk when historical data is insufficient.
                      Explicitly lists unknowns that affect confidence.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">PII in Commit Messages</h4>
                    <p className="text-sm text-slate-400">
                      Gateway redacts PII from diff summaries and descriptions before analysis.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Hallucinated Risk Factors</h4>
                    <p className="text-sm text-slate-400">
                      Every risk claim must cite evidence. LLM uses low temperature and JSON schema enforcement.
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
                      Similarity detection uses keyword matching; semantic similarity could improve
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      No direct CI/CD pipeline integration (requires manual ingestion)
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      Blast radius detection is LLM-inferred, not topology-aware
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Future Improvements</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      GitHub/GitLab webhook integration for automatic ingestion
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      Service dependency graph for accurate blast radius
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      Deployment blocking integration with CD pipelines
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      Post-deployment monitoring and feedback loop
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </section>

          {/* CTA */}
          <div className="text-center">
            <Link href="/demo/devops">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-black">
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
