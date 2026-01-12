"""Tests for case storage."""

import pytest
import tempfile
import shutil
from pathlib import Path

from src.case_store import CaseStore
from src.models import IngestRequest, Artifact, ArtifactType, CaseStatus


@pytest.fixture
def temp_cases_dir():
    """Create a temporary directory for test cases."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def case_store(temp_cases_dir):
    """Create a CaseStore with temporary directory."""
    return CaseStore(cases_dir=temp_cases_dir)


@pytest.fixture
def sample_request():
    """Create a sample ingest request."""
    return IngestRequest(
        title="Test Incident",
        incident_summary="This is a test incident for unit testing purposes.",
        artifacts=[
            Artifact(
                type=ArtifactType.LOGS,
                source_id="test-service",
                content="2024-01-15T14:32:15Z ERROR Test error occurred"
            )
        ]
    )


class TestCaseStore:
    """Tests for CaseStore."""
    
    def test_create_case(self, case_store, sample_request):
        """Test case creation."""
        case_id = case_store.create_case(sample_request)
        
        assert case_id is not None
        assert len(case_id) == 36  # UUID format
    
    def test_case_exists(self, case_store, sample_request):
        """Test case existence check."""
        case_id = case_store.create_case(sample_request)
        
        assert case_store.case_exists(case_id) is True
        assert case_store.case_exists("nonexistent-id") is False
    
    def test_get_case(self, case_store, sample_request):
        """Test retrieving a case."""
        case_id = case_store.create_case(sample_request)
        
        case = case_store.get_case(case_id)
        
        assert case is not None
        assert case.case_id == case_id
        assert case.title == "Test Incident"
        assert case.status == CaseStatus.CREATED
        assert len(case.artifacts) == 1
    
    def test_get_nonexistent_case(self, case_store):
        """Test retrieving a nonexistent case."""
        case = case_store.get_case("nonexistent-id")
        
        assert case is None
    
    def test_update_status(self, case_store, sample_request):
        """Test status update."""
        case_id = case_store.create_case(sample_request)
        case_store.update_status(case_id, CaseStatus.INGESTED)
        
        case = case_store.get_case(case_id)
        
        assert case.status == CaseStatus.INGESTED
    
    def test_list_cases(self, case_store, sample_request):
        """Test listing cases."""
        # Create multiple cases
        case_store.create_case(sample_request)
        
        sample_request2 = IngestRequest(
            title="Second Incident",
            incident_summary="Another test incident.",
            artifacts=[
                Artifact(
                    type=ArtifactType.ALERTS,
                    source_id="alerting",
                    content="Alert triggered"
                )
            ]
        )
        case_store.create_case(sample_request2)
        
        cases = case_store.list_cases()
        
        assert len(cases) == 2
        assert all(c.artifact_count >= 1 for c in cases)
    
    def test_get_artifacts(self, case_store, sample_request):
        """Test getting artifacts for a case."""
        case_id = case_store.create_case(sample_request)
        
        artifacts = case_store.get_artifacts(case_id)
        
        assert len(artifacts) == 1
        assert artifacts[0].type == ArtifactType.LOGS
        assert artifacts[0].source_id == "test-service"
    
    def test_cases_sorted_by_created_at(self, case_store):
        """Test that cases are sorted by creation time."""
        # Create cases
        req1 = IngestRequest(
            title="First",
            incident_summary="First incident.",
            artifacts=[Artifact(type=ArtifactType.LOGS, source_id="s1", content="log1")]
        )
        req2 = IngestRequest(
            title="Second",
            incident_summary="Second incident.",
            artifacts=[Artifact(type=ArtifactType.LOGS, source_id="s2", content="log2")]
        )
        
        case_store.create_case(req1)
        case_store.create_case(req2)
        
        cases = case_store.list_cases()
        
        # Most recent should be first
        assert cases[0].title == "Second"
