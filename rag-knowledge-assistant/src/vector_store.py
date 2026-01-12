"""Vector store management using ChromaDB."""

import chromadb
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI
from typing import Optional
import logging

from .config import get_settings
from .models import DocumentChunk, Citation

logger = logging.getLogger(__name__)


class VectorStore:
    """Manages document embeddings and retrieval using ChromaDB."""
    
    def __init__(self, persist_directory: Optional[str] = None):
        """Initialize the vector store."""
        settings = get_settings()
        
        self.persist_directory = persist_directory or settings.chroma_persist_directory
        self.embedding_model = settings.embedding_model
        
        # Initialize OpenAI client
        self.openai_client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base
        )
        
        # Initialize ChromaDB
        self.chroma_client = chromadb.Client(ChromaSettings(
            anonymized_telemetry=False,
            is_persistent=True,
            persist_directory=self.persist_directory
        ))
        
        # Get or create collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
    
    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding for text using OpenAI."""
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding
    
    def _get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        if not texts:
            return []
        
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=texts
        )
        return [item.embedding for item in response.data]
    
    def add_chunks(self, chunks: list[DocumentChunk]) -> int:
        """
        Add document chunks to the vector store.
        
        Args:
            chunks: List of DocumentChunk objects
            
        Returns:
            Number of chunks added
        """
        if not chunks:
            return 0
        
        # Prepare data for ChromaDB
        ids = [chunk.id for chunk in chunks]
        documents = [chunk.content for chunk in chunks]
        metadatas = [
            {
                "source": chunk.source,
                "chunk_index": chunk.chunk_index,
                **chunk.metadata
            }
            for chunk in chunks
        ]
        
        # Generate embeddings in batch
        embeddings = self._get_embeddings_batch(documents)
        
        # Add to collection
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        
        logger.info(f"Added {len(chunks)} chunks to vector store")
        return len(chunks)
    
    def search(
        self,
        query: str,
        top_k: int = 5
    ) -> tuple[list[DocumentChunk], list[float]]:
        """
        Search for relevant chunks.
        
        Args:
            query: The search query
            top_k: Number of results to return
            
        Returns:
            Tuple of (chunks, similarity_scores)
        """
        query_embedding = self._get_embedding(query)
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        
        chunks = []
        scores = []
        
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                # Convert cosine distance to similarity score
                distance = results["distances"][0][i]
                similarity = 1 - distance  # Cosine similarity
                
                chunk = DocumentChunk(
                    id=chunk_id,
                    content=results["documents"][0][i],
                    source=results["metadatas"][0][i].get("source", "unknown"),
                    chunk_index=results["metadatas"][0][i].get("chunk_index", 0),
                    metadata=results["metadatas"][0][i]
                )
                chunks.append(chunk)
                scores.append(similarity)
        
        return chunks, scores
    
    def get_citations(
        self,
        chunks: list[DocumentChunk],
        scores: list[float]
    ) -> list[Citation]:
        """Convert chunks and scores to citations."""
        citations = []
        for chunk, score in zip(chunks, scores):
            excerpt = chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
            citations.append(Citation(
                source=chunk.source,
                chunk_id=chunk.id,
                relevance_score=round(score, 4),
                excerpt=excerpt
            ))
        return citations
    
    def get_all_sources(self) -> dict[str, int]:
        """Get all unique sources and their chunk counts."""
        # Get all items from collection
        all_items = self.collection.get(include=["metadatas"])
        
        sources: dict[str, int] = {}
        if all_items["metadatas"]:
            for metadata in all_items["metadatas"]:
                source = metadata.get("source", "unknown")
                sources[source] = sources.get(source, 0) + 1
        
        return sources
    
    def get_total_chunks(self) -> int:
        """Get total number of chunks in the store."""
        return self.collection.count()
    
    def clear(self) -> None:
        """Clear all documents from the vector store."""
        self.chroma_client.delete_collection("knowledge_base")
        self.collection = self.chroma_client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
