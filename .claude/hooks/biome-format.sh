#!/bin/bash
# PostToolUse hook — auto-formats files after Write/Edit
# Runs Biome on TypeScript, JavaScript, and JSON files to enforce
# project formatting rules (no semicolons, 2-space indent, 100-char lines).
# Reads the tool output from stdin to extract the file path.
# Failures are silenced — formatting is best-effort, never blocks edits.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -n "$FILE" ] && echo "$FILE" | grep -qE '\.(ts|tsx|js|json)$'; then
  bunx biome check --write "$FILE" 2>/dev/null || true
fi
