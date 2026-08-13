import { Router, type IRouter } from "express";
import {
  CreateMessageBody,
  CreateMessageParams,
  CreateMessageResponse,
  CreateWallPostBody,
  CreateWallPostResponse,
  GetMeResponse,
  ListChatsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  ListWallPostsResponse,
  UpdateMeBody,
  UpdateMeResponse,
} from "@workspace/api-zod";
import {
  execute,
  getDatabase,
  persistDatabase,
  queryRows,
} from "../lib/database";
import { broadcastToChat, broadcastToWall } from "../lib/realtime";

const router: IRouter = Router();
const currentUserId = 1;

type UserRow = {
  id: number;
  display_name: string;
  avatar_url: string;
};

function userFromRow(row: UserRow) {
  return {
    id: Number(row.id),
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function getUser(database: Awaited<ReturnType<typeof getDatabase>>, id: number) {
  const row = queryRows<UserRow>(
    database,
    "SELECT id, display_name, avatar_url FROM users WHERE id = ?",
    [id],
  )[0];
  return row ? userFromRow(row) : null;
}

router.get("/me", async (_req, res): Promise<void> => {
  const database = await getDatabase();
  const user = getUser(database, currentUserId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetMeResponse.parse(user));
});

router.patch("/me", async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const database = await getDatabase();
  if (parsed.data.displayName !== undefined) {
    execute(
      database,
      "UPDATE users SET display_name = ? WHERE id = ?",
      [parsed.data.displayName.trim(), currentUserId],
    );
  }
  if (parsed.data.avatarUrl !== undefined) {
    execute(
      database,
      "UPDATE users SET avatar_url = ? WHERE id = ?",
      [parsed.data.avatarUrl.trim(), currentUserId],
    );
  }
  await persistDatabase(database);

  const user = getUser(database, currentUserId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(UpdateMeResponse.parse(user));
});

router.get("/chats", async (_req, res): Promise<void> => {
  const database = await getDatabase();
  const chatRows = queryRows<{
    id: number;
    participant_id: number;
    chat_created_at: string;
    created_at: string;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
  }>(
    database,
    `SELECT c.id, c.participant_id, c.created_at AS chat_created_at,
      (SELECT content FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_at,
      (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND sender_id != ? AND read_by_me = 0) AS unread_count
    FROM chats c
    ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
    [currentUserId],
  );

  const chats = chatRows.flatMap((row) => {
    const participant = getUser(database, Number(row.participant_id));
    if (!participant) return [];
    return [
      {
        id: Number(row.id),
        participant,
        lastMessage: row.last_message ?? "Start a conversation",
      lastMessageAt: row.last_message_at ?? row.chat_created_at,
        unreadCount: Number(row.unread_count),
      },
    ];
  });

  res.json(ListChatsResponse.parse(chats));
});

router.get("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const parsed = ListMessagesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
    [parsed.data.chatId],
  ).map((row) => ({
    id: Number(row.id),
    chatId: Number(row.chat_id),
    senderId: Number(row.sender_id),
    senderName: row.sender_name,
    content: row.content,
    createdAt: row.created_at,
    isMine: Number(row.sender_id) === currentUserId,
  }));

  execute(
    database,
    "UPDATE messages SET read_by_me = 1 WHERE chat_id = ? AND sender_id != ?",
    [parsed.data.chatId, currentUserId],
  );
  await persistDatabase(database);
  res.json(ListMessagesResponse.parse(messages));
});

router.post("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const params = CreateMessageParams.safeParse(req.params);
  const body = CreateMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
    error: params.success
      ? body.success
        ? "Invalid request"
        : body.error.message
      : params.error.message,
    });
    return;
  }

  const database = await getDatabase();
  const chat = queryRows<{ id: number }>(
    database,
    "SELECT id FROM chats WHERE id = ?",
    [params.data.chatId],
  )[0];
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const content = body.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }

  const createdAt = new Date().toISOString();
  execute(
    database,
    "INSERT INTO messages (chat_id, sender_id, content, created_at, read_by_me) VALUES (?, ?, ?, ?, 1)",
    [params.data.chatId, currentUserId, content, createdAt],
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
    [params.data.chatId],
  )[0];
  await persistDatabase(database);

  const response = CreateMessageResponse.parse({
    id: Number(message.id),
    chatId: Number(message.chat_id),
    senderId: Number(message.sender_id),
    senderName: message.sender_name,
    content: message.content,
    createdAt: message.created_at,
    isMine: true,
  });
  broadcastToChat(params.data.chatId, response);
  res.status(201).json(response);
});

router.get("/wall/posts", async (_req, res): Promise<void> => {
  const database = await getDatabase();
  const posts = queryRows<{
    id: number;
    author_id: number;
    content: string;
    created_at: string;
  }>(
    database,
    "SELECT id, author_id, content, created_at FROM wall_posts ORDER BY id DESC",
  ).flatMap((row) => {
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
  res.json(ListWallPostsResponse.parse(posts));
});

router.post("/wall/posts", async (req, res): Promise<void> => {
  const parsed = CreateWallPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const content = parsed.data.content.trim();
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

  const response = CreateWallPostResponse.parse(post);
  broadcastToWall(response);
  res.status(201).json(response);
});

export default router;