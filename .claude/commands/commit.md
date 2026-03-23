---
description: Create conventional commits with emoji. Use when committing code changes.
---

# Commit with Emoji

Create well-formatted git commits using conventional commit format with emoji prefixes.

## Steps

1. Run `git status` to check staged files
2. If nothing is staged, list modified and untracked files, then stage only the relevant files by name — NEVER use `git add -A` or `git add .`
3. Run `git diff --cached --stat` to understand what changed
4. Analyze the diff for distinct logical changes
5. If multiple unrelated changes exist, suggest splitting into separate commits
6. For each commit, write a message using the format below
7. Run `git commit -m "<message>"` — do NOT push

## Message Format

```
<emoji> <type>: <short description>
```

Keep the first line under 72 characters. Use present tense, imperative mood.

## Emoji Map

| Emoji | Type | When |
|-------|------|------|
| ✨ | feat | New feature |
| 🐛 | fix | Bug fix |
| 🚑️ | fix | Critical hotfix |
| ♻️ | refactor | Code restructuring |
| 📝 | docs | Documentation |
| ✅ | test | Tests |
| ⚡️ | perf | Performance |
| 🔧 | chore | Config, tooling |
| 🗃️ | db | Database changes |
| 🔒️ | fix | Security fix |
| 💄 | style | UI/formatting |
| 🎉 | chore | Initial commit |
| ➕ | chore | Add dependency |
| ➖ | chore | Remove dependency |
| 🔥 | fix | Remove code/files |
| 🚀 | ci | CI/CD changes |

## Rules

- NEVER run `git push` — only commit locally
- One logical change per commit
- If unsure about splitting, ask before committing
