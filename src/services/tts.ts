import type { Env, TTSResult } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { fetchWithTimeout } from "../utils/fetch.js";

function fromBase64(text: string): ArrayBuffer {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function synthesizeSpeech(text: string, env: Env): Promise<TTSResult> {
  const response = await fetchWithTimeout(env.EDGE_TTS_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text,
      voice: env.EDGE_TTS_VOICE ?? "ja-JP-NanamiNeural",
      format: "mp3"
    })
  }, 20000);

  if (!response.ok) {
    throw new AppError(`TTS failed with status ${response.status}`, response.status, response.status === 429 || response.status >= 500);
  }

  const contentType = response.headers.get("content-type") ?? "audio/mpeg";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { audioBase64?: string; contentType?: string; durationMs?: number };
    if (!payload.audioBase64) {
      throw new AppError("TTS API returned JSON without audio", 502, false);
    }

    return {
      audio: fromBase64(payload.audioBase64),
      contentType: payload.contentType ?? "audio/mpeg",
      durationMs: payload.durationMs ?? estimateDurationMs(text)
    };
  }

  return {
    audio: await response.arrayBuffer(),
    contentType,
    durationMs: estimateDurationMs(text)
  };
}

export function estimateDurationMs(text: string): number {
  const base = 1200;
  const perCharacter = 170;
  return Math.min(15000, Math.max(base, base + text.length * perCharacter));
}
