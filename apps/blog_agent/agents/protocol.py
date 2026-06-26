# agents/01_protocol.py
"""
01. Protocol - 에이전트 간 통신 프로토콜

에이전트 간 메시지 교환을 위한 표준 데이터 구조를 정의합니다.
- AgentMessage: 에이전트 간 통신 메시지
- AgentTask: 작업 정의
- AgentResponse: 작업 결과
"""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, Any, Optional
import uuid


@dataclass
class AgentMessage:
    """에이전트 간 통신을 위한 메시지 프로토콜"""

    from_agent: str
    to_agent: str
    task_id: str
    action: str  # "extract", "upload", "log", "analyze", etc.
    data: Dict[str, Any]
    timestamp: datetime
    message_id: str
    priority: int = 0  # 0 = normal, 1 = high, 2 = urgent

    def to_dict(self) -> Dict[str, Any]:
        """메시지를 딕셔너리로 변환"""
        result = asdict(self)
        result["timestamp"] = self.timestamp.isoformat()
        return result

    @classmethod
    def create(
        cls,
        from_agent: str,
        to_agent: str,
        action: str,
        data: Dict[str, Any],
        task_id: Optional[str] = None,
    ) -> "AgentMessage":
        """새 메시지 생성 헬퍼"""
        return cls(
            from_agent=from_agent,
            to_agent=to_agent,
            task_id=task_id or str(uuid.uuid4())[:8],
            action=action,
            data=data,
            timestamp=datetime.now(),
            message_id=str(uuid.uuid4())[:12],
        )


@dataclass
class AgentTask:
    """에이전트가 실행할 작업"""

    task_id: str
    action: str
    data: Dict[str, Any]
    created_at: datetime
    status: str = "pending"  # pending, running, completed, failed
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """작업을 딕셔너리로 변환"""
        result = {
            "task_id": self.task_id,
            "action": self.action,
            "data": self.data,
            "created_at": self.created_at.isoformat(),
            "status": self.status,
        }
        if self.result:
            result["result"] = self.result
        if self.error:
            result["error"] = self.error
        return result

    @classmethod
    def create(cls, action: str, data: Dict[str, Any], filename: str = None) -> "AgentTask":
        """새 작업 생성 헬퍼
        
        Args:
            action: 작업 유형
            data: 작업 데이터
            filename: 파일 이름 (있으면 task_id에 포함)
        """
        short_uuid = str(uuid.uuid4())[:8]
        
        # Format: filename-uuid or just uuid
        if filename:
            # Clean filename (remove extension, lowercase, replace spaces)
            import re
            clean_name = re.sub(r'\.md$', '', filename.lower())
            clean_name = re.sub(r'[^a-z0-9]+', '-', clean_name)
            clean_name = clean_name.strip('-')[:20]  # Max 20 chars
            task_id = f"{clean_name}-{short_uuid}"
        else:
            task_id = short_uuid
        
        return cls(
            task_id=task_id,
            action=action,
            data=data,
            created_at=datetime.now(),
        )


@dataclass
class AgentResponse:
    """에이전트 실행 결과"""

    task_id: str
    agent_name: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration: Optional[float] = None  # seconds
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """응답을 딕셔너리로 변환"""
        result = {
            "task_id": self.task_id,
            "agent_name": self.agent_name,
            "success": self.success,
            "timestamp": self.timestamp.isoformat(),
        }
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        if self.duration:
            result["duration"] = self.duration
        return result
