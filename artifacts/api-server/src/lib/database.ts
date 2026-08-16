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

function seed(database: Database): void {  
  // ДОБАВЛЕНО: last_seen INTEGER DEFAULT 0
  run(database, `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    last_seen INTEGER DEFAULT 0
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
    "SELECT id, username, password, display_name, avatar_url, last_seen FROM users WHERE username = ?",
    [username]
  );
  return rows[0] || null;
}

export function createUser(db: any, username: string, password: string, displayName: string, avatarUrl?: string) {
  // ДОБАВЛЕНО: записываем текущее время при регистрации
  execute(
    db,
    "INSERT INTO users (username, password, display_name, avatar_url, last_seen) VALUES (?, ?, ?, ?, ?)",
    [username, password, displayName, avatarUrl || "", Date.now()]
  );
  const rows = queryRows<{ id: number }>(db, "SELECT last_insert_rowid() as id");
  return rows[0]?.id || 1;
}

export function searchUsers(db: any, query: string, currentUserId: number) {
  const searchPattern = "%" + query + "%";
  return queryRows(
    db,
    "SELECT id, display_name as displayName, avatar_url as avatarUrl, last_seen FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?",
    [searchPattern, searchPattern, currentUserId]
  );
}

