"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  Upload,
  XCircle,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Target,
  Beaker,
  Wrench,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Calendar,
} from "lucide-react";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";

interface Artifact {
  type: string;
  source_id: string;
  content: string;
}

interface Evidence {
  source_id: string;
  excerpt: string;
  relevance: number;
  artifact_type: string;
}

interface Hypothesis {
  rank: number;
  title: string;
  root_cause: string;
  confidence: number;
  evidence: Evidence[];
  counter_evidence: Evidence[];
  tests_to_confirm: string[];
  immediate_mitigations: string[];
  long_term_fixes: string[];
}

interface TimelineEvent {
  timestamp_str: string;
  kind: string;
  title: string;
  details: string;
  severity: string;
}

interface WhatChanged {
  category: string;
  description: string;
  evidence: Evidence[];
}

interface CaseSummary {
  case_id: string;
  title: string;
  status: string;
  created_at: string;
  artifact_count: number;
  confidence_overall?: number;
}

interface AnalysisResult {
  case_id: string;
  timeline_events: TimelineEvent[];
  hypotheses: Hypothesis[];
  what_changed: WhatChanged[];
  recommended_next_steps: string[];
  confidence_overall: number;
  refusal_reason?: string;
}

const SAMPLE_INCIDENTS = [
  { id: "db_pool", name: "DB Connection Pool Exhaustion", file: "db_pool_exhaustion" },
  { id: "auth_clock", name: "Auth Token Clock Skew", file: "auth_clock_skew" },
];

const FOCUS_AREAS = [
  { value: "", label: "General" },
  { value: "database", label: "Database" },
  { value: "auth", label: "Authentication" },
  { value: "network", label: "Network" },
  { value: "deployment", label: "Deployment" },
  { value: "performance", label: "Performance" },
];

export default function IncidentDemoPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedHypothesis, setSelectedHypothesis] = useState<Hypothesis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "hypotheses" | "changes" | "next">("timeline");
  
  // Analysis controls
  const [strictMode, setStrictMode] = useState(true);
  const [topK, setTopK] = useState(8);
  const [hypothesisCount, setHypothesisCount] = useState(3);
  const [focusArea, setFocusArea] = useState("");
  
  // Filters
  const [timelineFilter, setTimelineFilter] = useState<string>("all");
  
  // Time scoping
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  
  // Feedback state
  const [feedbackStatus, setFeedbackStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    try {
      const response = await fetch(`${GATEWAY_URL}/incident/cases`);
      if (response.ok) {
        const data = await response.json();
        setCases(data.cases || []);
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
    }
  }

  async function loadSampleIncident(sampleId: string) {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use inline sample data (avoid external imports in Docker build)
      const sampleData = sampleId === "db_pool" ? {
          title: "DB Connection Pool Exhaustion after Deploy",
          incident_summary: "Starting at 14:32 UTC, users reported slow response times and timeouts on the checkout flow. Error rates spiked to 15% on the order service. The incident correlated with a deployment at 14:15 UTC that introduced a new product recommendation feature with heavier database queries.",
          artifacts: [
            {
              type: "logs",
              source_id: "order-service-pod-1",
              content: "2024-01-15T14:32:15.234Z ERROR [order-service] Failed to acquire database connection: pool exhausted, all 50 connections in use\n2024-01-15T14:32:16.789Z WARN [order-service] Connection pool utilization at 100%, queue depth: 234\n2024-01-15T14:35:00.000Z ERROR [order-service] Circuit breaker OPEN for database calls"
            },
            {
              type: "deploy_history",
              source_id: "argocd-deploy-log",
              content: "2024-01-15T14:15:00Z Deployment started: product-service v2.3.0 -> v2.4.0\n2024-01-15T14:16:05Z Config change: RECOMMENDATION_BATCH_SIZE: 100 -> 500\n2024-01-15T14:16:10Z Config change: ENABLE_PERSONALIZED_RECOMMENDATIONS: false -> true"
            },
            {
              type: "alerts",
              source_id: "datadog-alerts",
              content: "2024-01-15T14:32:00Z ALERT TRIGGERED: High Error Rate\n  service: order-service\n  severity: critical\n  current_value: 15.3%"
            }
          ]
        } : {
          title: "Auth Token Validation Failure due to Clock Skew",
          incident_summary: "Starting at 09:15 UTC, users reported being unable to log in. The auth service was rejecting valid JWT tokens with 'token not yet valid' and 'token expired' errors simultaneously.",
          artifacts: [
            {
              type: "logs",
              source_id: "auth-service-pod-1",
              content: "2024-01-20T09:15:32.123Z ERROR [auth-service] JWT validation failed: Token not yet valid (iat claim)\n2024-01-20T09:15:34.012Z WARN [auth-service] Clock skew detected: server time differs from token time by 180 seconds"
            },
            {
              type: "deploy_history",
              source_id: "github-actions-deploy",
              content: "2024-01-20T08:00:30Z Base image updated: node:18-alpine3.17 -> node:18-alpine3.19\n2024-01-20T08:45:00Z Note: New alpine image removes ntpd, uses chronyd instead"
            },
            {
              type: "alerts",
              source_id: "pagerduty-alerts",
              content: "2024-01-20T09:16:00Z ALERT TRIGGERED: Authentication Failures\n  severity: critical\n  current_value: 89.5%"
            }
          ]
        };
      
      // Ingest the sample
      const ingestResponse = await fetch(`${GATEWAY_URL}/incident/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleData),
      });
      
      if (!ingestResponse.ok) {
        throw new Error("Failed to ingest sample incident");
      }
      
      const ingestResult = await ingestResponse.json();
      setSelectedCase(ingestResult.case_id);
      await fetchCases();
      
      // Auto-analyze
      await analyzeCase(ingestResult.case_id);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample incident");
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeCase(caseId: string) {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedHypothesis(null);
    
    try {
      const requestBody: Record<string, unknown> = {
        case_id: caseId,
        strict_mode: strictMode,
        top_k: topK,
        hypothesis_count: hypothesisCount,
        focus_area: focusArea || null,
      };
      
      // Add time scoping if provided
      if (startTime) requestBody.start_time = startTime;
      if (endTime) requestBody.end_time = endTime;
      
      const response = await fetch(`${GATEWAY_URL}/incident/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error("Failed to analyze incident");
      }
      
      const result = await response.json();
      setAnalysis(result);
      
      if (result.hypotheses?.length > 0) {
        setSelectedHypothesis(result.hypotheses[0]);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function rerunAnalysis() {
    if (!selectedCase) return;
    await analyzeCase(selectedCase);
  }

  async function submitFeedback(hypothesisRank: number, feedbackType: string) {
    if (!selectedCase) return;
    
    try {
      const response = await fetch(`${GATEWAY_URL}/incident/cases/${selectedCase}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesis_rank: hypothesisRank,
          feedback_type: feedbackType,
        }),
      });
      
      if (response.ok) {
        setFeedbackStatus(prev => ({
          ...prev,
          [hypothesisRank]: feedbackType
        }));
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  }

  function getConfidenceLabel(confidence: number): { label: string; color: string; description: string } {
    if (confidence >= 0.75) {
      return { label: "High", color: "text-green-400", description: "Strongly Supported" };
    } else if (confidence >= 0.5) {
      return { label: "Medium", color: "text-yellow-400", description: "Plausible" };
    }
    return { label: "Low", color: "text-red-400", description: "Speculative" };
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "error": return "bg-orange-500";
      case "warning": return "bg-yellow-500";
      default: return "bg-blue-500";
    }
  }

  function getKindIcon(kind: string) {
    switch (kind) {
      case "error":
      case "timeout":
      case "pool_exhaustion":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "deploy":
      case "version":
        return <Server className="h-4 w-4 text-purple-400" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      case "auth":
        return <Shield className="h-4 w-4 text-blue-400" />;
      case "database":
        return <Database className="h-4 w-4 text-green-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }

  const filteredEvents = analysis?.timeline_events.filter(event => {
    if (timelineFilter === "all") return true;
    if (timelineFilter === "errors") return ["error", "timeout", "pool_exhaustion", "critical"].includes(event.kind);
    if (timelineFilter === "deploys") return ["deploy", "version", "rollback"].includes(event.kind);
    if (timelineFilter === "alerts") return event.kind === "alert";
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Search className="h-6 w-6 text-amber-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">AI Incident Investigator</h1>
            </div>
            <p className="text-slate-400 ml-14">
              Interactive root cause analysis with evidence-based hypotheses and timeline reconstruction.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Panel - Case Selector */}
            <div className="col-span-3 space-y-4">
              <Card className="bg-slate-900/50 border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Load Sample Case</h3>
                <div className="space-y-2">
                  {SAMPLE_INCIDENTS.map(sample => (
                    <Button
                      key={sample.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 border-slate-700 hover:bg-slate-800 text-slate-300 whitespace-normal break-words"
                      onClick={() => loadSampleIncident(sample.id)}
                      disabled={isLoading}
                    >
                      <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{sample.name}</span>
                    </Button>
                  ))}
                </div>
              </Card>

              {/* Previous Cases */}
              <Card className="bg-slate-900/50 border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Previous Cases</h3>
                {cases.length === 0 ? (
                  <p className="text-sm text-slate-500">No cases yet. Load a sample to start.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cases.map(c => (
                      <button
                        key={c.case_id}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          selectedCase === c.case_id
                            ? "bg-amber-500/20 border border-amber-500/50"
                            : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                        }`}
                        onClick={() => {
                          setSelectedCase(c.case_id);
                          analyzeCase(c.case_id);
                        }}
                      >
                        <p className="text-sm text-slate-200 truncate">{c.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {c.status}
                          </Badge>
                          {c.confidence_overall !== undefined && (
                            <span className="text-xs text-slate-500">
                              {Math.round(c.confidence_overall * 100)}% conf
                            </span>
                          )}
                        </div>
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
                    <label className="text-sm text-slate-400 block mb-1">Top K Evidence: {topK}</label>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Hypotheses: {hypothesisCount}</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={hypothesisCount}
                      onChange={(e) => setHypothesisCount(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
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
                  
                  {/* Time Scoping */}
                  <div className="pt-3 border-t border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Time Scope (optional)</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300"
                        placeholder="Start time"
                      />
                      <input
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300"
                        placeholder="End time"
                      />
                      {(startTime || endTime) && (
                        <button
                          onClick={() => { setStartTime(""); setEndTime(""); }}
                          className="text-xs text-slate-500 hover:text-slate-300"
                        >
                          Clear time scope
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={rerunAnalysis}
                    disabled={!selectedCase || isLoading}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black"
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

            {/* Main Panel - Timeline/Analysis */}
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
                  <Loader2 className="h-12 w-12 text-amber-400 animate-spin mb-4" />
                  <p className="text-slate-400">Analyzing incident artifacts...</p>
                  <p className="text-sm text-slate-500 mt-2">Building timeline & generating hypotheses</p>
                </Card>
              )}

              {!analysis && !isLoading && (
                <Card className="bg-slate-900/50 border-slate-800 p-12 flex flex-col items-center justify-center">
                  <Search className="h-16 w-16 text-slate-700 mb-4" />
                  <p className="text-slate-400 text-lg">Select or load an incident case to begin investigation</p>
                  <p className="text-sm text-slate-500 mt-2">Use the sample cases on the left to get started</p>
                </Card>
              )}

              {analysis && (
                <>
                  {/* Refusal Banner */}
                  {analysis.refusal_reason && (
                    <Card className="bg-amber-900/20 border-amber-700 p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-amber-400 font-medium">Analysis Refused - Insufficient Evidence</p>
                          <p className="text-amber-300/80 text-sm mt-1">{analysis.refusal_reason}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Confidence Score with Qualitative Label */}
                  <Card className="bg-slate-900/50 border-slate-800 p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400">Overall Confidence</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getConfidenceLabel(analysis.confidence_overall).color}`}>
                          {getConfidenceLabel(analysis.confidence_overall).label}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({getConfidenceLabel(analysis.confidence_overall).description})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            analysis.confidence_overall >= 0.75 ? "bg-green-500" :
                            analysis.confidence_overall >= 0.5 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${analysis.confidence_overall * 100}%` }}
                        />
                      </div>
                      <span className="text-white font-mono text-sm w-12 text-right">
                        {Math.round(analysis.confidence_overall * 100)}%
                      </span>
                    </div>
                    {analysis.confidence_overall < 0.5 && (
                      <div className="mt-3 p-2 bg-red-900/20 border border-red-800/50 rounded-lg">
                        <div className="flex items-center gap-2 text-red-400 text-xs">
                          <AlertCircle className="h-4 w-4" />
                          <span>Low confidence - results may be speculative. Consider gathering more evidence.</span>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Tab Navigation */}
                  <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg">
                    {[
                      { id: "timeline", label: "Timeline", count: filteredEvents.length },
                      { id: "hypotheses", label: "Hypotheses", count: analysis.hypotheses.length },
                      { id: "changes", label: "What Changed", count: analysis.what_changed.length },
                      { id: "next", label: "Next Steps", count: analysis.recommended_next_steps.length },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          activeTab === tab.id
                            ? "bg-amber-500 text-black"
                            : "text-slate-400 hover:text-white hover:bg-slate-700"
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  {/* Timeline Tab */}
                  {activeTab === "timeline" && (
                    <Card className="bg-slate-900/50 border-slate-800 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Event Timeline</h3>
                        <div className="flex gap-2">
                          {["all", "errors", "deploys", "alerts"].map(filter => (
                            <button
                              key={filter}
                              onClick={() => setTimelineFilter(filter)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                timelineFilter === filter
                                  ? "bg-amber-500 text-black"
                                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              }`}
                            >
                              {filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {filteredEvents.length === 0 ? (
                          <p className="text-slate-500 text-center py-8">No events match the selected filter</p>
                        ) : (
                          filteredEvents.map((event, i) => (
                            <div
                              key={i}
                              className="flex gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                              <div className={`w-1 rounded-full ${getSeverityColor(event.severity)}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {getKindIcon(event.kind)}
                                  <span className="text-sm font-medium text-white">{event.title}</span>
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {event.kind}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-mono">{event.timestamp_str}</p>
                                <p className="text-sm text-slate-400 mt-2 truncate">{event.details}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Hypotheses Tab */}
                  {activeTab === "hypotheses" && (
                    <Card className="bg-slate-900/50 border-slate-800 p-4">
                      <h3 className="font-semibold text-white mb-4">Root Cause Hypotheses</h3>
                      <div className="space-y-3">
                        {analysis.hypotheses.map((hyp, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedHypothesis(hyp)}
                            className={`w-full text-left p-4 rounded-lg transition-colors ${
                              selectedHypothesis?.rank === hyp.rank
                                ? "bg-amber-500/20 border border-amber-500/50"
                                : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <span className="text-amber-400 font-bold">#{hyp.rank}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-white">{hyp.title}</h4>
                                  <Badge
                                    className={`${
                                      hyp.confidence >= 0.7 ? "bg-green-500/20 text-green-400" :
                                      hyp.confidence >= 0.4 ? "bg-amber-500/20 text-amber-400" :
                                      "bg-red-500/20 text-red-400"
                                    }`}
                                  >
                                    {Math.round(hyp.confidence * 100)}% confidence
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{hyp.root_cause}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                  <span>{hyp.evidence.length} evidence</span>
                                  <span>{hyp.tests_to_confirm.length} tests</span>
                                  <span>{hyp.immediate_mitigations.length} mitigations</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* What Changed Tab */}
                  {activeTab === "changes" && (
                    <Card className="bg-slate-900/50 border-slate-800 p-4">
                      <h3 className="font-semibold text-white mb-4">What Changed</h3>
                      {analysis.what_changed.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No explicit changes detected in artifacts</p>
                      ) : (
                        <div className="space-y-3">
                          {analysis.what_changed.map((change, i) => (
                            <div key={i} className="p-4 bg-slate-800/50 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{change.category}</Badge>
                              </div>
                              <p className="text-slate-300">{change.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Next Steps Tab */}
                  {activeTab === "next" && (
                    <Card className="bg-slate-900/50 border-slate-800 p-4">
                      <h3 className="font-semibold text-white mb-4">Recommended Next Steps</h3>
                      <div className="space-y-2">
                        {analysis.recommended_next_steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <span className="text-amber-400 text-xs font-bold">{i + 1}</span>
                            </div>
                            <p className="text-slate-300">{step}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>

            {/* Right Panel - Hypothesis Detail */}
            <div className="col-span-3">
              {selectedHypothesis ? (
                <Card className="bg-slate-900/50 border-slate-800 p-4 sticky top-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="h-5 w-5 text-amber-400" />
                    <h3 className="font-semibold text-white">Hypothesis #{selectedHypothesis.rank}</h3>
                  </div>
                  
                  <h4 className="text-lg font-medium text-white mb-2">{selectedHypothesis.title}</h4>
                  <p className="text-sm text-slate-400 mb-4">{selectedHypothesis.root_cause}</p>
                  
                  {/* Evidence */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-slate-300">Evidence ({selectedHypothesis.evidence.length})</span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectedHypothesis.evidence.map((ev, i) => (
                        <div key={i} className="p-2 bg-slate-800/50 rounded text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{ev.source_id}</Badge>
                            <span className="text-slate-500">{Math.round(ev.relevance * 100)}%</span>
                          </div>
                          <p className="text-slate-400 line-clamp-2">{ev.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Counter Evidence */}
                  {selectedHypothesis.counter_evidence.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-medium text-slate-300">Counter Evidence</span>
                      </div>
                      <div className="space-y-2">
                        {selectedHypothesis.counter_evidence.map((ev, i) => (
                          <div key={i} className="p-2 bg-red-900/20 rounded text-xs">
                            <p className="text-red-300 line-clamp-2">{ev.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Tests to Confirm */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Beaker className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-slate-300">Tests to Confirm</span>
                    </div>
                    <ul className="space-y-1">
                      {selectedHypothesis.tests_to_confirm.map((test, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {test}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Immediate Mitigations */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-slate-300">Immediate Mitigations</span>
                    </div>
                    <ul className="space-y-1">
                      {selectedHypothesis.immediate_mitigations.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Long-term Fixes */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-slate-300">Long-term Fixes</span>
                    </div>
                    <ul className="space-y-1">
                      {selectedHypothesis.long_term_fixes.map((fix, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Human Feedback */}
                  <div className="pt-4 mt-4 border-t border-slate-700">
                    <p className="text-sm font-medium text-slate-300 mb-3">Was this hypothesis helpful?</p>
                    
                    {feedbackStatus[selectedHypothesis.rank] ? (
                      <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                        {feedbackStatus[selectedHypothesis.rank] === "confirmed" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : feedbackStatus[selectedHypothesis.rank] === "rejected" ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <HelpCircle className="h-4 w-4 text-yellow-400" />
                        )}
                        <span className="text-sm text-slate-400 capitalize">
                          Human {feedbackStatus[selectedHypothesis.rank]}
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-green-500/50 hover:bg-green-500/20 text-green-400"
                          onClick={() => submitFeedback(selectedHypothesis.rank, "confirmed")}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-500/50 hover:bg-red-500/20 text-red-400"
                          onClick={() => submitFeedback(selectedHypothesis.rank, "rejected")}
                        >
                          <ThumbsDown className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-500/50 hover:bg-yellow-500/20 text-yellow-400"
                          onClick={() => submitFeedback(selectedHypothesis.rank, "uncertain")}
                        >
                          <HelpCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="bg-slate-900/50 border-slate-800 p-8 flex flex-col items-center justify-center">
                  <Lightbulb className="h-12 w-12 text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm text-center">Select a hypothesis to view details</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
