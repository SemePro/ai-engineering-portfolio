"""Change storage and management."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
import logging

from .config import get_settings
from .models import (
    ChangeStatus, ChangeSummary, ChangeDetail, Change,
    AnalyzeChangeResponse, IngestChangeRequest, ChangeMetadata
)

logger = logging.getLogger(__name__)


class ChangeStore:
    """Manages change persistence using JSON files."""
    
    def __init__(self, changes_dir: Optional[str] = None):
        settings = get_settings()
        self.changes_dir = Path(changes_dir or settings.changes_directory)
        self.changes_dir.mkdir(parents=True, exist_ok=True)
    
    def _change_path(self, change_id: str) -> Path:
        return self.changes_dir / f"{change_id}.json"
    
    def create_change(self, request: IngestChangeRequest) -> str:
        """Create a new change and return its ID."""
        change_id = str(uuid.uuid4())
        
        change_data = {
            "change_id": change_id,
            "service": request.service,
            "change_type": request.change_type.value,
            "version": request.version,
            "status": ChangeStatus.PENDING.value,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": request.metadata.model_dump(),
            "diff_summary": request.diff_summary,
            "description": request.description,
            "related_incidents": request.related_incidents,
            "last_assessment": None,
            "assessment_history": []
        }
        
        with open(self._change_path(change_id), 'w') as f:
            json.dump(change_data, f, indent=2, default=str)
        
        logger.info(f"Created change {change_id}: {request.service} {request.change_type.value}")
        return change_id
    
    def update_status(self, change_id: str, status: ChangeStatus) -> None:
        """Update change status."""
        change_data = self._load_change(change_id)
        if change_data:
            change_data["status"] = status.value
            self._save_change(change_id, change_data)
    
    def save_assessment(self, change_id: str, assessment: AnalyzeChangeResponse) -> None:
        """Save assessment results to a change."""
        change_data = self._load_change(change_id)
        if change_data:
            change_data["status"] = ChangeStatus.ANALYZED.value
            change_data["last_assessment"] = assessment.model_dump(mode='json')
            change_data["last_assessment_at"] = datetime.utcnow().isoformat()
            
            # Keep history
            if "assessment_history" not in change_data:
                change_data["assessment_history"] = []
            change_data["assessment_history"].append({
                "timestamp": datetime.utcnow().isoformat(),
                "risk_score": assessment.assessment.risk_score,
                "risk_level": assessment.assessment.risk_level.value,
                "recommendation": assessment.assessment.rollout_recommendation.value
            })
            
            self._save_change(change_id, change_data)
            logger.info(f"Saved assessment for change {change_id}")
    
    def get_change(self, change_id: str) -> Optional[ChangeDetail]:
        """Get full change details."""
        change_data = self._load_change(change_id)
        if not change_data:
            return None
        
        last_assessment = None
        if change_data.get("last_assessment"):
            last_assessment = AnalyzeChangeResponse(**change_data["last_assessment"])
        
        return ChangeDetail(
            change_id=change_data["change_id"],
            service=change_data["service"],
            change_type=change_data["change_type"],
            version=change_data.get("version"),
            status=ChangeStatus(change_data["status"]),
            created_at=datetime.fromisoformat(change_data["created_at"]),
            metadata=ChangeMetadata(**change_data.get("metadata", {})),
            diff_summary=change_data.get("diff_summary", ""),
            related_incidents=change_data.get("related_incidents", []),
            last_assessment=last_assessment
        )
    
    def list_changes(self, service: Optional[str] = None, risk_level: Optional[str] = None) -> list[ChangeSummary]:
        """List all changes with optional filters."""
        changes = []
        
        for change_file in self.changes_dir.glob("*.json"):
            try:
                with open(change_file, 'r') as f:
                    change_data = json.load(f)
                
                # Apply filters
                if service and change_data.get("service") != service:
                    continue
                
                last_risk_level = None
                last_risk_score = None
                if change_data.get("last_assessment"):
                    assessment = change_data["last_assessment"].get("assessment", {})
                    last_risk_level = assessment.get("risk_level")
                    last_risk_score = assessment.get("risk_score")
                    
                    if risk_level and last_risk_level != risk_level:
                        continue
                
                changes.append(ChangeSummary(
                    change_id=change_data["change_id"],
                    service=change_data["service"],
                    change_type=change_data["change_type"],
                    version=change_data.get("version"),
                    status=ChangeStatus(change_data["status"]),
                    created_at=datetime.fromisoformat(change_data["created_at"]),
                    risk_level=last_risk_level,
                    risk_score=last_risk_score
                ))
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Error loading change {change_file}: {e}")
                continue
        
        # Sort by created_at descending
        changes.sort(key=lambda x: x.created_at, reverse=True)
        return changes
    
    def change_exists(self, change_id: str) -> bool:
        """Check if a change exists."""
        return self._change_path(change_id).exists()
    
    def get_service_changes(self, service: str, limit: int = 10) -> list[dict]:
        """Get recent changes for a service."""
        changes = []
        for change_file in self.changes_dir.glob("*.json"):
            try:
                with open(change_file, 'r') as f:
                    change_data = json.load(f)
                if change_data.get("service") == service:
                    changes.append(change_data)
            except (json.JSONDecodeError, KeyError):
                continue
        
        # Sort by created_at and limit
        changes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return changes[:limit]
    
    def _load_change(self, change_id: str) -> Optional[dict]:
        """Load change data from file."""
        path = self._change_path(change_id)
        if not path.exists():
            return None
        
        with open(path, 'r') as f:
            return json.load(f)
    
    def _save_change(self, change_id: str, change_data: dict) -> None:
        """Save change data to file."""
        with open(self._change_path(change_id), 'w') as f:
            json.dump(change_data, f, indent=2, default=str)
