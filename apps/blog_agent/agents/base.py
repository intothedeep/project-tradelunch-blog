# agents/00_base.py
"""
00. BaseAgent - 모든 에이전트의 기본 클래스

모든 에이전트가 상속받는 추상 베이스 클래스입니다.
공통 인터페이스와 기본 기능을 제공합니다.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import asyncio


class BaseAgent(ABC):
    """모든 에이전트의 베이스 클래스"""

    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.status = "idle"  # idle, running, completed, failed
        self.created_at = datetime.now()

    @abstractmethod
    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        각 에이전트가 구현해야 하는 메인 실행 로직

        Args:
            task: 작업 정보를 담은 딕셔너리
                - task_id: 작업 고유 ID
                - action: 수행할 작업 타입
                - data: 작업에 필요한 데이터

        Returns:
            결과 딕셔너리
                - success: bool
                - data: 결과 데이터
                - error: 에러 메시지 (실패 시)
        """
        pass

    async def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        에이전트 실행 래퍼 (상태 관리 포함)
        """
        self.status = "running"
        task_id = task.get("task_id", "unknown")

        try:
            self._log(f"Starting task {task_id}", "info")
            result = await self.execute(task)

            if result.get("success", False):
                self.status = "completed"
                self._log(f"Task {task_id} completed", "success")
            else:
                self.status = "failed"
                self._log(
                    f"Task {task_id} failed: {result.get('error', 'Unknown error')}",
                    "error",
                )

            return result

        except Exception as e:
            self.status = "failed"
            self._log(f"Task {task_id} error: {str(e)}", "error")
            return {"success": False, "error": str(e), "agent": self.name}

    def _log(self, message: str, level: str = "info"):
        """
        내부 로깅 (나중에 LoggingAgent로 위임)
        """
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {"info": "ℹ️", "success": "✅", "error": "❌", "warning": "⚠️"}.get(
            level, "•"
        )

        print(f"[{timestamp}] {prefix} [{self.name}] {message}")

    def get_info(self) -> Dict[str, Any]:
        """에이전트 정보 반환"""
        return {
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
