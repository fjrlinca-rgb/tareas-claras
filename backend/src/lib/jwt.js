import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES_IN ?? "8h";

if (!SECRET || SECRET.length < 32) {
  console.error("JWT_SECRET inválido o demasiado corto (min 32 chars).");
  process.exit(1);
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export const COOKIE_NAME = process.env.COOKIE_NAME ?? "hd_session";

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE ?? "true") === "true",
    sameSite: (process.env.COOKIE_SAMESITE ?? "lax"),
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
}
