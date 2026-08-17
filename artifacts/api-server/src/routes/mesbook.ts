import { Router, type IRouter } from "express";
import {
  execute,
  getDatabase,
  persistDatabase,
  queryRows,
  createUser,
  getUserByUsername,
  searchUsers
} from "../lib/database";
import { broadcastToChat, broadcastToWall } from "../lib/realtime";

const router: IRouter = Router();

type UserRow = {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  last_seen: number; 
};

function userFromRow(row: UserRow) {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    lastSeen: Number(row.last_seen) || 0,
  };
}

function getUser(database: Awaited<ReturnType<typeof getDatabase>>, id: number) {
  const row = queryRows<UserRow>(
    database,
    "SELECT id, username, display_name, avatar_url, last_seen FROM users WHERE id = ?",
    [id],
  )[0];
  return row ? userFromRow(row) : null;
}

router.post("/ping", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]);
  if (!currentUserId) { 
    res.status(401).json({ error: "Unauthorized" }); 
    return; 
  }
  
  const database = await getDatabase();
  execute(database, "UPDATE users SET last_seen = ? WHERE id = ?", [Date.now(), currentUserId]);
  await persistDatabase(database);
  res.json({ success: true });
});

router.get("/me", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  const user = getUser(database, currentUserId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(user);
});

router.patch("/me", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const { displayName, avatarUrl, username, password } = req.body;
  
  const database = await getDatabase();
  let user = getUser(database, currentUserId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  if (username !== undefined && username.trim() !== "") {
    let newUsername = username.trim();
    if (!newUsername.startsWith('@')) {
      newUsername = '@' + newUsername;
    }
    
    const existing = queryRows(
      database, 
      "SELECT id FROM users WHERE username = ? AND id != ?", 
      [newUsername, currentUserId]
    );
    if (existing.length > 0) {
      res.status(400).json({ error: "Этот никнейм уже занят кем-то другим" });
      return;
    }
    execute(database, "UPDATE users SET username = ? WHERE id = ?", [newUsername, currentUserId]);
  }
  
  if (displayName !== undefined && displayName.trim() !== "") {
    execute(
      database,
      "UPDATE users SET display_name = ? WHERE id = ?",
      [displayName.trim(), currentUserId],
    );
  }
  
  if (avatarUrl !== undefined) {
    execute(
      database,
      "UPDATE users SET avatar_url = ? WHERE id = ?",
      [avatarUrl, currentUserId],
    );
  }

  if (password !== undefined && password.trim() !== "") {
    execute(
      database,
      "UPDATE users SET password = ? WHERE id = ?",
      [password, currentUserId],
    );
  }
  
  await persistDatabase(database);
  
  const updatedUser = getUser(database, currentUserId);
  res.json(updatedUser);
});

router.get("/chats", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  
  const chatRows = queryRows<{
    chat_id: number;
    last_message: string;
    last_message_at: string;
    unread_count: number;
  }>(
    database,
    `SELECT 
        m.chat_id, 
        m.content as last_message,
        m.created_at as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = m.chat_id AND sender_id != ? AND read_by_me = 0) AS unread_count
     FROM messages m
     WHERE m.id IN (SELECT MAX(id) FROM messages GROUP BY chat_id)
     AND (CAST(m.chat_id / 10000 AS INT) = ? OR m.chat_id % 10000 = ?)
     ORDER BY m.created_at DESC`,
    [currentUserId, currentUserId, currentUserId]
  );

  const chats = chatRows.map((row) => {
    const cId = Number(row.chat_id);
    const u1 = Math.floor(cId / 10000);
    const u2 = cId % 10000;
    const otherUserId = (u1 === currentUserId) ? u2 : u1;
    const participant = getUser(database, otherUserId);

    return {
        id: cId,
        participant: participant || { id: otherUserId, username: "Пользователь", displayName: "Пользователь", avatarUrl: "", lastSeen: 0 },
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at,
        unreadCount: Number(row.unread_count)
    };
  });

  res.json(chats);
});

router.get("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  
  if (!chatId) {
    res.status(400).json({ error: "Invalid chatId" });
    return;
  }
  
  const database = await getDatabase();
  const messages = queryRows<{
    id: number;
    chat_id: number;
    sender_id: number;
    sender_name: string;
    content: string;
    created_at: string;
  }>(
    database,
    `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name,
      m.content, m.created_at
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id ASC`,
    [chatId],
  ).map((row) => ({
    id: Number(row.id),
    chatId: Number(row.chat_id),
    senderId: Number(row.sender_id),
    senderName: row.sender_name || "Пользователь",
    content: row.content,
    createdAt: row.created_at,
    isMine: Number(row.sender_id) === currentUserId,
  }));

  execute(
    database,
    "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?",
    [chatId, currentUserId],
  );
  await persistDatabase(database);
  res.json(messages);
});

router.post("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  const content = String(req.body?.content || "").trim();
  
  if (!chatId || !content) {
    res.status(400).json({ error: "Message and valid chat ID required" });
    return;
  }
  
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  
  execute(
    database,
    "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, 1)",
    [chatId, currentUserId, content, createdAt],
  );
  
  const message = queryRows<{
    id: number;
    chat_id: number;
    sender_id: number;
    sender_name: string;
    content: string;
    created_at: string;
  }>(
    database,
    `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name,
      m.content, m.created_at
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 1`,
    [chatId],
  )[0];
  
  await persistDatabase(database);

  const response = {
    id: Number(message.id),
    chatId: Number(message.chat_id),
    senderId: Number(message.sender_id),
    senderName: message.sender_name,
    content: message.content,
    createdAt: message.created_at,
    isMine: true,
  };
  
  broadcastToChat(chatId, response);
  res.status(201).json(response);
});

router.get("/wall/posts", async (req, res): Promise<void> => {
  const database = await getDatabase();
  const postsRows = queryRows<{
    id: number;
    author_id: number;
    content: string;
    created_at: string;
  }>(
    database,
    "SELECT id, author_id, content, created_at FROM wall_posts ORDER BY id DESC",
  );

  const posts = postsRows.flatMap((row) => {
    const author = getUser(database, Number(row.author_id));
    if (!author) return [];
    return [
      {
        id: Number(row.id),
        author,
        content: row.content,
        createdAt: row.created_at,
      },
    ];
  });

  res.json(posts);
});

router.post("/wall/posts", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const content = String(req.body?.content || "").trim();
  if (!content) {
    res.status(400).json({ error: "Post cannot be empty" });
    return;
  }
  
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  
  execute(
    database,
    "INSERT INTO wall_posts (author_id, content, created_at) VALUES (?, ?, ?)",
    [currentUserId, content, createdAt],
  );
  
  const post = {
    id: Number(
      queryRows<{ id: number }>(
        database,
        "SELECT id FROM wall_posts ORDER BY id DESC LIMIT 1",
      )[0]?.id,
    ),
    author: getUser(database, currentUserId),
    content,
    createdAt,
  };
  
  await persistDatabase(database);
  broadcastToWall(post);
  res.status(201).json(post);
});

router.post("/register", async (req, res) => {
  const { username, password, displayName, avatarUrl } = req.body;
  
  let newUsername = username.trim();
  if (!newUsername.startsWith('@')) {
    newUsername = '@' + newUsername;
  }

  const db = await getDatabase();
  const existing = getUserByUsername(db, newUsername);
  if (existing) {
    return res.status(400).json({ error: "Пользователь с таким ником уже существует" });
  }
  const userId = createUser(db, newUsername, password, displayName || newUsername, avatarUrl || "");
  await persistDatabase(db);
  return res.json({ id: userId, username: newUsername, displayName: displayName || newUsername, avatarUrl: avatarUrl || "" });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  let checkUsername = username.trim();
  if (!checkUsername.startsWith('@')) {
    checkUsername = '@' + checkUsername;
  }

  const db = await getDatabase();
  const user = getUserByUsername(db, checkUsername);
  if (!user || user.password !== password) {
    return res.status(403).json({ error: "Неверный логин или пароль" });
  }
  
  execute(db, "UPDATE users SET last_seen = ? WHERE id = ?", [Date.now(), user.id]);
  await persistDatabase(db);
  
  return res.json({ id: user.id, username: user.username, displayName: user.display_name, avatarUrl: user.avatar_url });
});

router.get("/users/search", async (req, res) => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const query = String(req.query.q || "");
  
  const searchPattern1 = "%" + query + "%";
  const searchPattern2 = "%@" + query + "%";
  
  const db = await getDatabase();
  const users = queryRows(
    db,
    "SELECT id, username, display_name as displayName, avatar_url as avatarUrl, last_seen as lastSeen FROM users WHERE (username LIKE ? OR username LIKE ? OR display_name LIKE ?) AND id != ?",
    [searchPattern1, searchPattern2, searchPattern1, currentUserId]
  );
  return res.json(users);
});

export default router;
