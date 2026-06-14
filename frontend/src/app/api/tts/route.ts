import { NextRequest, NextResponse } from "next/server";
import path from "path";
import dotenv from "dotenv";

// Load the root project .env (two levels up from frontend/src/app/api/tts)
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

/**
 * POST /api/tts
 * Accepts: { text: string, languageCode?: string }
 * Returns: audio/L16 (raw PCM) converted to WAV for browser playback
 *
 * Uses the Gemini 2.5 Flash TTS model (free tier).
 */
export async function POST(req: NextRequest) {
  try {
    const { text, languageCode = "en-US" } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[TTS] GEMINI_API_KEY is missing from root .env");
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in root .env" },
        { status: 500 }
      );
    }

    // Select voice based on language
    const voiceName = languageCode.startsWith("so") ? "Enceladus" : "Kore";

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
        },
      },
    };

    let response;
    let retries = 3;
    let delayMs = 1000;

    for (let i = 0; i < retries; i++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429 && i < retries - 1) {
        console.warn(`[TTS] 429 Rate Limit hit. Retrying in ${delayMs}ms...`);
        await new Promise((res) => setTimeout(res, delayMs));
        delayMs *= 2;
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      const errText = await response?.text();
      console.error(`[TTS] Gemini API error ${response?.status}:`, errText);
      return NextResponse.json(
        { error: `Gemini TTS API error: ${response?.status}` },
        { status: response?.status || 500 }
      );
    }

    const data = await response.json();

    // Extract the audio from the Gemini response
    const audioPart = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioPart || !audioPart.data) {
      console.error("[TTS] No audio data in Gemini response:", JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: "No audio data returned from Gemini" },
        { status: 500 }
      );
    }

    const rawPcmBuffer = Buffer.from(audioPart.data, "base64");

    // Gemini returns raw PCM (linear16, 24000 Hz, mono).
    // Browsers cannot play raw PCM, so we wrap it in a WAV header.
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const wavBuffer = createWavBuffer(rawPcmBuffer, sampleRate, numChannels, bitsPerSample);

    return new NextResponse(new Uint8Array(wavBuffer), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[TTS] Route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Wraps raw PCM data in a standard WAV (RIFF) header so browsers can play it.
 */
function createWavBuffer(
  pcmData: Buffer,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write("WAVE", 8);

  // fmt sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);           // Sub-chunk size (16 for PCM)
  buffer.writeUInt16LE(1, 20);            // Audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);   // Number of channels
  buffer.writeUInt32LE(sampleRate, 24);    // Sample rate
  buffer.writeUInt32LE(byteRate, 28);      // Byte rate
  buffer.writeUInt16LE(blockAlign, 32);    // Block align
  buffer.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // data sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);

  return buffer;
}
