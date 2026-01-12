"""Parsers for extracting events and patterns from incident artifacts."""

import re
from datetime import datetime
from typing import Optional
from .models import TimelineEvent, Evidence, ArtifactType, Artifact


# Common timestamp patterns
TIMESTAMP_PATTERNS = [
    # ISO 8601
    (r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)', '%Y-%m-%dT%H:%M:%S'),
    # Common log format
    (r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)', '%Y-%m-%d %H:%M:%S'),
    # Syslog style
    (r'([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})', '%b %d %H:%M:%S'),
    # Unix timestamp (seconds)
    (r'\b(\d{10})\b', 'unix'),
    # Unix timestamp (milliseconds)
    (r'\b(\d{13})\b', 'unix_ms'),
]

# Error patterns to detect
ERROR_PATTERNS = [
    (r'(?i)\b(exception|error|fatal|critical|failure|failed)\b[:\s]*(.{0,100})', 'error'),
    (r'(?i)\b(timeout|timed?\s*out)\b[:\s]*(.{0,100})', 'timeout'),
    (r'(?i)\b(5\d{2})\s+(error|internal server error)', 'http_5xx'),
    (r'(?i)\b(connection\s+(?:refused|reset|timeout|failed))\b', 'connection_error'),
    (r'(?i)\b(oom|out\s*of\s*memory|memory\s+exhausted)\b', 'memory'),
    (r'(?i)\b(deadlock|lock\s+timeout|waiting\s+for\s+lock)\b', 'database'),
    (r'(?i)\b(pool\s+exhausted|no\s+available\s+connections?)\b', 'pool_exhaustion'),
    (r'(?i)\b(jwt|token)\s+(?:invalid|expired|validation\s+failed)\b', 'auth'),
    (r'(?i)\b(iat|exp|nbf)\s+(?:claim|validation)\b', 'auth'),
    (r'(?i)\b(clock\s+skew|time\s+sync|ntp)\b', 'clock'),
]

# Deploy patterns
DEPLOY_PATTERNS = [
    (r'(?i)\b(deployed|deploying|deployment)\b[:\s]*(.{0,100})', 'deploy'),
    (r'(?i)\b(rollback|rolled\s+back|reverting)\b[:\s]*(.{0,100})', 'rollback'),
    (r'(?i)\b(version|release|build)[:\s]+([v\d]+[\w.-]*)', 'version'),
    (r'(?i)\b(image|container)[:\s]+([^\s]+:[^\s]+)', 'container'),
]

# Alert patterns (for JSON alerts)
ALERT_PATTERNS = [
    'severity', 'triggered_at', 'service', 'symptom', 'threshold', 'value'
]


def extract_timestamp(text: str) -> Optional[datetime]:
    """Extract the first timestamp from text."""
    for pattern, fmt in TIMESTAMP_PATTERNS:
        match = re.search(pattern, text)
        if match:
            ts_str = match.group(1)
            try:
                if fmt == 'unix':
                    return datetime.fromtimestamp(int(ts_str))
                elif fmt == 'unix_ms':
                    return datetime.fromtimestamp(int(ts_str) / 1000)
                else:
                    # Handle ISO format with timezone
                    ts_str = re.sub(r'[+-]\d{2}:?\d{2}$', '', ts_str)
                    ts_str = ts_str.rstrip('Z')
                    ts_str = ts_str.split('.')[0]  # Remove microseconds
                    return datetime.strptime(ts_str, fmt)
            except (ValueError, OSError):
                continue
    return None


def extract_timestamp_str(text: str) -> str:
    """Extract timestamp as string."""
    for pattern, _ in TIMESTAMP_PATTERNS:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return "unknown"


def parse_log_lines(content: str, source_id: str) -> list[TimelineEvent]:
    """Parse log content and extract events."""
    events = []
    lines = content.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for error patterns
        for pattern, kind in ERROR_PATTERNS:
            match = re.search(pattern, line)
            if match:
                ts = extract_timestamp(line)
                ts_str = extract_timestamp_str(line)
                
                # Determine severity
                if kind in ['error', 'memory', 'pool_exhaustion']:
                    severity = 'error'
                elif kind in ['timeout', 'connection_error', 'database']:
                    severity = 'warning'
                else:
                    severity = 'info'
                
                events.append(TimelineEvent(
                    timestamp=ts,
                    timestamp_str=ts_str,
                    kind=kind,
                    title=f"{kind.replace('_', ' ').title()} detected",
                    details=line[:500],
                    severity=severity,
                    evidence=[Evidence(
                        source_id=source_id,
                        excerpt=line[:300],
                        relevance=0.8,
                        artifact_type=ArtifactType.LOGS
                    )]
                ))
                break  # Only match first pattern per line
        
        # Check for deploy patterns
        for pattern, kind in DEPLOY_PATTERNS:
            match = re.search(pattern, line)
            if match:
                ts = extract_timestamp(line)
                ts_str = extract_timestamp_str(line)
                
                events.append(TimelineEvent(
                    timestamp=ts,
                    timestamp_str=ts_str,
                    kind=kind,
                    title=f"{kind.replace('_', ' ').title()} event",
                    details=line[:500],
                    severity='info',
                    evidence=[Evidence(
                        source_id=source_id,
                        excerpt=line[:300],
                        relevance=0.9,
                        artifact_type=ArtifactType.LOGS
                    )]
                ))
                break
    
    return events


def parse_deploy_history(content: str, source_id: str) -> list[TimelineEvent]:
    """Parse deploy history JSON or text."""
    events = []
    
    # Try to find deploy-related lines
    lines = content.split('\n')
    for line in lines:
        for pattern, kind in DEPLOY_PATTERNS:
            match = re.search(pattern, line)
            if match:
                ts = extract_timestamp(line)
                ts_str = extract_timestamp_str(line)
                
                events.append(TimelineEvent(
                    timestamp=ts,
                    timestamp_str=ts_str,
                    kind=kind,
                    title=f"Deployment: {kind}",
                    details=line[:500],
                    severity='info',
                    evidence=[Evidence(
                        source_id=source_id,
                        excerpt=line[:300],
                        relevance=0.95,
                        artifact_type=ArtifactType.DEPLOY_HISTORY
                    )]
                ))
    
    return events


def parse_alerts(content: str, source_id: str) -> list[TimelineEvent]:
    """Parse alert JSON content."""
    events = []
    
    # Simple heuristic: look for alert-like patterns
    lines = content.split('\n')
    for line in lines:
        if any(p in line.lower() for p in ['severity', 'alert', 'triggered', 'threshold']):
            ts = extract_timestamp(line)
            ts_str = extract_timestamp_str(line)
            
            # Determine severity from content
            severity = 'warning'
            if 'critical' in line.lower() or 'high' in line.lower():
                severity = 'critical'
            elif 'error' in line.lower():
                severity = 'error'
            
            events.append(TimelineEvent(
                timestamp=ts,
                timestamp_str=ts_str,
                kind='alert',
                title='Alert triggered',
                details=line[:500],
                severity=severity,
                evidence=[Evidence(
                    source_id=source_id,
                    excerpt=line[:300],
                    relevance=0.9,
                    artifact_type=ArtifactType.ALERTS
                )]
            ))
    
    return events


def parse_artifact(artifact: Artifact) -> list[TimelineEvent]:
    """Parse an artifact and extract timeline events."""
    if artifact.type == ArtifactType.LOGS:
        return parse_log_lines(artifact.content, artifact.source_id)
    elif artifact.type == ArtifactType.DEPLOY_HISTORY:
        return parse_deploy_history(artifact.content, artifact.source_id)
    elif artifact.type == ArtifactType.ALERTS:
        return parse_alerts(artifact.content, artifact.source_id)
    else:
        # For runbooks and metrics, just look for timestamps and key info
        return parse_log_lines(artifact.content, artifact.source_id)


def extract_what_changed(artifacts: list[Artifact]) -> list[dict]:
    """Extract 'what changed' from artifacts."""
    changes = []
    
    for artifact in artifacts:
        if artifact.type == ArtifactType.DEPLOY_HISTORY:
            # Look for version changes, config changes
            for pattern, kind in DEPLOY_PATTERNS:
                matches = re.findall(pattern, artifact.content)
                for match in matches:
                    changes.append({
                        'category': 'deployment',
                        'description': f"{kind}: {match[1] if len(match) > 1 else match[0]}",
                        'source_id': artifact.source_id,
                        'artifact_type': artifact.type
                    })
        
        # Look for config changes
        if 'config' in artifact.content.lower() or 'setting' in artifact.content.lower():
            config_pattern = r'(?i)(config|setting|parameter)[:\s]+(\w+)[:\s=]+([^\n]+)'
            matches = re.findall(config_pattern, artifact.content)
            for match in matches:
                changes.append({
                    'category': 'config',
                    'description': f"{match[1]} = {match[2][:50]}",
                    'source_id': artifact.source_id,
                    'artifact_type': artifact.type
                })
    
    return changes
