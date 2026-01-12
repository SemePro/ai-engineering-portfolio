"""Tests for the change store."""

import pytest
import tempfile
import shutil
from pathlib import Path

from src.change_store import ChangeStore
from src.models import IngestChangeRequest, ChangeMetadata, ChangeType, ChangeStatus


class TestChangeStore:
    """Test suite for ChangeStore."""
    
    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for test storage."""
        temp_path = tempfile.mkdtemp()
        yield temp_path
        shutil.rmtree(temp_path)
    
    @pytest.fixture
    def store(self, temp_dir):
        """Create a ChangeStore instance with temporary storage."""
        return ChangeStore(changes_dir=temp_dir)
    
    @pytest.fixture
    def sample_request(self):
        """Create a sample ingest request."""
        return IngestChangeRequest(
            change_type=ChangeType.DEPLOY,
            service="order-service",
            version="v2.4.0",
            metadata=ChangeMetadata(
                commit_sha="abc123",
                author="engineer@company.com",
                env="production"
            ),
            diff_summary="Added new product recommendations feature",
            description="Deploy new recommendation engine"
        )
    
    def test_create_change(self, store, sample_request):
        """Test creating a new change."""
        change_id = store.create_change(sample_request)
        
        assert change_id is not None
        assert len(change_id) > 0
        assert store.change_exists(change_id)
    
    def test_get_change(self, store, sample_request):
        """Test retrieving a change."""
        change_id = store.create_change(sample_request)
        change = store.get_change(change_id)
        
        assert change is not None
        assert change.change_id == change_id
        assert change.service == "order-service"
        assert change.change_type == "deploy"
        assert change.status == ChangeStatus.PENDING
    
    def test_update_status(self, store, sample_request):
        """Test updating change status."""
        change_id = store.create_change(sample_request)
        store.update_status(change_id, ChangeStatus.ANALYZED)
        
        change = store.get_change(change_id)
        assert change.status == ChangeStatus.ANALYZED
    
    def test_list_changes(self, store, sample_request):
        """Test listing changes."""
        # Create multiple changes
        store.create_change(sample_request)
        store.create_change(sample_request)
        
        changes = store.list_changes()
        assert len(changes) == 2
    
    def test_list_changes_filter_service(self, store, sample_request):
        """Test filtering changes by service."""
        store.create_change(sample_request)
        
        # Create another change for a different service
        other_request = IngestChangeRequest(
            change_type=ChangeType.CONFIG,
            service="api-gateway",
            diff_summary="Timeout changes"
        )
        store.create_change(other_request)
        
        changes = store.list_changes(service="order-service")
        assert len(changes) == 1
        assert changes[0].service == "order-service"
    
    def test_change_not_found(self, store):
        """Test getting a non-existent change."""
        change = store.get_change("non-existent-id")
        assert change is None
    
    def test_get_service_changes(self, store, sample_request):
        """Test getting recent changes for a service."""
        store.create_change(sample_request)
        store.create_change(sample_request)
        
        changes = store.get_service_changes("order-service")
        assert len(changes) == 2
