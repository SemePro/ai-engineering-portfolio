"""Document chunking utilities."""

import re
import uuid
from typing import Generator
from .models import DocumentChunk


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    source: str = "unknown"
) -> Generator[DocumentChunk, None, None]:
    """
    Split text into overlapping chunks.
    
    Uses sentence-aware splitting to avoid breaking mid-sentence when possible.
    
    Args:
        text: The text to chunk
        chunk_size: Target size for each chunk in characters
        chunk_overlap: Number of characters to overlap between chunks
        source: Source identifier for the document
        
    Yields:
        DocumentChunk objects
    """
    if not text or not text.strip():
        return
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    
    # Split into sentences (simple heuristic)
    sentence_endings = re.compile(r'(?<=[.!?])\s+')
    sentences = sentence_endings.split(text)
    
    current_chunk = ""
    chunk_index = 0
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # If adding this sentence would exceed chunk_size
        if len(current_chunk) + len(sentence) + 1 > chunk_size:
            if current_chunk:
                yield DocumentChunk(
                    id=f"{source}_{chunk_index}_{uuid.uuid4().hex[:8]}",
                    content=current_chunk.strip(),
                    source=source,
                    chunk_index=chunk_index
                )
                chunk_index += 1
                
                # Keep overlap from the end of current chunk
                if chunk_overlap > 0:
                    overlap_text = current_chunk[-chunk_overlap:].strip()
                    current_chunk = overlap_text + " " + sentence
                else:
                    current_chunk = sentence
            else:
                # Sentence is longer than chunk_size, force split
                words = sentence.split()
                temp_chunk = ""
                for word in words:
                    if len(temp_chunk) + len(word) + 1 > chunk_size:
                        if temp_chunk:
                            yield DocumentChunk(
                                id=f"{source}_{chunk_index}_{uuid.uuid4().hex[:8]}",
                                content=temp_chunk.strip(),
                                source=source,
                                chunk_index=chunk_index
                            )
                            chunk_index += 1
                        temp_chunk = word
                    else:
                        temp_chunk = f"{temp_chunk} {word}".strip()
                current_chunk = temp_chunk
        else:
            current_chunk = f"{current_chunk} {sentence}".strip()
    
    # Don't forget the last chunk
    if current_chunk.strip():
        yield DocumentChunk(
            id=f"{source}_{chunk_index}_{uuid.uuid4().hex[:8]}",
            content=current_chunk.strip(),
            source=source,
            chunk_index=chunk_index
        )


def chunk_documents(
    documents: list[dict],
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> list[DocumentChunk]:
    """
    Chunk multiple documents.
    
    Args:
        documents: List of dicts with 'content' and 'source' keys
        chunk_size: Target size for each chunk
        chunk_overlap: Overlap between chunks
        
    Returns:
        List of all DocumentChunk objects
    """
    all_chunks = []
    
    for doc in documents:
        content = doc.get("content", "")
        source = doc.get("source", "unknown")
        
        chunks = list(chunk_text(
            text=content,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            source=source
        ))
        all_chunks.extend(chunks)
    
    return all_chunks
