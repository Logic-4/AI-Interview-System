# AI Prompt Library & Workflows

To save tokens and get the best results from Claude or ChatGPT on this project, use these structured prompts.

## 1. Feature Implementation (The "Ask Me Questions" Approach)
*Instead of writing a 500-word prompt, let the AI ask you what it needs.*
> "I want to [add a new feature / build X] to [success criteria]. Read `CLAUDE.md` and `SESSION_NOTES_TEMPLATE.md` (or your current session notes). Ask me questions before you start."

## 2. Bug Fixing (The Targeted Approach)
*Do not upload the whole project for one bug.*
> "The following error occurs in `/backend/controllers/[file].js`: [Paste error]. Only read this file and its direct dependencies. Provide a targeted fix without rewriting the entire file."

## 3. Editing Existing Code (The "Partial Update" Approach)
*Fewer generated tokens = cheaper and faster.*
> "Update section [X] in `[file]`. Only output the updated section. Keep everything else to save tokens. No commentary. No explanations. Just the output."

## 4. Batch Processing
*Batch your tasks into one message instead of three separate prompts. One reload instead of three.*
> "1. Summarize [file], 2. List the main points, 3. Suggest an alternative architecture based on the summary."

## General Rules for AI Usage
- **Convert Heavy Files:** Convert PDFs, DOCX, or PPTX to plain `.md` text before uploading to the AI context.
- **Start Fresh:** Start a new chat when the topic changes.
- **Use Session Notes:** Carry over knowledge using session notes instead of dumping your entire project folder.
- **Think Cheap, Build Expensive:** Plan complex tasks in Chat (cheaper), then build them in a deep workspace/coding environment once the plan is solid.
