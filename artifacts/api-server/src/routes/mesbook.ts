import { Router, type IRouter } from "express";
import { getDatabase, createUser, getUserByUsername } from "../lib/database";
import { broadcastToChat, broadcastToWall, broadcastUpdate, broadcastTyping } from "../lib/realtime";

const router: IRouter = Router();

const typingStates = new Map<string, { time: number, name: string }>();

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

let schemaEnsured = false;
async function ensureSchema(database: any) {
  if (schemaEnsured) return;
  try { await database.execute("CREATE TABLE IF NOT EXISTS chat_members (chat_id INTEGER, user_id INTEGER, role TEXT DEFAULT 'member', PRIMARY KEY (chat_id, user_id))"); } catch (e) {}
  try { await database.execute("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0"); } catch (e) {}
  try { await database.execute("ALTER TABLE messages ADD COLUMN parent_id INTEGER DEFAULT NULL"); } catch (e) {}
  try { await database.execute("CREATE TABLE IF NOT EXISTS message_reactions (message_id INTEGER, user_id INTEGER, reaction TEXT, PRIMARY KEY (message_id, user_id))"); } catch (e) {}
  schemaEnsured = true;
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

router.patch("/chats/:chatId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  const { name, description, avatarUrl } = req.body;
  const database = await getDatabase();
  
  let isAdmin = false;
  const memberRes = await database.execute({ sql: "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?", args: [chatId, currentUserId] });
  if (memberRes.rows.length && memberRes.rows[0].role === 'admin') {
    isAdmin = true;
  } else if (chatId >= 100000000) {
    const chatRes = await database.execute({ sql: "SELECT participant_id FROM chats WHERE id = ?", args: [chatId - 100000000] });
    if (Number(chatRes.rows[0]?.participant_id) === currentUserId) isAdmin = true;
  }

  if (!isAdmin) { res.status(403).json({ error: "Только администратор может изменять этот чат" }); return; }

  const updates = [];
  const args = [];
  if (name !== undefined) { updates.push("name = ?"); args.push(name); }
  if (description !== undefined) { updates.push("description = ?"); args.push(description); }
  if (avatarUrl !== undefined) { updates.push("avatar_url = ?"); args.push(avatarUrl); }

  if (updates.length > 0) {
    args.push(chatId - 100000000);
    await database.execute({ sql: `UPDATE chats SET ${updates.join(", ")} WHERE id = ?`, args });
  }
  res.json({ success: true });
});

router.get("/users/search", async (req, res) => {
  try {
    const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
    const query = String(req.query.q || "").toLowerCase().trim();
    const db = await getDatabase();
    
    if (!query) return res.json([]);

    const usersResult = await db.execute({ sql: "SELECT * FROM users", args: [] });
    const filteredUsers = usersResult.rows.filter((u: any) => {
      if (Number(u.id) === currentUserId) return false;
      const un = String(u.username || '').toLowerCase();
      const dn = String(u.display_name || '').toLowerCase();
      return un.includes(query) || dn.includes(query);
    }).map((u: any) => ({
      id: Number(u.id), username: u.username, displayName: u.display_name,
      avatarUrl: u.avatar_url || "", bio: u.bio || "", lastSeen: Number(u.last_seen) || 0,
      personalChannel: u.personal_channel || "", birthDate: u.birth_date || ""
    }));

    const chatsResult = await db.execute({ sql: "SELECT * FROM chats", args: [] });
    const filteredChats = chatsResult.rows.filter((c: any) => {
      const cn = String(c.name || '').toLowerCase();
      return cn.includes(query);
    }).map((c: any) => ({
      id: Number(c.id) + 100000000, displayName: c.name,
      isGroup: Number(c.is_group) === 1, isChannel: Number(c.is_channel) === 1,
      avatarUrl: c.avatar_url || "", description: c.description || ""
    }));

    return res.json([...filteredUsers, ...filteredChats]);
  } catch (e) { return res.json([]); }
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
  const { name, description, isGroup, isChannel, avatarUrl } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const database = await getDatabase();
  await ensureSchema(database);

  await database.execute({
    sql: "INSERT INTO chats (participant_id, created_at, name, description, is_group, is_channel, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [currentUserId, new Date().toISOString(), name, description || "", isGroup ? 1 : 0, isChannel ? 1 : 0, avatarUrl || ""]
  });
  const result = await database.execute("SELECT last_insert_rowid() as id");
  const groupId = Number(result.rows[0]?.id) + 100000000;
  
  await database.execute({ sql: "INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'admin')", args: [groupId, currentUserId] });
  await database.execute({ sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, 1)", args: [groupId, currentUserId, isGroup ? "Группа создана" : "Канал создан", new Date().toISOString()] });
  
  res.json({ id: groupId, name, isGroup, isChannel, avatarUrl, description });
});

router.get("/chats/:chatId/is_member", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  const database = await getDatabase();
  await ensureSchema(database);
  
  const result = await database.execute({ sql: "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?", args: [chatId, currentUserId] });
  let role = result.rows[0]?.role;
  let isMember = result.rows.length > 0;

  if (!role && chatId >= 100000000) {
     const chatRes = await database.execute({ sql: "SELECT participant_id FROM chats WHERE id = ?", args: [chatId - 100000000] });
     if (Number(chatRes.rows[0]?.participant_id) === currentUserId) {
        role = 'admin';
        isMember = true;
        try { await database.execute({ sql: "INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'admin')", args: [chatId, currentUserId] }); } catch(e) {}
     }
  }

  let membersCount = 1;
  let onlineCount = 1;
  if (chatId >= 100000000) {
    try {
      const countRes = await database.execute({ sql: "SELECT COUNT(*) as c FROM chat_members WHERE chat_id = ?", args: [chatId] });
      membersCount = Number(countRes.rows[0]?.c) || 1;
      
      // ИСПРАВЛЕНИЕ: ЖЕСТКИЙ ЛИМИТ ОНЛАЙНА - 15 СЕКУНД
      const fifteenSecsAgo = Date.now() - 15000;
      const onlineRes = await database.execute({ sql: "SELECT COUNT(*) as c FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.chat_id = ? AND u.last_seen > ?", args: [chatId, fifteenSecsAgo] });
      onlineCount = Number(onlineRes.rows[0]?.c) || 1;
    } catch (e) {}
  }
  res.json({ isMember, role: role || 'member', membersCount, onlineCount });
});

router.post("/chats/:chatId/join", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = Number(req.params.chatId);
  const database = await getDatabase();
  await ensureSchema(database);
  try { await database.execute({ sql: "INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'member')", args: [chatId, currentUserId] }); } catch(e) {}
  res.json({ success: true });
});

router.post("/chats/:chatId/typing", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]);
  if (!currentUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.params.chatId === "saved") { res.json({ success: true }); return; }
  
  const chatId = parseChatId(currentUserId, req.params.chatId);
  if (!chatId) { res.status(400).json({ error: "Invalid chatId" }); return; }
  
  const db = await getDatabase();
  const user = await getUser(db, currentUserId);
  if (user) { 
    typingStates.set(`${chatId}_${currentUserId}`, { time: Date.now(), name: user.displayName }); 
    broadcastTyping(chatId, user.displayName); 
  }
  res.json({ success: true });
});

router.get("/chats", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  await ensureSchema(database);
  
  const chatRows = await database.execute({
    sql: `SELECT m.chat_id, m.content as last_message, m.created_at as last_message_at, m.sender_id as last_message_sender_id, m.read_by_me as last_message_read, (SELECT COUNT(*) FROM messages WHERE chat_id = m.chat_id AND sender_id != ? AND read_by_me = 0) AS unread_count
     FROM messages m WHERE m.id IN (SELECT MAX(id) FROM messages WHERE parent_id IS NULL GROUP BY chat_id)
     AND (CAST(m.chat_id / 10000 AS INT) = ? OR m.chat_id % 10000 = ? OR (m.chat_id >= 100000000 AND EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = ?)))
     ORDER BY m.created_at DESC`,
    args: [currentUserId, currentUserId, currentUserId, currentUserId]
  });

  const now = Date.now();
  const chats = await Promise.all(chatRows.rows.map(async (row: any) => {
    const cId = Number(row.chat_id);
    const typing: string[] = [];
    for (const [key, data] of typingStates.entries()) {
      if (now - data.time < 4000) {
        const [tCid, tUid] = key.split('_');
        if (Number(tCid) === cId && Number(tUid) !== currentUserId) typing.push(data.name);
      }
    }

    if (cId === currentUserId * 10000 + currentUserId) {
      return { id: "saved", participant: { id: currentUserId, displayName: "Избранное", avatarUrl: "", isSaved: true }, lastMessage: row.last_message, lastMessageAt: row.last_message_at, lastMessageSenderId: Number(row.last_message_sender_id), lastMessageRead: Number(row.last_message_read), unreadCount: Number(row.unread_count), typing };
    }
    if (cId >= 100000000) {
      const internalId = cId - 100000000;
      const groupResult = await database.execute({ sql: "SELECT name, is_group, is_channel, avatar_url, description FROM chats WHERE id = ?", args: [internalId] });
      const gRow = groupResult.rows[0];
      if (gRow) {
        return { id: cId, participant: { id: cId, displayName: gRow.name, avatarUrl: gRow.avatar_url || "", description: gRow.description || "", isGroup: Number(gRow.is_group)===1, isChannel: Number(gRow.is_channel)===1 }, lastMessage: row.last_message, lastMessageAt: row.last_message_at, lastMessageSenderId: Number(row.last_message_sender_id), lastMessageRead: Number(row.last_message_read), unreadCount: Number(row.unread_count), typing };
      }
      return null;
    }
    const u1 = Math.floor(cId / 10000);
    const u2 = cId % 10000;
    const otherUserId = (u1 === currentUserId) ? u2 : u1;
    const participant = await getUser(database, otherUserId);
    return { id: cId, participant: participant || { id: otherUserId, username: "Пользователь", displayName: "Пользователь", avatarUrl: "", lastSeen: 0 }, lastMessage: row.last_message, lastMessageAt: row.last_message_at, lastMessageSenderId: Number(row.last_message_sender_id), lastMessageRead: Number(row.last_message_read), unreadCount: Number(row.unread_count), typing };
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
  await ensureSchema(database);

  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, m.content, m.created_at, m.read_by_me, m.is_edited,
          (SELECT COUNT(*) FROM messages c WHERE c.parent_id = m.id) as comments_count
          FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ? AND m.parent_id IS NULL ORDER BY m.id ASC`,
    args: [chatId]
  });

  const reactionsRes = await database.execute({
    sql: "SELECT message_id, user_id, reaction FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE chat_id = ?)",
    args: [chatId]
  });

  const messages = result.rows.map((row: any) => {
    const msgReactions = reactionsRes.rows.filter((r: any) => Number(r.message_id) === Number(row.id));
    const reactionsCount: Record<string, number> = {};
    let myReaction = null;
    msgReactions.forEach((r: any) => {
      reactionsCount[r.reaction] = (reactionsCount[r.reaction] || 0) + 1;
      if (Number(r.user_id) === currentUserId) myReaction = r.reaction;
    });

    return {
      id: Number(row.id), chatId: Number(row.chat_id), senderId: Number(row.sender_id),
      senderName: row.sender_name || "Пользователь", content: row.content, createdAt: row.created_at,
      isMine: Number(row.sender_id) === currentUserId, isRead: Number(row.read_by_me) === 1,
      isEdited: Number(row.is_edited) === 1, commentsCount: Number(row.comments_count) || 0,
      reactions: reactionsCount, myReaction
    };
  });

  const now = Date.now();
  const typing: string[] = [];
  for (const [key, data] of typingStates.entries()) {
    if (now - data.time < 4000) {
      const [tCid, tUid] = key.split('_');
      if (Number(tCid) === chatId && Number(tUid) !== currentUserId) {
        typing.push(data.name);
      }
    }
  }

  await database.execute({ sql: "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?", args: [chatId, currentUserId] });
  res.json({ messages, typing });
});

router.get("/chats/:chatId/messages/:messageId/comments", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const messageId = Number(req.params.messageId);
  const database = await getDatabase();
  
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, u.avatar_url, m.content, m.created_at 
          FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.parent_id = ? ORDER BY m.id ASC`,
    args: [messageId]
  });

  const comments = result.rows.map((row: any) => ({
    id: Number(row.id), senderId: Number(row.sender_id), senderName: row.sender_name || "Пользователь", 
    senderAvatar: row.avatar_url, content: row.content, createdAt: row.created_at, isMine: Number(row.sender_id) === currentUserId
  }));
  res.json(comments);
});

router.post("/chats/:chatId/messages/:messageId/reaction", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const messageId = Number(req.params.messageId);
  const { reaction } = req.body;
  const chatId = Number(req.params.chatId);
  const database = await getDatabase();
  
  const existing = await database.execute({ sql: "SELECT reaction FROM message_reactions WHERE message_id = ? AND user_id = ?", args: [messageId, currentUserId] });
  if (existing.rows.length > 0) {
    if (existing.rows[0].reaction === reaction) {
      await database.execute({ sql: "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?", args: [messageId, currentUserId] });
    } else {
      await database.execute({ sql: "UPDATE message_reactions SET reaction = ? WHERE message_id = ? AND user_id = ?", args: [reaction, messageId, currentUserId] });
    }
  } else {
    await database.execute({ sql: "INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)", args: [messageId, currentUserId, reaction] });
  }
  
  broadcastUpdate(chatId);
  res.json({ success: true });
});

router.post("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  const content = String(req.body?.content || "").trim();
  const parentId = req.body?.parentId ? Number(req.body.parentId) : null;
  if (!chatId || !content) { res.status(400).json({ error: "Message required" }); return; }
  
  const database = await getDatabase();
  await ensureSchema(database);

  if (chatId >= 100000000 && !parentId) { 
    const chatInfo = await database.execute({ sql: "SELECT is_channel FROM chats WHERE id = ?", args: [chatId - 100000000] });
    if (Number(chatInfo.rows[0]?.is_channel) === 1) {
       const memberRes = await database.execute({ sql: "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?", args: [chatId, currentUserId] });
       let isAd = memberRes.rows[0]?.role === 'admin';
       if (!isAd) {
           const chatRes = await database.execute({ sql: "SELECT participant_id FROM chats WHERE id = ?", args: [chatId - 100000000] });
           if (Number(chatRes.rows[0]?.participant_id) === currentUserId) isAd = true;
       }
       if (!isAd) { res.status(403).json({ error: "Только админы могут писать в канал" }); return; }
    }
  }

  const isSaved = req.params.chatId === "saved";
  
  if (parentId) {
     await database.execute({
      sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me, parent_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [chatId, currentUserId, content, new Date().toISOString(), isSaved ? 1 : 0, parentId]
    });
  } else {
     await database.execute({
      sql: "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, ?)",
      args: [chatId, currentUserId, content, new Date().toISOString(), isSaved ? 1 : 0]
    });
  }
  
  const result = await database.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, u.display_name AS sender_name, m.content, m.created_at, m.read_by_me, m.is_edited
     FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 1`,
    args: [chatId]
  });
  
  const message: any = result.rows[0];
  const response = { id: Number(message.id), chatId: Number(message.chat_id), senderId: Number(message.sender_id), senderName: message.sender_name, content: message.content, createdAt: message.created_at, isMine: true, isRead: Number(message.read_by_me) === 1, isEdited: false, commentsCount: 0, reactions: {} };
  
  broadcastToChat(chatId, response);
  res.status(201).json(response);
});

router.patch("/chats/:chatId/messages/:messageId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  const messageId = Number(req.params.messageId);
  const { content } = req.body;

  if (!chatId || !messageId || !content) { res.status(400).json({ error: "Invalid parameters" }); return; }

  const database = await getDatabase();
  await ensureSchema(database);

  const msgRes = await database.execute({ sql: "SELECT sender_id FROM messages WHERE id = ? AND chat_id = ?", args: [messageId, chatId] });
  if (msgRes.rows.length === 0 || Number(msgRes.rows[0].sender_id) !== currentUserId) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  await database.execute({ sql: "UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?", args: [content, messageId] });
  
  broadcastUpdate(chatId);
  res.json({ success: true });
});

router.delete("/chats/:chatId/messages/:messageId", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const chatId = parseChatId(currentUserId, req.params.chatId);
  const messageId = Number(req.params.messageId);
  if (!chatId || !messageId) { res.status(400).json({ error: "Invalid parameters" }); return; }
  const database = await getDatabase();
  await database.execute({ sql: "DELETE FROM messages WHERE id = ? AND chat_id = ? AND sender_id = ?", args: [messageId, chatId, currentUserId] });
  await database.execute({ sql: "DELETE FROM messages WHERE parent_id = ?", args: [messageId] });
  await database.execute({ sql: "DELETE FROM message_reactions WHERE message_id = ?", args: [messageId] });
  
  broadcastUpdate(chatId);
  res.json({ success: true });
});

router.get("/wall/feed", async (req, res): Promise<void> => {
  const currentUserId = Number(req.headers.authorization?.split(" ")[1]) || 1;
  const database = await getDatabase();
  await ensureSchema(database);
  try {
    const feedResult = await database.execute({
      sql: `SELECT m.id, m.chat_id, m.sender_id, m.is_edited, c.name as channel_name, m.content, m.created_at,
            (SELECT COUNT(*) FROM messages comm WHERE comm.parent_id = m.id) as comments_count
            FROM messages m JOIN chat_members cm ON m.chat_id = cm.chat_id JOIN chats c ON (m.chat_id - 100000000) = c.id 
            WHERE cm.user_id = ? AND c.is_channel = 1 AND m.parent_id IS NULL ORDER BY m.created_at DESC LIMIT 50`,
      args: [currentUserId]
    });
    
    const msgIds = feedResult.rows.map((r:any) => Number(r.id));
    let reactionsRes = { rows: [] as any[] };
    if (msgIds.length > 0) {
       reactionsRes = await database.execute({
         sql: `SELECT message_id, user_id, reaction FROM message_reactions WHERE message_id IN (${msgIds.join(',')})`,
         args: []
       });
    }

    const posts = feedResult.rows.map((row: any) => {
      const msgId = Number(row.id);
      const msgReactions = reactionsRes.rows.filter((r: any) => Number(r.message_id) === msgId);
      const reactionsCount: Record<string, number> = {};
      let myReaction = null;
      msgReactions.forEach((r: any) => {
        reactionsCount[r.reaction] = (reactionsCount[r.reaction] || 0) + 1;
        if (Number(r.user_id) === currentUserId) myReaction = r.reaction;
      });

      return { 
        id: msgId, chatId: Number(row.chat_id), senderId: Number(row.sender_id),
        isEdited: Number(row.is_edited) === 1, channelName: row.channel_name, 
        content: row.content, createdAt: row.created_at, isMine: Number(row.sender_id) === currentUserId,
        commentsCount: Number(row.comments_count) || 0,
        reactions: reactionsCount,
        myReaction
      };
    });
    res.json(posts);
  } catch (e) { res.json([]); }
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
