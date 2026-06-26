# 10_cli_multi_agent.py
"""
10. CLI Multi-Agent Interface - 대화형 명령줄 인터페이스

사용자가 에이전트 시스템과 상호작용할 수 있는 CLI를 제공합니다.

기능:
- 대화형 프롬프트 (자동완성 지원)
- 명령어 처리 (upload, process, status 등)
- 자연어 명령 지원
- Rich UI (색상, 테이블, 패널)
- 히스토리 관리
"""

import asyncio
import sys
import json
from datetime import datetime
from pathlib import Path

from prompt_toolkit import PromptSession
from prompt_toolkit.completion import WordCompleter
from prompt_toolkit.styles import Style
from rich.console import Console
from rich.panel import Panel

from agents import ProjectManagerAgent, AgentTask
from config import MODEL_NAME, OLLAMA_BASE_URL, CLI_HISTORY_FILE


class MultiAgentCLI:
    """
    멀티 에이전트 시스템을 위한 대화형 CLI
    """

    def __init__(self):
        self.console = Console()
        self.pm = None  # ProjectManagerAgent (나중에 초기화)
        self.history = []
        self.running = True

        # 명령어 자동완성
        self.completer = WordCompleter(
            [
                "upload",
                "process",
                "analyze",
                "files",
                "find",
                "status",
                "history",
                "agents",
                "help",
                "exit",
                "clear",
            ],
            ignore_case=True,
        )

        # 프롬프트 스타일
        self.style = Style.from_dict(
            {
                "prompt": "#00aa00 bold",
            }
        )

        self.session = PromptSession(completer=self.completer, style=self.style)

    def _parse_root_and_query(self, args: str) -> tuple[str | None, str]:
        """
        Parse args to extract optional root folder and query.

        Logic:
        - 1 arg: it's the query (no root folder)
        - 2+ args: if first arg is a valid directory, it's root; rest is query

        Returns:
            (search_root, query) - search_root is None if not specified
        """
        parts = args.split(maxsplit=1)

        if len(parts) == 1:
            # Single arg = query only
            return None, parts[0]

        # Check if first part is an existing directory
        first_part = parts[0]
        from pathlib import Path
        import config

        # Check absolute path or relative to project root
        potential_root = Path(first_part)
        if not potential_root.is_absolute():
            potential_root = config.PROJECT_ROOT / first_part

        if potential_root.is_dir():
            # First arg is a directory = root folder
            return str(potential_root), parts[1]
        else:
            # First arg is not a directory = treat entire args as query
            return None, args

    async def initialize(self):
        """시스템 초기화"""
        self.console.print("[yellow]Initializing multi-agent system...[/yellow]")

        try:
            # ProjectManager 초기화 (싱글톤 LLM 자동 사용)
            self.pm = ProjectManagerAgent()

            # 이전 히스토리 로드
            self.load_history()

            self.console.print("[green]✅ System ready![/green]\n")

        except Exception as e:
            self.console.print(f"[red]❌ Initialization failed: {e}[/red]")
            sys.exit(1)

    def print_banner(self):
        """시작 배너"""
        banner = """[bold cyan]╔══════════════════════════════════════════════╗
║   📝 Blog Multi-Agent System                ║
║   Powered by Qwen3 8B + LangGraph           ║
╚══════════════════════════════════════════════╝[/bold cyan]

[dim]Agents:[/dim]
  • [cyan]Project Manager[/cyan] - Orchestrates workflow
  • [blue]Extracting Agent[/blue] - Parses markdown & metadata
  • [green]Uploading Agent[/green] - S3 & RDS operations  
  • [yellow]Logging Agent[/yellow] - Terminal output

Type [bold]'help'[/bold] for available commands
"""
        self.console.print(banner)

    def print_help(self):
        """도움말"""
        help_text = """[bold]Available Commands:[/bold]

[cyan]File Processing:[/cyan]
  upload [root] <file>  - Upload a blog post
  process [root] <file> - Process with metadata extraction
  analyze [root] <file> - Analyze content only (no upload)
  find [root] <query>   - Find file by name (partial match)

  [dim]Examples:[/dim]
    find article              - Search in posts/ and docs/
    find docs/tech article    - Search only in docs/tech/
    upload docs/ai my-post    - Upload from docs/ai/

[cyan]System:[/cyan]
  status                - Show system status
  agents                - List all agents
  files                 - Show available files (posts & docs)
  history [n]           - Show recent commands (default: 5)
  
[cyan]Utility:[/cyan]
  help                  - Show this help
  clear                 - Clear screen
  exit                  - Exit CLI

[bold]Natural Language:[/bold]
You can also use natural language:
  "Please upload ./posts/my-article.md"
  "Process new-post.md with category detection"
  "Show me the agents"
"""
        self.console.print(Panel(help_text, title="Help", border_style="cyan"))

    def show_status(self):
        """시스템 상태"""
        agents_info = self.pm.get_agents_info()

        status_text = f"""[bold]System Status:[/bold]

[bold]Agents:[/bold]"""

        for agent in agents_info:
            status_icon = {
                "idle": "🟢",
                "running": "🟡",
                "completed": "✅",
                "failed": "🔴",
            }.get(agent["status"], "⚪")

            status_text += f"\n  {status_icon} {agent['name']}: [{agent['status']}]"

        status_text += f"""

[bold]Session:[/bold]
  • Commands executed: {len(self.history)}
  • Model: {MODEL_NAME}
"""

        self.console.print(Panel(status_text, title="📊 Status", border_style="green"))

    def show_agents(self):
        """에이전트 목록"""
        agents_info = self.pm.get_agents_info()
        self.pm.logging_agent.show_agent_tree(agents_info)

    def show_history(self, n=5):
        """최근 명령 이력"""
        if not self.history:
            self.console.print("[yellow]No command history[/yellow]")
            return

        recent = self.history[-n:]

        from rich.table import Table

        table = Table(title=f"Last {len(recent)} Commands")
        table.add_column("#", style="cyan", width=6)
        table.add_column("Command", style="white", width=50)
        table.add_column("Time", style="dim", width=20)
        table.add_column("Status", width=12)

        for i, cmd in enumerate(recent, 1):
            status_str = "[green]✅[/green]" if cmd.get("success") else "[red]❌[/red]"
            table.add_row(str(i), cmd["command"][:50], cmd["timestamp"], status_str)

        self.console.print(table)

    async def process_command(self, user_input: str):
        """명령어 처리"""
        # Check for -y flag
        bypass_confirm = "-y" in user_input
        if bypass_confirm:
            user_input = user_input.replace("-y", "").strip()
            
        parts = user_input.split(maxsplit=1)
        command = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        # 시스템 명령어
        if command == "help":
            self.print_help()
            return

        elif command == "exit":
            self.console.print("[yellow]Goodbye! 👋[/yellow]")
            self.save_history()
            self.running = False
            return

        elif command == "clear":
            self.console.clear()
            self.print_banner()
            return

        elif command == "status":
            self.show_status()
            return

        elif command == "agents":
            self.show_agents()
            return

        elif command == "history":
            n = int(args) if args.isdigit() else 5
            self.show_history(n)
            return

        elif command == "files":
            # Optional: files <root_dir> (default: posts)
            root_dir = args if args else "posts"
            self.pm.print_file_tree(root_dir)
            return

        elif command == "find":
            if not args:
                self.console.print("[red]Usage: find [root_folder] <query>[/red]")
                self.console.print("[dim]Examples: find article, find docs/tech article[/dim]")
                return

            from rich.tree import Tree

            # Parse args: check if first part is a directory (root folder)
            search_root, query = self._parse_root_and_query(args)

            result = self.pm.check_file_exists(query, quiet=True, search_root=search_root)
            matches = result.get("matches", [])
            
            if not result["exists"]:
                self.console.print(f"[red]❌ No matches found for: {args}[/red]")
                self.console.print("[dim]Use 'files' command to see all available files[/dim]")
                return
            
            # Build tree view
            tree = Tree(f"🔍 [bold]Search results for:[/bold] [cyan]{args}[/cyan]")
            
            if matches:
                from pathlib import Path
                import config
                project_root = config.PROJECT_ROOT
                
                for match in matches:
                    path = match.get("path", "")
                    name = match.get("name", "")
                    match_type = match.get("match_type", "")
                    
                    file_path = Path(path)
                    parent = file_path.parent
                    
                    # Get relative path from project root
                    try:
                        rel_path = parent.relative_to(project_root)
                    except ValueError:
                        rel_path = parent.name
                    
                    # If parent folder has same name as file (nested structure)
                    if parent.name == file_path.stem:
                        # Show folder with relative path
                        folder_branch = tree.add(f"📁 [blue]{rel_path}/[/blue] [dim]({match_type})[/dim]")
                        
                        # List all files in the folder
                        for item in sorted(parent.iterdir(), key=lambda x: (x.suffix != '.md', x.name)):
                            if item.is_file():
                                size_kb = item.stat().st_size / 1024
                                icon = "📷" if item.suffix in [".png", ".jpg", ".jpeg", ".gif", ".webp"] else "📄"
                                is_md = " [green]← main[/green]" if item.suffix == ".md" else ""
                                folder_branch.add(f"{icon} {item.name} [dim]({size_kb:.1f}KB)[/dim]{is_md}")
                    else:
                        # Simple file - show relative path
                        try:
                            rel_file = file_path.relative_to(project_root)
                        except ValueError:
                            rel_file = file_path.name
                        size = file_path.stat().st_size / 1024 if file_path.exists() else 0
                        tree.add(f"📄 [blue]{rel_file}[/blue] [dim]({size:.1f}KB, {match_type})[/dim]")
            else:
                # Single match without detailed info
                from pathlib import Path
                tree.add(f"📄 {Path(result['path']).name}")
            
            tree.add(f"\n[bold]Total:[/bold] {len(matches) if matches else 1} match(es)")
            self.console.print(tree)
            return

        # 파일 처리 명령어
        elif command in ["upload", "process", "analyze"]:
            if not args:
                self.console.print(f"[red]Usage: {command} [root_folder] <file>[/red]")
                self.console.print("[dim]Examples: upload article, upload docs/tech article[/dim]")
                return

            # Pre-LLM file discovery: 파일 찾기 먼저 실행
            from pathlib import Path
            from rich.tree import Tree
            import config

            # Parse args: check if first part is a directory (root folder)
            search_root, query = self._parse_root_and_query(args)

            if not Path(query).exists():
                search_msg = f"🔍 Searching for: {query}"
                if search_root:
                    search_msg += f" in {search_root}"
                self.console.print(f"\n[dim]{search_msg}[/dim]")
                result = self.pm.check_file_exists(query, quiet=True, search_root=search_root)
                
                if result["exists"]:
                    resolved_path = result["path"]
                    matches = result.get("matches", [])
                    
                    # Show tree view like find command
                    tree = Tree(f"[bold green]✅ Found:[/bold green]")
                    
                    if matches:
                        project_root = config.PROJECT_ROOT
                        match = matches[0]  # Use first/best match
                        file_path = Path(match.get("path", resolved_path))
                        parent = file_path.parent
                        
                        # Get relative path
                        try:
                            rel_path = parent.relative_to(project_root)
                        except ValueError:
                            rel_path = parent.name
                        
                        # If nested folder structure
                        if parent.name == file_path.stem:
                            folder_branch = tree.add(f"📁 [blue]{rel_path}/[/blue]")
                            for item in sorted(parent.iterdir(), key=lambda x: (x.suffix != '.md', x.name)):
                                if item.is_file():
                                    size_kb = item.stat().st_size / 1024
                                    icon = "📷" if item.suffix in [".png", ".jpg", ".jpeg", ".gif", ".webp"] else "📄"
                                    is_md = " [green]← uploading[/green]" if item.suffix == ".md" else ""
                                    folder_branch.add(f"{icon} {item.name} [dim]({size_kb:.1f}KB)[/dim]{is_md}")
                        else:
                            try:
                                rel_file = file_path.relative_to(project_root)
                            except ValueError:
                                rel_file = file_path.name
                            tree.add(f"📄 [blue]{rel_file}[/blue]")
                    else:
                        tree.add(f"📄 {Path(resolved_path).name}")
                    
                    self.console.print(tree)
                    
                    # Ask for confirmation before proceeding
                    if not bypass_confirm:
                        self.console.print()
                        try:
                            confirm = await asyncio.get_event_loop().run_in_executor(
                                None, 
                                lambda: self.session.prompt("Proceed with upload? (y/n): ")
                            )
                            if confirm.lower() not in ['y', 'yes']:
                                self.console.print("[yellow]Upload cancelled.[/yellow]")
                                return
                        except (KeyboardInterrupt, EOFError):
                            self.console.print("[yellow]Upload cancelled.[/yellow]")
                            return
                    
                    # Use resolved path for the task
                    args = resolved_path
                else:
                    self.console.print(f"[red]   ❌ No matching files found for: {args}[/red]")
                    self.console.print("[dim]   Use 'files' command to see available files[/dim]")
                    return

            await self.execute_task(user_input, args)

        # 자연어 명령
        else:
            await self.execute_task(user_input, "")

    async def execute_task(self, user_command: str, file_path: str = ""):
        """작업 실행"""
        self.console.print()
        self.console.print("─" * 60)
        self.console.print(f"[bold]Executing:[/bold] {user_command}")
        self.console.print("─" * 60)
        self.console.print()

        start_time = datetime.now()

        # Task 생성 (filename으로 task_id 포맷 설정)
        from pathlib import Path
        filename = Path(file_path).name if file_path else None
        
        task = AgentTask.create(
            action="process",
            data={"user_command": user_command, "file_path": file_path},
            filename=filename,
        )

        try:
            # ProjectManager에게 위임
            result = await self.pm.run(task.to_dict())

            # 히스토리에 추가
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

    def load_history(self):
        """히스토리 로드"""
        if CLI_HISTORY_FILE.exists():
            try:
                with open(CLI_HISTORY_FILE, "r") as f:
                    data = json.load(f)
                    self.history = data.get("commands", [])
            except Exception as e:
                self.console.print(
                    f"[yellow]Warning: Could not load history: {e}[/yellow]"
                )

    def save_history(self):
        """히스토리 저장"""
        try:
            with open(CLI_HISTORY_FILE, "w") as f:
                json.dump(
                    {
                        "commands": self.history[-100:],  # 최근 100개만
                        "last_session": datetime.now().isoformat(),
                    },
                    f,
                    indent=2,
                )
        except Exception as e:
            self.console.print(f"[yellow]Warning: Could not save history: {e}[/yellow]")

    async def run(self):
        """메인 루프"""
        await self.initialize()
        self.print_banner()

        while self.running:
            try:
                # 사용자 입력
                user_input = await asyncio.to_thread(
                    self.session.prompt, "blog-agent> "
                )

                user_input = user_input.strip()

                if not user_input:
                    continue

                # 명령어 처리
                await self.process_command(user_input)

            except KeyboardInterrupt:
                self.console.print("\n[yellow]Use 'exit' to quit[/yellow]")

            except EOFError:
                break

            except Exception as e:
                self.console.print(f"[red]Error: {e}[/red]")

        self.save_history()


async def main():
    """Entry point"""
    cli = MultiAgentCLI()
    await cli.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nBye!")
