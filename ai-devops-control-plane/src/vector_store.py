"""Vector store for change history and signals."""

import chromadb
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI
from typing import Optional
import logging

from .config import get_settings
from .models import Evidence

logger = logging.getLogger(__name__)


class DevOpsVectorStore:
    """Manages embeddings for change history and signals."""
    
    def __init__(self, persist_directory: Optional[str] = None):
        settings = get_settings()
        
        self.persist_directory = persist_directory or settings.chroma_persist_directory
        self.embedding_model = settings.embedding_model
        
        self.openai_client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base
        )
        
        self.chroma_client = chromadb.Client(ChromaSettings(
            anonymized_telemetry=False,
            is_persistent=True,
            persist_directory=self.persist_directory
        ))
        
        # Single collection for all change history
        self.collection = self.chroma_client.get_or_create_collection(
            name="devops_changes",
            metadata={"hnsw:space": "cosine"}
        )
    
    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding for text."""
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text[:8000]
        )
        return response.data[0].embedding
    
    def _chunk_content(self, content: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        """Split content into overlapping chunks."""
        if len(content) <= chunk_size:
            return [content]
        
        chunks = []
        start = 0
        while start < len(content):
            end = start + chunk_size
            chunk = content[start:end]
            
            if end < len(content):
                last_newline = chunk.rfind('\n')
                if last_newline > chunk_size // 2:
                    chunk = chunk[:last_newline + 1]
                    end = start + last_newline + 1
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        return [c for c in chunks if c]
    
    def index_change(self, change_id: str, service: str, change_type: str,
                     diff_summary: str, description: Optional[str] = None) -> int:
        """Index a change for similarity search."""
        
        # Combine content
        content = f"Service: {service}\nChange Type: {change_type}\n"
        if description:
            content += f"Description: {description}\n"
        content += f"Diff Summary:\n{diff_summary}"
        
        chunks = self._chunk_content(content)
        
        if not chunks:
            return 0
        
        # Generate embeddings
        embeddings = []
        for chunk in chunks:
            embedding = self._get_embedding(chunk)
            embeddings.append(embedding)
        
        # Prepare data for ChromaDB
        ids = [f"{change_id}_{i}" for i in range(len(chunks))]
        metadatas = [{
            "change_id": change_id,
            "service": service,
            "change_type": change_type,
            "chunk_index": i
        } for i in range(len(chunks))]
        
        # Add to collection
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas
        )
        
        logger.info(f"Indexed {len(chunks)} chunks for change {change_id}")
        return len(chunks)
    
    def search_similar_changes(
        self,
        query: str,
        service: Optional[str] = None,
        top_k: int = 10,
        exclude_change_id: Optional[str] = None
    ) -> list[Evidence]:
        """Search for similar past changes."""
        
        query_embedding = self._get_embedding(query)
        
        # Build where filter
        where_filter = None
        if service:
            where_filter = {"service": service}
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k * 2,  # Get more to filter
            include=["documents", "metadatas", "distances"],
            where=where_filter
        )
        
        evidence_list = []
        seen_changes = set()
        
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i]
                relevance = 1 - distance
                
                metadata = results["metadatas"][0][i]
                change_id = metadata.get("change_id", "")
                
                # Skip excluded change and duplicates
                if change_id == exclude_change_id:
                    continue
                if change_id in seen_changes:
                    continue
                
                seen_changes.add(change_id)
                
                evidence_list.append(Evidence(
                    source=f"change:{change_id}",
                    excerpt=results["documents"][0][i][:300],
                    relevance=round(max(0, min(1, relevance)), 4),
                    source_type="change_history"
                ))
                
                if len(evidence_list) >= top_k:
                    break
        
        return evidence_list
    
    def get_chunk_count(self) -> int:
        """Get total indexed chunks."""
        return self.collection.count()
