# AI Incident Investigator - Technical Documentation

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Data Models](#data-models)
5. [API Reference](#api-reference)
6. [Analysis Pipeline](#analysis-pipeline)
7. [Parser Implementation](#parser-implementation)
8. [Vector Store & Retrieval](#vector-store--retrieval)
9. [LLM Integration](#llm-integration)
10. [Security & Gateway Integration](#security--gateway-integration)
11. [Frontend Implementation](#frontend-implementation)
12. [Configuration](#configuration)
13. [Testing Strategy](#testing-strategy)
14. [Deployment](#deployment)
15. [Failure Modes & Mitigations](#failure-modes--mitigations)

---

## Executive Summary

The AI Incident Investigator is an interactive incident investigation system designed to assist Site Reliability Engineers (SREs) and DevOps teams during incident response. The system:

- **Ingests** incident artifacts (logs, alerts, deploy history, runbooks, metrics)
- **Reconstructs** an incident timeline by parsing and ordering events
- **Generates** ranked root-cause hypotheses using RAG (Retrieval-Augmented Generation)
- **Cites** concrete evidence from artifacts for every claim
- **Refuses** to speculate when evidence is insufficient (strict mode)

### Key Differentiators

| Feature | Description |
|---------|-------------|
| Evidence-Based | Every hypothesis must cite ≥2 evidence excerpts |
| Strict Mode | Refuses speculation when retrieval confidence < threshold |
| Counter-Evidence | Surfaces contradicting evidence for balanced analysis |
| Timeline Reconstruction | Automatic event extraction and chronological ordering |
| What Changed Analysis | Detects deployments, config changes around incident time |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────┐      │
│    │                    Next.js Portfolio Web                         │      │
│    │                     (Port 3000)                                  │      │
│    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │      │
│    │  │ Case List   │  │  Timeline   │  │  Hypothesis Explorer    │  │      │
│    │  │ & Selector  │  │    View     │  │  (Evidence, Tests, etc) │  │      │
│    │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │      │
│    └─────────────────────────────────────────────────────────────────┘      │
│                                    │                                         │
└────────────────────────────────────│─────────────────────────────────────────┘
                                     │ HTTP/REST
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GATEWAY LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────┐      │
│    │                   Secure AI Gateway                              │      │
│    │                     (Port 8000)                                  │      │
│    │                                                                  │      │
│    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │      │
│    │  │ Rate Limiter │ │ PII Redactor │ │ Injection Detector       │ │      │
│    │  │ (Token       │ │ (Email,      │ │ (System Override,        │ │      │
│    │  │  Bucket)     │ │  Phone, SSN) │ │  Jailbreak, Exfil)       │ │      │
│    │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │      │
│    │                                                                  │      │
│    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │      │
│    │  │ Structured   │ │ Cost         │ │ Request Validation       │ │      │
│    │  │ Logging      │ │ Estimation   │ │ (Pydantic Schemas)       │ │      │
│    │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │      │
│    └─────────────────────────────────────────────────────────────────┘      │
│                                    │                                         │
└────────────────────────────────────│─────────────────────────────────────────┘
                                     │ HTTP/REST (Internal)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────┐      │
│    │               AI Incident Investigator Service                   │      │
│    │                        (Port 8003)                               │      │
│    │                                                                  │      │
│    │  ┌─────────────────────────────────────────────────────────┐    │      │
│    │  │                    FastAPI Application                   │    │      │
│    │  │                                                          │    │      │
│    │  │  Endpoints:                                              │    │      │
│    │  │  • POST /ingest     - Ingest case with artifacts         │    │      │
│    │  │  • POST /analyze    - Generate hypotheses                │    │      │
│    │  │  • GET  /cases      - List all cases                     │    │      │
│    │  │  • GET  /cases/{id} - Get case details                   │    │      │
│    │  │  • POST /cases/{id}/rerun - Rerun with constraints       │    │      │
│    │  └─────────────────────────────────────────────────────────┘    │      │
│    │                              │                                   │      │
│    │         ┌────────────────────┼────────────────────┐             │      │
│    │         ▼                    ▼                    ▼             │      │
│    │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐     │      │
│    │  │   Parsers   │    │ Case Store  │    │  Vector Store   │     │      │
│    │  │ (Timeline   │    │ (JSON/Disk) │    │  (ChromaDB)     │     │      │
│    │  │  Extraction)│    │             │    │                 │     │      │
│    │  └─────────────┘    └─────────────┘    └─────────────────┘     │      │
│    │         │                                       │               │      │
│    │         └───────────────────┬───────────────────┘               │      │
│    │                             ▼                                   │      │
│    │                  ┌─────────────────────┐                        │      │
│    │                  │   Analysis Engine   │                        │      │
│    │                  │                     │                        │      │
│    │                  │  • Evidence RAG     │                        │      │
│    │                  │  • LLM Hypothesis   │                        │      │
│    │                  │  • Strict Mode      │                        │      │
│    │                  └─────────────────────┘                        │      │
│    │                             │                                   │      │
│    └─────────────────────────────│───────────────────────────────────┘      │
│                                  │                                           │
└──────────────────────────────────│───────────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────┐      │
│    │                      OpenAI API                                  │      │
│    │                                                                  │      │
│    │  • text-embedding-3-small  (Embeddings for RAG)                 │      │
│    │  • gpt-4o-mini            (Hypothesis Generation)               │      │
│    │                                                                  │      │
│    └─────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interactions

```
┌──────────────┐    1. Ingest Request    ┌──────────────┐
│    Client    │ ──────────────────────▶ │   Gateway    │
└──────────────┘                         └──────┬───────┘
                                                │
                                    2. PII Redaction
                                    3. Injection Check
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │  Incident    │
                                         │  Service     │
                                         └──────┬───────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
            ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
            │ Case Store   │           │   Parsers    │           │ Vector Store │
            │              │           │              │           │              │
            │ 4. Save case │           │ 5. Extract   │           │ 6. Chunk &   │
            │    metadata  │           │    events    │           │    embed     │
            └──────────────┘           └──────────────┘           └──────────────┘
```

---

## Core Components

### 1. FastAPI Application (`src/main.py`)

The main entry point that:
- Initializes all components on startup
- Defines REST API endpoints
- Handles request/response lifecycle
- Manages CORS and middleware

```python
# Lifespan management
@asynccontextmanager
async def lifespan(app: FastAPI):
    global case_store, vector_store, analyzer
    case_store = CaseStore()
    vector_store = IncidentVectorStore()
    analyzer = IncidentAnalyzer(vector_store)
    yield
```

### 2. Case Store (`src/case_store.py`)

Manages persistence of incident cases using JSON files:

| Method | Description |
|--------|-------------|
| `create_case(request)` | Creates new case, returns UUID |
| `update_status(case_id, status)` | Updates case status |
| `save_analysis(case_id, analysis)` | Saves analysis results |
| `get_case(case_id)` | Retrieves full case details |
| `list_cases()` | Lists all case summaries |
| `get_artifacts(case_id)` | Gets artifacts for a case |

**Storage Format:**
```json
{
  "case_id": "uuid",
  "title": "string",
  "incident_summary": "string",
  "status": "created|ingested|analyzed",
  "created_at": "ISO8601",
  "artifacts": [...],
  "last_analysis": {...},
  "analysis_history": [...]
}
```

### 3. Vector Store (`src/vector_store.py`)

Manages artifact embeddings using ChromaDB:

| Method | Description |
|--------|-------------|
| `index_artifacts(case_id, artifacts)` | Chunks and embeds artifacts |
| `search(case_id, query, top_k)` | Retrieves relevant evidence |
| `get_chunk_count(case_id)` | Returns indexed chunk count |
| `delete_case(case_id)` | Removes case embeddings |

**Chunking Strategy:**
- Default chunk size: 500 characters
- Overlap: 50 characters
- Break at sentence boundaries when possible

### 4. Parsers (`src/parsers.py`)

Extracts structured events from unstructured artifacts:

| Parser | Input | Output |
|--------|-------|--------|
| `parse_log_lines()` | Log text | TimelineEvents with errors, timeouts |
| `parse_deploy_history()` | Deploy logs | Deploy/rollback events |
| `parse_alerts()` | Alert JSON | Alert events with severity |
| `extract_what_changed()` | All artifacts | Change detection |

### 5. Analyzer (`src/analyzer.py`)

Orchestrates the analysis pipeline:

```
Input: case_id, artifacts, analysis parameters
  │
  ├─► Parse artifacts → Timeline events
  │
  ├─► Extract what changed
  │
  ├─► Build search query (summary + focus area)
  │
  ├─► Retrieve evidence (top_k from vector store)
  │
  ├─► Check confidence threshold
  │     │
  │     ├─► Below threshold + strict_mode → REFUSE
  │     │
  │     └─► Above threshold → Continue
  │
  ├─► Generate hypotheses via LLM
  │
  └─► Build and return AnalyzeResponse
```

---

## Data Models

### Core Models (`src/models.py`)

#### Artifact Types
```python
class ArtifactType(str, Enum):
    LOGS = "logs"
    ALERTS = "alerts"
    DEPLOY_HISTORY = "deploy_history"
    RUNBOOK = "runbook"
    METRICS_SNAPSHOT = "metrics_snapshot"
```

#### Focus Areas
```python
class FocusArea(str, Enum):
    GENERAL = "general"
    DATABASE = "database"
    AUTH = "auth"
    NETWORK = "network"
    DEPLOYMENT = "deployment"
    PERFORMANCE = "performance"
```

#### Case Status
```python
class CaseStatus(str, Enum):
    CREATED = "created"      # Case created, not yet indexed
    INGESTED = "ingested"    # Artifacts indexed in vector store
    ANALYZED = "analyzed"    # Analysis completed at least once
```

#### Evidence Model
```python
class Evidence(BaseModel):
    source_id: str           # Artifact source identifier
    excerpt: str             # Text excerpt (≤300 chars)
    relevance: float         # 0.0 - 1.0 similarity score
    artifact_type: ArtifactType
```

#### Timeline Event Model
```python
class TimelineEvent(BaseModel):
    timestamp: Optional[datetime]  # Parsed datetime
    timestamp_str: str             # Original string
    kind: str                      # error, deploy, alert, etc.
    title: str                     # Event title
    details: str                   # Full event details
    severity: str                  # info, warning, error, critical
    evidence: list[Evidence]       # Supporting evidence
```

#### Hypothesis Model
```python
class Hypothesis(BaseModel):
    rank: int                           # 1 = most likely
    title: str                          # Brief title
    root_cause: str                     # Detailed explanation
    confidence: float                   # 0.0 - 1.0
    evidence: list[Evidence]            # Supporting evidence
    counter_evidence: list[Evidence]    # Contradicting evidence
    tests_to_confirm: list[str]         # Validation steps
    immediate_mitigations: list[str]    # Quick fixes
    long_term_fixes: list[str]          # Permanent solutions
```

### Request/Response Models

#### Ingest Request
```python
class IngestRequest(BaseModel):
    title: str                    # Case title (1-200 chars)
    incident_summary: str         # Summary (10-5000 chars)
    artifacts: list[Artifact]     # At least 1 artifact
```

#### Analyze Request
```python
class AnalyzeRequest(BaseModel):
    case_id: str                  # UUID of case to analyze
    strict_mode: bool = True      # Refuse on low confidence
    top_k: int = 8                # Evidence retrieval count (1-20)
    hypothesis_count: int = 3     # Hypotheses to generate (1-5)
    focus_area: Optional[FocusArea]  # Analysis focus
    user_notes: Optional[str]     # Additional context
```

#### Analyze Response
```python
class AnalyzeResponse(BaseModel):
    case_id: str
    timeline_events: list[TimelineEvent]
    hypotheses: list[Hypothesis]
    what_changed: list[WhatChanged]
    recommended_next_steps: list[str]
    confidence_overall: float
    refusal_reason: Optional[str]      # Set if strict mode refused
    analysis_metadata: dict            # Debug info
```

---

## API Reference

### POST /ingest

Ingests a new incident case with artifacts.

**Request:**
```json
{
  "title": "DB Connection Pool Exhaustion",
  "incident_summary": "Starting at 14:32 UTC, users reported...",
  "artifacts": [
    {
      "type": "logs",
      "source_id": "order-service-pod-1",
      "content": "2024-01-15T14:32:15Z ERROR [order-service] ...",
      "timestamp": "2024-01-15T14:00:00Z",
      "metadata": {}
    }
  ]
}
```

**Response:**
```json
{
  "case_id": "85a7e87a-5c5f-4706-90f0-659911f97294",
  "title": "DB Connection Pool Exhaustion",
  "artifacts_indexed": 15,
  "status": "ingested"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 422 | Validation error |
| 500 | Internal error |

---

### POST /analyze

Analyzes an ingested case and generates hypotheses.

**Request:**
```json
{
  "case_id": "85a7e87a-5c5f-4706-90f0-659911f97294",
  "strict_mode": true,
  "top_k": 10,
  "hypothesis_count": 3,
  "focus_area": "database",
  "user_notes": "Deployment happened at 14:15"
}
```

**Response (Success):**
```json
{
  "case_id": "85a7e87a-5c5f-4706-90f0-659911f97294",
  "timeline_events": [
    {
      "timestamp_str": "2024-01-15T14:32:15Z",
      "kind": "error",
      "title": "Pool Exhaustion detected",
      "details": "ERROR [order-service] Failed to acquire...",
      "severity": "error",
      "evidence": [...]
    }
  ],
  "hypotheses": [
    {
      "rank": 1,
      "title": "Database Connection Pool Exhaustion",
      "root_cause": "A deployment at 14:15 introduced...",
      "confidence": 0.9,
      "evidence": [...],
      "counter_evidence": [],
      "tests_to_confirm": [
        "Check pg_stat_activity for connection count",
        "Review query execution times post-deploy"
      ],
      "immediate_mitigations": [
        "Rollback to v2.3.0",
        "Temporarily increase pool size"
      ],
      "long_term_fixes": [
        "Add connection pooling middleware",
        "Implement query optimization"
      ]
    }
  ],
  "what_changed": [
    {
      "category": "deployment",
      "description": "Deployed version v2.4.0",
      "evidence": [...]
    }
  ],
  "recommended_next_steps": [
    "Verify connection pool metrics in Grafana",
    "Check for slow queries in pg_stat_statements"
  ],
  "confidence_overall": 0.85,
  "refusal_reason": null,
  "analysis_metadata": {
    "evidence_count": 10,
    "avg_relevance": 0.72,
    "strict_mode": true,
    "model": "gpt-4o-mini"
  }
}
```

**Response (Strict Mode Refusal):**
```json
{
  "case_id": "...",
  "timeline_events": [...],
  "hypotheses": [],
  "what_changed": [],
  "recommended_next_steps": [
    "Collect more detailed logs around the incident timeframe",
    "Gather deploy history for the 24 hours before incident",
    "Check monitoring dashboards for anomalies"
  ],
  "confidence_overall": 0.35,
  "refusal_reason": "I don't have enough evidence in the provided artifacts to determine a root cause. The evidence relevance is too low for confident analysis.",
  "analysis_metadata": {
    "evidence_count": 3,
    "avg_relevance": 0.35,
    "strict_mode": true
  }
}
```

---

### GET /cases

Lists all incident cases.

**Response:**
```json
{
  "cases": [
    {
      "case_id": "85a7e87a-5c5f-4706-90f0-659911f97294",
      "title": "DB Connection Pool Exhaustion",
      "status": "analyzed",
      "created_at": "2024-01-15T14:00:00Z",
      "artifact_count": 6,
      "last_analysis": "2024-01-15T15:30:00Z",
      "confidence_overall": 0.85
    }
  ],
  "total_cases": 1
}
```

---

### GET /cases/{case_id}

Gets full details for a specific case.

**Response:**
```json
{
  "case_id": "85a7e87a-5c5f-4706-90f0-659911f97294",
  "title": "DB Connection Pool Exhaustion",
  "incident_summary": "Starting at 14:32 UTC...",
  "status": "analyzed",
  "created_at": "2024-01-15T14:00:00Z",
  "artifacts": [...],
  "last_analysis": {
    "timeline_events": [...],
    "hypotheses": [...],
    ...
  }
}
```

---

### POST /cases/{case_id}/rerun

Reruns analysis with additional constraints.

**Request:**
```json
{
  "strict_mode": false,
  "top_k": 15,
  "hypothesis_count": 5,
  "focus_area": "network",
  "user_notes": "Focus on the DNS changes",
  "pin_hypothesis": "DNS resolution failure",
  "exclude_sources": ["metrics-exporter"]
}
```

---

## Analysis Pipeline

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANALYSIS PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT: case_id, strict_mode, top_k, hypothesis_count, focus_area       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 1: PARSE ARTIFACTS                                         │    │
│  │                                                                  │    │
│  │   for artifact in artifacts:                                    │    │
│  │     events = parse_artifact(artifact)                           │    │
│  │     all_events.extend(events)                                   │    │
│  │                                                                  │    │
│  │   all_events.sort(by=timestamp)                                 │    │
│  │                                                                  │    │
│  │   Output: list[TimelineEvent]                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 2: EXTRACT WHAT CHANGED                                    │    │
│  │                                                                  │    │
│  │   Scan deploy_history artifacts for:                            │    │
│  │   - Version changes                                             │    │
│  │   - Config changes                                              │    │
│  │   - Infrastructure changes                                      │    │
│  │                                                                  │    │
│  │   Output: list[WhatChanged]                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 3: BUILD SEARCH QUERY                                      │    │
│  │                                                                  │    │
│  │   query = incident_summary                                      │    │
│  │                                                                  │    │
│  │   if focus_area == "database":                                  │    │
│  │     query += " database connection pool query timeout"          │    │
│  │   elif focus_area == "auth":                                    │    │
│  │     query += " authentication authorization token jwt"          │    │
│  │   ...                                                           │    │
│  │                                                                  │    │
│  │   Output: str (search query)                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 4: RETRIEVE EVIDENCE                                       │    │
│  │                                                                  │    │
│  │   evidence = vector_store.search(                               │    │
│  │     case_id=case_id,                                            │    │
│  │     query=search_query,                                         │    │
│  │     top_k=top_k,                                                │    │
│  │     exclude_sources=exclude_sources                             │    │
│  │   )                                                             │    │
│  │                                                                  │    │
│  │   avg_relevance = mean(evidence.relevance)                      │    │
│  │                                                                  │    │
│  │   Output: list[Evidence], float (avg_relevance)                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 5: STRICT MODE CHECK                                       │    │
│  │                                                                  │    │
│  │   if strict_mode AND (len(evidence) < 2 OR avg_relevance < 0.6):│    │
│  │                                                                  │    │
│  │     return AnalyzeResponse(                                     │    │
│  │       hypotheses=[],                                            │    │
│  │       refusal_reason="Insufficient evidence...",                │    │
│  │       recommended_next_steps=[                                  │    │
│  │         "Collect more logs...",                                 │    │
│  │         "Gather deploy history..."                              │    │
│  │       ]                                                         │    │
│  │     )                                                           │    │
│  │                                                                  │    │
│  │   else: continue to STEP 6                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 6: GENERATE HYPOTHESES (LLM)                               │    │
│  │                                                                  │    │
│  │   Prompt includes:                                              │    │
│  │   - System rubric (strict rules)                                │    │
│  │   - Incident summary                                            │    │
│  │   - Timeline summary                                            │    │
│  │   - Evidence excerpts (indexed for citation)                    │    │
│  │   - Changes detected                                            │    │
│  │   - User notes (if any)                                         │    │
│  │                                                                  │    │
│  │   LLM returns JSON with:                                        │    │
│  │   - hypotheses with evidence_indices                            │    │
│  │   - what_changed                                                │    │
│  │   - recommended_next_steps                                      │    │
│  │   - confidence_overall                                          │    │
│  │                                                                  │    │
│  │   Output: dict (LLM response)                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ STEP 7: BUILD RESPONSE                                          │    │
│  │                                                                  │    │
│  │   Map evidence_indices to actual Evidence objects               │    │
│  │   Sort hypotheses by rank                                       │    │
│  │   Construct AnalyzeResponse                                     │    │
│  │                                                                  │    │
│  │   Output: AnalyzeResponse                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Parser Implementation

### Timestamp Patterns

The parser recognizes multiple timestamp formats:

| Format | Pattern | Example |
|--------|---------|---------|
| ISO 8601 | `YYYY-MM-DDTHH:MM:SS.sssZ` | `2024-01-15T14:32:15.234Z` |
| Common Log | `YYYY-MM-DD HH:MM:SS` | `2024-01-15 14:32:15` |
| Syslog | `Mon DD HH:MM:SS` | `Jan 15 14:32:15` |
| Unix (s) | `\d{10}` | `1705329135` |
| Unix (ms) | `\d{13}` | `1705329135234` |

### Error Patterns

```python
ERROR_PATTERNS = [
    (r'(?i)\b(exception|error|fatal|critical|failure|failed)\b', 'error'),
    (r'(?i)\b(timeout|timed?\s*out)\b', 'timeout'),
    (r'(?i)\b(5\d{2})\s+(error|internal server error)', 'http_5xx'),
    (r'(?i)\b(connection\s+(?:refused|reset|timeout|failed))\b', 'connection_error'),
    (r'(?i)\b(oom|out\s*of\s*memory|memory\s+exhausted)\b', 'memory'),
    (r'(?i)\b(deadlock|lock\s+timeout)\b', 'database'),
    (r'(?i)\b(pool\s+exhausted|no\s+available\s+connections?)\b', 'pool_exhaustion'),
    (r'(?i)\b(jwt|token)\s+(?:invalid|expired|validation\s+failed)\b', 'auth'),
    (r'(?i)\b(clock\s+skew|time\s+sync|ntp)\b', 'clock'),
]
```

### Deploy Patterns

```python
DEPLOY_PATTERNS = [
    (r'(?i)\b(deployed|deploying|deployment)\b', 'deploy'),
    (r'(?i)\b(rollback|rolled\s+back|reverting)\b', 'rollback'),
    (r'(?i)\b(version|release|build)[:\s]+([v\d]+[\w.-]*)', 'version'),
    (r'(?i)\b(image|container)[:\s]+([^\s]+:[^\s]+)', 'container'),
]
```

### Severity Classification

```python
def classify_severity(kind: str) -> str:
    if kind in ['error', 'memory', 'pool_exhaustion']:
        return 'error'
    elif kind in ['timeout', 'connection_error', 'database']:
        return 'warning'
    elif kind == 'critical':
        return 'critical'
    else:
        return 'info'
```

---

## Vector Store & Retrieval

### ChromaDB Configuration

```python
self.chroma_client = chromadb.Client(Settings(
    anonymized_telemetry=False,
    is_persistent=True,
    persist_directory=self.persist_directory
))
```

### Collection Naming

Each case gets its own collection:
```python
collection_name = f"case_{case_id.replace('-', '_')[:50]}"
```

### Chunking Algorithm

```python
def _chunk_content(content: str, chunk_size=500, overlap=50) -> list[str]:
    chunks = []
    start = 0
    
    while start < len(content):
        end = start + chunk_size
        chunk = content[start:end]
        
        # Try to break at sentence boundary
        if end < len(content):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point > chunk_size // 2:
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    return chunks
```

### Embedding & Indexing

```python
# Batch embedding for efficiency
embeddings = []
for i in range(0, len(chunks), batch_size):
    batch = chunks[i:i + batch_size]
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=batch
    )
    embeddings.extend([item.embedding for item in response.data])

# Add to ChromaDB
collection.add(
    ids=chunk_ids,
    embeddings=embeddings,
    documents=chunks,
    metadatas=metadatas
)
```

### Retrieval & Similarity

```python
def search(case_id, query, top_k=8, exclude_sources=None):
    query_embedding = self._get_embedding(query)
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    
    evidence_list = []
    for i, doc_id in enumerate(results["ids"][0]):
        distance = results["distances"][0][i]
        relevance = 1 - distance  # Cosine distance to similarity
        
        evidence_list.append(Evidence(
            source_id=results["metadatas"][0][i]["source_id"],
            excerpt=results["documents"][0][i][:300],
            relevance=max(0, min(1, relevance)),
            artifact_type=ArtifactType(...)
        ))
    
    return evidence_list
```

---

## LLM Integration

### System Prompt

```python
ANALYSIS_SYSTEM_PROMPT = """You are an expert Site Reliability Engineer conducting incident root cause analysis.

STRICT RULES:
1. Produce ONLY valid JSON matching the schema exactly
2. EVERY claim must cite evidence from the provided excerpts
3. Include counter-evidence when present
4. If evidence is insufficient, set refusal_reason and provide empty hypotheses
5. Each hypothesis MUST reference at least 2 evidence excerpts
6. NO speculation without evidence
7. Include specific tests-to-confirm for each hypothesis

EVIDENCE REQUIREMENT:
- Strong evidence: Direct error messages, stack traces, timestamps correlating with incident
- Weak evidence: General logs, unrelated timestamps, vague mentions
- If only weak evidence exists, refuse to speculate

OUTPUT SCHEMA:
{
  "hypotheses": [...],
  "what_changed": [...],
  "recommended_next_steps": [...],
  "confidence_overall": 0.0-1.0,
  "refusal_reason": null or "string"
}"""
```

### User Prompt Template

```python
user_prompt = f"""Analyze this incident and generate {hypothesis_count} ranked hypotheses.

INCIDENT SUMMARY:
{incident_summary}

{f"USER NOTES: {user_notes}" if user_notes else ""}

TIMELINE SUMMARY:
{timeline_summary}

CHANGES DETECTED:
{changes_context}

EVIDENCE (cite by index):
[0] Source: order-service (logs)
ERROR [order-service] Failed to acquire database connection...

[1] Source: argocd (deploy_history)
Deployed version v2.4.0...

{f"FOCUS AREA: {focus_area}" if focus_area else ""}

Generate hypotheses following the exact JSON schema. Each hypothesis must cite at least 2 evidence indices."""
```

### LLM Call

```python
response = openai_client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ],
    temperature=0.3,         # Low for deterministic output
    max_tokens=2000,
    response_format={"type": "json_object"}  # Enforce JSON
)
```

---

## Security & Gateway Integration

### Gateway Endpoints

The Secure AI Gateway proxies all requests with security checks:

| Gateway Endpoint | Service Endpoint | Security |
|------------------|------------------|----------|
| POST `/incident/ingest` | POST `/ingest` | Rate limit, PII redaction, Injection check |
| POST `/incident/analyze` | POST `/analyze` | Rate limit, Injection check on user_notes |
| GET `/incident/cases` | GET `/cases` | Rate limit |
| GET `/incident/cases/{id}` | GET `/cases/{id}` | Rate limit |
| POST `/incident/cases/{id}/rerun` | POST `/cases/{id}/rerun` | Rate limit, Injection check |

### PII Redaction Flow

```python
# In gateway: process artifact content
for artifact in request.artifacts:
    processed_content, security_result = security.process(artifact.content)
    # Emails, phone numbers, SSNs are replaced with [REDACTED]
    processed_artifacts.append({
        ...
        "content": processed_content,  # Cleaned
    })
```

### Injection Detection

```python
# In gateway: check incident summary and user notes
processed_summary, security_result = security.process(request.incident_summary)

if security_result.status == SecurityStatus.BLOCKED:
    raise HTTPException(
        status_code=403,
        detail="Potential prompt injection detected"
    )
```

### Rate Limiting

| Endpoint | Token Cost | Reason |
|----------|------------|--------|
| `/incident/ingest` | 3 tokens | Moderate (embedding calls) |
| `/incident/analyze` | 5 tokens | High (LLM calls) |
| `/incident/cases` | 1 token | Low (read only) |
| `/incident/cases/{id}/rerun` | 5 tokens | High (LLM calls) |

---

## Frontend Implementation

### Page: `/demo/incident`

**Three-Panel Layout:**

```
┌─────────────────┬─────────────────────────────┬─────────────────┐
│  LEFT PANEL     │        MAIN PANEL           │   RIGHT PANEL   │
│                 │                             │                 │
│  • Case List    │  • Tab Navigation           │  • Hypothesis   │
│  • Load Sample  │    - Timeline               │    Detail       │
│  • Analysis     │    - Hypotheses             │  • Evidence     │
│    Controls     │    - What Changed           │  • Counter-     │
│                 │    - Next Steps             │    Evidence     │
│                 │                             │  • Tests        │
│                 │  • Confidence Bar           │  • Mitigations  │
│                 │  • Event List / Cards       │  • Fixes        │
└─────────────────┴─────────────────────────────┴─────────────────┘
```

**Key Components:**

1. **Case Selector** - Load sample incidents or browse previous cases
2. **Analysis Controls** - Strict mode toggle, top_k slider, hypothesis count, focus area
3. **Timeline View** - Chronological events with severity indicators and filters
4. **Hypothesis List** - Ranked cards with confidence badges
5. **Hypothesis Detail** - Evidence excerpts, tests, mitigations in a sticky sidebar

**State Management:**

```typescript
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
```

### Page: `/projects/incident`

Project write-up page with:
- Overview and architecture diagram
- Key features with icons
- Failure modes addressed
- Tradeoffs and future improvements
- CTA to demo

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_API_BASE` | OpenAI API base URL | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | Model for embeddings | `text-embedding-3-small` |
| `CHAT_MODEL` | Model for chat | `gpt-4o-mini` |
| `DEFAULT_TOP_K` | Default evidence retrieval count | `8` |
| `DEFAULT_HYPOTHESIS_COUNT` | Default hypothesis count | `3` |
| `CONFIDENCE_THRESHOLD` | Strict mode threshold | `0.6` |
| `CASES_DIRECTORY` | Case storage path | `./cases` |
| `CHROMA_PERSIST_DIRECTORY` | ChromaDB path | `./chroma_db` |

### Docker Compose Service

```yaml
incident:
  build:
    context: ./ai-incident-investigator
    dockerfile: Dockerfile
  ports:
    - "8003:8003"
  environment:
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - OPENAI_API_BASE=${OPENAI_API_BASE:-https://api.openai.com/v1}
    - EMBEDDING_MODEL=${EMBEDDING_MODEL:-text-embedding-3-small}
    - CHAT_MODEL=${CHAT_MODEL:-gpt-4o-mini}
  volumes:
    - incident-cases:/app/cases
    - incident-chroma:/app/chroma_db
  networks:
    - ai-network
```

---

## Testing Strategy

### Unit Tests

**Parser Tests (`tests/test_parsers.py`):**

```python
class TestTimestampExtraction:
    def test_iso_timestamp(self): ...
    def test_common_log_timestamp(self): ...
    def test_no_timestamp(self): ...

class TestLogParsing:
    def test_error_detection(self): ...
    def test_timeout_detection(self): ...
    def test_pool_exhaustion_detection(self): ...
    def test_auth_error_detection(self): ...

class TestDeployParsing:
    def test_deployment_detection(self): ...
    def test_rollback_detection(self): ...
```

**Case Store Tests (`tests/test_case_store.py`):**

```python
class TestCaseStore:
    def test_create_case(self): ...
    def test_case_exists(self): ...
    def test_get_case(self): ...
    def test_update_status(self): ...
    def test_list_cases(self): ...
```

### Running Tests

```bash
cd ai-incident-investigator
pytest tests/ -v

# With coverage
pytest tests/ --cov=src --cov-report=html
```

---

## Deployment

### Local Development

```bash
cd ai-incident-investigator
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8003
```

### Docker

```bash
docker build -t ai-incident-investigator .
docker run -p 8003:8003 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/cases:/app/cases \
  ai-incident-investigator
```

### Full Stack (Docker Compose)

```bash
cd /path/to/ai-engineer
docker compose up --build
```

### Production (Railway)

1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Configure persistent volumes for `/app/cases` and `/app/chroma_db`
4. Deploy

---

## Failure Modes & Mitigations

### 1. Hallucination

**Risk:** LLM generates hypotheses not supported by evidence.

**Mitigations:**
- Strict mode refuses when evidence relevance < threshold
- Each hypothesis must cite ≥2 evidence excerpts
- Counter-evidence surfacing for balanced view
- System prompt explicitly forbids speculation

### 2. Prompt Injection

**Risk:** Malicious content in incident summary or user notes.

**Mitigations:**
- Gateway scans all free-text fields
- Detects system override, jailbreak, exfiltration patterns
- Blocks requests with detected injection

### 3. PII Leakage

**Risk:** Logs contain sensitive data (emails, phone numbers).

**Mitigations:**
- Gateway redacts PII before storage
- Regex patterns for email, phone, SSN, credit card
- Redacted content stored, not originals

### 4. Rate Abuse

**Risk:** Expensive LLM calls from malicious actors.

**Mitigations:**
- Token bucket rate limiting per IP
- Higher token cost for analysis endpoints (5 vs 1)
- Request validation prevents oversized payloads

### 5. Low-Quality Evidence

**Risk:** Garbage in, garbage out.

**Mitigations:**
- Confidence scoring based on retrieval relevance
- Strict mode refuses low-confidence analysis
- Recommended next steps guide data collection

---

## Appendix: Sample Incidents

### 1. DB Connection Pool Exhaustion

**Scenario:** Deploy introduces heavier queries, exhausting connection pool.

**Artifacts:**
- Logs with pool exhaustion errors
- Deploy history showing v2.4.0 with new recommendations feature
- Alerts showing 15% error rate spike
- Metrics showing 100% pool utilization

**Expected Analysis:**
- Timeline shows deploy at 14:15, errors at 14:32
- Hypothesis: New recommendation queries consuming connections
- Tests: Check pg_stat_activity, review query plans
- Mitigation: Rollback, increase pool size

### 2. Auth Token Clock Skew

**Scenario:** Container base image change breaks NTP, causing JWT validation failures.

**Artifacts:**
- Logs with "token not yet valid" and "token expired" errors
- Deploy history showing alpine image update
- Alerts showing 89% auth failure rate
- Metrics showing time drift

**Expected Analysis:**
- Timeline shows base image update, then auth failures
- Hypothesis: Clock skew from NTP misconfiguration
- Tests: Compare server time vs external, check chronyd status
- Mitigation: Force NTP resync, increase JWT leeway

---

*Documentation version: 1.0.0*
*Last updated: January 2026*
