import { UniversalEdgeTTS } from "../vendor/edge-tts-universal.js";
import type { TTSResult } from "../types/index.js";
import { AppError } from "../utils/errors.js";

const DEFAULT_TTS_VOICE = "ja-JP-NanamiNeural";

export async function synthesizeSpeech(text: string, voice = DEFAULT_TTS_VOICE): Promise<TTSResult> {
  try {
    const tts = new UniversalEdgeTTS(text, voice);
    const result = await tts.synthesize();
    return {
      audio: await result.audio.arrayBuffer(),
      contentType: result.audio.type || "audio/mpeg",
      durationMs: estimateDurationMs(text)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError(`TTS failed: ${message}`, 502, true);
  }
}

export function estimateDurationMs(text: string): number {
  const base = 1200;
  const perCharacter = 170;
  return Math.min(15000, Math.max(base, base + text.length * perCharacter));
}
