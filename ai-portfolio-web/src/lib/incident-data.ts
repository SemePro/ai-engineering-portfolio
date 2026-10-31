/**
 * Eval results for the incident agent, published from incident-agent/eval-results
 * by `python -m incident_agent.evals.publish`. This module only reads; it never
 * computes or fills in numbers. Missing runs render as "Not measured".
 */
import raw from "@/data/incident-agent/evals.json";

export type Rate = { value: number; numerator: number; n: number } | null;

export interface Metrics {
  n_cases: number;
  root_cause_accuracy: Rate;
  base_pass_rate: Rate;
  action_appropriateness: Rate;
  false_abstention_rate: Rate;
  abstention_accuracy: Rate;
  hallucination_rate_when_evidence_removed: Rate;
  fault_pass_rate: Rate;
  fault_outcomes: Record<string, number> | null;
  unsafe_proposals: number;
  fault_behaviour?: { tool_errors_seen: number; transport_retries: number; mean_tool_calls: number | null; completed_with_findings: number } | null;
  abstain_mean_confidence_when_claiming_cause?: number | null;
  injection_resisted: boolean | null;
  evidence_coverage_mean: number | null;
  tool_calls: {
    mean: number | null;
    median: number | null;
    mean_excess_over_minimum: number | null;
    redundant_total: number;
    ledger_updates_mean: number | null;
  };
  confidence: { mean_when_correct: number | null; mean_when_wrong: number | null };
  cost: {
    total_usd: number;
    mean_per_investigation_usd: number | null;
    p50_per_investigation_usd: number | null;
    p90_per_investigation_usd: number | null;
    tokens: Record<string, number>;
    cache_read_share_of_input: number | null;
  };
  latency: {
    p50_total_ms: number | null;
    p90_total_ms: number | null;
    p95_total_ms?: number | null;
    mean_total_ms?: number | null;
    p50_model_ms_per_call: number | null;
    p50_time_to_recommendation_ms: number | null;
    mean_tool_ms: number | null;
  };
}

export interface RunSummary {
  run_id: string;
  suite: string;
  client: string;
  model: string;
  effort: string | null;
  caching: boolean;
  git_sha: string;
  price_table_version: string;
  via_gateway: boolean | null;
  started_at: string;
  finished_at: string;
  wall_seconds: number;
  audit_chain_valid: boolean;
  actions_executed_without_approval: number;
  metrics: Metrics;
}

export interface CaseRow {
  case_id: string;
  scenario_id: string;
  kind: "base" | "abstain" | "fault" | "runtime_fault";
  variant: string;
  status: string;
  predicted_category: string | null;
  predicted_service: string | null;
  confidence: number | null;
  root_cause_correct: boolean;
  abstained: boolean;
  action_type: string | null;
  action_appropriate: boolean;
  unsafe_proposals: number;
  fault_behaviour?: { tool_errors_seen: number; transport_retries: number; mean_tool_calls: number | null; completed_with_findings: number } | null;
  abstain_mean_confidence_when_claiming_cause?: number | null;
  tool_calls: number;
  excess_tool_calls: number;
  redundant_tool_calls: number;
  tool_errors: number;
  tool_retries: number;
  cost_usd: number;
  total_latency_ms: number;
  fault_outcome?: string;
  expected_outcome?: string;
  pass: boolean;
}

export interface CachingSide {
  run_id: string;
  n_cases: number;
  root_cause_accuracy: Rate;
  mean_cost_usd: number | null;
  total_cost_usd: number;
  tokens: Record<string, number>;
  cache_read_share_of_input: number | null;
  p50_total_ms: number | null;
  p50_model_ms_per_call: number | null;
}

export interface Caching {
  off: CachingSide;
  on: CachingSide;
  delta: Record<string, number | null>;
  note: string;
}

export interface DatasetEntry {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  tags: string[];
  alert: { id: string; name: string; service: string; severity: string; fired_at: string; description: string };
  services: string[];
  has_abstain_variant: boolean;
  fault_variants: string[];
  root_cause: string;
  accepted_categories: string[];
  distractors: string[];
  min_tool_calls: number;
}

export interface EvalData {
  published_at: string;
  claude: RunSummary | null;
  baseline: RunSummary | null;
  caching: Caching | null;
  cases: { claude: CaseRow[]; baseline: CaseRow[] };
  dataset: DatasetEntry[];
}

export const EVALS = raw as unknown as EvalData;

export const NOT_MEASURED = "Not measured";

export function pct(r: Rate | number | null | undefined, digits = 0): string {
  if (r === null || r === undefined) return NOT_MEASURED;
  const v = typeof r === "number" ? r : r.value;
  return `${(v * 100).toFixed(digits)}%`;
}

export function frac(r: Rate): string {
  return r ? `${r.numerator}/${r.n}` : "";
}

export function usd(v: number | null | undefined, digits = 3): string {
  return v === null || v === undefined ? NOT_MEASURED : `$${v.toFixed(digits)}`;
}

export function seconds(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? NOT_MEASURED : `${(ms / 1000).toFixed(1)}s`;
}

export function num(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? NOT_MEASURED : v.toFixed(digits);
}

export function signedPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return NOT_MEASURED;
  const s = (v * 100).toFixed(0);
  return `${v > 0 ? "+" : ""}${s}%`;
}

export const DATASET_STATS = {
  scenarios: EVALS.dataset.length,
  abstainVariants: EVALS.dataset.filter((d) => d.has_abstain_variant).length,
  faultVariants: EVALS.dataset.reduce((n, d) => n + d.fault_variants.length, 0),
};
