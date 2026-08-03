# AI Interview System - Agent Rules

These rules apply to all AI agents operating within this workspace to prevent token limit exhaustion and maintain clean project context.

## 1. Token Conservation & Updates
- Do not read the entire `/backend` or `/frontend` directories blindly. Target specific files only.
- Never output full files when modifying code. Only output the partial modified code block.
- Keep your explanations extremely concise. Avoid pleasantries.

## 2. File Context
- Never upload or attempt to parse raw `.pdf`, `.docx`, or large `.csv` files into the context directly without using a text-extraction skill first.
- If you start a new conversation or session, require the user to provide the most recent session summary rather than re-evaluating the entire codebase.

## 3. Communication
- Ask clarifying questions before building complex features. Use an "Ask User Question" approach instead of guessing and burning tokens on incorrect outputs.
