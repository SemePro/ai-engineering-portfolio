"""Architecture review analyzer."""
import json
from openai import OpenAI

from .config import (
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    CHAT_MODEL,
    DEFAULT_TEMPERATURE,
    CONFIDENCE_THRESHOLD,
)
from .models import (
    ArchitectureRequest,
    ArchitectureDecision,
    RecommendedApproach,
    CostEstimate,
    DataSensitivity,
    LatencyLevel,
    DataAvailability,
    ComplianceType,
)
from .vector_store import PatternVectorStore


class ArchitectureAnalyzer:
    """Analyzes requirements and produces architecture decisions."""

    def __init__(self, vector_store: PatternVectorStore):
        self.vector_store = vector_store
        self.client = OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL,
        )

    def _check_feasibility(self, request: ArchitectureRequest) -> tuple[bool, list[str]]:
        """Check if we have enough information to make a recommendation."""
        issues = []

        # Check problem statement quality
        if len(request.problem_statement.strip()) < 30:
            issues.append("Problem statement is too brief. Provide more context about the use case.")

        if request.data_availability == DataAvailability.NONE:
            issues.append("No data availability specified. What data will the system have access to?")

        # Check for vague problem statements
        vague_indicators = ["something", "maybe", "not sure", "i think", "possibly", "idk"]
        problem_lower = request.problem_statement.lower()
        if any(v in problem_lower for v in vague_indicators):
            issues.append("Problem statement contains vague language. Be specific about requirements.")

        # Check for conflicting constraints
        if (request.constraints.latency == LatencyLevel.LOW and 
            request.constraints.scale == "large" and
            request.constraints.cost_sensitivity == "high"):
            issues.append("Constraints conflict: low latency + large scale + low cost is very difficult.")

        return len(issues) == 0, issues

    def _determine_if_ai_appropriate(self, request: ArchitectureRequest) -> tuple[bool, str]:
        """Determine if AI is appropriate for this use case."""
        reasons_against_ai = []

        # Real-time + regulated/PII is usually not suitable for LLMs
        if (request.constraints.latency == LatencyLevel.LOW and
            request.constraints.data_sensitivity in [DataSensitivity.REGULATED, DataSensitivity.PII]):
            reasons_against_ai.append("Real-time processing of regulated/PII data is better suited for deterministic systems")

        # Strict compliance often requires explainability
        if ComplianceType.HIPAA in request.constraints.compliance:
            reasons_against_ai.append("HIPAA compliance requires deterministic, auditable decisions")

        # No data = no AI
        if request.data_availability == DataAvailability.NONE:
            reasons_against_ai.append("Without available data, AI systems cannot be effectively trained or grounded")

        if reasons_against_ai:
            return False, "; ".join(reasons_against_ai)
        
        return True, ""

    def _build_prompt(
        self,
        request: ArchitectureRequest,
        patterns: list[dict],
        ai_appropriate: bool,
        ai_reason: str,
    ) -> str:
        """Build the analysis prompt."""
        patterns_text = "\n".join([f"- {p['text']}" for p in patterns])

        return f"""You are a senior AI solutions architect conducting an architecture review.

TASK: Analyze the following requirements and recommend an appropriate architecture.

PROBLEM STATEMENT:
{request.problem_statement}

CONSTRAINTS:
- Latency requirement: {request.constraints.latency.value}
- Scale: {request.constraints.scale.value}
- Data sensitivity: {request.constraints.data_sensitivity.value}
- Cost sensitivity: {request.constraints.cost_sensitivity.value}
- Compliance requirements: {[c.value for c in request.constraints.compliance] if request.constraints.compliance else "None"}

CONTEXT:
- Data availability: {request.data_availability.value}
- Team maturity: {request.team_maturity.value}
- User notes: {request.user_notes or "None provided"}

RELEVANT ARCHITECTURE PATTERNS:
{patterns_text}

AI APPROPRIATENESS ASSESSMENT:
{"AI is appropriate for this use case." if ai_appropriate else f"AI may NOT be appropriate: {ai_reason}"}

INSTRUCTIONS:
1. Analyze the requirements against the constraints
2. Consider whether AI is the right solution AT ALL
3. If AI is appropriate, recommend: rag, fine_tuning, rules, or hybrid
4. If AI is NOT appropriate, recommend: rules or no_ai
5. Explain your reasoning clearly
6. List specific tradeoffs, risks, and alternatives considered
7. Assign a confidence score based on how much information you have

You MUST respond with valid JSON matching this schema:
{{
  "recommended_approach": "rag" | "fine_tuning" | "rules" | "hybrid" | "no_ai",
  "rationale": "Clear explanation of why this approach was chosen",
  "system_components": [
    {{"name": "Component Name", "purpose": "What it does", "technology_suggestion": "Optional tech"}}
  ],
  "architecture_flow": "Step by step description of how data flows through the system",
  "tradeoffs": [
    {{"aspect": "e.g. Latency", "pros": ["pro1"], "cons": ["con1"]}}
  ],
  "risks": [
    {{"risk": "Description", "severity": "low|medium|high", "mitigation": "How to address"}}
  ],
  "cost_estimate_level": "low" | "medium" | "high",
  "alternatives_considered": [
    {{"approach": "Alternative approach", "reason_rejected": "Why not chosen"}}
  ],
  "confidence": 0.0-1.0
}}

IMPORTANT:
- Do NOT speculate without evidence
- If information is insufficient, lower your confidence significantly
- Always include "Why NOT AI" in alternatives if recommending AI
- Be conservative in your recommendations
"""

    def analyze(self, request: ArchitectureRequest) -> ArchitectureDecision:
        """Perform the architecture review."""
        # Step 1: Check feasibility (strict mode)
        if request.strict_mode:
            feasible, missing_info = self._check_feasibility(request)
            if not feasible:
                return ArchitectureDecision(
                    recommended_approach=RecommendedApproach.NO_AI,
                    rationale="Insufficient information to make an architecture recommendation.",
                    system_components=[],
                    architecture_flow="Cannot determine without more information.",
                    tradeoffs=[],
                    risks=[],
                    cost_estimate_level=CostEstimate.MEDIUM,
                    alternatives_considered=[],
                    confidence=0.0,
                    refusal_reason="Cannot proceed with architecture review due to insufficient information.",
                    missing_information=missing_info,
                )

        # Step 2: Check if AI is appropriate
        ai_appropriate, ai_reason = self._determine_if_ai_appropriate(request)

        # Step 3: Search for relevant patterns
        search_query = f"{request.problem_statement} {request.constraints.latency.value} latency {request.constraints.data_sensitivity.value} data"
        patterns = self.vector_store.search_patterns(search_query, top_k=5)

        # Step 4: Build prompt and call LLM
        prompt = self._build_prompt(request, patterns, ai_appropriate, ai_reason)

        response = self.client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": "You are a senior AI solutions architect. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=DEFAULT_TEMPERATURE,
            response_format={"type": "json_object"},
        )

        # Step 5: Parse response
        try:
            result = json.loads(response.choices[0].message.content)
            
            # Build decision object
            decision = ArchitectureDecision(
                recommended_approach=RecommendedApproach(result.get("recommended_approach", "no_ai")),
                rationale=result.get("rationale", ""),
                system_components=[
                    {"name": c.get("name", ""), "purpose": c.get("purpose", ""), "technology_suggestion": c.get("technology_suggestion")}
                    for c in result.get("system_components", [])
                ],
                architecture_flow=result.get("architecture_flow", ""),
                tradeoffs=[
                    {"aspect": t.get("aspect", ""), "pros": t.get("pros", []), "cons": t.get("cons", [])}
                    for t in result.get("tradeoffs", [])
                ],
                risks=[
                    {"risk": r.get("risk", ""), "severity": r.get("severity", "medium"), "mitigation": r.get("mitigation", "")}
                    for r in result.get("risks", [])
                ],
                cost_estimate_level=CostEstimate(result.get("cost_estimate_level", "medium")),
                alternatives_considered=[
                    {"approach": a.get("approach", ""), "reason_rejected": a.get("reason_rejected", "")}
                    for a in result.get("alternatives_considered", [])
                ],
                confidence=float(result.get("confidence", 0.5)),
            )

            # Apply confidence threshold in strict mode
            if request.strict_mode and decision.confidence < CONFIDENCE_THRESHOLD:
                decision.refusal_reason = f"Confidence ({decision.confidence:.2f}) is below threshold ({CONFIDENCE_THRESHOLD}). Review may need more information."
                decision.missing_information = ["Consider providing more details about the problem or constraints."]

            return decision

        except Exception as e:
            return ArchitectureDecision(
                recommended_approach=RecommendedApproach.NO_AI,
                rationale=f"Error processing review: {str(e)}",
                system_components=[],
                architecture_flow="Error occurred during analysis.",
                tradeoffs=[],
                risks=[],
                cost_estimate_level=CostEstimate.MEDIUM,
                alternatives_considered=[],
                confidence=0.0,
                refusal_reason=f"Analysis failed: {str(e)}",
            )
