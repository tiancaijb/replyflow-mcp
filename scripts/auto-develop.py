#!/usr/bin/env python3
"""ReplyFlow MCP Server — Auto-develop script for matt-flow"""

import subprocess, os, sys, time, re
from pathlib import Path

PROJECT_DIR = Path("/home/wangy/dev/replyflow-mcp")
TICKETS_DIR = PROJECT_DIR / "scratch" / "tickets"
MAX_RETRIES = 3

def run(cmd, **kw):
    print(f"  🚀 {cmd[:100]}...")
    return subprocess.run(cmd, shell=True, cwd=PROJECT_DIR, **kw)

def get_completed_tickets():
    result = run("git log --oneline --format='%s'", capture_output=True, text=True)
    if result.returncode != 0:
        return set()
    completed = set()
    for line in result.stdout.splitlines():
        m = re.match(r"ticket-(\d{4})", line)
        if m:
            completed.add(m.group(1))
    return completed

def get_all_tickets():
    tickets = []
    for f in sorted(TICKETS_DIR.glob("*.md")):
        m = re.match(r"(\d{4})", f.stem)
        if m:
            tickets.append((m.group(1), f))
    return tickets

def implement_ticket(ticket_id, ticket_path):
    spec_path = PROJECT_DIR / "scratch" / "SPEC.md"
    cmd = (
        f"cd {PROJECT_DIR} && "
        f"pi -p --no-session @{spec_path} @{ticket_path} '实现这个 ticket'"
    )
    result = run(cmd, timeout=300)
    return result.returncode == 0

def verify():
    """Try npm run build or tsc"""
    pkg = PROJECT_DIR / "package.json"
    if pkg.exists():
        result = run("npm run build", timeout=60)
        if result.returncode == 0:
            return True
    # Fallback: check tsc
    result = run("npx tsc --noEmit 2>/dev/null", timeout=60)
    return result.returncode == 0

def commit(ticket_id):
    run("git add -A")
    result = run(f'git commit -m "ticket-{ticket_id}"', timeout=30)
    return result.returncode == 0

def main():
    print("=" * 50)
    print("ReplyFlow MCP — Auto Develop")
    print("=" * 50)

    completed = get_completed_tickets()
    all_tickets = get_all_tickets()

    print(f"\n已完成 {len(completed)} 个 ticket")
    print(f"共 {len(all_tickets)} 个 ticket")

    for ticket_id, ticket_path in all_tickets:
        if ticket_id in completed:
            print(f"  ✅ ticket-{ticket_id} 已完成，跳过")
            continue

        print(f"\n{'='*50}")
        print(f"  实现 ticket-{ticket_id}: {ticket_path.name}")
        print(f"{'='*50}")

        success = False
        for attempt in range(1, MAX_RETRIES + 1):
            print(f"\n  尝试第 {attempt}/{MAX_RETRIES} 次...")
            ok = implement_ticket(ticket_id, ticket_path)
            if not ok:
                print(f"  ❌ 实现失败")
                continue
            print(f"  ✅ 实现完成，验证中...")
            if verify():
                print(f"  ✅ 验证通过")
                success = True
                break
            else:
                print(f"  ❌ 验证失败")

        if not success:
            print(f"\n  ❌ ticket-{ticket_id} 重试 {MAX_RETRIES} 次均失败")
            sys.exit(1)

        if commit(ticket_id):
            print(f"  ✅ 已提交 ticket-{ticket_id}")
        else:
            print(f"  ❌ 提交失败")
            sys.exit(1)

    print(f"\n{'='*50}")
    print("  🎉 所有 ticket 已完成！")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
