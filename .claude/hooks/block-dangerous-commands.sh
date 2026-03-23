#!/bin/bash
# PreToolUse hook — blocks destructive commands before Bash execution
# Catches accidental database destruction, force pushes, and
# production-targeting Heroku/database commands.
# Exit 2 = block the tool call. Exit 0 = allow.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block destructive database commands
if echo "$COMMAND" | grep -iE '\b(DROP DATABASE|DROP TABLE|TRUNCATE|DELETE FROM)\b' > /dev/null; then
  echo "BLOCKED: Destructive database operation requires manual execution" >&2
  exit 2
fi

# Block force push
if echo "$COMMAND" | grep -iE 'git push.*(--force|-f)' > /dev/null; then
  echo "BLOCKED: Force push requires manual execution" >&2
  exit 2
fi

# Block production-targeting commands
if echo "$COMMAND" | grep -iE '(heroku.*(--app|run|pg:).*prod|DATABASE_URL.*prod)' > /dev/null; then
  echo "BLOCKED: Production-targeting command detected" >&2
  exit 2
fi

exit 0
