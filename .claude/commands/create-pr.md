---
description: Create a new PR
model: sonnet
---

Create a new pull request for the current branch following the Git Flow method.

## Steps

1. Confirm the base branch is correct (should be the immediate parent or `develop` in a stack, never main)
2. Run `bun run typecheck`, `bun run lint`, `bun run test:all`
2. Confirm the branch is up to date with the base branch
3. Create the PR with a clear title and description
4. Assign reviewers if applicable

### Git & PR Workflow
- Each task = one branch = one PR. Clean separation.
- Always verify the base branch is set to the correct parent branch in the stack, not `main`.
- Before running `gh pr create`, confirm the `--base` flag targets the immediate parent branch.