"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Lightbulb,
  Shield,
  Database,
  Cpu,
  GitBranch,
  Ban
} from "lucide-react";

interface Constraint {
  latency: string;
  scale: string;
  data_sensitivity: string;
  cost_sensitivity: string;
  compliance: string[];
}

interface ArchitectureDecision {
  recommended_approach: string;
  rationale: string;
  system_components: Array<{name: string; purpose: string; technology_suggestion?: string}>;
  architecture_flow: string;
  tradeoffs: Array<{aspect: string; pros: string[]; cons: string[]}>;
  risks: Array<{risk: string; severity: string; mitigation: string}>;
  cost_estimate_level: string;
  alternatives_considered: Array<{approach: string; reason_rejected: string}>;
  confidence: number;
  refusal_reason?: string;
  missing_information?: string[];
}

interface ReviewResult {
  review_id: string;
  status: string;
  decision: ArchitectureDecision;
}

const APPROACH_ICONS: Record<string, React.ReactNode> = {
  rag: <Database className="h-5 w-5" />,
  fine_tuning: <Cpu className="h-5 w-5" />,
  rules: <GitBranch className="h-5 w-5" />,
  hybrid: <Lightbulb className="h-5 w-5" />,
  no_ai: <Ban className="h-5 w-5" />,
};

const APPROACH_LABELS: Record<string, string> = {
  rag: "RAG (Retrieval-Augmented Generation)",
  fine_tuning: "Fine-Tuned Model",
  rules: "Rule-Based System",
  hybrid: "Hybrid Approach",
  no_ai: "No AI Recommended",
};

const APPROACH_COLORS: Record<string, string> = {
  rag: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  fine_tuning: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  rules: "bg-green-500/20 text-green-400 border-green-500/50",
  hybrid: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  no_ai: "bg-gray-500/20 text-gray-400 border-gray-500/50",
};

const SAMPLE_PROBLEMS = [
  {
    name: "Customer Support KB",
    problem: "We need to build an AI-powered customer support assistant that can answer questions about our products using our existing documentation. The support team currently spends 60% of their time answering repetitive questions that are already documented in our knowledge base. We have about 500 product documents, FAQs, and troubleshooting guides.",
    constraints: { latency: "medium", scale: "medium", data_sensitivity: "internal", cost_sensitivity: "medium", compliance: [] },
    data_availability: "sufficient",
    team_maturity: "medium",
  },
  {
    name: "Real-time Fraud Detection",
    problem: "We need a system to detect fraudulent transactions in real-time as they occur. The system must analyze each transaction within 50ms to avoid blocking legitimate purchases. It will process credit card transactions with full PAN data and must comply with PCI-DSS requirements.",
    constraints: { latency: "low", scale: "large", data_sensitivity: "regulated", cost_sensitivity: "low", compliance: ["SOC2"] },
    data_availability: "sufficient",
    team_maturity: "high",
  },
  {
    name: "Report Summarization",
    problem: "Our analysts spend hours reading through lengthy quarterly reports from different departments to create executive summaries. We want an AI system that can automatically summarize these reports and highlight key metrics, trends, and action items. Reports are generated monthly and summaries are needed within 24 hours.",
    constraints: { latency: "high", scale: "small", data_sensitivity: "internal", cost_sensitivity: "medium", compliance: [] },
    data_availability: "sufficient",
    team_maturity: "medium",
  },
  {
    name: "Vague Idea (Should Refuse)",
    problem: "We want to use AI.",
    constraints: { latency: "medium", scale: "medium", data_sensitivity: "internal", cost_sensitivity: "medium", compliance: [] },
    data_availability: "none",
    team_maturity: "low",
  },
];

export default function ArchitectureDemoPage() {
  const [problemStatement, setProblemStatement] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [constraints, setConstraints] = useState<Constraint>({
    latency: "medium",
    scale: "medium",
    data_sensitivity: "internal",
    cost_sensitivity: "medium",
    compliance: [],
  });
  const [dataAvailability, setDataAvailability] = useState("limited");
  const [teamMaturity, setTeamMaturity] = useState("medium");
  const [strictMode, setStrictMode] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["components", "flow"]));
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const loadSample = (sample: typeof SAMPLE_PROBLEMS[0]) => {
    setProblemStatement(sample.problem);
    setConstraints(sample.constraints);
    setDataAvailability(sample.data_availability);
    setTeamMaturity(sample.team_maturity);
    setResult(null);
    setError(null);
    setFeedbackSubmitted(null);
  };

  const performReview = async () => {
    if (!problemStatement.trim()) {
      setError("Please enter a problem statement");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setFeedbackSubmitted(null);

    try {
      const response = await fetch("http://localhost:8000/architecture/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_statement: problemStatement,
          constraints,
          data_availability: dataAvailability,
          team_maturity: teamMaturity,
          user_notes: userNotes || null,
          strict_mode: strictMode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (feedbackType: string) => {
    if (!result?.review_id) return;

    try {
      const response = await fetch(`http://localhost:8000/architecture/reviews/${result.review_id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_type: feedbackType }),
      });

      if (response.ok) {
        setFeedbackSubmitted(feedbackType);
      }
    } catch {
      // Silently fail feedback submission
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.75) return { label: "High Confidence", color: "text-green-400" };
    if (confidence >= 0.5) return { label: "Medium Confidence", color: "text-yellow-400" };
    return { label: "Low Confidence", color: "text-red-400" };
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <Badge variant="secondary" className="mb-4">Architecture Review</Badge>
        <h1 className="text-3xl font-bold mb-2">AI Solution Architecture Review</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Analyze your problem statement and get architecture recommendations — including when AI is NOT the right solution.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel - Input */}
        <div className="space-y-6">
          {/* Sample Problems */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Load Sample Problem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PROBLEMS.map((sample, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => loadSample(sample)}
                    className="text-xs whitespace-normal break-words h-auto py-2"
                  >
                    {sample.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Problem Statement */}
          <Card>
            <CardHeader>
              <CardTitle>Problem Statement</CardTitle>
              <CardDescription>Describe what you want to build and why</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe the problem you're trying to solve, the expected users, and desired outcomes..."
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
              />
              <Input
                placeholder="Additional notes (optional)"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Constraints */}
          <Card>
            <CardHeader>
              <CardTitle>Constraints</CardTitle>
              <CardDescription>System requirements and limitations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Latency Requirement</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={constraints.latency}
                    onChange={(e) => setConstraints({...constraints, latency: e.target.value})}
                  >
                    <option value="low">Low (&lt;100ms)</option>
                    <option value="medium">Medium (&lt;2s)</option>
                    <option value="high">High (batch OK)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Scale</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={constraints.scale}
                    onChange={(e) => setConstraints({...constraints, scale: e.target.value})}
                  >
                    <option value="small">Small (&lt;1k/day)</option>
                    <option value="medium">Medium (1k-100k/day)</option>
                    <option value="large">Large (&gt;100k/day)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Sensitivity</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={constraints.data_sensitivity}
                    onChange={(e) => setConstraints({...constraints, data_sensitivity: e.target.value})}
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="pii">Contains PII</option>
                    <option value="regulated">Regulated</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cost Sensitivity</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={constraints.cost_sensitivity}
                    onChange={(e) => setConstraints({...constraints, cost_sensitivity: e.target.value})}
                  >
                    <option value="low">Low (optimize for quality)</option>
                    <option value="medium">Medium (balanced)</option>
                    <option value="high">High (minimize cost)</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Data Availability</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dataAvailability}
                    onChange={(e) => setDataAvailability(e.target.value)}
                  >
                    <option value="none">No Data</option>
                    <option value="limited">Limited</option>
                    <option value="sufficient">Sufficient</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Team Maturity</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={teamMaturity}
                    onChange={(e) => setTeamMaturity(e.target.value)}
                  >
                    <option value="low">Low (new to AI)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (experienced)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Strict Mode</label>
                  <p className="text-xs text-muted-foreground">Refuse if information is insufficient</p>
                </div>
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
            </CardContent>
          </Card>

          <Button 
            onClick={performReview} 
            disabled={loading || !problemStatement.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Perform Architecture Review
              </>
            )}
          </Button>

          {error && (
            <Card className="border-red-500/50 bg-red-500/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {!result && !loading && (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center text-muted-foreground">
                <Shield className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Enter a problem statement and constraints to get an architecture recommendation.</p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center">
                <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing requirements and generating recommendation...</p>
              </CardContent>
            </Card>
          )}

          {result && result.decision && (
            <div className="space-y-4">
              {/* Recommendation Header */}
              <Card className={`border-2 ${APPROACH_COLORS[result.decision.recommended_approach] || ""}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      {APPROACH_ICONS[result.decision.recommended_approach]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">
                        {APPROACH_LABELS[result.decision.recommended_approach] || result.decision.recommended_approach}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm ${getConfidenceLabel(result.decision.confidence).color}`}>
                          {getConfidenceLabel(result.decision.confidence).label} ({Math.round(result.decision.confidence * 100)}%)
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Cost: {result.decision.cost_estimate_level}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {result.decision.refusal_reason && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-400 font-medium">Review Notice</p>
                        <p className="text-sm text-muted-foreground">{result.decision.refusal_reason}</p>
                        {result.decision.missing_information && (
                          <ul className="mt-2 space-y-1">
                            {result.decision.missing_information.map((info, i) => (
                              <li key={i} className="text-xs text-muted-foreground">• {info}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">{result.decision.rationale}</p>
                </CardContent>
              </Card>

              {/* System Components */}
              {result.decision.system_components.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection("components")}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">System Components</CardTitle>
                      {expandedSections.has("components") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has("components") && (
                    <CardContent>
                      <div className="space-y-3">
                        {result.decision.system_components.map((comp, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{comp.name}</span>
                              {comp.technology_suggestion && (
                                <Badge variant="secondary" className="text-xs">{comp.technology_suggestion}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{comp.purpose}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Architecture Flow */}
              <Card>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection("flow")}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Architecture Flow</CardTitle>
                    {expandedSections.has("flow") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
                {expandedSections.has("flow") && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.decision.architecture_flow}</p>
                  </CardContent>
                )}
              </Card>

              {/* Tradeoffs */}
              {result.decision.tradeoffs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection("tradeoffs")}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Tradeoffs</CardTitle>
                      {expandedSections.has("tradeoffs") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has("tradeoffs") && (
                    <CardContent>
                      <div className="space-y-4">
                        {result.decision.tradeoffs.map((tradeoff, i) => (
                          <div key={i}>
                            <h4 className="font-medium text-sm mb-2">{tradeoff.aspect}</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-green-400 mb-1">Pros</p>
                                <ul className="space-y-1">
                                  {tradeoff.pros.map((pro, j) => (
                                    <li key={j} className="flex items-start gap-1 text-muted-foreground">
                                      <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                                      {pro}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-red-400 mb-1">Cons</p>
                                <ul className="space-y-1">
                                  {tradeoff.cons.map((con, j) => (
                                    <li key={j} className="flex items-start gap-1 text-muted-foreground">
                                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                                      {con}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Risks */}
              {result.decision.risks.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection("risks")}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Risks</CardTitle>
                      {expandedSections.has("risks") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has("risks") && (
                    <CardContent>
                      <div className="space-y-3">
                        {result.decision.risks.map((risk, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle className={`h-4 w-4 ${
                                risk.severity === "high" ? "text-red-400" :
                                risk.severity === "medium" ? "text-yellow-400" : "text-blue-400"
                              }`} />
                              <span className="font-medium text-sm">{risk.risk}</span>
                              <Badge variant="outline" className="text-xs">{risk.severity}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <strong>Mitigation:</strong> {risk.mitigation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Alternatives Considered */}
              {result.decision.alternatives_considered.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection("alternatives")}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Alternatives Considered</CardTitle>
                      {expandedSections.has("alternatives") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has("alternatives") && (
                    <CardContent>
                      <div className="space-y-3">
                        {result.decision.alternatives_considered.map((alt, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <span className="text-sm font-medium">{alt.approach}</span>
                              <p className="text-xs text-muted-foreground">{alt.reason_rejected}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Human Feedback */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Your Feedback</CardTitle>
                  <CardDescription>Human decision is always final</CardDescription>
                </CardHeader>
                <CardContent>
                  {feedbackSubmitted ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span>Feedback recorded: {feedbackSubmitted}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => submitFeedback("accept")}
                        className="flex-1"
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        Accept
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => submitFeedback("reject")}
                        className="flex-1"
                      >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => submitFeedback("needs_revision")}
                        className="flex-1"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Needs Revision
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
