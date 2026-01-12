"""Pydantic models for request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentChunk(BaseModel):
    """A chunk of a document with metadata."""
    
    id: str
    content: str
    source: str
    chunk_index: int
    metadata: dict = Field(default_factory=dict)


class IngestRequest(BaseModel):
    """Request to ingest documents."""
    
    documents: list[dict] = Field(
        ...,
        description="List of documents with 'content' and 'source' fields"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "documents": [
                    {
                        "content": "This is the document content...",
                        "source": "internal-wiki/onboarding.md"
                    }
                ]
            }
        }


class IngestResponse(BaseModel):
    """Response from document ingestion."""
    
    success: bool
    chunks_created: int
    documents_processed: int
    message: str


class AskRequest(BaseModel):
    """Request to ask a question."""
    
    question: str = Field(..., min_length=1, max_length=1000)
    strict_mode: bool = Field(
        default=True,
        description="If true, returns 'I don't know' when confidence is low"
    )
    top_k: Optional[int] = Field(
        default=None,
        description="Number of chunks to retrieve (overrides default)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "question": "What is the company's vacation policy?",
                "strict_mode": True
            }
        }


class Citation(BaseModel):
    """A citation reference to source material."""
    
    source: str
    chunk_id: str
    relevance_score: float
    excerpt: str


class AskResponse(BaseModel):
    """Response from asking a question."""
    
    answer: str
    citations: list[Citation]
    confidence_score: float
    strict_mode_triggered: bool = False
    retrieved_chunks: int
    processing_time_ms: float


class SourceDocument(BaseModel):
    """A source document in the knowledge base."""
    
    source: str
    chunk_count: int
    ingested_at: Optional[datetime] = None


class SourcesResponse(BaseModel):
    """Response listing all sources."""
    
    sources: list[SourceDocument]
    total_chunks: int
    total_documents: int
