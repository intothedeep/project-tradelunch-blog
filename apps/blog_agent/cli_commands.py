"""
cli_commands.py — Command handler coroutines for the blog-agent CLI.

Each async function handles one CLI command and delegates all Rich rendering
to cli_display. The handlers receive the minimum shared state they need
(pm, console, session, history) as explicit arguments — no global state.
"""

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING, Any

from rich.console import Console
from rich.tree import Tree

from cli_display import (
    build_find_tree,
    build_upload_preview_tree,
    print_help,
    show_history,
    show_status,
)

if TYPE_CHECKING:
    from prompt_toolkit import PromptSession


async def handle_help(console: Console) -> None:
    """Print help panel."""
    print_help(console)


async def handle_status(
    console: Console, pm: Any, history: list[dict]
) -> None:
    """Render system status."""
    show_status(console, pm.get_agents_info(), len(history))


async def handle_agents(pm: Any) -> None:
    """Show agent tree via LoggingAgent."""
    pm.logging_agent.show_agent_tree(pm.get_agents_info())


async def handle_history(
    console: Console, history: list[dict], args: str
) -> None:
    """Show recent command history table."""
    n = int(args) if args.isdigit() else 5
    show_history(console, history, n)


async def handle_files(pm: Any, args: str) -> None:
    """Print file tree. args may specify a root dir."""
    pm.print_file_tree(args if args else "posts")


async def handle_find(
    console: Console,
    pm: Any,
    args: str,
    parse_root_and_query,  # callable injected from MultiAgentCLI
) -> None:
    """Handle the `find` command."""
    if not args:
        console.print("[red]Usage: find [root_folder] <query>[/red]")
        console.print("[dim]Examples: find article, find docs/tech article[/dim]")
        return

    import config
    search_root, query = parse_root_and_query(args)
    result = pm.check_file_exists(query, quiet=True, search_root=search_root)
    matches = result.get("matches", [])

    if not result["exists"]:
        console.print(f"[red]❌ No matches found for: {args}[/red]")
        console.print("[dim]Use 'files' command to see all available files[/dim]")
        return

    label = f"🔍 [bold]Search results for:[/bold] [cyan]{args}[/cyan]"
    if matches:
        tree = build_find_tree(label, matches, config.PROJECT_ROOT)
    else:
        tree = Tree(label)
        tree.add(f"📄 {Path(result['path']).name}")
        tree.add("\n[bold]Total:[/bold] 1 match(es)")
    console.print(tree)


async def handle_file_command(
    console: Console,
    pm: Any,
    session: "PromptSession",
    command: str,
    args: str,
    bypass_confirm: bool,
    user_input: str,
    parse_root_and_query,  # callable injected from MultiAgentCLI
    execute_task,          # callable injected from MultiAgentCLI
) -> None:
    """Handle upload / process / analyze commands."""
    if not args:
        console.print(f"[red]Usage: {command} [root_folder] <file>[/red]")
        console.print("[dim]Examples: upload article, upload docs/tech article[/dim]")
        return

    import config
    search_root, query = parse_root_and_query(args)

    if not Path(query).exists():
        search_msg = f"🔍 Searching for: {query}"
        if search_root:
            search_msg += f" in {search_root}"
        console.print(f"\n[dim]{search_msg}[/dim]")

        result = pm.check_file_exists(query, quiet=True, search_root=search_root)

        if result["exists"]:
            resolved_path = result["path"]
            matches = result.get("matches", [])
            tree = build_upload_preview_tree(resolved_path, matches, config.PROJECT_ROOT)
            console.print(tree)

            if not bypass_confirm:
                console.print()
                try:
                    confirm = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: session.prompt("Proceed with upload? (y/n): "),
                    )
                    if confirm.lower() not in {"y", "yes"}:
                        console.print("[yellow]Upload cancelled.[/yellow]")
                        return
                except (KeyboardInterrupt, EOFError):
                    console.print("[yellow]Upload cancelled.[/yellow]")
                    return

            args = resolved_path
        else:
            console.print(f"[red]   ❌ No matching files found for: {args}[/red]")
            console.print("[dim]   Use 'files' command to see available files[/dim]")
            return

    await execute_task(user_input, args)
