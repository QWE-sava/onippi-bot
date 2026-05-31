import type { Message } from "../types/index.js";

export async function ensureUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
}

export async function saveMessage(
  db: D1Database,
  userId: string,
  role: Message["role"],
  content: string
): Promise<void> {
  await db
    .prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)")
    .bind(userId, role, content)
    .run();
}

export async function getRecentMessages(db: D1Database, userId: string, limit = 10): Promise<Message[]> {
  const result = await db
    .prepare(
      "SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
    )
    .bind(userId, limit)
    .all<{ role: Message["role"]; content: string; created_at: string }>();

  return (result.results ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      role: row.role,
      content: row.content,
      createdAt: row.created_at
    }));
}
