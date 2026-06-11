import { Server } from "socket.io";
import { verifyToken, COOKIE_NAME } from "../lib/jwt.js";
import cookie from "cookie";

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
      const parsed = cookie.parse(raw || "");
      const token = parsed[COOKIE_NAME];
      if (!token) return next(new Error("Sin sesión"));
      const payload = verifyToken(token);
      socket.data.user = { id: payload.sub, rol: payload.rol, usuario: payload.usuario };
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.user.id}`);
  });

  return io;
}

export function getIO() { return io; }
