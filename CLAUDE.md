# AI Mock Interview Training System - Claude Context

## Project Overview
This project simulates real interview sessions using AI. It contains a Node.js/Express backend and a React (Vite) frontend. 
The application is candidate-facing; it does not expose administrative dashboards.

## Architecture & Tech Stack
- **Backend:** Node.js (v20), Express, MongoDB. Located in `/backend`.
- **Frontend:** React, Vite, TailwindCSS, Zustand, Radix UI. Located in `/frontend`.
- **Speech Services:** Local Python ASR/TTS for Somali. Whisper Turbo + Kokoro for English on RunPod.

## AI Interaction Guidelines (To Save Context & Tokens)
*These rules apply to Claude, ChatGPT, and any AI interacting with this repository.*

1. **Be Concise:** Do not output long explanations. Provide only the requested code, fix, or exact answer. No pleasantries.
2. **Partial Updates:** When asked to edit a section of a file, only provide the changed code block. Do NOT rewrite the entire file unless asked. 
3. **Avoid Broad Searches:** Do not read the entire `/backend` or `/frontend` directories. Read only the specific file(s) being worked on. (Zero folders = tokens saved).
4. **Session Handoff:** At the end of deep work, output a brief summary based on `SESSION_NOTES_TEMPLATE.md`. In your next chat, just read that summary instead of reading the whole project.
5. **No Blind Output:** Ask clarifying questions before writing long scripts or doing major refactors.
6. **One Task at a Time:** Batch tasks in one prompt if they are simple. If complex, plan first.

## Common Commands
- Root Backend: `npm run start`
- Frontend Dev: `cd frontend && npm run dev`
- Backend Dev: `cd backend && npm run dev`
- Seed Superadmin: `npm run seed:superadmin` (from root)

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
