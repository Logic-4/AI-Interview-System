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
HF_TOKEN = "hf_your_token_here" 

try:
    login(token=HF_TOKEN)
except Exception as e:
    print("Warning: Hugging Face login failed. Check your HF_TOKEN.")

model_id = "Mohamud24/gemma-3-technical-interviewer-merged"
print("Loading the massive AI model into the GPU...")
tokenizer = AutoTokenizer.from_pretrained(model_id, token=HF_TOKEN)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.bfloat16,
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
            "Jargon-ka farsamada (sida React, API, Database, Server) ha u turjumin af-Soomaali, "
            "balse u daa Ingiriis ahaan adigoo ku habeynaya naxwaha Soomaaliga."
        )

        system_prompt = (
            f"You are an expert {domain} interviewer hiring for a {role} position. "
            f"The interview style/type is {type_str}. "
            f"{lang_hint}\n\n"
            f"SCORING RULES (BE EXTREMELY LENIENT AND ENCOURAGING):\n"
            f"- DO NOT demand a 100% perfect academic or textbook answer. This is a practical practice interview.\n"
            f"- If the candidate answers the question and demonstrates a good practical understanding of the concept, score them 90-100.\n"
            f"- If the candidate understands the general concept but misses minor details or has small wording mistakes, score them 80-90.\n"
            f"- If the candidate gives a partial answer showing some general understanding, score them 65-80.\n"
            f"- Only score below 50 if the answer is completely wrong, empty, or totally unrelated.\n"
            f"- Focus on what the candidate gets RIGHT, not what they leave out. Be highly supportive and encouraging.\n\n"
            f"BEHAVIOR RULES:\n"
            f"1. CONFUSION: If the candidate asks for clarification or gives a confused response (under 10 words), "
            f"set isFollowUp=true, rephrase the question simply, and score 0.\n"
            f"2. SHALLOW ANSWER: If partial, set isFollowUp=true and ask a brief follow-up.\n"
            f"3. GOOD ANSWER: If answered well, set isFollowUp=false and isTopicComplete=true.\n\n"
            f"Return ONLY raw JSON:\n"
            f'{{"evaluation": {{"score": 85, "feedback": "Good answer...", "strengths": ["Clear communication"], "improvements": ["More detail on X"], "suggestedAnswer": "An ideal answer..."}}, '
            f'"nextInterviewerResponse": "Your spoken response.", '
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
        instruction = "Analyze my last answer, evaluate it, and generate your next response in the strict JSON format requested."
        if messages[-1]["role"] == "user":
            messages[-1]["content"] += "\n\n" + instruction
        else:
            messages.append({"role": "user", "content": instruction})

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        with torch.no_grad():
            # Use lower max_tokens to reduce latency and force concise responses
            outputs = model.generate(**inputs, max_new_tokens=512, temperature=0.6, do_sample=True)

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

        lang_hint = "Generate the question in English." if language.lower() == "english" else "IMPORTANT: Generate the question ENTIRELY in Somali. Do not use English."

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
                f"RULES:\n"
                f"- The question MUST be EXTREMELY DIRECT and SHORT.\n"
                f"- DO NOT use any filler words or long background stories.\n"
                f"- Start with direct question words like 'What is', 'How do you', 'Explain', 'Why is'.\n"
                f"- Do NOT write multi-part questions. Ask ONE simple thing.\n"
                f"- Keep the question under 15 words.\n\n"
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

        return {"question": response.strip(), "expectedAnswer": ""}

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
                    "Extract key skills, experience requirements, and responsibilities. "
                    "Return ONLY raw JSON with keys: "
                    "keySkills (array of strings), experience (string), responsibilities (array of strings).\n\n"
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

        return {"data": {"keySkills": [], "experience": "", "responsibilities": []}}

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
                    '    "communication": {"score": 80, "feedback": "Clear and concise."},\n'
                    '    "technicalAccuracy": {"score": 90, "feedback": "Good technical depth."},\n'
                    '    "problemSolving": {"score": 85, "feedback": "Strong logical approach."},\n'
                    '    "codeQuality": {"score": 80, "feedback": "Good structure."},\n'
                    '    "confidence": {"score": 90, "feedback": "Spoke confidently."}\n'
                    '  },\n'
                    '  "strengths": ["strength 1", "strength 2"],\n'
                    '  "improvements": ["area 1", "area 2"],\n'
                    '  "detailedFeedback": "Overall, the candidate performed well...",\n'
                    '  "recommendations": ["action 1", "action 2"]\n'
                    '}\n\n'
                    f"Interview data:\n{json.dumps(interview_summary, indent=1)}"
                )
            }
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        with torch.no_grad():
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
def start_server():
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Start uvicorn in a background thread
server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
print("FastAPI Server running on http://127.0.0.1:8000")

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
        tunnel = ngrok.connect(8000, pyngrok_config=None, bind_tls=True, hostname=NGROK_DOMAIN)
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
        ["./cloudflared", "tunnel", "--url", "http://localhost:8000"],
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
