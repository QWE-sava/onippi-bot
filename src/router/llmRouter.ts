import type { Env, Message } from "../types/index.js";
import { ONIPPI_SYSTEM_PROMPT } from "../prompts/onippi.js";
import { logger } from "../utils/logger.js";
import { toErrorMessage } from "../utils/errors.js";
import { generateWithDeepSeek } from "../providers/deepseek.js";
import { generateWithGemini } from "../providers/gemini.js";
import { generateWithGlm } from "../providers/glm.js";
import { generateWithGroq } from "../providers/groq.js";

type ProviderFn = (messages: Message[], env: Env) => Promise<string>;

export class LlmRouter {
  private readonly providers: Array<{ name: string; fn: ProviderFn }>;

  constructor(private readonly env: Env) {
    this.providers = [
      { name: "GLM", fn: generateWithGlm },
      { name: "Groq", fn: generateWithGroq },
      { name: "Gemini", fn: generateWithGemini },
      { name: "DeepSeek", fn: generateWithDeepSeek }
    ];
  }

  async generateResponse(message: string, history: Message[]): Promise<string> {
    const conversation: Message[] = [
      { role: "system", content: ONIPPI_SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message }
    ];

    for (const provider of this.providers) {
      try {
        const reply = await provider.fn(conversation, this.env);
        logger.info("LLM", `${provider.name} SUCCESS`);
        return this.sanitizeReply(reply);
      } catch (error) {
        const messageText = toErrorMessage(error);
        logger.warn("LLM", `${provider.name} FAILED`, messageText);
      }
    }

    return "おにっぴ今ちょっと眠いのだ…";
  }

  private sanitizeReply(text: string): string {
    const compact = text.replace(/\s+\n/g, "\n").trim();
    const lines = compact.split(/\r?\n/).filter(Boolean);
    const clipped = lines.slice(0, 3).join(" ");
    return clipped.length > 0 ? clipped : "おにっぴ今ちょっと眠いのだ…";
  }
}
