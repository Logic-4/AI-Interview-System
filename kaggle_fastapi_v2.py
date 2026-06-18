!pip install fastapi uvicorn nest-asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import nest_asyncio
import uvicorn
import threading
import traceback
import json
import re
import socket

# Allow nested event loops (required for Kaggle/Jupyter notebooks)
nest_asyncio.apply()

app = FastAPI()

# ---------------------------------------------------------
# CORS MIDDLEWARE
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# LOAD MODEL
# ---------------------------------------------------------
from huggingface_hub import login

# IMPORTANT: You MUST paste your Hugging Face Token here!
HF_TOKEN = "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" 

try:
    login(token=HF_TOKEN)
except Exception as e:
    print("Warning: Hugging Face login failed. Check your HF_TOKEN.")

model_id = "Mohamud24/gemma-3-technical-interviewer"
print("Loading the massive AI model into the GPU...")
tokenizer = AutoTokenizer.from_pretrained(model_id, token=HF_TOKEN)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    dtype=torch.bfloat16,
    device_map="auto",
    token=HF_TOKEN
)
print("Model loaded and dual-API is ready!")

# ---------------------------------------------------------
# HELPER: PARSE JSON FROM MODEL OUTPUT
# ---------------------------------------------------------
def try_parse_json(text: str):
    try:
        # Strip markdown code blocks
        text = re.sub(r"```[jJ]son\s*", "", text)
        text = re.sub(r"```", "", text).strip()
        
        # Find the outermost JSON object
        first_brace = text.find("{")
        if first_brace != -1:
            depth = 0
            in_string = False
            escape = False
            last_brace = -1
            for i in range(first_brace, len(text)):
                ch = text[i]
                if escape:
                    escape = False
                    continue
                if ch == '\\' and in_string:
                    escape = True
                    continue
                if ch == '"' and not escape:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        last_brace = i
                        break
            
            if last_brace != -1:
                json_str = text[first_brace:last_brace+1]
                
                # Cleanup common LLM JSON mistakes
                # 1. Fix trailing commas: {"a": 1,} -> {"a": 1}
                json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
                # 2. Fix Python booleans/None
                json_str = re.sub(r'\bTrue\b', 'true', json_str)
                json_str = re.sub(r'\bFalse\b', 'false', json_str)
                json_str = re.sub(r'\bNone\b', 'null', json_str)
                
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    # Fallback if standard json.loads fails after cleanup
                    pass
    except Exception as e:
        print("JSON parse exception:", e)
    return None

# ---------------------------------------------------------
# ENDPOINT 0: HEALTH CHECK
# ---------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": model_id
    }

# ---------------------------------------------------------
# ENDPOINT 1: DYNAMIC INTERVIEW TURN (EVALUATE + NEXT QUESTION)
# ---------------------------------------------------------
@app.post("/interview-turn")
async def interview_turn(request: Request):
    try:
        data = await request.json()
        conversation_history = data.get("conversationHistory", [])
        domain               = data.get("domain", "general")
        role                 = data.get("role", "candidate")
        language             = data.get("language", "english")
        type_str             = data.get("type", "technical")
        
        lang_hint = (
            "Respond in English. You are a real human hiring manager conducting an interview. "
            "Be direct, conversational, and professional. NEVER use robotic AI buzzwords. "
            if language.lower() == "english"
            else
            "IMPORTANT: Your ENTIRE nextInterviewerResponse MUST be in Somali. DO NOT use English! "
            "Ku hadal af-Soomaali dabiici ah oo aad u xirfad iyo naxwe sarreeya. "
            f"Jargon-ka farsamada iyo erey-bixinta u gaarka ah maadada ama shaqada '{domain}' ha u turjumin af-Soomaali, "
            "balse u daa Ingiriis ahaan adigoo ku habeynaya naxwaha Soomaaliga."
        )

        # Note whether the candidate's answer is in Somali (the last candidate turn)
        somali_note = ""
        if language.lower() == "somali":
            somali_note = (
                "IMPORTANT SCORING NOTE: The candidate's answer is written in Somali (af-Soomaali). "
                "You MUST evaluate the content and meaning of the answer — NOT the language it is written in. "
                "Do NOT penalize for writing in Somali. A correct Somali answer must receive the same score "
                "as an equivalent English answer. Evaluate based on technical accuracy and completeness only.\n\n"
            )

        system_prompt = (
            f"You are an expert {domain} interviewer hiring for a {role} position. "
            f"The interview style/type is {type_str}. "
            f"{lang_hint}\n\n"
            f"{somali_note}"
            f"SCORING RULES:\n"
            f"- 90-100: Great practical understanding.\n"
            f"- 80-89: Good understanding, minor mistakes.\n"
            f"- 65-79: Partial understanding.\n"
            f"- Below 65: Wrong or unrelated.\n\n"
            f"BEHAVIOR RULES:\n"
            f"1. Keep `nextInterviewerResponse` EXTREMELY short (1-2 sentences max). React naturally, do NOT give long explanations.\n"
            f"2. If answer is partial, set isFollowUp=true and ask ONE very short follow-up question.\n"
            f"3. If answer is good, set isFollowUp=false and isTopicComplete=true.\n\n"
            f"CRITICAL: Keep ALL string values in your JSON short (under 80 characters each) so the response fits within the token limit.\n\n"
            f"Return ONLY raw JSON:\n"
            f'{{"evaluation": {{"score": 85, "feedback": "Short.", "strengths": ["One strength"], "improvements": ["One improvement"], "suggestedAnswer": "Brief ideal answer."}}, '
            f'"nextInterviewerResponse": "Short spoken response.", '
            f'"isFollowUp": false, "isTopicComplete": true}}'
        )
        
        # Build conversational prompt, ensuring strictly alternating roles for Gemma 3
        # Start with a user message containing the system instructions
        messages = [{"role": "user", "content": system_prompt}]
        for turn in conversation_history:
            # Map system to user so it merges with the first prompt, 
            # map interviewer to assistant, candidate to user.
            role_map = {"interviewer": "assistant", "candidate": "user", "system": "user"}
            mapped_role = role_map.get(turn["role"], "user")
            
            # Combine consecutive messages of the same role
            if messages[-1]["role"] == mapped_role:
                messages[-1]["content"] += "\n\n" + turn["content"]
            else:
                messages.append({"role": mapped_role, "content": turn["content"]})
            
        # Add instruction to the end
        instruction = "Evaluate my last answer and respond in the strict JSON format. Keep all string values short."
        if messages[-1]["role"] == "user":
            messages[-1]["content"] += "\n\n" + instruction
        else:
            messages.append({"role": "user", "content": instruction})

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        with torch.no_grad():
            # Increased max_new_tokens to 450 to avoid mid-JSON truncation on long Somali responses
            outputs = model.generate(**inputs, max_new_tokens=450, temperature=0.6, do_sample=True)

        response = tokenizer.decode(
            outputs[0][inputs["input_ids"].shape[-1]:],
            skip_special_tokens=True
        )

        parsed = try_parse_json(response)
        if parsed and "nextInterviewerResponse" in parsed:
            return parsed

        return {
            "evaluation": { "score": 0, "feedback": "Could not parse AI response. Answer recorded.", "strengths": [], "improvements": [], "suggestedAnswer": "" },
            "nextInterviewerResponse": response.strip(),
            "isFollowUp": False,
            "isTopicComplete": False
        }

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ---------------------------------------------------------
# ENDPOINT 2: QUESTION GENERATOR
# ---------------------------------------------------------
@app.post("/generate-question")
async def generate_question(request: Request):
    try:
        data = await request.json()
        language         = data.get("language", "english")
        domain           = data.get("domain", "general")
        role             = data.get("role", "candidate")
        category         = data.get("category", "intro")
        type_str         = data.get("type", "technical")
        candidateName    = data.get("candidateName", "Candidate")
        skills           = data.get("skills", [])
        responsibilities = data.get("responsibilities", [])
        experience       = data.get("experience", "")
        job_description  = data.get("jobDescription", "")

        lang_hint = (
            "Generate the question in English." 
            if language.lower() == "english" 
            else 
            "IMPORTANT: Generate the question ENTIRELY in Somali. DO NOT use English! "
            "Ku hadal af-Soomaali dabiici ah oo aad u xirfad iyo naxwe sarreeya. "
            f"Jargon-ka farsamada iyo erey-bixinta u gaarka ah maadada ama shaqada '{domain}' ha u turjumin af-Soomaali, "
            "balse u daa Ingiriis ahaan adigoo ku habeynaya naxwaha Soomaaliga."
        )

        if category == "intro":
            if language.lower() == "somali":
                question = f"Soo dhawoow {candidateName}! Aniga ayaa ku wareysan doona maanta. Ma iska kay warami kartaa?"
                expected_answer = "Candidate provides a brief overview of their background and experience."
            else:
                question = f"Hello {candidateName}! I will be your interviewer today. Could you tell me a little bit about yourself?"
                expected_answer = "Candidate provides a brief overview of their background and experience."
            
            return {
                "question": question,
                "expectedAnswer": expected_answer
            }
        elif category == "outro":
            if language.lower() == "somali":
                question = "Waad ku mahadsantahay wakhtigaaga maanta. Ma qabtaa wax su'aalo ah oo aad iwaydiiso ka hor intaanan soo afjarin?"
                expected_answer = "Candidate asks questions about the role, company culture, or next steps."
            else:
                question = "Thank you for your time today. Do you have any questions for me before we wrap up?"
                expected_answer = "Candidate asks questions about the role, company culture, or next steps."
            
            return {
                "question": question,
                "expectedAnswer": expected_answer
            }
        else:
            # Build a context block from parsed responsibilities, skills, and experience
            context_block = ""
            if skills:
                context_block += f"The job requires these skills: {', '.join(skills)}.\n"
                context_block += f"Your question MUST test one of these specific skills.\n"
            if responsibilities:
                context_block += f"Key responsibilities for this role include: {', '.join(responsibilities[:5])}.\n"
            if experience:
                context_block += f"Required experience level: {experience}.\n"
            if job_description:
                context_block += f"Job description details: {job_description[:400]}\n"
                context_block += f"Ensure the question aligns with the context and requirements provided above.\n"

            prompt_content = (
                f"You are an expert {domain} interviewer hiring for a {role} position.\n"
                f"The interview style/type is {type_str}.\n"
                f"{lang_hint}\n\n"
                f"{context_block}\n"
                f"RULES FOR QUESTION GENERATION:\n"
                f"- The question MUST be natural and conversational.\n"
                f"- If this is a technical or conceptual question, ask directly (e.g., 'What is...', 'How does X work?', 'Explain the difference between...').\n"
                f"- If this is a behavioral question, ask for an example (e.g., 'Tell me about a time...').\n"
                f"- DO NOT use multi-part questions. Ask ONE clear thing.\n"
                f"- Keep it concise, similar to a real human interviewer.\n"
                f"- Max 20 words.\n\n"
                f"Generate a {category} interview question (style: {type_str}) for a {role} role.\n\n"
                f"Return ONLY valid JSON with keys: question (string), expectedAnswer (string)."
            )

        messages = [
            {
                "role": "user",
                "content": prompt_content
            }
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        with torch.no_grad():
            # Lower max tokens to speed up question generation
            outputs = model.generate(**inputs, max_new_tokens=150, temperature=0.7, do_sample=True)

        response = tokenizer.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)

        parsed = try_parse_json(response)
        if parsed and ("question" in parsed or "text" in parsed):
            return {
                "question":       parsed.get("question") or parsed.get("text", ""),
                "expectedAnswer": parsed.get("expectedAnswer") or parsed.get("expected_answer") or parsed.get("answer", "")
            }

        # ── Fallback validation ────────────────────────────────────────────────
        # If JSON parsing fails and the raw text doesn't look like a question
        # (no question mark, or it reads like a constraint/instruction), do NOT
        # save it as a real question. Instead return a safe generic question.
        raw_fallback = response.strip()
        looks_like_question = "?" in raw_fallback and len(raw_fallback) < 300
        constraint_keywords = ["no code", "not allowed", "external websites", "do not", "you must", "note:", "rule:"]
        is_constraint = any(kw in raw_fallback.lower() for kw in constraint_keywords)

        if looks_like_question and not is_constraint:
            return {"question": raw_fallback, "expectedAnswer": ""}

        # Safe default question when the fallback text is a constraint, rule, or garbage
        if language.lower() == "somali":
            default_q = f"Maxaad ka garanaysaa shaqada {domain} iyo sida ay uga muhiimsan tahay xirfadahaaga?"
        else:
            default_q = f"Can you describe your experience and approach to working in the {domain} domain?"
        print(f"[generate-question] WARNING: Raw fallback rejected (looked like constraint or garbage). Returning safe default. Raw was: {raw_fallback[:200]}")
        return {"question": default_q, "expectedAnswer": "Candidate describes relevant experience and domain knowledge."}

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ---------------------------------------------------------
# ENDPOINT 3: PARSE JOB DESCRIPTION
# ---------------------------------------------------------
@app.post("/parse")
async def parse_job_description(request: Request):
    try:
        data            = await request.json()
        job_description = data.get("job_description", "")
        role            = data.get("role", "")

        messages = [
            {
                "role": "user",
                "content": (
                    "You are an expert job description parser. "
                    "Extract structured data from this job description. "
                    "IMPORTANT: Keep all arrays to a MAXIMUM of 8 items each. "
                    "Keep all string values under 60 characters. "
                    "Return ONLY raw JSON with EXACTLY these keys: "
                    "requiredSkills (array of strings), preferredSkills (array of strings), "
                    "responsibilities (array of strings), experienceLevel (string), technicalStack (array of strings).\n\n"
                    f"Parse this job description for a {role} role:\n\n{job_description}"
                )
            }
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=256, temperature=0.3)

        response = tokenizer.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)

        parsed = try_parse_json(response)
        if parsed:
            return {"data": parsed}

        return {"data": {"requiredSkills": [], "preferredSkills": [], "responsibilities": [], "experienceLevel": "", "technicalStack": []}}

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ---------------------------------------------------------
# ENDPOINT 4: COMPREHENSIVE FEEDBACK
# ---------------------------------------------------------
@app.post("/feedback")
async def generate_feedback(request: Request):
    try:
        data           = await request.json()
        interview_data = data.get("interview_data", {})

        # Build a concise summary of the interview to avoid exceeding token limits
        questions_summary = []
        for q in interview_data.get("questions", []):
            questions_summary.append({
                "question": q.get("text", "")[:200],
                "answer": q.get("userAnswer", "")[:300],
                "score": q.get("score"),
                "category": q.get("category", ""),
                "aiFeedback": q.get("aiFeedback", "")[:150],
            })

        interview_summary = {
            "title": interview_data.get("title", ""),
            "type": interview_data.get("type", ""),
            "domain": interview_data.get("domain", ""),
            "difficulty": interview_data.get("difficulty", ""),
            "jobRole": interview_data.get("jobRole", ""),
            "overallScore": interview_data.get("overallScore"),
            "questions": questions_summary,
        }

        messages = [
            {
                "role": "user",
                "content": (
                    "You are a supportive interview coach evaluating a PRACTICE interview session.\n"
                    "This is for training purposes — be encouraging and constructive.\n\n"
                    "CRITICAL LENGTH RULES (to avoid truncation):\n"
                    "- All feedback strings MUST be under 60 characters each.\n"
                    "- strengths: max 3 items, each under 50 chars.\n"
                    "- improvements: max 3 items, each under 50 chars.\n"
                    "- recommendations: max 3 items, each under 60 chars.\n"
                    "- detailedFeedback: max 150 characters total.\n\n"
                    "SCORING GUIDELINES (be generous):\n"
                    "- If the candidate showed understanding of most concepts: score 70-85\n"
                    "- If the candidate gave strong, detailed answers: score 85-100\n"
                    "- If the candidate struggled but showed effort: score 50-70\n"
                    "- Only score below 40 if answers were completely off-topic\n"
                    "- Focus on what the candidate did RIGHT, not just mistakes\n\n"
                    "You MUST return ONLY raw JSON with EXACTLY this structure:\n"
                    '{\n'
                    '  "overallScore": 85,\n'
                    '  "categories": {\n'
                    '    "communication": {"score": 80, "feedback": "Clear."},\n'
                    '    "technicalAccuracy": {"score": 90, "feedback": "Good depth."},\n'
                    '    "problemSolving": {"score": 85, "feedback": "Logical."},\n'
                    '    "codeQuality": {"score": 80, "feedback": "Structured."},\n'
                    '    "confidence": {"score": 90, "feedback": "Confident."}\n'
                    '  },\n'
                    '  "strengths": ["strength 1", "strength 2"],\n'
                    '  "improvements": ["area 1", "area 2"],\n'
                    '  "detailedFeedback": "Short overall summary here.",\n'
                    '  "recommendations": ["action 1", "action 2"]\n'
                    '}\n\n'
                    f"Interview data:\n{json.dumps(interview_summary, indent=1)}"
                )
            }
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        with torch.no_grad():
            # 600 tokens: /feedback generates the most complex JSON (5 categories + arrays)
            # Prompt constraints enforce brevity so this budget is almost always sufficient
            outputs = model.generate(**inputs, max_new_tokens=600, temperature=0.3)

        response = tokenizer.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)

        parsed = try_parse_json(response)
        if parsed:
            # Normalize: ensure all expected keys exist
            normalized = {
                "overallScore": parsed.get("overallScore", 0),
                "categories": {
                    "communication": parsed.get("categories", {}).get("communication", {"score": 0, "feedback": ""}),
                    "technicalAccuracy": parsed.get("categories", {}).get("technicalAccuracy", {"score": 0, "feedback": ""}),
                    "problemSolving": parsed.get("categories", {}).get("problemSolving", {"score": 0, "feedback": ""}),
                    "codeQuality": parsed.get("categories", {}).get("codeQuality", {"score": 0, "feedback": ""}),
                    "confidence": parsed.get("categories", {}).get("confidence", {"score": 0, "feedback": ""}),
                },
                "strengths": parsed.get("strengths", []),
                "improvements": parsed.get("improvements", []),
                "detailedFeedback": parsed.get("detailedFeedback", parsed.get("summary", "")),
                "recommendations": parsed.get("recommendations", []),
            }
            return {"feedback": normalized}

        # Fallback: could not parse JSON
        return {
            "feedback": {
                "overallScore": 0,
                "categories": {
                    "communication": {"score": 0, "feedback": ""},
                    "technicalAccuracy": {"score": 0, "feedback": ""},
                    "problemSolving": {"score": 0, "feedback": ""},
                    "codeQuality": {"score": 0, "feedback": ""},
                    "confidence": {"score": 0, "feedback": ""},
                },
                "strengths": [],
                "improvements": ["AI could not generate structured feedback for this session."],
                "detailedFeedback": response.strip(),
                "recommendations": []
            }
        }

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ---------------------------------------------------------
# SERVER STARTUP (Kaggle / Jupyter notebook compatible)
# ---------------------------------------------------------
def is_port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def find_available_port(start_port: int = 8000, attempts: int = 20) -> int:
    for port in range(start_port, start_port + attempts):
        if is_port_free(port):
            return port
    raise RuntimeError(f"No free port found from {start_port} to {start_port + attempts - 1}")


API_PORT = find_available_port(8000)
if API_PORT != 8000:
    print(f"Port 8000 is already in use, probably by a previous notebook run. Using port {API_PORT} instead.")


def start_server():
    uvicorn.run(app, host="0.0.0.0", port=API_PORT)


# Start uvicorn in a background thread
server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
print(f"FastAPI Server running on http://127.0.0.1:{API_PORT}")

# ---------------------------------------------------------
# TUNNEL SETUP (Cloudflare Tunnel & Ngrok Options)
# ---------------------------------------------------------
# To use Ngrok (static URL), set NGROK_AUTHTOKEN and NGROK_DOMAIN below.
# Otherwise, the script will automatically use Cloudflare Tunnel (100% free, no signup).
NGROK_AUTHTOKEN = ""
NGROK_DOMAIN = "" # e.g. "my-static-subdomain.ngrok-free.app"

def setup_tunnel():
    import os
    import subprocess
    import time
    import re
    
    if NGROK_AUTHTOKEN and NGROK_DOMAIN:
        print("⚡ Setting up Ngrok Tunnel with static domain...")
        os.system("pip install -q pyngrok")
        from pyngrok import ngrok
        ngrok.set_auth_token(NGROK_AUTHTOKEN)
        tunnel = ngrok.connect(API_PORT, pyngrok_config=None, bind_tls=True, hostname=NGROK_DOMAIN)
        print("\n" + "="*60)
        print("🎉 Ngrok Tunnel Online (Static URL)!")
        print(f"🔗 URL: {tunnel.public_url}")
        print("="*60 + "\n")
        return
        
    print("⚡ Setting up Cloudflare Tunnel (no signup needed)...")
    if not os.path.exists("./cloudflared"):
        print("Downloading cloudflared binary...")
        os.system("curl -L --output cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64")
        os.system("chmod +x cloudflared")
        
    print("Starting Cloudflare Tunnel...")
    proc = subprocess.Popen(
        ["./cloudflared", "tunnel", "--url", f"http://localhost:{API_PORT}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    tunnel_url = None
    start_time = time.time()
    while True:
        line = proc.stdout.readline()
        if not line:
            break
        print(line, end="")
        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            print("\n" + "="*60)
            print("🎉 Cloudflare Tunnel Online!")
            print(f"🔗 URL: {tunnel_url}")
            print("Copy the URL above and paste it in your Backend/Frontend settings!")
            print("="*60 + "\n")
            break
        if time.time() - start_time > 30:
            print("\nTimeout waiting for Cloudflare Tunnel URL. Check logs above.")
            break
            
    # Keep reading in background to prevent process blocking
    def log_tunnel():
        for _ in proc.stdout:
            pass
            
    threading.Thread(target=log_tunnel, daemon=True).start()

# Launch the tunnel
setup_tunnel()
