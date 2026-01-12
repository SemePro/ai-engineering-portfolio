/**
 * API client for backend services.
 * 
 * All requests should go through the secure gateway in production.
 * Direct service URLs are only for local development fallback.
 */

// Service URLs - configured via environment variables
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';
const RAG_URL = process.env.NEXT_PUBLIC_RAG_URL || 'http://localhost:8001';
const EVAL_URL = process.env.NEXT_PUBLIC_EVAL_URL || 'http://localhost:8002';

// Request timeout (ms)
const REQUEST_TIMEOUT = 30000;

/**
 * Custom error class for API errors with additional context.
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }

  /**
   * Check if error is a network/connectivity issue.
   */
  isNetworkError(): boolean {
    return this.statusCode === 0;
  }

  /**
   * Check if error is a rate limit.
   */
  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if error is a security block.
   */
  isSecurityBlocked(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Get user-friendly error message.
   */
  getUserMessage(): string {
    if (this.isNetworkError()) {
      return 'Unable to connect to the server. Please check your connection.';
    }
    if (this.isRateLimited()) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (this.isSecurityBlocked()) {
      return 'Request blocked for security reasons.';
    }
    if (this.statusCode >= 500) {
      return 'Server error. Please try again later.';
    }
    return this.message;
  }
}

/**
 * Make an API request with proper error handling and timeout.
 */
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail: unknown;
      try {
        errorDetail = await response.json();
      } catch {
        errorDetail = await response.text().catch(() => 'Unknown error');
      }

      const message = typeof errorDetail === 'object' && errorDetail !== null
        ? (errorDetail as { detail?: string; message?: string }).detail || 
          (errorDetail as { detail?: string; message?: string }).message || 
          'Request failed'
        : String(errorDetail);

      throw new APIError(message, response.status, url, errorDetail);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new APIError('Request timed out', 0, url);
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIError('Network error - unable to reach server', 0, url);
    }

    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error',
      0,
      url
    );
  }
}

// ============== Response Types ==============

export interface Citation {
  source: string;
  chunk_id: string;
  relevance_score: number;
  excerpt: string;
}

export interface GatewayMetadata {
  request_id: string;
  latency_ms: number;
  cost?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
  security?: {
    status: string;
    pii_detected: string[];
    injection_detected: string[];
  };
  rate_limit_remaining: number;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
  confidence_score: number;
  strict_mode_triggered: boolean;
  gateway?: GatewayMetadata;
}

export interface TestMetric {
  metric: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface TestResult {
  test_case_id: string;
  test_case_name: string;
  passed: boolean;
  response: string;
  latency_ms: number;
  metrics: TestMetric[];
}

export interface EvalRun {
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

// ============== API Functions ==============

/**
 * Ask a question to the RAG Knowledge Assistant.
 * 
 * @param question - The question to ask
 * @param strictMode - If true, refuses to answer when confidence is low
 * @param useGateway - If true, routes through the secure gateway
 * @returns RAG response with answer, citations, and metadata
 */
export async function askRAG(
  question: string,
  strictMode: boolean = true,
  useGateway: boolean = true
): Promise<RAGResponse> {
  const url = useGateway ? `${GATEWAY_URL}/rag/ask` : `${RAG_URL}/ask`;
  
  return apiRequest<RAGResponse>(url, {
    method: 'POST',
    body: JSON.stringify({
      question,
      strict_mode: strictMode,
    }),
  });
}

/**
 * Get all evaluation runs.
 */
export async function getEvalRuns(): Promise<{ runs: EvalRun[] }> {
  return apiRequest<{ runs: EvalRun[] }>(`${EVAL_URL}/runs`);
}

/**
 * Get the most recent evaluation run.
 */
export async function getLatestEvalRun(): Promise<EvalRun> {
  return apiRequest<EvalRun>(`${EVAL_URL}/runs/latest`);
}

/**
 * Get a specific evaluation run by ID.
 */
export async function getEvalRun(id: string): Promise<EvalRun> {
  return apiRequest<EvalRun>(`${EVAL_URL}/runs/${encodeURIComponent(id)}`);
}
