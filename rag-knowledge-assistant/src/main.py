"""
FastAPI application for RAG Knowledge Assistant.

This service provides enterprise-style knowledge retrieval with:
- Document chunking and embedding
- Vector similarity search
- LLM-powered answers with citations
- Strict mode for confident answers only
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import (
    IngestRequest,
    IngestResponse,
    AskRequest,
    AskResponse,
    SourcesResponse,
    SourceDocument
)
from .chunking import chunk_documents
from .vector_store import VectorStore
from .rag_engine import RAGEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global instances
vector_store: VectorStore | None = None
rag_engine: RAGEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    global vector_store, rag_engine
    
    logger.info("Initializing RAG Knowledge Assistant...")
    settings = get_settings()
    
    vector_store = VectorStore()
    rag_engine = RAGEngine(vector_store)
    
    logger.info(f"RAG engine initialized with model: {settings.chat_model}")
    logger.info(f"Vector store has {vector_store.get_total_chunks()} chunks")
    
    yield
    
    logger.info("Shutting down RAG Knowledge Assistant...")


app = FastAPI(
    title="RAG Knowledge Assistant",
    description="Enterprise-style internal knowledge assistant with RAG capabilities",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors gracefully without leaking internals."""
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again later.",
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "rag-knowledge-assistant",
        "chunks_indexed": vector_store.get_total_chunks() if vector_store else 0
    }


@app.post("/ingest", response_model=IngestResponse)
async def ingest_documents(request: IngestRequest):
    """
    Ingest documents into the knowledge base.
    
    Documents are chunked and embedded for later retrieval.
    """
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    
    settings = get_settings()
    
    try:
        # Chunk documents
        chunks = chunk_documents(
            documents=request.documents,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap
        )
        
        if not chunks:
            return IngestResponse(
                success=True,
                chunks_created=0,
                documents_processed=len(request.documents),
                message="No content to index"
            )
        
        # Add to vector store
        chunks_added = vector_store.add_chunks(chunks)
        
        logger.info(
            f"Ingested {len(request.documents)} documents, "
            f"created {chunks_added} chunks"
        )
        
        return IngestResponse(
            success=True,
            chunks_created=chunks_added,
            documents_processed=len(request.documents),
            message=f"Successfully indexed {chunks_added} chunks from {len(request.documents)} documents"
        )
        
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    """
    Ask a question against the knowledge base.
    
    Uses RAG to retrieve relevant context and generate an answer.
    If strict_mode is enabled and confidence is low, returns a safe response.
    """
    if not rag_engine:
        raise HTTPException(status_code=503, detail="RAG engine not initialized")
    
    try:
        response = await rag_engine.ask(request)
        logger.info(
            f"Answered question (confidence: {response.confidence_score}, "
            f"strict_mode_triggered: {response.strict_mode_triggered})"
        )
        return response
        
    except Exception as e:
        logger.error(f"Ask error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sources", response_model=SourcesResponse)
async def list_sources():
    """
    List all sources in the knowledge base.
    
    Returns information about indexed documents and chunk counts.
    """
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    
    try:
        sources_dict = vector_store.get_all_sources()
        sources = [
            SourceDocument(source=source, chunk_count=count)
            for source, count in sources_dict.items()
        ]
        
        return SourcesResponse(
            sources=sources,
            total_chunks=vector_store.get_total_chunks(),
            total_documents=len(sources)
        )
        
    except Exception as e:
        logger.error(f"Sources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)
