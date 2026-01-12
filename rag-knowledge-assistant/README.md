# RAG Knowledge Assistant

Enterprise-style internal knowledge assistant with Retrieval-Augmented Generation.

## Overview

This system replaces traditional wiki/documentation search with AI-powered question answering. It ingests documents, chunks them intelligently, creates embeddings, and answers questions with citations.

**Key differentiator**: Strict mode ensures the system says "I don't know" when confidence is low, rather than hallucinating.

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Documents  │───▶│  Chunking   │───▶│ Embeddings  │
│   (JSON)    │    │  (500 char) │    │  (OpenAI)   │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Answer    │◀───│     LLM     │◀───│   ChromaDB  │
│ + Citations │    │  (Context)  │    │  (Vector)   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Request Flow
1. **Ingest**: Documents are chunked with overlap, embedded, and stored in ChromaDB
2. **Ask**: Question is embedded, top-k similar chunks retrieved, context passed to LLM
3. **Strict Mode**: If confidence is below threshold, returns safe "I don't know" response

## Key Features

- **Document Chunking**: Sentence-aware splitting with configurable overlap
- **Vector Search**: ChromaDB with cosine similarity
- **Citation Tracking**: Every answer includes source references
- **Strict Mode**: Prevents hallucination on low-confidence queries
- **Confidence Scoring**: Weighted average of retrieval scores

## Why This Matters

Real companies need AI assistants that:
- **Don't hallucinate**: Wrong answers erode trust faster than no answers
- **Cite sources**: Users need to verify and dig deeper
- **Handle ambiguity**: "I don't know" is a valid and valuable response
- **Scale with documents**: Chunking and embeddings work on large corpora

## API Endpoints

### POST /ingest
Ingest documents into the knowledge base.

```bash
curl -X POST http://localhost:8001/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"content": "...", "source": "policy.md"}
    ]
  }'
```

### POST /ask
Ask a question against the knowledge base.

```bash
curl -X POST http://localhost:8001/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the vacation policy?",
    "strict_mode": true
  }'
```

Response:
```json
{
  "answer": "The vacation policy allows 20 days... [Source: hr-policy/vacation.md]",
  "citations": [
    {
      "source": "hr-policy/vacation.md",
      "chunk_id": "...",
      "relevance_score": 0.92,
      "excerpt": "..."
    }
  ],
  "confidence_score": 0.89,
  "strict_mode_triggered": false
}
```

### GET /sources
List all indexed sources.

```bash
curl http://localhost:8001/sources
```

## Tradeoffs & Design Decisions

### Simplified (for portfolio)
- **In-memory ChromaDB**: Production would use persistent/hosted vector DB
- **Single embedding model**: Could use hybrid search (dense + sparse)
- **Simple confidence heuristic**: Production might use calibrated confidence

### Would Improve in Production
- **Async embedding batching**: Better throughput for large ingests
- **Chunk metadata enrichment**: Titles, timestamps, access controls
- **Query rewriting**: Handle ambiguous or multi-part questions
- **Feedback loop**: Track which answers were helpful

## Local Setup

### With Docker
```bash
docker build -t rag-knowledge-assistant .
docker run -p 8001:8001 \
  -e OPENAI_API_KEY=your-key \
  rag-knowledge-assistant
```

### Without Docker
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your OPENAI_API_KEY
uvicorn src.main:app --port 8001 --reload
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_API_BASE` | API base URL | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |
| `CHAT_MODEL` | Chat model | `gpt-4o-mini` |
| `CHUNK_SIZE` | Characters per chunk | `500` |
| `CHUNK_OVERLAP` | Overlap between chunks | `50` |
| `TOP_K` | Chunks to retrieve | `5` |
| `CONFIDENCE_THRESHOLD` | Strict mode threshold | `0.7` |

## Testing

```bash
pytest tests/ -v
```

Tests cover:
- Chunking logic and edge cases
- Strict mode behavior
- Confidence calculation
- Context building

## Deployment Notes

### Railway
1. Create new project from GitHub repo
2. Set root directory to `rag-knowledge-assistant`
3. Add environment variables
4. Deploy with auto-detected Dockerfile

### Health Check
The `/health` endpoint returns service status and indexed chunk count.
