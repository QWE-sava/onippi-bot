export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
  createdAt?: string;
}

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
}

export interface LineWebhookBody {
  events?: LineEvent[];
}

export interface Env {
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;

  GLM_API_KEY?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;

  R2_PUBLIC_BASE_URL: string;

  GLM_MODEL?: string;
  GROQ_MODEL?: string;
  GEMINI_MODEL?: string;
  DEEPSEEK_MODEL?: string;

  D1_DB: D1Database;
  AUDIO_BUCKET: R2Bucket;
}

export interface AudioArtifact {
  key: string;
  url: string;
  durationMs: number;
  contentType: string;
}

export interface TTSResult {
  audio: ArrayBuffer;
  contentType: string;
  durationMs: number;
}
