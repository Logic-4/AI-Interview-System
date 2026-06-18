import { NextRequest, NextResponse } from "next/server";
import path from "path";
import dotenv from "dotenv";

export const runtime = "nodejs";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

function getPiperBaseUrl() {
  return (process.env.PIPER_BASE_URL || "http://localhost:5001").replace(/\/+$/, "");
}

function getPiperVoice(languageCode: string) {
  const isSomali = languageCode.toLowerCase().startsWith("so");
  return (isSomali ? process.env.PIPER_SO_VOICE : process.env.PIPER_EN_VOICE) || "";
}

export async function POST(req: NextRequest) {
  try {
    const { text, languageCode = "en-US" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const body: Record<string, string | number> = {
      text,
      length_scale: 1,
    };

    const voice = getPiperVoice(languageCode).trim();
    if (voice) {
      body.voice = voice;
    }

    const response = await fetch(`${getPiperBaseUrl()}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Piper HTTP ${response.status}: ${errorBody.slice(0, 300)}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    if (!audioBuffer.byteLength) {
      return NextResponse.json({ error: "Piper returned empty audio." }, { status: 502 });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/wav",
        "Cache-Control": "no-store, max-age=0",
        "X-TTS-Provider": "Piper",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Piper TTS error";
    console.warn("[TTS] Piper route error:", message);
    return NextResponse.json(
      {
        error:
          "Piper TTS server is not available. Start it with: python -m piper.http_server -m en_US-lessac-medium --port 5001",
        detail: message,
      },
      { status: 503 }
    );
  }
}
