import type { LineEvent } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { fetchWithTimeout } from "../utils/fetch.js";

async function sendMessage(accessToken: string, replyToken: string, messages: unknown[]): Promise<void> {
  const response = await fetchWithTimeout(
    "https://api.line.me/v2/bot/message/reply",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        replyToken,
        messages
      })
    },
    15000
  );

  if (!response.ok) {
    throw new AppError(`LINE reply failed with status ${response.status}`, response.status, response.status === 429 || response.status >= 500);
  }
}

export async function replyText(accessToken: string, replyToken: string, text: string): Promise<void> {
  await sendMessage(accessToken, replyToken, [{ type: "text", text }]);
}

export async function replyAudio(
  accessToken: string,
  replyToken: string,
  originalContentUrl: string,
  durationMs: number
): Promise<void> {
  await sendMessage(accessToken, replyToken, [
    {
      type: "audio",
      originalContentUrl,
      duration: Math.max(1000, Math.round(durationMs))
    }
  ]);
}

export function isTextMessageEvent(event: LineEvent): event is Required<Pick<LineEvent, "replyToken" | "message" | "source">> & LineEvent {
  return event.type === "message" && event.message?.type === "text" && Boolean(event.replyToken) && Boolean(event.source?.userId);
}
