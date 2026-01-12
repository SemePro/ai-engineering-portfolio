"""Core risk analysis engine."""

import json
import logging
from datetime import datetime
from typing import Optional
from openai import OpenAI
import httpx

from .config import get_settings
from .models import (
    AnalyzeChangeRequest, AnalyzeChangeResponse, RiskAssessment,
    RiskLevel, RolloutRecommendation, ContributingFactor, Evidence,
    SimilarIncident, ChangeDetail
)
from .vector_store import DevOpsVectorStore
from .change_store import ChangeStore

logger = logging.getLogger(__name__)


RISK_ANALYSIS_SYSTEM_PROMPT = """You are an expert DevOps/SRE engineer performing change risk assessment.

STRICT RULES:
1. Produce ONLY valid JSON matching the schema exactly
2. EVERY risk claim must cite evidence from the provided context
3. If evidence is insufficient, set refusal_reason and provide minimal assessment
4. No speculation without historical or contextual grounding
5. Explicitly list unknowns that affect confidence
6. Be conservative - when in doubt, recommend human review

RISK SCORING:
- 0.0-0.3: Low risk - routine changes with no historical issues
- 0.3-0.6: Medium risk - changes in areas with some past incidents
- 0.6-0.8: High risk - similar changes caused past failures
- 0.8-1.0: Critical risk - high probability of impact based on evidence

ROLLOUT RECOMMENDATIONS:
- safe_to_deploy: Low risk, proceed normally
- canary_recommended: Medium risk, deploy to small subset first
- feature_flag_first: Can be toggled off quickly
- needs_human_review: Requires SRE/on-call approval
- pause_deployment: Critical risk, do not proceed

OUTPUT SCHEMA:
{
  "risk_score": 0.0-1.0,
  "risk_level": "low|medium|high|critical",
  "contributing_factors": [
    {
      "factor": "Factor name",
      "impact": "high|medium|low",
      "description": "Why this increases risk",
      "evidence_indices": [0, 1]
    }
  ],
  "blast_radius": ["service1", "service2"],
  "change_velocity": "high|medium|low",
  "rollout_recommendation": "safe_to_deploy|canary_recommended|...",
  "confidence": 0.0-1.0,
  "unknowns": ["Unknown factor 1", "Unknown factor 2"],
  "refusal_reason": null or "Explanation"
}"""


class RiskAnalyzer:
    """Analyzes change risk using historical data and LLM."""
    
    def __init__(self, vector_store: DevOpsVectorStore, change_store: ChangeStore):
        self.vector_store = vector_store
        self.change_store = change_store
        self.settings = get_settings()
        
        self.openai_client = OpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_api_base
        )
    
    async def analyze(
        self,
        change: ChangeDetail,
        request: AnalyzeChangeRequest
    ) -> AnalyzeChangeResponse:
        """Perform full risk analysis on a change."""
        
        # Step 1: Search for similar past changes
        similar_changes = self.vector_store.search_similar_changes(
            query=f"{change.service} {change.change_type} {change.diff_summary}",
            service=change.service,
            top_k=self.settings.default_top_k,
            exclude_change_id=change.change_id
        )
        
        # Step 2: Get service change velocity
        recent_changes = self.change_store.get_service_changes(change.service, limit=20)
        change_velocity = self._calculate_velocity(recent_changes)
        
        # Step 3: Fetch similar incidents from Incident Investigator
        similar_incidents = await self._fetch_similar_incidents(change)
        
        # Step 4: Build evidence context
        all_evidence = similar_changes + [
            Evidence(
                source=f"incident:{inc.case_id}",
                excerpt=f"Incident: {inc.title}. Root cause: {inc.root_cause or 'Unknown'}",
                relevance=inc.similarity_score,
                source_type="incident"
            )
            for inc in similar_incidents
        ]
        
        # Step 5: Check if we have enough evidence
        avg_relevance = sum(e.relevance for e in all_evidence) / len(all_evidence) if all_evidence else 0
        
        if request.strict_mode and (len(all_evidence) < 2 or avg_relevance < self.settings.confidence_threshold):
            return AnalyzeChangeResponse(
                change_id=change.change_id,
                service=change.service,
                change_type=change.change_type,
                assessment=RiskAssessment(
                    risk_score=0.5,  # Neutral when unknown
                    risk_level=RiskLevel.MEDIUM,
                    contributing_factors=[],
                    similar_past_incidents=similar_incidents,
                    rollout_recommendation=RolloutRecommendation.NEEDS_HUMAN_REVIEW,
                    confidence=avg_relevance,
                    refusal_reason="Insufficient historical data to assess risk. No similar changes or incidents found. Human review recommended.",
                    unknowns=[
                        "No historical changes for this service",
                        "No similar incidents in database",
                        "Unable to determine blast radius"
                    ]
                ),
                blast_radius=[change.service],
                change_velocity=change_velocity,
                analysis_metadata={
                    "evidence_count": len(all_evidence),
                    "avg_relevance": round(avg_relevance, 4),
                    "strict_mode": True
                }
            )
        
        # Step 6: Generate risk assessment with LLM
        llm_result = self._generate_assessment(
            change=change,
            evidence=all_evidence,
            similar_incidents=similar_incidents,
            change_velocity=change_velocity,
            request=request
        )
        
        # Step 7: Build response
        assessment = self._build_assessment(llm_result, all_evidence, similar_incidents)
        
        return AnalyzeChangeResponse(
            change_id=change.change_id,
            service=change.service,
            change_type=change.change_type,
            assessment=assessment,
            blast_radius=llm_result.get("blast_radius", [change.service]),
            change_velocity=llm_result.get("change_velocity", change_velocity),
            analysis_metadata={
                "evidence_count": len(all_evidence),
                "avg_relevance": round(avg_relevance, 4),
                "strict_mode": request.strict_mode,
                "model": self.settings.chat_model
            }
        )
    
    def _calculate_velocity(self, recent_changes: list[dict]) -> str:
        """Calculate change velocity for a service."""
        if len(recent_changes) >= 10:
            return "high"
        elif len(recent_changes) >= 5:
            return "medium"
        else:
            return "low"
    
    async def _fetch_similar_incidents(self, change: ChangeDetail) -> list[SimilarIncident]:
        """Fetch similar incidents from Incident Investigator service."""
        similar = []
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.settings.incident_service_url}/cases"
                )
                if response.status_code == 200:
                    data = response.json()
                    cases = data.get("cases", [])
                    
                    # Simple keyword matching for now
                    service_lower = change.service.lower()
                    diff_lower = change.diff_summary.lower()
                    
                    for case in cases[:20]:
                        title_lower = case.get("title", "").lower()
                        
                        # Check if incident might be related
                        if (service_lower in title_lower or
                            "database" in diff_lower and "db" in title_lower or
                            "connection" in diff_lower and "connection" in title_lower or
                            "pool" in diff_lower and "pool" in title_lower or
                            "auth" in diff_lower and "auth" in title_lower):
                            
                            # Fetch full case for root cause
                            try:
                                case_response = await client.get(
                                    f"{self.settings.incident_service_url}/cases/{case['case_id']}"
                                )
                                if case_response.status_code == 200:
                                    case_detail = case_response.json()
                                    root_cause = None
                                    if case_detail.get("last_analysis"):
                                        hyps = case_detail["last_analysis"].get("hypotheses", [])
                                        if hyps:
                                            root_cause = hyps[0].get("root_cause", "")
                                    
                                    similar.append(SimilarIncident(
                                        case_id=case["case_id"],
                                        title=case.get("title", ""),
                                        similarity_score=0.7 if service_lower in title_lower else 0.5,
                                        root_cause=root_cause,
                                        occurred_at=datetime.fromisoformat(case["created_at"]) if case.get("created_at") else None
                                    ))
                            except Exception:
                                similar.append(SimilarIncident(
                                    case_id=case["case_id"],
                                    title=case.get("title", ""),
                                    similarity_score=0.5
                                ))
        except Exception as e:
            logger.warning(f"Failed to fetch incidents: {e}")
        
        return similar[:5]
    
    def _generate_assessment(
        self,
        change: ChangeDetail,
        evidence: list[Evidence],
        similar_incidents: list[SimilarIncident],
        change_velocity: str,
        request: AnalyzeChangeRequest
    ) -> dict:
        """Use LLM to generate risk assessment."""
        
        # Build evidence context
        evidence_context = []
        for i, ev in enumerate(evidence):
            evidence_context.append(f"[{i}] Source: {ev.source} ({ev.source_type})\n{ev.excerpt}")
        
        incidents_context = "\n".join([
            f"- {inc.title} (similarity: {inc.similarity_score:.0%})"
            + (f"\n  Root cause: {inc.root_cause}" if inc.root_cause else "")
            for inc in similar_incidents
        ]) or "No similar incidents found."
        
        user_prompt = f"""Analyze the risk of this change:

CHANGE DETAILS:
- Service: {change.service}
- Type: {change.change_type}
- Version: {change.version or 'N/A'}
- Author: {change.metadata.author or 'Unknown'}
- Environment: {change.metadata.env}

DIFF SUMMARY:
{change.diff_summary}

CHANGE VELOCITY FOR SERVICE: {change_velocity}

SIMILAR PAST INCIDENTS:
{incidents_context}

HISTORICAL EVIDENCE (cite by index):
{chr(10).join(evidence_context) if evidence_context else "No historical data available."}

{f"FOCUS AREA: {request.focus_area.value}" if request.focus_area else ""}
{f"IGNORE FACTORS: {', '.join(request.ignore_factors)}" if request.ignore_factors else ""}

Analyze the risk and provide assessment following the exact JSON schema."""

        try:
            response = self.openai_client.chat.completions.create(
                model=self.settings.chat_model,
                messages=[
                    {"role": "system", "content": RISK_ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content or "{}")
            return result
            
        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            return {
                "risk_score": 0.5,
                "risk_level": "medium",
                "contributing_factors": [],
                "blast_radius": [change.service],
                "change_velocity": change_velocity,
                "rollout_recommendation": "needs_human_review",
                "confidence": 0.0,
                "unknowns": ["Analysis error occurred"],
                "refusal_reason": f"Analysis error: {str(e)}"
            }
    
    def _build_assessment(
        self,
        llm_result: dict,
        evidence: list[Evidence],
        similar_incidents: list[SimilarIncident]
    ) -> RiskAssessment:
        """Build RiskAssessment from LLM output."""
        
        # Map contributing factors with evidence
        factors = []
        for f in llm_result.get("contributing_factors", []):
            factor_evidence = []
            for idx in f.get("evidence_indices", []):
                if idx < len(evidence):
                    factor_evidence.append(evidence[idx])
            
            factors.append(ContributingFactor(
                factor=f.get("factor", "Unknown"),
                impact=f.get("impact", "medium"),
                description=f.get("description", ""),
                evidence=factor_evidence
            ))
        
        # Map risk level
        risk_level_str = llm_result.get("risk_level", "medium").lower()
        try:
            risk_level = RiskLevel(risk_level_str)
        except ValueError:
            risk_level = RiskLevel.MEDIUM
        
        # Map rollout recommendation
        rec_str = llm_result.get("rollout_recommendation", "needs_human_review").lower()
        try:
            recommendation = RolloutRecommendation(rec_str)
        except ValueError:
            recommendation = RolloutRecommendation.NEEDS_HUMAN_REVIEW
        
        return RiskAssessment(
            risk_score=llm_result.get("risk_score", 0.5),
            risk_level=risk_level,
            contributing_factors=factors,
            similar_past_incidents=similar_incidents,
            rollout_recommendation=recommendation,
            confidence=llm_result.get("confidence", 0.5),
            refusal_reason=llm_result.get("refusal_reason"),
            unknowns=llm_result.get("unknowns", [])
        )
