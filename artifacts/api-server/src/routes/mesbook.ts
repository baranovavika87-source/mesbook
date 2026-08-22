import { Router, type IRouter } from "express";
import {
  getDatabase,
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
  bio: string; 
  last_seen: number; 
};

function userFromRow(row: any) {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio || "", 
    lastSeen: Number(row.last_seen) || 0,
  };
}

// Теперь функция асинхронная, так как идет запрос в облако Turso
async function getUser(database: any, id: number) {
  const result = await database.execute({
    sql: "SELECT id, username, display_name, avatar_url, bio, last_seen FROM users WHERE id = ?", 
    args: [id],
  });
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

function getActualChatId(currentUserId: number, paramId: number) {
  if (paramId >= 10000) return paramId; 
  const min = Math.min(currentUserId, paramId);
  const max = Math.max(currentUserId, paramId);
  return min * 10000 + max;
}

router.post("/ping", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]);
  if (!currentUserId) { 
    res.status(401).json({ error: "Unauthorized" }); 
    return; 
  }
  
  const database = await getDatabase();
  await database.execute({
    sql: "UPDATE users SET last_seen = ? WHERE id = ?",
    args: [Date.now(), currentUserId]
  });
  res.json({ success: true });
});

router.get("/me", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  const user = await getUser(database, currentUserId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(user);
});

router.patch("/me", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const { displayName, avatarUrl, username, password, bio } = req.body; 
  
  const database = await getDatabase();
  let user = await getUser(database, currentUserId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  if (username !== undefined && username.trim() !== "") {
    let newUsername = username.trim();
    if (!newUsername.startsWith('@')) {
      newUsername = '@' + newUsername;
    }
    
    const existing = await database.execute({
      sql: "SELECT id FROM users WHERE username = ? AND id != ?",
      args: [newUsername, currentUserId]
    });
    if (existing.rows.length > 0) {
      res.status(400).json({ error: "Этот никнейм уже занят кем-то другим" });
      return;
    }
    await database.execute({ sql: "UPDATE users SET username = ? WHERE id = ?", args: [newUsername, currentUserId] });
  }
  
  if (displayName !== undefined && displayName.trim() !== "") {
    await database.execute({ sql: "UPDATE users SET display_name = ? WHERE id = ?", args: [displayName.trim(), currentUserId] });
  }
  
  if (avatarUrl !== undefined) {
    await database.execute({ sql: "UPDATE users SET avatar_url = ? WHERE id = ?", args: [avatarUrl, currentUserId] });
  }

  if (bio !== undefined) {
    await database.execute({ sql: "UPDATE users SET bio = ? WHERE id = ?", args: [bio, currentUserId] });
  }

  if (password !== undefined && password.trim() !== "") {
    await database.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [password, currentUserId] });
  }
  
  const updatedUser = await getUser(database, currentUserId);
  res.json(updatedUser);
});

router.get("/users/search", async (req, res) => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const query = String(req.query.q || "");
  
  const searchPattern1 = "%" + query + "%";
  const searchPattern2 = "%@" + query + "%";
  
  const db = await getDatabase();
  const usersResult = await db.execute({
    sql: "SELECT id, username, display_name as displayName, avatar_url as avatarUrl, bio, last_seen as lastSeen FROM users WHERE (username LIKE ? OR username LIKE ? OR display_name LIKE ?) AND id != ?",
    args: [searchPattern1, searchPattern2, searchPattern1, currentUserId]
  });
  return res.json(usersResult.rows);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const database = await getDatabase();
  const user = await getUser(database, id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.get("/chats", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  
  const chatRows = await database.execute({
    sql: `SELECT 
        m.chat_id, 
        m.content as last_message,
        m.created_at as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = m.chat_id AND sender_id != ? AND read_by_me = 0) AS unread_count
     FROM messages m
     WHERE m.id IN (SELECT MAX(id) FROM messages GROUP BY chat_id)
     AND (CAST(m.chat_id / 10000 AS INT) = ? OR m.chat_id % 10000 = ?)
     ORDER BY m.created_at DESC`,
    args: [currentUserId, currentUserId, currentUserId]
  });

  const chats = await Promise.all(chatRows.rows.map(async (row: any) => {
    const cId = Number(row.chat_id);
    const u1 = Math.floor(cId / 10000);
    const u2 = cId % 10000;
    const otherUserId = (u1 === currentUserId) ? u2 : u1;
    const participant = await getUser(database, otherUserId);

    return {
        id: cId,
        participant: participant || { id: otherUserId, username: "Пользователь", displayName: "Пользователь", avatarUrl: "", lastSeen: 0 },
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at,
        unreadCount: Number(row.unread_count)
    };
  }));

  res.json(chats);
});

router.post("/chats/:chatId/read", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const rawChatId = Number(req.params.chatId);
  if (!rawChatId) {
    res.status(400).json({ error: "Invalid chatId" });
    return;
  }
  
  const chatId = getActualChatId(currentUserId, rawChatId);
  const database = await getDatabase();
  
  await database.execute({
    sql: "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?",
    args: [chatId, currentUserId]
  });
  res.json({ success: true });
});

router.get("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const rawChatId = Number(req.params.chatId);
  
  if (!rawChatId) {
    res.status(400).json({ error: "Invalid chatId" });
    return;
  }
  
  const chatId = getActualChatId(currentUserId, rawChatId);
  const database = await getDatabase();
  
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name,
      m.content, m.created_at, m.read_by_me
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id ASC`,
    args: [chatId]
  });

  const messages = result.rows.map((row: any) => ({
    id: Number(row.id),
    chatId: Number(row.chat_id),
    senderId: Number(row.sender_id),
    senderName: row.sender_name || "Пользователь",
    content: row.content,
    createdAt: row.created_at,
    isMine: Number(row.sender_id) === currentUserId,
    isRead: Number(row.read_by_me) === 1,
  }));

  await database.execute({
    sql: "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?",
    args: [chatId, currentUserId]
  });
  res.json(messages);
});

router.post("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const rawChatId = Number(req.params.chatId);
  const content = String(req.body?.content || "").trim();
  
  if (!rawChatId || !content) {
    res.status(400).json({ error: "Message and valid chat ID required" });
    return;
  }
  
  const chatId = getActualChatId(currentUserId, rawChatId);
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  
  await database.execute({
    sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, 0)",
    args: [chatId, currentUserId, content, createdAt]
  });
  
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name,
      m.content, m.created_at, m.read_by_me
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 1`,
    args: [chatId]
  });
  
  const message: any = result.rows[0];
  
  const response = {
    id: Number(message.id),
    chatId: Number(message.chat_id),
    senderId: Number(message.sender_id),
    senderName: message.sender_name,
    content: message.content,
    createdAt: message.created_at,
    isMine: true,
    isRead: Number(message.read_by_me) === 1,
  };
  
  broadcastToChat(chatId, response);
  res.status(201).json(response);
});

router.delete("/chats/:chatId/messages/:messageId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const rawChatId = Number(req.params.chatId);
  const messageId = Number(req.params.messageId);

  if (!rawChatId || !messageId) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const chatId = getActualChatId(currentUserId, rawChatId);
  const database = await getDatabase();
  
  await database.execute({
    sql: "DELETE FROM messages WHERE id = ? AND chat_id = ? AND sender_id = ?",
    args: [messageId, chatId, currentUserId]
  });

  res.json({ success: true });
});

router.get("/wall/posts", async (req, res): Promise<void> => {
  const database = await getDatabase();
  const postsResult = await database.execute("SELECT id, author_id, content, created_at FROM wall_posts ORDER BY id DESC");

  const posts = [];
  for (const row of postsResult.rows) {
    const author = await getUser(database, Number(row.author_id));
    if (author) {
      posts.push({
        id: Number(row.id),
        author,
        content: row.content,
        createdAt: row.created_at,
      });
    }
  }

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
  
  await database.execute({
    sql: "INSERT INTO wall_posts (author_id, content, created_at) VALUES (?, ?, ?)",
    args: [currentUserId, content, createdAt]
  });
  
  const lastIdResult = await database.execute("SELECT id FROM wall_posts ORDER BY id DESC LIMIT 1");
  const newId = Number(lastIdResult.rows[0]?.id);
  
  const post = {
    id: newId,
    author: await getUser(database, currentUserId),
    content,
    createdAt,
  };
  
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
  const existing = await getUserByUsername(db, newUsername);
  if (existing) {
    return res.status(400).json({ error: "Пользователь с таким ником уже существует" });
  }
  const userId = await createUser(db, newUsername, password, displayName || newUsername, avatarUrl || "");
  return res.json({ id: userId, username: newUsername, displayName: displayName || newUsername, avatarUrl: avatarUrl || "" });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  let checkUsername = username.trim();
  if (!checkUsername.startsWith('@')) {
    checkUsername = '@' + checkUsername;
  }

  const db = await getDatabase();
  const user = await getUserByUsername(db, checkUsername);
  if (!user || user.password !== password) {
    return res.status(403).json({ error: "Неверный логин или пароль" });
  }
  
  await db.execute({
    sql: "UPDATE users SET last_seen = ? WHERE id = ?",
    args: [Date.now(), user.id]
  });
  
  return res.json({ id: user.id, username: user.username, displayName: user.display_name, avatarUrl: user.avatar_url });
});

router.delete("/wall/posts/:postId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const postId = Number(req.params.postId);

  if (!postId) {
    res.status(400).json({ error: "Invalid post ID" });
    return;
  }

  const database = await getDatabase();
  
  await database.execute({
    sql: "DELETE FROM wall_posts WHERE id = ? AND author_id = ?",
    args: [postId, currentUserId]
  });

  res.json({ success: true });
});

export default router;
