---
description: Start an orchestrator session. Reads backlog, picks tasks, assigns agents.
---

# Start Orchestrator Session

The main session is a lightweight orchestrator: read the backlog, plan work, spawn agents, review results, create PRs.

## Agents

| Agent | Scope | Use for |
|-------|-------|---------|
| `backend-engineer` | `src/`, `tests/`, migrations, k6, config | Backend implementation |
| `frontend-engineer` | `client/src/`, `e2e/` | Frontend implementation |
| `test-engineer` | All test suites | Cross-branch verification, complex debugging, test maintenance |
| `docs-auditor` | `docs/`, `CLAUDE.md`, `README.md` | Documentation audit (via `/update-docs`) |
| `settings-reviewer` | `.claude/` config files | Claude Code config audit (via `/review-settings`) |

**Delegate** when a task requires code changes + testing, or multiple independent tasks can run in parallel.
**Work inline** for trivial edits, planning, backlog updates, PR creation, and read-only analysis.

Spawn with `isolation: "worktree"` so agents get their own repo copy.
Agents commit but never push — the orchestrator owns push + PR lifecycle.

---

## 1. Read Context

- Read `docs/todo.md` for the current backlog
- Run `git status` and `git branch` to check working tree state
- If there are uncommitted changes, warn before proceeding

## 2. Present Backlog

Show items grouped by priority: Critical > Should Fix > Nice to Have > Load Tests.
For each item, show a one-line summary and the affected file(s).

## 3. Pick Tasks

Ask the user which item(s) they want to work on this session (1-3 tasks).

For each chosen task, determine:
- **Branch name**: `fix/`, `feat/`, `refactor/`, or `chore/` prefix + kebab-case slug
- **Agent**: `backend-engineer` (src/, tests/, migrations, k6) or `frontend-engineer` (client/src/, e2e/)
- **Test suite**: which tests to run for verification
- **Parallel?**: can this run alongside other tasks, or must it be sequential?

Present the plan as a table:

| # | Task | Branch | Agent | Tests | Parallel? |
|---|------|--------|-------|-------|-----------|

Wait for user approval before proceeding.

## 4. Dispatch

For each approved task, spawn the assigned agent with `isolation: "worktree"`:
- Before implementing, outline your plan. Wait for my approval before writing code.
- Provide: task description, branch name, scope, test suite
- Independent tasks: spawn in parallel
- Dependent or cross-cutting tasks: spawn sequentially
- Cross-cutting (API + UI): backend-engineer first, then frontend-engineer

For trivial changes (typo, one-line fix), suggest working inline instead of spawning an agent.

## 5. Review Results

As agents report back:
- Summarize each result for the user
- Flag any failures or issues that need attention
- Unrelated issues discovered while working, offer to add them to `docs/todo.md`
- Any lessons learned that could help improve future work
- Recommend improvements and optimizations to `./claude/agents/` and `./claude/rules/` if applicable
- When all agents succeed, offer to push branches and create PRs
