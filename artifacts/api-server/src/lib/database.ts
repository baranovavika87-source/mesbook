import { createClient } from "@libsql/client";
import { logger } from "./logger";

// Создаем подключение с явным отключением миграций
const db = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
  intMode: "number"
});

export async function initializeDatabase() {
  try {
    // Используем прямой сырой запрос через внутренний fetch, если libsql упрямится, 
    // но сначала попробуем стандартный метод без триггеров миграций
    await db.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, display_name TEXT NOT NULL, avatar_url TEXT DEFAULT '', bio TEXT DEFAULT '', last_seen INTEGER DEFAULT 0)");
    await db.execute("CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, participant_id INTEGER NOT NULL, created_at TEXT NOT NULL)");
    await db.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, read_by_me INTEGER NOT NULL DEFAULT 0)");
    await db.execute("CREATE TABLE IF NOT EXISTS wall_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)");

    logger.info("✅ Таблицы в Turso успешно проверены/созданы");
  } catch (error: any) {
    logger.error({ message: error?.message }, "❌ Ошибка инициализации Turso");
  }
}

initializeDatabase();

export async function getDatabase() {
  return db;
}

export async function getUserByUsername(database: any, username: string) {
  const result = await database.execute({
    sql: "SELECT id, username, password, display_name, avatar_url, bio, last_seen FROM users WHERE username = ?",
    args: [username],
  });
  return result.rows[0] || null;
}

export async function createUser(database: any, username: string, password: string, displayName: string, avatarUrl?: string) {
  await database.execute({
    sql: "INSERT INTO users (username, password, display_name, avatar_url, bio, last_seen) VALUES (?, ?, ?, ?, ?, ?)",
    args: [username, password, displayName, avatarUrl || "", "", Date.now()],
  });
  
  const result = await database.execute("SELECT last_insert_rowid() as id");
  return Number(result.rows[0]?.id) || 1;
}

export async function searchUsers(database: any, query: string, currentUserId: number) {
  const searchPattern = "%" + query + "%";
  const result = await database.execute({
    sql: "SELECT id, display_name as displayName, avatar_url as avatarUrl, bio, last_seen FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?",
    args: [searchPattern, searchPattern, currentUserId],
  });
  return result.rows;
}
