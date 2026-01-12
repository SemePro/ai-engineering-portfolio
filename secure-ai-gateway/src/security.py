"""Security middleware for prompt injection detection and PII redaction."""

import re
from typing import Tuple, List

from .models import (
    SecurityCheckResult,
    SecurityStatus,
    PIIType,
    InjectionType
)


class PIIRedactor:
    """Detects and redacts PII from text."""
    
    PATTERNS = {
        PIIType.EMAIL: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        PIIType.PHONE: r'\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
        PIIType.SSN: r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b',
        PIIType.CREDIT_CARD: r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
    }
    
    REDACTIONS = {
        PIIType.EMAIL: "[EMAIL REDACTED]",
        PIIType.PHONE: "[PHONE REDACTED]",
        PIIType.SSN: "[SSN REDACTED]",
        PIIType.CREDIT_CARD: "[CARD REDACTED]",
    }
    
    def detect(self, text: str) -> List[PIIType]:
        """Detect PII types in text."""
        detected = []
        for pii_type, pattern in self.PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                detected.append(pii_type)
        return detected
    
    def redact(self, text: str) -> Tuple[str, List[PIIType]]:
        """Redact PII from text and return detected types."""
        detected = []
        redacted_text = text
        
        for pii_type, pattern in self.PATTERNS.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                detected.append(pii_type)
                redacted_text = re.sub(
                    pattern,
                    self.REDACTIONS[pii_type],
                    redacted_text,
                    flags=re.IGNORECASE
                )
        
        return redacted_text, detected


class InjectionDetector:
    """Detects prompt injection attempts."""
    
    # System override attempt patterns
    SYSTEM_OVERRIDE_PATTERNS = [
        r'ignore\s+(previous|all|above)\s+(instructions?|prompts?)',
        r'disregard\s+(previous|all|above)',
        r'forget\s+(everything|all|previous)',
        r'you\s+are\s+now\s+(?:a|an)',
        r'new\s+instructions?\s*:',
        r'system\s*:\s*you\s+are',
        r'override\s+(system|instructions?)',
        r'\]\s*\[\s*system',  # Attempting to inject system messages
    ]
    
    # Data exfiltration patterns
    EXFILTRATION_PATTERNS = [
        r'reveal\s+(your|the|system)\s+(prompt|instructions?)',
        r'show\s+me\s+(your|the)\s+(system|prompt|instructions?)',
        r'what\s+(are|is)\s+(your|the)\s+(system|instructions?|prompt)',
        r'print\s+(your|the|all)\s+(instructions?|prompt)',
        r'repeat\s+(your|the)\s+(system|prompt|instructions?)',
        r'output\s+(your|the|system)\s+(prompt|instructions?)',
    ]
    
    # Jailbreak patterns
    JAILBREAK_PATTERNS = [
        r'DAN\s+mode',
        r'developer\s+mode',
        r'jailbreak',
        r'bypass\s+(filters?|restrictions?|safety)',
        r'pretend\s+(you\s+)?have\s+no\s+(restrictions?|limits?)',
        r'act\s+as\s+if\s+(you\s+)?have\s+no\s+rules',
    ]
    
    def detect(self, text: str) -> List[InjectionType]:
        """Detect injection attempts in text."""
        detected = []
        text_lower = text.lower()
        
        for pattern in self.SYSTEM_OVERRIDE_PATTERNS:
            if re.search(pattern, text_lower):
                if InjectionType.SYSTEM_OVERRIDE not in detected:
                    detected.append(InjectionType.SYSTEM_OVERRIDE)
                break
        
        for pattern in self.EXFILTRATION_PATTERNS:
            if re.search(pattern, text_lower):
                if InjectionType.DATA_EXFILTRATION not in detected:
                    detected.append(InjectionType.DATA_EXFILTRATION)
                break
        
        for pattern in self.JAILBREAK_PATTERNS:
            if re.search(pattern, text_lower):
                if InjectionType.JAILBREAK not in detected:
                    detected.append(InjectionType.JAILBREAK)
                break
        
        return detected
    
    def should_block(self, detected: List[InjectionType]) -> bool:
        """Determine if the request should be blocked."""
        # Block on any injection attempt
        return len(detected) > 0


class SecurityMiddleware:
    """Combines PII redaction and injection detection."""
    
    def __init__(
        self,
        enable_pii_redaction: bool = True,
        enable_injection_detection: bool = True
    ):
        self.enable_pii_redaction = enable_pii_redaction
        self.enable_injection_detection = enable_injection_detection
        self.pii_redactor = PIIRedactor()
        self.injection_detector = InjectionDetector()
    
    def process(self, text: str) -> Tuple[str, SecurityCheckResult]:
        """
        Process text through security checks.
        
        Args:
            text: The input text to check
            
        Returns:
            Tuple of (processed_text, security_result)
        """
        processed_text = text
        pii_detected: List[PIIType] = []
        pii_redacted = False
        injection_detected: List[InjectionType] = []
        blocked_reason = None
        
        # PII detection and redaction
        if self.enable_pii_redaction:
            processed_text, pii_detected = self.pii_redactor.redact(text)
            pii_redacted = len(pii_detected) > 0
        
        # Injection detection
        if self.enable_injection_detection:
            injection_detected = self.injection_detector.detect(text)
        
        # Determine status
        if injection_detected and self.injection_detector.should_block(injection_detected):
            status = SecurityStatus.BLOCKED
            blocked_reason = f"Detected injection attempt: {', '.join(i.value for i in injection_detected)}"
        elif pii_detected:
            status = SecurityStatus.WARNING
        else:
            status = SecurityStatus.PASSED
        
        result = SecurityCheckResult(
            status=status,
            pii_detected=pii_detected,
            pii_redacted=pii_redacted,
            injection_detected=injection_detected,
            blocked_reason=blocked_reason
        )
        
        return processed_text, result
