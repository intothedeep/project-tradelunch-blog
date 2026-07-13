# 10_cli_multi_agent.py
"""
10. CLI Multi-Agent Interface - 대화형 명령줄 인터페이스

사용자가 에이전트 시스템과 상호작용할 수 있는 CLI를 제공합니다.

기능:
- 대화형 프롬프트 (자동완성 지원)
- 명령어 처리 → cli_commands.py
- 자연어 명령 지원
- Rich UI → cli_display.py
- 히스토리 관리
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from prompt_toolkit import PromptSession
from prompt_toolkit.completion import WordCompleter
from prompt_toolkit.styles import Style
from rich.console import Console

from agents import AgentTask, ProjectManagerAgent
from cli_commands import (
    handle_agents,
    handle_file_command,
    handle_files,
    handle_find,
    handle_help,
    handle_history,
    handle_status,
)
from cli_display import print_banner
from config import CLI_HISTORY_FILE


class MultiAgentCLI:
    """
    멀티 에이전트 시스템을 위한 대화형 CLI.

    Orchestrates user input, command dispatch, history persistence, and task
    delegation to ProjectManagerAgent. Rendering is in cli_display; command
    handlers are in cli_commands.
    """

    def __init__(self, enable_llm: bool | None = None):
        """
        Initialize the CLI.

        Args:
            enable_llm: Force-enable/disable the LLM path for the underlying
                        ProjectManagerAgent. None = resolved from environment.
        """
        self.console = Console()
        self.enable_llm = enable_llm
        self.pm = None
        self.history: list[dict] = []
        self.running = True

        self.completer = WordCompleter(
            [
                "upload", "process", "analyze", "files", "find",
                "status", "history", "agents", "help", "exit", "clear",
            ],
            ignore_case=True,
        )
        self.style = Style.from_dict({"prompt": "#00aa00 bold"})
        self.session = PromptSession(completer=self.completer, style=self.style)

    def _parse_root_and_query(self, args: str) -> tuple[str | None, str]:
        """
        Parse args to extract optional root folder and query.

        Returns:
            (search_root, query) — search_root is None if not specified.
        """
        parts = args.split(maxsplit=1)
        if len(parts) == 1:
            return None, parts[0]

        import config
        potential_root = Path(parts[0])
        if not potential_root.is_absolute():
            potential_root = config.PROJECT_ROOT / parts[0]
        if potential_root.is_dir():
            return str(potential_root), parts[1]
        return None, args

    async def initialize(self) -> None:
        """시스템 초기화"""
        self.console.print("[yellow]Initializing multi-agent system...[/yellow]")
        try:
            self.pm = ProjectManagerAgent(enable_llm=self.enable_llm)
            self.load_history()
            self.console.print("[green]✅ System ready![/green]\n")
        except Exception as e:
            self.console.print(f"[red]❌ Initialization failed: {e}[/red]")
            sys.exit(1)

    async def process_command(self, user_input: str) -> None:
        """명령어 파싱 및 핸들러 디스패치"""
        bypass_confirm = "-y" in user_input
        if bypass_confirm:
            user_input = user_input.replace("-y", "").strip()

        parts = user_input.split(maxsplit=1)
        command = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        if command == "help":
            await handle_help(self.console)
        elif command == "exit":
            self.console.print("[yellow]Goodbye! 👋[/yellow]")
            self.save_history()
            self.running = False
        elif command == "clear":
            self.console.clear()
            print_banner(self.console)
        elif command == "status":
            await handle_status(self.console, self.pm, self.history)
        elif command == "agents":
            await handle_agents(self.pm)
        elif command == "history":
            await handle_history(self.console, self.history, args)
        elif command == "files":
            await handle_files(self.pm, args)
        elif command == "find":
            await handle_find(
                self.console, self.pm, args, self._parse_root_and_query
            )
        elif command in {"upload", "process", "analyze"}:
            await handle_file_command(
                self.console,
                self.pm,
                self.session,
                command,
                args,
                bypass_confirm,
                user_input,
                self._parse_root_and_query,
                self.execute_task,
            )
        else:
            await self.execute_task(user_input, "")

    async def execute_task(self, user_command: str, file_path: str = "") -> None:
        """작업 실행 — delegates to ProjectManagerAgent."""
        self.console.print()
        self.console.print("─" * 60)
        self.console.print(f"[bold]Executing:[/bold] {user_command}")
        self.console.print("─" * 60)
        self.console.print()

        start_time = datetime.now()
        filename = Path(file_path).name if file_path else None
        task = AgentTask.create(
            action="process",
            data={"user_command": user_command, "file_path": file_path},
            filename=filename,
        )

        try:
            result = await self.pm.run(task.to_dict())
            self.history.append(
                {
                    "command": user_command,
                    "timestamp": start_time.strftime("%H:%M:%S"),
                    "success": result.get("success", False),
                    "result": result,
                }
            )
        except Exception as e:
            self.console.print(f"[red]❌ Error: {e}[/red]")
            self.history.append(
                {
                    "command": user_command,
                    "timestamp": start_time.strftime("%H:%M:%S"),
                    "success": False,
                    "error": str(e),
                }
            )

        self.console.print()

    def load_history(self) -> None:
        """히스토리 로드"""
        if CLI_HISTORY_FILE.exists():
            try:
                with open(CLI_HISTORY_FILE) as f:
                    data = json.load(f)
                    self.history = data.get("commands", [])
            except Exception as e:
                self.console.print(
                    f"[yellow]Warning: Could not load history: {e}[/yellow]"
                )

    def save_history(self) -> None:
        """히스토리 저장"""
        try:
            with open(CLI_HISTORY_FILE, "w") as f:
                json.dump(
                    {
                        "commands": self.history[-100:],
                        "last_session": datetime.now().isoformat(),
                    },
                    f,
                    indent=2,
                )
        except Exception as e:
            self.console.print(f"[yellow]Warning: Could not save history: {e}[/yellow]")

    async def run(self) -> None:
        """메인 루프"""
        await self.initialize()
        print_banner(self.console)

        while self.running:
            try:
                user_input = await asyncio.to_thread(self.session.prompt, "blog-agent> ")
                user_input = user_input.strip()
                if not user_input:
                    continue
                await self.process_command(user_input)
            except KeyboardInterrupt:
                self.console.print("\n[yellow]Use 'exit' to quit[/yellow]")
            except EOFError:
                break
            except Exception as e:
                self.console.print(f"[red]Error: {e}[/red]")

        self.save_history()


async def main() -> None:
    """Entry point"""
    cli = MultiAgentCLI()
    await cli.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nBye!")
