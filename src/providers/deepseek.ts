import type { Env, Message } from "../types/index.js";
import { callChatApi } from "./shared.js";

export async function generateWithDeepSeek(messages: Message[], env: Env): Promise<string> {
  return callChatApi(
    {
      provider: "DeepSeek",
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL ?? "deepseek-chat",
      endpoint: "https://api.deepseek.com/chat/completions",
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
