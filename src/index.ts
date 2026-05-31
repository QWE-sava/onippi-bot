import type { Env, LineWebhookBody } from "./types/index.js";
import { LlmRouter } from "./router/llmRouter.js";
import { ensureUser, getRecentMessages, saveMessage } from "./services/history.js";
import { replyAudio, replyText } from "./services/line.js";
import { synthesizeSpeech } from "./services/tts.js";
import { uploadAudio } from "./services/r2.js";
import { toErrorMessage } from "./utils/errors.js";
import { logger } from "./utils/logger.js";

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

async function validateLineSignature(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get("x-line-signature");
  if (!signature) {
    return false;
  }

  const body = await request.clone().text();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return actual === signature;
}

async function synthesizeAndStore(text: string, env: Env) {
  const audio = await synthesizeSpeech(text);
  const uploaded = await uploadAudio(
    env.AUDIO_BUCKET,
    env.R2_PUBLIC_BASE_URL,
    audio.audio,
    audio.contentType,
    audio.durationMs
  );

  return { audio, uploaded };
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (!(await validateLineSignature(request, env))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const body = (await request.json()) as LineWebhookBody;
  const events = body.events ?? [];

  logger.info("LINE", "Message Received", { count: events.length });

  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId;
    const text = event.message?.text;

    if (event.type !== "message" || event.message?.type !== "text" || !replyToken || !userId || !text) {
      continue;
    }

    const inputText = text.trim();

    try {
      await ensureUser(env.D1_DB, userId);
      await saveMessage(env.D1_DB, userId, "user", inputText);

      const history = await getRecentMessages(env.D1_DB, userId, 10);
      const llm = new LlmRouter(env);
      const responseText = await llm.generateResponse(inputText, history);

      await saveMessage(env.D1_DB, userId, "assistant", responseText);

      const audio = await synthesizeSpeech(responseText);
      logger.info("TTS", "SUCCESS", { durationMs: audio.durationMs });

      const uploaded = await uploadAudio(
        env.AUDIO_BUCKET,
        env.R2_PUBLIC_BASE_URL,
        audio.audio,
        audio.contentType,
        audio.durationMs
      );
      logger.info("R2", "UPLOAD SUCCESS", { key: uploaded.key });

      await replyAudio(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, uploaded.url, uploaded.durationMs);
      logger.info("LINE", "REPLY SUCCESS");
    } catch (error) {
      logger.error("LINE", "Processing failed", toErrorMessage(error));

      try {
        await replyText(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, "おにっぴ今ちょっと眠いのだ…");
      } catch (replyError) {
        logger.error("LINE", "Fallback reply failed", toErrorMessage(replyError));
      }
    }
  }

  return new Response("OK");
}

async function handleTtsTest(env: Env): Promise<Response> {
  const text = "おにっぴなのだ！";
  const { audio, uploaded } = await synthesizeAndStore(text, env);

  logger.info("TTS", "TEST SUCCESS", { durationMs: audio.durationMs, key: uploaded.key });

  return json({
    ok: true,
    text,
    key: uploaded.key,
    url: uploaded.url,
    contentType: uploaded.contentType,
    durationMs: uploaded.durationMs
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "onippi-worker" });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    if (url.pathname === "/test-tts" && request.method === "GET") {
      return handleTtsTest(env);
    }

    return new Response("Not Found", { status: 404 });
  }
};
