"""Core incident analysis engine."""

import json
import logging
from datetime import datetime
from openai import OpenAI

from .config import get_settings
from .models import (
    AnalyzeRequest, AnalyzeResponse, Hypothesis, TimelineEvent,
    WhatChanged, Evidence, ArtifactType, Artifact
)
from .vector_store import IncidentVectorStore
from .parsers import parse_artifact, extract_what_changed

logger = logging.getLogger(__name__)


ANALYSIS_SYSTEM_PROMPT = """You are an expert Site Reliability Engineer conducting incident root cause analysis.

STRICT RULES:
1. Produce ONLY valid JSON matching the schema exactly
2. EVERY claim must cite evidence from the provided excerpts
3. Include counter-evidence when present
4. If evidence is insufficient, set refusal_reason and provide empty hypotheses
5. Each hypothesis MUST reference at least 2 evidence excerpts
6. NO speculation without evidence
7. Include specific tests-to-confirm for each hypothesis

EVIDENCE REQUIREMENT:
- Strong evidence: Direct error messages, stack traces, timestamps correlating with incident
- Weak evidence: General logs, unrelated timestamps, vague mentions
- If only weak evidence exists, refuse to speculate

OUTPUT SCHEMA:
{
  "hypotheses": [
    {
      "rank": 1,
      "title": "Brief title",
      "root_cause": "Detailed explanation of what caused the incident",
      "confidence": 0.0-1.0,
      "evidence_indices": [0, 1],  // indices into the provided evidence array
      "counter_evidence_indices": [],
      "tests_to_confirm": ["Specific test 1", "Specific test 2"],
      "immediate_mitigations": ["Action 1", "Action 2"],
      "long_term_fixes": ["Fix 1", "Fix 2"]
    }
  ],
  "what_changed": [
    {
      "category": "deployment|config|infrastructure|traffic",
      "description": "What changed",
      "evidence_indices": [2]
    }
  ],
  "recommended_next_steps": ["Step 1", "Step 2"],
  "confidence_overall": 0.0-1.0,
  "refusal_reason": null or "Explanation why analysis cannot be completed"
}"""


class IncidentAnalyzer:
    """Analyzes incidents using RAG and LLM."""
    
    def __init__(self, vector_store: IncidentVectorStore):
        self.vector_store = vector_store
        self.settings = get_settings()
        
        self.openai_client = OpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_api_base
        )
    
    def analyze(
        self,
        case_id: str,
        incident_summary: str,
        artifacts: list[Artifact],
        request: AnalyzeRequest
    ) -> AnalyzeResponse:
        """Perform full incident analysis."""
        
        # Step 1: Parse artifacts for timeline events
        all_events = []
        for artifact in artifacts:
            events = parse_artifact(artifact)
            all_events.extend(events)
        
        # Sort events by timestamp
        all_events.sort(key=lambda e: e.timestamp or datetime.min)
        
        # Step 2: Extract what changed
        changes_raw = extract_what_changed(artifacts)
        
        # Step 3: Build query for evidence retrieval
        focus_query = self._build_search_query(incident_summary, request.focus_area)
        
        # Step 4: Retrieve relevant evidence
        evidence = self.vector_store.search(
            case_id=case_id,
            query=focus_query,
            top_k=request.top_k,
            exclude_sources=getattr(request, 'exclude_sources', None) or []
        )
        
        # Step 5: Check if we have enough evidence
        avg_relevance = sum(e.relevance for e in evidence) / len(evidence) if evidence else 0
        
        if request.strict_mode and (len(evidence) < 2 or avg_relevance < self.settings.confidence_threshold):
            return AnalyzeResponse(
                case_id=case_id,
                timeline_events=all_events[:20],  # Limit for response size
                hypotheses=[],
                what_changed=[],
                recommended_next_steps=[
                    "Collect more detailed logs around the incident timeframe",
                    "Gather deploy history for the 24 hours before incident",
                    "Check monitoring dashboards for anomalies",
                    "Interview on-call engineers who responded"
                ],
                confidence_overall=avg_relevance,
                refusal_reason="I don't have enough evidence in the provided artifacts to determine a root cause. The evidence relevance is too low for confident analysis.",
                analysis_metadata={
                    "evidence_count": len(evidence),
                    "avg_relevance": round(avg_relevance, 4),
                    "strict_mode": True
                }
            )
        
        # Step 6: Generate hypotheses with LLM
        llm_result = self._generate_hypotheses(
            incident_summary=incident_summary,
            evidence=evidence,
            changes_raw=changes_raw,
            timeline_summary=self._summarize_timeline(all_events),
            request=request
        )
        
        # Step 7: Build response
        hypotheses = self._build_hypotheses(llm_result.get("hypotheses", []), evidence)
        what_changed = self._build_what_changed(llm_result.get("what_changed", []), evidence)
        
        return AnalyzeResponse(
            case_id=case_id,
            timeline_events=all_events[:30],
            hypotheses=hypotheses,
            what_changed=what_changed,
            recommended_next_steps=llm_result.get("recommended_next_steps", []),
            confidence_overall=llm_result.get("confidence_overall", avg_relevance),
            refusal_reason=llm_result.get("refusal_reason"),
            analysis_metadata={
                "evidence_count": len(evidence),
                "avg_relevance": round(avg_relevance, 4),
                "strict_mode": request.strict_mode,
                "model": self.settings.chat_model
            }
        )
    
    def _build_search_query(self, summary: str, focus_area) -> str:
        """Build search query from summary and focus area."""
        query = summary
        
        if focus_area:
            focus_terms = {
                "database": "database connection pool query timeout deadlock",
                "auth": "authentication authorization token jwt session login",
                "network": "network connection timeout dns latency packet",
                "deployment": "deploy release version rollback container image",
                "performance": "latency response time memory cpu throughput"
            }
            query = f"{query} {focus_terms.get(focus_area.value, '')}"
        
        return query
    
    def _summarize_timeline(self, events: list[TimelineEvent]) -> str:
        """Create a text summary of timeline events."""
        if not events:
            return "No timeline events extracted."
        
        summary_parts = []
        for event in events[:10]:  # Limit to first 10
            summary_parts.append(f"- [{event.timestamp_str}] {event.kind}: {event.title}")
        
        return "\n".join(summary_parts)
    
    def _generate_hypotheses(
        self,
        incident_summary: str,
        evidence: list[Evidence],
        changes_raw: list[dict],
        timeline_summary: str,
        request: AnalyzeRequest
    ) -> dict:
        """Use LLM to generate hypotheses."""
        
        # Build evidence context
        evidence_context = []
        for i, ev in enumerate(evidence):
            evidence_context.append(f"[{i}] Source: {ev.source_id} ({ev.artifact_type.value})\n{ev.excerpt}")
        
        changes_context = "\n".join([
            f"- {c['category']}: {c['description']}" for c in changes_raw[:10]
        ])
        
        user_prompt = f"""Analyze this incident and generate {request.hypothesis_count} ranked hypotheses.

INCIDENT SUMMARY:
{incident_summary}

{f"USER NOTES: {request.user_notes}" if request.user_notes else ""}

TIMELINE SUMMARY:
{timeline_summary}

CHANGES DETECTED:
{changes_context if changes_context else "No explicit changes detected in artifacts."}

EVIDENCE (cite by index):
{chr(10).join(evidence_context)}

{f"FOCUS AREA: {request.focus_area.value}" if request.focus_area else ""}

Generate hypotheses following the exact JSON schema. Each hypothesis must cite at least 2 evidence indices."""

        try:
            response = self.openai_client.chat.completions.create(
                model=self.settings.chat_model,
                messages=[
                    {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content or "{}")
            return result
            
        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            return {
                "hypotheses": [],
                "what_changed": [],
                "recommended_next_steps": ["Review artifacts manually due to analysis error"],
                "confidence_overall": 0.0,
                "refusal_reason": f"Analysis error: {str(e)}"
            }
    
    def _build_hypotheses(self, raw_hypotheses: list[dict], evidence: list[Evidence]) -> list[Hypothesis]:
        """Build Hypothesis objects from LLM output."""
        hypotheses = []
        
        for h in raw_hypotheses:
            # Map evidence indices to actual evidence
            ev_indices = h.get("evidence_indices", [])
            counter_indices = h.get("counter_evidence_indices", [])
            
            hypothesis_evidence = [
                evidence[i] for i in ev_indices 
                if i < len(evidence)
            ]
            counter_evidence = [
                evidence[i] for i in counter_indices 
                if i < len(evidence)
            ]
            
            hypotheses.append(Hypothesis(
                rank=h.get("rank", len(hypotheses) + 1),
                title=h.get("title", "Unknown"),
                root_cause=h.get("root_cause", ""),
                confidence=h.get("confidence", 0.5),
                evidence=hypothesis_evidence,
                counter_evidence=counter_evidence,
                tests_to_confirm=h.get("tests_to_confirm", []),
                immediate_mitigations=h.get("immediate_mitigations", []),
                long_term_fixes=h.get("long_term_fixes", [])
            ))
        
        # Sort by rank
        hypotheses.sort(key=lambda x: x.rank)
        return hypotheses
    
    def _build_what_changed(self, raw_changes: list[dict], evidence: list[Evidence]) -> list[WhatChanged]:
        """Build WhatChanged objects from LLM output."""
        changes = []
        
        for c in raw_changes:
            ev_indices = c.get("evidence_indices", [])
            change_evidence = [
                evidence[i] for i in ev_indices 
                if i < len(evidence)
            ]
            
            changes.append(WhatChanged(
                category=c.get("category", "unknown"),
                description=c.get("description", ""),
                evidence=change_evidence
            ))
        
        return changes
