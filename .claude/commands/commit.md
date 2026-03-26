---
description: Create conventional commits with emoji. Use when committing code changes.
model: sonnet
---

Create well-formatted git commits using conventional commit format with emoji prefixes.

## Steps

1. Run `git status` to check all relevant files
2. Analyze all staged, modifed and untracked files to understand what changed
3. If multiple unrelated changes exist, consider separate commits to keep changes clean
4. For each commit, write a message using the format below
5. Run `git commit -m "<message>"`

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

- NEVER run `git add -A` or `git add .`
- NEVER run `git push` — only commit locally
- NEVER add `Co-Authored-By` or any AI attribution trailer to commit messages
- ALWAYS review all changed files for errors and consistency
- One logical change per commit
- If unsure about splitting, ALWAYS ask before committing
