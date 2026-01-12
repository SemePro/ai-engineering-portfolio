"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2, Clock, Gauge, Play } from "lucide-react";

interface TestResult {
  test_case_id: string;
  test_case_name: string;
  passed: boolean;
  response: string;
  latency_ms: number;
  metrics: Array<{
    metric: string;
    passed: boolean;
    score: number;
    details: string;
  }>;
  error?: string;
}

interface EvalRun {
  id: string;
  suite_name: string;
  model: string;
  completed_at: string;
  duration_seconds: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  pass_rate: number;
  regression_detected: boolean;
  test_results: TestResult[];
}

export default function EvalDemoPage() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  async function runEvaluation() {
    setIsRunning(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_EVAL_URL || "http://localhost:8002"}/runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suite_path: "./suites/basic.json" }),
        }
      );
      
      if (!response.ok) throw new Error("Failed to run evaluation");
      
      const result = await response.json();
      setSelectedRun(result);
      
      // Refresh the runs list
      await fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsRunning(false);
    }
  }

  async function fetchRuns() {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_EVAL_URL || "http://localhost:8002"}/runs`
      );
      
      if (!response.ok) throw new Error("Failed to fetch runs");
      
      const data = await response.json();
      setRuns(data.runs || []);
      
      // Fetch details for the latest run
      if (data.runs && data.runs.length > 0) {
        const latestResponse = await fetch(
          `${process.env.NEXT_PUBLIC_EVAL_URL || "http://localhost:8002"}/runs/latest`
        );
        if (latestResponse.ok) {
          const latestRun = await latestResponse.json();
          setSelectedRun(latestRun);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  async function selectRun(runId: string) {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_EVAL_URL || "http://localhost:8002"}/runs/${runId}`
      );
      
      if (!response.ok) throw new Error("Failed to fetch run details");
      
      const data = await response.json();
      setSelectedRun(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">LLM Eval Dashboard</h1>
            <p className="text-muted-foreground">
              View evaluation runs and test results. Track regressions over time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runEvaluation} disabled={isRunning || isLoading}>
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isRunning ? "Running..." : "Run Evaluation"}
            </Button>
            <Button variant="outline" onClick={fetchRuns} disabled={isLoading || isRunning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure the eval service is running on port 8002.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Runs List */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evaluation Runs</CardTitle>
                <CardDescription>Select a run to view details</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && runs.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No evaluation runs found. Run an evaluation suite to see results.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => selectRun(run.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedRun?.id === run.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">
                            {run.suite_name}
                          </span>
                          {run.regression_detected ? (
                            <Badge variant="destructive" className="text-xs">
                              Regression
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-xs">
                              Pass
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(run.pass_rate * 100).toFixed(0)}% pass rate • {run.total_tests} tests
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Run Details */}
          <div className="lg:col-span-2">
            {selectedRun ? (
              <div className="space-y-6">
                {/* Summary */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedRun.suite_name}</CardTitle>
                        <CardDescription>
                          Run ID: {selectedRun.id}
                        </CardDescription>
                      </div>
                      {selectedRun.regression_detected ? (
                        <Badge variant="destructive" className="h-8 px-3">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Regression Detected
                        </Badge>
                      ) : (
                        <Badge variant="success" className="h-8 px-3">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          All Checks Passed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold">
                          {(selectedRun.pass_rate * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Pass Rate</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-green-500">
                          {selectedRun.passed_tests}
                        </div>
                        <div className="text-xs text-muted-foreground">Passed</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-red-500">
                          {selectedRun.failed_tests}
                        </div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold">
                          {selectedRun.duration_seconds.toFixed(1)}s
                        </div>
                        <div className="text-xs text-muted-foreground">Duration</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      Model: <span className="font-medium">{selectedRun.model}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Test Results */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedRun.test_results.map((result) => (
                        <div
                          key={result.test_case_id}
                          className="p-4 rounded-lg border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="font-medium">{result.test_case_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {result.latency_ms.toFixed(0)}ms
                            </div>
                          </div>
                          
                          {result.metrics.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {result.metrics.map((metric, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    {metric.passed ? (
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-red-500" />
                                    )}
                                    <span className="text-muted-foreground">
                                      {metric.metric.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={metric.passed ? "success" : "destructive"} className="text-xs">
                                      {(metric.score * 100).toFixed(0)}%
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {result.error && (
                            <div className="mt-2 text-sm text-destructive">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Gauge className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Select a run to view details
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
