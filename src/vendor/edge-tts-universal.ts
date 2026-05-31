const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-130.0.2849.68";
const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

export interface TTSOptions {
  rate?: string;
  volume?: string;
  pitch?: string;
}

export interface TTSResult {
  audio: Blob;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toUtcTimestampString(date = new Date()): string {
  return date.toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}

function buildSsml(text: string, voice: string, options: TTSOptions = {}): string {
  const rate = options.rate ?? "+0%";
  const volume = options.volume ?? "+0%";
  const pitch = options.pitch ?? "+0Hz";

  return [
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>",
    `<voice name='${escapeXml(voice)}'>`,
    `<prosody pitch='${escapeXml(pitch)}' rate='${escapeXml(rate)}' volume='${escapeXml(volume)}'>`,
    escapeXml(text),
    "</prosody>",
    "</voice>",
    "</speak>"
  ].join("");
}

async function generateSecMsGec(): Promise<string> {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10000000;
  const input = new TextEncoder().encode(`${windowsTicks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function parseHeaders(raw: Uint8Array | ArrayBuffer): { headers: Record<string, string>; data: Uint8Array } {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const headerLength = (bytes[0] << 8) | bytes[1];
  const headerBytes = bytes.slice(2, 2 + headerLength);
  const data = bytes.slice(2 + headerLength);
  const headerText = new TextDecoder().decode(headerBytes);
  const headers: Record<string, string> = {};

  for (const line of headerText.split("\r\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    headers[key] = value;
  }

  return { headers, data };
}

function buildConfigMessage(): string {
  return [
    `X-Timestamp:${toUtcTimestampString()}`,
    "Content-Type:application/json; charset=utf-8",
    "Path:speech.config",
    "",
    '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}'
  ].join("\r\n");
}

function buildSpeechMessage(requestId: string, ssml: string): string {
  return [
    `X-RequestId:${requestId}`,
    "Content-Type:application/ssml+xml",
    `X-Timestamp:${toUtcTimestampString()}`,
    "Path:ssml",
    "",
    ssml
  ].join("\r\n");
}

function createWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    fetch(url, {
      headers: {
        Upgrade: "websocket",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Accept-Language": "en-US,en;q=0.9"
      }
    })
      .then((response) => {
        const webSocket = response.webSocket;
        if (!webSocket) {
          throw new Error("server didn't accept WebSocket");
        }
        webSocket.accept();
        resolve(webSocket);
      })
      .catch(reject);
  });
}

export class EdgeTTS {
  constructor(
    private readonly text: string,
    private readonly voice: string,
    private readonly options: TTSOptions = {}
  ) {}

  async synthesize(): Promise<TTSResult> {
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const secMsGec = await generateSecMsGec();
    const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${requestId}`;
    const webSocket = await createWebSocket(url);
    const ssml = buildSsml(this.text, this.voice, this.options);
    const audioChunks: Uint8Array[] = [];
    let settled = false;

    return await new Promise<TTSResult>((resolve, reject) => {
      const cleanup = () => {
        webSocket.removeEventListener("message", onMessage);
        webSocket.removeEventListener("error", onError);
        webSocket.removeEventListener("close", onClose);
      };

      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (audioChunks.length === 0) {
          reject(new Error("No audio data received"));
          return;
        }
        const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        resolve({ audio: new Blob([merged], { type: "audio/mpeg" }) });
      };

      const onMessage = (event: MessageEvent<string | ArrayBuffer | ArrayBufferView>) => {
        if (typeof event.data === "string") {
          const text = event.data;
          const pathMatch = text.match(/Path:([^\r\n]+)/);
          const path = pathMatch?.[1];
          if (path === "turn.end") {
            finish();
            webSocket.close();
          }
          return;
        }

        const raw = event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);

        if (raw.length < 2) {
          return;
        }

        const { headers, data } = parseHeaders(raw);
        if (headers.Path !== "audio") {
          if (headers.Path === "turn.end") {
            finish();
            webSocket.close();
          }
          return;
        }

        if (data.length === 0) {
          return;
        }

        audioChunks.push(data);
      };

      const onError = (event: Event) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(event);
      };

      const onClose = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (audioChunks.length === 0) {
          reject(new Error("No audio data received"));
          return;
        }
        const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        resolve({ audio: new Blob([merged], { type: "audio/mpeg" }) });
      };

      webSocket.addEventListener("message", onMessage);
      webSocket.addEventListener("error", onError);
      webSocket.addEventListener("close", onClose);

      webSocket.send(buildConfigMessage());
      webSocket.send(buildSpeechMessage(requestId, ssml));
    });
  }
}

export class UniversalEdgeTTS extends EdgeTTS {}
