"""
cli_display.py — Pure UI rendering helpers for the blog-agent CLI.

All functions take explicit inputs and write to a Rich Console.
No side effects beyond console output. No global state.
"""

from pathlib import Path
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from config import MODEL_NAME


def print_banner(console: Console) -> None:
    """Print the start-up banner."""
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
    console.print(banner)


def print_help(console: Console) -> None:
    """Print the help panel."""
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
    console.print(Panel(help_text, title="Help", border_style="cyan"))


def show_status(console: Console, agents_info: list[dict[str, Any]], history_len: int) -> None:
    """Render the system status panel.

    Args:
        console: Rich Console to write to.
        agents_info: Output of ProjectManagerAgent.get_agents_info().
        history_len: Number of commands executed this session.
    """
    status_text = """[bold]System Status:[/bold]

[bold]Agents:[/bold]"""

    icon_map = {
        "idle": "🟢",
        "running": "🟡",
        "completed": "✅",
        "failed": "🔴",
    }
    for agent in agents_info:
        icon = icon_map.get(agent["status"], "⚪")
        status_text += f"\n  {icon} {agent['name']}: [{agent['status']}]"

    status_text += f"""

[bold]Session:[/bold]
  • Commands executed: {history_len}
  • Model: {MODEL_NAME}
"""
    console.print(Panel(status_text, title="📊 Status", border_style="green"))


def show_history(console: Console, history: list[dict[str, Any]], n: int = 5) -> None:
    """Render the command history table.

    Args:
        console: Rich Console to write to.
        history: Full session history list (most-recent slice taken internally).
        n: How many recent entries to display.
    """
    if not history:
        console.print("[yellow]No command history[/yellow]")
        return

    recent = history[-n:]
    table = Table(title=f"Last {len(recent)} Commands")
    table.add_column("#", style="cyan", width=6)
    table.add_column("Command", style="white", width=50)
    table.add_column("Time", style="dim", width=20)
    table.add_column("Status", width=12)

    for i, cmd in enumerate(recent, 1):
        status_str = "[green]✅[/green]" if cmd.get("success") else "[red]❌[/red]"
        table.add_row(str(i), cmd["command"][:50], cmd["timestamp"], status_str)

    console.print(table)


def build_find_tree(
    label: str,
    matches: list[dict[str, Any]],
    project_root: Path,
) -> Tree:
    """
    Build a Rich Tree for `find` results.

    Args:
        label: Top-level tree label text (already Rich-markup-formatted).
        matches: List of match dicts with 'path' and 'match_type' keys.
        project_root: Used to compute relative display paths.

    Returns:
        A populated Rich Tree ready to be printed.
    """
    tree = Tree(label)

    for match in matches:
        path = match.get("path", "")
        match_type = match.get("match_type", "")
        file_path = Path(path)
        parent = file_path.parent

        try:
            rel_path = parent.relative_to(project_root)
        except ValueError:
            rel_path = parent.name  # type: ignore[assignment]

        if parent.name == file_path.stem:
            folder_branch = tree.add(
                f"📁 [blue]{rel_path}/[/blue] [dim]({match_type})[/dim]"
            )
            for item in sorted(
                parent.iterdir(), key=lambda x: (x.suffix != ".md", x.name)
            ):
                if item.is_file():
                    size_kb = item.stat().st_size / 1024
                    icon = (
                        "📷"
                        if item.suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}
                        else "📄"
                    )
                    is_md = " [green]← main[/green]" if item.suffix == ".md" else ""
                    folder_branch.add(
                        f"{icon} {item.name} [dim]({size_kb:.1f}KB)[/dim]{is_md}"
                    )
        else:
            try:
                rel_file = file_path.relative_to(project_root)
            except ValueError:
                rel_file = file_path.name  # type: ignore[assignment]
            size = file_path.stat().st_size / 1024 if file_path.exists() else 0
            tree.add(
                f"📄 [blue]{rel_file}[/blue] [dim]({size:.1f}KB, {match_type})[/dim]"
            )

    tree.add(f"\n[bold]Total:[/bold] {len(matches)} match(es)")
    return tree


def build_upload_preview_tree(
    resolved_path: str,
    matches: list[dict[str, Any]],
    project_root: Path,
) -> Tree:
    """
    Build a Rich Tree previewing the file that will be uploaded.

    Args:
        resolved_path: Absolute path of the resolved file.
        matches: Raw match list from check_file_exists (first entry used).
        project_root: Used to compute relative display paths.

    Returns:
        A populated Rich Tree ready to be printed.
    """
    tree = Tree("[bold green]✅ Found:[/bold green]")

    if matches:
        match = matches[0]
        file_path = Path(match.get("path", resolved_path))
        parent = file_path.parent

        try:
            rel_path = parent.relative_to(project_root)
        except ValueError:
            rel_path = parent.name  # type: ignore[assignment]

        if parent.name == file_path.stem:
            folder_branch = tree.add(f"📁 [blue]{rel_path}/[/blue]")
            for item in sorted(
                parent.iterdir(), key=lambda x: (x.suffix != ".md", x.name)
            ):
                if item.is_file():
                    size_kb = item.stat().st_size / 1024
                    icon = (
                        "📷"
                        if item.suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}
                        else "📄"
                    )
                    is_md = (
                        " [green]← uploading[/green]" if item.suffix == ".md" else ""
                    )
                    folder_branch.add(
                        f"{icon} {item.name} [dim]({size_kb:.1f}KB)[/dim]{is_md}"
                    )
        else:
            try:
                rel_file = file_path.relative_to(project_root)
            except ValueError:
                rel_file = file_path.name  # type: ignore[assignment]
            tree.add(f"📄 [blue]{rel_file}[/blue]")
    else:
        tree.add(f"📄 {Path(resolved_path).name}")

    return tree
