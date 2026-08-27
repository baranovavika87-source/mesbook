import { Router, type IRouter } from "express";
import {
  getDatabase,
  createUser,
  getUserByUsername,
  searchUsers
} from "../lib/database";
import { broadcastToChat, broadcastToWall } from "../lib/realtime";

const router: IRouter = Router();

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

async function getUser(database: any, id: number) {
  const result = await database.execute({
    sql: "SELECT id, username, display_name, avatar_url, bio, last_seen FROM users WHERE id = ?", 
    args: [id],
  });
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

// Умный парсер ID: понимает "saved", обычных юзеров и группы (> 100000000)
function parseChatId(currentUserId: number, paramId: string) {
  if (paramId === "saved") {
    return currentUserId * 10000 + currentUserId; 
  }
  const numericId = Number(paramId);
  if (isNaN(numericId)) return null;
  if (numericId >= 100000000) return numericId; // Это Группа или Канал
  if (numericId >= 10000) return numericId; // Уже готовый ID 1-на-1
  
  const min = Math.min(currentUserId, numericId);
  const max = Math.max(currentUserId, numericId);
  return min * 10000 + max;
}

router.post("/ping", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]);
  if (!currentUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
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
  if (!user) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json(user);
});

router.patch("/me", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const { displayName, avatarUrl, username, password, bio } = req.body; 
  const database = await getDatabase();
  
  if (username !== undefined && username.trim() !== "") {
    let newUsername = username.trim();
    if (!newUsername.startsWith('@')) newUsername = '@' + newUsername;
    const existing = await database.execute({
      sql: "SELECT id FROM users WHERE username = ? AND id != ?",
      args: [newUsername, currentUserId]
    });
    if (existing.rows.length > 0) { res.status(400).json({ error: "Этот никнейм уже занят" }); return; }
    await database.execute({ sql: "UPDATE users SET username = ? WHERE id = ?", args: [newUsername, currentUserId] });
  }
  if (displayName !== undefined && displayName.trim() !== "") {
    await database.execute({ sql: "UPDATE users SET display_name = ? WHERE id = ?", args: [displayName.trim(), currentUserId] });
  }
  if (avatarUrl !== undefined) await database.execute({ sql: "UPDATE users SET avatar_url = ? WHERE id = ?", args: [avatarUrl, currentUserId] });
  if (bio !== undefined) await database.execute({ sql: "UPDATE users SET bio = ? WHERE id = ?", args: [bio, currentUserId] });
  if (password !== undefined && password.trim() !== "") await database.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [password, currentUserId] });
  
  res.json(await getUser(database, currentUserId));
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
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// НОВЫЙ РОУТ: Создание группы/канала с сохранением в БД
router.post("/chats/create", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const { name, isGroup, isChannel } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  
  const database = await getDatabase();
  await database.execute({
    sql: "INSERT INTO chats (participant_id, created_at, name, is_group, is_channel) VALUES (?, ?, ?, ?, ?)",
    args: [currentUserId, new Date().toISOString(), name, isGroup ? 1 : 0, isChannel ? 1 : 0]
  });
  const result = await database.execute("SELECT last_insert_rowid() as id");
  
  // Добавляем 100 млн к ID, чтобы группы не пересекались с обычными чатами
  const groupId = Number(result.rows[0]?.id) + 100000000;
  
  // Системное сообщение, чтобы чат сразу появился в списке
  await database.execute({
    sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, 1)",
    args: [groupId, currentUserId, isGroup ? "Группа создана" : "Канал создан", new Date().toISOString()]
  });
  
  res.json({ id: groupId, name, isGroup, isChannel });
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
     AND (CAST(m.chat_id / 10000 AS INT) = ? OR m.chat_id % 10000 = ? OR m.chat_id >= 100000000)
     ORDER BY m.created_at DESC`,
    args: [currentUserId, currentUserId, currentUserId]
  });

  const chats = await Promise.all(chatRows.rows.map(async (row: any) => {
    const cId = Number(row.chat_id);
    
    // Избранное
    if (cId === currentUserId * 10000 + currentUserId) {
      return {
        id: "saved",
        participant: { id: currentUserId, displayName: "Избранное", avatarUrl: "", isSaved: true },
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at,
        unreadCount: Number(row.unread_count)
      };
    }

    // Группа или Канал
    if (cId >= 100000000) {
      const internalId = cId - 100000000;
      const groupResult = await database.execute({ sql: "SELECT name, is_group, is_channel FROM chats WHERE id = ?", args: [internalId] });
      const gRow = groupResult.rows[0];
      if (gRow) {
        return {
          id: cId,
          participant: { id: cId, displayName: gRow.name, avatarUrl: "", isGroup: Number(gRow.is_group)===1, isChannel: Number(gRow.is_channel)===1 },
          lastMessage: row.last_message,
          lastMessageAt: row.last_message_at,
          unreadCount: Number(row.unread_count)
        };
      }
      return null;
    }

    // Обычный чат
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

  res.json(chats.filter(c => c !== null));
});

router.post("/chats/:chatId/read", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  if (!chatId) { res.status(400).json({ error: "Invalid chatId" }); return; }
  
  const database = await getDatabase();
  await database.execute({
    sql: "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?",
    args: [chatId, currentUserId]
  });
  res.json({ success: true });
});

router.get("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  if (!chatId) { res.status(400).json({ error: "Invalid chatId" }); return; }
  
  const database = await getDatabase();
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, m.content, m.created_at, m.read_by_me
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
  const chatId = parseChatId(currentUserId, req.params.chatId);
  const content = String(req.body?.content || "").trim();
  
  if (!chatId || !content) { res.status(400).json({ error: "Message required" }); return; }
  
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  
  // Если это Избранное, сразу ставим прочитано (read_by_me = 1)
  const isSaved = req.params.chatId === "saved";
  
  await database.execute({
    sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, ?)",
    args: [chatId, currentUserId, content, createdAt, isSaved ? 1 : 0]
  });
  
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, m.content, m.created_at, m.read_by_me
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 1`,
    args: [chatId]
  });
  
  const message: any = result.rows[0];
  const response = {
    id: Number(message.id), chatId: Number(message.chat_id), senderId: Number(message.sender_id),
    senderName: message.sender_name, content: message.content, createdAt: message.created_at,
    isMine: true, isRead: Number(message.read_by_me) === 1,
  };
  
  broadcastToChat(chatId, response);
  res.status(201).json(response);
});

router.delete("/chats/:chatId/messages/:messageId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  const messageId = Number(req.params.messageId);

  if (!chatId || !messageId) { res.status(400).json({ error: "Invalid parameters" }); return; }
  const database = await getDatabase();
  await database.execute({ sql: "DELETE FROM messages WHERE id = ? AND chat_id = ? AND sender_id = ?", args: [messageId, chatId, currentUserId] });
  res.json({ success: true });
});

router.get("/wall/posts", async (req, res): Promise<void> => {
  const database = await getDatabase();
  const postsResult = await database.execute("SELECT id, author_id, content, created_at FROM wall_posts ORDER BY id DESC");
  const posts = [];
  for (const row of postsResult.rows) {
    const author = await getUser(database, Number(row.author_id));
    if (author) posts.push({ id: Number(row.id), author, content: row.content, createdAt: row.created_at });
  }
  res.json(posts);
});

router.post("/wall/posts", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const content = String(req.body?.content || "").trim();
  if (!content) { res.status(400).json({ error: "Post cannot be empty" }); return; }
  
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  await database.execute({ sql: "INSERT INTO wall_posts (author_id, content, created_at) VALUES (?, ?, ?)", args: [currentUserId, content, createdAt] });
  
  const lastIdResult = await database.execute("SELECT id FROM wall_posts ORDER BY id DESC LIMIT 1");
  const post = { id: Number(lastIdResult.rows[0]?.id), author: await getUser(database, currentUserId), content, createdAt };
  
  broadcastToWall(post);
  res.status(201).json(post);
});

router.post("/register", async (req, res) => {
  const { username, password, displayName, avatarUrl } = req.body;
  let newUsername = username.trim();
  if (!newUsername.startsWith('@')) newUsername = '@' + newUsername;
  const db = await getDatabase();
  if (await getUserByUsername(db, newUsername)) return res.status(400).json({ error: "Пользователь с таким ником уже существует" });
  const userId = await createUser(db, newUsername, password, displayName || newUsername, avatarUrl || "");
  return res.json({ id: userId, username: newUsername, displayName: displayName || newUsername, avatarUrl: avatarUrl || "" });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  let checkUsername = username.trim();
  if (!checkUsername.startsWith('@')) checkUsername = '@' + checkUsername;
  const db = await getDatabase();
  const user = await getUserByUsername(db, checkUsername);
  if (!user || user.password !== password) return res.status(403).json({ error: "Неверный логин или пароль" });
  await db.execute({ sql: "UPDATE users SET last_seen = ? WHERE id = ?", args: [Date.now(), user.id] });
  return res.json({ id: user.id, username: user.username, displayName: user.display_name, avatarUrl: user.avatar_url });
});

router.delete("/wall/posts/:postId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const postId = Number(req.params.postId);
  if (!postId) { res.status(400).json({ error: "Invalid post ID" }); return; }
  const database = await getDatabase();
  await database.execute({ sql: "DELETE FROM wall_posts WHERE id = ? AND author_id = ?", args: [postId, currentUserId] });
  res.json({ success: true });
});

export default router;
