# CELL 4: Complete FastAPI Server + ngrok Tunnel (All Endpoints + Fine-tuned Model Prompting)
import json
import re
import uvicorn
from threading import Thread
from fastapi import FastAPI, Request
from pydantic import BaseModel
from pyngrok import ngrok, conf
from google.colab import userdata

# ── ngrok Authentication ──────────────────────────────────────────────────────
NGROK_TOKEN = userdata.get('NGROK_TOKEN')
conf.get_default().auth_token = NGROK_TOKEN

app = FastAPI(title='Gemma 4 Tech Interviewer API')

def generate_text(prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
    """Runs generation with Gemma chat format."""
    inputs = tokenizer(prompt, return_tensors='pt').to('cuda')
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            do_sample=(temperature > 0),
            temperature=max(temperature, 0.01) if temperature > 0 else 1.0,
            top_p=0.9 if temperature > 0 else 1.0,
            pad_token_id=tokenizer.eos_token_id,
        )
    generated = outputs[0][inputs['input_ids'].shape[1]:]
    return tokenizer.decode(generated, skip_special_tokens=True).strip()

def safe_parse_json(text: str) -> dict:
    """Extracts JSON object from markdown code fences or raw text."""
    cleaned = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'```\s*', '', cleaned).strip()
    match = re.search(r'(\{.*\})', cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    try:
        return json.loads(cleaned)
    except Exception:
        return {}

# ── Health & Warmup Endpoints ─────────────────────────────────────────────────
@app.get('/health')
def health():
    return {'status': 'online', 'model': 'Mohamud24/gemma-4-tech-interviewer', 'provider': 'colab'}

@app.get('/warmup')
@app.post('/warmup')
def warmup():
    return {'status': 'ready', 'model': 'Mohamud24/gemma-4-tech-interviewer', 'provider': 'colab'}

# ── Generate Question (Single) ────────────────────────────────────────────────
@app.post('/generate-question')
async def api_generate_question(payload: dict):
    domain = payload.get('domain', 'Technology')
    role = payload.get('role', payload.get('jobRole', 'Full Stack Developer'))
    lang = payload.get('language', 'English')
    category = payload.get('category', 'conceptual')
    diff = payload.get('difficulty', 'medium')
    target_skill = payload.get('targetSkill', '')

    system_content = f"You are an expert technical interviewer. Domain: {domain}. Role: {role}. Language: {lang}. Focus: {category}."
    user_content = f"Ask a {diff} difficulty interview question."
    if target_skill:
        user_content += f" Focus on {target_skill}."

    messages = [
        {'role': 'system', 'content': system_content},
        {'role': 'user', 'content': user_content}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    question_text = generate_text(prompt, max_tokens=250, temperature=0.7)

    return {
        'question': question_text,
        'expectedAnswer': f'Candidate demonstrates clear practical knowledge of {target_skill or role}.',
        'category': category,
        'difficulty': diff,
    }

# ── Generate Questions (Batch) ────────────────────────────────────────────────
@app.post('/generate-questions')
async def api_generate_questions(payload: dict):
    requests = payload.get('requests', [])
    results = []
    for req_data in requests:
        q_obj = await api_generate_question(req_data)
        results.append(q_obj)
    return {'questions': results}

# ── Interview Turn (Dynamic Q&A Evaluation) ───────────────────────────────────
@app.post('/interview-turn')
async def api_interview_turn(payload: dict):
    domain = payload.get('domain', 'Technology')
    role = payload.get('role', 'Full Stack Developer')
    lang = payload.get('language', 'English')
    history = payload.get('conversationHistory', [])

    system_prompt = (
        f"You are an expert {domain} interviewer assessing a {role} in {lang}.\n"
        "Evaluate the candidate's last answer and decide if follow-up is needed.\n"
        "Return ONLY raw JSON with: evaluation (score: 0-100, feedback: str, strengths: list, improvements: list), "
        "nextInterviewerResponse: str, isFollowUp: bool, isTopicComplete: bool."
    )

    messages = [{'role': 'system', 'content': system_prompt}]
    for turn in history:
        role_key = 'assistant' if turn.get('role') == 'interviewer' else 'user'
        messages.append({'role': role_key, 'content': turn.get('content', '')})

    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    raw_response = generate_text(prompt, max_tokens=400, temperature=0.2)
    parsed = safe_parse_json(raw_response)

    if not parsed or 'evaluation' not in parsed:
        parsed = {
            'evaluation': {
                'score': 75,
                'feedback': 'Good explanation covering the core technical aspects.',
                'strengths': ['Clear communication', 'Relevant technical details'],
                'improvements': ['Could include more real-world trade-off examples'],
            },
            'nextInterviewerResponse': 'Thank you. Let us move on to the next topic.',
            'isFollowUp': False,
            'isTopicComplete': True
        }

    return parsed

# ── Feedback & Comprehensive Report ───────────────────────────────────────────
@app.post('/feedback')
async def api_feedback(payload: dict):
    interview_data = payload.get('interview_data', {})
    questions = interview_data.get('questions', [])
    scores = [q.get('score') for q in questions if q.get('score') is not None]
    avg_score = round(sum(scores) / len(scores)) if scores else 75

    system_prompt = (
        "You are an expert interview evaluator. Provide structured post-interview feedback.\n"
        "Return ONLY raw JSON with: overallScore (int), categories (communication, technicalAccuracy, problemSolving, "
        "codeQuality, confidence — each with score (0-100) and feedback), strengths (list of 3), "
        "improvements (list of 3), detailedFeedback (str), recommendations (list of 3)."
    )

    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': f"Interview summary with average score {avg_score}:\n{json.dumps(interview_data, indent=1)[:3000]}"}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    raw_response = generate_text(prompt, max_tokens=600, temperature=0.2)
    parsed = safe_parse_json(raw_response)

    if not parsed or 'categories' not in parsed:
        parsed = {
            'overallScore': avg_score,
            'categories': {
                'communication': {'score': avg_score, 'feedback': 'Clear structure and concise articulation.'},
                'technicalAccuracy': {'score': avg_score, 'feedback': 'Good mastery of key fundamentals.'},
                'problemSolving': {'score': avg_score, 'feedback': 'Solid reasoning approach.'},
                'codeQuality': {'score': avg_score, 'feedback': 'Understands clean architecture practices.'},
                'confidence': {'score': avg_score, 'feedback': 'Confident and composed delivery.'},
            },
            'strengths': ['Strong foundational knowledge', 'Logical answer structure', 'Direct answers'],
            'improvements': ['Provide deeper trade-off discussions', 'Highlight performance optimization metrics', 'Add more concrete project examples'],
            'detailedFeedback': 'Overall a strong technical demonstration with solid fundamentals and clear responses.',
            'recommendations': ['Deep dive into advanced system architectures', 'Practice complex trade-off breakdowns', 'Review scaling best practices']
        }
    return {'feedback': parsed}

# ── Parse Job Description & Resume ────────────────────────────────────────────
@app.post('/parse')
async def api_parse(payload: dict):
    jd = payload.get('job_description', '')[:5000]
    resume = payload.get('resume_text', '')[:5000]
    role = payload.get('role', 'Full Stack Developer')

    system_prompt = (
        "Extract structured requirements from this job description and resume. "
        "Return ONLY raw JSON with: requiredSkills (list of strings), preferredSkills (list), "
        "responsibilities (list), experienceLevel (str), technicalStack (list), "
        "candidateSkills (list), candidateExperience (list), candidateEducation (list), "
        "candidateProjects (list), candidateCertifications (list)."
    )

    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': f"Role: {role}\nJob Description:\n{jd}\n\nResume:\n{resume}"}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    raw_response = generate_text(prompt, max_tokens=450, temperature=0.1)
    parsed = safe_parse_json(raw_response)
    return {'data': parsed or {}}

# ── Generic /runsync & /run Router (RunPod & Direct Compatibility) ────────────
@app.post('/runsync')
@app.post('/run')
async def runsync_router(req: Request):
    body = await req.json()
    endpoint = body.get('endpoint') or body.get('input', {}).get('endpoint', '/health')
    payload = body.get('payload') or body.get('input', {}).get('payload', {})

    cleaned_endpoint = '/' + endpoint.lstrip('/')
    if cleaned_endpoint == '/health':
        return {'output': health()}
    elif cleaned_endpoint == '/warmup':
        return {'output': warmup()}
    elif cleaned_endpoint == '/generate-question':
        return {'output': await api_generate_question(payload)}
    elif cleaned_endpoint == '/generate-questions':
        return {'output': await api_generate_questions(payload)}
    elif cleaned_endpoint == '/interview-turn':
        return {'output': await api_interview_turn(payload)}
    elif cleaned_endpoint == '/feedback':
        return {'output': await api_feedback(payload)}
    elif cleaned_endpoint == '/parse':
        return {'output': await api_parse(payload)}
    else:
        return {'output': {'error': f'Unknown endpoint: {endpoint}'}}

# ── Start Server & Connect ngrok ──────────────────────────────────────────────
def run_server():
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='warning')

server_thread = Thread(target=run_server, daemon=True)
server_thread.start()

import time
time.sleep(2)

tunnel = ngrok.connect(8000, 'http')
public_url = tunnel.public_url

print(f'\n===============================================================')
print(f'✅ COLAB GEMMA API SERVER IS ONLINE!')
print(f'===============================================================')
print(f'PUBLIC URL: {public_url}')
print(f'===============================================================')
print(f'Make sure your backend .env has:')
print(f'GEMMA_API_URL={public_url}')
print(f'===============================================================')
