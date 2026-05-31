# onippi-worker

Cloudflare Workers, D1, R2, LINE Messaging API, and Edge-TTS をつないだ「おにっぴ」Bot の基盤です。

## 使うもの

- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- LINE Messaging API
- Edge-TTS
- GLM / Groq / Gemini / DeepSeek

## 環境変数

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

GLM_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=

EDGE_TTS_API_URL=
EDGE_TTS_VOICE=ja-JP-NanamiNeural
R2_PUBLIC_BASE_URL=
```

## Edge-TTS の戻り値

`EDGE_TTS_API_URL` は次のどちらかで返せる実装を想定しています。

- `audio/mpeg` などの音声バイナリ
- `application/json` で `audioBase64` を返す形式

JSON の場合は、`contentType` と `durationMs` を一緒に返せます。

## D1

```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## ルート

- `GET /health`
- `POST /webhook`

## 音声保存

- R2 の `audio/` 配下に保存
- Cloudflare 側の Lifecycle Rules で 30 分後に削除

## 開発メモ

- `wrangler dev` でローカル起動
- `wrangler deploy` で公開
