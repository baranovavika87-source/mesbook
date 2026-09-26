import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let socketServer: Server | undefined;

export function configureRealtime(server: HttpServer): Server {
  socketServer = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  socketServer.on("connection", (socket) => {
    // Твои старые обработчики
    socket.on("join-chat", (chatId: number) => {
      socket.join(`chat:${Number(chatId)}`);
    });
    
    socket.on("leave-chat", (chatId: number) => {
      socket.leave(`chat:${Number(chatId)}`);
    });

    socket.on("typing", ({ chatId }: { chatId: number }) => {
      socket.to(`chat:${Number(chatId)}`).emit("user:typing");
    });

    socket.on("stopTyping", ({ chatId }: { chatId: number }) => {
      socket.to(`chat:${Number(chatId)}`).emit("user:stopTyping");
    });

    // НОВЫЙ ОБРАБОТЧИК: для мгновенного обновления наших чатов
    socket.on("join", (room: string) => {
      socket.join(room);
    });
  });

  return socketServer;
}

export function broadcastToChat(chatId: number, message: unknown): void {
  if (!socketServer) return;
  socketServer.to(`chat:${chatId}`).emit("chat:message", message);
  broadcastUpdate(chatId); // Автоматически дергаем новое обновление
}

export function broadcastToWall(post: unknown): void {
  if (!socketServer) return;
  socketServer.emit("wall:post", post);
  broadcastUpdate(); // Автоматически дергаем новое обновление
}

// --- НОВЫЕ ТУРБО-ФУНКЦИИ ---

export function broadcastUpdate(chatId?: number) {
  if (!socketServer) return;
  socketServer.emit("global_update"); 
  if (chatId) {
    socketServer.to(String(chatId)).emit("chat_update", chatId);
  }
}

export function broadcastTyping(chatId: number, name: string) {
  if (!socketServer) return;
  const data = { chatId, name, time: Date.now() };
  socketServer.emit("typing_global", data); 
  socketServer.to(String(chatId)).emit("typing", data);
}
