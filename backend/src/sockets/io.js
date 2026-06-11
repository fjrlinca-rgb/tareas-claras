import { Server } from "socket.io";
import cookie from "cookie-parser";
import { verifyToken, COOKIE_NAME } from "../lib/jwt.js";

let io = null;

export function initIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") ?? true,
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie ?? "";
      const cookies = Object.fromEntries(
        raw.split(";").map((c) => c.trim().split("=").map(decodeURIComponent))
      );
      const token = cookies[COOKIE_NAME];
      if (!token) return next(new Error("unauthorized"));
      const payload = verifyToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.user.sub}`);
  });

  return io;
}

export function getIO() { return io; }
