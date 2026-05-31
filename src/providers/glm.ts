import type { Env, Message } from "../types/index.js";
import { callChatApi } from "./shared.js";

export async function generateWithGlm(messages: Message[], env: Env): Promise<string> {
  return callChatApi(
    {
      provider: "GLM",
      apiKey: env.GLM_API_KEY,
      model: env.GLM_MODEL ?? "glm-4.7-flash",
      endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      buildPayload: (items, model) => ({
        model,
        messages: items.map(({ role, content }) => ({ role, content })),
        temperature: 0.8,
        max_tokens: 256
      }),
      parseResponse: (json) => {
        const choices = json as { choices?: Array<{ message?: { content?: string } }> };
        return choices.choices?.[0]?.message?.content ?? null;
      }
    },
    messages
  );
}
