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
    socket.on("join-chat", (chatId: number) => {
      socket.join(`chat:${Number(chatId)}`);
    });

    socket.on("leave-chat", (chatId: number) => {
      socket.leave(`chat:${Number(chatId)}`);
    });
  });

  return socketServer;
}

export function broadcastToChat(chatId: number, message: unknown): void {
  socketServer?.to(`chat:${chatId}`).emit("chat:message", message);
}

export function broadcastToWall(post: unknown): void {
  socketServer?.emit("wall:post", post);
}