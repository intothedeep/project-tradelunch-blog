# agents/__init__.py
"""
Multi-Agent System for Blog Automation

Agents:
- BaseAgent - 모든 에이전트의 기본 클래스
- Protocol - 에이전트 간 통신 프로토콜
- DocumentScannerAgent - 폴더 구조 스캔
- ExtractingAgent - 마크다운 파싱 및 메타데이터 추출
- UploadingAgent - S3/RDS 업로드
- LoggingAgent - 로깅 및 터미널 출력
- ProjectManager - 전체 오케스트레이션
"""

from .base import BaseAgent
from .protocol import AgentMessage, AgentTask, AgentResponse
from .document_scanner_agent import DocumentScannerAgent
from .extracting_agent import ExtractingAgent
from .uploading_agent import UploadingAgent
from .logging_agent import LoggingAgent
from .project_manager import ProjectManagerAgent, AgentState

__all__ = [
    "BaseAgent",
    "AgentMessage",
    "AgentTask",
    "AgentResponse",
    "DocumentScannerAgent",
    "ExtractingAgent",
    "UploadingAgent",
    "LoggingAgent",
    "ProjectManagerAgent",
    "AgentState",
]

__version__ = "2.0.0"
