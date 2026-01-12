"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Server,
  Shield,
  XCircle,
  ChevronRight,
  Gauge,
  GitBranch,
  AlertCircle,
  Target,
  Zap,
  PauseCircle,
  User,
} from "lucide-react";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";

interface ChangeMetadata {
  commit_sha?: string;
  pipeline_id?: string;
  author?: string;
  env: string;
  branch?: string;
  labels: string[];
}

interface Evidence {
  source: string;
  excerpt: string;
  relevance: number;
  source_type: string;
}

interface ContributingFactor {
  factor: string;
  impact: string;
  description: string;
  evidence: Evidence[];
}

interface SimilarIncident {
  case_id: string;
  title: string;
  similarity_score: number;
  root_cause?: string;
}

interface RiskAssessment {
  risk_score: number;
  risk_level: string;
  contributing_factors: ContributingFactor[];
  similar_past_incidents: SimilarIncident[];
  rollout_recommendation: string;
  confidence: number;
  refusal_reason?: string;
  unknowns: string[];
}

interface ChangeSummary {
  change_id: string;
  service: string;
  change_type: string;
  version?: string;
  status: string;
  created_at: string;
  risk_level?: string;
  risk_score?: number;
}

interface AnalysisResult {
  change_id: string;
  service: string;
  change_type: string;
  assessment: RiskAssessment;
  blast_radius: string[];
  change_velocity?: string;
}

const SAMPLE_CHANGES = [
  { id: "high_risk", name: "High Risk Deploy (DB Changes)", file: "high_risk_deploy" },
  { id: "medium_risk", name: "Medium Risk Config Change", file: "medium_risk_config" },
  { id: "low_risk", name: "Low Risk Deploy (Docs Only)", file: "low_risk_deploy" },
];

const FOCUS_AREAS = [
  { value: "", label: "General" },
  { value: "database", label: "Database" },
  { value: "auth", label: "Authentication" },
  { value: "infra", label: "Infrastructure" },
  { value: "performance", label: "Performance" },
  { value: "security", label: "Security" },
];

export default function DevOpsDemoPage() {
  const [changes, setChanges] = useState<ChangeSummary[]>([]);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<ContributingFactor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis controls
  const [strictMode, setStrictMode] = useState(true);
  const [focusArea, setFocusArea] = useState("");

  // Filters
  const [filterService, setFilterService] = useState("");
  const [filterRiskLevel, setFilterRiskLevel] = useState("");

  useEffect(() => {
    fetchChanges();
  }, []);

  async function fetchChanges() {
    try {
      const response = await fetch(`${GATEWAY_URL}/devops/changes`);
      if (response.ok) {
        const data = await response.json();
        setChanges(data.changes || []);
      }
    } catch (err) {
      console.error("Failed to fetch changes:", err);
    }
  }

  async function loadSampleChange(sampleId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const sampleData = sampleId === "high_risk" ? {
        change_type: "deploy",
        service: "order-service",
        version: "v2.5.0",
        metadata: {
          commit_sha: "a3f8c91e",
          author: "engineer@company.com",
          env: "production",
          labels: ["database", "performance"]
        },
        diff_summary: "Major changes to database query patterns for product recommendations:\n\n- Added new recommendation engine with segment-based queries\n- Changed RECOMMENDATION_BATCH_SIZE from 100 to 500\n- New JOIN operations on products and recommendations tables\n- Removed connection pooling timeout (was 30s)\n\nDatabase impact:\n- Estimated 3x increase in query complexity\n- Higher connection pool utilization expected",
        description: "Deploy new product recommendation engine with enhanced database queries"
      } : sampleId === "medium_risk" ? {
        change_type: "config",
        service: "api-gateway",
        metadata: {
          commit_sha: "b7e2d41f",
          author: "sre@company.com",
          env: "production",
          labels: ["config", "timeout"]
        },
        diff_summary: "Configuration change to API gateway timeouts:\n\n- upstream_timeout: 30s -> 60s\n- downstream_timeout: 15s -> 30s\n- max_retries: 3 -> 5\n\nReason: Address intermittent 504 errors during peak load.",
        description: "Increase gateway timeouts to reduce 504 errors"
      } : {
        change_type: "deploy",
        service: "docs-website",
        version: "v1.8.2",
        metadata: {
          commit_sha: "c9a4f83d",
          author: "tech-writer@company.com",
          env: "production",
          labels: ["documentation", "frontend"]
        },
        diff_summary: "Documentation and frontend-only updates:\n\n- Updated API documentation for v2 endpoints\n- Fixed typos in getting-started guide\n- Improved mobile navigation styling\n\nNo backend changes. No database changes.",
        description: "Routine documentation update with minor frontend fixes"
      };

      const ingestResponse = await fetch(`${GATEWAY_URL}/devops/changes/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleData),
      });

      if (!ingestResponse.ok) {
        throw new Error("Failed to ingest sample change");
      }

      const ingestResult = await ingestResponse.json();
      setSelectedChange(ingestResult.change_id);
      await fetchChanges();
      await analyzeChange(ingestResult.change_id);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample change");
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeChange(changeId: string) {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedFactor(null);

    try {
      const response = await fetch(`${GATEWAY_URL}/devops/changes/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_id: changeId,
          strict_mode: strictMode,
          focus_area: focusArea || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze change");
      }

      const result = await response.json();
      setAnalysis(result);

      if (result.assessment?.contributing_factors?.length > 0) {
        setSelectedFactor(result.assessment.contributing_factors[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  function getRiskColor(level: string) {
    switch (level?.toLowerCase()) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-slate-500";
    }
  }

  function getRiskBadgeClass(level: string) {
    switch (level?.toLowerCase()) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/50";
      case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "low": return "bg-green-500/20 text-green-400 border-green-500/50";
      default: return "bg-slate-500/20 text-slate-400";
    }
  }

  function getRecommendationIcon(rec: string) {
    switch (rec) {
      case "safe_to_deploy": return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case "canary_recommended": return <Gauge className="h-5 w-5 text-yellow-400" />;
      case "feature_flag_first": return <GitBranch className="h-5 w-5 text-blue-400" />;
      case "needs_human_review": return <User className="h-5 w-5 text-orange-400" />;
      case "pause_deployment": return <PauseCircle className="h-5 w-5 text-red-400" />;
      default: return <AlertCircle className="h-5 w-5 text-slate-400" />;
    }
  }

  function getRecommendationText(rec: string) {
    switch (rec) {
      case "safe_to_deploy": return "Safe to Deploy";
      case "canary_recommended": return "Canary Recommended";
      case "feature_flag_first": return "Feature Flag First";
      case "needs_human_review": return "Needs Human Review";
      case "pause_deployment": return "Pause Deployment";
      default: return rec;
    }
  }

  function getConfidenceLabel(confidence: number) {
    if (confidence >= 0.75) return { label: "High", color: "text-green-400" };
    if (confidence >= 0.5) return { label: "Medium", color: "text-yellow-400" };
    return { label: "Low", color: "text-red-400" };
  }

  const filteredChanges = changes.filter(c => {
    if (filterService && c.service !== filterService) return false;
    if (filterRiskLevel && c.risk_level !== filterRiskLevel) return false;
    return true;
  });

  const uniqueServices = Array.from(new Set(changes.map(c => c.service)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Zap className="h-6 w-6 text-emerald-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">AI DevOps Control Plane</h1>
            </div>
            <p className="text-slate-400 ml-14">
              Deployment risk assessment with historical analysis and rollout recommendations.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Panel - Change Selector */}
            <div className="col-span-3 space-y-4">
              <Card className="bg-slate-900/50 border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Load Sample Change</h3>
                <div className="space-y-2">
                  {SAMPLE_CHANGES.map(sample => (
                    <Button
                      key={sample.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 border-slate-700 hover:bg-slate-800 text-slate-300 whitespace-normal break-words"
                      onClick={() => loadSampleChange(sample.id)}
                      disabled={isLoading}
                    >
                      <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{sample.name}</span>
                    </Button>
                  ))}
                </div>
              </Card>

              {/* Filters */}
              <Card className="bg-slate-900/50 border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Filters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Service</label>
                    <select
                      value={filterService}
                      onChange={(e) => setFilterService(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-300"
                    >
                      <option value="">All Services</option>
                      {uniqueServices.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Risk Level</label>
                    <select
                      value={filterRiskLevel}
                      onChange={(e) => setFilterRiskLevel(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-300"
                    >
                      <option value="">All Levels</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Change List */}
              <Card className="bg-slate-900/50 border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Changes</h3>
                {filteredChanges.length === 0 ? (
                  <p className="text-sm text-slate-500">No changes yet. Load a sample to start.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredChanges.map(c => (
                      <button
                        key={c.change_id}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          selectedChange === c.change_id
                            ? "bg-emerald-500/20 border border-emerald-500/50"
                            : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                        }`}
                        onClick={() => {
                          setSelectedChange(c.change_id);
                          analyzeChange(c.change_id);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-200 truncate">{c.service}</p>
                          {c.risk_level && (
                            <Badge className={`text-xs ${getRiskBadgeClass(c.risk_level)}`}>
                              {c.risk_level}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{c.change_type} • {c.version || 'N/A'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Analysis Controls */}
              <Card className="bg-slate-900/50 border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Analysis Controls</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-400">Strict Mode</label>
                    <button
                      onClick={() => setStrictMode(!strictMode)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        strictMode ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        strictMode ? "translate-x-6" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Focus Area</label>
                    <select
                      value={focusArea}
                      onChange={(e) => setFocusArea(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-300"
                    >
                      {FOCUS_AREAS.map(area => (
                        <option key={area.value} value={area.value}>{area.label}</option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={() => selectedChange && analyzeChange(selectedChange)}
                    disabled={!selectedChange || isLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Rerun Analysis
                  </Button>
                </div>
              </Card>
            </div>

            {/* Main Panel - Risk Assessment */}
            <div className="col-span-6">
              {error && (
                <Card className="bg-red-900/20 border-red-800 p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span>{error}</span>
                  </div>
                </Card>
              )}

              {isLoading && !analysis && (
                <Card className="bg-slate-900/50 border-slate-800 p-12 flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 text-emerald-400 animate-spin mb-4" />
                  <p className="text-slate-400">Analyzing change risk...</p>
                  <p className="text-sm text-slate-500 mt-2">Comparing against historical data</p>
                </Card>
              )}

              {!analysis && !isLoading && (
                <Card className="bg-slate-900/50 border-slate-800 p-12 flex flex-col items-center justify-center">
                  <Zap className="h-16 w-16 text-slate-700 mb-4" />
                  <p className="text-slate-400 text-lg">Select or load a change to analyze</p>
                  <p className="text-sm text-slate-500 mt-2">Use the sample changes on the left to get started</p>
                </Card>
              )}

              {analysis && (
                <>
                  {/* Refusal Banner */}
                  {analysis.assessment.refusal_reason && (
                    <Card className="bg-amber-900/20 border-amber-700 p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-amber-400 font-medium">Analysis Limited - Insufficient Evidence</p>
                          <p className="text-amber-300/80 text-sm mt-1">{analysis.assessment.refusal_reason}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Risk Summary Card */}
                  <Card className="bg-slate-900/50 border-slate-800 p-6 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{analysis.service}</h3>
                        <p className="text-sm text-slate-400">{analysis.change_type} • {analysis.change_velocity} velocity</p>
                      </div>
                      <Badge className={`text-lg px-4 py-2 ${getRiskBadgeClass(analysis.assessment.risk_level)}`}>
                        {analysis.assessment.risk_level.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Risk Score Bar */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Risk Score</span>
                        <span className="text-white font-mono text-lg">
                          {Math.round(analysis.assessment.risk_score * 100)}%
                        </span>
                      </div>
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getRiskColor(analysis.assessment.risk_level)}`}
                          style={{ width: `${analysis.assessment.risk_score * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Rollout Recommendation */}
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRecommendationIcon(analysis.assessment.rollout_recommendation)}
                        <div>
                          <p className="text-white font-medium">
                            {getRecommendationText(analysis.assessment.rollout_recommendation)}
                          </p>
                          <p className="text-sm text-slate-400">Recommended rollout strategy</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Blast Radius */}
                  {analysis.blast_radius.length > 0 && (
                    <Card className="bg-slate-900/50 border-slate-800 p-4 mb-4">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Blast Radius</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.blast_radius.map((service, i) => (
                          <Badge key={i} variant="outline" className="text-slate-300">
                            <Server className="h-3 w-3 mr-1" />
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Contributing Factors */}
                  <Card className="bg-slate-900/50 border-slate-800 p-4 mb-4">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">
                      Contributing Factors ({analysis.assessment.contributing_factors.length})
                    </h4>
                    {analysis.assessment.contributing_factors.length === 0 ? (
                      <p className="text-slate-500 text-sm">No significant risk factors identified</p>
                    ) : (
                      <div className="space-y-2">
                        {analysis.assessment.contributing_factors.map((factor, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedFactor(factor)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              selectedFactor?.factor === factor.factor
                                ? "bg-emerald-500/20 border border-emerald-500/50"
                                : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">{factor.factor}</span>
                              <Badge className={
                                factor.impact === "high" ? "bg-red-500/20 text-red-400" :
                                factor.impact === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-green-500/20 text-green-400"
                              }>
                                {factor.impact}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{factor.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Unknowns */}
                  {analysis.assessment.unknowns.length > 0 && (
                    <Card className="bg-slate-900/50 border-slate-800 p-4">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Unknowns</h4>
                      <ul className="space-y-2">
                        {analysis.assessment.unknowns.map((unknown, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            {unknown}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </>
              )}
            </div>

            {/* Right Panel - Evidence & Incidents */}
            <div className="col-span-3 space-y-4">
              {/* Confidence */}
              {analysis && (
                <Card className="bg-slate-900/50 border-slate-800 p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Analysis Confidence</h4>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${getConfidenceLabel(analysis.assessment.confidence).color}`}>
                      {getConfidenceLabel(analysis.assessment.confidence).label}
                    </span>
                    <span className="text-white font-mono">
                      {Math.round(analysis.assessment.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        analysis.assessment.confidence >= 0.75 ? "bg-green-500" :
                        analysis.assessment.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${analysis.assessment.confidence * 100}%` }}
                    />
                  </div>
                  {analysis.assessment.confidence < 0.5 && (
                    <p className="text-xs text-amber-400 mt-2">
                      ⚠️ Low confidence - consider gathering more data
                    </p>
                  )}
                </Card>
              )}

              {/* Selected Factor Evidence */}
              {selectedFactor && (
                <Card className="bg-slate-900/50 border-slate-800 p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">
                    Evidence: {selectedFactor.factor}
                  </h4>
                  {selectedFactor.evidence.length === 0 ? (
                    <p className="text-sm text-slate-500">No specific evidence cited</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedFactor.evidence.map((ev, i) => (
                        <div key={i} className="p-2 bg-slate-800/50 rounded text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{ev.source_type}</Badge>
                            <span className="text-slate-500">{Math.round(ev.relevance * 100)}%</span>
                          </div>
                          <p className="text-slate-400 line-clamp-3">{ev.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Similar Incidents */}
              {analysis && (
                <Card className="bg-slate-900/50 border-slate-800 p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">
                    Similar Past Incidents ({analysis.assessment.similar_past_incidents.length})
                  </h4>
                  {analysis.assessment.similar_past_incidents.length === 0 ? (
                    <p className="text-sm text-slate-500">No similar incidents found</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {analysis.assessment.similar_past_incidents.map((inc, i) => (
                        <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-white font-medium truncate">{inc.title}</span>
                            <span className="text-xs text-slate-500">
                              {Math.round(inc.similarity_score * 100)}%
                            </span>
                          </div>
                          {inc.root_cause && (
                            <p className="text-xs text-slate-400 line-clamp-2">{inc.root_cause}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
