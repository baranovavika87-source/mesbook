import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { logger } from "./logger";

const require = createRequire(import.meta.url);
const databasePath =
  process.env.MESBOOK_DB_PATH ??
  path.resolve(process.cwd(), "artifacts/api-server/data/mesbook2.sqlite");

let databasePromise: Promise<Database> | undefined;

type SqlValue = string | number | null;

function rows<T extends Record<string, unknown>>(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): T[] {
  const statement = database.prepare(sql);
  statement.bind(params);
  const result: T[] = [];
  while (statement.step()) {
    result.push(statement.getAsObject() as T);
  }
  statement.free();
  return result;
}

function run(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): void {
  database.run(sql, params);
}

export function queryRows<T extends Record<string, unknown>>(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): T[] {
  return rows<T>(database, sql, params);
}

export function execute(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): void {
  run(database, sql, params);
}

export async function persistDatabase(database: Database): Promise<void> {
  const bytes = database.export();
  await writeFile(databasePath, Buffer.from(bytes));
}

function seed(database: Database): void {  run(database, `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT ''
  )`);

  run(database, `CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`);
  run(database, `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_by_me INTEGER NOT NULL DEFAULT 0
    )`);
  run(database, `CREATE TABLE IF NOT EXISTS wall_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);

  const userCount = rows<{ count: number }>(
    database,
    "SELECT COUNT(*) AS count FROM users",
  )[0]?.count;

  if (Number(userCount) > 0) {
    return;
  }

  const now = Date.now();
  const at = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60_000).toISOString();

  run(
    database,
    `INSERT INTO users (id, username, password, display_name, avatar_url) VALUES
    (1, 'you', '123456', 'You', ''),
    (2, 'nia', '123456', 'Nia Rodriguez', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80'),
    (3, 'alex', '123456', 'Alex Chen', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'),
    (4, 'noah', '123456', 'Noah Williams', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80')`
  );
                                         
  run(
    database,
    `INSERT INTO chats (id, participant_id, created_at) VALUES
      (1, 2, ?),
      (2, 3, ?),
      (3, 4, ?)`,
    [at(8), at(145), at(330)],
  );
  run(
    database,
    `INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES
      (1, 2, 'The light in the studio is perfect today. Want to grab coffee after?', ?, 0),
      (1, 1, 'Absolutely. I know a place around the corner.', ?, 1),
      (2, 3, 'I sent over those notes from yesterday.', ?, 0),
      (3, 4, 'That little bookshop was such a good find.', ?, 1)`,
    [at(12), at(10), at(150), at(42)],
  );
  run(
    database,
    `INSERT INTO wall_posts (author_id, content, created_at) VALUES
      (2, 'Small wins count. Finally finished the reading list I started in spring.', ?),
      (3, 'The city feels extra quiet after the rain.', ?),
      (4, 'Found a new neighborhood bakery. The cardamom buns are worth the walk.', ?)`,
    [at(16), at(95), at(220)],
  );
}

async function initializeDatabase(SqlJs: SqlJsStatic): Promise<Database> {
  await mkdir(path.dirname(databasePath), { recursive: true });

  let database: Database;
  try {
    const bytes = await readFile(databasePath);
    database = new SqlJs.Database(bytes);
  } catch {
    database = new SqlJs.Database();
  }

  seed(database);
  await persistDatabase(database);
  logger.info({ databasePath }, "Mesbook SQLite database ready");
  return database;
}

export function getDatabase(): Promise<Database> {
  databasePromise ??= (async () => {
    const SqlJs = await initSqlJs({
      locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
    });
    return initializeDatabase(SqlJs);
  })();
    return databasePromise;
}

// Регистрация нового пользователя
export function getUserByUsername(db: any, username: string) {
  const rows = queryRows(
    db,
    "SELECT id, username, password, display_name, avatar_url FROM users WHERE username = ?",
    [username]
  );
  return rows[0] || null;
}

export function createUser(db: any, username: string, password: string, displayName: string, avatarUrl?: string) {
  execute(
    db,
    "INSERT INTO users (username, password, display_name, avatar_url) VALUES (?, ?, ?, ?)",
    [username, password, displayName, avatarUrl || ""]
  );
  const rows = queryRows<{ id: number }>(db, "SELECT last_insert_rowid() as id");
  return rows[0]?.id || 1;
}

export function searchUsers(db: any, query: string, currentUserId: number) {
  const searchPattern = "%" + query + "%";
  return queryRows(
    db,
    "SELECT id, display_name as displayName, avatar_url as avatarUrl FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?",
    [searchPattern, searchPattern, currentUserId]
  );
}
