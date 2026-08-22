import { logger } from "./logger";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://") as string;
const authToken = process.env.TURSO_AUTH_TOKEN as string;

// Прямой универсальный запрос к Turso через стандартный fetch
async function tursoQuery(sql: string, args: any[] = []) {
  const response = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args } },
        { type: "close" }
      ]
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Turso HTTP error: ${response.status} - ${errText}`);
  }

  const data: any = await response.json();
  const result = data.results[0];
  
  if (result.type === "error") {
    throw new Error(`Turso SQL error: ${result.error.message}`);
  }

  const cols = result.response.result.cols.map((c: any) => c.name);
  const rows = result.response.result.rows.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((col: string, idx: number) => {
      // Преобразуем формат значений Turso в обычные типы
      const val = row[idx];
      obj[col] = val !== null && val !== undefined ? (val.value !== undefined ? val.value : val) : null;
    });
    return obj;
  });

  return { rows };
}

export async function initializeDatabase() {
  try {
    await tursoQuery(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, display_name TEXT NOT NULL, avatar_url TEXT DEFAULT '', bio TEXT DEFAULT '', last_seen INTEGER DEFAULT 0)`);
    await tursoQuery(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, participant_id INTEGER NOT NULL, created_at TEXT NOT NULL)`);
    await tursoQuery(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, read_by_me INTEGER NOT NULL DEFAULT 0)`);
    await tursoQuery(`CREATE TABLE IF NOT EXISTS wall_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`);

    logger.info("✅ Таблицы в Turso успешно созданы через HTTP API");
  } catch (error: any) {
    logger.error({ message: error?.message }, "❌ Ошибка инициализации Turso HTTP");
  }
}

initializeDatabase();

// Эмулируем объект базы для совместимости с остальным кодом
const dbAdapter = {
  execute: async (stmt: any) => {
    const sql = typeof stmt === "string" ? stmt : stmt.sql;
    const args = typeof stmt === "string" ? [] : (stmt.args || []);
    return await tursoQuery(sql, args);
  }
};

export async function getDatabase() {
  return dbAdapter;
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

