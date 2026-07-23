"""
Gemma interview inference worker for RunPod Serverless.

Loads Mohamud24/gemma-3-technical-interviewer once per worker and routes
requests by endpoint name (same paths as kaggle_fastapi_v2.py).
"""

from __future__ import annotations

import json
import os
import re
import time
import traceback
from typing import Any, Optional, Tuple

import torch
from huggingface_hub import login
from transformers import AutoModelForCausalLM, AutoTokenizer, StoppingCriteria, StoppingCriteriaList

MODEL_ID = os.environ.get("GEMMA_MODEL_ID", "Mohamud24/gemma-3-technical-interviewer")
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()

tokenizer = None
model = None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
generation_timing: dict[str, Any] = {}


def validate_cuda_runtime() -> dict[str, Any]:
    """Launch a tiny kernel so incompatible images fail with useful diagnostics."""
    require_cuda = os.environ.get("REQUIRE_CUDA", "0").strip().lower() in {"1", "true", "yes"}
    if not torch.cuda.is_available():
        message = (
            "CUDA is unavailable. This production image requires a GPU; verify the "
            "RunPod GPU selection and NVIDIA container runtime."
        )
        if require_cuda:
            raise RuntimeError(message)
        print(f"CUDA startup probe skipped: {message}", flush=True)
        return {"available": False, "device": "cpu"}

    properties = torch.cuda.get_device_properties(0)
    capability = f"{properties.major}.{properties.minor}"
    compiled_arches = list(torch.cuda.get_arch_list())
    try:
        probe = torch.ones(1, device="cuda")
        probe.add_(1)
        torch.cuda.synchronize()
        del probe
    except Exception as exc:
        raise RuntimeError(
            "CUDA kernel startup probe failed. "
            f"GPU={properties.name!r}, capability={capability}, "
            f"torch={torch.__version__}, torch_cuda={torch.version.cuda}, "
            f"compiled_arches={compiled_arches}. Use a PyTorch build containing "
            "this GPU architecture or restrict the endpoint to a compatible GPU."
        ) from exc

    result = {
        "available": True,
        "gpu": properties.name,
        "capability": capability,
        "torch": torch.__version__,
        "torch_cuda": torch.version.cuda,
        "compiled_arches": compiled_arches,
    }
    print(f"CUDA startup probe passed: {result}", flush=True)
    return result


def load_model() -> dict[str, Any]:
    global tokenizer, model
    if model is not None:
        return {"coldStart": False, "modelLoadMs": 0}

    started_at = time.perf_counter()

    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN environment variable is required for the gated Gemma model.")

    try:
        login(token=HF_TOKEN)
    except Exception as exc:
        print(f"Warning: Hugging Face login failed: {exc}")

    print(f"Loading base model google/gemma-3-4b-it on {DEVICE}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=HF_TOKEN)
    base_model = AutoModelForCausalLM.from_pretrained(
        "google/gemma-3-4b-it",
        dtype=torch.bfloat16 if DEVICE == "cuda" else torch.float32,
        device_map="auto" if DEVICE == "cuda" else None,
        token=HF_TOKEN,
    )
    
    from peft import PeftModel
    print(f"Loading LoRA adapter {MODEL_ID}...")
    model = PeftModel.from_pretrained(base_model, MODEL_ID, token=HF_TOKEN)
    
    if DEVICE == "cpu":
        model = model.to(DEVICE)
    model.eval()
    load_ms = round((time.perf_counter() - started_at) * 1000, 1)
    print(f"Gemma model ready in {load_ms}ms.")
    return {"coldStart": True, "modelLoadMs": load_ms}


def try_parse_json(text: str) -> Optional[dict]:
    try:
        text = re.sub(r"```[jJ]son\s*", "", text)
        text = re.sub(r"```", "", text).strip()

        first_brace = text.find("{")
        if first_brace == -1:
            return None

        depth = 0
        in_string = False
        escape = False
        last_brace = -1
        for i in range(first_brace, len(text)):
            ch = text[i]
            if escape:
                escape = False
                continue
            if ch == "\\" and in_string:
                escape = True
                continue
            if ch == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    last_brace = i
                    break

        if last_brace == -1:
            return None

        json_str = text[first_brace : last_brace + 1]
        json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
        json_str = re.sub(r"\bTrue\b", "true", json_str)
        json_str = re.sub(r"\bFalse\b", "false", json_str)
        json_str = re.sub(r"\bNone\b", "null", json_str)
        return json.loads(json_str)
    except Exception as exc:
        print("JSON parse exception:", exc)
        return None


def clamp_score(value) -> int:
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, score))


def difficulty_hint(difficulty: str) -> str:
    mapping = {
        "junior": "Entry-level (junior). Expect fundamentals and learning ability.",
        "mid": "Mid-level. Expect practical experience and independent problem solving.",
        "senior": "Senior-level. Expect depth, trade-offs, and leadership examples.",
        "lead": "Lead/expert-level. Expect architecture, mentoring, and strategic thinking.",
        "easy": "Entry-level. Expect fundamentals.",
        "medium": "Mid-level. Expect practical depth.",
        "hard": "Senior-level. Expect advanced depth.",
    }
    return mapping.get((difficulty or "mid").lower(), mapping["mid"])


def category_rubric(category: str, type_str: str) -> str:
    cat = (category or "").lower()
    if "star" in cat or "behavioral" in cat or type_str == "behavioral":
        return (
            "Evaluate using STAR (Situation, Task, Action, Result). "
            "Reward specific examples with measurable outcomes."
        )
    if type_str == "hr" or cat in ("motivation", "culture fit", "experience"):
        return "Evaluate motivation, culture alignment, and role fit."
    if type_str == "technical" or cat in ("core skills", "debugging", "fundamentals", "technical"):
        return "Evaluate technical accuracy, clarity, and practical understanding."
    if type_str == "system-design" or "scenario" in cat:
        return "Evaluate structured thinking, trade-offs, and scalability awareness."
    return "Evaluate clarity, relevance, and completeness."


def build_role_context(role_profile: Optional[dict]) -> str:
    if not role_profile or not isinstance(role_profile, dict):
        return ""
    parts = []
    skills = (role_profile.get("requiredSkills") or [])[:5]
    preferred = (role_profile.get("preferredSkills") or [])[:3]
    stack = (role_profile.get("technicalStack") or [])[:5]
    responsibilities = (role_profile.get("responsibilities") or [])[:3]
    if skills:
        parts.append(f"Required skills: {', '.join(skills)}.")
    if preferred:
        parts.append(f"Preferred skills: {', '.join(preferred)}.")
    if stack:
        parts.append(f"Tech stack: {', '.join(stack)}.")
    if responsibilities:
        parts.append(f"Key responsibilities: {', '.join(responsibilities)}.")
    experience = role_profile.get("experienceLevel") or role_profile.get("experience")
    if experience:
        parts.append(f"Experience level: {experience}.")
    return "\n".join(parts)


def normalize_turn_response(parsed: Optional[dict], raw_text: str = "") -> dict:
    if not parsed or "nextInterviewerResponse" not in parsed:
        return {
            "evaluation": {
                "score": None,
                "feedback": "Could not parse AI response. Answer recorded for review.",
                "strengths": [],
                "improvements": [],
                "suggestedAnswer": "",
            },
            "nextInterviewerResponse": "Thank you. Let's continue.",
            "isFollowUp": False,
            "evaluationStatus": "parse_failed",
        }

    evaluation = parsed.get("evaluation") or {}
    is_follow_up = bool(parsed.get("isFollowUp", False))
    is_topic_complete = parsed.get("isTopicComplete")
    if is_topic_complete is None:
        is_topic_complete = not is_follow_up

    score_raw = evaluation.get("score")
    return {
        "evaluation": {
            "score": clamp_score(score_raw) if score_raw is not None else None,
            "feedback": (evaluation.get("feedback") or "")[:200],
            "strengths": (evaluation.get("strengths") or [])[:3],
            "improvements": (evaluation.get("improvements") or [])[:3],
            "suggestedAnswer": (evaluation.get("suggestedAnswer") or "")[:200],
        },
        "nextInterviewerResponse": (parsed.get("nextInterviewerResponse") or "Thank you.")[:300],
        "isFollowUp": is_follow_up and not is_topic_complete,
        "answeredCandidateQuestion": bool(parsed.get("answeredCandidateQuestion", False)),
        "evaluationStatus": "ok",
    }


class _FirstTokenTimer(StoppingCriteria):
    def __init__(self, started_at: float):
        self.started_at = started_at
        self.first_token_at: Optional[float] = None

    def __call__(self, _input_ids, _scores, **_kwargs) -> bool:
        if self.first_token_at is None:
            self.first_token_at = time.perf_counter()
        return False


def run_generation(messages, max_new_tokens: int, temperature: float = 0.2, do_sample: bool = False) -> str:
    global generation_timing
    started_at = time.perf_counter()
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt").to(DEVICE)
    generation_started_at = time.perf_counter()
    first_token_timer = _FirstTokenTimer(generation_started_at)
    gen_kwargs = {
        "max_new_tokens": max_new_tokens,
        "do_sample": do_sample,
        "use_cache": True,
        "stopping_criteria": StoppingCriteriaList([first_token_timer]),
        "pad_token_id": tokenizer.eos_token_id,
    }
    if do_sample:
        gen_kwargs["temperature"] = temperature
    with torch.no_grad():
        outputs = model.generate(**inputs, **gen_kwargs)
    output_ids = outputs[0][inputs["input_ids"].shape[-1] :]
    finished_at = time.perf_counter()
    generation_timing = {
        "promptConstructionMs": round((generation_started_at - started_at) * 1000, 1),
        "firstTokenMs": round(((first_token_timer.first_token_at or finished_at) - generation_started_at) * 1000, 1),
        "generationMs": round((finished_at - generation_started_at) * 1000, 1),
        "inputTokens": int(inputs["input_ids"].shape[-1]),
        "outputTokens": int(output_ids.shape[-1]),
    }
    return tokenizer.decode(
        output_ids,
        skip_special_tokens=True,
    )


def generate_json_response(messages, max_new_tokens: int, temperature: float = 0.2) -> Tuple[Optional[dict], str]:
    raw = run_generation(messages, max_new_tokens, temperature=temperature, do_sample=temperature > 0)
    parsed = try_parse_json(raw)
    if parsed:
        return parsed, raw
    if temperature > 0:
        raw_retry = run_generation(messages, max_new_tokens, temperature=0.0, do_sample=False)
        parsed_retry = try_parse_json(raw_retry)
        return parsed_retry, raw_retry
    return None, raw


def handle_health(_data: dict) -> dict:
    return {"status": "ok", "model": MODEL_ID, "device": DEVICE}


def handle_interview_turn(data: dict) -> dict:
    conversation_history = data.get("conversationHistory", [])
    domain = data.get("domain", "general")
    role = data.get("role") or data.get("jobRole") or "the open role"
    language = data.get("language", "english")
    type_str = data.get("type", "technical")
    difficulty = data.get("difficulty", "mid")
    current_question = data.get("currentQuestion") or {}
    role_profile = data.get("roleProfile") or {}

    question_text = current_question.get("text", "")
    expected_answer = current_question.get("expectedAnswer", "")
    category = current_question.get("category", "general")
    question_difficulty = current_question.get("difficulty") or difficulty

    lang_hint = (
        "Respond in English. You are a real human hiring manager. "
        "Be direct, conversational, and professional. "
        if language.lower() == "english"
        else
        "IMPORTANT: Your ENTIRE nextInterviewerResponse MUST be in Somali. DO NOT use English! "
        "Ku hadal af-Soomaali dabiici ah oo aad u xirfad iyo naxwe sarreeya. "
        "Fadlan u turjum ama u sharax ereyada farsamada Ingiriisiga ah af-Soomaali dabiici ah "
        "si mashiinka ku dhawaaqista codka (TTS) uu ugu dhawaaqi karo si sax oo dabiici ah."
    )

    somali_note = ""
    if language.lower() == "somali":
        somali_note = (
            "SCORING: The candidate answered in Somali. Evaluate content and meaning only — "
            "never penalize the language. Somali and English answers with the same meaning get the same score.\n\n"
        )

    role_context = build_role_context(role_profile)
    rubric = category_rubric(category, type_str)

    system_prompt = (
        f"You are an expert {domain} interviewer for: {role}.\n"
        f"Interview type: {type_str}. Difficulty: {difficulty_hint(question_difficulty)}.\n"
        f"{lang_hint}\n\n"
        f"{somali_note}"
        f"CURRENT QUESTION: {question_text}\n"
        f"EXPECTED ANSWER RUBRIC: {expected_answer or 'Judge relevance, depth, and clarity for this question category.'}\n"
        f"CATEGORY: {category}. {rubric}\n"
    )
    if role_context:
        system_prompt += f"\nJOB CONTEXT:\n{role_context}\n"

    system_prompt += (
        "\nSCORING (use consistently):\n"
        "- 90-100: Excellent — accurate, complete, strong examples.\n"
        "- 80-89: Good — mostly correct, minor gaps.\n"
        "- 65-79: Partial — some understanding, missing key points.\n"
        "- 40-64: Weak — significant gaps or vague.\n"
        "- Below 40: Off-topic, incorrect, or no substantive answer.\n\n"
        "BEHAVIOR:\n"
        "1. nextInterviewerResponse: 1-2 short sentences max.\n"
        "2. Partial answer → isFollowUp=true, isTopicComplete=false, one short follow-up.\n"
        "3. Good complete answer → isFollowUp=false, isTopicComplete=true.\n"
        "4. If the candidate asks YOU a question (role, team, process, expectations), "
        "answer it briefly and professionally in nextInterviewerResponse, set answeredCandidateQuestion=true. "
        "For outro category, always answer their questions. Stay on topic after answering.\n"
        "5. If they ask for clarification on YOUR question, rephrase briefly — do not repeat the full original question.\n"
        "6. Never ask the same question twice verbatim; if already answered, acknowledge and move on.\n\n"
        "Keep JSON string values under 120 characters.\n"
        "Return ONLY raw JSON:\n"
        '{"evaluation": {"score": 85, "feedback": "...", "strengths": ["..."], '
        '"improvements": ["..."], "suggestedAnswer": "..."}, '
        '"nextInterviewerResponse": "...", "isFollowUp": false, "isTopicComplete": true, '
        '"answeredCandidateQuestion": false}'
    )

    messages = [{"role": "user", "content": system_prompt}]
    for turn in conversation_history:
        role_map = {"interviewer": "assistant", "candidate": "user", "system": "user"}
        mapped_role = role_map.get(turn.get("role"), "user")
        content = turn.get("content", "")
        if not content:
            continue
        if messages[-1]["role"] == mapped_role:
            messages[-1]["content"] += "\n\n" + content
        else:
            messages.append({"role": mapped_role, "content": content})

    instruction = "Evaluate the candidate's LAST answer only. Return strict JSON."
    if messages[-1]["role"] == "user":
        messages[-1]["content"] += "\n\n" + instruction
    else:
        messages.append({"role": "user", "content": instruction})

    parsed, raw = generate_json_response(messages, max_new_tokens=220, temperature=0.2)
    return normalize_turn_response(parsed, raw)


def handle_generate_question(data: dict) -> dict:
    language = data.get("language", "english")
    domain = data.get("domain", "general")
    role = data.get("role", "candidate")
    category = data.get("category", "intro")
    type_str = data.get("type", "technical")
    candidate_name = data.get("candidateName", "Candidate")
    difficulty = data.get("difficulty", "mid")
    skills = data.get("skills", [])
    responsibilities = data.get("responsibilities", [])
    experience = data.get("experience", "")
    candidate_experience = data.get("candidateExperience", [])
    candidate_education = data.get("candidateEducation", [])
    candidate_projects = data.get("candidateProjects", [])
    candidate_certifications = data.get("candidateCertifications", [])
    interview_title = data.get("interviewTitle", "")
    duration_minutes = data.get("durationMinutes")
    scheduled_at = data.get("scheduledAt")
    job_description = data.get("jobDescription", "")
    resume_text = data.get("resumeText", "")

    lang_hint = (
        "Generate the question in English."
        if language.lower() == "english"
        else
        "IMPORTANT: Generate the question ENTIRELY in Somali. DO NOT use English! "
        "Ku hadal af-Soomaali dabiici ah oo aad u xirfad iyo naxwe sarreeya. "
        "Fadlan u turjum ama u sharax ereyada farsamada (keywords/jargon) af-Soomaali dabiici ah "
        "si mashiinka ku dhawaaqista codka (TTS) uu ugu dhawaaqi karo si sax oo dabiici ah."
    )

    if category == "outro":
        if language.lower() == "somali":
            question = "Waad ku mahadsantahay wakhtigaaga maanta. Ma qabtaa wax su'aalo ah oo aad iwaydiiso ka hor intaanan soo afjarin?"
        else:
            question = "Thank you for your time today. Do you have any questions for me before we wrap up?"
        return {
            "question": question,
            "expectedAnswer": "Candidate asks questions about the role, company culture, or next steps.",
        }

    context_block = ""
    if skills:
        context_block += f"The job requires these skills: {', '.join(skills)}.\n"
        context_block += "Your question MUST test one of these specific skills.\n"
    if responsibilities:
        context_block += f"Key responsibilities for this role include: {', '.join(responsibilities[:5])}.\n"
    if experience:
        context_block += f"Required experience level: {experience}.\n"
    if candidate_experience:
        context_block += f"Candidate experience highlights: {', '.join(candidate_experience[:5])}.\n"
    if candidate_education:
        context_block += f"Candidate education: {', '.join(candidate_education[:3])}.\n"
    if candidate_projects:
        context_block += f"Candidate projects: {', '.join(candidate_projects[:5])}.\n"
    if candidate_certifications:
        context_block += f"Candidate certifications: {', '.join(candidate_certifications[:5])}.\n"
    if interview_title:
        context_block += f"Interview title and intended focus: {interview_title[:200]}.\n"
    if duration_minutes:
        context_block += f"Planned interview duration: {duration_minutes} minutes; keep each question proportionate to that time budget.\n"
    if scheduled_at:
        context_block += f"Interview schedule metadata: {str(scheduled_at)[:80]}.\n"
    if job_description:
        context_block += f"Job description details:\n{job_description[:6000]}\n"
        context_block += "Ensure the question aligns with the context and requirements provided above.\n"
    if resume_text:
        context_block += f"Candidate resume details:\n{resume_text[:6000]}\n"
        context_block += "Tailor questions to actual candidate claims, projects, and experience without revealing private contact details.\n"

    prompt_content = (
        f"You are an expert {domain} interviewer hiring for a {role} position.\n"
        f"Interview style: {type_str}. Difficulty: {difficulty_hint(difficulty)}.\n"
        f"{lang_hint}\n\n"
        f"{context_block}\n"
        "RULES FOR QUESTION GENERATION:\n"
        "- Match difficulty to the level above.\n"
        f"- Category focus: {category}.\n"
        f"- If category is 'intro', greet the candidate by name ({candidate_name}) and ask a custom opening question to introduce yourself and request them to summarize their background/experience for this role.\n"
        "- Natural and conversational; ONE clear question only.\n"
        "- Technical: ask 'What is...', 'How does...', 'Explain...'.\n"
        "- Behavioral: ask 'Tell me about a time...'.\n"
        "- Max 25 words.\n\n"
        f"Generate a {category} question for a {role} role.\n\n"
        'Return ONLY valid JSON: {"question": "...", "expectedAnswer": "..."}'
    )

    messages = [{"role": "user", "content": prompt_content}]
    parsed, raw = generate_json_response(messages, max_new_tokens=96, temperature=0.3)
    if parsed and ("question" in parsed or "text" in parsed):
        return {
            "question": parsed.get("question") or parsed.get("text", ""),
            "expectedAnswer": parsed.get("expectedAnswer") or parsed.get("expected_answer") or parsed.get("answer", ""),
        }

    raw_fallback = raw.strip()
    looks_like_question = "?" in raw_fallback and len(raw_fallback) < 300
    constraint_keywords = ["no code", "not allowed", "external websites", "do not", "you must", "note:", "rule:"]
    is_constraint = any(kw in raw_fallback.lower() for kw in constraint_keywords)

    if looks_like_question and not is_constraint:
        return {"question": raw_fallback, "expectedAnswer": ""}

    if language.lower() == "somali":
        default_q = f"Maxaad ka garanaysaa shaqada {domain} iyo sida ay uga muhiimsan tahay xirfadahaaga?"
    else:
        default_q = f"Can you describe your experience and approach to working in the {domain} domain?"
    print(f"[generate-question] WARNING: Raw fallback rejected. Raw was: {raw_fallback[:200]}")
    return {
        "question": default_q,
        "expectedAnswer": "Candidate describes relevant experience and domain knowledge.",
    }


def handle_generate_questions(data: dict) -> dict:
    requests = data.get("requests") or []
    if not isinstance(requests, list) or not requests:
        return {"error": "requests must be a non-empty list"}
    if len(requests) > 16:
        return {"error": "A maximum of 16 questions can be generated per batch"}

    questions = []
    timings = []
    for request in requests:
        result = handle_generate_question(request if isinstance(request, dict) else {})
        questions.append(result)
        timings.append(dict(generation_timing))
    return {"questions": questions, "itemTimings": timings}


def handle_warmup(_data: dict) -> dict:
    return {"status": "ready", "model": MODEL_ID, "device": DEVICE}


def handle_parse(data: dict) -> dict:
    job_description = data.get("job_description", "")
    resume_text = data.get("resume_text", "")
    role = data.get("role", "")
    interview_title = data.get("interview_title", "")
    job_description = job_description[:10000] if job_description else ""
    resume_text = resume_text[:10000] if resume_text else ""

    messages = [
        {
            "role": "user",
            "content": (
                "You are an expert job-description and resume parser. "
                "Extract structured hiring requirements and candidate evidence from the supplied text. "
                "IMPORTANT: Keep all arrays to a MAXIMUM of 8 items each. "
                "Keep each array item under 120 characters and do not include contact details. "
                "Return ONLY raw JSON with EXACTLY these keys: "
                "requiredSkills (array of strings), preferredSkills (array of strings), "
                "responsibilities (array of strings), experienceLevel (string), technicalStack (array of strings), "
                "candidateSkills (array of strings), candidateExperience (array of strings), "
                "candidateEducation (array of strings), candidateProjects (array of strings), "
                "candidateCertifications (array of strings).\n\n"
                f"Role: {role}\nInterview title: {interview_title}\n\n"
                f"JOB DESCRIPTION:\n{job_description or 'Not provided'}\n\n"
                f"CANDIDATE RESUME:\n{resume_text or 'Not provided'}"
            ),
        }
    ]

    parsed, _raw = generate_json_response(messages, max_new_tokens=512, temperature=0.0)
    if parsed:
        return {"data": parsed}
    return {
        "data": {
            "requiredSkills": [],
            "preferredSkills": [],
            "responsibilities": [],
            "experienceLevel": "",
            "technicalStack": [],
            "candidateSkills": [],
            "candidateExperience": [],
            "candidateEducation": [],
            "candidateProjects": [],
            "candidateCertifications": [],
        }
    }


def handle_feedback(data: dict) -> dict:
    interview_data = data.get("interview_data", {})
    turn_average = interview_data.get("overallScore")

    questions_summary = []
    for q in interview_data.get("questions", []):
        questions_summary.append({
            "question": q.get("text", "")[:200],
            "answer": q.get("userAnswer", "")[:300],
            "score": q.get("score"),
            "category": q.get("category", ""),
            "aiFeedback": q.get("aiFeedback", "")[:200],
        })

    interview_summary = {
        "title": interview_data.get("title", ""),
        "type": interview_data.get("type", ""),
        "domain": interview_data.get("domain", ""),
        "difficulty": interview_data.get("difficulty", ""),
        "jobRole": interview_data.get("jobRole", ""),
        "overallScoreFromTurns": turn_average,
        "questions": questions_summary,
    }

    score_anchor = (
        f"The per-question average score is {turn_average}. "
        f"Use the SAME 0-100 scale for category scores. overallScore should be close to {turn_average} (±5).\n\n"
        if turn_average is not None
        else ""
    )

    messages = [
        {
            "role": "user",
            "content": (
                "You are an interview coach providing post-session feedback for a PRACTICE interview.\n"
                "Be constructive and specific. Use the per-question scores as ground truth.\n\n"
                f"{score_anchor}"
                "SCORING (same scale as per-question evaluation):\n"
                "- 90-100: Excellent\n"
                "- 80-89: Good\n"
                "- 65-79: Partial\n"
                "- 40-64: Weak\n"
                "- Below 40: Off-topic or incorrect\n\n"
                "LENGTH LIMITS:\n"
                "- feedback strings under 80 chars; detailedFeedback under 200 chars.\n"
                "- max 3 strengths, 3 improvements, 3 recommendations.\n"
                "- For non-technical interviews, set codeQuality score from communication/structure, not coding.\n\n"
                "Return ONLY raw JSON with keys: overallScore, categories "
                "(communication, technicalAccuracy, problemSolving, codeQuality, confidence — each with score and feedback), "
                "strengths, improvements, detailedFeedback, recommendations.\n\n"
                f"Interview data:\n{json.dumps(interview_summary, indent=1)}"
            ),
        }
    ]

    parsed, raw = generate_json_response(messages, max_new_tokens=550, temperature=0.2)
    if parsed:
        normalized = {
            "overallScore": clamp_score(
                turn_average if turn_average is not None else parsed.get("overallScore", 0)
            ),
            "categories": {
                "communication": parsed.get("categories", {}).get("communication", {"score": 0, "feedback": ""}),
                "technicalAccuracy": parsed.get("categories", {}).get("technicalAccuracy", {"score": 0, "feedback": ""}),
                "problemSolving": parsed.get("categories", {}).get("problemSolving", {"score": 0, "feedback": ""}),
                "codeQuality": parsed.get("categories", {}).get("codeQuality", {"score": 0, "feedback": ""}),
                "confidence": parsed.get("categories", {}).get("confidence", {"score": 0, "feedback": ""}),
            },
            "strengths": parsed.get("strengths", [])[:3],
            "improvements": parsed.get("improvements", [])[:3],
            "detailedFeedback": parsed.get("detailedFeedback", parsed.get("summary", ""))[:300],
            "recommendations": parsed.get("recommendations", [])[:3],
        }
        for key in normalized["categories"]:
            cat = normalized["categories"][key]
            if isinstance(cat, dict) and cat.get("score") is not None:
                cat["score"] = clamp_score(cat["score"])
        return {"feedback": normalized}

    fallback_score = clamp_score(turn_average) if turn_average is not None else 0
    return {
        "feedback": {
            "overallScore": fallback_score,
            "categories": {
                "communication": {"score": 0, "feedback": ""},
                "technicalAccuracy": {"score": 0, "feedback": ""},
                "problemSolving": {"score": 0, "feedback": ""},
                "codeQuality": {"score": 0, "feedback": ""},
                "confidence": {"score": 0, "feedback": ""},
            },
            "strengths": [],
            "improvements": ["AI could not generate structured feedback for this session."],
            "detailedFeedback": raw.strip()[:300],
            "recommendations": [],
        }
    }


ROUTES = {
    "/health": handle_health,
    "health": handle_health,
    "/interview-turn": handle_interview_turn,
    "interview-turn": handle_interview_turn,
    "/generate-question": handle_generate_question,
    "generate-question": handle_generate_question,
    "/generate-questions": handle_generate_questions,
    "generate-questions": handle_generate_questions,
    "/warmup": handle_warmup,
    "warmup": handle_warmup,
    "/parse": handle_parse,
    "parse": handle_parse,
    "/feedback": handle_feedback,
    "feedback": handle_feedback,
}


def dispatch(endpoint: str, payload: Optional[dict] = None) -> dict:
    global generation_timing
    path = (endpoint or "/health").strip()
    handler_fn = ROUTES.get(path) or ROUTES.get(path.lstrip("/"))
    if not handler_fn:
        return {"error": f"Unknown endpoint: {endpoint}", "detail": f"Unknown endpoint: {endpoint}"}
    try:
        # /health must return instantly so RunPod marks the worker ready.
        if path in ("/health", "health"):
            return handler_fn(payload or {})
        generation_timing = {}
        load_timing = load_model()
        result = handler_fn(payload or {})
        if isinstance(result, dict):
            result.setdefault("_timing", {})
            result["_timing"].update(load_timing)
            result["_timing"].update(generation_timing)
        return result
    except Exception as exc:
        traceback.print_exc()
        return {"error": str(exc), "detail": str(exc)}
