"""Vector store for incident artifact embeddings."""

import chromadb
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI
from typing import Optional
import logging
import re

from .config import get_settings
from .models import Artifact, Evidence

logger = logging.getLogger(__name__)


class IncidentVectorStore:
    """Manages embeddings for incident artifacts using ChromaDB."""
    
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
    
    def _get_collection(self, case_id: str):
        """Get or create a collection for a case."""
        collection_name = f"case_{case_id.replace('-', '_')[:50]}"
        return self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
    
    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding for text."""
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text[:8000]  # Truncate to avoid token limits
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
        
        return [c for c in chunks if c]
    
    def index_artifacts(self, case_id: str, artifacts: list[Artifact]) -> int:
        """Index artifacts for a case."""
        collection = self._get_collection(case_id)
        
        all_chunks = []
        all_ids = []
        all_metadatas = []
        
        for artifact in artifacts:
            chunks = self._chunk_content(artifact.content)
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"{artifact.source_id}_{i}"
                all_chunks.append(chunk)
                all_ids.append(chunk_id)
                all_metadatas.append({
                    "source_id": artifact.source_id,
                    "artifact_type": artifact.type.value,
                    "chunk_index": i,
                    "timestamp": str(artifact.timestamp) if artifact.timestamp else ""
                })
        
        if not all_chunks:
            return 0
        
        # Generate embeddings in batch
        embeddings = []
        batch_size = 20
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i:i + batch_size]
            response = self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=batch
            )
            embeddings.extend([item.embedding for item in response.data])
        
        # Add to collection
        collection.add(
            ids=all_ids,
            embeddings=embeddings,
            documents=all_chunks,
            metadatas=all_metadatas
        )
        
        logger.info(f"Indexed {len(all_chunks)} chunks for case {case_id}")
        return len(all_chunks)
    
    def search(
        self,
        case_id: str,
        query: str,
        top_k: int = 8,
        exclude_sources: list[str] = None
    ) -> list[Evidence]:
        """Search for relevant evidence."""
        collection = self._get_collection(case_id)
        
        query_embedding = self._get_embedding(query)
        
        # Build where filter if excluding sources
        where_filter = None
        if exclude_sources:
            where_filter = {"source_id": {"$nin": exclude_sources}}
        
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
            where=where_filter
        )
        
        evidence_list = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i]
                relevance = 1 - distance  # Convert cosine distance to similarity
                
                metadata = results["metadatas"][0][i]
                from .models import ArtifactType
                
                evidence_list.append(Evidence(
                    source_id=metadata.get("source_id", "unknown"),
                    excerpt=results["documents"][0][i][:300],
                    relevance=round(max(0, min(1, relevance)), 4),
                    artifact_type=ArtifactType(metadata.get("artifact_type", "logs"))
                ))
        
        return evidence_list
    
    def get_chunk_count(self, case_id: str) -> int:
        """Get number of indexed chunks for a case."""
        try:
            collection = self._get_collection(case_id)
            return collection.count()
        except Exception:
            return 0
    
    def delete_case(self, case_id: str) -> None:
        """Delete all embeddings for a case."""
        collection_name = f"case_{case_id.replace('-', '_')[:50]}"
        try:
            self.chroma_client.delete_collection(collection_name)
        except Exception as e:
            logger.warning(f"Could not delete collection for case {case_id}: {e}")
