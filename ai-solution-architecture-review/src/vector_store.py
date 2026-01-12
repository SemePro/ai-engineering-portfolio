"""Vector store for architecture patterns."""
import chromadb
from chromadb.config import Settings
from openai import OpenAI

from .config import CHROMA_DIR, OPENAI_API_KEY, OPENAI_BASE_URL, EMBEDDING_MODEL


class PatternVectorStore:
    """Manages vector storage for architecture patterns."""

    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=CHROMA_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name="architecture_patterns",
            metadata={"description": "Architecture patterns and past decisions"},
        )
        self.openai_client = OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL,
        )
        self._seed_patterns()

    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding for text."""
        response = self.openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding

    def _seed_patterns(self):
        """Seed the vector store with architecture patterns."""
        patterns = [
            {
                "id": "pattern_rag_knowledge",
                "text": "RAG system for knowledge base and document Q&A. Use when: existing documents need to be queried, answers need citations, knowledge updates frequently. Components: document ingestion, chunking, embeddings, vector database, retrieval, LLM generation. Latency: medium. Cost: medium. Best for: customer support, internal knowledge, documentation search.",
                "approach": "rag",
            },
            {
                "id": "pattern_rag_enterprise",
                "text": "Enterprise RAG for internal search and compliance. Use when: large document corpus, need for audit trails, compliance requirements. Components: document processing, metadata extraction, vector store with access control, retrieval with filtering, LLM with guardrails. Latency: medium-high. Cost: medium-high.",
                "approach": "rag",
            },
            {
                "id": "pattern_fine_tuning_domain",
                "text": "Fine-tuned model for domain-specific language. Use when: specialized terminology, consistent style required, high volume of similar requests. Components: training data curation, fine-tuning pipeline, model versioning, inference API. Latency: low. Cost: high upfront, low per-request.",
                "approach": "fine_tuning",
            },
            {
                "id": "pattern_rules_realtime",
                "text": "Rule-based system for real-time decisions. Use when: latency < 100ms required, deterministic behavior needed, regulatory compliance, PII processing. Components: rule engine, decision trees, feature extraction, logging. Latency: very low. Cost: low. Best for: fraud detection, access control, content filtering.",
                "approach": "rules",
            },
            {
                "id": "pattern_rules_validation",
                "text": "Validation and classification without AI. Use when: clear business rules exist, errors are costly, auditability required. Components: schema validation, regex patterns, lookup tables, decision logic. Latency: very low. Cost: very low.",
                "approach": "rules",
            },
            {
                "id": "pattern_hybrid_moderation",
                "text": "Hybrid content moderation. Use when: need both speed and nuance, escalation paths required. Components: fast rule-based pre-filter, ML classifier, LLM for edge cases, human review queue. Latency: varies. Cost: medium.",
                "approach": "hybrid",
            },
            {
                "id": "pattern_hybrid_search",
                "text": "Hybrid search combining keyword and semantic. Use when: users expect both exact matches and semantic understanding. Components: traditional search index, vector embeddings, score fusion, reranking. Latency: medium. Cost: medium.",
                "approach": "hybrid",
            },
            {
                "id": "pattern_no_ai_simple",
                "text": "No AI needed for simple automation. Use when: clear input-output mapping, no ambiguity, reliability paramount. Components: API integration, data transformation, workflow orchestration. Latency: very low. Cost: very low. Best for: data pipelines, integrations, scheduled tasks.",
                "approach": "no_ai",
            },
            {
                "id": "pattern_no_ai_regulated",
                "text": "Avoid AI for highly regulated decisions. Use when: explainability mandated by law, liability concerns, medical or financial decisions with legal implications. Use deterministic systems with clear audit trails.",
                "approach": "no_ai",
            },
            {
                "id": "pattern_batch_summarization",
                "text": "Batch processing for document summarization. Use when: latency not critical, cost optimization needed, large volumes. Components: queue system, batch processor, LLM API, result storage. Latency: high (acceptable). Cost: lower than real-time.",
                "approach": "rag",
            },
        ]

        # Check if already seeded
        existing = self.collection.get()
        if existing["ids"]:
            return

        # Add patterns with embeddings
        for pattern in patterns:
            try:
                embedding = self._get_embedding(pattern["text"])
                self.collection.add(
                    ids=[pattern["id"]],
                    embeddings=[embedding],
                    documents=[pattern["text"]],
                    metadatas=[{"approach": pattern["approach"]}],
                )
            except Exception:
                # If embedding fails, skip this pattern
                pass

    def search_patterns(self, query: str, top_k: int = 5) -> list[dict]:
        """Search for relevant architecture patterns."""
        embedding = self._get_embedding(query)
        
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        patterns = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                patterns.append({
                    "id": results["ids"][0][i] if results["ids"] else None,
                    "text": doc,
                    "approach": results["metadatas"][0][i].get("approach") if results["metadatas"] else None,
                    "distance": results["distances"][0][i] if results["distances"] else None,
                })
        
        return patterns

    def add_pattern(self, pattern_id: str, text: str, approach: str) -> None:
        """Add a new architecture pattern."""
        self.collection.add(
            ids=[pattern_id],
            documents=[text],
            metadatas=[{"approach": approach}],
        )
