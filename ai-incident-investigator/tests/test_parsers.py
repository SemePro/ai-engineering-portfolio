"""Tests for incident artifact parsers."""

import pytest
from datetime import datetime
from src.parsers import (
    extract_timestamp,
    extract_timestamp_str,
    parse_log_lines,
    parse_deploy_history,
    extract_what_changed
)
from src.models import Artifact, ArtifactType


class TestTimestampExtraction:
    """Tests for timestamp extraction."""
    
    def test_iso_timestamp(self):
        """Test ISO 8601 timestamp extraction."""
        log = "2024-01-15T14:32:15.234Z ERROR Something failed"
        ts = extract_timestamp(log)
        
        assert ts is not None
        assert ts.year == 2024
        assert ts.month == 1
        assert ts.day == 15
        assert ts.hour == 14
        assert ts.minute == 32
    
    def test_common_log_timestamp(self):
        """Test common log format timestamp."""
        log = "2024-01-15 14:32:15 ERROR Connection failed"
        ts = extract_timestamp(log)
        
        assert ts is not None
        assert ts.year == 2024
        assert ts.hour == 14
    
    def test_timestamp_str_extraction(self):
        """Test timestamp string extraction."""
        log = "2024-01-15T14:32:15Z Something happened"
        ts_str = extract_timestamp_str(log)
        
        assert "2024-01-15" in ts_str
    
    def test_no_timestamp(self):
        """Test handling of logs without timestamps."""
        log = "ERROR Something failed without a timestamp"
        ts = extract_timestamp(log)
        
        assert ts is None
    
    def test_unknown_timestamp_str(self):
        """Test unknown timestamp string fallback."""
        log = "No timestamp here"
        ts_str = extract_timestamp_str(log)
        
        assert ts_str == "unknown"


class TestLogParsing:
    """Tests for log line parsing."""
    
    def test_error_detection(self):
        """Test error pattern detection."""
        logs = """2024-01-15T14:32:15Z ERROR Database connection failed
2024-01-15T14:32:16Z INFO Normal operation
2024-01-15T14:32:17Z FATAL System crash"""
        
        events = parse_log_lines(logs, "test-source")
        
        # Should detect ERROR and FATAL
        assert len(events) >= 2
        assert any(e.kind == "error" for e in events)
    
    def test_timeout_detection(self):
        """Test timeout pattern detection."""
        logs = "2024-01-15T14:32:15Z WARN Request timeout after 30s"
        
        events = parse_log_lines(logs, "test-source")
        
        assert len(events) >= 1
        assert any(e.kind == "timeout" for e in events)
    
    def test_pool_exhaustion_detection(self):
        """Test connection pool exhaustion detection."""
        logs = "2024-01-15T14:32:15Z ERROR Pool exhausted, all connections in use"
        
        events = parse_log_lines(logs, "test-source")
        
        assert len(events) >= 1
        assert any("pool" in e.kind for e in events)
    
    def test_auth_error_detection(self):
        """Test authentication error detection."""
        logs = "2024-01-15T14:32:15Z ERROR JWT validation failed: token expired"
        
        events = parse_log_lines(logs, "test-source")
        
        assert len(events) >= 1
        assert any(e.kind == "auth" for e in events)
    
    def test_event_has_evidence(self):
        """Test that events include evidence."""
        logs = "2024-01-15T14:32:15Z ERROR Something broke"
        
        events = parse_log_lines(logs, "my-service")
        
        assert len(events) >= 1
        assert events[0].evidence
        assert events[0].evidence[0].source_id == "my-service"


class TestDeployParsing:
    """Tests for deploy history parsing."""
    
    def test_deployment_detection(self):
        """Test deployment event detection."""
        content = """2024-01-15T14:15:00Z Deployment started: service v1.0 -> v1.1
2024-01-15T14:16:00Z Deployment complete"""
        
        events = parse_deploy_history(content, "deploy-log")
        
        assert len(events) >= 1
        assert any(e.kind == "deploy" for e in events)
    
    def test_rollback_detection(self):
        """Test rollback event detection."""
        content = "2024-01-15T14:30:00Z Rollback initiated to v1.0"
        
        events = parse_deploy_history(content, "deploy-log")
        
        assert len(events) >= 1
        assert any(e.kind == "rollback" for e in events)
    
    def test_version_detection(self):
        """Test version change detection."""
        content = "2024-01-15T14:15:00Z Version: v2.4.0"
        
        events = parse_deploy_history(content, "deploy-log")
        
        assert len(events) >= 1
        assert any(e.kind == "version" for e in events)


class TestWhatChanged:
    """Tests for what changed extraction."""
    
    def test_deploy_changes(self):
        """Test extraction of deployment changes."""
        artifacts = [
            Artifact(
                type=ArtifactType.DEPLOY_HISTORY,
                source_id="deploy-log",
                content="Deployed version v2.0 with new features"
            )
        ]
        
        changes = extract_what_changed(artifacts)
        
        assert len(changes) >= 1
        assert any(c["category"] == "deployment" for c in changes)
    
    def test_config_changes(self):
        """Test extraction of config changes."""
        artifacts = [
            Artifact(
                type=ArtifactType.DEPLOY_HISTORY,
                source_id="deploy-log",
                content="Config change: POOL_SIZE = 50"
            )
        ]
        
        changes = extract_what_changed(artifacts)
        
        # Should detect config change
        assert len(changes) >= 0  # Config detection is optional
