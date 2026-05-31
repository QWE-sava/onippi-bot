import type { AudioArtifact } from "../types/index.js";

export async function uploadAudio(
  bucket: R2Bucket,
  baseUrl: string,
  audio: ArrayBuffer,
  contentType: string,
  durationMs: number
): Promise<AudioArtifact> {
  const key = `audio/${crypto.randomUUID()}.mp3`;
  await bucket.put(key, audio, {
    httpMetadata: { contentType },
    customMetadata: { durationMs: String(durationMs) }
  });

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return {
    key,
    url: `${normalizedBase}/${key}`,
    durationMs,
    contentType
  };
}
