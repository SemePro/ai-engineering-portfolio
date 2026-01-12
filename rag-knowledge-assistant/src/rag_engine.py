"""Core RAG engine for question answering."""

import time
import logging
from openai import OpenAI

from .config import get_settings
from .vector_store import VectorStore
from .models import AskRequest, AskResponse, Citation

logger = logging.getLogger(__name__)


class RAGEngine:
    """
    Retrieval-Augmented Generation engine.
    
    Handles the full RAG pipeline:
    1. Retrieve relevant chunks
    2. Build context from chunks
    3. Generate answer with citations
    4. Apply strict mode if needed
    """
    
    SYSTEM_PROMPT = """You are a helpful knowledge assistant. Answer questions based ONLY on the provided context.

Rules:
1. Only use information from the provided context
2. If the context doesn't contain enough information, say so clearly
3. Always cite your sources by referencing the source documents
4. Be concise but thorough
5. Never make up information not present in the context

When citing sources, use the format [Source: filename] inline in your response."""

    NO_ANSWER_RESPONSE = "I don't know based on the provided documents."
    
    def __init__(self, vector_store: VectorStore):
        """Initialize the RAG engine."""
        self.vector_store = vector_store
        self.settings = get_settings()
        
        self.openai_client = OpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_api_base
        )
    
    def _build_context(self, chunks: list, scores: list[float]) -> str:
        """Build context string from retrieved chunks."""
        context_parts = []
        for i, (chunk, score) in enumerate(zip(chunks, scores), 1):
            context_parts.append(
                f"[Document {i}] Source: {chunk.source}\n"
                f"Relevance: {score:.2f}\n"
                f"Content: {chunk.content}\n"
            )
        return "\n---\n".join(context_parts)
    
    def _calculate_confidence(self, scores: list[float]) -> float:
        """
        Calculate overall confidence score.
        
        Uses a weighted average with more weight on top results.
        """
        if not scores:
            return 0.0
        
        # Weighted average: top results matter more
        weights = [1.0 / (i + 1) for i in range(len(scores))]
        weighted_sum = sum(s * w for s, w in zip(scores, weights))
        weight_total = sum(weights)
        
        return round(weighted_sum / weight_total, 4)
    
    def _generate_answer(self, question: str, context: str) -> str:
        """Generate answer using the LLM."""
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\n---\n\nQuestion: {question}"
            }
        ]
        
        response = self.openai_client.chat.completions.create(
            model=self.settings.chat_model,
            messages=messages,
            temperature=0.3,
            max_tokens=1000
        )
        
        return response.choices[0].message.content or ""
    
    async def ask(self, request: AskRequest) -> AskResponse:
        """
        Process a question through the RAG pipeline.
        
        Args:
            request: The ask request with question and options
            
        Returns:
            AskResponse with answer, citations, and metadata
        """
        start_time = time.time()
        
        top_k = request.top_k or self.settings.top_k
        
        # Step 1: Retrieve relevant chunks
        chunks, scores = self.vector_store.search(
            query=request.question,
            top_k=top_k
        )
        
        # Step 2: Calculate confidence
        confidence = self._calculate_confidence(scores)
        
        # Step 3: Check strict mode
        strict_mode_triggered = False
        if request.strict_mode and confidence < self.settings.confidence_threshold:
            strict_mode_triggered = True
            answer = self.NO_ANSWER_RESPONSE
            citations = []
        else:
            # Step 4: Build context and generate answer
            context = self._build_context(chunks, scores)
            answer = self._generate_answer(request.question, context)
            citations = self.vector_store.get_citations(chunks, scores)
        
        processing_time = (time.time() - start_time) * 1000
        
        return AskResponse(
            answer=answer,
            citations=citations,
            confidence_score=confidence,
            strict_mode_triggered=strict_mode_triggered,
            retrieved_chunks=len(chunks),
            processing_time_ms=round(processing_time, 2)
        )
