# AI Mock Interview Training System

## Overview

This system simulates real interview sessions using AI. It helps candidates practice, get scored, and improve based on real job requirements.

For the question/TTS latency architecture, production findings, benchmark procedure, and deployment requirements, see [`docs/PERFORMANCE_AUDIT.md`](docs/PERFORMANCE_AUDIT.md).

The system does more than ask questions. It builds a full interview flow based on the job description, tracks performance, and gives clear feedback.

---

## Core Goal

Help candidates prepare for real interviews by:

- Generating realistic questions
- Evaluating answers based on the job role
- Giving clear, useful feedback
- Tracking progress over time

---

## System Flow (End-to-End)

### 1. Candidate Onboarding

The candidate starts by setting up an interview.

**Inputs:**
- Target job role
- Job description (text or file)
- Experience level (Intern / Junior / Mid / Senior)
- Interview type (HR / Technical / Behavioral / Mixed)
- Skills to focus on
- Interview duration
- Language (optional)
- Seniority goal (optional)

**Output:**
- `InterviewContext` object  
  This drives the entire session.

---

### 2. Job Description Parsing

The system analyzes the job description.

**Extracted Data:**
- Key skills
- Responsibilities
- Required vs optional skills
- Keywords to expect in answers
- Real-world scenarios

**Output:**
- `RoleProfile`
- Scoring signals

---

### 3. Question Generation

The system builds a full interview plan.

**Inputs:**
- InterviewContext
- RoleProfile
- Question templates / bank
- Candidate history

**Process:**
- Decide structure (HR / Technical / etc.)
- Select number of questions based on time
- Assign purpose to each question
- Add follow-up rules

**Output:**
- `InterviewPlan`
  - Ordered questions
  - Difficulty levels
  - Question goals
- Scoring rubric per question

---

### 4. Live Interview Session

The system runs an interactive loop.

**Per Question:**
1. Ask question (voice + text)
2. Record candidate answer
3. Detect end of response
4. Save audio
5. Optionally ask follow-up

**Follow-up logic:**
- If vague → ask for example
- If weak → ask for explanation
- If incorrect → ask for reasoning

**Outputs:**
- Audio recordings
- Transcripts (optional)
- Basic feedback (optional)

---

### 5. Scoring Pipeline

Each answer is evaluated.

#### A. Speech Processing
- Convert audio → text
- Confidence score

#### B. Content Evaluation
- Relevance
- Match with job description
- Coverage
- Technical correctness

#### C. Communication Evaluation
- Clarity
- Structure
- Fluency
- Confidence
- Grammar

#### D. Optional Signals
- Pronunciation issues
- Stress indicators

**Output:**
- Per-question score
- Section scores
- Overall score

---

### 6. Feedback Generation

Feedback must be clear and actionable.

**Per Question:**
- What went well
- What needs improvement
- Missing points
- Better answer structure
- Short improved example

**Session Summary:**
- Strengths
- Weaknesses
- Action plan (3–5 steps)
- Suggested practice questions

**Output:**
- Full report (PDF or web)
- Summary download

---

### 7. Practice Loop

Candidates improve using feedback.

**Options:**
- Retry same question
- Practice weak areas
- Run new session with variation

**System Uses:**
- Previous feedback
- Weak signals

**Output:**
- Before vs after comparison
- Improvement scores

---

### 8. Progress Tracking

Tracks long-term growth.

**Dashboard Data:**
- Score trends
- Subscores (clarity, fluency, etc.)
- Role-based performance
- Repeated mistakes
- Keyword coverage

The application is candidate-facing; it does not expose administrative dashboards or user-management endpoints.

---

## Core Product Deployment

Configure these backend environment variables so password-reset messages are delivered through Resend:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=InterviewAI <noreply@your-verified-domain.com>
CLIENT_URL=https://www.interviewsystem.app
EMAIL_LOGO_URL=https://www.interviewsystem.app/ai-interview-logo.svg
EMAIL_SUPPORT_URL=https://www.interviewsystem.app/contact
EMAIL_SUPPORT_EMAIL=support@interviewsystem.app
```

After deploying the schema changes, run the one-time migration with the backend's `MONGO_URI`:

```bash
cd backend
npm run migrate:core-product
```

It backfills evaluation states and removes retired camera/body-language and subscription fields while preserving valid answers, scores, feedback, and retries.

---

## Key Objects

### InterviewContext
- User inputs
- Session config
- Preferences

### RoleProfile
- Skills
- Responsibilities
- Keywords
- Expectations

### InterviewPlan
- Questions
- Structure
- Difficulty
- Goals

### ScoringResult
- Per-question scores
- Section scores
- Final score

### FeedbackReport
- Detailed feedback
- Suggestions
- Action plan

---

## AI Behavior Rules

The AI agent must:

1. Use the job description as the main reference
2. Avoid random questions
3. Adjust difficulty based on experience
4. Avoid repeating past questions
5. Ask follow-ups when needed
6. Score based on:
   - relevance
   - clarity
   - correctness
7. Give feedback that is:
   - specific
   - short
   - actionable

---

## What Makes This System Different

- Job-aware evaluation
- Voice + content + behavior analysis
- Real interview structure
- Continuous improvement loop
- Personalized feedback

---

## Expected Outcome

After multiple sessions, the candidate should:

- Speak more clearly
- Answer with structure
- Match job expectations better
- Reduce filler words
- Gain confidence

---

## Local Somali speech services

Somali uses Python ASR/TTS on ports **8001** (ASR) and **8002** (TTS). English speech uses the dedicated Whisper Turbo + Kokoro worker described below.

**One-time Somali setup** (required — the bundled `Skydheere/.venv` may point to another machine's Python):

```bash
cd backend && npm run setup:somali-speech
```

This creates `Models/.venv` and installs ASR + TTS dependencies.

**Automatic start (dev):** With `SOMALI_AUTO_START=true` in root `.env`, the backend spawns Somali ASR/TTS when you run:

```bash
cd backend && npm run dev
```

First launch can take **1–3 minutes** while models load. Wait for backend logs: `[somali-tts] Ready at http://127.0.0.1:8002`.

## English speech services: Whisper Turbo + Kokoro

English interviews use a dedicated GPU speech worker in production. It transcribes the final recording with `openai/whisper-large-v3-turbo` and synthesizes interviewer audio with `hexgrad/Kokoro-82M`; Somali speech services are unchanged.

Deploy `services/english-speech` as its own persistent GPU RunPod endpoint, then configure the backend:

```env
ENGLISH_ASR_URL=https://api.runpod.ai/v2/<english-speech-endpoint>
ENGLISH_TTS_URL=https://api.runpod.ai/v2/<english-speech-endpoint>
KOKORO_VOICE=af_heart
ENGLISH_ASR_TIMEOUT_MS=90000
ENGLISH_ASR_MAX_BYTES=31457280
ENGLISH_ASR_MAX_SECONDS=180
INTERVIEW_WARM_TTL_MS=120000
```

The worker accepts `transcribe`, `synthesize`, `warmup`, and `health` actions. It requires NVIDIA CUDA for Whisper Turbo. Browser speech remains the final client fallback if the English worker is unavailable.

For RunPod Serverless with **Active Workers = 0**, attach a network volume at
`/runpod-volume` so Hugging Face model downloads survive worker replacement, and
set the endpoint idle timeout to at least **180 seconds**. The app warms models
when interview setup opens, forces a fresh warm-up at the final setup step, and
sends a warm heartbeat every 120 seconds while the interview page is visible.
Only the selected language's speech endpoint is warmed; English setup does not
start the Somali ASR/TTS workers, and Somali setup does not start Whisper/Kokoro.
This avoids paying for a 24/7 active worker while keeping the GPU alive during
an actual interview. A shorter RunPod idle timeout defeats the heartbeat and
causes repeated cold starts.
