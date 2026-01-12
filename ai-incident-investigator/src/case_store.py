"""Case storage and management."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
import logging

from .config import get_settings
from .models import (
    CaseStatus, CaseSummary, CaseDetail, Artifact, 
    AnalyzeResponse, IngestRequest, FeedbackRequest, FeedbackRecord, FeedbackType
)

logger = logging.getLogger(__name__)


class CaseStore:
    """Manages case persistence using JSON files."""
    
    def __init__(self, cases_dir: Optional[str] = None):
        settings = get_settings()
        self.cases_dir = Path(cases_dir or settings.cases_directory)
        self.cases_dir.mkdir(parents=True, exist_ok=True)
    
    def _case_path(self, case_id: str) -> Path:
        return self.cases_dir / f"{case_id}.json"
    
    def create_case(self, request: IngestRequest) -> str:
        """Create a new case and return its ID."""
        case_id = str(uuid.uuid4())
        
        case_data = {
            "case_id": case_id,
            "title": request.title,
            "incident_summary": request.incident_summary,
            "status": CaseStatus.CREATED.value,
            "created_at": datetime.utcnow().isoformat(),
            "artifacts": [a.model_dump(mode='json') for a in request.artifacts],
            "last_analysis": None,
            "analysis_history": []
        }
        
        with open(self._case_path(case_id), 'w') as f:
            json.dump(case_data, f, indent=2, default=str)
        
        logger.info(f"Created case {case_id}: {request.title}")
        return case_id
    
    def update_status(self, case_id: str, status: CaseStatus) -> None:
        """Update case status."""
        case_data = self._load_case(case_id)
        if case_data:
            case_data["status"] = status.value
            self._save_case(case_id, case_data)
    
    def save_analysis(self, case_id: str, analysis: AnalyzeResponse) -> None:
        """Save analysis results to a case."""
        case_data = self._load_case(case_id)
        if case_data:
            case_data["status"] = CaseStatus.ANALYZED.value
            case_data["last_analysis"] = analysis.model_dump(mode='json')
            case_data["last_analysis_at"] = datetime.utcnow().isoformat()
            
            # Keep history
            if "analysis_history" not in case_data:
                case_data["analysis_history"] = []
            case_data["analysis_history"].append({
                "timestamp": datetime.utcnow().isoformat(),
                "confidence": analysis.confidence_overall,
                "hypothesis_count": len(analysis.hypotheses),
                "refusal": analysis.refusal_reason is not None
            })
            
            self._save_case(case_id, case_data)
            logger.info(f"Saved analysis for case {case_id}")
    
    def get_case(self, case_id: str) -> Optional[CaseDetail]:
        """Get full case details."""
        case_data = self._load_case(case_id)
        if not case_data:
            return None
        
        artifacts = [Artifact(**a) for a in case_data.get("artifacts", [])]
        
        last_analysis = None
        if case_data.get("last_analysis"):
            last_analysis = AnalyzeResponse(**case_data["last_analysis"])
        
        return CaseDetail(
            case_id=case_data["case_id"],
            title=case_data["title"],
            incident_summary=case_data["incident_summary"],
            status=CaseStatus(case_data["status"]),
            created_at=datetime.fromisoformat(case_data["created_at"]),
            artifacts=artifacts,
            last_analysis=last_analysis
        )
    
    def list_cases(self) -> list[CaseSummary]:
        """List all cases."""
        cases = []
        
        for case_file in self.cases_dir.glob("*.json"):
            try:
                with open(case_file, 'r') as f:
                    case_data = json.load(f)
                
                last_analysis_at = None
                confidence = None
                if case_data.get("last_analysis_at"):
                    last_analysis_at = datetime.fromisoformat(case_data["last_analysis_at"])
                if case_data.get("last_analysis"):
                    confidence = case_data["last_analysis"].get("confidence_overall")
                
                cases.append(CaseSummary(
                    case_id=case_data["case_id"],
                    title=case_data["title"],
                    status=CaseStatus(case_data["status"]),
                    created_at=datetime.fromisoformat(case_data["created_at"]),
                    artifact_count=len(case_data.get("artifacts", [])),
                    last_analysis=last_analysis_at,
                    confidence_overall=confidence
                ))
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Error loading case {case_file}: {e}")
                continue
        
        # Sort by created_at descending
        cases.sort(key=lambda x: x.created_at, reverse=True)
        return cases
    
    def case_exists(self, case_id: str) -> bool:
        """Check if a case exists."""
        return self._case_path(case_id).exists()
    
    def get_artifacts(self, case_id: str) -> list[Artifact]:
        """Get artifacts for a case."""
        case_data = self._load_case(case_id)
        if not case_data:
            return []
        return [Artifact(**a) for a in case_data.get("artifacts", [])]
    
    def _load_case(self, case_id: str) -> Optional[dict]:
        """Load case data from file."""
        path = self._case_path(case_id)
        if not path.exists():
            return None
        
        with open(path, 'r') as f:
            return json.load(f)
    
    def _save_case(self, case_id: str, case_data: dict) -> None:
        """Save case data to file."""
        with open(self._case_path(case_id), 'w') as f:
            json.dump(case_data, f, indent=2, default=str)
    
    # ============== FEEDBACK METHODS ==============
    
    def add_feedback(self, case_id: str, request: FeedbackRequest) -> Optional[FeedbackRecord]:
        """Add human feedback on a hypothesis."""
        case_data = self._load_case(case_id)
        if not case_data:
            return None
        
        # Get hypothesis title if available
        hypothesis_title = f"Hypothesis #{request.hypothesis_rank}"
        if case_data.get("last_analysis"):
            hyps = case_data["last_analysis"].get("hypotheses", [])
            for h in hyps:
                if h.get("rank") == request.hypothesis_rank:
                    hypothesis_title = h.get("title", hypothesis_title)
                    break
        
        feedback_record = FeedbackRecord(
            hypothesis_rank=request.hypothesis_rank,
            hypothesis_title=hypothesis_title,
            feedback_type=request.feedback_type,
            reviewer_note=request.reviewer_note,
            timestamp=datetime.utcnow()
        )
        
        # Initialize feedback list if needed
        if "feedback" not in case_data:
            case_data["feedback"] = []
        
        case_data["feedback"].append(feedback_record.model_dump(mode='json'))
        self._save_case(case_id, case_data)
        
        logger.info(f"Added feedback for case {case_id}: hypothesis #{request.hypothesis_rank} - {request.feedback_type.value}")
        return feedback_record
    
    def get_feedback(self, case_id: str) -> list[FeedbackRecord]:
        """Get all feedback for a case."""
        case_data = self._load_case(case_id)
        if not case_data:
            return []
        
        return [
            FeedbackRecord(**f) 
            for f in case_data.get("feedback", [])
        ]
    
    def get_hypothesis_feedback(self, case_id: str, hypothesis_rank: int) -> Optional[FeedbackRecord]:
        """Get the latest feedback for a specific hypothesis."""
        feedback_list = self.get_feedback(case_id)
        for feedback in reversed(feedback_list):
            if feedback.hypothesis_rank == hypothesis_rank:
                return feedback
        return None
