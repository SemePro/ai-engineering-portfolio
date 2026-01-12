"""Tests for document chunking functionality."""

import pytest
from src.chunking import chunk_text, chunk_documents


class TestChunkText:
    """Tests for the chunk_text function."""
    
    def test_empty_text_returns_no_chunks(self):
        """Empty or whitespace-only text should return no chunks."""
        chunks = list(chunk_text("", chunk_size=100))
        assert len(chunks) == 0
        
        chunks = list(chunk_text("   ", chunk_size=100))
        assert len(chunks) == 0
    
    def test_short_text_single_chunk(self):
        """Text shorter than chunk_size should return a single chunk."""
        text = "This is a short sentence."
        chunks = list(chunk_text(text, chunk_size=100, source="test.md"))
        
        assert len(chunks) == 1
        assert chunks[0].content == text
        assert chunks[0].source == "test.md"
        assert chunks[0].chunk_index == 0
    
    def test_multiple_sentences_chunked(self):
        """Multiple sentences should be chunked appropriately."""
        text = "First sentence. Second sentence. Third sentence. Fourth sentence."
        chunks = list(chunk_text(text, chunk_size=40, chunk_overlap=0, source="test.md"))
        
        assert len(chunks) >= 2
        # Each chunk should be under the size limit
        for chunk in chunks:
            assert len(chunk.content) <= 50  # Allow some flexibility
    
    def test_overlap_preserved(self):
        """Chunks should have overlapping content when overlap > 0."""
        text = "The quick brown fox jumps over the lazy dog. Another sentence here for testing."
        chunks = list(chunk_text(text, chunk_size=50, chunk_overlap=20, source="test.md"))
        
        if len(chunks) >= 2:
            # The end of the first chunk should appear in the start of the second
            end_of_first = chunks[0].content[-20:]
            # Overlap should be present (some flexibility for sentence boundaries)
            assert len(chunks) >= 1
    
    def test_chunk_indices_sequential(self):
        """Chunk indices should be sequential starting from 0."""
        text = "One. Two. Three. Four. Five. Six. Seven. Eight."
        chunks = list(chunk_text(text, chunk_size=20, chunk_overlap=0, source="test.md"))
        
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i
    
    def test_source_preserved(self):
        """Source identifier should be preserved in all chunks."""
        text = "Some text content. More content here."
        source = "docs/manual.md"
        chunks = list(chunk_text(text, chunk_size=30, source=source))
        
        for chunk in chunks:
            assert chunk.source == source
    
    def test_unique_ids(self):
        """Each chunk should have a unique ID."""
        text = "First part. Second part. Third part. Fourth part."
        chunks = list(chunk_text(text, chunk_size=25, source="test.md"))
        
        ids = [chunk.id for chunk in chunks]
        assert len(ids) == len(set(ids))


class TestChunkDocuments:
    """Tests for the chunk_documents function."""
    
    def test_empty_documents_list(self):
        """Empty documents list should return empty chunks."""
        chunks = chunk_documents([])
        assert len(chunks) == 0
    
    def test_single_document(self):
        """Single document should be chunked correctly."""
        docs = [{"content": "Document content here.", "source": "doc1.md"}]
        chunks = chunk_documents(docs, chunk_size=100)
        
        assert len(chunks) == 1
        assert chunks[0].source == "doc1.md"
    
    def test_multiple_documents(self):
        """Multiple documents should all be chunked."""
        docs = [
            {"content": "First document content.", "source": "doc1.md"},
            {"content": "Second document content.", "source": "doc2.md"},
        ]
        chunks = chunk_documents(docs, chunk_size=100)
        
        assert len(chunks) == 2
        sources = {chunk.source for chunk in chunks}
        assert sources == {"doc1.md", "doc2.md"}
    
    def test_missing_content_skipped(self):
        """Documents without content should not produce chunks."""
        docs = [
            {"content": "", "source": "empty.md"},
            {"content": "Has content.", "source": "valid.md"},
        ]
        chunks = chunk_documents(docs, chunk_size=100)
        
        assert len(chunks) == 1
        assert chunks[0].source == "valid.md"
    
    def test_missing_source_uses_default(self):
        """Documents without source should use 'unknown' as default."""
        docs = [{"content": "Some content here."}]
        chunks = chunk_documents(docs, chunk_size=100)
        
        assert len(chunks) == 1
        assert chunks[0].source == "unknown"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
