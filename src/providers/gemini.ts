import type { Env, Message } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { fetchWithTimeout } from "../utils/fetch.js";

function toGeminiRole(role: Message["role"]): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

export async function generateWithGemini(messages: Message[], env: Env): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError("Gemini API key is not configured", 401, false);
  }

  const model = env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: messages.map((item) => ({
          role: toGeminiRole(item.role),
          parts: [{ text: item.content }]
        })),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 256
        }
      })
    },
    15000
  );

  if (!response.ok) {
    throw new AppError(`Gemini returned status ${response.status}`, response.status, response.status === 429 || response.status >= 500);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!content) {
    throw new AppError("Gemini returned empty response", 502, false);
  }

  return content;
}
