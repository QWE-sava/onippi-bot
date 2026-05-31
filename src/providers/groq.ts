import type { Env, Message } from "../types/index.js";
import { callChatApi } from "./shared.js";

export async function generateWithGroq(messages: Message[], env: Env): Promise<string> {
  return callChatApi(
    {
      provider: "Groq",
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL ?? "llama-3.1-8b-instant",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      buildPayload: (items, model) => ({
        model,
        messages: items.map(({ role, content }) => ({ role, content })),
        temperature: 0.8,
        max_tokens: 256
      }),
      parseResponse: (json) => {
        const payload = json as { choices?: Array<{ message?: { content?: string } }> };
        return payload.choices?.[0]?.message?.content ?? null;
      }
    },
    messages
  );
}
