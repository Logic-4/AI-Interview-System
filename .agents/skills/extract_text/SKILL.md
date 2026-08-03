---
name: Extract Content to Markdown
description: Use this skill when the user provides a large document (like a PDF or DOCX file) or asks you to process heavy files.
---

# Extract Content to Markdown Skill

When a user wants you to analyze a heavy document (like an applicant's resume or a long job description PDF):

1. **Do not attempt to read the raw binary file directly into the context.**
2. Instruct the user to either:
   - Convert the file to `.md` (Markdown) or plain `.txt` manually and provide it.
   - Or, if you have shell access, use Python/Node scripts to extract the text and save it to a `.md` file first.
3. Read ONLY the generated `.md` file. 

This prevents token bloating and ensures you only consume what is absolutely necessary for the task.
