"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Database, Gauge, Shield, CheckCircle, Search, Zap, ChevronDown, ChevronUp, Wrench, Lightbulb } from "lucide-react";
import Link from "next/link";

interface BuildStep {
  step: number;
  title: string;
  description: string;
  details?: string[];
}

interface ArchitectureFlow {
  title: string;
  description: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  icon: React.ComponentType<{ className?: string }>;
  tech: string[];
  features: string[];
  endpoints: { method: string; path: string; description: string }[];
  demoUrl: string;
  githubUrl: string;
  architectureDiagram: string;
  architectureDescription: string;
  architectureFlows: ArchitectureFlow[];
  howIBuilt: BuildStep[];
}

const projects: Project[] = [
  {
    id: "rag",
    title: "AI Knowledge Retrieval (RAG System)",
    description: "Evidence-based answers with citations and strict refusal.",
    longDescription: "A production-ready RAG system with document chunking, vector embeddings, semantic search, and LLM-generated answers with citations. Includes strict mode for safety when confidence is low.",
    icon: Database,
    tech: ["FastAPI", "ChromaDB", "OpenAI", "Pydantic", "Python 3.11"],
    features: [
      "Document chunking with configurable overlap",
      "Vector embeddings using OpenAI text-embedding-3-small",
      "Top-k retrieval with cosine similarity",
      "Answers with inline citations",
      "Strict mode: returns 'I don't know' on low confidence",
      "Confidence scoring for transparency",
    ],
    endpoints: [
      { method: "POST", path: "/ingest", description: "Ingest documents" },
      { method: "POST", path: "/ask", description: "Ask a question" },
      { method: "GET", path: "/sources", description: "List sources" },
    ],
    demoUrl: "/demo/rag",
    githubUrl: "https://github.com",
    architectureDiagram: `
┌──────────────────────────────────────────────────────────────┐
│                    RAG Knowledge Assistant                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │  Documents  │───▶│  Chunking   │───▶│   Embeddings    │  │
│   │   (JSON)    │    │ (500 chars) │    │ (OpenAI API)    │  │
│   └─────────────┘    └─────────────┘    └────────┬────────┘  │
│                                                   │           │
│                                                   ▼           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │   Answer    │◀───│  Retrieval  │◀───│    ChromaDB     │  │
│   │   + Cite    │    │   (Top-K)   │    │  (Vector Store) │  │
│   └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                                     │
│         ▼                                                     │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  LLM Generation (GPT-4o-mini) + Strict Mode Check   │    │
│   └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘`,
    architectureDescription: "The RAG Knowledge Assistant follows a classic retrieval-augmented generation pattern. Documents are pre-processed through a chunking and embedding pipeline, then stored in a vector database. At query time, relevant chunks are retrieved and passed to an LLM for answer generation with citations.",
    architectureFlows: [
      { title: "Ingestion Flow", description: "Documents → Chunking (500 char segments) → OpenAI Embeddings → ChromaDB storage" },
      { title: "Query Flow", description: "User question → Embedding → Vector similarity search → Top-K retrieval" },
      { title: "Generation Flow", description: "Retrieved chunks + question → LLM prompt → Answer with citations" },
      { title: "Safety Layer", description: "Confidence scoring → Strict mode check → Refusal if below threshold" },
    ],
    howIBuilt: [
      {
        step: 1,
        title: "Document Ingestion Pipeline",
        description: "Built a chunking system that splits documents into overlapping segments for better context preservation.",
        details: [
          "Implemented sentence-aware chunking (500 chars with 50 overlap)",
          "Added metadata extraction (title, source, timestamp)",
          "Created batch processing for efficient embedding generation"
        ]
      },
      {
        step: 2,
        title: "Vector Store Integration",
        description: "Integrated ChromaDB as the vector database with OpenAI embeddings.",
        details: [
          "Configured ChromaDB with cosine similarity",
          "Used text-embedding-3-small for cost-effective embeddings",
          "Implemented collection-per-document-set architecture"
        ]
      },
      {
        step: 3,
        title: "Retrieval-Augmented Generation",
        description: "Built the core RAG pipeline connecting retrieval to generation.",
        details: [
          "Top-K retrieval with configurable K (default: 5)",
          "Context window management to fit LLM limits",
          "Citation injection into generated responses"
        ]
      },
      {
        step: 4,
        title: "Strict Mode & Confidence",
        description: "Added safety controls for production use.",
        details: [
          "Confidence scoring based on retrieval similarity",
          "Strict mode refusal when confidence < threshold",
          "Explicit 'I don't know' responses for safety"
        ]
      }
    ]
  },
  {
    id: "eval",
    title: "LLM Evaluation & Regression Testing",
    description: "Automated quality gates for LLM outputs in CI/CD.",
    longDescription: "A comprehensive testing framework that helps prevent LLM regressions. Includes JSON schema validation, citation detection, consistency testing, and hallucination guards.",
    icon: Gauge,
    tech: ["FastAPI", "Click CLI", "Pydantic", "JSONSchema", "Python 3.11"],
    features: [
      "JSON schema validation for structured outputs",
      "Citation presence detection",
      "Consistency testing (same prompt, multiple runs)",
      "Hallucination guard (groundedness scoring)",
      "CI/CD integration with fail-on-regression",
      "Historical run tracking and comparison",
    ],
    endpoints: [
      { method: "POST", path: "/runs", description: "Start evaluation run" },
      { method: "GET", path: "/runs/latest", description: "Get latest run" },
      { method: "GET", path: "/runs/{id}", description: "Get specific run" },
    ],
    demoUrl: "/demo/eval",
    githubUrl: "https://github.com",
    architectureDiagram: `
┌──────────────────────────────────────────────────────────────┐
│                     LLM Eval Harness                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │ Test Suite  │───▶│  Evaluator  │───▶│    Metrics      │  │
│   │   (JSON)    │    │   Engine    │    │   Computation   │  │
│   └─────────────┘    └─────────────┘    └────────┬────────┘  │
│                            │                      │           │
│                            ▼                      ▼           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │ LLM Client  │◀──▶│   Runner    │───▶│  Run Results    │  │
│   │  (OpenAI)   │    │  (Async)    │    │    (JSON)       │  │
│   └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                               │
│   Evaluators:                                                 │
│   ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐  │
│   │  Schema  │ │ Citation │ │Consistency │ │ Hallucination│  │
│   │  Valid.  │ │ Presence │ │   Check    │ │    Guard     │  │
│   └──────────┘ └──────────┘ └────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────────────┘`,
    architectureDescription: "The LLM Eval Harness is built around a pluggable evaluator pattern. Test suites define test cases, the async runner executes them against an LLM, and multiple evaluators score each response. Results are persisted for historical comparison and regression detection.",
    architectureFlows: [
      { title: "Suite Loading", description: "JSON test suites → Parsed into test cases with expected behaviors" },
      { title: "Execution", description: "Async runner → Parallel LLM calls → Response collection" },
      { title: "Evaluation", description: "Each response → Multiple evaluators → Aggregated scores" },
      { title: "Reporting", description: "Run results → JSON storage → Historical comparison → CI exit codes" },
    ],
    howIBuilt: [
      {
        step: 1,
        title: "Evaluator Framework",
        description: "Designed a pluggable evaluator architecture for extensibility.",
        details: [
          "Abstract base class for all evaluators",
          "Config-driven evaluator selection per test case",
          "Async execution for parallel evaluation"
        ]
      },
      {
        step: 2,
        title: "Core Evaluators",
        description: "Implemented four production-critical evaluators.",
        details: [
          "JSON Schema: Validates LLM output structure",
          "Citation: Checks for source references in response",
          "Consistency: Runs same prompt 3x, measures variance",
          "Hallucination: Compares response to provided context"
        ]
      },
      {
        step: 3,
        title: "Test Runner",
        description: "Built an async runner for efficient test execution.",
        details: [
          "Suite-based organization (JSON config files)",
          "Parallel execution with rate limit awareness",
          "Progress tracking and real-time results"
        ]
      },
      {
        step: 4,
        title: "CI/CD Integration",
        description: "Designed for pipeline integration with fail-fast behavior.",
        details: [
          "Exit codes for pass/fail in CI",
          "GitHub Actions workflow for weekly runs",
          "Historical comparison for regression detection"
        ]
      }
    ]
  },
  {
    id: "gateway",
    title: "Secure AI Gateway",
    description: "PII redaction, prompt injection defense, rate limiting, and cost tracking.",
    longDescription: "A middleware layer that wraps all AI calls with enterprise-grade controls. Handles rate limiting, prompt injection detection, PII redaction, and cost estimation.",
    icon: Shield,
    tech: ["FastAPI", "Token Bucket", "Tiktoken", "HTTPX", "Python 3.11"],
    features: [
      "Token bucket rate limiting (per-IP or global)",
      "Prompt injection detection (system override, jailbreak)",
      "PII redaction (email, phone, SSN, credit card)",
      "Cost estimation with token counting",
      "Structured JSON logging with request_id",
      "Request/response validation",
    ],
    endpoints: [
      { method: "POST", path: "/rag/ask", description: "Proxy to RAG service" },
      { method: "POST", path: "/eval/run", description: "Proxy to Eval service" },
    ],
    demoUrl: "/demo/gateway",
    githubUrl: "https://github.com",
    architectureDiagram: `
┌──────────────────────────────────────────────────────────────┐
│                    Secure AI Gateway                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Request ───▶ ┌─────────────────────────────────────────┐   │
│                │           Middleware Chain               │   │
│                │  ┌───────┐ ┌───────┐ ┌───────┐ ┌──────┐ │   │
│                │  │ Rate  │▶│  PII  │▶│Inject │▶│ Cost │ │   │
│                │  │ Limit │ │Redact │ │Detect │ │ Est. │ │   │
│                │  └───────┘ └───────┘ └───────┘ └──────┘ │   │
│                └───────────────────┬─────────────────────┘   │
│                                    │                          │
│                                    ▼                          │
│                ┌─────────────────────────────────────────┐   │
│                │            Request Router                │   │
│                │  /rag/*  ───▶  RAG Service (8001)       │   │
│                │  /eval/* ───▶  Eval Service (8002)      │   │
│                │  /incident/* ▶ Incident Service (8003)  │   │
│                │  /devops/* ──▶ DevOps Service (8004)    │   │
│                └─────────────────────────────────────────┘   │
│                                    │                          │
│   Response ◀── ┌───────────────────┴─────────────────────┐   │
│                │  + Gateway Metadata (request_id, cost)   │   │
│                └─────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘`,
    architectureDescription: "The Secure AI Gateway acts as a single entry point for all AI service calls. Requests flow through a middleware chain that applies security controls before routing to the appropriate backend service. Responses are enriched with gateway metadata.",
    architectureFlows: [
      { title: "Ingress", description: "All client requests enter through the gateway on port 8000" },
      { title: "Middleware", description: "Rate limit → PII redaction → Injection detection → Cost estimation" },
      { title: "Routing", description: "Path-based routing to RAG, Eval, Incident, or DevOps services" },
      { title: "Egress", description: "Response + gateway metadata (request_id, latency, cost, security status)" },
    ],
    howIBuilt: [
      {
        step: 1,
        title: "Rate Limiter",
        description: "Implemented token bucket algorithm for fair rate limiting.",
        details: [
          "Per-IP bucket tracking with configurable capacity",
          "Token refill rate for burst handling",
          "Configurable token cost per endpoint"
        ]
      },
      {
        step: 2,
        title: "Security Scanner",
        description: "Built multi-layer security scanning for requests.",
        details: [
          "Regex patterns for PII detection (email, phone, SSN)",
          "Prompt injection heuristics (system override, jailbreak)",
          "Configurable block vs. redact behavior"
        ]
      },
      {
        step: 3,
        title: "Cost Estimator",
        description: "Added token counting for cost transparency.",
        details: [
          "Tiktoken for accurate token counting",
          "Model-specific pricing lookup",
          "Cost metadata in every response"
        ]
      },
      {
        step: 4,
        title: "Request Proxying",
        description: "Implemented async proxying to backend services.",
        details: [
          "HTTPX for async HTTP client",
          "Configurable timeouts per service",
          "Structured logging with request correlation"
        ]
      }
    ]
  },
  {
    id: "incident",
    title: "AI Incident Investigation",
    description: "Timeline reconstruction and root-cause analysis with evidence and human feedback.",
    longDescription: "An AI-powered incident investigation system that ingests artifacts (logs, alerts, deploy history), reconstructs timelines, and generates ranked root-cause hypotheses with evidence citations, confidence scoring, and strict refusal when evidence is weak.",
    icon: Search,
    tech: ["FastAPI", "ChromaDB", "OpenAI", "RAG", "Python 3.11"],
    features: [
      "Timeline reconstruction from logs and alerts",
      "Evidence-based hypothesis generation",
      "Strict mode refusal when evidence is insufficient",
      "Counter-evidence surfacing for balanced analysis",
      "What Changed detection (deploys, configs)",
      "Interactive rerun with constraints",
    ],
    endpoints: [
      { method: "POST", path: "/incident/ingest", description: "Ingest case artifacts" },
      { method: "POST", path: "/incident/analyze", description: "Analyze incident" },
      { method: "GET", path: "/incident/cases", description: "List cases" },
      { method: "POST", path: "/incident/cases/{id}/rerun", description: "Rerun analysis" },
    ],
    demoUrl: "/demo/incident",
    githubUrl: "https://github.com",
    architectureDiagram: `
┌──────────────────────────────────────────────────────────────┐
│                  AI Incident Investigator                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │  Artifacts  │───▶│   Parsers   │───▶│    Timeline     │  │
│   │ logs/alerts │    │ (timestamp) │    │ Reconstruction  │  │
│   └─────────────┘    └─────────────┘    └────────┬────────┘  │
│                                                   │           │
│   ┌─────────────┐    ┌─────────────┐             │           │
│   │   Embed &   │───▶│  ChromaDB   │◀────────────┘           │
│   │    Index    │    │ (per case)  │                         │
│   └─────────────┘    └──────┬──────┘                         │
│                             │                                 │
│                             ▼                                 │
│   ┌─────────────────────────────────────────────────────┐    │
│   │              Analysis Engine (LLM)                   │    │
│   │  • Evidence retrieval (RAG)                         │    │
│   │  • Hypothesis generation with citations             │    │
│   │  • Counter-evidence surfacing                       │    │
│   │  • Strict mode confidence check                     │    │
│   └─────────────────────────────────────────────────────┘    │
│                             │                                 │
│                             ▼                                 │
│   ┌───────────┐  ┌───────────────┐  ┌───────────────────┐    │
│   │ Hypotheses│  │ What Changed  │  │  Next Steps       │    │
│   │ (ranked)  │  │ (deploys etc) │  │  Recommendations  │    │
│   └───────────┘  └───────────────┘  └───────────────────┘    │
└──────────────────────────────────────────────────────────────┘`,
    architectureDescription: "The AI Incident Investigator combines artifact parsing, vector-based evidence retrieval, and LLM-powered analysis. Artifacts are ingested, parsed for events, and indexed per-case. The analysis engine uses RAG to ground hypotheses in evidence, with strict mode to prevent speculation.",
    architectureFlows: [
      { title: "Ingestion", description: "Logs, alerts, deploy history → Parsed for timestamps/events → Indexed in case-scoped ChromaDB" },
      { title: "Timeline", description: "Extracted events → Sorted chronologically → Severity-tagged timeline" },
      { title: "Analysis", description: "Query embedding → Evidence retrieval → LLM hypothesis generation with citations" },
      { title: "Output", description: "Ranked hypotheses + counter-evidence + what changed + recommended next steps" },
    ],
    howIBuilt: [
      {
        step: 1,
        title: "Artifact Parsers",
        description: "Built parsers to extract structured events from unstructured data.",
        details: [
          "Regex patterns for 10+ timestamp formats",
          "Error pattern extraction (exception, timeout, 5xx)",
          "Deploy event detection (version, rollback)",
          "Severity classification heuristics"
        ]
      },
      {
        step: 2,
        title: "Case Management",
        description: "Implemented case-based storage with per-case vector indexing.",
        details: [
          "JSON file storage for case persistence",
          "Separate ChromaDB collection per case",
          "Analysis history tracking"
        ]
      },
      {
        step: 3,
        title: "Evidence-Based LLM",
        description: "Designed prompts that enforce evidence citation.",
        details: [
          "System rubric requiring ≥2 evidence per hypothesis",
          "Counter-evidence requirement for balance",
          "JSON schema enforcement in prompt",
          "Low temperature (0.3) for determinism"
        ]
      },
      {
        step: 4,
        title: "Strict Mode Logic",
        description: "Added safety controls to prevent hallucination.",
        details: [
          "Confidence threshold (0.6) for refusal",
          "Evidence count check (minimum 2)",
          "Explicit refusal response with guidance"
        ]
      }
    ]
  },
  {
    id: "devops",
    title: "AI-Assisted DevOps Risk Analysis",
    description: "Pre-deployment risk scoring, rollout recommendations, and change impact analysis.",
    longDescription: "An intelligent DevOps system that evaluates deployment risk before changes reach production. Analyzes CI/CD pipelines, deploy events, and historical incidents to provide risk scores, evidence-based explanations, and rollout recommendations.",
    icon: Zap,
    tech: ["FastAPI", "ChromaDB", "OpenAI", "RAG", "Python 3.11"],
    features: [
      "Risk scoring based on historical patterns",
      "Similar incident detection and citation",
      "Rollout recommendations (canary, feature flag, etc.)",
      "Blast radius analysis",
      "Change velocity tracking",
      "Strict mode for insufficient data",
    ],
    endpoints: [
      { method: "POST", path: "/devops/changes/ingest", description: "Ingest a change" },
      { method: "POST", path: "/devops/changes/analyze", description: "Analyze risk" },
      { method: "GET", path: "/devops/changes", description: "List changes" },
      { method: "GET", path: "/devops/changes/{id}", description: "Get change details" },
    ],
    demoUrl: "/demo/devops",
    githubUrl: "https://github.com",
    architectureDiagram: `
┌──────────────────────────────────────────────────────────────┐
│                  AI DevOps Control Plane                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │   Change    │───▶│    Index    │───▶│    ChromaDB     │  │
│   │   Ingest    │    │ (embedding) │    │  (history)      │  │
│   └─────────────┘    └─────────────┘    └────────┬────────┘  │
│                                                   │           │
│   ┌─────────────────────────────────────────────┐│           │
│   │              Risk Analyzer                   ││           │
│   │  ┌──────────────────────────────────────┐   ││           │
│   │  │ 1. Search similar past changes       │◀──┘│           │
│   │  │ 2. Fetch similar incidents           │◀───┼───┐       │
│   │  │ 3. Calculate change velocity         │    │   │       │
│   │  │ 4. Generate risk assessment (LLM)    │    │   │       │
│   │  └──────────────────────────────────────┘   ││   │       │
│   └─────────────────────────────────────────────┘│   │       │
│                                                   │   │       │
│   ┌─────────────────────────────────────────────┐│   │       │
│   │              Incident Service               ││   │       │
│   │         (Similar past incidents)            │◀───┘       │
│   └─────────────────────────────────────────────┘│           │
│                                                   │           │
│                             ┌─────────────────────┘           │
│                             ▼                                 │
│   ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│   │  Risk Score   │  │   Rollout    │  │  Contributing   │   │
│   │  (0-100%)     │  │  Recommend.  │  │    Factors      │   │
│   └───────────────┘  └──────────────┘  └─────────────────┘   │
└──────────────────────────────────────────────────────────────┘`,
    architectureDescription: "The AI DevOps Control Plane evaluates deployment risk by combining historical change patterns with incident data. Changes are indexed for similarity search, then the risk analyzer fetches similar past changes and incidents to inform LLM-based risk scoring.",
    architectureFlows: [
      { title: "Ingestion", description: "Deploy/config changes → Embedded diff summary → Stored in ChromaDB for history" },
      { title: "Similarity", description: "New change → Vector search → Find similar past changes in same service" },
      { title: "Cross-Service", description: "Query Incident Investigator → Find incidents with similar symptoms" },
      { title: "Assessment", description: "Evidence + velocity + context → LLM risk scoring → Rollout recommendation" },
    ],
    howIBuilt: [
      {
        step: 1,
        title: "Change Ingestion",
        description: "Built a system to capture and index deployment changes.",
        details: [
          "Support for deploy, config, infra, feature flag types",
          "Metadata capture (commit, author, env, labels)",
          "Diff summary embedding for similarity search"
        ]
      },
      {
        step: 2,
        title: "Historical Comparison",
        description: "Implemented vector similarity for finding past changes.",
        details: [
          "ChromaDB indexing of all changes",
          "Service-scoped similarity search",
          "Evidence extraction from similar changes"
        ]
      },
      {
        step: 3,
        title: "Incident Integration",
        description: "Connected to Incident Investigator for historical context.",
        details: [
          "HTTP client to incident service",
          "Keyword-based incident matching",
          "Root cause citation in risk factors"
        ]
      },
      {
        step: 4,
        title: "Risk Assessment LLM",
        description: "Designed prompts for conservative risk scoring.",
        details: [
          "Strict JSON schema for output",
          "Evidence requirement for every claim",
          "Explicit unknowns listing",
          "Rollout recommendation logic"
        ]
      }
    ]
  },
  {
    id: "architecture",
    title: "AI Solution Architecture Review",
    description: "Architecture recommendations with tradeoffs — including when AI should NOT be used.",
    longDescription: "A decision support system that analyzes problem statements and constraints to recommend appropriate AI architectures. Explicitly recommends non-AI solutions when appropriate and refuses when information is insufficient.",
    icon: Lightbulb,
    tech: ["FastAPI", "ChromaDB", "OpenAI", "Pydantic", "Python 3.11"],
    features: [
      "RAG vs fine-tuning vs rules recommendations",
      "Constraint-aware analysis (latency, scale, compliance)",
      "Strict refusal when information is insufficient",
      "Tradeoff and risk analysis",
      "Alternative approaches evaluation",
      "Human feedback integration",
    ],
    endpoints: [
      { method: "POST", path: "/architecture/review", description: "Perform architecture review" },
      { method: "GET", path: "/architecture/reviews", description: "List past reviews" },
      { method: "GET", path: "/architecture/reviews/{id}", description: "Get review details" },
      { method: "POST", path: "/architecture/reviews/{id}/feedback", description: "Submit feedback" },
    ],
    demoUrl: "/demo/architecture",
    githubUrl: "https://github.com",
    architectureDiagram: `
┌─────────────────────────────────────────────────────────────────┐
│                 AI Solution Architecture Review                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐     ┌──────────────────────────────────┐  │
│   │ Problem Statement│────▶│       Feasibility Check          │  │
│   │ + Constraints   │     │  • Problem quality validation    │  │
│   └─────────────────┘     │  • Constraint conflict detection │  │
│                           └───────────────┬──────────────────┘  │
│                                     Pass? │ Fail → REFUSE       │
│                                           ▼                      │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                Pattern Matching (RAG)                      │ │
│   │  • Search similar architecture patterns                   │ │
│   │  • Retrieve past decisions                                │ │
│   └────────────────────────────┬──────────────────────────────┘ │
│                                ▼                                 │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │              Decision Generation (LLM)                     │ │
│   │  • Recommend: rag | fine_tuning | rules | hybrid | no_ai │ │
│   │  • Explain rationale + tradeoffs + risks                  │ │
│   └────────────────────────────┬──────────────────────────────┘ │
│                                ▼                                 │
│   ┌─────────────────┐    ┌───────────────┐   ┌───────────────┐ │
│   │  Architecture   │    │   Tradeoffs   │   │    Human      │ │
│   │   Decision      │    │   & Risks     │   │   Feedback    │ │
│   └─────────────────┘    └───────────────┘   └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘`,
    architectureDescription: "The AI Solution Architecture Review first validates input feasibility, then uses RAG to find similar architecture patterns. The LLM generates a structured decision with rationale, tradeoffs, risks, and alternatives. Human feedback is collected for all decisions.",
    architectureFlows: [
      { title: "Input", description: "Problem statement + constraints → Feasibility validation" },
      { title: "Pattern Matching", description: "RAG search → Similar architecture patterns retrieved" },
      { title: "Decision", description: "LLM analysis → Recommend approach with rationale" },
      { title: "Feedback", description: "Human review → Accept, reject, or request revision" },
    ],
    howIBuilt: [
      {
        step: 1,
        title: "Feasibility Checker",
        description: "Built validation logic to catch insufficient or conflicting inputs.",
        details: [
          "Problem statement quality validation",
          "Constraint conflict detection",
          "Data availability checks",
          "Vague language detection"
        ]
      },
      {
        step: 2,
        title: "Pattern Database",
        description: "Created a seeded vector store of architecture patterns.",
        details: [
          "10+ architecture patterns covering RAG, fine-tuning, rules, hybrid, no-AI",
          "ChromaDB for similarity search",
          "Pattern-to-recommendation mapping"
        ]
      },
      {
        step: 3,
        title: "Decision Generator",
        description: "Designed LLM prompts for conservative architecture recommendations.",
        details: [
          "Strict JSON schema enforcement",
          "Required alternatives consideration",
          "Explicit 'no AI' path",
          "Low temperature (0.3) for consistency"
        ]
      },
      {
        step: 4,
        title: "Human Feedback Loop",
        description: "Added feedback mechanisms to keep humans in control.",
        details: [
          "Accept/reject/revision options",
          "Feedback persistence and tracking",
          "Confidence scoring for transparency"
        ]
      }
    ]
  },
];

function ProjectCard({ project }: { project: Project }) {
  const [showHowIBuilt, setShowHowIBuilt] = useState(false);

  return (
    <Card id={project.id} className="overflow-hidden">
      <CardHeader className="bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <project.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{project.title}</CardTitle>
              <CardDescription className="mt-1">
                {project.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href={project.demoUrl}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Demo
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                Code
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h4 className="font-semibold mb-3">Overview</h4>
            <p className="text-muted-foreground mb-6">
              {project.longDescription}
            </p>
            
            <h4 className="font-semibold mb-3">Tech Stack</h4>
            <div className="flex flex-wrap gap-2 mb-6">
              {project.tech.map((tech) => (
                <Badge key={tech} variant="secondary">
                  {tech}
                </Badge>
              ))}
            </div>
            
            <h4 className="font-semibold mb-3">API Endpoints</h4>
            <div className="space-y-2">
              {project.endpoints.map((endpoint, i) => (
                <div key={i} className="flex items-center space-x-3 text-sm">
                  <Badge variant="outline" className="font-mono">
                    {endpoint.method}
                  </Badge>
                  <code className="text-muted-foreground">{endpoint.path}</code>
                  <span className="text-muted-foreground">— {endpoint.description}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Key Features</h4>
            <ul className="space-y-2">
              {project.features.map((feature, i) => (
                <li key={i} className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* How I Built Section */}
        <div className="mt-8 border-t pt-6">
          <button
            onClick={() => setShowHowIBuilt(!showHowIBuilt)}
            className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors w-full text-left"
          >
            <Wrench className="h-5 w-5" />
            How I Built This
            {showHowIBuilt ? (
              <ChevronUp className="h-5 w-5 ml-auto" />
            ) : (
              <ChevronDown className="h-5 w-5 ml-auto" />
            )}
          </button>

          {showHowIBuilt && (
            <div className="mt-6 space-y-8">
              {/* Architecture Section - Diagram + Description */}
              <div>
                <h5 className="font-medium mb-3 text-sm uppercase tracking-wide text-muted-foreground">Architecture</h5>
                <div className="grid gap-6 lg:grid-cols-5">
                  {/* Diagram - Left Side (3 cols) */}
                  <div className="lg:col-span-3 bg-slate-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {project.architectureDiagram}
                    </pre>
                  </div>
                  
                  {/* Description - Right Side (2 cols) */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h6 className="font-semibold mb-2">How It Works</h6>
                      <p className="text-sm text-muted-foreground">
                        {project.architectureDescription}
                      </p>
                    </div>
                    
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h6 className="font-semibold mb-3">Data Flows</h6>
                      <div className="space-y-3">
                        {project.architectureFlows.map((flow, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{flow.title}</p>
                              <p className="text-xs text-muted-foreground">{flow.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Implementation Steps */}
              <div>
                <h5 className="font-medium mb-4 text-sm uppercase tracking-wide text-muted-foreground">Implementation Steps</h5>
                <div className="grid gap-4 md:grid-cols-2">
                  {project.howIBuilt.map((step) => (
                    <div key={step.step} className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {step.step}
                        </div>
                        <h6 className="font-semibold">{step.title}</h6>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {step.description}
                      </p>
                      {step.details && (
                        <ul className="space-y-1">
                          {step.details.map((detail, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
        <p className="mt-4 text-muted-foreground text-lg">
          Production-grade AI systems demonstrating real engineering patterns
        </p>
      </div>

      <div className="space-y-16">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
