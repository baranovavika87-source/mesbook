import { Router, type IRouter } from "express";
import { getDatabase, createUser, getUserByUsername } from "../lib/database";
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
    personalChannel: row.personal_channel || "",
    birthDate: row.birth_date || "",
  };
}

async function getUser(database: any, id: number) {
  const result = await database.execute({
    sql: "SELECT id, username, display_name, avatar_url, bio, last_seen, personal_channel, birth_date FROM users WHERE id = ?", 
    args: [id],
  });
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

function parseChatId(currentUserId: number, paramId: string) {
  if (paramId === "saved") return currentUserId * 10000 + currentUserId; 
  const numericId = Number(paramId);
  if (isNaN(numericId)) return null;
  if (numericId >= 100000000) return numericId;
  if (numericId >= 10000) return numericId; 
  const min = Math.min(currentUserId, numericId);
  const max = Math.max(currentUserId, numericId);
  return min * 10000 + max;
}

let isMembersTableCreated = false;
async function ensureMembersTable(database: any) {
  if (isMembersTableCreated) return;
  try {
    await database.execute("CREATE TABLE IF NOT EXISTS chat_members (chat_id INTEGER, user_id INTEGER, role TEXT DEFAULT 'member', PRIMARY KEY (chat_id, user_id))");
    isMembersTableCreated = true;
  } catch (e) {}
}

router.post("/ping", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]);
  if (!currentUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const database = await getDatabase();
  await database.execute({ sql: "UPDATE users SET last_seen = ? WHERE id = ?", args: [Date.now(), currentUserId] });
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
  const { displayName, avatarUrl, username, password, bio, personalChannel, birthDate } = req.body; 
  const database = await getDatabase();
  
  if (username !== undefined && username.trim() !== "") {
    let newUsername = username.trim();
    if (!newUsername.startsWith('@')) newUsername = '@' + newUsername;
    const existing = await database.execute({ sql: "SELECT id FROM users WHERE username = ? AND id != ?", args: [newUsername, currentUserId] });
    if (existing.rows.length > 0) { res.status(400).json({ error: "Этот никнейм уже занят" }); return; }
    await database.execute({ sql: "UPDATE users SET username = ? WHERE id = ?", args: [newUsername, currentUserId] });
  }
  if (displayName !== undefined && displayName.trim() !== "") await database.execute({ sql: "UPDATE users SET display_name = ? WHERE id = ?", args: [displayName.trim(), currentUserId] });
  if (avatarUrl !== undefined) await database.execute({ sql: "UPDATE users SET avatar_url = ? WHERE id = ?", args: [avatarUrl, currentUserId] });
  if (bio !== undefined) await database.execute({ sql: "UPDATE users SET bio = ? WHERE id = ?", args: [bio, currentUserId] });
  if (password !== undefined && password.trim() !== "") await database.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [password, currentUserId] });
  
  if (personalChannel !== undefined) await database.execute({ sql: "UPDATE users SET personal_channel = ? WHERE id = ?", args: [personalChannel, currentUserId] });
  if (birthDate !== undefined) await database.execute({ sql: "UPDATE users SET birth_date = ? WHERE id = ?", args: [birthDate, currentUserId] });
  
  res.json(await getUser(database, currentUserId));
});

router.get("/users/search", async (req, res) => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const query = String(req.query.q || "");
  const searchPattern1 = "%" + query + "%";
  const searchPattern2 = "%@" + query + "%";
  const db = await getDatabase();
  
  const usersResult = await db.execute({
    sql: "SELECT id, username, display_name as displayName, avatar_url as avatarUrl, bio, last_seen as lastSeen, personal_channel as personalChannel, birth_date as birthDate FROM users WHERE (username LIKE ? OR username LIKE ? OR display_name LIKE ?) AND id != ?",
    args: [searchPattern1, searchPattern2, searchPattern1, currentUserId]
  });

  const chatsResult = await db.execute({
    sql: "SELECT id, name, is_group, is_channel, avatar_url FROM chats WHERE name LIKE ?",
    args: [searchPattern1]
  });

  const foundChats = chatsResult.rows.map((r: any) => ({
    id: Number(r.id) + 100000000,
    displayName: r.name,
    isGroup: Number(r.is_group) === 1,
    isChannel: Number(r.is_channel) === 1,
    avatarUrl: r.avatar_url || ""
  }));

  return res.json([...usersResult.rows, ...foundChats]);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const database = await getDatabase();
  const user = await getUser(database, id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.post("/chats/create", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const { name, isGroup, isChannel, avatarUrl } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  
  const database = await getDatabase();
  await ensureMembersTable(database);

  await database.execute({
    sql: "INSERT INTO chats (participant_id, created_at, name, is_group, is_channel, avatar_url) VALUES (?, ?, ?, ?, ?, ?)",
    args: [currentUserId, new Date().toISOString(), name, isGroup ? 1 : 0, isChannel ? 1 : 0, avatarUrl || ""]
  });
  const result = await database.execute("SELECT last_insert_rowid() as id");
  const groupId = Number(result.rows[0]?.id) + 100000000;
  
  await database.execute({
    sql: "INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'admin')",
    args: [groupId, currentUserId]
  });

  await database.execute({
    sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, 1)",
    args: [groupId, currentUserId, isGroup ? "Группа создана" : "Канал создан", new Date().toISOString()]
  });
  
  res.json({ id: groupId, name, isGroup, isChannel, avatarUrl });
});

router.get("/chats/:chatId/is_member", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  const database = await getDatabase();
  await ensureMembersTable(database);
  
  const result = await database.execute({
    sql: "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?",
    args: [chatId, currentUserId]
  });
  res.json({ isMember: result.rows.length > 0 });
});

router.post("/chats/:chatId/join", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  const database = await getDatabase();
  await ensureMembersTable(database);
  
  try {
    await database.execute({
      sql: "INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'member')",
      args: [chatId, currentUserId]
    });
  } catch(e) {}

  res.json({ success: true });
});

router.get("/chats", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  await ensureMembersTable(database);
  
  const chatRows = await database.execute({
    sql: `SELECT 
        m.chat_id, 
        m.content as last_message,
        m.created_at as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = m.chat_id AND sender_id != ? AND read_by_me = 0) AS unread_count
     FROM messages m
     WHERE m.id IN (SELECT MAX(id) FROM messages GROUP BY chat_id)
     AND (
       CAST(m.chat_id / 10000 AS INT) = ? 
       OR m.chat_id % 10000 = ? 
       OR (m.chat_id >= 100000000 AND EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = ?))
     )
     ORDER BY m.created_at DESC`,
    args: [currentUserId, currentUserId, currentUserId, currentUserId]
  });

  const chats = await Promise.all(chatRows.rows.map(async (row: any) => {
    const cId = Number(row.chat_id);
    if (cId === currentUserId * 10000 + currentUserId) {
      return { id: "saved", participant: { id: currentUserId, displayName: "Избранное", avatarUrl: "", isSaved: true }, lastMessage: row.last_message, lastMessageAt: row.last_message_at, unreadCount: Number(row.unread_count) };
    }
    if (cId >= 100000000) {
      const internalId = cId - 100000000;
      const groupResult = await database.execute({ sql: "SELECT name, is_group, is_channel, avatar_url FROM chats WHERE id = ?", args: [internalId] });
      const gRow = groupResult.rows[0];
      if (gRow) {
        return { id: cId, participant: { id: cId, displayName: gRow.name, avatarUrl: gRow.avatar_url || "", isGroup: Number(gRow.is_group)===1, isChannel: Number(gRow.is_channel)===1 }, lastMessage: row.last_message, lastMessageAt: row.last_message_at, unreadCount: Number(row.unread_count) };
      }
      return null;
    }
    const u1 = Math.floor(cId / 10000);
    const u2 = cId % 10000;
    const otherUserId = (u1 === currentUserId) ? u2 : u1;
    const participant = await getUser(database, otherUserId);
    return { id: cId, participant: participant || { id: otherUserId, username: "Пользователь", displayName: "Пользователь", avatarUrl: "", lastSeen: 0 }, lastMessage: row.last_message, lastMessageAt: row.last_message_at, unreadCount: Number(row.unread_count) };
  }));

  res.json(chats.filter(c => c !== null));
});

router.post("/chats/:chatId/read", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  if (!chatId) { res.status(400).json({ error: "Invalid chatId" }); return; }
  const database = await getDatabase();
  await database.execute({ sql: "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?", args: [chatId, currentUserId] });
  res.json({ success: true });
});

router.get("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  if (!chatId) { res.status(400).json({ error: "Invalid chatId" }); return; }
  
  const database = await getDatabase();
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, m.content, m.created_at, m.read_by_me
     FROM messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id ASC`,
    args: [chatId]
  });

  const messages = result.rows.map((row: any) => ({
    id: Number(row.id), chatId: Number(row.chat_id), senderId: Number(row.sender_id),
    senderName: row.sender_name || "Пользователь", content: row.content, createdAt: row.created_at,
    isMine: Number(row.sender_id) === currentUserId, isRead: Number(row.read_by_me) === 1,
  }));

  await database.execute({ sql: "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?", args: [chatId, currentUserId] });
  res.json(messages);
});

router.post("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  const content = String(req.body?.content || "").trim();
  if (!chatId || !content) { res.status(400).json({ error: "Message required" }); return; }
  
  const database = await getDatabase();
  const isSaved = req.params.chatId === "saved";
  
  await database.execute({
    sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, ?)",
    args: [chatId, currentUserId, content, new Date().toISOString(), isSaved ? 1 : 0]
  });
  
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, m.content, m.created_at, m.read_by_me
     FROM messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 1`,
    args: [chatId]
  });
  
  const message: any = result.rows[0];
  const response = { id: Number(message.id), chatId: Number(message.chat_id), senderId: Number(message.sender_id), senderName: message.sender_name, content: message.content, createdAt: message.created_at, isMine: true, isRead: Number(message.read_by_me) === 1 };
  
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

router.get("/wall/feed", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  await ensureMembersTable(database);
  
  try {
    const feedResult = await database.execute({
      sql: `
        SELECT m.id, m.chat_id, c.name as channel_name, m.content, m.created_at
        FROM messages m
        JOIN chat_members cm ON m.chat_id = cm.chat_id
        JOIN chats c ON (m.chat_id - 100000000) = c.id
        WHERE cm.user_id = ? AND c.is_channel = 1
        ORDER BY m.created_at DESC
        LIMIT 50
      `,
      args: [currentUserId]
    });

    const posts = feedResult.rows.map((row: any) => ({
      id: Number(row.id),
      chatId: Number(row.chat_id),
      channelName: row.channel_name,
      content: row.content,
      createdAt: row.created_at
    }));

    res.json(posts);
  } catch (e) {
    res.json([]);
  }
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

export default router;
