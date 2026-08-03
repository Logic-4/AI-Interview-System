---
name: Summarize Session
description: Use this skill at the end of a coding session to write a summary report for future agents, preventing the need to re-read the entire codebase.
---

# Summarize Session Skill

When a user asks you to wrap up, end the session, or hand off the work, execute the following steps:

1. Review the key actions, code changes, and decisions made during the current conversation.
2. Format these points using the exact structure defined in `SESSION_NOTES_TEMPLATE.md`.
3. Save the output to a file named `SESSION_NOTES_[DATE].md` in the root of the project (e.g., `SESSION_NOTES_2026-08-03.md`).
4. Remind the user that they can upload or provide this file in their next chat session to restore context without burning tokens.
