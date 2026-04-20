const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate interview questions using GPT-4
 * @param {string} type - Interview type (technical, behavioral, system-design)
 * @param {string} domain - Domain (frontend, backend, etc.)
 * @param {string} difficulty - Difficulty level (junior, mid, senior, lead)
 * @param {number} count - Number of questions to generate
 * @returns {Array} Array of question objects
 */
const generateInterviewQuestions = async (type, domain, difficulty, count = 5, context = {}) => {
  try {
    const { jobRole, jobDescription, focusSkills } = context;

    // Build a rich, domain-aware prompt
    const roleLabel = jobRole || `${difficulty}-level ${domain} professional`;
    const typeLabel = {
      technical: 'technical/skill-based',
      behavioral: 'behavioral (STAR-method)',
      'system-design': 'system design and architecture',
      hr: 'HR screening (motivation, culture fit, strengths/weaknesses)',
      mixed: 'mixed (technical + behavioral + situational)',
    }[type] || type;

    let contextBlock = '';
    if (jobDescription) {
      contextBlock += `\n\nJob Description provided by candidate:\n"""${jobDescription.slice(0, 3000)}"""\nUse this JD to tailor questions to the specific responsibilities, tools, and qualifications mentioned.`;
    }
    if (focusSkills && focusSkills.length > 0) {
      contextBlock += `\n\nCandidate wants to focus on these skills: ${focusSkills.join(', ')}. Ensure at least half the questions cover these areas.`;
    }

    const prompt = `You are an expert interviewer across all industries and departments. Generate ${count} ${typeLabel} interview questions for a "${roleLabel}" position (${difficulty} experience level, ${domain} domain).${contextBlock}

For each question, provide:
1. The question text (realistic, industry-standard)
2. A category that fits the domain (e.g., for tech: "algorithms", "system design"; for healthcare: "patient care", "clinical knowledge"; for finance: "financial analysis", "risk management"; for marketing: "campaign strategy", "analytics"; etc.)
3. Difficulty level (easy, medium, hard) — calibrated to the ${difficulty} experience level
4. An ideal/expected answer that a strong candidate would give

Return ONLY a JSON array:
[
  {
    "text": "Question text here",
    "category": "relevant category",
    "difficulty": "easy|medium|hard",
    "expectedAnswer": "Comprehensive ideal answer"
  }
]

Rules:
- Questions must be realistic and match current industry standards for ${domain}.
- For behavioral questions, frame them using the STAR method.
- For HR questions, focus on motivation, culture fit, career goals, and soft skills.
- Vary difficulty within the set (mix easy/medium/hard appropriate to ${difficulty} level).
- No duplicate or overly similar questions.
Only return the JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content: 'You are an expert interviewer who generates realistic interview questions for any industry — technology, healthcare, finance, marketing, legal, education, engineering, and more. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 4000,
    });

    const content = response.choices[0].message.content.trim();
    // Parse JSON — handle potential markdown code block wrapping
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(jsonStr);

    logger.info(`Generated ${questions.length} questions for ${type}/${domain}/${difficulty}`);
    return questions;
  } catch (error) {
    logger.error(`OpenAI question generation failed: ${error.message}`);
    throw new Error(`Failed to generate questions: ${error.message}`);
  }
};

/**
 * Evaluate a user's answer using GPT-4
 * @param {string} questionText - The original question
 * @param {string} expectedAnswer - The ideal answer
 * @param {string} userAnswer - The user's answer
 * @returns {Object} { score, feedback }
 */
const evaluateAnswer = async (questionText, expectedAnswer, userAnswer) => {
  try {
    const prompt = `You are an expert interviewer evaluating a candidate's answer across any industry.

Question: ${questionText}

Expected/Ideal Answer: ${expectedAnswer}

Candidate's Answer: ${userAnswer}

Please evaluate the candidate's answer and provide:
1. A score from 0 to 100 (be fair — partial credit for partially correct answers)
2. Detailed feedback explaining the score
3. An array of strengths (what was done well)
4. An array of improvements (what could be improved)
5. A short "better answer" suggestion

Return as JSON:
{
  "score": <number>,
  "feedback": "<detailed feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "suggestedAnswer": "<concise improved answer>"
}

Only return the JSON, no other text.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content: 'You are a fair and thorough interviewer for any industry. Evaluate answers objectively. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 1500,
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const evaluation = JSON.parse(jsonStr);

    logger.info(`Answer evaluated — score: ${evaluation.score}`);
    return evaluation;
  } catch (error) {
    logger.error(`OpenAI answer evaluation failed: ${error.message}`);
    throw new Error(`Failed to evaluate answer: ${error.message}`);
  }
};

/**
 * Generate comprehensive interview feedback using GPT-4
 * @param {Object} interviewData - Interview with populated questions
 * @returns {Object} Structured feedback
 */
const generateComprehensiveFeedback = async (interviewData) => {
  try {
    const questionsAndAnswers = interviewData.questions
      .map(
        (q, i) =>
          `Q${i + 1}: ${q.text}\nAnswer: ${q.userAnswer || 'Not answered'}\nScore: ${q.score || 'N/A'}/100`
      )
      .join('\n\n');

    const prompt = `You are an expert career coach and technical interviewer. Analyze this complete mock interview and provide comprehensive feedback.

Interview Type: ${interviewData.type}
Domain: ${interviewData.domain}
Difficulty Level: ${interviewData.difficulty}
Duration: ${interviewData.duration} minutes

Questions and Answers:
${questionsAndAnswers}

Provide a comprehensive evaluation in this JSON format:
{
  "overallScore": <0-100>,
  "categories": {
    "communication": { "score": <0-100>, "feedback": "<feedback>" },
    "technicalAccuracy": { "score": <0-100>, "feedback": "<feedback>" },
    "problemSolving": { "score": <0-100>, "feedback": "<feedback>" },
    "codeQuality": { "score": <0-100>, "feedback": "<feedback>" },
    "confidence": { "score": <0-100>, "feedback": "<feedback>" }
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "detailedFeedback": "<2-3 paragraph narrative feedback>",
  "recommendations": ["<actionable recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}

Only return the JSON, no other text.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content: 'You are a supportive yet honest career coach. Provide constructive, actionable feedback. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_completion_tokens: 3000,
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const feedback = JSON.parse(jsonStr);

    logger.info(`Comprehensive feedback generated — overall score: ${feedback.overallScore}`);
    return feedback;
  } catch (error) {
    logger.error(`OpenAI feedback generation failed: ${error.message}`);
    throw new Error(`Failed to generate feedback: ${error.message}`);
  }
};

/**
 * Transcribe audio using OpenAI Whisper API
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @returns {string} Transcribed text
 */
const transcribeAudio = async (audioBuffer, filename = 'audio.webm') => {
  try {
    // Create a File object from the buffer
    const file = new File([audioBuffer], filename, {
      type: 'audio/webm',
    });

    const response = await openai.audio.transcriptions.create({
      model: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
      file,
      language: 'en',
      response_format: 'text',
    });

    logger.info(`Audio transcribed successfully (${audioBuffer.length} bytes)`);
    return response;
  } catch (error) {
    logger.error(`Whisper transcription failed: ${error.message}`);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
};

module.exports = {
  generateInterviewQuestions,
  evaluateAnswer,
  generateComprehensiveFeedback,
  transcribeAudio,
};
