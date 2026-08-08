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


def language_instruction(language: str, mode: str = "question") -> str:
    """
    Returns the language directive injected at the top of every prompt.

    mode="question"  — for /generate-question: the *question* field must be in the target language.
    mode="turn"      — for /interview-turn: nextInterviewerResponse must be in the target language;
                       evaluation fields (score, feedback, …) stay in English.

    Design rule: always ask for *direct* generation in the target language.
    Never say "translate from English" — that frames a two-step internal process
    (English draft → translate) which degrades naturalness.
    """
    lang = (language or "english").lower()

    if lang != "somali":
        if mode == "turn":
            return "Respond in English. Be direct, conversational, and professional."
        return "Generate the question in English. Be clear and natural."

    # Somali — direct generation
    common = (
        "For technical terms that have no established Somali equivalent "
        "(e.g. 'API', 'React', 'database', 'debugging'), keep the English term as-is."
    )
    if mode == "turn":
        return (
            "Write your nextInterviewerResponse DIRECTLY in Somali — "
            "think and write in Somali from the start, do not draft in English first. "
            "Use natural, professional Somali. " + common
        )
    return (
        "Generate the question DIRECTLY in Somali — "
        "think and write in Somali from the start, do not draft in English first. "
        "Use natural, professional Somali. " + common
    )


def difficulty_hint(difficulty: str) -> str:
    mapping = {
        "junior": "junior", "easy": "junior",
        "mid": "mid-level", "medium": "mid-level",
        "senior": "senior", "hard": "senior",
        "lead": "lead/staff",
    }
    return mapping.get((difficulty or "mid").lower(), "mid-level")


def is_valid_question(text: Any) -> bool:
    if not isinstance(text, str):
        return False
    question = " ".join(text.split())
    if len(question) < 8 or len(question) > 300 or not question.endswith("?"):
        return False
    invalid_markers = (
        "return only valid json", "expected answer", "ideal answer",
        'one field "question"', "interview assessment",
    )
    return not any(marker in question.lower() for marker in invalid_markers)


def is_valid_interviewer_response(text: Any) -> bool:
    if not isinstance(text, str):
        return False
    response = " ".join(text.split())
    if len(response) < 2 or len(response) > 300:
        return False
    invalid_markers = (
        "return only valid json", "expected answer", "ideal answer",
        'one field "question"', "interview assessment",
    )
    return not any(marker in response.lower() for marker in invalid_markers)


def is_question_about_target_skill(question: str, target_skill: str) -> bool:
    return not target_skill or target_skill.lower() in question.lower()


def category_rubric(category: str, type_str: str) -> str:
    cat = (category or "").lower()
    t = (type_str or "mixed").lower()
    if "star" in cat or "behavioral" in cat or t == "behavioral":
        return (
            "Evaluate using STAR (Situation, Task, Action, Result). "
            "Reward specific examples with measurable outcomes."
        )
    if t == "hr" or cat in ("motivation", "culture fit", "experience", "strengths/weaknesses"):
        return "Evaluate motivation, culture alignment, and role fit."
    if t == "technical" or cat in ("core skills", "applied knowledge", "debugging", "fundamentals", "technical"):
        return "Evaluate technical accuracy, clarity, and practical understanding."
    if t == "system-design" or cat in ("architecture overview", "scalability", "trade-offs", "component design"):
        return "Evaluate structured thinking, trade-offs, and scalability awareness."
    if t == "mixed":
        if cat in ("motivation", "culture fit", "past experience"):
            return "Evaluate motivation, culture alignment, and role fit."
        return "Evaluate technical accuracy, relevance, and depth of experience."
    return "Evaluate clarity, relevance, and completeness."


def type_question_style(type_str: str, category: str) -> str:
    """Returns type-specific question generation instructions for the AI prompt."""
    t = (type_str or "mixed").lower()
    cat = (category or "").lower()

    if t == "technical":
        return (
            "QUESTION STYLE - TECHNICAL: Ask a direct, specific technical question ONLY.\n"
            "Choose ONE starter that fits the target skill:\n"
            "  - Knowledge: 'What is X?', 'What does X do?', 'What is the purpose of X?'\n"
            "  - Understanding: 'How does X work?', 'How does X differ from Y?', 'Why does X behave like Z?'\n"
            "  - Practical: 'How would you implement X?', 'How would you use X to solve Y?'\n"
            "  - Trade-off: 'What are the trade-offs of using X?', 'When would you choose X over Y?'\n"
            "  - Debugging: 'What would cause X to fail?', 'How would you diagnose Y in X?'\n"
            "NEVER start with 'Tell me about a time', 'Describe a situation', 'Give me an example of', "
            "or 'Imagine a scenario'. Ask a direct factual or practical question."
        )
    if t == "behavioral":
        return (
            "QUESTION STYLE - BEHAVIORAL: Ask a behavioral question ONLY using STAR framing.\n"
            "Choose ONE starter:\n"
            "  - 'Tell me about a time when you...'\n"
            "  - 'Describe a situation where you...'\n"
            "  - 'Walk me through how you handled...'\n"
            "  - 'Give me an example of when you...'\n"
            "Focus on real past experiences: teamwork, conflict, problem-solving, or failure/growth. "
            "Do NOT ask technical or HR questions."
        )
    if t == "hr":
        return (
            "QUESTION STYLE - HR / CULTURE FIT: Ask an HR or culture-fit question ONLY.\n"
            "Choose ONE starter that fits the category:\n"
            "  - Motivation: 'Why are you interested in this role?', 'What drew you to this field?'\n"
            "  - Strengths/Weaknesses: 'What is your greatest strength?', 'What is an area you are actively improving?'\n"
            "  - Culture fit: 'How do you prefer to work in a team?', 'What kind of work environment brings out your best?'\n"
            "  - Career: 'Where do you see yourself in 3-5 years?', 'What does success look like to you?'\n"
            "  - Pressure: 'How do you handle disagreement with a colleague?', 'How do you manage competing priorities?'\n"
            "Do NOT ask technical or coding questions."
        )
    if t == "system-design":
        return (
            "QUESTION STYLE - SYSTEM DESIGN: Ask a system design question ONLY.\n"
            "Choose ONE starter:\n"
            "  - Design: 'How would you design X?', 'Walk me through the architecture of X.'\n"
            "  - Scale: 'How would you scale X to handle Y requests per second?'\n"
            "  - Trade-off: 'What trade-offs would you consider when designing X?'\n"
            "  - Component: 'How would you structure the database for X?', 'What caching strategy would you use for X?'\n"
            "  - Reliability: 'How would you handle failures in X?', 'How would you ensure consistency in X?'\n"
            "Do NOT ask HR questions. Do NOT start with 'Tell me about a time'. "
            "Ask about architecture decisions and engineering trade-offs."
        )
    # mixed — infer from category
    if cat in ("motivation", "culture fit", "strengths/weaknesses", "past experience"):
        return (
            "QUESTION STYLE - HR / CULTURE FIT (mixed interview): Ask an HR or culture-fit question for this slot.\n"
            "Choose ONE starter: 'Why are you interested in this role?', 'What motivates you?', "
            "'How do you prefer to work?', 'What is your greatest strength?', 'Tell me about a time when you...'. "
            "Do NOT ask technical questions for this slot."
        )
    return (
        "QUESTION STYLE - TECHNICAL (mixed interview): Ask a direct technical question for this slot.\n"
        "Choose ONE starter: 'What is X?', 'How does X work?', 'How would you implement X?', "
        "'What are the trade-offs of X?', 'How would you debug X?'. "
        "Do NOT ask HR or motivational questions for this slot. "
        "NEVER start with 'Tell me about a time'."
    )


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
    # Apply minimum score floor: any on-topic substantive answer scores at least 10
    # to distinguish from a placeholder / no-answer (which scores 0).
    clamped_score = clamp_score(score_raw) if score_raw is not None else None
    if clamped_score is not None and 1 <= clamped_score < 10:
        clamped_score = 10
    next_response = parsed.get("nextInterviewerResponse") or ""
    if not is_valid_interviewer_response(next_response):
        next_response = (
            "Could you explain your approach in a little more detail?"
            if is_follow_up and not is_topic_complete
            else "Thank you. Let's continue."
        )
    return {
        "evaluation": {
            "score": clamped_score,
            "feedback": (evaluation.get("feedback") or "")[:350],
            "strengths": (evaluation.get("strengths") or [])[:3],
            "improvements": (evaluation.get("improvements") or [])[:3],
            "suggestedAnswer": (evaluation.get("suggestedAnswer") or "")[:350],
        },
        "nextInterviewerResponse": " ".join(next_response.split()),
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

    lang_hint = language_instruction(language, mode="turn")

    somali_note = ""
    if language.lower() == "somali":
        somali_note = (
            "SCORING: The candidate answered in Somali. Evaluate content and meaning only — "
            "never penalize the language choice.\n\n"
        )

    role_context = build_role_context(role_profile)
    rubric = category_rubric(category, type_str)

    type_eval_hint = {
        "technical": (
            "This is a TECHNICAL interview. Evaluate technical accuracy, depth, and problem-solving clarity. "
            "Reward correct explanations, trade-off awareness, and concrete examples. "
            "Follow up if the candidate gives a vague or incomplete technical answer."
        ),
        "behavioral": (
            "This is a BEHAVIORAL interview. Evaluate answers using STAR (Situation, Task, Action, Result). "
            "Reward specific, structured examples with measurable outcomes. "
            "Follow up if the candidate gives a generic or non-specific answer."
        ),
        "hr": (
            "This is an HR / culture-fit interview. Evaluate motivation, cultural alignment, and role fit. "
            "Reward authenticity, self-awareness, and alignment with role expectations. "
            "Follow up if the answer is vague about motivation or fit."
        ),
        "system-design": (
            "This is a SYSTEM DESIGN interview. Evaluate structured thinking, trade-offs, and scalability awareness. "
            "Reward candidates who consider distributed systems, failure modes, and real-world constraints. "
            "Follow up if the candidate skips trade-offs or gives an overly simple design."
        ),
        "mixed": (
            "This is a MIXED interview combining technical and HR questions. "
            "For technical questions, evaluate accuracy and depth. "
            "For HR/behavioral questions, evaluate motivation, fit, and use of STAR format. "
            "Match your follow-up style to the category of the current question."
        ),
    }.get((type_str or "mixed").lower(), "Evaluate clarity, relevance, and depth of the candidate's answer.")

    difficulty_level = difficulty_hint(question_difficulty)

    system_prompt = (
        f"You are an expert {domain} interviewer for: {role}.\n"
        f"Interview type: {type_str}. Difficulty: {difficulty_level}.\n"
        f"{type_eval_hint}\n"
        f"{lang_hint}\n\n"
        f"{somali_note}"
        f"CURRENT QUESTION: {question_text}\n"
        f"EXPECTED ANSWER RUBRIC: {expected_answer or 'Judge relevance, depth, and clarity for this question category.'}\n"
        f"CATEGORY: {category}. {rubric}\n"
    )
    if role_context:
        system_prompt += f"\nJOB CONTEXT:\n{role_context}\n"

    system_prompt += (
        f"\nDIFFICULTY CALIBRATION: This is a {difficulty_level}-level question. "
        f"Score against {difficulty_level} expectations — do NOT apply a senior bar to a junior question.\n\n"
        "SCORING SCALE (apply consistently and generously for correct answers):\n"
        "- 85-100: Excellent — thorough, accurate, strong examples or clear reasoning.\n"
        "- 70-84:  Good — correct answer with minor gaps or lacking depth. A solid, clear, mostly-correct "
        "answer should score in this range.\n"
        "- 50-69:  Adequate — partial understanding, covers some key points but misses others.\n"
        "- 25-49:  Weak — significant gaps, vague, or mostly incorrect.\n"
        "- 0-24:   Off-topic, clearly wrong, or no real attempt.\n"
        "CALIBRATION: A clear, relevant, mostly-correct answer for this difficulty level "
        "should score 72–82. Reserve 90+ for exceptional depth and insight.\n\n"
        "BEHAVIOR:\n"
        "1. nextInterviewerResponse: 1-2 short sentences max. Be warm and professional.\n"
        "2. Partial answer → isFollowUp=true, isTopicComplete=false, one short targeted follow-up.\n"
        "3. Good or complete answer → isFollowUp=false, isTopicComplete=true.\n"
        "4. If the candidate asks YOU a question (role, team, process, expectations), "
        "answer it briefly and professionally in nextInterviewerResponse, set answeredCandidateQuestion=true. "
        "For outro category, always answer their questions. Stay on topic after answering.\n"
        "5. If they ask for clarification on YOUR question, rephrase briefly — do not repeat the full original question.\n"
        "6. Never ask the same question twice verbatim; if already answered, acknowledge and move on.\n\n"
        "FEEDBACK QUALITY: Write feedback that is specific, actionable, and explains WHY the score was given. "
        "Mention what the candidate did well and what exactly was missing (if anything).\n"
        "Return ONLY raw JSON:\n"
        '{"evaluation": {"score": 78, "feedback": "...", "strengths": ["..."], '
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

    parsed, raw = generate_json_response(messages, max_new_tokens=320, temperature=0.2)
    return normalize_turn_response(parsed, raw)


def _category_opening_instruction(
    category: str,
    candidate_name: str,
    role: str,
    target_skill: str,
    candidate_experience: list,
    candidate_projects: list,
    is_practice: bool,
) -> str:
    """Returns a category-specific instruction line for intro and outro slots."""
    cat = (category or "").lower()

    if cat == "intro":
        # Build context hints the AI can use to vary the opening.
        hints = []
        if candidate_experience:
            hints.append(f"candidate background: {candidate_experience[0]}")
        if candidate_projects:
            hints.append(f"recent project: {candidate_projects[0]}")
        if target_skill:
            hints.append(f"key skill: {target_skill}")
        context_hint = ("; ".join(hints) + ". ") if hints else ""
        return (
            f"- This is the OPENING question. {context_hint}"
            "Do NOT use 'Tell me about yourself', 'Introduce yourself', or ask them to summarize their resume. "
            "Instead, open with ONE of these approaches tailored to the candidate:\n"
            f"    * Ask what drew them to this specific {role} role or this domain.\n"
            "    * Reference something concrete from their background and ask how it connects to this role.\n"
            "    * Ask what aspect of the work they are most excited to do.\n"
            "    * Ask about the most relevant experience or project they are bringing to this position.\n"
            "Pick the approach that best fits the available context. Be natural — not robotic.\n"
        )

    if cat == "outro":
        if is_practice:
            return (
                "- This is the CLOSING question for a personal practice session. "
                "Invite the candidate to reflect on what they would like to practice next. "
                "Do NOT mention a company, hiring team, application, role opportunity, or next steps.\n"
            )
        return (
            "- This is the CLOSING question. Do NOT use 'Do you have any questions for me?' verbatim. "
            "Instead, close with ONE of these:\n"
            "    * Invite them to highlight something important that wasn't covered.\n"
            "    * Ask what excites them most about this specific opportunity.\n"
            "    * Ask about their expectations or goals for the first few months.\n"
            "    * Ask what questions they have about the team, the role, or the work itself.\n"
            "Make it feel like a natural conversation ending, not a checklist item.\n"
        )

    return ""


def handle_generate_question(data: dict) -> dict:
    language = data.get("language", "english")
    domain = data.get("domain", "general")
    role = data.get("role", "candidate")
    category = data.get("category", "intro")
    type_str = data.get("type", "technical")
    candidate_name = data.get("candidateName", "Candidate")
    difficulty = data.get("difficulty", "mid")
    target_skill = data.get("targetSkill", "")
    supporting_skills = data.get("supportingSkills", [])
    question_index = data.get("questionIndex", 0)
    total_questions = data.get("totalQuestions", 1)
    responsibilities = data.get("responsibilities", [])
    experience = data.get("experience", "")
    candidate_experience = data.get("candidateExperience", [])
    candidate_education = data.get("candidateEducation", [])
    candidate_projects = data.get("candidateProjects", [])
    candidate_certifications = data.get("candidateCertifications", [])
    interview_title = data.get("interviewTitle", "")
    is_practice = data.get("sessionMode", "practice") != "company"
    duration_minutes = data.get("durationMinutes")
    scheduled_at = data.get("scheduledAt")
    job_description = data.get("jobDescription", "")
    resume_text = data.get("resumeText", "")

    lang_hint = language_instruction(language, mode="question")

    # --- Build context block (ordered: specific → general) ---
    context_block = ""

    # 1. Primary skill target — pin the question to one concrete skill/technology.
    if target_skill:
        context_block += f"TARGET SKILL FOR THIS QUESTION: {target_skill}\n"
        context_block += f"Your question MUST directly test the candidate's knowledge of {target_skill}.\n"
        context_block += "Do not substitute another framework, language, or skill for the target skill.\n"
        if supporting_skills:
            context_block += f"Related skills for context only (do not make the question about these): {', '.join(supporting_skills)}.\n"
    elif supporting_skills:
        context_block += f"Job required skills: {', '.join(supporting_skills)}.\n"
        context_block += "Ask a question that tests one of these specific skills.\n"

    # 2. Role context.
    if experience:
        context_block += f"Required experience level: {experience}.\n"
    if responsibilities:
        context_block += f"Key responsibilities: {', '.join(responsibilities[:4])}.\n"

    # 3. Candidate-specific context — tailor to their actual background.
    if candidate_experience:
        context_block += f"Candidate background: {', '.join(candidate_experience[:4])}.\n"
    if candidate_projects:
        context_block += f"Candidate projects: {', '.join(candidate_projects[:3])}.\n"
    if candidate_certifications:
        context_block += f"Candidate certifications: {', '.join(candidate_certifications[:3])}.\n"
    if candidate_education:
        context_block += f"Candidate education: {', '.join(candidate_education[:2])}.\n"

    # 4. Interview metadata.
    if interview_title:
        context_block += f"Interview focus: {interview_title[:120]}.\n"

    # 5. Raw JD / resume (lower weight, trimmed hard).
    if job_description:
        context_block += f"Job description (excerpt):\n{job_description[:3000]}\n"
    if resume_text:
        context_block += f"Candidate resume (excerpt):\n{resume_text[:3000]}\n"
        context_block += "Tailor the question to actual candidate claims; do not reveal private contact details.\n"

    # Variety signal — tell the model which question slot this is so it avoids repeating earlier patterns.
    variety_hint = ""
    if total_questions > 1 and question_index > 0:
        variety_hint = (
            f"This is question {question_index + 1} of {total_questions}. "
            "Use a DIFFERENT question starter and angle than previous questions. "
            "Vary the format: alternate between knowledge checks, practical implementation, trade-offs, and debugging.\n"
        )

    question_style = type_question_style(type_str, category)

    target_directive = (
        f"about {target_skill}" if target_skill else f"for a {role} role"
    )

    prompt_content = (
        f"You are an expert {domain} interviewer "
        f"{'running a personal practice session on' if is_practice else 'hiring for'} a {role} "
        f"{'focus area' if is_practice else 'position'}.\n"
        f"Interview type: {type_str}. Difficulty: {difficulty_hint(difficulty)}.\n"
        f"{lang_hint}\n\n"
        f"{context_block}\n"
        f"{question_style}\n\n"
        f"{variety_hint}"
        "RULES:\n"
        "- ONE clear, natural question only. No preamble or explanation.\n"
        "- Match difficulty to the level stated above.\n"
        f"- Category: {category}.\n"
        f"{_category_opening_instruction(category, candidate_name, role, target_skill, candidate_experience, candidate_projects, is_practice)}"
        "- Max 25 words. Direct and specific — no filler phrases.\n\n"
        f"Generate a {category} question {target_directive}.\n\n"
        'Return ONLY valid JSON: {"question": "...", "expectedAnswer": "..."}'
    )

    messages = [{"role": "user", "content": prompt_content}]
    parsed, raw = generate_json_response(messages, max_new_tokens=96, temperature=0.3)
    parsed_question = (parsed or {}).get("question") or (parsed or {}).get("text", "")
    if is_valid_question(parsed_question) and is_question_about_target_skill(parsed_question, target_skill):
        return {
            "question": parsed_question.strip(),
            "expectedAnswer": parsed.get("expectedAnswer") or parsed.get("expected_answer") or parsed.get("answer", ""),
        }

    raw_fallback = raw.strip()
    if is_valid_question(raw_fallback) and is_question_about_target_skill(raw_fallback, target_skill):
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
        f"Your overallScore MUST equal {turn_average}. "
        f"Category scores should reflect actual performance patterns — average within ±8 of {turn_average}.\n\n"
        if turn_average is not None
        else ""
    )

    messages = [
        {
            "role": "user",
            "content": (
                "You are an interview coach providing post-session feedback for a PRACTICE interview.\n"
                "Be constructive, specific, and encouraging. Reference actual answers where possible.\n\n"
                f"{score_anchor}"
                "SCORING SCALE (consistent with per-question scores):\n"
                "- 85-100: Excellent — thorough, accurate, strong examples\n"
                "- 70-84:  Good — correct with minor gaps\n"
                "- 50-69:  Adequate — partial understanding, key gaps\n"
                "- 25-49:  Weak — significant gaps or vague\n"
                "- 0-24:   Off-topic or no real attempt\n\n"
                "CATEGORY GUIDANCE:\n"
                "- communication: clarity, structure, articulation of ideas\n"
                "- technicalAccuracy: correctness of technical claims and concepts\n"
                "- problemSolving: reasoning approach and logical breakdown\n"
                "- codeQuality: for non-technical interviews, score based on structured thinking and precision\n"
                "- confidence: delivery, directness, and composure\n\n"
                "LENGTH REQUIREMENTS:\n"
                "- Each category feedback: 60-150 chars, specific and actionable\n"
                "- detailedFeedback: 150-300 chars, summarize overall performance\n"
                "- strengths: 3 items, each 40-100 chars\n"
                "- improvements: 3 items, each 40-100 chars, concrete and actionable\n"
                "- recommendations: 3 items, each 40-100 chars, specific next steps\n\n"
                "Return ONLY raw JSON with keys: overallScore, categories "
                "(communication, technicalAccuracy, problemSolving, codeQuality, confidence — each with score and feedback), "
                "strengths, improvements, detailedFeedback, recommendations.\n\n"
                f"Interview data:\n{json.dumps(interview_summary, indent=1)}"
            ),
        }
    ]

    parsed, raw = generate_json_response(messages, max_new_tokens=700, temperature=0.2)
    if parsed:
        cats_raw = parsed.get("categories", {})
        normalized = {
            # Always use the authoritative turn average as the overall score
            "overallScore": clamp_score(
                turn_average if turn_average is not None else parsed.get("overallScore", 0)
            ),
            "categories": {
                "communication": cats_raw.get("communication") or {"score": 0, "feedback": ""},
                "technicalAccuracy": cats_raw.get("technicalAccuracy") or cats_raw.get("technical_accuracy") or {"score": 0, "feedback": ""},
                "problemSolving": cats_raw.get("problemSolving") or cats_raw.get("problem_solving") or {"score": 0, "feedback": ""},
                "codeQuality": cats_raw.get("codeQuality") or cats_raw.get("code_quality") or {"score": 0, "feedback": ""},
                "confidence": cats_raw.get("confidence") or {"score": 0, "feedback": ""},
            },
            "strengths": parsed.get("strengths", [])[:3],
            "improvements": parsed.get("improvements", [])[:3],
            "detailedFeedback": parsed.get("detailedFeedback") or parsed.get("summary") or "",
            "recommendations": parsed.get("recommendations", [])[:3],
        }
        # Clamp all category scores and enforce minimum 10 for populated feedback
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
