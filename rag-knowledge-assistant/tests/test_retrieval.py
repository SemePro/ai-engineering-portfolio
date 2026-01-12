"""Tests for retrieval and strict mode behavior."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.models import AskRequest, DocumentChunk
from src.rag_engine import RAGEngine


class TestConfidenceCalculation:
    """Tests for confidence score calculation."""
    
    @pytest.fixture
    def mock_vector_store(self):
        """Create a mock vector store."""
        return Mock()
    
    @pytest.fixture
    def rag_engine(self, mock_vector_store):
        """Create a RAG engine with mocked dependencies."""
        with patch('src.rag_engine.OpenAI'):
            with patch('src.rag_engine.get_settings') as mock_settings:
                mock_settings.return_value = Mock(
                    openai_api_key="test-key",
                    openai_api_base="https://api.openai.com/v1",
                    chat_model="gpt-4o-mini",
                    top_k=5,
                    confidence_threshold=0.7
                )
                engine = RAGEngine(mock_vector_store)
                return engine
    
    def test_empty_scores_returns_zero(self, rag_engine):
        """Empty scores list should return 0 confidence."""
        confidence = rag_engine._calculate_confidence([])
        assert confidence == 0.0
    
    def test_single_high_score(self, rag_engine):
        """Single high score should return that score."""
        confidence = rag_engine._calculate_confidence([0.95])
        assert confidence == 0.95
    
    def test_weighted_average(self, rag_engine):
        """Multiple scores should use weighted average."""
        # First score has weight 1, second has weight 0.5
        # (0.9 * 1 + 0.6 * 0.5) / (1 + 0.5) = 1.2 / 1.5 = 0.8
        confidence = rag_engine._calculate_confidence([0.9, 0.6])
        assert 0.75 < confidence < 0.85  # Allow rounding tolerance


class TestStrictMode:
    """Tests for strict mode behavior."""
    
    @pytest.fixture
    def mock_vector_store(self):
        """Create a mock vector store."""
        store = Mock()
        store.search = Mock(return_value=([], []))
        store.get_citations = Mock(return_value=[])
        return store
    
    @pytest.fixture
    def rag_engine(self, mock_vector_store):
        """Create a RAG engine with mocked dependencies."""
        with patch('src.rag_engine.OpenAI'):
            with patch('src.rag_engine.get_settings') as mock_settings:
                mock_settings.return_value = Mock(
                    openai_api_key="test-key",
                    openai_api_base="https://api.openai.com/v1",
                    chat_model="gpt-4o-mini",
                    top_k=5,
                    confidence_threshold=0.7
                )
                engine = RAGEngine(mock_vector_store)
                return engine
    
    @pytest.mark.asyncio
    async def test_strict_mode_low_confidence_returns_fallback(self, rag_engine, mock_vector_store):
        """When strict_mode is on and confidence is low, return the fallback message."""
        # Setup low confidence retrieval
        mock_chunk = DocumentChunk(
            id="chunk1",
            content="Some content",
            source="test.md",
            chunk_index=0
        )
        mock_vector_store.search.return_value = ([mock_chunk], [0.3])  # Low score
        
        request = AskRequest(question="What is the policy?", strict_mode=True)
        response = await rag_engine.ask(request)
        
        assert response.strict_mode_triggered is True
        assert response.answer == RAGEngine.NO_ANSWER_RESPONSE
        assert len(response.citations) == 0
    
    @pytest.mark.asyncio
    async def test_strict_mode_high_confidence_returns_answer(self, rag_engine, mock_vector_store):
        """When strict_mode is on and confidence is high, return the generated answer."""
        # Setup high confidence retrieval
        mock_chunk = DocumentChunk(
            id="chunk1",
            content="The vacation policy allows 20 days off.",
            source="hr-policy.md",
            chunk_index=0
        )
        mock_vector_store.search.return_value = ([mock_chunk], [0.95])
        mock_vector_store.get_citations.return_value = []
        
        # Mock the LLM response
        rag_engine._generate_answer = Mock(return_value="You get 20 days vacation.")
        
        request = AskRequest(question="What is the vacation policy?", strict_mode=True)
        response = await rag_engine.ask(request)
        
        assert response.strict_mode_triggered is False
        assert response.answer == "You get 20 days vacation."
    
    @pytest.mark.asyncio
    async def test_no_strict_mode_low_confidence_still_answers(self, rag_engine, mock_vector_store):
        """When strict_mode is off, answer even with low confidence."""
        mock_chunk = DocumentChunk(
            id="chunk1",
            content="Some vague content",
            source="test.md",
            chunk_index=0
        )
        mock_vector_store.search.return_value = ([mock_chunk], [0.3])
        mock_vector_store.get_citations.return_value = []
        
        # Mock the LLM response
        rag_engine._generate_answer = Mock(return_value="Best guess answer.")
        
        request = AskRequest(question="What is something?", strict_mode=False)
        response = await rag_engine.ask(request)
        
        assert response.strict_mode_triggered is False
        assert response.answer == "Best guess answer."


class TestContextBuilding:
    """Tests for context string building."""
    
    @pytest.fixture
    def rag_engine(self):
        """Create a RAG engine with mocked dependencies."""
        with patch('src.rag_engine.OpenAI'):
            with patch('src.rag_engine.get_settings') as mock_settings:
                mock_settings.return_value = Mock(
                    openai_api_key="test-key",
                    openai_api_base="https://api.openai.com/v1",
                    chat_model="gpt-4o-mini",
                    top_k=5,
                    confidence_threshold=0.7
                )
                engine = RAGEngine(Mock())
                return engine
    
    def test_context_includes_source(self, rag_engine):
        """Context string should include source information."""
        chunks = [
            DocumentChunk(id="1", content="Content 1", source="doc1.md", chunk_index=0),
            DocumentChunk(id="2", content="Content 2", source="doc2.md", chunk_index=0),
        ]
        context = rag_engine._build_context(chunks, [0.9, 0.8])
        
        assert "doc1.md" in context
        assert "doc2.md" in context
        assert "Content 1" in context
        assert "Content 2" in context


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
