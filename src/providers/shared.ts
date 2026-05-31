import type { Message } from "../types/index.js";
import { AppError, ProviderError, isRetryableStatus } from "../utils/errors.js";
import { fetchWithTimeout } from "../utils/fetch.js";

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  model?: string;
  endpoint: string;
  buildPayload: (messages: Message[], model: string) => unknown;
  parseResponse: (json: unknown) => string | null;
}

export async function callChatApi(config: ProviderConfig, messages: Message[]): Promise<string> {
  if (!config.apiKey) {
    throw new ProviderError(config.provider, "API key is not configured", 401, false);
  }

  const model = config.model ?? "";
  const response = await fetchWithTimeout(
    config.endpoint,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(config.buildPayload(messages, model))
    },
    15000
  );

  if (!response.ok) {
    throw new ProviderError(
      config.provider,
      `Provider returned status ${response.status}`,
      response.status,
      isRetryableStatus(response.status)
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new AppError(`${config.provider} returned invalid JSON`, 502, false);
  }

  const content = config.parseResponse(json);
  if (!content) {
    throw new AppError(`${config.provider} returned empty response`, 502, false);
  }

  return content.trim();
}
